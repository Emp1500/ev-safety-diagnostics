package com.evdiag.mqtt;

import com.evdiag.dto.TelemetryPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttMessageParser {

    private final ObjectMapper objectMapper;

    public TelemetryPayload parse(String json) {
        try {
            return objectMapper.readValue(json, TelemetryPayload.class);
        } catch (Exception e) {
            log.error("Failed to parse MQTT payload: {}", json, e);
            return null;
        }
    }
}
