import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Admin-only banner that shows the count of OPEN (unresolved) incidents,
 * colour-coded by the most severe outstanding case.
 *
 * Rendered above the dashboard stats; clicking it navigates to
 * Reports → Incident Reports via the onView prop supplied by the parent.
 */
const IncidentAlertBanner = ({ onView }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await axios.get(`${API}/incidents/stats`, { headers: getAuthHeaders() });
        if (!cancelled) setStats(res.data);
      } catch (err) {
        // Silently fail — feature is non-critical and shouldn't break the dashboard.
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !stats) return null;

  const unresolved = stats.unresolved || 0;
  if (unresolved === 0) return null; // Nothing to flag — keep the dashboard clean.

  // Determine alert tier from open severity counts.
  const sev = stats.by_severity || {};
  const hasSevere = (sev.severe || 0) > 0;
  const hasModerate = (sev.moderate || 0) > 0;

  const palette = hasSevere
    ? {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-900',
        sub: 'text-rose-700',
        iconWrap: 'bg-rose-600 text-white',
        ring: 'shadow-rose-200/40',
        button: 'bg-rose-600 hover:bg-rose-700',
        tag: 'Severe',
      }
    : hasModerate
    ? {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-900',
        sub: 'text-amber-800',
        iconWrap: 'bg-amber-500 text-white',
        ring: 'shadow-amber-200/40',
        button: 'bg-amber-600 hover:bg-amber-700',
        tag: 'Moderate',
      }
    : {
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        text: 'text-slate-900',
        sub: 'text-slate-700',
        iconWrap: 'bg-slate-700 text-white',
        ring: 'shadow-slate-200/40',
        button: 'bg-slate-700 hover:bg-slate-800',
        tag: 'Open',
      };

  const breakdownParts = [];
  if (sev.severe) breakdownParts.push(`${sev.severe} severe`);
  if (sev.moderate) breakdownParts.push(`${sev.moderate} moderate`);
  if (sev.minor) breakdownParts.push(`${sev.minor} minor`);
  const breakdown = breakdownParts.length > 0 ? breakdownParts.join(' · ') : null;

  return (
    <div
      className={`flex items-center justify-between gap-3 ${palette.bg} ${palette.border} border rounded-2xl p-4 shadow-sm ${palette.ring}`}
      data-testid="incident-alert-banner"
      role="alert"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl ${palette.iconWrap} flex items-center justify-center`}>
          <AlertTriangle size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-bold ${palette.text}`}>
              {unresolved} open incident{unresolved === 1 ? '' : 's'}
            </h3>
            {hasSevere && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-semibold uppercase tracking-wider">
                {palette.tag}
              </span>
            )}
          </div>
          {breakdown && (
            <p className={`text-xs ${palette.sub} mt-0.5 truncate`}>{breakdown}</p>
          )}
        </div>
      </div>
      <button
        onClick={onView}
        data-testid="incident-alert-view-btn"
        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 ${palette.button} text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors`}
      >
        View
        <ChevronRight size={14} />
      </button>
    </div>
  );
};

export default IncidentAlertBanner;
