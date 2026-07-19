import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Instagram, ArrowRight, Menu, X, Quote
} from 'lucide-react';
import ROICalculator from '../components/ROICalculator';
import FeatureCarousel from '../components/FeatureCarousel';

/**
 * LandingPage
 * ------------
 * Public marketing page shown at "/" — visitors land here before signing in.
 *
 * Redesign goals (Feb 2026):
 *   - Shorter (was 550+ lines; now ~280) so it's fast to scan and easy to
 *     maintain
 *   - Editorial / Stripe-inspired professional look — plenty of whitespace,
 *     one accent colour (blue-600), no gradient bombardment
 *   - Real product screenshot in the hero (proof, not marketing fluff)
 *
 * Preserved intentionally:
 *   - All existing #section anchors (features, roi-calculator, contact, demo)
 *     so any external links / QR codes still land in the right place
 *   - All existing data-testids used by e2e tests
 *   - Full footer legal link set (Legal / Terms / Privacy / DPA / Cookies /
 *     Security / Franchise Login) — legally required, kept as-is
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
   Hero — headline + product screenshot
   ============================================================ */
const Hero = () => (
  <section id="hero" className="pt-28 pb-16 sm:pt-32 sm:pb-20 px-4 sm:px-6">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 mb-6">
          Fleet management for Irish businesses
        </span>
        <h1
          id="hero-heading"
          className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05]"
        >
          Run your fleet from{' '}
          <span className="text-blue-600">one calm screen.</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
          Bookings, compliance, mileage and reports — replacing the spreadsheets,
          group chats and post-it notes with something your admins actually enjoy using.
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
            href="#demo"
            data-testid="hero-tour-btn"
            className="inline-flex items-center gap-2 px-5 py-3 text-slate-700 font-semibold hover:text-slate-900 transition-colors"
          >
            See it in action →
          </a>
        </div>
      </div>

      {/* Brand hero mark — the new "official logo" on textured background.
          Replaces the old duplicate screenshot (screenshots now live in the
          FeatureCarousel below, so we don't want to show the same image
          twice). */}
      <div
        id="demo"
        className="mt-14 sm:mt-20 rounded-2xl overflow-hidden border border-slate-200 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)] bg-white"
      >
        <img
          src="/quick-wing-logo-official.png"
          alt="Quick Wing — Car Fleet Management"
          className="w-full h-auto block"
          loading="eager"
        />
      </div>
    </div>
  </section>
);

/* ============================================================
   Features — carousel of real product screenshots + copy
   ============================================================ */
const Features = () => (
  <section
    id="features"
    className="py-20 sm:py-24 px-4 sm:px-6 border-t border-slate-200"
    aria-labelledby="features-heading"
  >
    <div className="max-w-6xl mx-auto">
      <div className="max-w-2xl mb-12">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          What you get
        </span>
        <h2
          id="features-heading"
          className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900"
        >
          Real product. Real screenshots.
        </h2>
        <p className="mt-4 text-slate-600 leading-relaxed">
          Not stock imagery, not concept art — these are live screens from Quick Wing running today.
        </p>
      </div>
      <FeatureCarousel />
    </div>
  </section>
);

/* ============================================================
   ROI section — reuses existing calculator component
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
   Trust bar — subtle social proof strip below the hero.
   Kept intentionally understated (grayscale, small type) so it
   reads as a credibility signal, not a big brag.
   ============================================================ */
const TrustBar = () => (
  <section
    className="border-t border-slate-200 bg-white py-8 px-4 sm:px-6"
    aria-label="Trusted by"
  >
    <div className="max-w-6xl mx-auto text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-3">
        Trusted by
      </p>
      <p
        className="text-2xl sm:text-3xl font-semibold text-slate-800 tracking-tight"
        data-testid="trustbar-brand"
      >
        Bluebird Care Ireland
      </p>
      <p className="mt-2 text-sm text-slate-500">
        …and a growing list of Irish operators.
      </p>
    </div>
  </section>
);

/* ============================================================
   Founder note — personal, editorial section that turns Quick Wing
   from "another SaaS" into a story. Content comes verbatim from
   Lee's own launch post so it reads authentic and consistent with
   his social channels.
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
          {/* Subtle blue accent tile behind the photo — the only decorative
              flourish on the page; keeps it warm without going gimmicky. */}
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
   CTA + contact — combined into a single restrained band
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
   Footer — kept in full because legal links are compliance-required
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
      <TrustBar />
      <Features />
      <ROI />
      <FounderNote />
      <CTA />
      <Footer onFranchiseLogin={() => navigate('/login')} />
    </main>
  );
};

export default LandingPage;
