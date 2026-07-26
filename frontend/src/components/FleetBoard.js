import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, MapPin,
  Clock, Zap, Navigation, Check, Ban, Radio, Route,
} from 'lucide-react';
import { carAPI } from '../api/api';

/**
 * FleetBoard
 * ----------
 * Live board of every vehicle for a given day. Each card shows:
 *  - Status pill (Available / In Use / Blocked) with a colour-coded left bar
 *  - Human availability summary ("Available now", "Available until 20:50")
 *  - Current drop-off location (Eircode + optional label)
 *  - "X.Yh free today (N bookings)" line
 *  - Horizontal 07:00 → 22:00 timeline with clickable blue booking pills
 *  - Quick Book (opens new-booking form pre-filled) + Drop-off (Eircode entry)
 *
 * Clicking a blue pill opens the full booking preview modal via the
 * `onOpenBooking(booking)` prop — so admins can view, edit or cancel the
 * booking without leaving the Fleet Board.
 */

const DAY_START_H = 7;
const DAY_END_H = 22;
const DAY_START_MIN = DAY_START_H * 60;
const DAY_END_MIN = DAY_END_H * 60;
const DAY_WINDOW_MIN = DAY_END_MIN - DAY_START_MIN; // 900

// ---------- helpers ----------
const toLocalYMD = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toLocalDate = (isoOrLocal) => {
  // Booking times are stored as YYYY-MM-DDTHH:mm (local, no TZ) — new Date()
  // handles both this and full ISO strings.
  return new Date(isoOrLocal);
};

const formatHM = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const clampMinutes = (m) => Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, m));

const isSameYMD = (a, b) => toLocalYMD(a) === toLocalYMD(b);

const addDays = (d, n) => {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
};

/**
 * For a given car + date, compute:
 *  - the bookings that touch that date (clipped to 07:00-22:00 for pills)
 *  - the total free hours in the 07:00-22:00 window
 *  - a human availability summary line for the card header
 *  - whether the car is "in use right now" (only relevant if the date is today)
 */
const summariseCarDay = (car, allBookings, date, now) => {
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  const dayBookings = allBookings
    .filter((b) => b.car_id === car.id && !['rejected', 'cancelled'].includes(b.status))
    .map((b) => ({ ...b, _s: toLocalDate(b.start_time), _e: toLocalDate(b.end_time) }))
    .filter((b) => b._s <= dayEnd && b._e >= dayStart)
    .sort((a, b) => a._s - b._s);

  // Build pills in the 07:00-22:00 window
  const pills = dayBookings.map((b) => {
    const sMin = (b._s.getHours() * 60) + b._s.getMinutes();
    const eMin = (b._e.getHours() * 60) + b._e.getMinutes();
    // Extend to full day for bookings that span midnight either side
    const startInWindow = clampMinutes(b._s < dayStart ? DAY_START_MIN : sMin);
    const endInWindow = clampMinutes(b._e > dayEnd ? DAY_END_MIN : eMin);
    return {
      booking: b,
      leftPct: ((startInWindow - DAY_START_MIN) / DAY_WINDOW_MIN) * 100,
      widthPct: Math.max(1.5, ((endInWindow - startInWindow) / DAY_WINDOW_MIN) * 100),
      startHM: formatHM(b._s),
      endHM: formatHM(b._e),
    };
  });

  // Free hours = window minus union of overlapping segments within window
  const segs = pills
    .map((p) => [p.leftPct, p.leftPct + p.widthPct])
    .sort((a, b) => a[0] - b[0]);
  let coveredPct = 0;
  let cursor = 0;
  segs.forEach(([s, e]) => {
    const start = Math.max(s, cursor);
    if (e > start) {
      coveredPct += (e - start);
      cursor = Math.max(cursor, e);
    }
  });
  const freeHours = ((100 - coveredPct) / 100) * (DAY_WINDOW_MIN / 60);

  // Availability summary
  const isToday = isSameYMD(date, now);
  const activeNow = isToday && dayBookings.some((b) => b._s <= now && b._e > now);
  let summary;
  if (car.is_blocked) {
    summary = car.blocked_reason ? `Blocked · ${car.blocked_reason}` : 'Blocked';
  } else if (activeNow) {
    const active = dayBookings.find((b) => b._s <= now && b._e > now);
    summary = `In use until ${formatHM(active._e)}`;
  } else if (dayBookings.length === 0) {
    summary = 'Available all day';
  } else if (isToday) {
    const upcoming = dayBookings.find((b) => b._s > now);
    summary = upcoming ? `Available now — next booking ${formatHM(upcoming._s)}` : 'Available now';
  } else {
    // Non-today: describe first booking of the day
    summary = `First booking ${pills[0].startHM}`;
  }

  const status = car.is_blocked ? 'blocked' : (activeNow ? 'in-use' : 'available');

  return { pills, freeHours, bookingCount: dayBookings.length, summary, status };
};

// ---------- sub components ----------
const StatusBadge = ({ status }) => {
  const cfg = {
    available: { label: 'Available', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'in-use':  { label: 'In Use',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    blocked:   { label: 'Blocked',  cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        status === 'available' ? 'bg-emerald-500' : status === 'in-use' ? 'bg-amber-500' : 'bg-rose-500'
      }`} />
      {cfg.label}
    </span>
  );
};

const Timeline = ({ pills, onPillClick, isToday, now }) => {
  const nowPct = isToday
    ? Math.max(0, Math.min(100, (((now.getHours() * 60 + now.getMinutes()) - DAY_START_MIN) / DAY_WINDOW_MIN) * 100))
    : null;

  return (
    <div className="mt-4">
      {/* Hour labels */}
      <div className="grid grid-cols-6 text-[11px] text-slate-400 font-medium mb-1.5">
        {['7:00', '10:00', '13:00', '16:00', '19:00', '22:00'].map((h) => (
          <span key={h} className={h === '22:00' ? 'text-right' : ''}>{h}</span>
        ))}
      </div>

      {/* Track */}
      <div className="relative h-3 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 right-0 w-[3%] rounded-r-full bg-emerald-100/70" />

        {pills.map((p) => (
          <button
            key={p.booking.id}
            type="button"
            onClick={() => onPillClick(p.booking)}
            data-testid={`fleet-timeline-pill-${p.booking.id}`}
            title={`${p.startHM} – ${p.endHM} · ${p.booking.user_name || 'Booking'} · Click to open`}
            aria-label={`Open booking ${p.startHM} to ${p.endHM}${p.booking.user_name ? ' for ' + p.booking.user_name : ''}`}
            className="absolute top-1/2 -translate-y-1/2 h-3 rounded-full bg-blue-500 hover:bg-blue-600 hover:h-4 hover:-translate-y-2 transition-all cursor-pointer"
            style={{ left: `${p.leftPct}%`, width: `${p.widthPct}%` }}
          />
        ))}

        {nowPct !== null && (
          <div
            className="absolute -top-1 -bottom-1 w-[2px] bg-rose-500 rounded-full pointer-events-none"
            style={{ left: `${nowPct}%` }}
            aria-hidden="true"
          >
            <span className="absolute -top-1.5 -left-[3px] h-2 w-2 rounded-full bg-rose-500" />
          </div>
        )}
      </div>
    </div>
  );
};

const DropOffInline = ({ car, onSaved, onCancel }) => {
  const [eircode, setEircode] = useState(car.current_location_eircode || '');
  const [label, setLabel] = useState(car.current_location_label || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await carAPI.setDropOff(car.id, { eircode, label });
      onSaved({ eircode: eircode.trim().toUpperCase(), label: label.trim() });
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not save location');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await carAPI.setDropOff(car.id, { eircode: '', label: '' });
      onSaved({ eircode: '', label: '' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-slate-200 bg-slate-50" data-testid={`drop-off-form-${car.id}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">
        Drop-off location
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={eircode}
          onChange={(e) => setEircode(e.target.value)}
          placeholder="Eircode (e.g. V92 H6TP)"
          className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          data-testid={`drop-off-eircode-${car.id}`}
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Or a place name"
          className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          data-testid={`drop-off-label-${car.id}`}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || (!eircode.trim() && !label.trim())}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`drop-off-save-${car.id}`}
        >
          <Check size={13} /> Save
        </button>
        {(car.current_location_eircode || car.current_location_label) && (
          <button
            type="button"
            onClick={clear}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
            data-testid={`drop-off-clear-${car.id}`}
          >
            <Ban size={13} /> Clear
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto text-xs text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const FleetCard = ({ car, allBookings, date, now, onQuickBook, onOpenBooking, onDropOffSaved, onGoToLive, onOpenJourney, isTracked }) => {
  const { pills, freeHours, bookingCount, summary, status } = useMemo(
    () => summariseCarDay(car, allBookings, date, now),
    [car, allBookings, date, now]
  );

  const [dropOffOpen, setDropOffOpen] = useState(false);

  const borderCls = {
    available: 'border-l-emerald-500',
    'in-use':  'border-l-amber-500',
    blocked:   'border-l-rose-500',
  }[status];

  const displayLocation = car.current_location_eircode || car.current_location_label;

  return (
    <div
      className={`bg-white border border-slate-200 border-l-4 ${borderCls} rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow`}
      data-testid={`fleet-card-${car.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 truncate">{car.name}</h3>
          <p className="text-xs text-slate-500 uppercase tracking-wide mt-0.5">{car.registration}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="mt-2 text-sm text-slate-700">{summary}</p>

      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
        <MapPin size={13} className="text-slate-400" />
        {displayLocation ? (
          <>
            <span className="font-medium text-slate-700">
              {car.current_location_eircode || ''}
              {car.current_location_eircode && car.current_location_label ? ' · ' : ''}
              {car.current_location_label || ''}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
              Drop-off
            </span>
          </>
        ) : (
          <span className="italic text-slate-400">Location unknown</span>
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
        <Clock size={12} />
        <span className="font-medium text-slate-700 tabular-nums">
          {freeHours.toFixed(1)}h free today
        </span>
        <span className="text-slate-400">
          ({bookingCount} {bookingCount === 1 ? 'booking' : 'bookings'})
        </span>
      </div>

      <Timeline
        pills={pills}
        onPillClick={onOpenBooking}
        isToday={isSameYMD(date, now)}
        now={now}
      />

      {dropOffOpen ? (
        <DropOffInline
          car={car}
          onSaved={(loc) => {
            setDropOffOpen(false);
            onDropOffSaved(car.id, loc);
          }}
          onCancel={() => setDropOffOpen(false)}
        />
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onQuickBook(car)}
            disabled={car.is_blocked}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid={`fleet-quick-book-${car.id}`}
          >
            <Zap size={14} /> Quick Book
          </button>
          {onGoToLive && (
            <button
              type="button"
              onClick={() => onGoToLive(car)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
              title="Show this car on the Live Map"
              data-testid={`fleet-live-${car.id}`}
            >
              <Radio size={14} /> Live
            </button>
          )}
          {onOpenJourney && isTracked && (
            <button
              type="button"
              onClick={() => onOpenJourney(car)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
              title="Replay this car's journeys"
              data-testid={`fleet-journey-${car.id}`}
            >
              <Route size={14} /> Journey
            </button>
          )}
          <button
            type="button"
            onClick={() => setDropOffOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            data-testid={`fleet-drop-off-${car.id}`}
          >
            <Navigation size={14} /> Drop-off
          </button>
        </div>
      )}
    </div>
  );
};

// ---------- main component ----------
const FleetBoard = ({ cars = [], bookings = [], onQuickBook, onOpenBooking, onCarsChanged, onGoToLive, onOpenJourney, trackedCarIds = null }) => {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Local shadow so drop-off updates reflect immediately without waiting for
  // a full car re-fetch from the parent.
  const [localOverrides, setLocalOverrides] = useState({});
  const mergedCars = useMemo(
    () => cars.map((c) => (localOverrides[c.id] ? { ...c, ...localOverrides[c.id] } : c)),
    [cars, localOverrides]
  );

  const now = new Date();
  const isToday = isSameYMD(date, now);

  const handleDropOffSaved = (carId, loc) => {
    setLocalOverrides((prev) => ({
      ...prev,
      [carId]: {
        current_location_eircode: loc.eircode || null,
        current_location_label: loc.label || null,
      },
    }));
    if (onCarsChanged) onCarsChanged();
  };

  // Counters (based on the currently selected date's activity)
  const counters = useMemo(() => {
    let available = 0, inUse = 0, blocked = 0;
    mergedCars.forEach((c) => {
      const { status } = summariseCarDay(c, bookings, date, now);
      if (status === 'available') available += 1;
      else if (status === 'in-use') inUse += 1;
      else blocked += 1;
    });
    return { available, inUse, blocked };
  }, [mergedCars, bookings, date, now]);

  const dateLabel = isToday
    ? 'Today'
    : date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div data-testid="fleet-board">
      {/* Header: date nav + counters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, -1))}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Previous day"
            data-testid="fleet-date-prev"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setDate(d);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              isToday
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            data-testid="fleet-date-today"
          >
            <CalendarIcon size={14} /> {dateLabel}
          </button>
          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, 1))}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Next day"
            data-testid="fleet-date-next"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap" data-testid="fleet-counters">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {counters.available} Available
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {counters.inUse} In Use
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-rose-50 text-rose-700 border-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {counters.blocked} Blocked
          </span>
          <span className="text-xs text-slate-500 ml-1">{cars.length} cars</span>
        </div>
      </div>

      {/* Cards grid */}
      {mergedCars.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center text-slate-500">
          No vehicles yet. Add cars in Fleet Management to see them here.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mergedCars.map((car) => (
            <FleetCard
              key={car.id}
              car={car}
              allBookings={bookings}
              date={date}
              now={now}
              onQuickBook={onQuickBook}
              onOpenBooking={onOpenBooking}
              onDropOffSaved={handleDropOffSaved}
              onGoToLive={onGoToLive}
              onOpenJourney={onOpenJourney}
              isTracked={trackedCarIds ? trackedCarIds.has(car.id) : false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FleetBoard;
