import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, ChevronRight, Shield, AlertTriangle, Crown } from 'lucide-react';

const TenantSelector = () => {
  const { tenants, selectTenant, user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Check if user is platform admin
  const isPlatformAdminUser = user?.role === 'super_admin' || user?.role === 'master_admin' || user?.role === 'content_manager';
  
  console.log('TenantSelector - user:', user);
  console.log('TenantSelector - role:', user?.role);
  console.log('TenantSelector - isPlatformAdminUser:', isPlatformAdminUser);

  // Redirect platform admins (including content managers) to platform page if they have no tenants
  useEffect(() => {
    console.log('TenantSelector useEffect - isPlatformAdminUser:', isPlatformAdminUser, 'tenants:', tenants.length);
    if (isPlatformAdminUser && tenants.length === 0) {
      console.log('Redirecting to /platform...');
      navigate('/platform');
    }
  }, [isPlatformAdminUser, tenants, navigate]);

  const handleSelectTenant = async (tenantId) => {
    try {
      setLoading(true);
      setError('');
      await selectTenant(tenantId);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to select tenant');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      active: 'bg-green-100 text-green-700',
      suspended: 'bg-red-100 text-red-700',
      pending_payment: 'bg-yellow-100 text-yellow-700',
      trial: 'bg-blue-100 text-blue-700'
    };
    return statusStyles[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-bold">Select Organization</h1>
          <p className="text-blue-100 mt-2">Choose which franchise to access</p>
        </div>

        {/* User info */}
        <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Logged in as</p>
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex items-center text-red-700">
            <AlertTriangle size={16} className="mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Tenant list */}
        <div className="p-6 space-y-3">
          {/* Platform Admin - Go to Command Centre */}
          {isPlatformAdminUser && (
            <button
              onClick={() => navigate('/platform')}
              className="w-full p-4 rounded-xl border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 transition-all text-left flex items-center justify-between"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-600">
                  <Crown size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Tenant Command Centre</h3>
                  <p className="text-sm text-gray-500">Manage all franchises and users</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-blue-600" />
            </button>
          )}

          {tenants.length === 0 && !isPlatformAdminUser ? (
            <div className="text-center py-8 text-gray-500">
              <Shield size={40} className="mx-auto mb-3 opacity-50" />
              <p>You don't have access to any organizations.</p>
              <p className="text-sm mt-2">Contact your administrator.</p>
            </div>
          ) : tenants.length === 0 && isPlatformAdminUser ? (
            <div className="text-center py-6">
              <Building2 size={48} className="mx-auto mb-4 text-indigo-400" />
              <p className="text-gray-700 font-medium">No franchises created yet</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">Use the Command Centre to create and manage franchises.</p>
              <button
                onClick={() => navigate('/platform')}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg"
              >
                <Crown size={20} />
                <span>Go to Command Centre</span>
              </button>
            </div>
          ) : tenants.length > 0 ? (
            tenants.map((tenant) => (
              <button
                key={tenant.tenant_id}
                onClick={() => handleSelectTenant(tenant.tenant_id)}
                disabled={loading || tenant.status === 'suspended'}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                  tenant.status === 'suspended'
                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    tenant.status === 'suspended' ? 'bg-gray-200' : 'bg-blue-100'
                  }`}>
                    <Building2 size={24} className={tenant.status === 'suspended' ? 'text-gray-400' : 'text-blue-600'} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{tenant.tenant_name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(tenant.status)}`}>
                        {tenant.status || 'active'}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{tenant.role?.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
                {tenant.status !== 'suspended' && (
                  <ChevronRight size={20} className="text-gray-400" />
                )}
              </button>
            ))
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 text-center text-xs text-gray-500">
          Quick Wing Fleet Management Platform
        </div>
      </div>
    </div>
  );
};

export default TenantSelector;
