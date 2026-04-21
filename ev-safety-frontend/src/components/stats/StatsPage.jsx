import { useState, useEffect, useRef, useMemo } from 'react';
import { getVehicles, getLatestTelemetry, getTelemetryHistory, getCrashes } from '../../services/api';
import { createLiveClient } from '../../services/websocket';
import { BatteryIcon, BoltIcon, ThermoIcon, TireIcon, SpeedIcon, ForceIcon } from '../common/Icons';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import MultiLineChart from './charts/MultiLineChart';
import IncidentMap, { SEV_COLOR } from './IncidentMap';

/* ─────────────────────────────────────────────────────────────
   MOCK DATA — used only when backend is offline
   Ranges match real sensor specs:
     gForce  : magnitude in g (1.0 at rest, crash > 12.0)
     accelZ  : ~9.81 m/s² from gravity
     accelX/Y: small horizontal accelerations in m/s²
     currentMa: milliamps (INA219)
     tirePressureBar: 2.0–3.2 bar (normal EV tyre range)
───────────────────────────────────────────────────────────── */
const mock  = (min, max, n = 20) => Array.from({ length: n }, () => +(Math.random() * (max - min) + min).toFixed(3));
const MOCK_LABELS    = Array.from({ length: 20 }, (_, i) => `T-${(19 - i) * 0.5}s`);
const MOCK_INCIDENTS = [
  { id: 'INC-001', lat: 28.6139, lng: 77.2090, city: 'Delhi',     title: 'Battery Thermal Runaway', vehicle: 'EV-TM3-042', severity: 'critical', time: '2025-04-10 14:32' },
  { id: 'INC-002', lat: 19.0760, lng: 72.8777, city: 'Mumbai',    title: 'Collision Detected',      vehicle: 'EV-TM3-017', severity: 'high',     time: '2025-04-09 09:15' },
  { id: 'INC-003', lat: 12.9716, lng: 77.5946, city: 'Bangalore', title: 'Tire Pressure Critical',  vehicle: 'EV-R1T-008', severity: 'medium',   time: '2025-04-08 16:45' },
  { id: 'INC-004', lat: 17.3850, lng: 78.4867, city: 'Hyderabad', title: 'Sudden Deceleration',     vehicle: 'EV-TM3-031', severity: 'high',     time: '2025-04-07 11:20' },
  { id: 'INC-005', lat: 22.5726, lng: 88.3639, city: 'Kolkata',   title: 'Motor Overheat',          vehicle: 'EV-BYD-012', severity: 'medium',   time: '2025-04-06 13:55' },
  { id: 'INC-006', lat: 13.0827, lng: 80.2707, city: 'Chennai',   title: 'Battery Cell Fault',      vehicle: 'EV-NIO-005', severity: 'critical', time: '2025-04-05 08:10' },
];

const MOCK_SERIES = {
  labels:  MOCK_LABELS,
  speed:   mock(40, 120),
  battery: mock(370, 410),     // realistic EV pack voltage (V)
  temp:    mock(28, 45),
  gForce:  mock(0.9, 2.5),     // normalized g — rest ≈ 1.0, hard braking ≈ 2–3
  accelX:  mock(-2.0, 2.0),    // m/s² — lateral
  accelY:  mock(-2.0, 2.0),    // m/s² — longitudinal
  accelZ:  mock(9.2, 10.4),    // m/s² — gravity ± vertical bounce
  current: mock(500, 3000),    // mA — real EV current draw range
  tirePressure: mock(2.1, 2.9),
};

/* ─────────────────────────────────────────────────────────────
   Parse a timestamp from the backend row.
   Spring Boot serializes LocalDateTime as ISO string: "2026-04-15T14:32:05"
   or occasionally as a numeric array [2026,4,15,14,32,5].
───────────────────────────────────────────────────────────── */
function parseTimestamp(r) {
  const raw = r.recordedAt ?? r.timestamp ?? r.createdAt;
  if (!raw) return new Date();
  if (Array.isArray(raw)) {
    // [year, month, day, hour, min, sec] — month is 1-based from Java
    const [yr, mo, dy, hr, mn, sc] = raw;
    return new Date(yr, mo - 1, dy, hr, mn, sc ?? 0);
  }
  return new Date(raw);
}

function formatLabel(r) {
  const d = parseTimestamp(r);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

/* ─────────────────────────────────────────────────────────────
   Build chart series arrays from a buffer of telemetry rows.
   Takes the latest WINDOW readings so charts always show recent data.
───────────────────────────────────────────────────────────── */
const WINDOW = 20;

function extractSeries(buffer) {
  const rows = buffer.slice(-WINDOW);
  if (!rows.length) return null;

  return {
    labels:  rows.map(formatLabel),
    speed:   rows.map(r => r.speedKmh       ?? null),
    battery: rows.map(r => r.batteryVoltage  ?? null),
    temp:    rows.map(r => r.temperatureC    ?? null),
    gForce:  rows.map(r => r.gForce          ?? null),
    accelX:  rows.map(r => r.accelX          ?? null),
    accelY:  rows.map(r => r.accelY          ?? null),
    accelZ:  rows.map(r => r.accelZ          ?? null),
    current: rows.map(r => r.currentMa       ?? null),
    tirePressure: rows.map(r => r.tirePressureBar ?? null),
  };
}

/* ─────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────── */
export default function StatsPage() {
  const [vehicles,    setVehicles]    = useState([]);
  const [selectedVin, setSelectedVin] = useState(null);
  const [wsStatus,      setWsStatus]      = useState('disconnected');
  const [liveReading,   setLiveReading]   = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [incidents,     setIncidents]     = useState(MOCK_INCIDENTS);
  const [loading,     setLoading]     = useState(false);

  // Rolling buffer: seeded with history, then extended by live WS readings
  const [buffer, setBuffer] = useState([]);

  const wsClientRef = useRef(null);

  /* ── Clock ── */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── Load vehicle list on mount ── */
  useEffect(() => {
    getVehicles()
      .then(data => {
        setVehicles(data);
        if (data.length) setSelectedVin(data[0].vin ?? data[0].vehicleId);
      })
      .catch(() => setSelectedVin('EV-2025-TM3-001'));
  }, []);

  /* ── When VIN changes: reset buffer, fetch history + crashes ── */
  useEffect(() => {
    if (!selectedVin) return;
    setBuffer([]);
    setLiveReading(null);
    setLatestReading(null);
    setLoading(true);

    // Use allSettled so one failing endpoint never blocks the others
    Promise.allSettled([
      getTelemetryHistory(selectedVin, { size: 100 }),
      getCrashes(selectedVin),
      getLatestTelemetry(selectedVin),
    ])
      .then(([histResult, crashResult, latestResult]) => {
        if (histResult.status === 'fulfilled') {
          const hist = histResult.value;
          const rows = (hist?.content ?? hist ?? []).slice().reverse(); // ascending: oldest→newest
          setBuffer(rows.slice(-100));
        }
        if (crashResult.status === 'fulfilled' && crashResult.value?.length) {
          setIncidents(crashResult.value);
        }
        if (latestResult.status === 'fulfilled' && latestResult.value) {
          setLatestReading(latestResult.value);
        } else {
          console.warn('[StatsPage] /latest failed:', latestResult.reason);
          // Fall back to the newest history entry so cards still show real DB data
          if (histResult.status === 'fulfilled') {
            const hist = histResult.value;
            const rows = (hist?.content ?? hist ?? []);
            if (rows.length > 0) setLatestReading(rows[0]); // history is descending: index 0 = newest
          }
        }
      })
      .finally(() => setLoading(false));
  }, [selectedVin]);

  /* ── Append each live WS reading to the rolling buffer ── */
  useEffect(() => {
    if (!liveReading) return;
    setBuffer(prev => [...prev.slice(-99), liveReading]);
  }, [liveReading]);

  /* ── WebSocket subscription ── */
  useEffect(() => {
    if (!selectedVin) return;
    wsClientRef.current?.deactivate();
    wsClientRef.current = createLiveClient(selectedVin, setLiveReading, setWsStatus);
    return () => {
      wsClientRef.current?.deactivate();
      wsClientRef.current = null;
    };
  }, [selectedVin]);

  /* ── Poll /latest every 5 s when WebSocket is not connected ── */
  useEffect(() => {
    if (!selectedVin || wsStatus === 'connected') return;
    const id = setInterval(() => {
      getLatestTelemetry(selectedVin)
        .then(data => {
          if (!data) return;
          setLatestReading(data);
          // Also push into buffer so charts stay current during offline mode
          setBuffer(prev => {
            const last = prev[prev.length - 1];
            const newKey  = data.id        ?? data.recordedAt;
            const lastKey = last?.id       ?? last?.recordedAt;
            if (!last || newKey !== lastKey) return [...prev.slice(-99), data];
            return prev;
          });
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [selectedVin, wsStatus]);

  /* ── Chart series: real buffer when available, mock otherwise ── */
  const series = useMemo(
    () => (buffer.length > 0 ? extractSeries(buffer) : null) ?? MOCK_SERIES,
    [buffer]
  );

  /* ── Latest live reading for stat cards ── */
  // Priority: live WebSocket → /latest REST → newest entry in history buffer
  // Buffer is ascending (oldest→newest) after the .reverse() on load, so last entry is newest.
  const live = liveReading ?? latestReading ?? (buffer.length > 0 ? buffer[buffer.length - 1] : null);
  const fmt = (val, digits, unit) => val != null ? `${Number(val).toFixed(digits)} ${unit}` : '—';
  const statCards = [
    { icon: <BatteryIcon />, label: 'Battery',      value: fmt(live?.batteryVoltage,  1, 'V'),   sub: 'Pack voltage',      color: '#5ed29c' },
    { icon: <BoltIcon />,    label: 'Current',       value: fmt(live?.currentMa,       0, 'mA'),  sub: 'Draw rate',         color: '#38bdf8' },
    { icon: <ThermoIcon />,  label: 'Temperature',   value: fmt(live?.temperatureC,    1, '°C'),  sub: 'Pack temperature',  color: '#fb923c' },
    { icon: <TireIcon />,    label: 'Tire Pressure', value: fmt(live?.tirePressureBar, 2, 'bar'), sub: 'Avg. all wheels',   color: '#a78bfa' },
    { icon: <SpeedIcon />,   label: 'Speed',         value: fmt(live?.speedKmh,        1, 'km/h'),sub: 'Current velocity',  color: '#f472b6' },
    { icon: <ForceIcon />,   label: 'G-Force',       value: fmt(live?.gForce,          3, 'g'),   sub: 'Resultant load',    color: '#34d399' },
  ];

  // Tire pressure bar chart: show all 4 wheels from latest reading
  // ESP32 sends one bar value — apply to all wheels until per-wheel sensors are wired
  const tirePressureLabels = ['FL', 'FR', 'RL', 'RR'];
  const tirePressureData   = live
    ? [live.tirePressureBar, live.tirePressureBar, live.tirePressureBar, live.tirePressureBar]
    : [2.4, 2.3, 2.5, 2.2];

  // Multi-line accelerometer datasets — updated every render so the chart patch fires
  const accelDatasets = [
    { label: 'X', data: series.accelX, borderColor: '#f87171', backgroundColor: 'transparent', tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
    { label: 'Y', data: series.accelY, borderColor: '#60a5fa', backgroundColor: 'transparent', tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
    { label: 'Z', data: series.accelZ, borderColor: '#a3e635', backgroundColor: 'transparent', tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
  ];

  return (
    <div style={{ background: '#050908', minHeight: '100vh', padding: '32px clamp(16px,4vw,80px) 80px' }}>

      {/* ── Vehicle selector + Clock ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }} className="flex-col md:grid">

        <div className="glass-card" style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(94,210,156,0.1)', border: '1px solid rgba(94,210,156,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/tesla-model-3.png" alt="Vehicle" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Active Vehicle</div>
            {vehicles.length > 0 ? (
              <select
                value={selectedVin ?? ''}
                onChange={e => setSelectedVin(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 16, fontWeight: 700, fontFamily: 'Inter,sans-serif', cursor: 'pointer', width: '100%' }}
              >
                {vehicles.map(v => (
                  <option key={v.vin ?? v.id} value={v.vin ?? v.vehicleId} style={{ background: '#0f1f18' }}>
                    {v.name ?? v.vin}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>Tesla Model 3</div>
            )}
            <div style={{ fontSize: 12, color: '#5ed29c', fontFamily: 'monospace', marginTop: 2 }}>
              {selectedVin ?? 'EV-2025-TM3-001'}
              <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 6px' }}>·</span>
              <span style={{ color: wsStatus === 'connected' ? '#4ade80' : wsStatus === 'error' ? '#f87171' : '#facc15' }}>
                ● {wsStatus === 'connected' ? 'Live' : wsStatus === 'error' ? 'Error' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(94,210,156,0.1)', border: '1px solid rgba(94,210,156,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🕐</div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Session Time</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'white', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}>
        {statCards.map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 'clamp(22px,2.5vw,30px)', fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 16 }}>
          Loading telemetry history...
        </div>
      )}

      {/* ── Offline / last-known-data banner ── */}
      {wsStatus !== 'connected' && live && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 14px', background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.25)', borderRadius: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#facc15', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.05em' }}>
            Showing last recorded entry — ESP32 may be offline or WebSocket reconnecting
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            Last entry: {formatLabel(live)}
          </span>
        </div>
      )}

      {/* ── Live indicator banner ── */}
      {wsStatus === 'connected' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 14px', background: 'rgba(94,210,156,0.06)', border: '1px solid rgba(94,210,156,0.15)', borderRadius: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em' }}>
            Live — charts updating every 500 ms from ESP32 via WebSocket
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
            {buffer.length} readings in buffer
          </span>
        </div>
      )}

      {/* ── Charts ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>

        {/* Speed — full width */}
        <div className="chart-box">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
            Speed <span style={{ color: '#5ed29c', marginLeft: 8 }}>km/h</span>
          </div>
          <LineChart data={series.speed} labels={series.labels} label="Speed" yMin={0} yMax={150} height={160} />
        </div>

        {/* Battery + Temperature */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="chart-box">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Battery Voltage <span style={{ color: '#5ed29c', marginLeft: 8 }}>V</span>
            </div>
            {/* No fixed yMin/yMax — auto-scales to actual pack voltage readings */}
            <LineChart data={series.battery} labels={series.labels} label="Battery (V)" color="#5ed29c" height={160} />
          </div>
          <div className="chart-box">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Temperature <span style={{ color: '#fb923c', marginLeft: 8 }}>°C</span>
            </div>
            <LineChart data={series.temp} labels={series.labels} label="Temp (°C)" color="#fb923c" yMin={15} yMax={85} height={160} />
          </div>
        </div>

        {/* G-Force + Accelerometer XYZ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="chart-box">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              G-Force <span style={{ color: '#34d399', marginLeft: 8 }}>g</span>
              {/* Crash threshold line at 12g is visible because yMax=15 */}
              <span style={{ marginLeft: 12, fontSize: 10, color: 'rgba(239,68,68,0.7)', fontWeight: 400 }}>crash &gt; 12 g</span>
            </div>
            {/* yMin=0 (magnitude, always positive) yMax=15 (crash at 12g + headroom) */}
            <LineChart data={series.gForce} labels={series.labels} label="G-Force (g)" color="#34d399" yMin={0} yMax={15} height={160} />
          </div>
          <div className="chart-box">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Accelerometer <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>m/s²</span>
            </div>
            <MultiLineChart labels={series.labels} height={160} datasets={accelDatasets} />
          </div>
        </div>

        {/* Tire Pressure (25%) + Current Draw (75%) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 16 }}>
          <div className="chart-box">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Tire Pressure <span style={{ color: '#a78bfa', marginLeft: 8 }}>bar</span>
            </div>
            <BarChart data={tirePressureData} labels={tirePressureLabels} color="#a78bfa" height={160} />
          </div>
          <div className="chart-box">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Current Draw <span style={{ color: '#38bdf8', marginLeft: 8 }}>mA</span>
            </div>
            <BarChart data={series.current} labels={series.labels} color="#38bdf8" height={160} />
          </div>
        </div>
      </div>

      {/* ── Incident Map ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div>
            <p className="section-label">Incident Intelligence</p>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginTop: 4 }}>Live Incident Map</h3>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            {Object.entries(SEV_COLOR).map(([k, v]) => (
              <span key={k} style={{ fontSize: 11, color: v, background: `${v}18`, border: `1px solid ${v}44`, padding: '3px 10px', borderRadius: 999, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                {k}
              </span>
            ))}
          </div>
        </div>
        <IncidentMap incidents={incidents} />
      </div>

      {/* ── Crash Events Table ── */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Crash Events Log</h4>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="inc-table">
            <thead>
              <tr>
                <th>ID</th><th>Vehicle</th><th>Event</th><th>Location</th><th>Severity</th><th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc, i) => {
                const gPeak = inc.gForcePeak ?? inc.peakGForce ?? 0;
                const severity = inc.severity ?? (gPeak > 15 ? 'critical' : gPeak > 12 ? 'high' : 'medium');
                return (
                  <tr key={inc.id ?? i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{inc.id ?? `INC-${String(i + 1).padStart(3, '0')}`}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#5ed29c' }}>{inc.vehicle ?? inc.vin ?? '—'}</td>
                    <td style={{ fontWeight: 500 }}>{inc.title ?? `G-Force Peak: ${gPeak.toFixed(2)} g`}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{inc.city ?? `${(inc.latitude ?? inc.lat)?.toFixed(4)}, ${(inc.longitude ?? inc.lng)?.toFixed(4)}`}</td>
                    <td><span className={`badge badge-${severity}`}>{severity}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{inc.time ?? inc.occurredAt ?? inc.timestamp ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
