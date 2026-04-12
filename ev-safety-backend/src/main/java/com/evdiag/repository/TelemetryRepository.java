package com.evdiag.repository;

import com.evdiag.domain.entity.TelemetryReading;
import com.evdiag.domain.entity.Vehicle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface TelemetryRepository extends JpaRepository<TelemetryReading, Long> {

    Optional<TelemetryReading> findTopByVehicleOrderByRecordedAtDesc(Vehicle vehicle);

    Page<TelemetryReading> findByVehicleAndRecordedAtBetween(
            Vehicle vehicle,
            OffsetDateTime from,
            OffsetDateTime to,
            Pageable pageable
    );

    Page<TelemetryReading> findByVehicleOrderByRecordedAtDesc(Vehicle vehicle, Pageable pageable);
}
