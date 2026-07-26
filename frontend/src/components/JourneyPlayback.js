import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  X, Play, Pause, SkipBack, SkipForward, Route, Clock, Gauge,
  Battery, MapPin, RefreshCw, Sparkles, Navigation,
} from 'lucide-react';
import { trackerAPI } from '../api/api';

/**
 * JourneyPlayback
 * ---------------
 * Modal-style animated route playback for a single car + date. Loads
 * `/api/tracker/history/{car_id}?date=YYYY-MM-DD`, groups points into
 * trips (backend), then animates the car icon along the recorded polyline.
 *
 * Controls: play/pause, skip back/forward, timeline scrubber, 1x/2x/4x/8x
 * speed. Below the map is a clickable trip list. Clicking a trip jumps the
 * scrubber to that trip's start and auto-plays it.
 *
 * All queries are tenant-scoped server-side. This component itself is a
 * pure UI over the returned data.
 */

// ---------- helpers ----------
const toLocalYMD = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const fmtDuration = (mins) => {
  if (!mins && mins !== 0) return '—';
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h ${r}m`;
};

// ---------- car icon (rotates with direction) ----------
const carDivIcon = (direction = 0, isPlaying = true) => L.divIcon({
  className: 'journey-car-marker',
  html: `<div style="
    width:34px;height:34px;
    display:flex;align-items:center;justify-content:center;
    background:${isPlaying ? '#2563eb' : '#334155'};
    border:3px solid white;
    border-radius:50%;
    box-shadow:0 3px 10px rgba(0,0,0,0.4);
    transform: rotate(${direction}deg);
    transition: transform 0.6s linear, background 0.2s ease;
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="white" stroke-width="2.5" stroke-linecap="round"
         stroke-linejoin="round" style="transform: rotate(-45deg)">
      <path d="M12 2L4 22l8-6 8 6z"/>
    </svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const dotIcon = (color) => L.divIcon({
  className: 'journey-endpoint',
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:${color};
    border:3px solid white;
    box-shadow:0 2px 6px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Fit the map to the current trip on trip change
const FitToTrip = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !points || points.length < 2) return;
    let cancelled = false;
    map.whenReady(() => {
      if (cancelled) return;
      try {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
        map.fitBounds(bounds.pad(0.25), { animate: false });
      } catch { /* map torn down mid-tick */ }
    });
    return () => { cancelled = true; };
  }, [map, points]);
  return null;
};

// ---------- main component ----------
const JourneyPlayback = ({ car, onClose }) => {
  const today = useMemo(() => new Date(), []);
  const [date, setDate] = useState(toLocalYMD(today));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trips, setTrips] = useState([]);
  const [activeTripIx, setActiveTripIx] = useState(0);
  const [pointIx, setPointIx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [seeding, setSeeding] = useState(false);
  const [seedInfo, setSeedInfo] = useState('');
  const timerRef = useRef(null);

  const activeTrip = trips[activeTripIx] || null;
  const points = activeTrip?.points || [];
  const totalPoints = points.length;
  const currentPoint = points[pointIx] || null;

  const travelled = useMemo(
    () => points.slice(0, pointIx + 1).map((p) => [p.lat, p.lon]),
    [points, pointIx]
  );
  const remaining = useMemo(
    () => points.slice(pointIx).map((p) => [p.lat, p.lon]),
    [points, pointIx]
  );

  // ---- Load journeys for date ----
  const fetchJourneys = async (opts = {}) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await trackerAPI.history(car.id, date);
      const list = data.trips || [];
      setTrips(list);
      setActiveTripIx(0);
      setPointIx(0);
      setPlaying(opts.autoplay && list.length > 0);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load journeys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!car?.id) return;
    fetchJourneys();
  }, [car?.id, date]);

  // ---- Playback loop ----
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!playing || totalPoints === 0) return;
    // Base tick = 400 ms real time between points. Scale by inverse of speed.
    const interval = Math.max(60, 400 / speed);
    timerRef.current = setInterval(() => {
      setPointIx((ix) => {
        if (ix + 1 >= totalPoints) {
          setPlaying(false);
          return ix;
        }
        return ix + 1;
      });
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [playing, speed, totalPoints]);

  const changeTrip = (ix, autoplay = true) => {
    if (ix < 0 || ix >= trips.length) return;
    setActiveTripIx(ix);
    setPointIx(0);
    setPlaying(autoplay);
  };

  const skipBack = () => setPointIx((ix) => Math.max(0, ix - 10));
  const skipForward = () => setPointIx((ix) => Math.min(totalPoints - 1, ix + 10));

  const handleSeed = async () => {
    setSeeding(true);
    setSeedInfo('');
    try {
      const { data } = await trackerAPI.seedDemoHistory(car.id, 3);
      setSeedInfo(`Seeded ${data.inserted} demo points across ${data.days} days.`);
      await fetchJourneys();
    } catch (e) {
      setSeedInfo(e?.response?.data?.detail || 'Could not seed demo data');
    } finally {
      setSeeding(false);
    }
  };

  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      data-testid="journey-playback-modal"
    >
      <div className="bg-white w-full max-w-6xl h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
              <Route size={17} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">
                Journey Playback · {car.name}
              </h2>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">{car.registration}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={toLocalYMD(new Date())}
              className="px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500"
              data-testid="journey-date-picker"
            />
            <button
              onClick={() => fetchJourneys()}
              disabled={loading}
              className="p-2 rounded-md border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-50"
              title="Refresh"
              data-testid="journey-refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-md border border-slate-300 text-slate-600 hover:bg-white"
              title="Close"
              data-testid="journey-close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
          {/* Map + controls */}
          <div className="flex flex-col min-h-0">
            {/* Map */}
            <div className="relative flex-1 min-h-[300px] bg-slate-100" data-testid="journey-map">
              {points.length >= 2 ? (
                <MapContainer
                  center={[points[0].lat, points[0].lon]}
                  zoom={14}
                  scrollWheelZoom
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitToTrip points={points} />
                  <Polyline positions={points.map((p) => [p.lat, p.lon])} pathOptions={{ color: '#94a3b8', weight: 4, opacity: 0.55 }} />
                  <Polyline positions={travelled} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.95 }} />
                  <Marker position={[startPoint.lat, startPoint.lon]} icon={dotIcon('#10b981')} />
                  <Marker position={[endPoint.lat, endPoint.lon]} icon={dotIcon('#ef4444')} />
                  {currentPoint && (
                    <Marker
                      position={[currentPoint.lat, currentPoint.lon]}
                      icon={carDivIcon(currentPoint.direction || 0, playing)}
                    />
                  )}
                </MapContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-center px-6">
                  {loading ? (
                    <p className="text-sm text-slate-500">Loading journeys…</p>
                  ) : error ? (
                    <div>
                      <p className="text-sm font-semibold text-rose-600">{error}</p>
                    </div>
                  ) : (
                    <div className="max-w-md">
                      <MapPin size={40} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-700">
                        No journeys recorded on {date}.
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Pick a different date, or seed demo trips if this is a demo tracker.
                      </p>
                      <button
                        onClick={handleSeed}
                        disabled={seeding}
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        data-testid="journey-seed-demo"
                      >
                        <Sparkles size={13} />
                        {seeding ? 'Seeding…' : 'Seed 3 days of demo trips'}
                      </button>
                      {seedInfo && <p className="mt-2 text-[11px] text-slate-500">{seedInfo}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="border-t border-slate-200 bg-white p-3 sm:p-4" data-testid="journey-controls">
              {/* Scrubber + current point info */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={skipBack}
                    disabled={totalPoints === 0}
                    className="p-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    title="Skip back 10 points"
                    data-testid="journey-skip-back"
                  >
                    <SkipBack size={14} />
                  </button>
                  <button
                    onClick={() => setPlaying((p) => !p)}
                    disabled={totalPoints === 0}
                    className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
                    title={playing ? 'Pause' : 'Play'}
                    data-testid="journey-play-toggle"
                  >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    onClick={skipForward}
                    disabled={totalPoints === 0}
                    className="p-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    title="Skip forward 10 points"
                    data-testid="journey-skip-forward"
                  >
                    <SkipForward size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-1 ml-1">
                  {[1, 2, 4, 8].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-2 py-1 text-xs font-semibold rounded-md border ${
                        speed === s
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      }`}
                      data-testid={`journey-speed-${s}x`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                <div className="flex-1 min-w-[180px] flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, totalPoints - 1)}
                    value={pointIx}
                    onChange={(e) => { setPointIx(Number(e.target.value)); setPlaying(false); }}
                    disabled={totalPoints === 0}
                    className="w-full accent-blue-600"
                    data-testid="journey-scrubber"
                  />
                  <span className="tabular-nums text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    {totalPoints === 0 ? '0/0' : `${pointIx + 1}/${totalPoints}`}
                  </span>
                </div>
              </div>

              {/* Current point info */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="journey-point-info">
                <InfoTile
                  icon={<Clock size={13} />}
                  label="Time"
                  value={currentPoint ? fmtTime(currentPoint.timestamp) : '—'}
                />
                <InfoTile
                  icon={<Gauge size={13} />}
                  label="Speed"
                  value={currentPoint ? `${currentPoint.speed} km/h` : '—'}
                  emphasis={currentPoint && currentPoint.speed > 0 ? 'text-emerald-700' : ''}
                />
                <InfoTile
                  icon={<Battery size={13} />}
                  label="Voltage"
                  value={currentPoint?.voltage != null ? `${Number(currentPoint.voltage).toFixed(1)} V` : '—'}
                />
                <InfoTile
                  icon={<Navigation size={13} />}
                  label="Heading"
                  value={currentPoint ? `${currentPoint.direction}°` : '—'}
                />
              </div>
            </div>
          </div>

          {/* Trip list sidebar */}
          <div className="border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col min-h-0 bg-slate-50">
            <div className="px-4 py-3 border-b border-slate-200 bg-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trips this day</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">
                {trips.length} {trips.length === 1 ? 'journey' : 'journeys'}
              </p>
            </div>
            <div className="overflow-y-auto flex-1" data-testid="journey-trip-list">
              {trips.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">
                  {loading ? 'Loading…' : 'No trips on this date.'}
                </div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {trips.map((t, ix) => {
                    const active = ix === activeTripIx;
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => changeTrip(ix, true)}
                          className={`w-full text-left px-4 py-3 hover:bg-white transition-colors ${
                            active ? 'bg-white border-l-4 border-blue-500' : 'border-l-4 border-transparent'
                          }`}
                          data-testid={`journey-trip-${ix}`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900 tabular-nums">
                              {fmtTime(t.start_time)} → {fmtTime(t.end_time)}
                            </p>
                            {active && playing && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded" data-testid={`journey-trip-${ix}-playing`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                                Playing
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={11} /> {fmtDuration(t.duration_min)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Gauge size={11} /> max {t.max_speed} km/h
                            </span>
                            <span className="inline-flex items-center gap-1">
                              avg {t.avg_speed} km/h
                            </span>
                            <span className="text-slate-400">· {t.point_count} pts</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoTile = ({ icon, label, value, emphasis = '' }) => (
  <div className="px-3 py-2 rounded-md border border-slate-200 bg-slate-50">
    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      {icon} {label}
    </div>
    <div className={`mt-0.5 text-sm font-semibold tabular-nums ${emphasis || 'text-slate-900'}`}>
      {value}
    </div>
  </div>
);

export default JourneyPlayback;
