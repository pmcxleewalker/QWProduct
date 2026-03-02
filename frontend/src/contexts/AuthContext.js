import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Storage helper
const getStoredToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

const getStoredTenant = () => {
  const stored = localStorage.getItem('activeTenant');
  return stored ? JSON.parse(stored) : null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [activeTenant, setActiveTenant] = useState(getStoredTenant());
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(getStoredToken());
  const [needsTenantSelection, setNeedsTenantSelection] = useState(false);

  // Set axios default header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      const data = response.data;
      
      // Include role from current_context in user object
      const role = data.current_context?.role;
      const userWithRole = { ...data.user, role };
      setUser(userWithRole);
      
      // Handle tenant context
      if (data.memberships && data.memberships.length > 0) {
        setTenants(data.memberships);
        
        if (data.current_context?.tenant_id) {
          const current = data.memberships.find(t => t.tenant_id === data.current_context.tenant_id);
          if (current) {
            setActiveTenant(current);
            localStorage.setItem('activeTenant', JSON.stringify(current));
          }
        }
      }
      
      // Check if user needs to select tenant
      if (role === 'super_admin' || role === 'master_admin') {
        // Platform admins don't need tenant selection
        setNeedsTenantSelection(false);
      } else if (data.memberships?.length > 1 && !data.current_context?.tenant_id) {
        setNeedsTenantSelection(true);
      } else if (data.memberships?.length === 1) {
        // Auto-select single tenant
        await selectTenant(data.memberships[0].tenant_id);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData, tenants: userTenants, active_tenant } = response.data;
      
      // Store token
      if (rememberMe) {
        localStorage.setItem('token', access_token);
        localStorage.setItem('rememberMe', 'true');
        sessionStorage.removeItem('token');
      } else {
        sessionStorage.setItem('token', access_token);
        localStorage.removeItem('token');
        localStorage.removeItem('rememberMe');
      }
      
      setToken(access_token);
      
      // Include memberships in user object for tenant route checking
      const userWithMemberships = { ...userData, memberships: userTenants };
      setUser(userWithMemberships);
      setTenants(userTenants || []);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Handle tenant context
      if (active_tenant) {
        setActiveTenant(active_tenant);
        localStorage.setItem('activeTenant', JSON.stringify(active_tenant));
        setNeedsTenantSelection(false);
      } else if (userTenants?.length > 1) {
        setNeedsTenantSelection(true);
      } else if (userTenants?.length === 0 && (userData.role === 'super_admin' || userData.role === 'master_admin')) {
        // Platform admin - no tenant needed
        setNeedsTenantSelection(false);
      }
      
      return { 
        success: true, 
        user: userWithMemberships, 
        tenants: userTenants, 
        needsTenantSelection: userTenants?.length > 1 && !active_tenant 
      };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const selectTenant = async (tenantId) => {
    try {
      const response = await axios.post(`${API}/auth/select-tenant`, { tenant_id: tenantId });
      const { access_token, active_tenant } = response.data;
      
      // Update token
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      if (rememberMe) {
        localStorage.setItem('token', access_token);
      } else {
        sessionStorage.setItem('token', access_token);
      }
      
      setToken(access_token);
      setActiveTenant(active_tenant);
      localStorage.setItem('activeTenant', JSON.stringify(active_tenant));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setNeedsTenantSelection(false);
      
      return active_tenant;
    } catch (error) {
      console.error('Failed to select tenant:', error);
      throw error;
    }
  };

  const impersonateTenant = async (tenantId) => {
    try {
      const response = await axios.post(`${API}/platform/tenants/${tenantId}/impersonate`);
      const { access_token, tenant } = response.data;
      
      // Update token
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      if (rememberMe) {
        localStorage.setItem('token', access_token);
      } else {
        sessionStorage.setItem('token', access_token);
      }
      
      setToken(access_token);
      setActiveTenant({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_slug: tenant.slug,
        role: 'tenant_admin',
        is_impersonating: true
      });
      localStorage.setItem('activeTenant', JSON.stringify({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_slug: tenant.slug,
        role: 'tenant_admin',
        is_impersonating: true
      }));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Reload user info
      await fetchCurrentUser();
      
      return tenant;
    } catch (error) {
      console.error('Failed to impersonate tenant:', error);
      throw error;
    }
  };

  const stopImpersonation = async () => {
    try {
      const response = await axios.post(`${API}/platform/stop-impersonation`);
      const { access_token } = response.data;
      
      // Update token
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      if (rememberMe) {
        localStorage.setItem('token', access_token);
      } else {
        sessionStorage.setItem('token', access_token);
      }
      
      setToken(access_token);
      setActiveTenant(null);
      localStorage.removeItem('activeTenant');
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Reload user info
      await fetchCurrentUser();
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('activeTenant');
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setTenants([]);
    setActiveTenant(null);
    setNeedsTenantSelection(false);
    delete axios.defaults.headers.common['Authorization'];
  };

  // Role checks
  const isSuperAdmin = () => user?.role === 'super_admin';
  const isMasterAdmin = () => user?.role === 'master_admin';
  const isPlatformAdmin = () => user?.role === 'super_admin' || user?.role === 'master_admin';
  const isTenantAdmin = () => activeTenant?.role === 'tenant_admin' || isPlatformAdmin();
  const isStaff = () => activeTenant?.role === 'staff';
  const isImpersonating = () => activeTenant?.is_impersonating === true;

  const isAuthenticated = !!user && !!token;
  const hasTenantContext = !!activeTenant?.tenant_id;

  return (
    <AuthContext.Provider value={{ 
      user, 
      tenants,
      activeTenant,
      needsTenantSelection,
      loading, 
      isAuthenticated,
      hasTenantContext,
      login, 
      logout, 
      selectTenant,
      impersonateTenant,
      stopImpersonation,
      isSuperAdmin,
      isMasterAdmin,
      isPlatformAdmin,
      isTenantAdmin,
      isStaff,
      isImpersonating
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
