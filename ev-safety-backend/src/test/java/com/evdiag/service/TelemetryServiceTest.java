package com.evdiag.service;

import com.evdiag.domain.entity.CrashEvent;
import com.evdiag.domain.entity.Vehicle;
import com.evdiag.dto.TelemetryPayload;
import com.evdiag.repository.CrashEventRepository;
import com.evdiag.repository.TelemetryRepository;
import com.evdiag.repository.VehicleRepository;
import com.evdiag.websocket.TelemetryBroadcaster;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TelemetryServiceTest {

    @Mock private VehicleRepository vehicleRepository;
    @Mock private TelemetryRepository telemetryRepository;
    @Mock private CrashEventRepository crashEventRepository;
    @Mock private TelemetryBroadcaster broadcaster;

    @InjectMocks private TelemetryService service;

    private Vehicle vehicle(String vin) {
        Vehicle v = new Vehicle();
        v.setVin(vin);
        v.setName(vin);
        return v;
    }

    private TelemetryPayload payload(String vin, double gForce) {
        return new TelemetryPayload(vin, 387.5, 120.3, 32.1, 2.4, 72.0, 0.1, 0.02, 9.8, gForce, 28.61, 77.20);
    }

    @Test
    void crashEventSaved_whenGForceExceedsThreshold() {
        when(vehicleRepository.findByVin("EV-001")).thenReturn(Optional.of(vehicle("EV-001")));

        service.process(payload("EV-001", 13.5));

        verify(crashEventRepository).save(any(CrashEvent.class));
    }

    @Test
    void noCrashEvent_whenGForceBelowThreshold() {
        when(vehicleRepository.findByVin("EV-001")).thenReturn(Optional.of(vehicle("EV-001")));

        service.process(payload("EV-001", 9.81));

        verify(crashEventRepository, never()).save(any());
    }

    @Test
    void vehicleAutoRegistered_whenUnknownVin() {
        when(vehicleRepository.findByVin("NEW-VIN")).thenReturn(Optional.empty());
        when(vehicleRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        service.process(payload("NEW-VIN", 9.81));

        ArgumentCaptor<Vehicle> captor = ArgumentCaptor.forClass(Vehicle.class);
        verify(vehicleRepository).save(captor.capture());
        assertThat(captor.getValue().getVin()).isEqualTo("NEW-VIN");
    }

    @Test
    void nullPayload_isIgnoredSafely() {
        service.process(null);

        verifyNoInteractions(telemetryRepository, crashEventRepository, broadcaster);
    }
}
