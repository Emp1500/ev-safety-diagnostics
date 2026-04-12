package com.evdiag.service;

import com.evdiag.domain.entity.CrashEvent;
import com.evdiag.domain.entity.TelemetryReading;
import com.evdiag.domain.entity.Vehicle;
import com.evdiag.dto.TelemetryPayload;
import com.evdiag.dto.TelemetryResponse;
import com.evdiag.repository.CrashEventRepository;
import com.evdiag.repository.TelemetryRepository;
import com.evdiag.repository.VehicleRepository;
import com.evdiag.websocket.TelemetryBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryService {

    private static final double CRASH_G_FORCE_THRESHOLD = 12.0;

    private final VehicleRepository vehicleRepository;
    private final TelemetryRepository telemetryRepository;
    private final CrashEventRepository crashEventRepository;
    private final TelemetryBroadcaster broadcaster;

    @Transactional
    public void process(TelemetryPayload payload) {
        if (payload == null || payload.vehicleId() == null) return;

        Vehicle vehicle = vehicleRepository.findByVin(payload.vehicleId())
                .orElseGet(() -> registerVehicle(payload.vehicleId()));

        TelemetryReading reading = buildReading(vehicle, payload);
        telemetryRepository.save(reading);
        log.info("Saved telemetry for {} — gForce={}", payload.vehicleId(), payload.gForce());

        if (payload.gForce() != null && payload.gForce() > CRASH_G_FORCE_THRESHOLD) {
            recordCrash(vehicle, payload);
        }

        broadcaster.broadcast(vehicle.getVin(), TelemetryResponse.from(reading));
    }

    public Optional<TelemetryResponse> getLatest(String vin) {
        return vehicleRepository.findByVin(vin)
                .flatMap(v -> telemetryRepository.findTopByVehicleOrderByRecordedAtDesc(v))
                .map(TelemetryResponse::from);
    }

    public Page<TelemetryResponse> getHistory(String vin, OffsetDateTime from, OffsetDateTime to,
                                               int page, int size) {
        Vehicle vehicle = vehicleRepository.findByVin(vin)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found: " + vin));

        PageRequest pageable = PageRequest.of(page, size, Sort.by("recordedAt").descending());

        if (from != null && to != null) {
            return telemetryRepository.findByVehicleAndRecordedAtBetween(vehicle, from, to, pageable)
                    .map(TelemetryResponse::from);
        }
        return telemetryRepository.findByVehicleOrderByRecordedAtDesc(vehicle, pageable)
                .map(TelemetryResponse::from);
    }

    private Vehicle registerVehicle(String vin) {
        log.info("Auto-registering vehicle with VIN: {}", vin);
        Vehicle v = new Vehicle();
        v.setVin(vin);
        v.setName(vin);
        return vehicleRepository.save(v);
    }

    private TelemetryReading buildReading(Vehicle vehicle, TelemetryPayload p) {
        TelemetryReading r = new TelemetryReading();
        r.setVehicle(vehicle);
        r.setRecordedAt(OffsetDateTime.now());
        r.setBatteryVoltage(toBD(p.batteryVoltage()));
        r.setCurrentMa(toBD(p.currentMa()));
        r.setTemperatureC(toBD(p.temperatureC()));
        r.setTirePressureBar(toBD(p.tirePressureBar()));
        r.setSpeedKmh(toBD(p.speedKmh()));
        r.setAccelX(toBD(p.accelX()));
        r.setAccelY(toBD(p.accelY()));
        r.setAccelZ(toBD(p.accelZ()));
        r.setGForce(toBD(p.gForce()));
        return r;
    }

    private void recordCrash(Vehicle vehicle, TelemetryPayload p) {
        log.warn("CRASH DETECTED for {} — gForce={}", vehicle.getVin(), p.gForce());
        CrashEvent crash = new CrashEvent();
        crash.setVehicle(vehicle);
        crash.setGForcePeak(toBD(p.gForce()));
        crash.setLatitude(toBD(p.latitude()));
        crash.setLongitude(toBD(p.longitude()));
        crashEventRepository.save(crash);
    }

    private BigDecimal toBD(Double value) {
        return value == null ? null : BigDecimal.valueOf(value);
    }
}
