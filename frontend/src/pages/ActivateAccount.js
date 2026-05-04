import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, CheckCircle, AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ActivateAccount = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenantSlug } = useParams();
  const { reloadUser } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('checking'); // checking | invalid | ready | submitting | done
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Validate the token on mount.
  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setStatus('invalid');
        setError('No activation token in the link.');
        return;
      }
      try {
        const res = await axios.get(`${API}/auth/activate/${token}`);
        if (res.data?.valid) {
          setInfo(res.data);
          setStatus('ready');
        } else {
          setStatus('invalid');
          setError(res.data?.error || 'This activation link is no longer valid.');
        }
      } catch (err) {
        setStatus('invalid');
        setError(err.response?.data?.detail || 'Could not validate this activation link.');
      }
    };
    validate();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setStatus('submitting');
    try {
      const res = await axios.post(`${API}/auth/activate`, {
        token,
        new_password: password,
      });
      // Persist the new login token and let AuthContext pick it up.
      localStorage.setItem('token', res.data.access_token);
      try { await reloadUser?.(); } catch (_) { /* non-fatal */ }
      setStatus('done');
      toast.success('Account activated. Redirecting…');
      setTimeout(() => {
        const slug = res.data?.tenant_slug || tenantSlug;
        navigate(slug ? `/${slug}/login` : '/login');
      }, 1200);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Activation failed. Please try again.';
      toast.error(detail);
      setStatus('ready');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-md mb-3">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Activate your account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Set a password to finish setting up your Quick Wing account.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          {status === 'checking' && (
            <div className="flex flex-col items-center py-6 text-slate-500">
              <Loader2 className="animate-spin mb-3" size={28} />
              <p className="text-sm">Validating your invitation link…</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center py-4" data-testid="activate-invalid">
              <div className="inline-flex items-center justify-center w-11 h-11 bg-red-100 rounded-full mb-3">
                <AlertCircle className="text-red-600" size={22} />
              </div>
              <h2 className="text-base font-semibold text-slate-900 mb-1">Link not valid</h2>
              <p className="text-sm text-slate-600 mb-5">{error}</p>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                data-testid="activate-go-login"
              >
                Go to sign in
              </button>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center py-4" data-testid="activate-done">
              <div className="inline-flex items-center justify-center w-11 h-11 bg-emerald-100 rounded-full mb-3">
                <CheckCircle className="text-emerald-600" size={22} />
              </div>
              <h2 className="text-base font-semibold text-slate-900 mb-1">All set</h2>
              <p className="text-sm text-slate-600">Redirecting you to sign in…</p>
            </div>
          )}

          {(status === 'ready' || status === 'submitting') && info && (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="activate-form">
              {/* Confirmed identity strip */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Joining</span>{' '}
                  <span className="font-medium text-slate-800">{info.tenant_name || info.tenant_slug}</span>
                </div>
                <div>
                  <span className="text-slate-400">Email</span>{' '}
                  <span className="font-medium text-slate-800">{info.user_email}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  data-testid="activate-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  data-testid="activate-confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  minLength={8}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'submitting'}
                data-testid="activate-submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {status === 'submitting' ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <KeyRound size={16} />
                )}
                {status === 'submitting' ? 'Activating…' : 'Activate account'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">
          © 2026 QuickFleet Limited. Quick Wing is a product of QuickFleet Limited. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ActivateAccount;
