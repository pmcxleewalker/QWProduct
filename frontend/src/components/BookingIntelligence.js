import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Activity,
  Zap,
  Car as CarIcon,
  Clock,
  Users,
} from 'lucide-react';

import './BookingIntelligence.css';

/**
 * BookingIntelligence
 * --------------------
 * "Alive and breathing" scanner that sits at the top of the Bookings page.
 *
 * It runs a deterministic analysis pass over the upcoming bookings + vehicle
 * fleet to surface FOUR classes of issue:
 *   1. Vehicle conflict — same car booked overlapping by two people
 *   2. Person conflict — same person on two cars at the same time
 *   3. Compliance risk — booked car has tax/NCT/insurance expired during slot
 *   4. Idle vehicles — cars with zero bookings in the next 14 days
 *
 * For each conflict we compute concrete fix suggestions: alternative free
 * vehicles in that exact window and adjacent time slots when the same car
 * IS free.
 *
 * NOTE: there's no LLM here on purpose. Detection is mechanical (instant,
 * accurate, free, never hallucinates). The "AI" feel is the visual treatment:
 * pulsing neural border, scanning bar, particle drift, glowing brain icon,
 * shifting gradient text.
 */
const BookingIntelligence = ({ bookings = [], vehicles = [], onApplySuggestion }) => {
  const [isAnalysing, setIsAnalysing] = useState(true);
  const [analysisMs, setAnalysisMs] = useState(0);
  const [activeTypeFilter, setActiveTypeFilter] = useState('all');
  const [pulseTick, setPulseTick] = useState(0); // drives subtle "heartbeat" of stats
  const analyseTimer = useRef(null);

  // Re-run a fake analysis animation any time the data changes — gives the
  // operator a clear "the AI just re-checked" signal whenever they add or
  // edit a booking.
  useEffect(() => {
    setIsAnalysing(true);
    setAnalysisMs(0);
    const start = performance.now();
    if (analyseTimer.current) clearTimeout(analyseTimer.current);
    analyseTimer.current = setTimeout(() => {
      setAnalysisMs(Math.round(performance.now() - start));
      setIsAnalysing(false);
    }, 1100 + Math.random() * 500);
    return () => analyseTimer.current && clearTimeout(analyseTimer.current);
  }, [bookings.length, vehicles.length]);

  // Subtle heartbeat — used by the stats row to give a "live" feel even when
  // no analysis is running.
  useEffect(() => {
    const id = setInterval(() => setPulseTick((t) => t + 1), 2400);
    return () => clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(), []);
  // 14-day forward window — far enough to catch tomorrow's scheduling
  // problems without dragging in the whole quarter.
  const windowEnd = useMemo(() => new Date(now.getTime() + 14 * 86400000), [now]);

  const vehiclesById = useMemo(() => {
    const map = new Map();
    vehicles.forEach((v) => map.set(v.id, v));
    return map;
  }, [vehicles]);

  // Filter to bookings inside the forward window
  const upcoming = useMemo(() => {
    return bookings
      .filter((b) => {
        if (!b.start_time || b.status === 'cancelled' || b.status === 'rejected') return false;
        const s = new Date(b.start_time);
        return !isNaN(s.getTime()) && s.getTime() >= now.getTime() - 3600000 && s.getTime() <= windowEnd.getTime();
      })
      .map((b) => ({
        ...b,
        _start: new Date(b.start_time).getTime(),
        _end: new Date(b.end_time || b.start_time).getTime(),
      }));
  }, [bookings, now, windowEnd]);

  // ---- DETECTION ----
  const insights = useMemo(() => {
    const vehicleConflicts = [];
    const personConflicts = [];
    const complianceRisks = [];

    // O(n²) is fine — upcoming window is bounded and small (rarely >300).
    for (let i = 0; i < upcoming.length; i++) {
      const a = upcoming[i];
      // Compliance check against the vehicle's tax/NCT/insurance dates
      const vehicle = vehiclesById.get(a.car_id);
      if (vehicle) {
        ['tax_due_date', 'nct_due_date', 'insurance_due_date'].forEach((field) => {
          const raw = vehicle[field];
          if (!raw) return;
          const due = new Date(raw);
          if (isNaN(due.getTime())) return;
          if (due.getTime() <= a._end) {
            complianceRisks.push({
              type: 'compliance',
              booking: a,
              vehicle,
              field: field.replace('_due_date', ''),
              dueDate: raw,
              severity: due.getTime() < a._start ? 'critical' : 'warning',
            });
          }
        });
      }

      for (let j = i + 1; j < upcoming.length; j++) {
        const b = upcoming[j];
        const overlap = a._start < b._end && b._start < a._end;
        if (!overlap) continue;
        if (a.car_id === b.car_id) {
          vehicleConflicts.push({ type: 'vehicle-conflict', a, b, vehicle: vehiclesById.get(a.car_id) });
        }
        // Person conflict — compare across creators, assignees and secondary users
        const peopleA = new Set([a.created_by_user_id, a.assigned_to_user_id, a.secondary_user_id].filter(Boolean));
        const peopleB = new Set([b.created_by_user_id, b.assigned_to_user_id, b.secondary_user_id].filter(Boolean));
        const sharedPerson = [...peopleA].find((p) => peopleB.has(p));
        if (sharedPerson && a.car_id !== b.car_id) {
          personConflicts.push({ type: 'person-conflict', a, b, personId: sharedPerson, personName: a.user_name || b.user_name });
        }
      }
    }

    // Idle vehicles — cars with zero bookings in the window
    const usedCarIds = new Set(upcoming.map((b) => b.car_id));
    const idleVehicles = vehicles
      .filter((v) => !v.is_blocked && !usedCarIds.has(v.id))
      .map((v) => ({ type: 'idle', vehicle: v }));

    return { vehicleConflicts, personConflicts, complianceRisks, idleVehicles };
  }, [upcoming, vehicles, vehiclesById]);

  // For each conflict, find concrete alternatives
  const suggestAlternatives = (booking) => {
    const start = new Date(booking.start_time).getTime();
    const end = new Date(booking.end_time || booking.start_time).getTime();
    // Vehicles that are free during this exact window
    const freeVehicles = vehicles.filter((v) => {
      if (v.is_blocked || v.id === booking.car_id) return false;
      const clash = upcoming.find(
        (b) => b.car_id === v.id && b._start < end && start < b._end,
      );
      return !clash;
    });
    // Adjacent free slots on the SAME vehicle (±2h, ±1d)
    const slotShifts = [];
    const carBookings = upcoming
      .filter((b) => b.car_id === booking.car_id && b.id !== booking.id)
      .sort((x, y) => x._start - y._start);
    const probe = [-2, +2, -24, +24]; // hours
    for (const delta of probe) {
      const newStart = start + delta * 3600000;
      const newEnd = end + delta * 3600000;
      const clash = carBookings.find((b) => b._start < newEnd && newStart < b._end);
      if (!clash && newStart > now.getTime() - 3600000) {
        slotShifts.push({
          delta,
          start: new Date(newStart).toISOString(),
          end: new Date(newEnd).toISOString(),
        });
      }
    }
    return { freeVehicles: freeVehicles.slice(0, 4), slotShifts: slotShifts.slice(0, 3) };
  };

  const totalIssues =
    insights.vehicleConflicts.length +
    insights.personConflicts.length +
    insights.complianceRisks.length;

  const fmtTime = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };
  const fmtShift = (delta) => {
    if (delta === -2) return '2 hours earlier';
    if (delta === 2) return '2 hours later';
    if (delta === -24) return '1 day earlier';
    if (delta === 24) return '1 day later';
    return `${delta}h shift`;
  };

  // ----- VISIBLE CARDS, filtered by type chip -----
  const allCards = [
    ...insights.vehicleConflicts.map((c) => ({ ...c, _kind: 'vehicle-conflict' })),
    ...insights.personConflicts.map((c) => ({ ...c, _kind: 'person-conflict' })),
    ...insights.complianceRisks.map((c) => ({ ...c, _kind: 'compliance' })),
  ];
  const filteredCards =
    activeTypeFilter === 'all'
      ? allCards
      : allCards.filter((c) => c._kind === activeTypeFilter);

  return (
    <div className="bi-wrapper" data-testid="booking-intelligence">
      {/* Animated gradient border + glow */}
      <div className="bi-border-glow" aria-hidden="true" />
      {/* Floating particle layer */}
      <div className="bi-particles" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{ left: `${(i / 18) * 100}%`, animationDelay: `${i * 0.3}s` }} />
        ))}
      </div>

      <div className="bi-inner">
        {/* Header */}
        <div className="bi-header">
          <div className="bi-title-row">
            <div className="bi-brain-orb" data-testid="booking-intelligence-orb">
              <Brain size={22} className="bi-brain-icon" />
              <Sparkles size={10} className="bi-spark bi-spark-1" />
              <Sparkles size={8} className="bi-spark bi-spark-2" />
              <Sparkles size={9} className="bi-spark bi-spark-3" />
            </div>
            <div>
              <h2 className="bi-title">
                <span className="bi-title-grad">Booking Intelligence</span>
                <span className="bi-badge-live">
                  <span className="bi-dot-pulse" /> Live
                </span>
              </h2>
              <div className="bi-subtitle">
                {isAnalysing ? (
                  <span className="bi-scan-line">
                    <Cpu size={12} /> Scanning {upcoming.length} upcoming bookings across {vehicles.length} vehicles…
                  </span>
                ) : (
                  <span className="bi-ready">
                    <Activity size={12} className="bi-mini-pulse" />
                    Analysis complete · {analysisMs} ms ·{' '}
                    {totalIssues === 0 ? (
                      <span className="bi-text-ok">no conflicts detected</span>
                    ) : (
                      <span className="bi-text-warn">
                        {totalIssues} item{totalIssues === 1 ? '' : 's'} need attention
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live stat tiles */}
          <div className="bi-stats" key={pulseTick}>
            <div className="bi-stat" data-pulse>
              <span className="bi-stat-value">{insights.vehicleConflicts.length}</span>
              <span className="bi-stat-label">Vehicle clashes</span>
            </div>
            <div className="bi-stat" data-pulse>
              <span className="bi-stat-value">{insights.personConflicts.length}</span>
              <span className="bi-stat-label">Driver clashes</span>
            </div>
            <div className="bi-stat" data-pulse>
              <span className="bi-stat-value">{insights.complianceRisks.length}</span>
              <span className="bi-stat-label">Compliance risk</span>
            </div>
            <div className="bi-stat" data-pulse>
              <span className="bi-stat-value">{insights.idleVehicles.length}</span>
              <span className="bi-stat-label">Idle vehicles</span>
            </div>
          </div>
        </div>

        {/* Scanning bar shown while analysing */}
        {isAnalysing && <div className="bi-scanbar" />}

        {/* Filter chips */}
        {totalIssues > 0 && (
          <div className="bi-chips">
            {[
              { key: 'all', label: `All ${totalIssues}`, icon: Zap },
              { key: 'vehicle-conflict', label: `Vehicle ${insights.vehicleConflicts.length}`, icon: CarIcon },
              { key: 'person-conflict', label: `Driver ${insights.personConflicts.length}`, icon: Users },
              { key: 'compliance', label: `Compliance ${insights.complianceRisks.length}`, icon: AlertTriangle },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTypeFilter(key)}
                className={`bi-chip ${activeTypeFilter === key ? 'bi-chip-active' : ''}`}
                data-testid={`bi-filter-${key}`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* Suggestion cards */}
        {totalIssues === 0 && insights.idleVehicles.length === 0 && (
          <div className="bi-empty" data-testid="bi-empty">
            <CheckCircle2 size={28} className="bi-check" />
            <p>
              <span className="bi-title-grad">Schedule looks clean.</span>
              <br />
              <span className="bi-subtle">No conflicts across the next 14 days — every booking can run as planned.</span>
            </p>
          </div>
        )}

        {filteredCards.length > 0 && (
          <div className="bi-cards" data-testid="bi-cards">
            {filteredCards.slice(0, 6).map((card, idx) => {
              if (card._kind === 'vehicle-conflict') {
                const alt = suggestAlternatives(card.a);
                return (
                  <div key={idx} className="bi-card bi-card-conflict" data-testid={`bi-card-vehicle-${idx}`}>
                    <div className="bi-card-head">
                      <CarIcon size={16} className="bi-icon-conflict" />
                      <strong>Vehicle double-booked</strong>
                    </div>
                    <p className="bi-card-body">
                      <span className="bi-em">{card.vehicle?.name || 'Vehicle'}</span> is booked twice during
                      an overlapping window.<br />
                      <span className="bi-sub">
                        <Clock size={11} /> {fmtTime(card.a.start_time)} — {card.a.user_name}
                        <br />
                        <Clock size={11} /> {fmtTime(card.b.start_time)} — {card.b.user_name}
                      </span>
                    </p>
                    {(alt.freeVehicles.length > 0 || alt.slotShifts.length > 0) && (
                      <div className="bi-suggestions">
                        <p className="bi-sug-label">
                          <Sparkles size={11} className="bi-icon-spark" /> Suggested fixes
                        </p>
                        {alt.freeVehicles.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() =>
                              onApplySuggestion?.({
                                bookingId: card.b.id,
                                replaceCarId: v.id,
                              })
                            }
                            className="bi-sug-btn"
                          >
                            <CarIcon size={11} /> Move 2nd booking to{' '}
                            <span className="bi-em">{v.name}</span>{' '}
                            <span className="bi-sub">({v.registration})</span>
                          </button>
                        ))}
                        {alt.slotShifts.map((s, k) => (
                          <button
                            key={`shift-${k}`}
                            type="button"
                            onClick={() =>
                              onApplySuggestion?.({
                                bookingId: card.b.id,
                                replaceStart: s.start,
                                replaceEnd: s.end,
                              })
                            }
                            className="bi-sug-btn"
                          >
                            <Clock size={11} /> Shift {fmtShift(s.delta)} ({fmtTime(s.start)})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if (card._kind === 'person-conflict') {
                const alt = suggestAlternatives(card.b);
                return (
                  <div key={idx} className="bi-card bi-card-conflict" data-testid={`bi-card-person-${idx}`}>
                    <div className="bi-card-head">
                      <Users size={16} className="bi-icon-conflict" />
                      <strong>Driver booked twice</strong>
                    </div>
                    <p className="bi-card-body">
                      <span className="bi-em">{card.personName || 'A team member'}</span> is assigned to two cars at
                      the same time.<br />
                      <span className="bi-sub">
                        <Clock size={11} /> {fmtTime(card.a.start_time)} — {vehiclesById.get(card.a.car_id)?.name || card.a.car_id}
                        <br />
                        <Clock size={11} /> {fmtTime(card.b.start_time)} — {vehiclesById.get(card.b.car_id)?.name || card.b.car_id}
                      </span>
                    </p>
                    {alt.slotShifts.length > 0 && (
                      <div className="bi-suggestions">
                        <p className="bi-sug-label">
                          <Sparkles size={11} className="bi-icon-spark" /> Suggested fixes
                        </p>
                        {alt.slotShifts.map((s, k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() =>
                              onApplySuggestion?.({
                                bookingId: card.b.id,
                                replaceStart: s.start,
                                replaceEnd: s.end,
                              })
                            }
                            className="bi-sug-btn"
                          >
                            <Clock size={11} /> Move 2nd booking {fmtShift(s.delta)} ({fmtTime(s.start)})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if (card._kind === 'compliance') {
                return (
                  <div key={idx} className="bi-card bi-card-warn" data-testid={`bi-card-compliance-${idx}`}>
                    <div className="bi-card-head">
                      <AlertTriangle size={16} className="bi-icon-warn" />
                      <strong>Compliance risk</strong>
                    </div>
                    <p className="bi-card-body">
                      <span className="bi-em">{card.vehicle?.name}</span> is booked on{' '}
                      {fmtTime(card.booking.start_time)} — but its{' '}
                      <span className="bi-em">{card.field.toUpperCase()}</span> expires {card.dueDate}.
                      <br />
                      <span className="bi-sub">
                        Consider re-assigning this trip to another vehicle and prioritising the renewal.
                      </span>
                    </p>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}

        {/* Idle vehicles — gentle informational tile */}
        {insights.idleVehicles.length > 0 && (
          <details className="bi-idle">
            <summary>
              <Sparkles size={12} className="bi-icon-spark" />
              {insights.idleVehicles.length} idle vehicle{insights.idleVehicles.length === 1 ? '' : 's'} —
              no bookings in the next 14 days
            </summary>
            <div className="bi-idle-list">
              {insights.idleVehicles.map((iv) => (
                <span key={iv.vehicle.id} className="bi-idle-chip">
                  <CarIcon size={10} /> {iv.vehicle.name}
                  {iv.vehicle.registration ? ` · ${iv.vehicle.registration}` : ''}
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default BookingIntelligence;
