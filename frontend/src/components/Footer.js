import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

const LINKS = [
  { to: '/legal', label: 'Legal' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy-policy', label: 'Privacy' },
  { to: '/dpa', label: 'DPA' },
  { to: '/cookies', label: 'Cookies' },
  { to: '/security', label: 'Security' },
  { to: '/contact', label: 'Contact' },
];

const Footer = () => {
  return (
    <footer
      className="bg-white border-t border-slate-200 py-5 mt-auto"
      data-testid="app-footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shield size={14} className="text-blue-600" />
            <span>
              © 2026 QuickFleet Limited. Quick Wing is a product of QuickFleet
              Limited. All rights reserved.
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-xs text-slate-500 hover:text-blue-700 transition-colors"
                data-testid={`footer-link-${l.label.toLowerCase()}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
