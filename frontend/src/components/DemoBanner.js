import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const MAILTO_DEMO = 'mailto:Lee.quickwing@gmail.com?subject=Quick Wing Demo — Real conversation please';

/**
 * DemoBanner
 * ----------
 * Yellow strip shown at the top of the app whenever the current session is
 * a demo (magic-link) session. Reads the flag written by DemoRedeem.js.
 *
 * Includes:
 *  - a Sparkles icon + copy explaining data can be modified during the demo
 *  - a CTA button to book a real demo (opens the user's mail client)
 *  - a subtle X to hide it for the current tab (session-scoped)
 */
const DemoBanner = () => {
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('isDemoSession') === '1';
  const [dismissed, setDismissed] = useState(
    typeof window !== 'undefined' && sessionStorage.getItem('demoBannerDismissed') === '1'
  );

  if (!isDemo || dismissed) return null;

  const prospect = typeof window !== 'undefined' ? localStorage.getItem('demoProspectName') : '';

  return (
    <div
      className="fixed top-16 left-0 right-0 z-30 bg-amber-100 border-b border-amber-200 text-amber-900"
      role="status"
      data-testid="demo-banner"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] bg-amber-500/20 border border-amber-500/40 text-amber-900 rounded-full px-2 py-0.5 shrink-0">
          <Sparkles size={12} /> Demo
        </span>
        <p className="text-sm min-w-0 flex-1">
          <span className="font-semibold">
            {prospect ? `Hi ${prospect} — you're in Quick Wing demo mode.` : "You're in Quick Wing demo mode."}
          </span>{' '}
          <span className="text-amber-800 hidden sm:inline">
            Feel free to click around — this is a sandbox tenant and data may reset periodically.
          </span>
        </p>
        <a
          href={MAILTO_DEMO}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-900 text-white text-xs font-semibold rounded-md hover:bg-amber-800 transition-colors whitespace-nowrap"
          data-testid="demo-banner-cta"
        >
          Book a real demo →
        </a>
        <button
          onClick={() => {
            sessionStorage.setItem('demoBannerDismissed', '1');
            setDismissed(true);
          }}
          className="p-1 rounded hover:bg-amber-200 text-amber-900"
          aria-label="Dismiss demo banner"
          data-testid="demo-banner-dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default DemoBanner;
