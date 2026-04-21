/**
 * WebSocket service — connects to Spring Boot via SockJS + STOMP
 * Endpoint: /ws  (proxied by Vite in dev; direct in production)
 * Topic:    /topic/live/{vin}
 */
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/**
 * Creates and activates a STOMP client subscribed to live telemetry for a VIN.
 *
 * @param {string}   vin       — vehicle VIN to subscribe to
 * @param {Function} onMessage — called with parsed TelemetryResponse JSON on each message
 * @param {Function} onStatus  — called with 'connected' | 'disconnected' | 'error'
 * @returns {Client}           — call .deactivate() to disconnect
 */
export function createLiveClient(vin, onMessage, onStatus) {
  const client = new Client({
    webSocketFactory: () => new SockJS('/ws'),
    reconnectDelay: 5000,

    onConnect: () => {
      onStatus?.('connected');
      client.subscribe(`/topic/live/${vin}`, (frame) => {
        try {
          onMessage(JSON.parse(frame.body));
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      });
    },

    onDisconnect: () => onStatus?.('disconnected'),
    onStompError:  () => onStatus?.('error'),
    onWebSocketError: () => onStatus?.('error'),
  });

  client.activate();
  return client;
}
