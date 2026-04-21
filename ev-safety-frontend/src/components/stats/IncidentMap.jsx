import { useEffect, useRef } from 'react';
import L from 'leaflet';

// Fix Leaflet's broken default marker icons when bundled with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

export const SEV_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#eab308' };

/**
 * @param {Array} incidents — crash events from the API or fallback static data
 */
export default function IncidentMap({ incidents = [] }) {
  const mapRef = useRef(null);
  const instRef = useRef(null);

  useEffect(() => {
    if (instRef.current || !mapRef.current) return;

    instRef.current = L.map(mapRef.current, { zoomControl: false }).setView([20.5937, 78.9629], 5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(instRef.current);

    L.control.zoom({ position: 'bottomright' }).addTo(instRef.current);

    return () => {
      instRef.current?.remove();
      instRef.current = null;
    };
  }, []);

  // Re-render markers whenever incidents change
  useEffect(() => {
    const map = instRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer(layer => { if (layer instanceof L.CircleMarker) map.removeLayer(layer); });

    incidents.forEach(inc => {
      const lat = inc.latitude  ?? inc.lat;
      const lng = inc.longitude ?? inc.lng;
      if (lat == null || lng == null) return;

      const severity = inc.severity ?? (inc.peakGForce > 15 ? 'critical' : inc.peakGForce > 12 ? 'high' : 'medium');
      const c = SEV_COLOR[severity] ?? '#eab308';
      const title = inc.title ?? `G-Force: ${inc.peakGForce?.toFixed(1) ?? '—'} g`;
      const vehicle = inc.vehicle ?? inc.vin ?? '—';
      const city = inc.city ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      const time = inc.time ?? inc.timestamp ?? '—';

      L.circleMarker([lat, lng], { radius: 9, fillColor: c, color: c, weight: 2, opacity: 0.9, fillOpacity: 0.5 })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:Inter,sans-serif">
            <div style="color:#5ed29c;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">${severity}</div>
            <div style="font-weight:600;font-size:14px;margin-bottom:2px">${title}</div>
            <div style="color:rgba(255,255,255,0.6);font-size:12px">${vehicle} · ${city}</div>
            <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:4px">${time}</div>
          </div>
        `);
    });
  }, [incidents]);

  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.15)', overflow: 'hidden' }}>
      <div ref={mapRef} style={{ height: 420, width: '100%' }} />
    </div>
  );
}
