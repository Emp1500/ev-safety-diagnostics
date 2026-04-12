package com.evdiag.dto;

import com.evdiag.domain.entity.CrashEvent;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CrashEventResponse(
        UUID id,
        String vehicleId,
        BigDecimal latitude,
        BigDecimal longitude,
        BigDecimal gForcePeak,
        OffsetDateTime occurredAt
) {
    public static CrashEventResponse from(CrashEvent e) {
        return new CrashEventResponse(
                e.getId(),
                e.getVehicle().getVin(),
                e.getLatitude(),
                e.getLongitude(),
                e.getGForcePeak(),
                e.getOccurredAt()
        );
    }
}
