package com.evdiag.dto;

import com.evdiag.domain.entity.TelemetryReading;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record TelemetryResponse(
        Long id,
        String vehicleId,
        OffsetDateTime recordedAt,
        BigDecimal batteryVoltage,
        BigDecimal currentMa,
        BigDecimal temperatureC,
        BigDecimal tirePressureBar,
        BigDecimal speedKmh,
        BigDecimal accelX,
        BigDecimal accelY,
        BigDecimal accelZ,
        BigDecimal gForce
) {
    public static TelemetryResponse from(TelemetryReading r) {
        return new TelemetryResponse(
                r.getId(),
                r.getVehicle().getVin(),
                r.getRecordedAt(),
                r.getBatteryVoltage(),
                r.getCurrentMa(),
                r.getTemperatureC(),
                r.getTirePressureBar(),
                r.getSpeedKmh(),
                r.getAccelX(),
                r.getAccelY(),
                r.getAccelZ(),
                r.getGForce()
        );
    }
}
