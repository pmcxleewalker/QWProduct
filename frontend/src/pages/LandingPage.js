import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Car, Calendar, Users, Shield, BarChart3, Clock,
  CheckCircle2, Mail, Instagram,
  ArrowRight, Menu, X, Play, Sparkles
} from 'lucide-react';
import WingmanChatbot from '../components/WingmanChatbot';
import ROICalculator from '../components/ROICalculator';

/* ----------------------- Product Showcase (Tabbed) ----------------------- */
const showcaseItems = [
  {
    id: 'bookings',
    title: 'Smart Car Bookings',
    description: 'A clean, conflict-free booking calendar for your whole team — book in seconds, never double-book.',
    src: 'https://customer-assets.emergentagent.com/job_22fc8b90-f3dc-480b-a483-1b60e58c83e5/artifacts/88y0o78p_IMG_5914.jpeg',
    alt: 'Quick Wing car bookings calendar',
  },
  {
    id: 'availability',
    title: 'Daily Availability Timeline',
    description: 'See every vehicle, every booking, every gap — at a glance, all day long.',
    src: 'https://customer-assets.emergentagent.com/job_22fc8b90-f3dc-480b-a483-1b60e58c83e5/artifacts/iku1do9b_IMG_5909.jpeg',
    alt: 'Quick Wing daily availability timeline',
  },
  {
    id: 'reports',
    title: 'Fleet Reports & Insights',
    description: 'Mileage, compliance, usage and cost reports — exportable to CSV in one click.',
    src: 'https://customer-assets.emergentagent.com/job_22fc8b90-f3dc-480b-a483-1b60e58c83e5/artifacts/n105nizt_IMG_5913.jpeg',
    alt: 'Quick Wing fleet reports dashboard',
  },
];

const ProductShowcase = () => {
  const [activeIdx, setActiveIdx] = useState(0);

  // Auto-advance every 6 seconds (pauses if user clicks)
  const [autoplay, setAutoplay] = useState(true);
  useEffect(() => {
    if (!autoplay) return undefined;
    const t = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % showcaseItems.length);
    }, 6000);
    return () => clearInterval(t);
  }, [autoplay]);

  const handleSelect = (idx) => {
    setActiveIdx(idx);
    setAutoplay(false);
  };

  return (
    <section id="demo" className="py-20 sm:py-24 bg-slate-50" aria-labelledby="demo-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-medium tracking-widest uppercase text-blue-600 mb-3">
            Product Tour
          </span>
          <h2
            id="demo-heading"
            className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900"
          >
            See Quick Wing in action
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Tabs (left) */}
          <div className="lg:col-span-5 flex flex-col gap-3" data-testid="showcase-tabs">
            {showcaseItems.map((item, idx) => {
              const isActive = idx === activeIdx;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(idx)}
                  data-testid={`showcase-tab-${idx}`}
                  className={
                    isActive
                      ? 'text-left bg-white p-6 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-slate-900/5 transition-all'
                      : 'text-left p-6 rounded-3xl border border-transparent opacity-70 hover:opacity-100 hover:bg-white/60 transition-all'
                  }
                  aria-pressed={isActive}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={
                        isActive
                          ? 'mt-1.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100 flex-shrink-0'
                          : 'mt-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 flex-shrink-0'
                      }
                    />
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Browser frame mock (right) */}
          <div className="lg:col-span-7" data-testid="showcase-preview">
            <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden bg-white border border-slate-200/60 shadow-[0_20px_70px_-20px_rgb(15,23,42,0.25)]">
              {/* macOS-style top bar */}
              <div className="absolute top-0 left-0 right-0 h-10 bg-slate-100 flex items-center px-4 gap-2 border-b border-slate-200/60 z-20">
                <span className="w-3 h-3 rounded-full bg-rose-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs text-slate-500 font-medium truncate">
                  app.quick-wing.com / {showcaseItems[activeIdx].id}
                </span>
              </div>

              {/* Image stack with cross-fade */}
              {showcaseItems.map((item, idx) => (
                <img
                  key={item.id}
                  src={item.src}
                  alt={item.alt}
                  className={
                    idx === activeIdx
                      ? 'absolute inset-0 top-10 w-full h-[calc(100%-2.5rem)] object-cover transition-opacity duration-700 ease-in-out opacity-100 z-10'
                      : 'absolute inset-0 top-10 w-full h-[calc(100%-2.5rem)] object-cover transition-opacity duration-700 ease-in-out opacity-0 z-0'
                  }
                />
              ))}
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 mt-5">
              {showcaseItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  className={
                    idx === activeIdx
                      ? 'w-8 h-1.5 rounded-full bg-blue-600 transition-all'
                      : 'w-1.5 h-1.5 rounded-full bg-slate-300 hover:bg-slate-400 transition-all'
                  }
                  aria-label={`Show ${showcaseItems[idx].title}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ----------------------- Features Bento Grid ----------------------- */
const FeaturesBento = () => {
  return (
    <section
      id="features"
      className="py-20 sm:py-24 bg-white"
      aria-labelledby="features-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <span className="inline-block text-xs font-medium tracking-widest uppercase text-blue-600 mb-3">
            Why Quick Wing
          </span>
          <h2
            id="features-heading"
            className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900"
          >
            Everything you need to run your fleet,
            <span className="text-slate-500"> without the headache.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 lg:gap-6">
          {/* HERO: Smart Booking — spans 2 cols, 2 rows */}
          <div
            className="lg:col-span-2 lg:row-span-2 bg-gradient-to-br from-blue-50 via-white to-cyan-50/40 p-8 md:p-10 rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-[0_12px_40px_rgb(0,0,0,0.07)] transition-all flex flex-col justify-between"
            data-testid="feature-card-booking"
          >
            <div>
              <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-600/20">
                <Calendar size={26} strokeWidth={2.2} />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900 mb-3">
                Smart Booking, zero clashes.
              </h3>
              <p className="text-slate-600 leading-relaxed mb-8">
                Book any vehicle in seconds. Quick Wing automatically blocks double-bookings and recommends the next available car the moment a conflict appears.
              </p>
            </div>

            {/* Mini visual — overlapping booking pills */}
            <div className="relative space-y-2.5">
              <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2.5 border border-slate-200/80 shadow-sm w-[88%]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-700 truncate">VW Caddy · 09:00–11:30 · Sarah</span>
                <span className="ml-auto text-[10px] font-semibold tracking-wide text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Booked</span>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2.5 border border-slate-200/80 shadow-sm w-[78%] ml-6">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-700 truncate">Ford Transit · 12:00–14:00 · You</span>
                <span className="ml-auto text-[10px] font-semibold tracking-wide text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Available</span>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2.5 border border-slate-200/80 shadow-sm w-[82%] ml-3">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-700 truncate">Renault Kangoo · 15:00–17:00</span>
                <span className="ml-auto text-[10px] font-semibold tracking-wide text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pending</span>
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div
            className="lg:col-span-2 bg-white p-7 rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.07)] transition-all flex items-start gap-5"
            data-testid="feature-card-compliance"
          >
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Shield size={22} strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  Compliance Tracking
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  <CheckCircle2 size={10} /> Valid
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Never miss a tax, NCT, or insurance renewal. Quick Wing pings you weeks before — and keeps the paper trail tidy.
              </p>
            </div>
          </div>

          {/* Real-Time Updates */}
          <div
            className="lg:col-span-2 bg-white p-7 rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.07)] transition-all flex items-start gap-5"
            data-testid="feature-card-realtime"
          >
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Clock size={22} strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  Real-Time Updates
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Live
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Instant notifications when bookings change, mileage gets logged, or a driver hits the road. Your team stays in sync, always.
              </p>
            </div>
          </div>

          {/* Dark essentials banner */}
          <div
            className="lg:col-span-4 bg-slate-900 p-7 sm:p-8 rounded-3xl text-white shadow-lg flex flex-col md:flex-row md:justify-between md:items-center gap-6"
            data-testid="feature-card-essentials"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
              <div className="flex items-center gap-3 text-white/95 font-medium">
                <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Car size={18} />
                </span>
                <span className="text-sm">Fleet Tracking</span>
              </div>
              <div className="flex items-center gap-3 text-white/95 font-medium">
                <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Users size={18} />
                </span>
                <span className="text-sm">Staff Roles</span>
              </div>
              <div className="flex items-center gap-3 text-white/95 font-medium">
                <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <BarChart3 size={18} />
                </span>
                <span className="text-sm">Analytics</span>
              </div>
            </div>

            <a
              href="mailto:Lee.quickwing@gmail.com?subject=Quick Wing Demo Request"
              className="group inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-slate-900 rounded-2xl font-semibold text-sm hover:bg-cyan-50 transition-all whitespace-nowrap"
              data-testid="features-cta-demo"
            >
              Request a Demo
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ----------------------- Landing Page ----------------------- */
const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.title = 'Quick Wing | Fleet Management Software for Irish Businesses';
  }, []);

  return (
    <main className="min-h-screen bg-slate-50" role="main">
      {/* Navigation */}
      <header>
        <nav
          className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-200/60"
          aria-label="Main navigation"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <a href="/" aria-label="Quick Wing Home">
                <img
                  src="/quick-wing-logo.png"
                  alt="Quick Wing Fleet Management Software Logo"
                  className="h-8 w-auto"
                  width="120"
                  height="32"
                />
              </a>

              <div className="hidden md:flex items-center space-x-7">
                <a href="#features" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
                  Features
                </a>
                <a href="#demo" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
                  Demo
                </a>
                <a href="#roi-calculator" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
                  ROI Calculator
                </a>
                <a href="#contact" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
                  Contact
                </a>
                <a
                  href="mailto:Lee.quickwing@gmail.com?subject=Try Quick Wing"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm shadow-blue-600/20"
                  data-testid="nav-try-btn"
                >
                  Try it yourself
                </a>
              </div>

              <button
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden bg-white border-t border-slate-200/60">
              <div className="px-4 py-3 space-y-2">
                <a href="#features" className="block py-2 text-slate-700 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Features</a>
                <a href="#demo" className="block py-2 text-slate-700 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Demo</a>
                <a href="#roi-calculator" className="block py-2 text-slate-700 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>ROI Calculator</a>
                <a href="#contact" className="block py-2 text-slate-700 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Contact</a>
                <a
                  href="mailto:Lee.quickwing@gmail.com?subject=Try Quick Wing"
                  className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold"
                >
                  Try it yourself
                </a>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section
        className="pt-24 pb-16 sm:pt-32 sm:pb-20 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white relative overflow-hidden"
        aria-labelledby="hero-heading"
      >
        {/* Soft ambient blobs */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-20 -left-32 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -right-32 w-96 h-96 bg-cyan-400 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-cyan-200 text-xs font-medium mb-6 backdrop-blur-sm">
            <Sparkles size={13} />
            Built for Irish fleets
          </div>
          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5"
          >
            Fleet management that
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400"> just works.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300 mb-9 max-w-2xl mx-auto leading-relaxed">
            Book vehicles, track compliance, manage your team and pull reports — all in one place. Trusted by Irish businesses to cut admin time by 70%.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:Lee.quickwing@gmail.com?subject=Quick Wing Demo Request"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-white text-slate-900 rounded-2xl font-semibold hover:bg-cyan-50 transition-all shadow-xl shadow-cyan-500/10"
              data-testid="hero-demo-btn"
              aria-label="Request a free demo of Quick Wing"
            >
              <Play className="mr-2" size={16} aria-hidden="true" />
              Request Free Demo
            </a>
            <a
              href="#demo"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-white/10 text-white rounded-2xl font-semibold hover:bg-white/20 transition-all border border-white/20 backdrop-blur-sm"
              data-testid="hero-tour-btn"
            >
              Take the Tour
            </a>
          </div>
        </div>
      </section>

      {/* Features (Bento) */}
      <FeaturesBento />

      {/* Product Showcase (Tabbed) */}
      <ProductShowcase />

      {/* ROI Calculator */}
      <ROICalculator />

      {/* Industries strip */}
      <section className="py-12 bg-white border-y border-slate-200/60" aria-labelledby="industries-heading">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="industries-heading" className="text-xs font-medium tracking-widest uppercase text-slate-500 mb-6">
            Trusted by Irish businesses
          </h2>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-slate-600 text-sm font-medium">
            <span>Care Providers</span>
            <span className="text-slate-300">·</span>
            <span>Transport Companies</span>
            <span className="text-slate-300">·</span>
            <span>Delivery Services</span>
            <span className="text-slate-300">·</span>
            <span>Construction Firms</span>
            <span className="text-slate-300">·</span>
            <span>Healthcare</span>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section
        id="contact"
        className="py-20 sm:py-24 bg-slate-50"
        aria-labelledby="contact-heading"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="contact-heading" className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-3">
            Ready to give your team their time back?
          </h2>
          <p className="text-slate-600 mb-9 leading-relaxed">
            Get in touch for a free demo or just to ask a few questions. We're friendly, we promise.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:Lee.quickwing@gmail.com?subject=Quick Wing Enquiry"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-semibold hover:bg-slate-800 transition-all shadow-md"
              data-testid="contact-email-btn"
              aria-label="Email us at Lee.quickwing@gmail.com"
            >
              <Mail className="mr-2" size={16} aria-hidden="true" />
              Lee.quickwing@gmail.com
            </a>
            <a
              href="https://www.instagram.com/quick.wing2025"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white rounded-2xl font-semibold hover:opacity-90 transition-all shadow-md"
              aria-label="Follow us on Instagram @quick.wing2025"
            >
              <Instagram className="mr-2" size={16} aria-hidden="true" />
              @quick.wing2025
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-10" role="contentinfo">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-5">
            <div className="text-center md:text-left">
              <img
                src="/quick-wing-logo.png"
                alt="Quick Wing Fleet Management"
                className="h-8 w-auto mx-auto md:mx-0 mb-2 brightness-0 invert"
                width="120"
                height="32"
              />
              <p className="text-slate-400 text-sm">
                Fleet management software for Irish businesses.
              </p>
            </div>

            <nav className="flex items-center gap-5 text-sm text-slate-400" aria-label="Footer navigation">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#contact" className="hover:text-white transition-colors">Contact</a>
              <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
              <a
                href="https://www.instagram.com/quick.wing2025"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Instagram
              </a>
              <button
                onClick={() => navigate('/login')}
                className="hover:text-white transition-colors"
                data-testid="footer-login-btn"
              >
                Franchise Login
              </button>
            </nav>
          </div>

          <div className="border-t border-slate-800 mt-8 pt-6 text-center">
            <p className="text-slate-500 text-xs">
              © {new Date().getFullYear()} Quick Wing Fleet Management. All rights reserved. | Fleet Management Software Ireland
            </p>
          </div>
        </div>
      </footer>

      {/* Wingman AI Chatbot */}
      <WingmanChatbot />
    </main>
  );
};

export default LandingPage;
