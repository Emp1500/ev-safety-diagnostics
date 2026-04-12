# EV Safety & Diagnostics Backend

A Spring Boot backend for the **IoT-Based Electric Vehicle Safety and Diagnostics System** — built for NLPC-2026. Ingests real-time sensor data from an ESP32 microcontroller via MQTT, persists it to PostgreSQL, and serves it to a React dashboard via REST API and WebSocket.

---

## Table of Contents

- [System Overview](#system-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Database Schema](#database-schema)
- [MQTT Topics & Payload](#mqtt-topics--payload)
- [API Reference](#api-reference)
- [WebSocket](#websocket)
- [Build Phases](#build-phases)
- [Team](#team)

---

## System Overview

```
ESP32 (sensors)
    │
    │  MQTT publish  →  ev/{vehicleId}/telemetry
    ▼
Mosquitto Broker  (localhost:1883)
    │
    │  subscribe
    ▼
Spring Boot Backend
    ├── TelemetryService  →  PostgreSQL (persist readings)
    ├── CrashDetection    →  CrashEvent table (g-force > 12 m/s²)
    ├── REST API          →  /api/v1/**  (historical data)
    └── WebSocket STOMP   →  /topic/live/{vehicleId}  (live push)
                                        │
                                        ▼
                              React Frontend (Antigravity)
                              Live dashboard + charts
```

### Hardware Sensors (ESP32)

| Sensor | Measurement |
|--------|-------------|
| INA219 | Battery voltage, current (mA) |
| LM35 | Motor temperature (°C) |
| HX710B | Tire pressure (bar) |
| Hall Effect | Vehicle speed (km/h) |
| ADXL345 | 3-axis acceleration + G-force |
| SIM808 | GPS coordinates (for crash events) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Spring Boot 3.x |
| Build tool | Maven |
| Database | PostgreSQL 15+ |
| Migrations | Flyway |
| MQTT client | Eclipse Paho via Spring Integration |
| Real-time | Spring WebSocket (STOMP) |
| ORM | Spring Data JPA (Hibernate) |
| Utilities | Lombok |

---

## Project Structure

```
ev-safety-backend/
├── pom.xml
└── src/
    └── main/
        ├── java/com/evdiag/
        │   ├── EvSafetyApplication.java
        │   ├── config/
        │   │   ├── MqttConfig.java            # Mosquitto connection + channel setup
        │   │   └── WebSocketConfig.java        # STOMP endpoint registration
        │   ├── domain/
        │   │   └── entity/
        │   │       ├── Vehicle.java            # Vehicle registration info
        │   │       ├── TelemetryReading.java   # Sensor snapshot per publish cycle
        │   │       └── CrashEvent.java         # Crash/threshold breach records
        │   ├── mqtt/
        │   │   ├── MqttSubscriber.java         # Listens on ev/+/telemetry
        │   │   └── MqttMessageParser.java      # Deserializes JSON payload
        │   ├── service/
        │   │   └── TelemetryService.java       # Validate, persist, detect crash, broadcast
        │   ├── controller/
        │   │   ├── TelemetryController.java    # REST endpoints for telemetry data
        │   │   └── CrashEventController.java   # REST endpoints for crash events
        │   ├── repository/
        │   │   ├── TelemetryRepository.java
        │   │   └── CrashEventRepository.java
        │   └── websocket/
        │       └── TelemetryBroadcaster.java   # Pushes live data to /topic/live/{vehicleId}
        └── resources/
            ├── application.yml
            └── db/migration/
                ├── V1__create_vehicle.sql
                ├── V2__create_telemetry_reading.sql
                └── V3__create_crash_event.sql
```

---

## Prerequisites

Make sure you have the following installed:

- **Java 17+** — `java -version`
- **Maven 3.8+** — `mvn -version`
- **PostgreSQL 15+** — running locally or via Docker
- **Mosquitto MQTT broker** — running on port `1883`

### Quick setup with Docker (optional)

```bash
# PostgreSQL
docker run -d \
  --name ev-postgres \
  -e POSTGRES_DB=evdiag \
  -e POSTGRES_USER=evuser \
  -e POSTGRES_PASSWORD=evpass \
  -p 5432:5432 \
  postgres:15

# Mosquitto MQTT
docker run -d \
  --name ev-mosquitto \
  -p 1883:1883 \
  eclipse-mosquitto
```

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ev-safety-backend.git
cd ev-safety-backend

# 2. Configure environment (see Configuration section)
cp src/main/resources/application.yml.example src/main/resources/application.yml

# 3. Build the project
mvn clean install

# 4. Run the application
mvn spring-boot:run
```

Flyway will automatically create all database tables on first startup.

Verify the app is running:

```bash
curl http://localhost:8080/api/v1/vehicles
```

---

## Configuration

Edit `src/main/resources/application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/evdiag
    username: evuser
    password: evpass
    driver-class-name: org.postgresql.Driver

  jpa:
    hibernate:
      ddl-auto: validate        # Flyway handles schema, JPA only validates
    show-sql: false

  flyway:
    enabled: true
    locations: classpath:db/migration

mqtt:
  broker-url: tcp://localhost:1883
  client-id: ev-safety-backend
  topic: ev/+/telemetry          # + wildcard matches any vehicleId

server:
  port: 8080

websocket:
  endpoint: /ws
  topic-prefix: /topic/live
```

---

## Database Schema

### `vehicle`
```sql
CREATE TABLE vehicle (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    vin           VARCHAR(50)  UNIQUE,
    registered_at TIMESTAMPTZ  DEFAULT NOW()
);
```

### `telemetry_reading`
```sql
CREATE TABLE telemetry_reading (
    id                BIGSERIAL PRIMARY KEY,
    vehicle_id        UUID        NOT NULL REFERENCES vehicle(id),
    recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    battery_voltage   NUMERIC(5,2),      -- INA219  (volts)
    current_ma        NUMERIC(7,2),      -- INA219  (milliamps)
    temperature_c     NUMERIC(5,2),      -- LM35    (celsius)
    tire_pressure_bar NUMERIC(5,2),      -- HX710B  (bar)
    speed_kmh         NUMERIC(5,2),      -- Hall sensor
    accel_x           NUMERIC(6,3),      -- ADXL345 (m/s²)
    accel_y           NUMERIC(6,3),
    accel_z           NUMERIC(6,3),
    g_force           NUMERIC(6,3)       -- resultant magnitude
);
```

### `crash_event`
```sql
CREATE TABLE crash_event (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id   UUID        NOT NULL REFERENCES vehicle(id),
    latitude     NUMERIC(10,6),          -- SIM808 GPS
    longitude    NUMERIC(10,6),
    g_force_peak NUMERIC(6,3),
    occurred_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## MQTT Topics & Payload

### Topic format

```
ev/{vehicleId}/telemetry
```

Example: `ev/EV-001/telemetry`

### JSON payload (published by ESP32)

```json
{
  "vehicleId":       "EV-001",
  "batteryVoltage":  48.3,
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

> **Crash detection:** If `gForce > 12.0 m/s²`, the backend automatically creates a `crash_event` record with the GPS coordinates from the payload.

---

## API Reference

Base URL: `http://localhost:8080/api/v1`

### Vehicles

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/vehicles` | List all registered vehicles |
| `GET` | `/vehicles/{id}` | Get vehicle by ID |
| `POST` | `/vehicles` | Register a new vehicle |

### Telemetry

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/telemetry/{vehicleId}/latest` | Latest sensor snapshot |
| `GET` | `/telemetry/{vehicleId}/history` | Paginated historical readings |

Query params for `/history`:

```
from     ISO datetime  e.g. 2026-04-01T00:00:00Z
to       ISO datetime  e.g. 2026-04-11T23:59:59Z
page     integer       default 0
size     integer       default 20
```

Example:

```bash
GET /api/v1/telemetry/EV-001/history?from=2026-04-10T00:00:00Z&page=0&size=50
```

### Crash Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/crashes/{vehicleId}` | All crash events for a vehicle |

### Example responses

**GET `/api/v1/telemetry/EV-001/latest`**

```json
{
  "id": 1024,
  "vehicleId": "EV-001",
  "recordedAt": "2026-04-11T14:32:05Z",
  "batteryVoltage": 48.3,
  "currentMa": 1200.5,
  "temperatureC": 42.1,
  "tirePressureBar": 2.8,
  "speedKmh": 34.7,
  "gForce": 9.82
}
```

**GET `/api/v1/crashes/EV-001`**

```json
[
  {
    "id": "a1b2c3d4-...",
    "vehicleId": "EV-001",
    "latitude": 18.5204,
    "longitude": 73.8567,
    "gForcePeak": 15.4,
    "occurredAt": "2026-04-11T13:01:22Z"
  }
]
```

---

## WebSocket

The backend pushes every new telemetry reading to connected frontend clients in real time.

**STOMP endpoint:** `ws://localhost:8080/ws`

**Subscribe to live data:**

```
/topic/live/{vehicleId}
```

### Frontend usage (JavaScript)

```javascript
import { Client } from '@stomp/stompjs';

const client = new Client({
  brokerURL: 'ws://localhost:8080/ws',
  onConnect: () => {
    client.subscribe('/topic/live/EV-001', (message) => {
      const reading = JSON.parse(message.body);
      console.log('Live reading:', reading);
      // update your dashboard gauges here
    });
  }
});

client.activate();
```

Every time ESP32 publishes a sensor packet, the frontend receives it within milliseconds — no polling required.

---

## Build Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Project setup, PostgreSQL, Flyway migrations, JPA entities | 🔲 |
| 2 | MQTT ingestion — subscribe, parse, persist telemetry | 🔲 |
| 3 | REST API — telemetry history, vehicles, crash events | 🔲 |
| 4 | WebSocket — live push to dashboard on each MQTT message | 🔲 |
| 5 | Crash detection — g-force threshold, CrashEvent creation | 🔲 |
| 6 | Frontend integration — Antigravity dashboard connects | 🔲 |

---

