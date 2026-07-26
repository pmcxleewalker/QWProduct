import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { trackerAPI } from '../api/api';
import { MapPin, Zap, Clock, Battery, Navigation } from 'lucide-react';

/**
 * LiveMap
 * -------
 * Live fleet map for tenants with GPS enabled. Pulls /api/tracker/positions
 * every 30 s (matches the poller cadence) and drops a coloured pin per car.
 *
 * Pin colours:
 *   - green  : online + moving  (speed > 0)
 *   - blue   : online + idle    (speed = 0 and voltage healthy)
 *   - amber  : offline (no fresh fix)
 *   - grey   : demo tracker
 *
 * A "focus" car can be passed via `focusCarId` to pan/zoom the map to that
 * vehicle on mount (used by the "Live" button on car cards).
 */
const REFRESH_MS = 30_000;
const DEFAULT_CENTER = [53.3498, -6.2603]; // Dublin
const DEFAULT_ZOOM = 6;

// Coloured circle DIV icons — avoids shipping PNG assets
const iconFor = (status, isDemo, isFocused) => L.divIcon({
  className: 'live-map-pin',
  html: `<div style="
    width:${isFocused ? 20 : 16}px;height:${isFocused ? 20 : 16}px;
    border-radius:50%;
    background:${status === 'offline' ? '#f59e0b' : status === 'moving' ? '#10b981' : isDemo ? '#94a3b8' : '#3b82f6'};
    border:${isFocused ? '3px solid #1e40af' : '2px solid white'};
    box-shadow:0 0 0 2px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const FitBounds = ({ positions, focusCarId }) => {
  const map = useMap();
  useEffect(() => {
    if (focusCarId) {
      const p = positions.find((x) => x.car_id === focusCarId);
      if (p) map.setView([p.lat, p.lon], 15, { animate: true });
      return;
    }
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView([positions[0].lat, positions[0].lon], 13, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(positions.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds.pad(0.2));
  }, [positions, focusCarId, map]);
  return null;
};

const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
};

const LiveMap = ({ cars = [], focusCarId = null }) => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const carsById = useMemo(() => {
    const m = {};
    cars.forEach((c) => { m[c.id] = c; });
    return m;
  }, [cars]);

  const refresh = async () => {
    try {
      const { data } = await trackerAPI.listPositions();
      setPositions(data || []);
    } catch {
      // silent — poller may not have written any positions yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, REFRESH_MS);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, []);

  const enriched = positions.map((p) => {
    const car = carsById[p.car_id] || {};
    const status = p.status === 'offline' ? 'offline' : (p.speed > 0 ? 'moving' : 'idle');
    return { ...p, car, status };
  });

  const stats = {
    total: enriched.length,
    moving: enriched.filter((p) => p.status === 'moving').length,
    idle: enriched.filter((p) => p.status === 'idle').length,
    offline: enriched.filter((p) => p.status === 'offline').length,
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" data-testid="live-map">
      {/* Header + stats */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
            <MapPin size={16} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Live Fleet Map</h3>
            <p className="text-[11px] text-slate-500">Refreshes every 30 s · {loading ? 'loading…' : `${stats.total} tracked`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs" data-testid="live-map-stats">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {stats.moving} moving
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> {stats.idle} idle
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {stats.offline} offline
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="h-[520px] relative" data-testid="live-map-canvas">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={enriched} focusCarId={focusCarId} />
          {enriched.map((p) => (
            <Marker
              key={p.car_id}
              position={[p.lat, p.lon]}
              icon={iconFor(p.status, !!p.car?.tracker_is_demo, p.car_id === focusCarId)}
              data-testid={`live-map-pin-${p.car_id}`}
            >
              <Popup>
                <div className="text-sm min-w-[200px]" data-testid={`live-map-popup-${p.car_id}`}>
                  <p className="font-semibold text-slate-900">{p.car?.name || 'Vehicle'}</p>
                  {p.car?.registration && <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">{p.car.registration}</p>}
                  <ul className="space-y-1 text-xs text-slate-700">
                    <li className="flex items-center gap-1.5"><Navigation size={12} className="text-slate-400" /> Speed: <span className="font-semibold tabular-nums">{p.speed} km/h</span></li>
                    {p.voltage != null && (
                      <li className="flex items-center gap-1.5"><Battery size={12} className="text-slate-400" /> Voltage: <span className="font-semibold tabular-nums">{p.voltage.toFixed(1)} V</span></li>
                    )}
                    <li className="flex items-center gap-1.5"><Clock size={12} className="text-slate-400" /> Updated: <span className="font-semibold">{timeAgo(p.last_update)}</span></li>
                    <li className="flex items-center gap-1.5"><Zap size={12} className="text-slate-400" /> Status: <span className={`font-semibold capitalize ${
                      p.status === 'moving' ? 'text-emerald-600' :
                      p.status === 'idle' ? 'text-blue-600' : 'text-amber-600'
                    }`}>{p.status}</span></li>
                  </ul>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {!loading && enriched.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 pointer-events-none">
            <div className="text-center max-w-sm">
              <p className="text-sm font-semibold text-slate-800">No live positions yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Register a tracker (real IMEI or DEMO-xxxx) and assign it to a car — a pin will appear within 30 s.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveMap;
