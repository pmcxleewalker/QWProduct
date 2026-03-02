import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, AlertCircle, Car, Building2 } from 'lucide-react';

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
  
  // If tenant slug provided, try to fetch tenant info for display
  useEffect(() => {
    if (tenantSlug) {
      // We'll just show the slug for now - could fetch tenant name from API
      setTenantInfo({ slug: tenantSlug, name: tenantSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') });
    }
  }, [tenantSlug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password, rememberMe);
      
      // Direct navigation based on role
      if (result.success) {
        const userRole = result.user?.role;
        if (userRole === 'super_admin') {
          navigate('/platform');
        } else if (result.needsTenantSelection) {
          navigate('/select-tenant');
        } else if (result.tenants?.length === 1) {
          // Single tenant - go to their branded URL
          navigate(`/${result.tenants[0].tenant_slug}`);
        } else {
          navigate('/');
        }
      } else {
        // Ensure error is a string
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Car size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white" data-testid="login-title">
              {process.env.REACT_APP_COMPANY_NAME || 'Quick Wing'}
            </h1>
            <p className="text-blue-100 text-sm mt-1">Fleet Management Platform</p>
            {tenantInfo && (
              <div className="mt-3 inline-flex items-center px-3 py-1 bg-white/20 rounded-full">
                <Building2 size={14} className="mr-2 text-blue-100" />
                <span className="text-sm text-white font-medium">{tenantInfo.name}</span>
              </div>
            )}
          </div>

          <div className="p-8">
            {/* QR Code Notice */}
            {isQRRedirect && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center">
                <Car className="text-blue-500 mr-3 flex-shrink-0" size={24} />
                <div>
                  <p className="text-blue-800 font-medium text-sm">📱 QR Code Scanned</p>
                  <p className="text-blue-600 text-xs">Sign in to book this car</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center" data-testid="error-message">
                <AlertCircle className="text-red-500 mr-2 flex-shrink-0" size={20} />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  data-testid="email-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  data-testid="password-input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="••••••••"
                  required
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
                disabled={loading}
                data-testid="login-button"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <LogIn size={18} className="mr-2" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            {/* Multi-tenant info */}
            <div className="mt-6 pt-6 border-t text-center">
              <div className="flex items-center justify-center text-sm text-gray-500">
                <Building2 size={16} className="mr-2" />
                <span>Multi-franchise platform</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-slate-400">
          <p>© {new Date().getFullYear()} Quick Wing Fleet Management</p>
          <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
