package com.evdiag.service;

import com.evdiag.domain.entity.Vehicle;
import com.evdiag.dto.VehicleRequest;
import com.evdiag.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VehicleService {

    private final VehicleRepository vehicleRepository;

    public List<Vehicle> listAll() {
        return vehicleRepository.findAll();
    }

    public Optional<Vehicle> findById(UUID id) {
        return vehicleRepository.findById(id);
    }

    @Transactional
    public Vehicle register(VehicleRequest request) {
        Vehicle v = new Vehicle();
        v.setName(request.name());
        v.setVin(request.vin());
        return vehicleRepository.save(v);
    }
}
