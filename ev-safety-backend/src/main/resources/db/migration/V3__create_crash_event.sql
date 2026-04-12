CREATE TABLE crash_event (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id   UUID         NOT NULL REFERENCES vehicle(id),
    latitude     NUMERIC(10,6),
    longitude    NUMERIC(10,6),
    g_force_peak NUMERIC(6,3),
    occurred_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_crash_vehicle ON crash_event (vehicle_id, occurred_at DESC);
