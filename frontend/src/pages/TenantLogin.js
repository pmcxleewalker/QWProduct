import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { LogIn, AlertCircle, Car, Shield } from 'lucide-react';
import ChangePasswordModal from '../components/ChangePasswordModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TenantLogin = () => {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const { login, isAuthenticated, activeTenant, selectTenant } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  // Fetch tenant info on mount
  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await axios.get(`${API}/tenants/by-slug/${tenantSlug}`);
        setTenantInfo(response.data);
        
        if (response.data.status === 'suspended') {
          setError('This franchise account has been suspended. Please contact support.');
        }
      } catch (err) {
        setError('Franchise not found. Please check the URL.');
      } finally {
        setTenantLoading(false);
      }
    };

    if (tenantSlug) {
      fetchTenantInfo();
    }
  }, [tenantSlug]);

  // Redirect if already authenticated with correct tenant
  useEffect(() => {
    if (isAuthenticated && activeTenant?.tenant_slug === tenantSlug) {
      navigate(`/${tenantSlug}`);
    }
  }, [isAuthenticated, activeTenant, tenantSlug, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password, rememberMe);
      
      if (result.success) {
        if (result.requirePasswordChange) {
          setTempPassword(formData.password);
          setShowPasswordChange(true);
          setLoading(false);
          return;
        }
        
        const userTenants = result.tenants || [];
        const matchingTenant = userTenants.find(t => t.tenant_slug === tenantSlug);
        
        if (matchingTenant) {
          await selectTenant(matchingTenant.tenant_id);
          navigate(`/${tenantSlug}`);
        } else {
          setError('You do not have access to this franchise. Please contact your administrator.');
        }
      } else {
        const errorMsg = typeof result.error === 'string' 
          ? result.error 
          : (result.error?.msg || result.error?.detail || 'Invalid email or password');
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = typeof err === 'string' 
        ? err 
        : (err?.response?.data?.detail || err?.message || 'Login failed. Please try again.');
      setError(typeof errorMsg === 'string' ? errorMsg : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeSuccess = async () => {
    setShowPasswordChange(false);
    navigate(`/${tenantSlug}`);
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Password Change Modal */}
      <ChangePasswordModal 
        isOpen={showPasswordChange}
        onSuccess={handlePasswordChangeSuccess}
        currentPassword={tempPassword}
      />

      {/* Abstract Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-slate-700/20 to-transparent rounded-full blur-3xl"></div>
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
              {tenantInfo?.logo_url ? (
                <>
                  {/* Tenant's own brand — front and centre */}
                  <div className="inline-block">
                    <img
                      src={tenantInfo.logo_url}
                      alt={tenantInfo.name}
                      className="h-24 w-auto max-w-[240px] object-contain mx-auto drop-shadow-md"
                      data-testid="tenant-login-logo"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                  <h1
                    className="text-2xl font-bold text-slate-800 tracking-tight mt-4"
                    data-testid="tenant-login-title"
                  >
                    {tenantInfo.name}
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">Fleet Management Portal</p>

                  {/* Powered-by — small but visible white-label badge */}
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                      Powered by
                    </span>
                    <img
                      src="/quick-wing-logo.png"
                      alt="Quick Wing"
                      className="h-5 w-auto object-contain opacity-80"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* No tenant logo uploaded — fall back to QW branding only */}
                  <div className="inline-block">
                    <img
                      src="/quick-wing-logo.png"
                      alt="Quick Wing"
                      className="h-16 w-auto object-contain drop-shadow-sm"
                      data-testid="tenant-login-title"
                    />
                  </div>
                  {tenantInfo && (
                    <div className="mt-6">
                      <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                        {tenantInfo.name}
                      </h1>
                      <p className="text-sm text-slate-500 mt-1">Fleet Management Portal</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Form Section */}
          <div className="p-8 bg-white">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 flex items-center" data-testid="error-message">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                  <AlertCircle className="text-red-600" size={20} />
                </div>
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            )}

            {tenantInfo?.status === 'suspended' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield size={32} className="text-slate-400" />
                </div>
                <p className="text-slate-700 font-medium">Account Suspended</p>
                <p className="text-sm text-slate-500 mt-2">Please contact your administrator for assistance.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    placeholder="you@company.com"
                    required
                    data-testid="tenant-email-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    placeholder="••••••••"
                    required
                    data-testid="tenant-password-input"
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
                  disabled={loading || tenantInfo?.status === 'suspended'}
                  data-testid="tenant-login-button"
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
            )}

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
          {!tenantInfo?.logo_url && (
            <p className="text-sm text-slate-500">
              Powered by <span className="font-semibold text-blue-400">Quick Wing</span>
            </p>
          )}
          <p className="text-xs text-slate-600">
            Need help? Contact your administrator
          </p>
        </div>
      </div>
    </div>
  );
};

export default TenantLogin;
