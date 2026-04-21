# ESP32 Hardware Integration Plan
### NLPC EV Safety & Diagnostics — 2026

This document is the end-to-end plan for connecting the ESP32 microcontroller and its sensors to the live dashboard. Once the hardware arrives, follow this guide in order.

---

## Table of Contents

1. [How It All Fits Together](#1-how-it-all-fits-together)
2. [Hardware & Components List](#2-hardware--components-list)
3. [Wiring Reference](#3-wiring-reference)
4. [Network Setup](#4-network-setup)
5. [ESP32 Firmware Plan](#5-esp32-firmware-plan)
6. [Libraries to Install](#6-libraries-to-install)
7. [Firmware Code Structure](#7-firmware-code-structure)
8. [MQTT Payload the ESP32 Must Send](#8-mqtt-payload-the-esp32-must-send)
9. [Crash Detection — Dual Layer](#9-crash-detection--dual-layer)
10. [Testing Without Hardware](#10-testing-without-hardware)
11. [Step-by-Step Integration Checklist](#11-step-by-step-integration-checklist)
12. [Competition Demo Setup](#12-competition-demo-setup)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. How It All Fits Together

```
┌─────────────────────────────────────────────────────────────────┐
│                        SAME Wi-Fi NETWORK                        │
│                                                                   │
│  ┌──────────────┐   MQTT publish        ┌────────────────────┐  │
│  │    ESP32     │ ──ev/{vin}/telemetry─▶ │  Mosquitto Broker  │  │
│  │              │   every 500 ms         │   localhost:1883   │  │
│  │  Sensors:    │                        └────────┬───────────┘  │
│  │  · INA219    │                                 │ subscribe    │
│  │  · LM35      │                                 ▼              │
│  │  · HX710B    │                        ┌────────────────────┐  │
│  │  · Hall      │                        │   Spring Boot      │  │
│  │  · ADXL345   │                        │   :8080            │  │
│  │  · SIM808    │                        │                    │  │
│  └──────────────┘                        │  ┌──────────────┐  │  │
│                                          │  │ Telemetry    │  │  │
│                                          │  │ Service      │  │  │
│                                          │  │ ─ persist    │  │  │
│                                          │  │ ─ crash det. │  │  │
│                                          │  │ ─ broadcast  │  │  │
│                                          │  └──────┬───────┘  │  │
│                                          └─────────┼──────────┘  │
│                                                    │ WebSocket    │
│                                                    │ STOMP        │
│                                          ┌─────────▼──────────┐  │
│                                          │  React Dashboard   │  │
│                                          │  localhost:5173     │  │
│                                          │  Live charts, map  │  │
│                                          └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Data latency target:** ESP32 publish → dashboard update in **< 200 ms**

---

## 2. Hardware & Components List

| # | Component | Purpose | Interface | Notes |
|---|-----------|---------|-----------|-------|
| 1 | **ESP32 DevKit** | Main MCU — WiFi + compute | — | Any 38-pin DevKit works |
| 2 | **INA219** | Battery voltage + current (mA) | I2C | Addr `0x40` default |
| 3 | **LM35** | Motor/pack temperature (°C) | Analog | Output: 10 mV/°C |
| 4 | **HX710B** | Tire pressure (bar) | Digital (CLK/DAT) | Pressure sensor module |
| 5 | **ADXL345** | 3-axis acceleration + G-force | I2C | Addr `0x53` default |
| 6 | **SIM808** | GPS coordinates (crash events) | UART | AT commands |
| 7 | Resistors, capacitors | Signal conditioning | — | Per sensor datasheet |
| 8 | 3.3V regulator | Power supply for sensors | — | If not on board |

---

## 3. Wiring Reference

```
ESP32 Pin    →    Component
─────────────────────────────────────────────────────

I2C Bus (shared):
  GPIO 21 (SDA) → INA219 SDA  +  ADXL345 SDA
  GPIO 22 (SCL) → INA219 SCL  +  ADXL345 SCL
  3.3V          → INA219 VCC  +  ADXL345 VCC
  GND           → INA219 GND  +  ADXL345 GND

LM35 (Temperature):
  GPIO 34 (ADC) → LM35 Vout   (analog read)
  3.3V          → LM35 Vs
  GND           → LM35 GND

HX710B (Tire Pressure):
  GPIO 26       → HX710B SCK
  GPIO 27       → HX710B DOUT
  3.3V          → HX710B VCC
  GND           → HX710B GND

Hall Effect Sensor (Speed):
  GPIO 25       → Hall OUT     (interrupt-driven pulse counting)
  3.3V          → Hall VCC
  GND           → Hall GND

SIM808 (GPS via UART):
  GPIO 16 (RX2) → SIM808 TX
  GPIO 17 (TX2) → SIM808 RX
  3.7–4.2V      → SIM808 VCC  (needs its own supply — do NOT use 3.3V)
  GND           → SIM808 GND
```

> **Important:** SIM808 requires 3.7–4.2V at up to 2A during GSM bursts. Use a dedicated LiPo or buck converter — powering it from the ESP32 3.3V pin will cause resets.

---

## 4. Network Setup

The ESP32, Mosquitto broker, Spring Boot backend, and the React dashboard all need to be on **the same network**.

### Development / Lab setup
```
Laptop (runs Mosquitto + Spring Boot + React)
    │
    └── Wi-Fi Router (or Mobile Hotspot)
            │
            └── ESP32 (connects via Wi-Fi)
```

The ESP32 firmware needs the **laptop's local IP address** (not `localhost`) as the MQTT broker address.

Find your laptop's IP:
```bash
# Windows
ipconfig          # look for IPv4 under your Wi-Fi adapter

# Linux / WSL
ip addr show      # look for inet under wlan0
```

Example result: `192.168.1.105` — this goes into the ESP32 firmware as `MQTT_BROKER_IP`.

### Mosquitto — allow external connections
By default Mosquitto only listens on localhost. Edit `mosquitto.conf`:
```
listener 1883
allow_anonymous true
```
Then restart: `mosquitto -c mosquitto.conf`

### Competition demo setup
Use a **mobile hotspot** from your phone. Connect both the laptop and the ESP32 to it. This avoids dependency on venue Wi-Fi.

---

## 5. ESP32 Firmware Plan

The firmware has four responsibilities, running in a loop:

```
┌──────────────────────────────────────────────────────┐
│  SETUP (runs once)                                    │
│  1. Connect to Wi-Fi                                  │
│  2. Connect to MQTT broker                            │
│  3. Initialize all sensors (I2C, UART, ADC)           │
│  4. Configure Hall sensor interrupt for speed         │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  LOOP (every 500 ms)                                  │
│                                                       │
│  ① READ sensors                                       │
│     INA219  → batteryVoltage, currentMa               │
│     LM35    → temperatureC                            │
│     HX710B  → tirePressureBar                         │
│     Hall    → speedKmh  (pulse count → RPM → km/h)   │
│     ADXL345 → accelX, accelY, accelZ                  │
│              → gForce = √(x²+y²+z²)                  │
│     SIM808  → latitude, longitude  (NMEA parse)       │
│                                                       │
│  ② BUILD JSON payload                                 │
│     ArduinoJson → serialize all readings              │
│                                                       │
│  ③ PUBLISH via MQTT                                   │
│     Topic: ev/{VIN}/telemetry                         │
│     QoS: 0  (fire and forget — low latency)          │
│                                                       │
│  ④ RECONNECT if broker dropped                        │
│     Non-blocking reconnect with back-off              │
└──────────────────────────────────────────────────────┘
```

### Publish interval
- **Normal operation:** every `500 ms` (2 readings/sec)
- **Crash event:** publish immediately on gForce > 12.0 — don't wait for next tick

---

## 6. Libraries to Install

Install all of these in **Arduino IDE → Library Manager** (or `platformio.ini` if using PlatformIO):

| Library | Install name | Purpose |
|---------|-------------|---------|
| `WiFi.h` | built-in ESP32 | Wi-Fi connection |
| `PubSubClient` | `PubSubClient` by Nick O'Leary | MQTT client |
| `ArduinoJson` | `ArduinoJson` by Benoit Blanchon | JSON payload builder |
| `Adafruit INA219` | `Adafruit INA219` | Battery voltage + current |
| `Adafruit ADXL345` | `Adafruit ADXL345` | Accelerometer |
| `Adafruit Unified Sensor` | `Adafruit Unified Sensor` | Dependency for above |
| `TinyGPSPlus` | `TinyGPSPlus` by Mikal Hart | Parse SIM808 NMEA sentences |
| `HardwareSerial` | built-in ESP32 | UART2 for SIM808 |

---

## 7. Firmware Code Structure

Organize the ESP32 sketch as follows — one `.h` file per sensor keeps it clean:

```
ev-safety-esp32/
├── ev-safety-esp32.ino       ← main sketch: setup(), loop(), MQTT publish
├── config.h                  ← Wi-Fi credentials, MQTT broker IP, VIN
├── sensors/
│   ├── battery.h             ← INA219 read → batteryVoltage, currentMa
│   ├── temperature.h         ← LM35 ADC read → temperatureC
│   ├── pressure.h            ← HX710B read → tirePressureBar
│   ├── speed.h               ← Hall pulse ISR → speedKmh
│   ├── accelerometer.h       ← ADXL345 → accelX/Y/Z, gForce
│   └── gps.h                 ← SIM808 UART → latitude, longitude
└── mqtt_client.h             ← connect, reconnect, publish helpers
```

### `config.h` (fill in before flashing)
```cpp
#pragma once

// Wi-Fi
#define WIFI_SSID      "YourNetworkName"
#define WIFI_PASSWORD  "YourPassword"

// MQTT — use laptop's LAN IP, NOT "localhost"
#define MQTT_BROKER_IP   "192.168.1.105"
#define MQTT_PORT        1883
#define MQTT_CLIENT_ID   "esp32-ev-001"

// Vehicle identity — must match a VIN in the backend vehicle table
#define VEHICLE_VIN      "EV-2025-TM3-001"

// Publish interval (milliseconds)
#define PUBLISH_INTERVAL_MS  500

// Crash threshold (must match backend TelemetryService.CRASH_G_FORCE_THRESHOLD)
#define CRASH_G_THRESHOLD    12.0f
```

### `ev-safety-esp32.ino` (main logic outline)
```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "sensors/battery.h"
#include "sensors/temperature.h"
#include "sensors/pressure.h"
#include "sensors/speed.h"
#include "sensors/accelerometer.h"
#include "sensors/gps.h"

WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);
char         mqttTopic[64];

void setup() {
  Serial.begin(115200);
  connectWiFi();
  mqttClient.setServer(MQTT_BROKER_IP, MQTT_PORT);
  mqttClient.setBufferSize(512);           // payload can be ~300 bytes
  snprintf(mqttTopic, sizeof(mqttTopic), "ev/%s/telemetry", VEHICLE_VIN);
  initSensors();                           // initialize I2C, ADC, UART, ISR
}

void loop() {
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();

  static unsigned long lastPublish = 0;
  if (millis() - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = millis();
    publishTelemetry();
  }
}

void publishTelemetry() {
  StaticJsonDocument<512> doc;

  doc["vehicleId"]       = VEHICLE_VIN;
  doc["batteryVoltage"]  = readBatteryVoltage();    // INA219
  doc["currentMa"]       = readCurrentMa();         // INA219
  doc["temperatureC"]    = readTemperature();        // LM35
  doc["tirePressureBar"] = readTirePressure();       // HX710B
  doc["speedKmh"]        = readSpeedKmh();           // Hall
  doc["accelX"]          = readAccelX();             // ADXL345
  doc["accelY"]          = readAccelY();
  doc["accelZ"]          = readAccelZ();
  doc["gForce"]          = readGForce();             // √(x²+y²+z²)
  doc["latitude"]        = readLatitude();           // SIM808
  doc["longitude"]       = readLongitude();

  char payload[512];
  serializeJson(doc, payload);
  mqttClient.publish(mqttTopic, payload);
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nConnected. IP: " + WiFi.localIP().toString());
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc="); Serial.println(mqttClient.state());
      delay(3000);
    }
  }
}
```

---

## 8. MQTT Payload the ESP32 Must Send

The backend expects **exactly this JSON structure**. Field names are case-sensitive.

```json
{
  "vehicleId":       "EV-2025-TM3-001",
  "batteryVoltage":  387.5,
  "currentMa":       120.3,
  "temperatureC":    32.1,
  "tirePressureBar": 2.4,
  "speedKmh":        72.0,
  "accelX":          0.10,
  "accelY":          0.02,
  "accelZ":          9.80,
  "gForce":          9.81,
  "latitude":        28.6139,
  "longitude":       77.2090
}
```

**Units table:**

| Field | Unit | Sensor | Typical range |
|-------|------|--------|---------------|
| `batteryVoltage` | Volts | INA219 | 350–420 V (EV pack) |
| `currentMa` | Milliamps | INA219 | 0–5000 mA |
| `temperatureC` | °Celsius | LM35 | 20–80 °C |
| `tirePressureBar` | Bar | HX710B | 2.0–3.5 bar |
| `speedKmh` | km/h | Hall sensor | 0–150 km/h |
| `accelX/Y/Z` | m/s² | ADXL345 | −20 to +20 |
| `gForce` | m/s² | Computed | 0–50 (crash = >12) |
| `latitude` | Decimal degrees | SIM808 | — |
| `longitude` | Decimal degrees | SIM808 | — |

---

## 9. Crash Detection — Dual Layer

Crash detection happens at **two places** — ESP32 for fast local alerting, backend for persistence:

```
ADXL345 reads acceleration every 500 ms
         │
         ▼
  gForce = √(accelX² + accelY² + accelZ²)
         │
         ├── gForce > 12.0 ?
         │       │
         │       ├── YES → Flash onboard LED, buzzer (local alert)
         │       │         Publish immediately (don't wait for timer)
         │       │
         │       └── NO  → Normal publish on next 500 ms tick
         │
         ▼
  Backend receives payload via MQTT
         │
         └── TelemetryService checks gForce > 12.0
                   → Creates CrashEvent in PostgreSQL
                   → Broadcasts to all WebSocket clients
                   → Crash pin appears on dashboard map
```

> The threshold `12.0` in `config.h` must match `CRASH_G_FORCE_THRESHOLD` in `TelemetryService.java`. If you change it in one place, change it in both.

---

## 10. Testing Without Hardware

The full pipeline can be tested **right now** using `mosquitto_pub` to simulate the ESP32. This is how to verify the backend and dashboard are wired correctly before hardware arrives.

### Simulate a normal telemetry reading

**PowerShell (Windows):**
```powershell
# Write payload to a temp file (avoids PS quote-stripping issues)
@'
{"vehicleId":"EV-2025-TM3-001","batteryVoltage":387.5,"currentMa":120.3,"temperatureC":32.1,"tirePressureBar":2.4,"speedKmh":72.0,"accelX":0.1,"accelY":0.02,"accelZ":9.8,"gForce":9.81,"latitude":28.6139,"longitude":77.2090}
'@ | Out-File -FilePath "$env:TEMP\payload.json" -Encoding UTF8 -NoNewline

mosquitto_pub -h localhost -p 1883 -t "ev/EV-2025-TM3-001/telemetry" -f "$env:TEMP\payload.json"
```

**Linux / WSL / bash:**
```bash
mosquitto_pub -h localhost -p 1883 -t "ev/EV-2025-TM3-001/telemetry" -m \
  '{"vehicleId":"EV-2025-TM3-001","batteryVoltage":387.5,"currentMa":120.3,"temperatureC":32.1,"tirePressureBar":2.4,"speedKmh":72.0,"accelX":0.1,"accelY":0.02,"accelZ":9.8,"gForce":9.81,"latitude":28.6139,"longitude":77.2090}'
```

### Simulate a crash event (gForce > 12.0)

```bash
mosquitto_pub -h localhost -p 1883 -t "ev/EV-2025-TM3-001/telemetry" -m \
  '{"vehicleId":"EV-2025-TM3-001","batteryVoltage":380.0,"currentMa":200.0,"temperatureC":45.0,"tirePressureBar":1.8,"speedKmh":95.0,"accelX":8.5,"accelY":9.1,"accelZ":4.2,"gForce":13.5,"latitude":19.0760,"longitude":72.8777}'
```

**Expected result:**
- Dashboard stat cards update in real-time
- A new crash pin appears on the incident map
- `GET /api/v1/crashes/EV-2025-TM3-001` returns the new event

### Continuous simulation loop (bash)

```bash
# Sends a new reading every 500ms — mimics ESP32 publish rate
while true; do
  SPEED=$(awk 'BEGIN{printf "%.1f", 40 + rand() * 80}')
  GFORCE=$(awk 'BEGIN{printf "%.2f", 9.5 + rand() * 2}')
  mosquitto_pub -h localhost -p 1883 -t "ev/EV-2025-TM3-001/telemetry" -m \
    "{\"vehicleId\":\"EV-2025-TM3-001\",\"batteryVoltage\":387.5,\"currentMa\":120.3,\"temperatureC\":32.1,\"tirePressureBar\":2.4,\"speedKmh\":$SPEED,\"accelX\":0.1,\"accelY\":0.02,\"accelZ\":9.8,\"gForce\":$GFORCE,\"latitude\":28.6139,\"longitude\":77.2090}"
  sleep 0.5
done
```

---

## 11. Step-by-Step Integration Checklist

Work through this in order when the hardware arrives.

### Phase 1 — Software first (no hardware needed)
- [ ] Backend builds and runs: `mvn spring-boot:run` → no errors
- [ ] Mosquitto running on port 1883
- [ ] Frontend running: `npm run dev` → `localhost:5173`
- [ ] Stats page shows vehicle in dropdown (after first MQTT publish auto-registers it)
- [ ] `mosquitto_pub` simulation works → dashboard updates live
- [ ] Crash simulation creates event on map

### Phase 2 — ESP32 firmware
- [ ] Arduino IDE / PlatformIO installed
- [ ] All libraries installed (see Section 6)
- [ ] `config.h` filled in (VIN, Wi-Fi SSID/password, broker IP)
- [ ] ESP32 connects to Wi-Fi — Serial Monitor shows IP address
- [ ] ESP32 connects to MQTT broker — Serial Monitor shows "connected"
- [ ] Payload publishes — Spring Boot log shows inbound MQTT message

### Phase 3 — Sensors one by one
- [ ] **INA219** — reads battery voltage/current; values appear in stat cards
- [ ] **LM35** — temperature reads correctly (formula: `voltage / 3.3 * 3300 / 10` = °C)
- [ ] **HX710B** — pressure reads within 2.0–3.5 bar range
- [ ] **Hall sensor** — speed increases when wheel spins; 0 at rest
- [ ] **ADXL345** — accelZ ≈ 9.8 m/s² when flat (gravity); tilting changes X/Y
- [ ] **SIM808** — GPS fix acquired outdoors; lat/lng appear on incident map

### Phase 4 — Full system test
- [ ] All six sensors publishing simultaneously — all charts update
- [ ] Shake/drop test: gForce > 12.0 → crash event created → map pin appears
- [ ] Disconnect ESP32 WiFi → dashboard shows "Connecting..." indicator
- [ ] Reconnect ESP32 → data resumes automatically

---

## 12. Competition Demo Setup

### Recommended layout for demo day

```
┌─────────────────────────────────────────────┐
│           Mobile Hotspot (phone)             │
│              SSID: NLPC-DEMO                │
└───────────────┬──────────────────┬──────────┘
                │                  │
         Laptop (server)     ESP32 (sensor node)
         192.168.x.10        192.168.x.20
         ─ Mosquitto
         ─ Spring Boot
         ─ Vite (or dist/)
         ─ Browser open
```

### Pre-demo checklist (run 30 min before presenting)
- [ ] Phone hotspot ON, laptop and ESP32 both connected
- [ ] Mosquitto started with external listener enabled
- [ ] Spring Boot running — check `curl localhost:8080/api/v1/vehicles`
- [ ] Frontend running — browser open at `localhost:5173`
- [ ] Navigate to Stats tab — confirm vehicle appears in dropdown
- [ ] ESP32 powered on — Serial Monitor shows MQTT connected
- [ ] Stat cards showing real sensor values (not mock)
- [ ] Do one deliberate shake → confirm crash pin on map

### Production build (optional — single URL to show judges)
```bash
# Build frontend
cd ev-safety-frontend
npm run build

# Copy dist into Spring Boot static folder
cp -r dist/* ../ev-safety-backend/src/main/resources/static/

# Now a single URL serves everything
mvn spring-boot:run
# Open: http://localhost:8080
```

---

## 13. Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| ESP32 can't connect to MQTT | Using `localhost` instead of LAN IP | Use `ipconfig`/`ip addr` to get the laptop's real IP |
| Mosquitto refuses ESP32 connection | Mosquitto only listening on `127.0.0.1` | Add `listener 1883` + `allow_anonymous true` to `mosquitto.conf` |
| Dashboard doesn't update | Backend not running or WebSocket proxy error | Check Spring Boot is on `:8080`; check Vite proxy in `vite.config.js` |
| gForce reads 9.8 at rest | Normal — gravity | This is correct; crash triggers at > 12.0 |
| LM35 reads negative or zero | ADC pin reading 0V | Check wiring; use `GPIO 34/35/36/39` (input-only ADC pins) |
| SIM808 no GPS fix | Need outdoor/clear sky | Allow 2–3 min for cold fix; use `AT+CGPSINF=0` to query status |
| MQTT payload rejected | JSON field name mismatch | Check field names match exactly — camelCase, case-sensitive |
| Stat cards show mock data | Backend offline | Check Spring Boot log; verify VIN matches between ESP32 and DB |
| Charts empty | No history data yet | Charts populate after several readings; send a few publishes first |

---

*Last updated: April 2026 — NLPC EV Safety & Diagnostics Team*
