import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, AlertCircle, Car, Building2, Shield } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const tenantSlug = searchParams.get('tenant');
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);

  const isQRRedirect = redirectUrl && redirectUrl.includes('/bookings?car=');
  
  useEffect(() => {
    if (tenantSlug) {
      setTenantInfo({ slug: tenantSlug, name: tenantSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') });
    }
  }, [tenantSlug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password, rememberMe);
      
      if (result.success) {
        const userRole = result.user?.role;
        if (userRole === 'super_admin') {
          navigate('/platform');
        } else if (result.needsTenantSelection) {
          navigate('/select-tenant');
        } else if (result.tenants?.length === 1) {
          navigate(`/${result.tenants[0].tenant_slug}`);
        } else {
          navigate('/');
        }
      } else {
        const errorMsg = typeof result.error === 'string' 
          ? result.error 
          : 'Login failed. Please check your credentials.';
        setError(errorMsg);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      let errorMsg = 'Login failed. Please check your credentials.';
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map(e => e.msg || String(e)).join(', ');
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Abstract Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-slate-700/20 to-transparent rounded-full blur-3xl"></div>
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden border border-slate-200/50">
          
          {/* Premium Header Section */}
          <div className="relative bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
            {/* Metallic accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-300 via-blue-500 to-slate-300"></div>
            
            <div className="px-8 pt-10 pb-8 text-center">
              {/* Logo Container with subtle shadow */}
              <div className="inline-block">
                <img 
                  src="/quick-wing-logo.png" 
                  alt="Quick Wing" 
                  className="h-20 w-auto object-contain drop-shadow-sm"
                  data-testid="login-title"
                />
              </div>
              
              {/* Tenant Badge */}
              {tenantInfo && (
                <div className="mt-4 inline-flex items-center px-4 py-2 bg-slate-100 rounded-full border border-slate-200">
                  <Building2 size={14} className="mr-2 text-slate-500" />
                  <span className="text-sm text-slate-700 font-medium">{tenantInfo.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Form Section */}
          <div className="p-8 bg-white">
            {/* QR Code Notice */}
            {isQRRedirect && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <Car className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-slate-800 font-semibold text-sm">QR Code Scanned</p>
                  <p className="text-slate-500 text-xs">Sign in to book this vehicle</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 flex items-center" data-testid="error-message">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                  <AlertCircle className="text-red-600" size={20} />
                </div>
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  data-testid="email-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  data-testid="password-input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="ml-2.5 text-sm text-slate-600 group-hover:text-slate-800 transition-colors">Remember me</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                data-testid="login-button"
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <LogIn size={18} className="mr-2.5" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            {/* Security Badge */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-center text-sm text-slate-400">
                <Shield size={14} className="mr-2" />
                <span>Enterprise-grade security</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} Quick Wing Fleet Management</p>
          <div className="flex items-center justify-center space-x-4 text-xs text-slate-500">
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <span className="text-slate-600">•</span>
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
