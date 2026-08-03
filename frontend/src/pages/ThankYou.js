import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

/**
 * Public thank-you page shown after a successful contact-form submission.
 * Also used as the Google Ads conversion tracking URL — keep the route
 * `/thank-you` stable and reachable without login.
 */
const ThankYou = () => {
  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col"
      data-testid="thankyou-page"
    >
      {/* Simple top bar */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
          <Link to="/" className="flex items-center" data-testid="thankyou-nav-home">
            <img src="/quick-wing-logo.png" alt="Quick Wing" className="h-9 w-auto" />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-lg text-center">
          <div
            className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-8"
            aria-hidden="true"
          >
            <CheckCircle2 size={44} />
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
            Thanks for getting in touch!
          </h1>

          <p
            className="text-lg text-slate-600 leading-relaxed mb-10"
            data-testid="thankyou-message"
          >
            Lee will be in touch with you shortly. We usually reply within one working day —
            most days a lot sooner.
          </p>

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            data-testid="thankyou-home-link"
          >
            <ArrowLeft size={18} /> Back to homepage
          </Link>
        </div>
      </main>

      <footer className="py-8 border-t border-slate-100 text-center">
        <p className="text-slate-400 text-xs">
          © {new Date().getFullYear()} Quick Wing LTD.
        </p>
      </footer>
    </div>
  );
};

export default ThankYou;
