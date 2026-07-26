import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ShieldAlert, Gauge, TrendingDown, TrendingUp, PlugZap,
  Filter, Calendar, RefreshCw, Users, Car as CarIcon, MapPin,
} from 'lucide-react';
import { behaviourAPI, carAPI, userAPI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Behaviour (Driver Behaviour Monitoring, Phase 6)
 * ------------------------------------------------
 * Chronological event feed of flagged driving events (speeding, harsh
 * braking, harsh acceleration, tracker disconnection) linked to the staff
 * member who had the booking at that time. Explicitly NOT a scoring or
 * grading system — no ranks, no letter grades, no composite score.
 *
 * Filters: event type, car, staff member, date range.
 * Summary strip: totals by type + top staff (most events).
 */

const TYPE_META = {
  speeding: { label: 'Speeding', Icon: Gauge, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  harsh_braking: { label: 'Harsh Braking', Icon: TrendingDown, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  harsh_acceleration: { label: 'Harsh Acceleration', Icon: TrendingUp, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  disconnection: { label: 'Tracker Disconnected', Icon: PlugZap, color: 'text-red-800', bg: 'bg-red-50', border: 'border-red-200' },
};

const toLocalYMD = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fmtTs = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const Behaviour = () => {
  const { isTenantAdmin } = useAuth();
  const [cars, setCars] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({ total: 0, by_type: {}, top_staff: [] });
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState(7);
  const [filters, setFilters] = useState({
    type: 'all',
    car_id: 'all',
    staff_id: 'all',
    from_date: '',
    to_date: '',
  });

  useEffect(() => {
    Promise.allSettled([carAPI.getAll(), userAPI.getAll()])
      .then(([carsRes, usersRes]) => {
        if (carsRes.status === 'fulfilled') setCars(carsRes.value.data || []);
        if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data || []);
      });
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.type !== 'all') params.type = filters.type;
      if (filters.car_id !== 'all') params.car_id = filters.car_id;
      if (filters.staff_id !== 'all') params.staff_id = filters.staff_id;
      if (filters.from_date) params.from_date = `${filters.from_date}T00:00:00+00:00`;
      if (filters.to_date) params.to_date = `${filters.to_date}T23:59:59+00:00`;
      const [ev, sum] = await Promise.all([
        behaviourAPI.listEvents(params),
        behaviourAPI.summary(windowDays),
      ]);
      setEvents(ev.data.events || []);
      setSummary(sum.data || { total: 0, by_type: {}, top_staff: [] });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [filters, windowDays]);

  const typeCount = (t) => summary.by_type?.[t] || 0;

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (filters.type !== 'all') n++;
    if (filters.car_id !== 'all') n++;
    if (filters.staff_id !== 'all') n++;
    if (filters.from_date) n++;
    if (filters.to_date) n++;
    return n;
  }, [filters]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" data-testid="behaviour-page">
      <header className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center">
            <ShieldAlert size={20} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Driver Behaviour</h1>
            <p className="text-sm text-slate-500">
              Chronological feed of flagged driving events — for review, not scoring.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-amber-500"
            data-testid="behaviour-window"
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            data-testid="behaviour-refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5" data-testid="behaviour-summary-strip">
        <SummaryTile label="Total events" value={summary.total || 0} accent="bg-slate-100 text-slate-800 border-slate-200" testid="behaviour-summary-total" />
        <SummaryTile label="Speeding" value={typeCount('speeding')} accent="bg-rose-50 text-rose-800 border-rose-200" Icon={Gauge} testid="behaviour-summary-speeding" />
        <SummaryTile label="Harsh Braking" value={typeCount('harsh_braking')} accent="bg-orange-50 text-orange-800 border-orange-200" Icon={TrendingDown} testid="behaviour-summary-harsh_braking" />
        <SummaryTile label="Harsh Accel" value={typeCount('harsh_acceleration')} accent="bg-amber-50 text-amber-800 border-amber-200" Icon={TrendingUp} testid="behaviour-summary-harsh_acceleration" />
        <SummaryTile label="Disconnections" value={typeCount('disconnection')} accent="bg-red-50 text-red-800 border-red-200" Icon={PlugZap} testid="behaviour-summary-disconnection" />
      </div>

      {/* Top staff */}
      {summary.top_staff?.length > 0 && (
        <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-white" data-testid="behaviour-top-staff">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Most events in this window</h3>
            <span className="text-xs text-slate-400">({windowDays} days)</span>
          </div>
          <ul className="space-y-1">
            {summary.top_staff.map((s) => (
              <li
                key={s.staff_id}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 cursor-pointer text-sm"
                onClick={() => setFilters((f) => ({ ...f, staff_id: s.staff_id }))}
                data-testid={`behaviour-top-staff-${s.staff_id}`}
              >
                <span className="text-slate-800 font-medium">{s.staff_name || 'Unknown'}</span>
                <span className="tabular-nums text-slate-500">{s.count} event{s.count === 1 ? '' : 's'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2 mb-4" data-testid="behaviour-filters">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
          <Filter size={12} /> Filters {activeFiltersCount > 0 && <span className="ml-1 px-1.5 rounded-full bg-amber-100 text-amber-800 text-[10px]">{activeFiltersCount}</span>}
        </span>
        <select
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
          data-testid="behaviour-filter-type"
        >
          <option value="all">All types</option>
          <option value="speeding">Speeding</option>
          <option value="harsh_braking">Harsh braking</option>
          <option value="harsh_acceleration">Harsh acceleration</option>
          <option value="disconnection">Disconnection</option>
        </select>
        <select
          value={filters.car_id}
          onChange={(e) => setFilters((f) => ({ ...f, car_id: e.target.value }))}
          className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white max-w-[180px]"
          data-testid="behaviour-filter-car"
        >
          <option value="all">All cars</option>
          {cars.map((c) => (
            <option key={c.id} value={c.id}>{c.name || c.registration}</option>
          ))}
        </select>
        <select
          value={filters.staff_id}
          onChange={(e) => setFilters((f) => ({ ...f, staff_id: e.target.value }))}
          className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white max-w-[180px]"
          data-testid="behaviour-filter-staff"
        >
          <option value="all">All staff</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name || u.email}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1 text-xs text-slate-500">
          <Calendar size={12} /> From
          <input
            type="date"
            value={filters.from_date}
            max={toLocalYMD(new Date())}
            onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))}
            className="px-2 py-1 border border-slate-300 rounded-md text-xs"
            data-testid="behaviour-filter-from"
          />
        </label>
        <label className="inline-flex items-center gap-1 text-xs text-slate-500">
          To
          <input
            type="date"
            value={filters.to_date}
            max={toLocalYMD(new Date())}
            onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))}
            className="px-2 py-1 border border-slate-300 rounded-md text-xs"
            data-testid="behaviour-filter-to"
          />
        </label>
        {activeFiltersCount > 0 && (
          <button
            onClick={() => setFilters({ type: 'all', car_id: 'all', staff_id: 'all', from_date: '', to_date: '' })}
            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline"
            data-testid="behaviour-clear-filters"
          >
            Clear
          </button>
        )}
      </div>

      {/* Feed */}
      {events.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl" data-testid="behaviour-empty">
          {loading ? (
            <p className="text-sm text-slate-500">Loading events…</p>
          ) : (
            <div>
              <ShieldAlert size={28} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-semibold text-slate-900">
                No flagged events for the current filters.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Adjust filters or widen the window — the poller writes events every 30 s as it sees them.
              </p>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-2" data-testid="behaviour-list">
          {events.map((e) => (
            <EventRow key={e.id} ev={e} />
          ))}
        </ul>
      )}

      {!isTenantAdmin() && (
        <div className="mt-5 p-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 text-blue-900 text-xs">
          <ShieldAlert size={14} className="shrink-0 mt-0.5 text-blue-600" />
          <span>Read-only view. Staff can see their own events but only admins can act on them.</span>
        </div>
      )}
    </div>
  );
};

const SummaryTile = ({ label, value, accent, Icon, testid }) => (
  <div className={`p-3 rounded-xl border ${accent}`} data-testid={testid}>
    <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
      {Icon && <Icon size={11} />} {label}
    </div>
    <div className="text-2xl font-bold tabular-nums mt-0.5">{value}</div>
  </div>
);

const EventRow = ({ ev }) => {
  const meta = TYPE_META[ev.type] || TYPE_META.speeding;
  const Icon = meta.Icon;
  return (
    <li
      className={`bg-white border rounded-xl p-4 transition-shadow hover:shadow-sm ${meta.border}`}
      data-testid={`behaviour-event-${ev.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-lg ${meta.bg} border ${meta.border} flex items-center justify-center`}>
          <Icon size={18} className={meta.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
            <span className="text-[11px] text-slate-500 tabular-nums">· {fmtTs(ev.timestamp)}</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-800">{ev.details}</p>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
              <CarIcon size={11} /> {ev.car_name || 'Vehicle'}{ev.registration ? ` · ${ev.registration}` : ''}
            </span>
            <span className={`inline-flex items-center gap-1 ${ev.staff_name === 'Unbooked' ? 'italic text-slate-400' : 'font-semibold text-slate-700'}`}>
              <Users size={11} /> {ev.staff_name || 'Unbooked'}
            </span>
            {ev.lat != null && ev.lon != null && (
              <span className="tabular-nums">
                <MapPin size={11} className="inline mr-0.5" />
                {Number(ev.lat).toFixed(4)}, {Number(ev.lon).toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
};

export default Behaviour;
