import React, { useEffect, useState } from 'react';
import {
  Radio, WifiOff, Gauge, Battery, Satellite, Milestone,
  Power, MapPin, Clock,
} from 'lucide-react';
import { trackerAPI } from '../api/api';

/**
 * FleetTelemetryPanel
 * -------------------
 * Compact live telemetry strip inserted into each FleetBoard card for a
 * TRACKED car. Fed by /api/tracker/telemetry data (parent polls every 30 s
 * so this component just receives its `telemetry` prop).
 *
 * If the parent doesn't have an address cached, we lazily hit
 * /api/tracker/geocode once per card to fill it in.
 */

const STATUS_STYLE = {
  live: { label: 'LIVE', pill: 'bg-emerald-500 text-white', dot: 'bg-emerald-300 animate-pulse' },
  idle: { label: 'IDLE', pill: 'bg-amber-500 text-white', dot: 'bg-amber-200' },
  offline: { label: 'OFFLINE', pill: 'bg-slate-500 text-white', dot: 'bg-slate-300' },
};

const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const FleetTelemetryPanel = ({ telemetry, testIdPrefix }) => {
  const [address, setAddress] = useState(telemetry?.address || null);
  const [fetchingAddr, setFetchingAddr] = useState(false);

  useEffect(() => {
    setAddress(telemetry?.address || null);
  }, [telemetry?.address]);

  useEffect(() => {
    if (address) return;
    const pos = telemetry?.position;
    if (!pos || pos.lat == null || pos.lon == null) return;
    // Lazy reverse-geocode. Nominatim caps free-tier at 1 req/sec —
    // we stagger by a small random delay per card to keep the load low.
    let cancelled = false;
    const t = setTimeout(async () => {
      setFetchingAddr(true);
      try {
        const { data } = await trackerAPI.geocode(pos.lat, pos.lon);
        if (!cancelled) setAddress(data?.address || null);
      } catch { /* silent */ }
      finally { if (!cancelled) setFetchingAddr(false); }
    }, 200 + Math.random() * 1200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [address, telemetry?.position?.lat, telemetry?.position?.lon]);

  if (!telemetry) return null;
  const pos = telemetry.position || {};
  const status = STATUS_STYLE[telemetry.connection_status] || STATUS_STYLE.offline;
  const StatusIcon = telemetry.connection_status === 'offline' ? WifiOff : Radio;

  return (
    <div
      className="mt-3 p-3 border border-slate-200 rounded-lg bg-slate-50"
      data-testid={testIdPrefix || 'fleet-telemetry'}
    >
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold tracking-wider rounded ${status.pill}`}
          data-testid={`${testIdPrefix || 'fleet-telemetry'}-status`}
        >
          <StatusIcon size={10} /> {status.label}
        </span>
        {telemetry.is_demo && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
            DEMO
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500">
          <Clock size={10} /> {timeAgo(telemetry.last_update)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Metric
          icon={<Gauge size={12} />}
          label="Speed"
          value={pos.speed != null ? `${pos.speed} km/h` : '—'}
          emphasis={pos.speed > 0 ? 'text-emerald-700' : 'text-slate-500'}
        />
        <Metric
          icon={<Power size={12} />}
          label="Ignition"
          value={pos.ignition ? 'ON' : 'OFF'}
          emphasis={pos.ignition ? 'text-emerald-700' : 'text-slate-500'}
        />
        <Metric
          icon={<Battery size={12} />}
          label="Voltage"
          value={pos.voltage != null ? `${Number(pos.voltage).toFixed(1)} V` : '—'}
        />
        <Metric
          icon={<Satellite size={12} />}
          label="Satellites"
          value={pos.gps_signal != null ? String(pos.gps_signal) : '—'}
        />
        <Metric
          icon={<Milestone size={12} />}
          label="Today"
          value={telemetry.mileage_today_km != null ? `${telemetry.mileage_today_km} km` : '—'}
        />
        <Metric
          icon={<MapPin size={12} />}
          label="Update"
          value={telemetry.minutes_since_update != null ? `${Math.round(telemetry.minutes_since_update)} min` : '—'}
        />
      </div>

      {(address || fetchingAddr) && (
        <div
          className="mt-2 pt-2 border-t border-slate-200 flex items-start gap-1.5 text-[11px] text-slate-600"
          data-testid={`${testIdPrefix || 'fleet-telemetry'}-address`}
        >
          <MapPin size={11} className="text-slate-400 shrink-0 mt-0.5" />
          <span className="truncate">
            {fetchingAddr && !address ? 'Looking up address…' : address}
          </span>
        </div>
      )}
    </div>
  );
};

const Metric = ({ icon, label, value, emphasis = '' }) => (
  <div>
    <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
      {icon} {label}
    </div>
    <div className={`text-sm font-semibold tabular-nums ${emphasis || 'text-slate-900'}`}>
      {value}
    </div>
  </div>
);

export default FleetTelemetryPanel;
