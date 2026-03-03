import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { LogIn, AlertCircle, Car, Building2, Shield } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TenantLogin = () => {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const { login, isAuthenticated, activeTenant } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  // Fetch tenant info on mount
  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await axios.get(`${API}/tenants/by-slug/${tenantSlug}`);
        setTenantInfo(response.data);
        
        // Check if tenant is suspended
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
        // Check if user has access to this tenant
        const userTenants = result.tenants || [];
        const matchingTenant = userTenants.find(t => t.tenant_slug === tenantSlug);
        
        if (matchingTenant) {
          // Select this tenant to set context, then redirect
          await selectTenant(matchingTenant.tenant_id);
          navigate(`/${tenantSlug}`);
        } else {
          setError('You do not have access to this franchise. Please contact your administrator.');
        }
      } else {
        // Handle error - ensure it's a string
        const errorMsg = typeof result.error === 'string' 
          ? result.error 
          : (result.error?.msg || result.error?.detail || 'Invalid email or password');
        setError(errorMsg);
      }
    } catch (err) {
      // Handle catch error - ensure it's a string
      const errorMsg = typeof err === 'string' 
        ? err 
        : (err?.response?.data?.detail || err?.message || 'Login failed. Please try again.');
      setError(typeof errorMsg === 'string' ? errorMsg : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with Tenant Branding */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Car size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white" data-testid="tenant-login-title">
              {tenantInfo?.name || 'Quick Wing'}
            </h1>
            <p className="text-blue-100 text-sm mt-1">Fleet Management Portal</p>
            {tenantInfo && (
              <div className="mt-3 inline-flex items-center px-3 py-1 bg-white/20 rounded-full">
                <Building2 size={14} className="mr-2 text-blue-100" />
                <span className="text-sm text-white font-medium">{tenantInfo.name}</span>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {tenantInfo?.status === 'suspended' ? (
              <div className="text-center py-8">
                <Shield size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">This franchise account is currently suspended.</p>
                <p className="text-sm text-gray-500 mt-2">Please contact your administrator.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="you@company.com"
                    required
                    data-testid="tenant-email-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                    data-testid="tenant-password-input"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">Remember me</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading || tenantInfo?.status === 'suspended'}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center disabled:opacity-50"
                  data-testid="tenant-login-button"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={18} className="mr-2" />
                      Sign In
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t text-center">
            <p className="text-xs text-gray-500">
              Powered by <span className="font-semibold text-blue-600">Quick Wing</span> Fleet Management
            </p>
          </div>
        </div>

        {/* Help Link */}
        <p className="text-center mt-6 text-sm text-blue-200">
          Need help? Contact your administrator
        </p>
      </div>
    </div>
  );
};

export default TenantLogin;
