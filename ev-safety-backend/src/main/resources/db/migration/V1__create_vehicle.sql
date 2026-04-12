CREATE TABLE vehicle (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    vin           VARCHAR(50)  UNIQUE,
    registered_at TIMESTAMPTZ  DEFAULT NOW()
);
