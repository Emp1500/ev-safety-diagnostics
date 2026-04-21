/**
 * REST API service — all calls proxy through Vite to Spring Boot at localhost:8080
 * Base path: /api/v1  (see vite.config.js proxy)
 */
const BASE = '/api/v1';

async function request(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

/** GET /api/v1/vehicles — returns list of all registered vehicles */
export async function getVehicles() {
  return request('/vehicles');
}

/** GET /api/v1/telemetry/{vin}/latest — most recent telemetry reading for a VIN */
export async function getLatestTelemetry(vin) {
  return request(`/telemetry/${encodeURIComponent(vin)}/latest`);
}

/**
 * GET /api/v1/telemetry/{vin}/history — paginated historical telemetry
 * @param {string} vin
 * @param {{ from?: string, to?: string, page?: number, size?: number }} opts
 */
export async function getTelemetryHistory(vin, { from, to, page = 0, size = 100 } = {}) {
  const params = new URLSearchParams({ page, size });
  if (from) params.set('from', from);
  if (to)   params.set('to', to);
  return request(`/telemetry/${encodeURIComponent(vin)}/history?${params}`);
}

/** GET /api/v1/crashes/{vin} — all crash events for a VIN */
export async function getCrashes(vin) {
  return request(`/crashes/${encodeURIComponent(vin)}`);
}
