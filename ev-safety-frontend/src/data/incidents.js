/**
 * Fallback static incident data — used when the backend is offline.
 * In production, StatsPage fetches real crash events from GET /api/v1/crashes/{vin}.
 */
export const MOCK_INCIDENTS = [
  { id: 'INC-001', lat: 28.6139, lng: 77.2090, city: 'Delhi',     title: 'Battery Thermal Runaway', vehicle: 'EV-TM3-042', severity: 'critical', time: '2025-04-10 14:32' },
  { id: 'INC-002', lat: 19.0760, lng: 72.8777, city: 'Mumbai',    title: 'Collision Detected',      vehicle: 'EV-TM3-017', severity: 'high',     time: '2025-04-09 09:15' },
  { id: 'INC-003', lat: 12.9716, lng: 77.5946, city: 'Bangalore', title: 'Tire Pressure Critical',  vehicle: 'EV-R1T-008', severity: 'medium',   time: '2025-04-08 16:45' },
  { id: 'INC-004', lat: 17.3850, lng: 78.4867, city: 'Hyderabad', title: 'Sudden Deceleration',     vehicle: 'EV-TM3-031', severity: 'high',     time: '2025-04-07 11:20' },
  { id: 'INC-005', lat: 22.5726, lng: 88.3639, city: 'Kolkata',   title: 'Motor Overheat',          vehicle: 'EV-BYD-012', severity: 'medium',   time: '2025-04-06 13:55' },
  { id: 'INC-006', lat: 13.0827, lng: 80.2707, city: 'Chennai',   title: 'Battery Cell Fault',      vehicle: 'EV-NIO-005', severity: 'critical', time: '2025-04-05 08:10' },
];

export const SEV_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#eab308' };
