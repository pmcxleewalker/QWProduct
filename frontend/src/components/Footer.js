import React from 'react';
import { Shield } from 'lucide-react';

// Legal/compliance links removed from the in-app footer at customer request
// (Jun 2026). The legal pages still exist (/legal, /terms, /privacy-policy,
// /dpa, /cookies, /security, /contact) and are reachable via direct URL —
// required for GDPR / cookie compliance. The public landing page footer
// keeps the visible legal link so the company's terms remain discoverable
// for visitors.
const Footer = () => {
  return (
    <footer
      className="bg-white border-t border-slate-200 py-5 mt-auto"
      data-testid="app-footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center sm:justify-start items-center gap-2 text-xs text-slate-500">
          <Shield size={14} className="text-blue-600" />
          <span>
            © 2026 QuickFleet Limited. Quick Wing is a product of QuickFleet
            Limited. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
