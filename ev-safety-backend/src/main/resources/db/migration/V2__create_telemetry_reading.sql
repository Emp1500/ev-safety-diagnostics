CREATE TABLE telemetry_reading (
    id                BIGSERIAL    PRIMARY KEY,
    vehicle_id        UUID         NOT NULL REFERENCES vehicle(id),
    recorded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    battery_voltage   NUMERIC(5,2),
    current_ma        NUMERIC(7,2),
    temperature_c     NUMERIC(5,2),
    tire_pressure_bar NUMERIC(5,2),
    speed_kmh         NUMERIC(5,2),
    accel_x           NUMERIC(6,3),
    accel_y           NUMERIC(6,3),
    accel_z           NUMERIC(6,3),
    g_force           NUMERIC(6,3)
);

CREATE INDEX idx_telemetry_vehicle_time ON telemetry_reading (vehicle_id, recorded_at DESC);
