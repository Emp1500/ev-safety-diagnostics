package com.evdiag.websocket;

import com.evdiag.dto.TelemetryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TelemetryBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    public void broadcast(String vehicleId, TelemetryResponse reading) {
        messagingTemplate.convertAndSend("/topic/live/" + vehicleId, reading);
    }
}
