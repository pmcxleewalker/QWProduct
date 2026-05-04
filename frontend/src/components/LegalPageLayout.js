import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, Scale, Shield, FileText, Cookie, Lock, Mail, Database } from 'lucide-react';

const NAV_LINKS = [
  { to: '/legal', label: 'Legal', icon: Scale },
  { to: '/terms', label: 'Terms of Service', icon: FileText },
  { to: '/privacy-policy', label: 'Privacy Policy', icon: Shield },
  { to: '/dpa', label: 'Data Processing Agreement', icon: Database },
  { to: '/cookies', label: 'Cookie Policy', icon: Cookie },
  { to: '/security', label: 'Security & Compliance', icon: Lock },
  { to: '/contact', label: 'Contact', icon: Mail },
];

export const LegalDisclaimer = () => (
  <div
    className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    data-testid="legal-disclaimer"
  >
    <strong className="font-semibold">Disclaimer: </strong>
    This content is a template and should be reviewed by a qualified solicitor
    before being used as final legal documentation.
  </div>
);

export const LegalFooterStrip = () => (
  <div className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
    © 2026 QuickFleet Limited. Quick Wing is a product of QuickFleet Limited.
    All rights reserved.
  </div>
);

const LegalPageLayout = ({ title, subtitle, icon: Icon = Scale, effectiveDate, children }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50" data-testid="legal-page-layout">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 transition-colors"
            data-testid="legal-back-btn"
          >
            <ArrowLeft size={16} className="mr-1.5" />
            Back
          </button>
          <Link
            to="/"
            className="text-sm font-semibold tracking-tight text-slate-900 hover:text-blue-700"
          >
            Quick Wing
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar nav */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Legal & Compliance
            </p>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
              {NAV_LINKS.map(({ to, label, icon: NavIcon }) => (
                <NavLink
                  key={to}
                  to={to}
                  data-testid={`legal-nav-${to.replace('/', '')}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                    }`
                  }
                >
                  <NavIcon
                    size={15}
                    className="opacity-80"
                  />
                  {label}
                </NavLink>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main>
            {/* Title block */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium mb-4">
                <Icon size={13} />
                Legal & Compliance
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-base text-slate-600">{subtitle}</p>
              )}
              {effectiveDate && (
                <p className="mt-1 text-xs text-slate-500">
                  Effective: {effectiveDate}
                </p>
              )}
            </div>

            <article className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 prose-slate space-y-8">
              {children}
            </article>

            <LegalFooterStrip />
          </main>
        </div>
      </div>
    </div>
  );
};

export const LegalSection = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-lg sm:text-xl font-semibold text-slate-900">{title}</h2>
    <div className="text-[15px] leading-relaxed text-slate-700 space-y-3">
      {children}
    </div>
  </section>
);

export const LegalQuote = ({ children }) => (
  <blockquote className="border-l-4 border-blue-500 bg-slate-50 px-4 py-3 rounded-r-md text-[15px] text-slate-800 italic">
    {children}
  </blockquote>
);

export default LegalPageLayout;
