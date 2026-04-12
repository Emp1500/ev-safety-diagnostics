package com.evdiag.repository;

import com.evdiag.domain.entity.CrashEvent;
import com.evdiag.domain.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CrashEventRepository extends JpaRepository<CrashEvent, UUID> {
    List<CrashEvent> findByVehicleOrderByOccurredAtDesc(Vehicle vehicle);
}
