package com.evdiag.controller;

import com.evdiag.dto.CrashEventResponse;
import com.evdiag.repository.CrashEventRepository;
import com.evdiag.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/crashes")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CrashEventController {

    private final VehicleRepository vehicleRepository;
    private final CrashEventRepository crashEventRepository;

    @GetMapping("/{vehicleId}")
    public ResponseEntity<List<CrashEventResponse>> getCrashes(@PathVariable String vehicleId) {
        return vehicleRepository.findByVin(vehicleId)
                .map(vehicle -> ResponseEntity.ok(
                        crashEventRepository.findByVehicleOrderByOccurredAtDesc(vehicle)
                                .stream()
                                .map(CrashEventResponse::from)
                                .toList()
                ))
                .orElse(ResponseEntity.notFound().build());
    }
}
