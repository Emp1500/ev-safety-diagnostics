# NLPC EV Safety & Diagnostics System — Session Handoff

**Project:** IoT-Based Electric Vehicle Safety and Diagnostics System (NLPC-2026)
**Stack:** ESP32 → MQTT → Spring Boot 3.2.5 → PostgreSQL → React 18 Dashboard
**Environment:** Windows 11 + WSL2. Backend runs on Windows; frontend runs in WSL2 or Windows.

---

## Quick Start (Every Session)

```bash
# 1. Start PostgreSQL (if not running as a service)
#    DB: evdiag | user: evuser | pass: evpass | port: 5432

# 2. Start Mosquitto MQTT broker (port 1883)
net start mosquitto          # Windows PowerShell (admin)

# 3. Start backend
cd ev-safety-backend
mvn spring-boot:run          # http://localhost:8080

# 4. Start frontend
cd ev-safety-frontend
npm run dev                  # http://localhost:5173

# 5. Browser → http://localhost:5173/stats
```

Verify backend is alive:
```bash
curl http://localhost:8080/api/v1/vehicles
```

---

## Full Data Flow

```
ESP32 (sensors)
  │  publishes JSON every 500 ms
  │  Topic: ev/{vehicleId}/telemetry  (port 1883)
  ▼
Mosquitto MQTT Broker  (localhost:1883)
  │  Spring Integration subscribes: ev/+/telemetry
  ▼
MqttSubscriber.handleMessage()
  │  MqttMessageParser.parse() → TelemetryPayload
  ▼
TelemetryService.process()
  ├─ 1. vehicleRepository.findByVin() — auto-registers if new VIN
  ├─ 2. telemetryRepository.save(reading) ← SAVED TO DB FIRST
  ├─ 3. if gForce > 12.0 → crashEventRepository.save(crashEvent)
  └─ 4. TelemetryBroadcaster.broadcast() → WebSocket /topic/live/{vin}
                                                │
                        ┌───────────────────────┤
                        │ live (WS connected)   │ offline (WS down)
                        ▼                       ▼
               React updates charts      REST poll every 5s:
               in real-time              GET /api/v1/telemetry/{vin}/latest
                                         → shows last DB entry
                                         → updates stat cards + charts
```

**Key rule:** Data is always written to PostgreSQL before being broadcast. The frontend never reads from the ESP32 directly — only from the database (via REST or WebSocket).

---

## Project Structure

```
NLPC Vehical Safety and Diagonistic/
├── README.md                          ← this file
├── ESP32_INTEGRATION.md               ← wiring guide + MQTT payload format
├── .env                               ← DB + MQTT credentials (not committed)
│
├── ev-safety-backend/                 ← Spring Boot app
│   ├── pom.xml
│   ├── CLAUDE.md                      ← backend-specific dev guide
│   └── src/main/java/com/evdiag/
│       ├── config/
│       │   ├── MqttConfig.java        ← Mosquitto adapter, subscribes ev/+/telemetry
│       │   └── WebSocketConfig.java   ← STOMP endpoint /ws
│       ├── mqtt/
│       │   ├── MqttSubscriber.java    ← @ServiceActivator on mqttInputChannel
│       │   └── MqttMessageParser.java ← JSON → TelemetryPayload (null on parse fail)
│       ├── service/
│       │   ├── TelemetryService.java  ← core: persist + crash detect + broadcast
│       │   └── VehicleService.java    ← vehicle CRUD
│       ├── controller/
│       │   ├── TelemetryController.java   ← GET /latest, /history
│       │   ├── CrashEventController.java  ← GET /crashes/{vin}
│       │   └── VehicleController.java     ← GET+POST /vehicles
│       ├── domain/entity/
│       │   ├── Vehicle.java           ← id (UUID), name, vin, registered_at
│       │   ├── TelemetryReading.java  ← all sensor fields + vehicle FK
│       │   └── CrashEvent.java        ← lat/lng/gForcePeak + vehicle FK
│       ├── repository/
│       │   ├── TelemetryRepository.java   ← findTopByVehicle…Desc, findByVehicle…
│       │   └── CrashEventRepository.java
│       ├── websocket/
│       │   └── TelemetryBroadcaster.java  ← SimpMessagingTemplate → /topic/live/{vin}
│       └── resources/
│           ├── application.yml
│           └── db/migration/
│               ├── V1__create_vehicle.sql
│               ├── V2__create_telemetry_reading.sql
│               └── V3__create_crash_event.sql
│
└── ev-safety-frontend/                ← React 18 + Vite + Tailwind
    ├── vite.config.js                 ← proxy /api + /ws → localhost:8080
    └── src/
        ├── App.jsx                    ← router: /, /stats, /pricing
        ├── services/
        │   ├── api.js                 ← REST client (getVehicles, getLatestTelemetry, etc.)
        │   └── websocket.js           ← STOMP/SockJS createLiveClient()
        └── components/stats/
            ├── StatsPage.jsx          ← main dashboard (vehicle select, cards, charts, map)
            ├── IncidentMap.jsx        ← Leaflet map with crash markers
            └── charts/
                ├── LineChart.jsx
                ├── BarChart.jsx
                └── MultiLineChart.jsx
```

---

## Database

**Connection:** `jdbc:postgresql://localhost:5432/evdiag`
**Credentials:** `evuser / evpass`
**Schema managed by Flyway** — never edit migration files, always add a new `V{n}__*.sql`.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `vehicle` | `id` (UUID PK), `vin` (unique), `name`, `registered_at` | VIN is the external identifier everywhere |
| `telemetry_reading` | `id` (bigserial), `vehicle_id` FK, `recorded_at`, all sensor fields | Auto-indexed on `(vehicle_id, recorded_at DESC)` |
| `crash_event` | `id` (UUID), `vehicle_id` FK, `latitude`, `longitude`, `g_force_peak`, `occurred_at` | Created automatically when g-force > 12.0 |

---

## API Reference

**Base URL:** `http://localhost:8080/api/v1`
All endpoints have `@CrossOrigin(origins = "*")`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/vehicles` | List all registered vehicles |
| POST | `/vehicles` | Register vehicle — body: `{"name":"...","vin":"..."}` |
| GET | `/telemetry/{vin}/latest` | Most recent DB entry for VIN (404 if no readings) |
| GET | `/telemetry/{vin}/history` | Paginated history — params: `from`, `to`, `page`, `size` |
| GET | `/crashes/{vin}` | All crash events for VIN, sorted desc |

**Auto-registration:** If MQTT message arrives with an unknown VIN, `TelemetryService` automatically inserts a new `vehicle` row. You don't need to pre-register vehicles.

---

## MQTT Payload (ESP32 publishes this)

**Topic:** `ev/{vehicleId}/telemetry`

```json
{
  "vehicleId":       "EV-001",
  "batteryVoltage":  387.5,
  "currentMa":       1200.5,
  "temperatureC":    42.1,
  "tirePressureBar": 2.8,
  "speedKmh":        34.7,
  "accelX":          0.12,
  "accelY":         -0.05,
  "accelZ":          9.81,
  "gForce":          9.82,
  "latitude":        18.5204,
  "longitude":       73.8567
}
```

**Test without ESP32 (PowerShell):**
```powershell
@'
{"vehicleId":"EV-001","batteryVoltage":387.5,"currentMa":1200.5,"temperatureC":42.1,"tirePressureBar":2.4,"speedKmh":72.0,"accelX":0.1,"accelY":0.02,"accelZ":9.8,"gForce":1.0,"latitude":28.6139,"longitude":77.2090}
'@ | Out-File -FilePath "C:\temp\payload.json" -Encoding UTF8 -NoNewline

mosquitto_pub -h localhost -p 1883 -t "ev/EV-001/telemetry" -f "C:\temp\payload.json"
```

---

## Frontend Dashboard — How It Works

**URL:** `http://localhost:5173/stats`

**On load:**
1. `GET /api/v1/vehicles` → populates vehicle dropdown, auto-selects first
2. `GET /api/v1/telemetry/{vin}/history?size=100` → seeds rolling buffer for charts
3. `GET /api/v1/telemetry/{vin}/latest` → seeds stat cards
4. `GET /api/v1/crashes/{vin}` → seeds incident map + crash log table
5. WebSocket connects to `/ws`, subscribes to `/topic/live/{vin}`

**Live mode (ESP32 online):**
- Each WS message → appended to rolling 100-entry buffer → charts update
- Green banner: "Live — charts updating every 500 ms"

**Offline mode (ESP32 offline or WS down):**
- Yellow banner: "Showing last recorded entry — ESP32 may be offline"
- Banner shows the exact timestamp of the last DB entry
- REST poll every 5s → updates stat cards AND appends to chart buffer
- Data never goes blank — last DB entry persists until fresh data arrives

**Stat card priority (what value is shown):**
```
liveReading (WS)  →  latestReading (REST)  →  buffer[last] (history)
```

**Vite proxy** (vite.config.js): `/api` and `/ws` proxy to the Spring Boot backend. The host is resolved automatically from `ip route` when running inside WSL2, or falls back to `localhost`. Override by setting `BACKEND_HOST` env var before starting the dev server.

---

## Sensors & Hardware

| Sensor | Measures | Field in payload |
|--------|----------|-----------------|
| INA219 | Battery voltage (V), current draw (mA) | `batteryVoltage`, `currentMa` |
| LM35 | Motor/pack temperature (°C) | `temperatureC` |
| HX710B | Tire pressure (bar) | `tirePressureBar` |
| Hall Effect | Vehicle speed (km/h) | `speedKmh` |
| ADXL345 | 3-axis acceleration + resultant g-force | `accelX`, `accelY`, `accelZ`, `gForce` |
| SIM808 | GPS coordinates for crash geo-tagging | `latitude`, `longitude` |

See `ESP32_INTEGRATION.md` for wiring diagrams and firmware notes.

---

## Known Decisions & Context

| Decision | Reason |
|----------|--------|
| VIN is the external key, UUID is internal | VIN matches MQTT topic and all API paths; UUID never exposed to ESP32 |
| `ddl-auto: validate` | Flyway owns all schema changes; Hibernate only validates on startup |
| Auto-register unknown VIN | Simplifies ESP32 firmware — no pre-registration step needed |
| `getHistory()` returns empty page for unknown VIN | Was throwing 500; fixed to return empty page so frontend handles gracefully |
| Polling also appends to chart buffer | Was only updating stat cards; fixed so charts also update during offline mode |
| Mock data fallback in frontend | Charts/map show plausible data if both WS and REST fail completely (demo safety net) |
| Crash threshold: g-force > 12.0 m/s² | Auto-creates `crash_event` row; plotted on Leaflet map with severity coloring |

---

## Environment File (`.env` — not committed)

```env
DB_URL=jdbc:postgresql://localhost:5432/evdiag
DB_USERNAME=evuser
DB_PASSWORD=evpass
MQTT_BROKER_URL=tcp://localhost:1883
```

---

## What Was Built & Working

- [x] ESP32 MQTT → Spring Boot ingestion pipeline
- [x] PostgreSQL persistence with Flyway migrations
- [x] Crash auto-detection (g-force threshold) + CrashEvent storage
- [x] REST API (vehicles, telemetry latest/history, crashes)
- [x] WebSocket live push via STOMP
- [x] React dashboard with real-time charts (Chart.js), incident map (Leaflet)
- [x] Offline fallback — last DB entry shown with yellow banner when ESP32 is offline
- [x] Chart updates during offline REST polling (not just stat cards)

## What Could Come Next

- [ ] Multi-vehicle simultaneous dashboard view
- [ ] Email/SMS alert on crash event
- [ ] Per-wheel tire pressure sensors (currently all 4 wheels show the same value)
- [ ] Data export (CSV / PDF)
- [ ] Login / auth for dashboard
- [ ] Prometheus metrics + Grafana observability
