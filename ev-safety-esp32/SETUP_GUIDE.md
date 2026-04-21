# ESP32 Hardware Setup Guide
### NLPC EV Safety & Diagnostics — Competition Setup

This guide tells you exactly what to do to get the hardware running and data showing live on the website. Follow the steps in order.

---

## What You Need

### Hardware
- ESP32 DevKit board
- INA219 module (battery voltage + current)
- LM35 temperature sensor
- HX710B pressure sensor module
- ADXL345 accelerometer module
- Hall effect sensor
- SIM808 module (GPS + SMS)
- Jumper wires
- Breadboard or PCB
- Power supply for SIM808 (3.7V–4.2V LiPo or buck converter — **NOT the ESP32 3.3V pin**)
- USB cable (to connect ESP32 to laptop)

### Software (must be installed on laptop)
- Arduino IDE (arduino.cc/en/software)
- Java 21 (for backend)
- Maven (for backend)
- PostgreSQL (database must be running)
- Mosquitto MQTT broker
- Node.js (for frontend)

---

## Step 1 — Wire the Sensors

Connect everything exactly as shown below. Double-check before powering on.

```
ESP32 Pin       →    Component
─────────────────────────────────────────────────
GPIO 21 (SDA)   →    INA219 SDA  +  ADXL345 SDA
GPIO 22 (SCL)   →    INA219 SCL  +  ADXL345 SCL
3.3V            →    INA219 VCC  +  ADXL345 VCC
GND             →    INA219 GND  +  ADXL345 GND

GPIO 34         →    LM35 output (middle pin)
3.3V            →    LM35 VCC (left pin)
GND             →    LM35 GND (right pin)

GPIO 4          →    HX710B DOUT
GPIO 14         →    HX710B SCK
3.3V            →    HX710B VCC
GND             →    HX710B GND

GPIO 35         →    Hall sensor OUT
3.3V            →    Hall sensor VCC
GND             →    Hall sensor GND

GPIO 16 (RX)    →    SIM808 TX
GPIO 17 (TX)    →    SIM808 RX
3.7–4.2V        →    SIM808 VCC  ⚠ Use separate power supply
GND             →    SIM808 GND
```

> ⚠ **Important:** SIM808 needs its own 3.7–4.2V power supply (up to 2A). If you power it from ESP32's 3.3V pin, the ESP32 will keep resetting.

---

## Step 2 — Install Arduino Libraries

Open Arduino IDE → go to **Sketch → Include Library → Manage Libraries** and install these one by one:

| Search for | Install |
|---|---|
| `PubSubClient` | PubSubClient by Nick O'Leary |
| `ArduinoJson` | ArduinoJson by Benoit Blanchon (install v6.x) |
| `Blynk` | Blynk by Volodymyr Shymanskyy |
| `Adafruit INA219` | Adafruit INA219 |
| `Adafruit ADXL345` | Adafruit ADXL345 |
| `Adafruit Unified Sensor` | Adafruit Unified Sensor |

Also make sure **ESP32 board support** is installed:
- Go to **File → Preferences** → paste this URL in "Additional boards manager URLs":
  `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
- Go to **Tools → Board → Boards Manager** → search `esp32` → install **esp32 by Espressif Systems**

---

## Step 3 — Set Up the Hotspot

1. Turn on the **mobile hotspot** on your phone
2. Connect your **laptop** to it
3. Connect your **ESP32** to it (configured in firmware — SSID: `VivoY725G`)
4. On your laptop, open Command Prompt and run:
   ```
   ipconfig
   ```
5. Look for **IPv4 Address** under Wi-Fi — note this IP (e.g. `10.133.62.199`)
6. If the IP has changed from `10.133.62.199`, open the firmware file and update line 26:
   ```cpp
   #define MQTT_BROKER_IP  "your-new-ip-here"
   ```

---

## Step 4 — Start the Backend (Laptop)

Open a terminal in the `ev-safety-backend` folder and run:

```bash
mvn spring-boot:run
```

Wait until you see:
```
Started EvSafetyApplication in X seconds
```

> If it fails, make sure PostgreSQL is running and Mosquitto is running first.

**Start Mosquitto** (open a separate terminal):
```bash
mosquitto -c mosquitto.conf
```
If you don't have a config file, run:
```bash
mosquitto
```
> On Windows, Mosquitto may already be running as a service — check Task Manager.

---

## Step 5 — Start the Frontend (Laptop)

Open another terminal in the `ev-safety-frontend` folder and run:

```bash
npm run dev
```

Open your browser and go to: **http://localhost:5173**

You should see the dashboard. The Tesla Model 3 should already be in the vehicle dropdown.

---

## Step 6 — Flash the ESP32

1. Connect ESP32 to laptop via USB cable
2. Open Arduino IDE
3. Open the file: `ev-safety-esp32/ev-safety-esp32.ino`
4. Go to **Tools → Board** → select **ESP32 Dev Module**
5. Go to **Tools → Port** → select the COM port your ESP32 is on (e.g. COM3 or COM4)
6. Click the **Upload** button (right arrow icon)
7. Wait for "Done uploading"

---

## Step 7 — Check It's Working

1. In Arduino IDE go to **Tools → Serial Monitor**
2. Set baud rate to **115200**
3. Press the **reset button** on ESP32
4. You should see this sequence:

```
=== NLPC EV Safety — Booting ===
[HX710B] Zero calibrating — keep sensor unloaded...
[HX710B] Offset = 123456
[SIM808] Ready
[I2C] INA219 + ADXL345 ready
[WiFi] Connecting to VivoY725G........
[WiFi] Connected — IP: 10.133.x.x
[Blynk] Connected: YES
[MQTT] Topic: ev/1HGBH41JXMN109186/telemetry
=== Boot complete — publishing to BOTH Blynk + backend ===

[DUAL] Blynk:OK MQTT:OK | gF=9.81 spd=0.0 tmp=28.5 pres=2.40bar
[DUAL] Blynk:OK MQTT:OK | gF=9.81 spd=0.0 tmp=28.5 pres=2.40bar
```

5. Switch to your browser → go to the dashboard → select **Tesla Model 3** from the dropdown
6. You should see the stat cards updating every 500ms with live sensor data ✅

---

## Step 8 — Test Crash Detection

1. Pick up the ESP32 and **shake it hard** (or tap it sharply on the table)
2. Watch the Serial Monitor — you should see:
   ```
   [CRASH] gForce threshold exceeded — immediate publish + SMS
   ```
3. On the website, a crash pin should appear on the incident map
4. A SMS will be sent to the registered phone number with the GPS location link

> GPS needs to be **outdoors with clear sky** to get a location fix. Indoors it will show 0,0 on the map. Give it 2–3 minutes outdoors for first fix.

---

## Quick Checklist Before Demo

Run through this 15 minutes before presenting:

- [ ] Phone hotspot is ON
- [ ] Laptop connected to hotspot
- [ ] `ipconfig` confirms IP is still `10.133.62.199` (update firmware if changed)
- [ ] PostgreSQL running
- [ ] Mosquitto running
- [ ] Spring Boot running — terminal shows no errors
- [ ] Frontend running — browser open at `http://localhost:5173`
- [ ] ESP32 powered on — Serial Monitor shows `MQTT:OK`
- [ ] Website dashboard showing Tesla Model 3 live data
- [ ] Do one shake test — crash event appears on map

---

## If Something Goes Wrong

| Problem | What to check |
|---|---|
| ESP32 keeps restarting | SIM808 drawing too much power — use separate supply |
| `[WiFi] Connecting...` never finishes | Wrong SSID/password in firmware, or hotspot not on |
| `[MQTT] failed rc=-2` | Wrong broker IP — rerun `ipconfig` and update firmware |
| `[MQTT] failed rc=-4` | Mosquitto not running on laptop |
| Website shows no data | Spring Boot not running, or VIN mismatch |
| Blynk shows `NO` | Blynk server unreachable — website still works fine |
| GPS shows 0,0 | Go outdoors, wait 2–3 min for satellite fix |
| Pressure reads 0 | HX710B wiring — check GPIO 4 (DOUT) and GPIO 14 (SCK) |
| Temperature reads 0 or negative | LM35 wiring — check GPIO 34 |

---

*NLPC EV Safety & Diagnostics — April 2026*
