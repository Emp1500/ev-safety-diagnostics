package com.evdiag.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "telemetry_reading")
@Getter @Setter @NoArgsConstructor
public class TelemetryReading {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vehicle_id", nullable = false)
    private Vehicle vehicle;

    @Column(name = "recorded_at", nullable = false)
    private OffsetDateTime recordedAt = OffsetDateTime.now();

    @Column(name = "battery_voltage", precision = 5, scale = 2)
    private BigDecimal batteryVoltage;

    @Column(name = "current_ma", precision = 7, scale = 2)
    private BigDecimal currentMa;

    @Column(name = "temperature_c", precision = 5, scale = 2)
    private BigDecimal temperatureC;

    @Column(name = "tire_pressure_bar", precision = 5, scale = 2)
    private BigDecimal tirePressureBar;

    @Column(name = "speed_kmh", precision = 5, scale = 2)
    private BigDecimal speedKmh;

    @Column(name = "accel_x", precision = 6, scale = 3)
    private BigDecimal accelX;

    @Column(name = "accel_y", precision = 6, scale = 3)
    private BigDecimal accelY;

    @Column(name = "accel_z", precision = 6, scale = 3)
    private BigDecimal accelZ;

    @Column(name = "g_force", precision = 6, scale = 3)
    private BigDecimal gForce;
}
