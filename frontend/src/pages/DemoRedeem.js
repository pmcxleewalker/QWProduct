import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, AlertTriangle } from 'lucide-react';

/**
 * DemoRedeem
 * ----------
 * Public landing target for magic-link demo URLs (`/demo/:token`).
 * Exchanges the token with the backend for a full auth JWT scoped to the
 * "Quick Wing Demo Ltd" tenant, then hard-navigates into the app so
 * AuthContext bootstraps fresh from the stored token.
 *
 * The token is NEVER kept in the URL after this — we replace history so
 * refreshing the demo page doesn't re-hit the redeem endpoint.
 */
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DemoRedeem = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [prospect, setProspect] = useState('');

  useEffect(() => {
    let cancelled = false;

    const redeem = async () => {
      try {
        // Blow away any existing session so the demo starts clean and the
        // prospect doesn't accidentally see their own account/tenant.
        localStorage.removeItem('token');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('activeTenant');
        sessionStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        delete axios.defaults.headers.common['X-Tenant-ID'];

        const res = await axios.post(`${API}/demo/redeem`, { token });
        if (cancelled) return;
        const { access_token, active_tenant, prospect_name } = res.data;

        sessionStorage.setItem('token', access_token);
        localStorage.setItem('activeTenant', JSON.stringify(active_tenant));

        // Set a marker so components can detect demo mode without hitting the
        // API (e.g. the yellow DemoBanner reads this flag).
        localStorage.setItem('isDemoSession', '1');
        if (prospect_name) localStorage.setItem('demoProspectName', prospect_name);
        setProspect(prospect_name || '');

        // Hard reload so AuthContext re-initialises from the new stored token.
        window.location.replace(`/${active_tenant.tenant_slug}`);
      } catch (e) {
        if (cancelled) return;
        const msg = e?.response?.data?.detail || 'This demo link is not valid.';
        setError(typeof msg === 'string' ? msg : 'This demo link is not valid.');
      }
    };
    redeem();
    return () => { cancelled = true; };
  }, [token]);

  if (error) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mb-5">
            <AlertTriangle size={26} className="text-rose-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Demo link isn&apos;t valid</h1>
          <p className="mt-3 text-slate-600" data-testid="demo-redeem-error">{error}</p>
          <p className="mt-6 text-sm text-slate-500">
            Ask the person who sent this to you for a fresh link, or&nbsp;
            <Link to="/" className="text-blue-600 hover:text-blue-700 font-semibold">
              visit the Quick Wing homepage
            </Link>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center" data-testid="demo-redeem-loading">
        <div className="mx-auto h-14 w-14 rounded-full bg-blue-600/10 border border-blue-200 flex items-center justify-center mb-5 animate-pulse">
          <Sparkles size={26} className="text-blue-600" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Setting up your Quick Wing demo…</h1>
        <p className="mt-3 text-slate-600">
          {prospect
            ? `One moment, ${prospect} — loading the demo fleet.`
            : 'One moment — loading a live fleet so you can look around.'}
        </p>
      </div>
    </main>
  );
};

export default DemoRedeem;
