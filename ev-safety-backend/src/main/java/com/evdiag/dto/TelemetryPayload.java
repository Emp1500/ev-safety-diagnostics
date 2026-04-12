package com.evdiag.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * JSON payload published by the ESP32 on ev/{vehicleId}/telemetry.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TelemetryPayload(
        String vehicleId,
        Double batteryVoltage,
        Double currentMa,
        Double temperatureC,
        Double tirePressureBar,
        Double speedKmh,
        Double accelX,
        Double accelY,
        Double accelZ,
        Double gForce,
        Double latitude,
        Double longitude
) {}
