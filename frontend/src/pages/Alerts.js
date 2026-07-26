import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, Gauge, Plug, WifiOff, MapPin, Check, CheckCheck,
  RefreshCw, Filter, Bell, Info,
} from 'lucide-react';
import { trackerAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Alerts
 * ------
 * Tenant-admin dashboard for reviewing and acknowledging GPS tracker alerts.
 * Alerts are written by the SinoTrack poller (services/gps_poller.py) into
 * `tracker_alerts` and cover four categories:
 *
 *   - speeding      : car exceeded tenant's speed_limit_kmh
 *                     (severity: warning 1-30 over, critical 30+ over)
 *   - unplug        : voltage dropped from >10 V to <5 V (tampering)
 *   - offline       : tracker silent for 10+ min (warning) / 60+ min (critical)
 *   - geofence_exit : car left its configured base radius
 *
 * All queries are tenant-scoped server-side.
 */

const TYPE_META = {
  speeding: {
    label: 'Speeding',
    Icon: Gauge,
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  unplug: {
    label: 'Tracker Unplugged',
    Icon: Plug,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  offline: {
    label: 'Offline',
    Icon: WifiOff,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  geofence_exit: {
    label: 'Geofence Exit',
    Icon: MapPin,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
};

const SEVERITY_STYLE = {
  critical: {
    label: 'CRITICAL',
    pill: 'bg-red-600 text-white',
    ring: 'ring-2 ring-red-500/40',
  },
  warning: {
    label: 'WARNING',
    pill: 'bg-amber-500 text-white',
    ring: 'ring-1 ring-amber-400/40',
  },
  info: {
    label: 'INFO',
    pill: 'bg-slate-500 text-white',
    ring: 'ring-1 ring-slate-300',
  },
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

const Alerts = () => {
  const { isTenantAdmin } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [includeAcked, setIncludeAcked] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const admin = isTenantAdmin();

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await trackerAPI.listAlerts(includeAcked);
      setAlerts(data.alerts || []);
      setCounts(data.counts || { total: 0 });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [includeAcked]);

  useEffect(() => {
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [includeAcked]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return alerts;
    return alerts.filter((a) => a.type === typeFilter);
  }, [alerts, typeFilter]);

  const ackOne = async (a) => {
    if (!admin) return;
    setBusyId(a.id);
    try {
      await trackerAPI.ackAlert(a.id);
      toast.success('Alert acknowledged');
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not acknowledge');
    } finally {
      setBusyId(null);
    }
  };

  const ackBulk = async (type = null) => {
    if (!admin) return;
    const label = type ? TYPE_META[type]?.label || type : 'all';
    if (!window.confirm(`Acknowledge every open ${label.toLowerCase()} alert?`)) return;
    setBusyId(`bulk-${type || 'all'}`);
    try {
      const { data } = await trackerAPI.ackBulk(type);
      toast.success(`Acknowledged ${data.acknowledged} alert${data.acknowledged === 1 ? '' : 's'}`);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not acknowledge');
    } finally {
      setBusyId(null);
    }
  };

  const typeCounts = useMemo(() => {
    const c = { all: alerts.length };
    alerts.forEach((a) => {
      c[a.type] = (c[a.type] || 0) + 1;
    });
    return c;
  }, [alerts]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" data-testid="alerts-page">
      <header className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center">
              <AlertTriangle size={20} className="text-rose-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">GPS Alerts</h1>
              <p className="text-sm text-slate-500">
                Speeding, unplug, offline and geofence events across your fleet
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAcked}
              onChange={(e) => setIncludeAcked(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              data-testid="alerts-toggle-acked"
            />
            Show acknowledged
          </label>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            data-testid="alerts-refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {admin && alerts.length > 0 && (
            <button
              onClick={() => ackBulk(null)}
              disabled={busyId === 'bulk-all'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border border-emerald-300 rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              data-testid="alerts-ack-all"
            >
              <CheckCheck size={14} /> Acknowledge all
            </button>
          )}
        </div>
      </header>

      {/* Severity summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" data-testid="alerts-severity-strip">
        <SeverityStat
          label="Critical"
          count={alerts.filter((a) => a.severity === 'critical').length}
          pill="bg-red-100 text-red-800 border-red-200"
          dot="bg-red-500"
        />
        <SeverityStat
          label="Warning"
          count={alerts.filter((a) => a.severity === 'warning').length}
          pill="bg-amber-100 text-amber-800 border-amber-200"
          dot="bg-amber-500"
        />
        <SeverityStat
          label="Speeding"
          count={typeCounts.speeding || 0}
          pill="bg-rose-100 text-rose-800 border-rose-200"
          dot="bg-rose-500"
        />
        <SeverityStat
          label="Unplug + Offline"
          count={(typeCounts.unplug || 0) + (typeCounts.offline || 0)}
          pill="bg-orange-100 text-orange-800 border-orange-200"
          dot="bg-orange-500"
        />
      </div>

      {/* Type filter pills */}
      <div className="flex items-center gap-2 flex-wrap mb-4" data-testid="alerts-type-filter">
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <Filter size={12} /> Filter:
        </span>
        {[
          { key: 'all', label: `All (${typeCounts.all || 0})` },
          { key: 'speeding', label: `Speeding (${typeCounts.speeding || 0})` },
          { key: 'unplug', label: `Unplug (${typeCounts.unplug || 0})` },
          { key: 'offline', label: `Offline (${typeCounts.offline || 0})` },
          { key: 'geofence_exit', label: `Geofence (${typeCounts.geofence_exit || 0})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
              typeFilter === f.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            data-testid={`alerts-filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
        {admin && typeFilter !== 'all' && typeCounts[typeFilter] > 0 && (
          <button
            onClick={() => ackBulk(typeFilter)}
            disabled={busyId === `bulk-${typeFilter}`}
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border border-emerald-300 rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            data-testid={`alerts-ack-type-${typeFilter}`}
          >
            <CheckCheck size={12} /> Ack {TYPE_META[typeFilter]?.label || typeFilter}
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl" data-testid="alerts-empty">
          {loading ? (
            <p className="text-sm text-slate-500">Loading alerts…</p>
          ) : (
            <div>
              <Bell size={30} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-base font-semibold text-slate-900">
                {includeAcked ? 'No alerts to show' : 'All clear! No open alerts.'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {includeAcked
                  ? 'Nothing recorded yet — the poller writes here as soon as it detects a threshold event.'
                  : 'Toggle "Show acknowledged" to review historical alerts.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-2" data-testid="alerts-list">
          {filtered.map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              onAck={ackOne}
              busy={busyId === a.id}
              canAck={admin && !a.acknowledged}
            />
          ))}
        </ul>
      )}

      {!admin && (
        <div className="mt-5 p-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 text-blue-900 text-xs">
          <Info size={14} className="shrink-0 mt-0.5 text-blue-600" />
          <span>You&apos;re signed in as a staff member. Only tenant admins can acknowledge alerts.</span>
        </div>
      )}
    </div>
  );
};

const SeverityStat = ({ label, count, pill, dot }) => (
  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">{count}</div>
    </div>
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> LIVE
    </span>
  </div>
);

const AlertRow = ({ alert, onAck, busy, canAck }) => {
  const meta = TYPE_META[alert.type] || TYPE_META.speeding;
  const sev = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.info;
  const Icon = meta.Icon;

  return (
    <li
      className={`bg-white border rounded-xl p-4 transition-shadow hover:shadow-sm ${meta.border} ${sev.ring} ${
        alert.acknowledged ? 'opacity-70' : ''
      }`}
      data-testid={`alert-${alert.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-lg ${meta.bg} border ${meta.border} flex items-center justify-center`}>
          <Icon size={18} className={meta.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded ${sev.pill}`}>
              {sev.label}
            </span>
            <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
              {meta.label}
            </span>
            {alert.acknowledged && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                <Check size={10} /> Acknowledged
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-800">{alert.message}</p>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {alert.car_name || 'Vehicle'}{alert.registration ? ` · ${alert.registration}` : ''}
            </span>
            <span>· {timeAgo(alert.timestamp)}</span>
            {alert.lat != null && alert.lon != null && (
              <span className="tabular-nums">
                · {Number(alert.lat).toFixed(4)}, {Number(alert.lon).toFixed(4)}
              </span>
            )}
          </div>
        </div>
        {canAck && (
          <button
            onClick={() => onAck(alert)}
            disabled={busy}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-50 shrink-0"
            data-testid={`alert-ack-${alert.id}`}
          >
            <Check size={12} /> Ack
          </button>
        )}
      </div>
    </li>
  );
};

export default Alerts;
