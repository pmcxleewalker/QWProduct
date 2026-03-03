import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * Legacy Dashboard - Redirects to new TenantDashboard
 * This page is kept for backward compatibility with old routes
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const { activeTenant } = useAuth();

  useEffect(() => {
    // Auto-redirect to tenant dashboard after a short delay
    const timer = setTimeout(() => {
      if (activeTenant?.tenant_slug) {
        navigate(`/${activeTenant.tenant_slug}`, { replace: true });
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [activeTenant, navigate]);

  const handleRedirect = () => {
    if (activeTenant?.tenant_slug) {
      navigate(`/${activeTenant.tenant_slug}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-blue-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Dashboard Updated
        </h1>
        <p className="text-gray-600 mb-6">
          We've upgraded your dashboard experience. You'll be redirected automatically.
        </p>
        <button
          onClick={handleRedirect}
          className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          data-testid="redirect-btn"
        >
          <span>Go to New Dashboard</span>
          <ArrowRight size={18} />
        </button>
        <p className="text-sm text-gray-500 mt-4">
          Redirecting in 3 seconds...
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
