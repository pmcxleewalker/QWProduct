import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  Building2, Users, Car, Calendar, TrendingUp, Plus, 
  Pause, Play, Eye, Shield, Crown, AlertTriangle,
  Search, Filter, MoreVertical, ChevronDown, ChevronUp,
  Activity, DollarSign, Clock, CheckCircle, XCircle,
  FileText, Settings, RefreshCw, LogOut, Trash2, Key,
  Receipt, Download, Send, Edit2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PlatformAdmin = () => {
  const { user, isPlatformAdmin, isSuperAdmin, impersonateTenant, isImpersonating, stopImpersonation, activeTenant } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Create tenant form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', slug: '', plan: 'starter', master_admin_email: '', master_admin_name: '' });
  
  // Created tenant result (to show credentials)
  const [createdTenantResult, setCreatedTenantResult] = useState(null);
  
  // Selected tenant for details
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantDetails, setTenantDetails] = useState(null);
  
  // Create user form
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'staff', tenant_id: '' });

  // Reports & Billing state
  const [reportsTab, setReportsTab] = useState('executive');
  const [executiveSummary, setExecutiveSummary] = useState(null);
  const [franchisesReport, setFranchisesReport] = useState(null);
  const [invoicesReport, setInvoicesReport] = useState(null);
  const [companySettings, setCompanySettings] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [editSettings, setEditSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    tenant_id: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }],
    tax_rate: 23,
    due_date: '',
    notes: ''
  });

  useEffect(() => {
    if (isPlatformAdmin()) {
      fetchData();
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportsData();
    }
  }, [activeTab, reportsTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tenantsRes, statsRes, logsRes, usersRes] = await Promise.all([
        axios.get(`${API}/platform/tenants`),
        axios.get(`${API}/platform/stats`),
        axios.get(`${API}/platform/audit-log?limit=50`),
        axios.get(`${API}/platform/users`)
      ]);
      
      setTenants(tenantsRes.data.tenants || []);
      setStats(statsRes.data);
      setAuditLogs(logsRes.data.events || []);
      setAllUsers(usersRes.data.users || []);
    } catch (err) {
      setError('Failed to load platform data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportsData = async () => {
    try {
      if (reportsTab === 'executive') {
        const res = await axios.get(`${API}/platform/reports/executive-summary`);
        setExecutiveSummary(res.data);
      } else if (reportsTab === 'franchises') {
        const res = await axios.get(`${API}/platform/reports/franchises`);
        setFranchisesReport(res.data);
      } else if (reportsTab === 'invoices') {
        const res = await axios.get(`${API}/platform/invoices`);
        setInvoices(res.data.invoices || []);
        const summaryRes = await axios.get(`${API}/platform/reports/invoices`);
        setInvoicesReport(summaryRes.data);
      } else if (reportsTab === 'settings') {
        const res = await axios.get(`${API}/platform/settings`);
        setCompanySettings(res.data);
        setSettingsForm(res.data || {});
      }
    } catch (err) {
      console.error('Failed to fetch reports data:', err);
    }
  };

  const downloadPdf = async (endpoint, filename) => {
    setDownloadingPdf(true);
    try {
      const response = await axios.get(`${API}${endpoint}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess('PDF downloaded successfully');
    } catch (err) {
      setError('Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/platform/invoices`, newInvoice);
      setSuccess('Invoice created successfully');
      setShowCreateInvoice(false);
      setNewInvoice({ tenant_id: '', items: [{ description: '', quantity: 1, unit_price: 0 }], tax_rate: 23, due_date: '', notes: '' });
      fetchReportsData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create invoice');
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId, status) => {
    try {
      await axios.put(`${API}/platform/invoices/${invoiceId}`, { status });
      setSuccess(`Invoice marked as ${status}`);
      fetchReportsData();
    } catch (err) {
      setError('Failed to update invoice');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/platform/settings`, settingsForm);
      setSuccess('Settings saved successfully');
      setEditSettings(false);
      fetchReportsData();
    } catch (err) {
      setError('Failed to save settings');
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const response = await axios.post(`${API}/platform/tenants`, newTenant);
      // Store the result to show credentials
      setCreatedTenantResult(response.data);
      setShowCreateForm(false);
      setNewTenant({ name: '', slug: '', plan: 'starter', master_admin_email: '', master_admin_name: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create tenant');
    }
  };

  const handleSuspendTenant = async (tenantId) => {
    if (!window.confirm('Are you sure you want to suspend this tenant? They will lose access immediately.')) return;
    
    try {
      await axios.post(`${API}/platform/tenants/${tenantId}/suspend`);
      setSuccess('Tenant suspended successfully');
      fetchData();
      setSelectedTenant(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to suspend tenant');
    }
  };

  const handleReactivateTenant = async (tenantId) => {
    try {
      await axios.post(`${API}/platform/tenants/${tenantId}/reactivate`);
      setSuccess('Tenant reactivated successfully');
      fetchData();
      setSelectedTenant(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reactivate tenant');
    }
  };

  // Delete tenant state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteTenant = async () => {
    if (!tenantToDelete || !deletePassword) return;
    
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/platform/tenants/${tenantToDelete.id}`, {
        data: { password: deletePassword, confirm: true }
      });
      setSuccess(`Tenant "${tenantToDelete.name}" has been permanently deleted`);
      setShowDeleteModal(false);
      setDeletePassword('');
      setTenantToDelete(null);
      setSelectedTenant(null);
      fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.detail;
      setError(typeof errorMsg === 'string' ? errorMsg : 'Failed to delete tenant');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Reset password state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({ userId: '', userEmail: '', newPassword: '', adminPassword: '' });

  const handleResetPassword = async () => {
    if (!resetPasswordData.userId || !resetPasswordData.newPassword || !resetPasswordData.adminPassword) return;
    
    try {
      await axios.post(`${API}/platform/users/${resetPasswordData.userId}/reset-password`, {
        new_password: resetPasswordData.newPassword,
        admin_password: resetPasswordData.adminPassword
      });
      setSuccess(`Password reset successfully for ${resetPasswordData.userEmail}`);
      setShowResetPasswordModal(false);
      setResetPasswordData({ userId: '', userEmail: '', newPassword: '', adminPassword: '' });
    } catch (err) {
      const errorMsg = err.response?.data?.detail;
      setError(typeof errorMsg === 'string' ? errorMsg : 'Failed to reset password');
    }
  };

  const handleImpersonate = async (tenantId) => {
    if (!window.confirm('You are about to impersonate this tenant. All actions will be logged.')) return;
    
    try {
      await impersonateTenant(tenantId);
      setSuccess('Now impersonating tenant');
      // Redirect to dashboard
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to impersonate tenant');
    }
  };

  const handleStopImpersonation = async () => {
    try {
      await stopImpersonation();
      setSuccess('Impersonation ended');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to stop impersonation');
    }
  };

  const fetchTenantDetails = async (tenantId) => {
    try {
      const response = await axios.get(`${API}/platform/tenants/${tenantId}`);
      setTenantDetails(response.data);
      setSelectedTenant(tenantId);
    } catch (err) {
      setError('Failed to load tenant details');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await axios.post(`${API}/platform/users`, {
        email: newUser.email,
        password: newUser.password,
        name: newUser.name
      }, {
        params: {
          role: newUser.role,
          tenant_id: newUser.tenant_id || undefined
        }
      });
      setSuccess(`User "${newUser.email}" created successfully`);
      setShowCreateUserForm(false);
      setNewUser({ email: '', password: '', name: '', role: 'staff', tenant_id: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700 border-green-200',
      suspended: 'bg-red-100 text-red-700 border-red-200',
      pending_payment: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      trial: 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IE', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (!isPlatformAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Shield size={48} className="mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Impersonation Banner */}
      {isImpersonating() && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Eye size={18} />
            <span>Impersonating: <strong>{activeTenant?.tenant_name}</strong></span>
          </div>
          <button
            onClick={handleStopImpersonation}
            className="flex items-center space-x-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded"
          >
            <LogOut size={16} />
            <span>Exit Impersonation</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <Crown size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Franchise Command Centre</h1>
                <p className="text-slate-300 text-sm">Platform Administration</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <a
                href="/platform/reports"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                <FileText size={18} />
                <span>Reports & Billing</span>
              </a>
              <span className="text-sm text-slate-300">{user?.email}</span>
              <span className="px-3 py-1 bg-blue-600 rounded-full text-xs font-medium">
                {isSuperAdmin() ? 'Super Admin' : 'Master Admin'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 py-2">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'tenants', label: 'Tenants', icon: Building2 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'audit', label: 'Audit Log', icon: FileText }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center text-red-700">
            <AlertTriangle size={18} className="mr-2" />
            {error}
            <button onClick={() => setError('')} className="ml-auto">×</button>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center text-green-700">
            <CheckCircle size={18} className="mr-2" />
            {success}
            <button onClick={() => setSuccess('')} className="ml-auto">×</button>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Tenants</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.tenants?.total || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="text-blue-600" size={24} />
                  </div>
                </div>
                <div className="mt-3 flex items-center text-sm">
                  <span className="text-green-600 font-medium">{stats.tenants?.active || 0} active</span>
                  {stats.tenants?.suspended > 0 && (
                    <span className="text-red-600 ml-2">{stats.tenants.suspended} suspended</span>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.users || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="text-purple-600" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Vehicles</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.vehicles || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Car className="text-green-600" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Bookings This Month</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.bookings?.this_month || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Calendar className="text-orange-600" size={24} />
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  Total: {stats.bookings?.total || 0}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => { setActiveTab('tenants'); setShowCreateForm(true); }}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={18} />
                  <span>New Tenant</span>
                </button>
                <button
                  onClick={() => { setActiveTab('users'); setShowCreateUserForm(true); }}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Plus size={18} />
                  <span>New User</span>
                </button>
                <button
                  onClick={fetchData}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <RefreshCw size={18} />
                  <span>Refresh Data</span>
                </button>
              </div>
            </div>

            {/* Recent Tenants */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Recent Tenants</h2>
                <button 
                  onClick={() => setActiveTab('tenants')}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View All →
                </button>
              </div>
              <div className="divide-y">
                {tenants.slice(0, 5).map(tenant => (
                  <div key={tenant.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tenant.name}</p>
                        <p className="text-sm text-gray-500">{tenant.slug}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tenant.status)}`}>
                      {tenant.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Manage Tenants</h2>
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                <span>Create Tenant</span>
              </button>
            </div>

            {/* Create Tenant Form */}
            {showCreateForm && (
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <h3 className="font-semibold text-gray-900 mb-4">Create New Franchise</h3>
                <form onSubmit={handleCreateTenant} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Franchise Name *</label>
                      <input
                        type="text"
                        value={newTenant.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          // Auto-generate slug from name
                          const slug = name.toLowerCase()
                            .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
                            .replace(/\s+/g, '-')          // Replace spaces with hyphens
                            .replace(/-+/g, '-')           // Replace multiple hyphens with single
                            .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
                          setNewTenant({ ...newTenant, name, slug });
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Bluebird Care Kerry"
                        required
                        data-testid="tenant-name-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug (auto-generated)</label>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-2">quick-wing.com/</span>
                        <input
                          type="text"
                          value={newTenant.slug}
                          onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                          placeholder="franchise-slug"
                          required
                          data-testid="tenant-slug-input"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">This will be the franchise's login URL</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                    <select
                      value={newTenant.plan}
                      onChange={(e) => setNewTenant({ ...newTenant, plan: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      data-testid="tenant-plan-select"
                    >
                      <option value="free">Free (3 vehicles, 5 users)</option>
                      <option value="starter">Starter (10 vehicles, 20 users)</option>
                      <option value="professional">Professional (50 vehicles, 100 users)</option>
                      <option value="enterprise">Enterprise (Unlimited)</option>
                    </select>
                  </div>
                  
                  {/* Master Admin Section */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Master Admin (Franchise Owner)</h4>
                    <p className="text-sm text-gray-500 mb-3">
                      A Master Admin account will be created automatically. You can optionally specify the email and name.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email (optional)</label>
                        <input
                          type="email"
                          value={newTenant.master_admin_email}
                          onChange={(e) => setNewTenant({ ...newTenant, master_admin_email: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="owner@franchise.com"
                          data-testid="master-admin-email-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name (optional)</label>
                        <input
                          type="text"
                          value={newTenant.master_admin_name}
                          onChange={(e) => setNewTenant({ ...newTenant, master_admin_name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="John Smith"
                          data-testid="master-admin-name-input"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      data-testid="create-tenant-submit-btn"
                    >
                      Create Franchise
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      data-testid="create-tenant-cancel-btn"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            {/* Created Tenant Credentials Modal */}
            {createdTenantResult && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl max-w-lg w-full m-4 overflow-hidden" data-testid="tenant-created-modal">
                  <div className="p-6 bg-green-50 border-b border-green-100">
                    <div className="flex items-center space-x-3">
                      <CheckCircle size={24} className="text-green-600" />
                      <h3 className="text-lg font-bold text-green-800">Franchise Created Successfully!</h3>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-600 font-medium mb-1">Franchise Name</p>
                      <p className="text-lg font-bold text-blue-900">{createdTenantResult.tenant?.name}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 font-medium mb-2">Master Admin Credentials</p>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Email:</span>
                          <span className="font-mono font-medium text-gray-900">{createdTenantResult.master_admin?.email}</span>
                        </div>
                        {createdTenantResult.master_admin?.password && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">Password:</span>
                            <span className="font-mono font-medium text-gray-900 bg-yellow-100 px-2 py-1 rounded">{createdTenantResult.master_admin?.password}</span>
                          </div>
                        )}
                        {!createdTenantResult.master_admin?.password && (
                          <p className="text-sm text-amber-600">
                            User already exists - they can use their existing password.
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-purple-600 font-medium mb-1">Login URL</p>
                      <div className="flex items-center space-x-2">
                        <code className="flex-1 font-mono text-sm text-purple-900 bg-purple-100 px-2 py-1 rounded overflow-auto">
                          {createdTenantResult.login_url}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(createdTenantResult.login_url);
                            setSuccess('Login URL copied to clipboard!');
                          }}
                          className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Important</p>
                          <p className="text-sm text-amber-700">
                            {createdTenantResult.instructions}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 border-t bg-gray-50">
                    <button
                      onClick={() => setCreatedTenantResult(null)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      data-testid="close-credentials-modal-btn"
                    >
                      Got it, Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tenants List */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Building2 size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{tenant.name}</p>
                            <p className="text-sm text-gray-500">{tenant.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="capitalize">{tenant.plan}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tenant.status)}`}>
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {formatDate(tenant.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => fetchTenantDetails(tenant.id)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleImpersonate(tenant.id)}
                            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                            title="Impersonate"
                          >
                            <Shield size={18} />
                          </button>
                          {tenant.status === 'active' ? (
                            <button
                              onClick={() => handleSuspendTenant(tenant.id)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Suspend"
                            >
                              <Pause size={18} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivateTenant(tenant.id)}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                              title="Reactivate"
                            >
                              <Play size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {tenants.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Building2 size={40} className="mx-auto mb-3 opacity-50" />
                  <p>No tenants yet. Create your first franchise!</p>
                </div>
              )}
            </div>

            {/* Tenant Details Modal */}
            {selectedTenant && tenantDetails && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl max-w-lg w-full m-4 max-h-[90vh] overflow-auto">
                  <div className="p-6 border-b flex items-center justify-between">
                    <h3 className="text-lg font-bold">Tenant Details</h3>
                    <button onClick={() => setSelectedTenant(null)} className="text-gray-500 hover:text-gray-700">
                      <XCircle size={24} />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">{tenantDetails.tenant?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Slug</p>
                      <p className="font-medium">{tenantDetails.tenant?.slug}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tenantDetails.tenant?.status)}`}>
                        {tenantDetails.tenant?.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Plan</p>
                      <p className="font-medium capitalize">{tenantDetails.tenant?.plan}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-600">Vehicles</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {tenantDetails.usage?.vehicles} / {tenantDetails.usage?.max_vehicles}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-purple-600">Users</p>
                        <p className="text-2xl font-bold text-purple-700">
                          {tenantDetails.usage?.users} / {tenantDetails.usage?.max_users}
                        </p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-green-600">Total Bookings</p>
                        <p className="text-2xl font-bold text-green-700">{tenantDetails.usage?.bookings_total}</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm text-orange-600">This Month</p>
                        <p className="text-2xl font-bold text-orange-700">{tenantDetails.usage?.bookings_this_month}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 border-t flex space-x-3">
                    <button
                      onClick={() => handleImpersonate(selectedTenant)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <Shield size={18} />
                      <span>Impersonate</span>
                    </button>
                    {tenantDetails.tenant?.status === 'active' ? (
                      <button
                        onClick={() => handleSuspendTenant(selectedTenant)}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        <Pause size={18} />
                        <span>Suspend</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivateTenant(selectedTenant)}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <Play size={18} />
                        <span>Reactivate</span>
                      </button>
                    )}
                  </div>
                  
                  {/* Delete Tenant Button */}
                  <button
                    onClick={() => {
                      setTenantToDelete(tenantDetails.tenant);
                      setShowDeleteModal(true);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 border border-red-300"
                  >
                    <Trash2 size={18} />
                    <span>Delete Franchise Permanently</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Manage Users</h2>
              <button
                onClick={() => setShowCreateUserForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                <span>Create User</span>
              </button>
            </div>

            {/* Create User Form */}
            {showCreateUserForm && (
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <h3 className="font-semibold text-gray-900 mb-4">Create New User</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input
                        type="text"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        data-testid="user-role-select"
                      >
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                        {isSuperAdmin() && <option value="master_admin">Master Admin</option>}
                        {isSuperAdmin() && <option value="super_admin">Super Admin</option>}
                      </select>
                    </div>
                  </div>
                  {(newUser.role === 'staff' || newUser.role === 'admin') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
                      <select
                        value={newUser.tenant_id}
                        onChange={(e) => setNewUser({ ...newUser, tenant_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select a tenant</option>
                        {tenants.map(tenant => (
                          <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create User
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateUserForm(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* All Users List */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenants</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {user.name?.charAt(0) || user.email?.charAt(0)}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{user.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {user.tenant_count || 0} tenant(s)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          user.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setResetPasswordData({
                              userId: user.id,
                              userEmail: user.email,
                              newPassword: '',
                              adminPassword: ''
                            });
                            setShowResetPasswordModal(true);
                          }}
                          className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                          title="Reset Password"
                        >
                          <Key size={14} />
                          <span className="text-xs">Reset Password</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {allUsers.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Users size={40} className="mx-auto mb-3 opacity-50" />
                  <p>No users found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Audit Log</h2>
            
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.actor_email}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.action.includes('suspend') ? 'bg-red-100 text-red-700' :
                          log.action.includes('create') ? 'bg-green-100 text-green-700' :
                          log.action.includes('impersonation') ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {log.resource_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {log.meta ? JSON.stringify(log.meta).substring(0, 50) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {auditLogs.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <FileText size={40} className="mx-auto mb-3 opacity-50" />
                  <p>No audit events recorded yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Delete Tenant Confirmation Modal */}
      {showDeleteModal && tenantToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md w-full m-4 overflow-hidden" data-testid="delete-tenant-modal">
            <div className="p-6 bg-red-50 border-b border-red-100">
              <div className="flex items-center space-x-3">
                <AlertTriangle size={24} className="text-red-600" />
                <h3 className="text-lg font-bold text-red-800">Delete Franchise</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">You are about to permanently delete:</p>
                <p className="text-red-900 text-lg font-bold mt-1">{tenantToDelete.name}</p>
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <p>This action will:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Delete all vehicles and bookings</li>
                  <li>Remove all users from this franchise</li>
                  <li>Delete users who only belong to this franchise</li>
                  <li>This action <strong>cannot be undone</strong></li>
                </ul>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Your super admin password"
                  data-testid="delete-confirm-password"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setTenantToDelete(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTenant}
                disabled={!deletePassword || deleteLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
                data-testid="confirm-delete-btn"
              >
                {deleteLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 size={18} className="mr-2" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md w-full m-4 overflow-hidden">
            <div className="p-6 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center space-x-3">
                <Key size={24} className="text-blue-600" />
                <h3 className="text-lg font-bold text-blue-800">Reset User Password</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-100 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium">Resetting password for:</p>
                <p className="text-blue-900 font-bold">{resetPasswordData.userEmail}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="text"
                  value={resetPasswordData.newPassword}
                  onChange={(e) => setResetPasswordData({ ...resetPasswordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Admin Password</label>
                <input
                  type="password"
                  value={resetPasswordData.adminPassword}
                  onChange={(e) => setResetPasswordData({ ...resetPasswordData, adminPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Confirm with your password"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex space-x-3">
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setResetPasswordData({ userId: '', userEmail: '', newPassword: '', adminPassword: '' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!resetPasswordData.newPassword || !resetPasswordData.adminPassword}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformAdmin;
