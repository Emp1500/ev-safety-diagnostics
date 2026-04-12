package com.evdiag.controller;

import com.evdiag.domain.entity.Vehicle;
import com.evdiag.dto.VehicleRequest;
import com.evdiag.service.VehicleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vehicles")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class VehicleController {

    private final VehicleService vehicleService;

    @GetMapping
    public List<Vehicle> listAll() {
        return vehicleService.listAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Vehicle> getById(@PathVariable UUID id) {
        return vehicleService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Vehicle> register(@RequestBody VehicleRequest request) {
        return ResponseEntity.ok(vehicleService.register(request));
    }
}
