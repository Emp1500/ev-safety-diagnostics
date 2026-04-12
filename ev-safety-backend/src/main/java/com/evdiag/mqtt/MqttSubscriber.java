package com.evdiag.mqtt;

import com.evdiag.dto.TelemetryPayload;
import com.evdiag.service.TelemetryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttSubscriber {

    private final MqttMessageParser parser;
    private final TelemetryService telemetryService;

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void handleMessage(Message<String> message) {
        String payload = message.getPayload();
        log.debug("MQTT message received: {}", payload);

        TelemetryPayload telemetry = parser.parse(payload);
        telemetryService.process(telemetry);
    }
}
