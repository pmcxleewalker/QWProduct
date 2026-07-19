import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Instagram, ArrowRight, Menu, X, Quote,
  Sparkles, Activity, LineChart, CalendarCheck, ShieldCheck, Users,
  Check, XCircle, Clock, Award, Shield, MapPin
} from 'lucide-react';
import ROICalculator from '../components/ROICalculator';
import FeatureCarousel from '../components/FeatureCarousel';

/**
 * LandingPage
 * ------------
 * Public marketing page shown at "/" — visitors land here before signing in.
 *
 * Redesign v3 (Feb 2026):
 *   - Editorial / Stripe-inspired professional look with generous whitespace
 *   - Blue accent (blue-600) + warm amber accent for compliance signals
 *   - Real product screenshots — no stock imagery
 *   - Numeric proof + credentials strip to beat Webfleet / Tranzaura
 *   - Sticky CTA appears after 400px scroll to lift mobile conversion
 *   - "Spreadsheets vs Quick Wing" table sidesteps enterprise price wars
 *
 * Preserved intentionally:
 *   - All existing #section anchors (features, roi-calculator, contact, demo)
 *   - All existing data-testids used by e2e tests
 *   - Full footer legal link set (Legal / Terms / Privacy / DPA / Cookies /
 *     Security / Franchise Login)
 */

const MAILTO_DEMO = 'mailto:Lee.quickwing@gmail.com?subject=Quick Wing Demo';
const MAILTO_ENQUIRY = 'mailto:Lee.quickwing@gmail.com?subject=Quick Wing Enquiry';
const INSTAGRAM_URL = 'https://www.instagram.com/quick.wing2025';

/* ============================================================
   Nav
   ============================================================ */
const Nav = ({ mobileOpen, onToggleMobile, onCloseMobile }) => (
  <header>
    <nav
      className="fixed top-0 left-0 right-0 bg-white/85 backdrop-blur-md z-50 border-b border-slate-200/70"
      aria-label="Main navigation"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <a href="/" aria-label="Quick Wing home" className="flex items-center">
            <img
              src="/quick-wing-logo-nav.png"
              alt="Quick Wing"
              className="h-10 w-auto"
              width="150"
              height="40"
            />
          </a>

          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#features" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Features</a>
            <a href="#demo" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Demo</a>
            <a href="#roi-calculator" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">ROI Calculator</a>
            <a href="#compare" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Compare</a>
            <a href="#founder" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Our story</a>
            <a href="#contact" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Contact</a>
            <a
              href={MAILTO_DEMO}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold text-sm hover:bg-slate-800 transition-colors"
              data-testid="nav-try-btn"
            >
              Book a demo
            </a>
          </div>

          <button
            className="md:hidden p-2 text-slate-700"
            onClick={onToggleMobile}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-200/70">
          <div className="px-4 py-3 space-y-1">
            {[
              ['Features', '#features'],
              ['Demo', '#demo'],
              ['ROI Calculator', '#roi-calculator'],
              ['Compare', '#compare'],
              ['Our story', '#founder'],
              ['Contact', '#contact'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={onCloseMobile}
                className="block py-2.5 text-slate-700 text-sm font-medium"
              >
                {label}
              </a>
            ))}
            <a
              href={MAILTO_DEMO}
              className="block text-center px-4 py-2.5 mt-2 bg-slate-900 text-white rounded-lg font-semibold text-sm"
              onClick={onCloseMobile}
            >
              Book a demo
            </a>
          </div>
        </div>
      )}
    </nav>
  </header>
);

/* ============================================================
   Sticky CTA — appears after user scrolls 400px. Keeps the
   demo booking action within thumb reach on mobile without
   getting in the way of the initial hero read.
   ============================================================ */
const StickyCTA = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <a
      href={MAILTO_DEMO}
      data-testid="sticky-cta"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full font-semibold shadow-lg shadow-blue-600/30 transition-all duration-300 hover:bg-blue-700 md:bottom-6 md:right-6 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ArrowRight size={16} /> Book a demo
    </a>
  );
};

/* ============================================================
   Hero — headline + product screenshot on desktop
   ============================================================ */
const Hero = () => (
  <section id="hero" className="pt-28 pb-14 sm:pt-32 sm:pb-16 px-4 sm:px-6">
    <div className="max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Left: copy */}
        <div className="lg:col-span-6">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 mb-6">
            <MapPin size={12} /> Fleet management for Irish businesses
          </span>
          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05]"
          >
            Run your fleet from{' '}
            <span className="text-blue-600">one calm screen.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
            Replace 3 hours of daily admin — spreadsheets, group chats and
            post-it notes — with one dashboard your team actually enjoys using.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href={MAILTO_DEMO}
              data-testid="hero-demo-btn"
              className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
            >
              Book a free demo <ArrowRight size={16} />
            </a>
            <a
              href="#features"
              data-testid="hero-tour-btn"
              className="inline-flex items-center gap-2 px-5 py-3 text-slate-700 font-semibold hover:text-slate-900 transition-colors"
            >
              See it in action →
            </a>
          </div>
          <p className="mt-5 text-sm text-slate-500 flex items-center gap-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" /> No credit card
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" /> 20-min setup
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" /> Built in Ireland
            </span>
          </p>
        </div>

        {/* Right: product screenshot in browser frame */}
        <div id="demo" className="lg:col-span-6">
          <div
            className="relative rounded-xl overflow-hidden border border-slate-200 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.4)] bg-white"
            data-testid="hero-screenshot"
          >
            <div className="hidden sm:flex items-center gap-1.5 h-7 px-3 bg-slate-100 border-b border-slate-200">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-4 text-[10px] text-slate-500 truncate font-mono">
                quick-wing.com / dashboard
              </span>
            </div>
            <img
              src="/marketing/booking-intelligence.jpg"
              alt="Quick Wing Booking Intelligence dashboard showing 0 vehicle clashes, 0 driver clashes, 0 compliance risks and 6 idle vehicles"
              className="w-full h-auto block"
              loading="eager"
              width="1200"
              height="700"
            />
          </div>
          {/* Small brand-mark tucked under the screenshot */}
          <p className="mt-4 text-xs text-slate-500 text-center lg:text-left">
            A product of QuickFleet Limited — proudly built in Ireland 🇮🇪
          </p>
        </div>
      </div>
    </div>
  </section>
);

/* ============================================================
   Numeric Proof Strip — three inline stats visitors see just
   below the fold. Directly mirrors Webfleet/Tranzaura's numeric
   proof but tailored to SMB operator pain points.
   ============================================================ */
const ProofStrip = () => (
  <section
    className="border-t border-slate-200 bg-slate-50 py-10 px-4 sm:px-6"
    aria-label="Impact by the numbers"
  >
    <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 text-center">
      {[
        { stat: '10 hrs', label: 'saved per week on admin', sub: 'per operator, on average' },
        { stat: '100%', label: 'compliance visibility', sub: 'tax, NCT, insurance, service' },
        { stat: '1', label: 'dashboard replaces', sub: 'spreadsheets · WhatsApp · post-its' },
      ].map((item, i) => (
        <div key={i} className="flex flex-col items-center" data-testid={`proof-stat-${i}`}>
          <p className="text-4xl sm:text-5xl font-semibold text-slate-900 tracking-tight tabular-nums">
            {item.stat}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{item.label}</p>
          <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
        </div>
      ))}
    </div>
  </section>
);

/* ============================================================
   Trust Bar — customer marquee-style strip + credentials
   Even with one flagship customer, the layout scales as more
   logos come in without a redesign.
   ============================================================ */
const TrustBar = () => (
  <section
    className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6"
    aria-label="Trusted by"
  >
    <div className="max-w-6xl mx-auto text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-5">
        Trusted by Irish operators
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        <p
          className="text-2xl sm:text-3xl font-semibold text-slate-800 tracking-tight"
          data-testid="trustbar-brand"
        >
          Bluebird Care Ireland
        </p>
        <span className="hidden sm:inline text-slate-300">·</span>
        <p className="text-sm text-slate-500 italic">
          …and a growing list of operators across Ireland.
        </p>
      </div>

      {/* Credentials strip */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
        {[
          { icon: MapPin, label: 'Built in Ireland' },
          { icon: Shield, label: 'GDPR Ready' },
          { icon: ShieldCheck, label: 'ISO-27001-aligned hosting' },
          { icon: Activity, label: '99.9% Uptime' },
          { icon: Award, label: 'Founder-led support' },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5"
          >
            <Icon size={13} className="text-blue-600" />
            {label}
          </span>
        ))}
      </div>
    </div>
  </section>
);

/* ============================================================
   Why Quick Wing — one-liner differentiator strip.
   Positions vs. spreadsheets (real competitor for SMBs), not
   vs. the enterprise incumbents.
   ============================================================ */
const WhyStrip = () => (
  <section
    className="py-16 sm:py-20 px-4 sm:px-6 bg-slate-900 text-white"
    aria-label="Why Quick Wing"
  >
    <div className="max-w-4xl mx-auto text-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300">
        Why Quick Wing
      </span>
      <p
        className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight"
        data-testid="why-strip-tagline"
      >
        Fleet spreadsheets tell you{' '}
        <span className="text-slate-400 line-through decoration-2">what happened</span>.<br />
        Quick Wing tells you <span className="text-blue-400">what to do next.</span>
      </p>
      <p className="mt-6 text-slate-400 leading-relaxed max-w-2xl mx-auto">
        Built by an Irish operator, for Irish operators. Because generic global
        SaaS doesn&apos;t know a Cert of Roadworthiness from an NCT — and your team
        shouldn&apos;t have to translate.
      </p>
    </div>
  </section>
);

/* ============================================================
   Feature Icon Grid — quick scan of scope before the carousel
   deep-dive.
   ============================================================ */
const FEATURE_ICONS = [
  { icon: CalendarCheck, title: 'Bookings', body: 'Day, week and month views. Recurring, admin-assigned, and secondary drivers.' },
  { icon: ShieldCheck, title: 'Compliance Alerts', body: 'Tax, NCT, insurance, service and licence — never missed again.' },
  { icon: Sparkles, title: 'Booking Intelligence', body: 'AI catches clashes, idle vehicles and risks 48 hrs ahead.' },
  { icon: Activity, title: 'Live Fleet Sheet', body: 'Every vehicle status at a glance, updated in real time.' },
  { icon: LineChart, title: 'Reports', body: 'Utilisation, availability, most-booked cars, CSV export.' },
  { icon: Users, title: 'Multi-Tenant', body: 'Franchise-ready with tenant branding, roles and login tracking.' },
];

const FeatureGrid = () => (
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14 sm:mb-16" data-testid="feature-icon-grid">
    {FEATURE_ICONS.map(({ icon: Icon, title, body }) => (
      <div
        key={title}
        className="p-5 bg-white border border-slate-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all"
      >
        <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mb-3">
          <Icon size={18} className="text-blue-600" strokeWidth={2} />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
      </div>
    ))}
  </div>
);

/* ============================================================
   Features — icon grid + carousel of real product screenshots
   ============================================================ */
const Features = () => (
  <section
    id="features"
    className="py-24 sm:py-32 px-4 sm:px-6 bg-slate-50 border-t border-slate-200"
    aria-labelledby="features-heading"
  >
    <div className="max-w-6xl mx-auto">
      <div className="max-w-2xl mb-14 sm:mb-16">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
          What you get
        </span>
        <h2
          id="features-heading"
          className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight text-slate-900"
        >
          Everything a fleet manager wishes their spreadsheet did.
        </h2>
        <p className="mt-5 text-slate-600 leading-relaxed text-base sm:text-lg">
          Real screens from Quick Wing running today — not stock imagery, not concept art.
          Scan the six pillars, then swipe through the live product below.
        </p>
      </div>

      <FeatureGrid />

      <FeatureCarousel />
    </div>
  </section>
);

/* ============================================================
   Comparison — Spreadsheets vs Quick Wing.
   Sidesteps enterprise price wars by comparing to what SMBs
   actually use today.
   ============================================================ */
const COMPARISON_ROWS = [
  ['Real-time booking clashes', false, true],
  ['Compliance alerts before deadlines', false, true],
  ['Idle vehicle detection (next 48 hrs)', false, true],
  ['Login & audit history', false, true],
  ['Mobile access for drivers', false, true],
  ['One live dashboard, no version chaos', false, true],
  ['Backups & GDPR built-in', false, true],
  ['Cost per week', '5+ hrs of admin', 'Under €1/vehicle/day'],
];

const Compare = () => (
  <section
    id="compare"
    className="py-20 sm:py-24 px-4 sm:px-6 border-t border-slate-200 bg-white"
    aria-labelledby="compare-heading"
  >
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          Side-by-side
        </span>
        <h2
          id="compare-heading"
          className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900"
        >
          The spreadsheet vs. Quick Wing
        </h2>
        <p className="mt-4 text-slate-600 leading-relaxed max-w-2xl mx-auto">
          We don&apos;t pretend enterprise fleet suites don&apos;t exist. But your real competitor
          today isn&apos;t Webfleet — it&apos;s the Excel file everyone edits at once.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm" data-testid="compare-table">
        <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1.5fr_1fr_1fr] bg-slate-50 border-b border-slate-200">
          <div className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Feature
          </div>
          <div className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 text-center border-l border-slate-200">
            Spreadsheets
          </div>
          <div className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-blue-700 text-center bg-blue-50/40 border-l border-slate-200">
            Quick Wing
          </div>
        </div>
        {COMPARISON_ROWS.map(([feature, ss, qw], i) => (
          <div
            key={feature}
            className={`grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1.5fr_1fr_1fr] items-center ${
              i !== COMPARISON_ROWS.length - 1 ? 'border-b border-slate-100' : ''
            }`}
          >
            <div className="px-4 sm:px-6 py-3.5 text-sm font-medium text-slate-800">{feature}</div>
            <div className="px-4 sm:px-6 py-3.5 text-center border-l border-slate-100 text-sm">
              {typeof ss === 'boolean' ? (
                ss ? <Check size={18} className="text-emerald-600 mx-auto" /> : <XCircle size={18} className="text-slate-300 mx-auto" />
              ) : (
                <span className="text-slate-500 text-xs sm:text-sm">{ss}</span>
              )}
            </div>
            <div className="px-4 sm:px-6 py-3.5 text-center border-l border-slate-100 bg-blue-50/30 text-sm">
              {typeof qw === 'boolean' ? (
                qw ? <Check size={18} className="text-emerald-600 mx-auto" /> : <XCircle size={18} className="text-slate-300 mx-auto" />
              ) : (
                <span className="font-semibold text-blue-700 text-xs sm:text-sm">{qw}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ============================================================
   ROI section
   ============================================================ */
const ROI = () => (
  <section
    id="roi-calculator"
    className="py-20 sm:py-24 px-4 sm:px-6 bg-slate-50 border-t border-slate-200"
  >
    <div className="max-w-6xl mx-auto">
      <div className="max-w-2xl mb-10">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          Do the maths
        </span>
        <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
          See your return in 30 seconds
        </h2>
        <p className="mt-4 text-slate-600 leading-relaxed">
          Move the sliders. See exactly what Quick Wing could save your team this year.
        </p>
      </div>
      <ROICalculator />
    </div>
  </section>
);

/* ============================================================
   Case Study Card — one quantified customer outcome. A single
   real number beats a page of generic marketing claims.
   ============================================================ */
const CaseStudy = () => (
  <section
    className="py-16 sm:py-20 px-4 sm:px-6 border-t border-slate-200 bg-white"
    aria-label="Customer outcome"
  >
    <div className="max-w-4xl mx-auto">
      <div className="relative rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-8 sm:p-12 text-white shadow-xl overflow-hidden" data-testid="case-study-card">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-2 text-blue-200 text-[11px] font-semibold uppercase tracking-[0.14em] mb-4">
            <Clock size={13} /> Customer outcome
          </div>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-snug">
            &ldquo;We cut booking admin from{' '}
            <span className="line-through decoration-2 text-blue-200/70">3 hours a day</span>{' '}
            down to{' '}
            <span className="bg-white/15 rounded-lg px-2 py-0.5">20 minutes</span>.&rdquo;
          </p>
          <p className="mt-6 text-blue-100 text-sm">
            — Bluebird Care Ireland, Quick Wing customer since 2025
          </p>
        </div>
      </div>
    </div>
  </section>
);

/* ============================================================
   Founder note
   ============================================================ */
const FounderNote = () => (
  <section
    id="founder"
    className="py-20 sm:py-24 px-4 sm:px-6 border-t border-slate-200 bg-white"
    aria-labelledby="founder-heading"
  >
    <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-10 md:gap-14 items-center">
      <div className="md:col-span-4 flex justify-center md:justify-start">
        <div className="relative">
          <div
            className="absolute -inset-3 bg-blue-600/8 rounded-3xl rotate-2"
            aria-hidden="true"
          />
          <img
            src="/marketing/founder-lee.jpg"
            alt="Lee Walker, Founder of Quick Wing"
            className="relative rounded-2xl shadow-xl w-56 h-56 sm:w-64 sm:h-64 object-cover border-4 border-white"
            width="256"
            height="256"
            loading="lazy"
          />
        </div>
      </div>

      <div className="md:col-span-8">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          A note from the founder
        </span>
        <h2
          id="founder-heading"
          className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900"
        >
          Built from real experience.
        </h2>

        <Quote size={28} className="text-blue-600/25 mt-6 mb-3" aria-hidden="true" />
        <div className="space-y-4 text-slate-700 leading-relaxed">
          <p className="text-lg font-medium text-slate-900">
            I&apos;m proud to announce the launch of Quick Wing, my fleet management software.
          </p>
          <p>
            I built Quick Wing to help businesses manage vehicle bookings,
            track compliance, and gain clear visibility over their fleet in one place.
          </p>
          <p className="italic text-slate-600">
            Built from real operational experience. Designed for real working teams.
          </p>
          <p>
            If you&apos;re interested in a demonstration or would like to use Quick Wing
            in your company, please get in touch.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="text-2xl text-slate-900"
              style={{ fontFamily: '"Dancing Script", "Great Vibes", cursive', fontWeight: 600 }}
            >
              Lee Walker
            </p>
            <p className="text-sm text-slate-500 mt-1">Founder, Quick Wing</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-medium text-blue-700">
            {['#QuickWing', '#FleetManagement', '#SaaS', '#Operations', '#BusinessInnovation'].map((tag) => (
              <span
                key={tag}
                className="bg-blue-50 border border-blue-100 rounded-full px-2.5 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ============================================================
   CTA + contact
   ============================================================ */
const CTA = () => (
  <section
    id="contact"
    className="py-20 sm:py-24 px-4 sm:px-6 border-t border-slate-200"
    aria-labelledby="contact-heading"
  >
    <div className="max-w-3xl mx-auto text-center">
      <h2
        id="contact-heading"
        className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900"
      >
        Ready to give your team their time back?
      </h2>
      <p className="mt-4 text-slate-600 leading-relaxed">
        Book a 20-minute demo, or drop us a line with your questions — no sales script, promise.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href={MAILTO_ENQUIRY}
          data-testid="contact-email-btn"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
        >
          <Mail size={16} /> Lee.quickwing@gmail.com
        </a>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-slate-700 font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Instagram size={16} /> @quick.wing2025
        </a>
      </div>
    </div>
  </section>
);

/* ============================================================
   Footer
   ============================================================ */
const Footer = ({ onFranchiseLogin }) => (
  <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6" role="contentinfo">
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <img
            src="/quick-wing-logo-nav.png"
            alt="Quick Wing"
            className="h-9 w-auto mb-3 opacity-90"
            width="140"
            height="36"
          />
          <p className="text-xs text-slate-500">Fleet management software for Irish businesses.</p>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Footer navigation">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link to="/legal" className="hover:text-white transition-colors">Legal</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/dpa" className="hover:text-white transition-colors">DPA</Link>
          <Link to="/cookies" className="hover:text-white transition-colors">Cookies</Link>
          <Link to="/security" className="hover:text-white transition-colors">Security</Link>
          <button
            onClick={onFranchiseLogin}
            className="hover:text-white transition-colors"
            data-testid="footer-login-btn"
          >
            Franchise Login
          </button>
        </nav>
      </div>

      <div className="border-t border-slate-800 mt-10 pt-6 text-center">
        <p className="text-[11px] text-slate-500">
          © 2026 QuickFleet Limited. Quick Wing is a product of QuickFleet Limited. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

/* ============================================================
   Page
   ============================================================ */
const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.title = 'Quick Wing | Fleet management for Irish businesses';
  }, []);

  return (
    <main className="min-h-screen bg-white text-slate-900 antialiased" role="main">
      <Nav
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((v) => !v)}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <Hero />
      <ProofStrip />
      <TrustBar />
      <WhyStrip />
      <Features />
      <Compare />
      <ROI />
      <CaseStudy />
      <FounderNote />
      <CTA />
      <Footer onFranchiseLogin={() => navigate('/login')} />
      <StickyCTA />
    </main>
  );
};

export default LandingPage;
