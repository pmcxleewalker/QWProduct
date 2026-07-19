import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Activity, LineChart, CalendarCheck, ShieldCheck } from 'lucide-react';

/**
 * FeatureCarousel
 * ---------------
 * A horizontal, swipe-friendly showcase for real product screenshots.
 * Each slide has a proper description so visitors understand exactly
 * what they're looking at (not just "here's a screenshot").
 *
 * Behaviour:
 *  - Auto-advances every 6s when not being hovered
 *  - Arrow buttons + dot navigation + keyboard (← → arrows)
 *  - Swipe on touch devices
 *  - Screenshots are lazy-loaded so the landing page stays fast
 */

const SLIDES = [
  {
    id: 'booking-intelligence',
    icon: Sparkles,
    eyebrow: 'AI · Booking Intelligence',
    title: 'Catch clashes before they cost you.',
    body: 'A live AI scanner watches every booking as it comes in — flagging vehicle clashes, driver double-bookings, compliance risks and idle vehicles in the next 48 hours. One click applies the recommended fix.',
    image: '/marketing/booking-intelligence.jpg',
    alt: 'Booking Intelligence panel showing 0 vehicle clashes, 0 driver clashes, 0 compliance risks and 6 idle vehicles',
  },
  {
    id: 'live-sheet',
    icon: Activity,
    eyebrow: 'Real-time',
    title: 'Every vehicle. One live sheet.',
    body: 'Free, Booked, In Use, Needs Cleaning, Needs Repair or Blocked — see the status of every car at a glance, updated the moment a driver checks in or out. Export to Excel with one click.',
    image: '/marketing/live-sheet.jpg',
    alt: 'Live Fleet Sheet showing 6 vehicles with real-time status pills and export button',
  },
  {
    id: 'booking-calendar',
    icon: CalendarCheck,
    eyebrow: 'Smart bookings',
    title: 'Book anything in seconds.',
    body: 'Day, Week, and Month views for every vehicle side by side. Click a free slot to book on the spot. Recurring bookings, secondary drivers and admin-assigned trips are all built in.',
    image: '/marketing/booking-calendar.jpg',
    alt: 'Available cars and time slots grid showing bookings across multiple vehicles',
  },
  {
    id: 'compliance',
    icon: ShieldCheck,
    eyebrow: 'Compliance',
    title: 'Nothing slips through the cracks.',
    body: 'Tax, NCT, Insurance, Service and driver licence dates tracked for every vehicle and staff member. Alerts before deadlines, grouped by issue, with audit-logged Actioned and Dismiss actions.',
    image: '/marketing/compliance-dashboard.jpg',
    alt: 'Compliance Alerts panel with expired tax and insurance issues for Ford Focus',
  },
  {
    id: 'reports',
    icon: LineChart,
    eyebrow: 'Reports & Analytics',
    title: 'The board report writes itself.',
    body: 'Utilisation, fleet availability, most-booked cars, demand forecasts and fleet health — all in one live dashboard. CSV export in a single click.',
    image: '/marketing/fleet-reports.jpg',
    alt: 'Fleet Reports dashboard showing 6 vehicles, utilisation and analytics panels',
  },
];

const AUTO_ADVANCE_MS = 6500;

const FeatureCarousel = () => {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(null);
  const containerRef = useRef(null);

  const goTo = useCallback((i) => setIndex(((i % SLIDES.length) + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => goTo(index + 1), [index, goTo]);
  const prev = useCallback(() => goTo(index - 1), [index, goTo]);

  // Auto-advance
  useEffect(() => {
    if (isPaused) return undefined;
    const t = setTimeout(next, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [index, isPaused, next]);

  // Keyboard navigation when the carousel is focused
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onKey = (e) => {
      if (!el.contains(document.activeElement)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const current = SLIDES[index];
  const Icon = current.icon;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
        touchStartX.current = null;
      }}
      data-testid="feature-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Quick Wing feature showcase"
    >
      {/* Slide */}
      <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
        {/* Left: text */}
        <div className="order-2 md:order-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 mb-5">
            <Icon size={14} strokeWidth={2} />
            {current.eyebrow}
          </div>
          <h3
            key={`title-${current.id}`}
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-4"
          >
            {current.title}
          </h3>
          <p
            key={`body-${current.id}`}
            className="text-slate-600 leading-relaxed max-w-lg"
          >
            {current.body}
          </p>

          {/* Slide counter */}
          <div className="mt-6 flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-900 tabular-nums">
              {String(index + 1).padStart(2, '0')}
              <span className="text-slate-400"> / {String(SLIDES.length).padStart(2, '0')}</span>
            </span>
            <div className="flex-1 h-px bg-slate-200 max-w-[100px]">
              <div
                className="h-full bg-blue-600 transition-[width] duration-500"
                style={{ width: `${((index + 1) / SLIDES.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: image */}
        <div className="order-1 md:order-2">
          <div
            className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)] bg-slate-50"
            data-testid={`carousel-slide-${current.id}`}
          >
            <img
              key={current.id}
              src={current.image}
              alt={current.alt}
              className="w-full h-auto block"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      {/* Nav controls */}
      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              data-testid={`carousel-dot-${i}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-8 bg-blue-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            aria-label="Previous slide"
            data-testid="carousel-prev-btn"
            className="h-10 w-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={next}
            aria-label="Next slide"
            data-testid="carousel-next-btn"
            className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatureCarousel;
