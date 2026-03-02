import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * TenantRouter - Handles path-based tenant routing
 * URLs: /tenant-slug/login, /tenant-slug/dashboard, etc.
 */
const TenantRouter = ({ children }) => {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, setTenantFromSlug, activeTenant } = useAuth();
  const [tenantInfo, setTenantInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const validateTenant = async () => {
      if (!tenantSlug) {
        setLoading(false);
        return;
      }

      try {
        // Fetch tenant info by slug (public endpoint)
        const response = await axios.get(`${API}/tenants/by-slug/${tenantSlug}`);
        setTenantInfo(response.data);
        
        // If user is authenticated, try to set tenant context
        if (isAuthenticated && setTenantFromSlug) {
          await setTenantFromSlug(tenantSlug);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Invalid tenant slug:', err);
        setError('Franchise not found');
        setLoading(false);
      }
    };

    validateTenant();
  }, [tenantSlug, isAuthenticated, setTenantFromSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading franchise...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Franchise Not Found</h1>
          <p className="text-gray-600 mb-6">
            The franchise URL "{tenantSlug}" doesn't exist or has been deactivated.
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Main Login
          </a>
        </div>
      </div>
    );
  }

  // Pass tenant info to children via context or props
  return React.cloneElement(children, { tenantInfo, tenantSlug });
};

export default TenantRouter;
