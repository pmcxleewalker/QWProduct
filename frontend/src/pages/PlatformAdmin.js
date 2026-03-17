import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Building2, Users, Car, Calendar, TrendingUp, Plus, 
  Pause, Play, Eye, Shield, Crown, AlertTriangle,
  Search, Filter, MoreVertical, ChevronDown, ChevronUp,
  Activity, DollarSign, Clock, CheckCircle, XCircle, Check,
  FileText, Settings, RefreshCw, LogOut, Trash2, Key,
  Receipt, Download, Send, Edit2, UserPlus, UserMinus,
  Globe, Copy, Layers, Star, Zap
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Helper to extract error message from various error formats
const getErrorMessage = (err, defaultMsg = 'An error occurred') => {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail[0]?.msg || defaultMsg;
  } else if (typeof detail === 'string') {
    return detail;
  } else if (typeof detail === 'object' && detail?.msg) {
    return detail.msg;
  }
  return err?.message || defaultMsg;
};

const PlatformAdmin = () => {
  const { user, isPlatformAdmin, isSuperAdmin, impersonateTenant, isImpersonating, stopImpersonation, activeTenant, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [tenantsSubTab, setTenantsSubTab] = useState('franchises'); // 'franchises' or 'admins'
  const [auditLogTab, setAuditLogTab] = useState('all'); // 'all', 'command-centre', or tenant_id
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Master admins list
  const [masterAdmins, setMasterAdmins] = useState([]);
  
  // Plan configurations
  const [planConfigs, setPlanConfigs] = useState([]);
  
  // Create tenant form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTenant, setNewTenant] = useState({ 
    name: '', 
    slug: '', 
    plan: 'standard',
    master_admin_email: '', 
    master_admin_name: '',
    custom_max_vehicles: null,
    custom_max_users: null
  });
  
  // Created tenant result (to show credentials)
  const [createdTenantResult, setCreatedTenantResult] = useState(null);
  
  // Selected tenant for details
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantDetails, setTenantDetails] = useState(null);
  
  // Feature management modal
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [featureModalTenant, setFeatureModalTenant] = useState(null);
  const [featureEdits, setFeatureEdits] = useState({});
  
  // Create user form
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'staff', tenant_id: '' });

  // User management expansion state
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [showRemoveFromTenantModal, setShowRemoveFromTenantModal] = useState(false);
  const [showAddToTenantModal, setShowAddToTenantModal] = useState(false);
  const [editRoleData, setEditRoleData] = useState({ tenantId: '', tenantName: '', currentRole: '', newRole: '', adminPassword: '' });
  const [removeFromTenantData, setRemoveFromTenantData] = useState({ tenantId: '', tenantName: '', adminPassword: '' });
  const [addToTenantData, setAddToTenantData] = useState({ tenantId: '', role: 'staff', adminPassword: '' });
  
  // Delete user state
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [deleteUserData, setDeleteUserData] = useState({ userId: '', userEmail: '', adminPassword: '' });
  
  // Change user role state  
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
  const [changeRoleData, setChangeRoleData] = useState({ userId: '', userEmail: '', currentRole: '', newRole: '', tenantId: '', tenantName: '', adminPassword: '' });

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
      const [tenantsRes, statsRes, logsRes, usersRes, plansRes] = await Promise.all([
        axios.get(`${API}/platform/tenants`),
        axios.get(`${API}/platform/stats`),
        axios.get(`${API}/platform/audit-log?limit=50`),
        axios.get(`${API}/platform/users`),
        axios.get(`${API}/platform/plans`)
      ]);
      
      setTenants(tenantsRes.data.tenants || []);
      setStats(statsRes.data);
      setAuditLogs(logsRes.data.events || []);
      setAllUsers(usersRes.data.users || []);
      setPlanConfigs(plansRes.data.plans || []);
      
      // Extract master admins (super_admin + master_admin roles)
      const users = usersRes.data.users || [];
      const admins = users.filter(u => 
        u.role === 'super_admin' || 
        u.memberships?.some(m => m.role === 'master_admin')
      );
      setMasterAdmins(admins);
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
      setError(getErrorMessage(err, 'Failed to create invoice'));
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
      const response = await axios.put(`${API}/platform/settings`, settingsForm);
      // Close the edit form first
      setEditSettings(false);
      // Update the displayed settings with the response
      setCompanySettings(response.data.settings);
      setSettingsForm(response.data.settings || {});
      setSuccess('Settings saved successfully');
    } catch (err) {
      console.error('Save settings error:', err.response?.data || err.message);
      const errorMsg = getErrorMessage(err, 'Failed to save settings');
      setError(errorMsg);
    }
  };

  // User Management Functions
  const fetchUserDetails = async (userId) => {
    try {
      const response = await axios.get(`${API}/platform/users/${userId}`);
      setUserDetails(response.data);
      setShowUserDetailsModal(true);
    } catch (err) {
      setError('Failed to fetch user details');
    }
  };

  const handleUpdateUserRole = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/platform/users/${selectedUser.id}/update-role`, {
        tenant_id: editRoleData.tenantId,
        new_role: editRoleData.newRole,
        admin_password: editRoleData.adminPassword
      });
      setSuccess(`Role updated to ${editRoleData.newRole}`);
      setShowEditRoleModal(false);
      setEditRoleData({ tenantId: '', tenantName: '', currentRole: '', newRole: '', adminPassword: '' });
      // Refresh user details
      fetchUserDetails(selectedUser.id);
      fetchData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update role'));
    }
  };

  const handleRemoveUserFromTenant = async (e) => {
    e.preventDefault();
    try {
      await axios.delete(`${API}/platform/users/${selectedUser.id}/remove-from-tenant/${removeFromTenantData.tenantId}?admin_password=${encodeURIComponent(removeFromTenantData.adminPassword)}`);
      setSuccess(`User removed from ${removeFromTenantData.tenantName}`);
      setShowRemoveFromTenantModal(false);
      setRemoveFromTenantData({ tenantId: '', tenantName: '', adminPassword: '' });
      // Refresh user details
      fetchUserDetails(selectedUser.id);
      fetchData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove user from tenant'));
    }
  };

  const handleAddUserToTenant = async (e) => {
    e.preventDefault();
    try {
      // Use the existing create user endpoint but with existing user
      await axios.post(`${API}/platform/users/${selectedUser.id}/add-to-tenant`, {
        tenant_id: addToTenantData.tenantId,
        role: addToTenantData.role,
        admin_password: addToTenantData.adminPassword
      });
      setSuccess('User added to tenant');
      setShowAddToTenantModal(false);
      setAddToTenantData({ tenantId: '', role: 'staff', adminPassword: '' });
      fetchUserDetails(selectedUser.id);
      fetchData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add user to tenant'));
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    try {
      setError('');
      
      // Validate email if provided
      if (newTenant.master_admin_email) {
        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
        if (!emailRegex.test(newTenant.master_admin_email)) {
          setError('Please enter a valid email address (e.g., name@domain.com)');
          return;
        }
      }
      
      const response = await axios.post(`${API}/platform/tenants`, newTenant);
      // Store the result to show credentials
      setCreatedTenantResult(response.data);
      setShowCreateForm(false);
      setNewTenant({ name: '', slug: '', plan: 'starter', master_admin_email: '', master_admin_name: '' });
      fetchData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create tenant'));
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
      setError(getErrorMessage(err, 'Failed to suspend tenant'));
    }
  };

  const handleReactivateTenant = async (tenantId) => {
    try {
      await axios.post(`${API}/platform/tenants/${tenantId}/reactivate`);
      setSuccess('Tenant reactivated successfully');
      fetchData();
      setSelectedTenant(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reactivate tenant'));
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

  const handleDeleteUser = async () => {
    if (!deleteUserData.userId || !deleteUserData.adminPassword) return;
    
    try {
      await axios.delete(`${API}/platform/users/${deleteUserData.userId}`, {
        data: { admin_password: deleteUserData.adminPassword }
      });
      setSuccess(`User "${deleteUserData.userEmail}" deleted successfully`);
      setShowDeleteUserModal(false);
      setDeleteUserData({ userId: '', userEmail: '', adminPassword: '' });
      fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.detail;
      setError(typeof errorMsg === 'string' ? errorMsg : 'Failed to delete user');
    }
  };

  const handleChangeUserRole = async () => {
    if (!changeRoleData.userId || !changeRoleData.newRole || !changeRoleData.adminPassword) return;
    
    try {
      await axios.put(`${API}/platform/users/${changeRoleData.userId}/change-role`, {
        tenant_id: changeRoleData.tenantId,
        new_role: changeRoleData.newRole,
        admin_password: changeRoleData.adminPassword
      });
      setSuccess(`Role changed to "${changeRoleData.newRole}" for ${changeRoleData.userEmail}`);
      setShowChangeRoleModal(false);
      setChangeRoleData({ userId: '', userEmail: '', currentRole: '', newRole: '', tenantId: '', tenantName: '', adminPassword: '' });
      fetchData();
      // Refresh user details if viewing
      if (userDetails && userDetails.user?.id === changeRoleData.userId) {
        fetchUserDetails(changeRoleData.userId);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail;
      setError(typeof errorMsg === 'string' ? errorMsg : 'Failed to change user role');
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
      setError(getErrorMessage(err, 'Failed to impersonate tenant'));
    }
  };

  const handleStopImpersonation = async () => {
    try {
      await stopImpersonation();
      setSuccess('Impersonation ended');
      fetchData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to stop impersonation'));
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
      setError(getErrorMessage(err, 'Failed to create user'));
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
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white rounded-lg px-2 py-1">
                <img 
                  src="/quick-wing-logo.png" 
                  alt="Quick Wing" 
                  className="h-12 w-auto object-contain"
                />
              </div>
              <div className="border-l border-slate-600 pl-4">
                <h1 className="text-lg font-bold tracking-tight">Franchise Command Centre</h1>
                <p className="text-slate-400 text-xs">Platform Administration</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchData}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
              >
                <RefreshCw size={14} />
                <span>Refresh</span>
              </button>
              <div className="flex items-center space-x-2 pl-3 border-l border-slate-600">
                <span className="text-xs text-slate-300">{user?.email}</span>
                <span className="px-2 py-1 bg-emerald-600 rounded-full text-xs font-medium">
                  {isSuperAdmin() ? 'Super Admin' : 'Master Admin'}
                </span>
              </div>
              <button
                onClick={logout}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
                data-testid="logout-button"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          {/* Main Tabs */}
          <div className="flex space-x-1 py-2">
            {[
              { id: 'overview', label: 'Dashboard', sublabel: 'Platform Overview', icon: Activity },
              { id: 'tenants', label: 'Franchises', sublabel: 'Manage Tenants', icon: Building2 },
              { id: 'users', label: 'Team', sublabel: 'User Management', icon: Users },
              { id: 'plans', label: 'Subscriptions', sublabel: 'Plans & Features', icon: Layers },
              { id: 'reports', label: 'Finance', sublabel: 'Reports & Billing', icon: Receipt },
              { id: 'audit', label: 'Activity', sublabel: 'Audit Log', icon: FileText }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <div className="flex items-center space-x-2">
                  <tab.icon size={18} />
                  <span className="font-semibold">{tab.label}</span>
                </div>
                <span className={`text-xs mt-0.5 ${activeTab === tab.id ? 'text-blue-100' : 'text-gray-400'}`}>
                  {tab.sublabel}
                </span>
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
            {/* Header with Sub-tabs */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setTenantsSubTab('franchises')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tenantsSubTab === 'franchises' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Building2 size={16} className="inline mr-2" />
                  Franchises
                </button>
                <button
                  onClick={() => setTenantsSubTab('admins')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tenantsSubTab === 'admins' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Crown size={16} className="inline mr-2" />
                  Admins
                </button>
              </div>
              {tenantsSubTab === 'franchises' && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={18} />
                  <span>Create Tenant</span>
                </button>
              )}
            </div>

            {/* Franchises Sub-Tab */}
            {tenantsSubTab === 'franchises' && (
              <>
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
                  
                  {/* Plan Selection */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Select Plan</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {planConfigs.map(plan => (
                        <div
                          key={plan.id}
                          onClick={() => setNewTenant({ ...newTenant, plan: plan.id })}
                          className={`relative cursor-pointer rounded-xl p-4 border-2 transition-all ${
                            newTenant.plan === plan.id 
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {plan.is_popular && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                              <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                MOST POPULAR
                              </span>
                            </div>
                          )}
                          <div className="text-center">
                            <h5 className="font-bold text-gray-900">{plan.name}</h5>
                            <div className="mt-2">
                              <span className="text-3xl font-bold text-blue-600">€{plan.price}</span>
                              <span className="text-gray-500">/month</span>
                            </div>
                            <div className="mt-3 text-sm text-gray-600 space-y-1">
                              <p>Up to <strong>{plan.max_vehicles}</strong> vehicles</p>
                              <p>Up to <strong>{plan.max_users}</strong> users</p>
                              <p><strong>{plan.customizations_per_month}</strong> customization{plan.customizations_per_month > 1 ? 's' : ''}/month</p>
                            </div>
                            <p className="mt-3 text-xs text-gray-500">{plan.tagline}</p>
                          </div>
                          {newTenant.plan === plan.id && (
                            <div className="absolute top-2 right-2">
                              <Check size={20} className="text-blue-600" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Custom Limits Override */}
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Custom Limits (Optional)</h5>
                      <p className="text-xs text-gray-500 mb-3">Override plan limits for this franchise. Leave empty to use plan defaults.</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Max Vehicles</label>
                          <input
                            type="number"
                            min="1"
                            value={newTenant.custom_max_vehicles || ''}
                            onChange={(e) => setNewTenant({ ...newTenant, custom_max_vehicles: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder={`Plan default: ${planConfigs.find(p => p.id === newTenant.plan)?.max_vehicles || 10}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Max Users</label>
                          <input
                            type="number"
                            min="1"
                            value={newTenant.custom_max_users || ''}
                            onChange={(e) => setNewTenant({ ...newTenant, custom_max_users: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder={`Plan default: ${planConfigs.find(p => p.id === newTenant.plan)?.max_users || 20}`}
                          />
                        </div>
                      </div>
                    </div>
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
                          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                          title="Please enter a valid email address (e.g., name@domain.com)"
                          data-testid="master-admin-email-input"
                        />
                        <p className="text-xs text-gray-400 mt-1">Leave empty to auto-generate: admin.{newTenant.slug || 'slug'}@quickwing.com</p>
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

            {/* Tenants Grid - Card Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenants.map(tenant => {
                const baseUrl = window.location.origin;
                const franchiseUrl = `${baseUrl}/${tenant.slug}`;
                const staffLoginUrl = `${baseUrl}/${tenant.slug}/login`;
                
                return (
                  <div key={tenant.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
                    {/* Card Header */}
                    <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                            <Building2 size={24} className="text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{tenant.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(tenant.status)}`}>
                              {tenant.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500 block">Plan</span>
                          <span className="text-sm font-medium text-gray-700 capitalize">{tenant.plan}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Body - URLs and Credentials */}
                    <div className="p-4 space-y-3">
                      {/* Franchise URL */}
                      <div>
                        <label className="text-xs font-medium text-gray-500 flex items-center">
                          <Globe size={12} className="mr-1" /> Franchise URL
                        </label>
                        <div className="flex items-center mt-1 bg-gray-50 rounded-lg overflow-hidden">
                          <code className="flex-1 px-3 py-2 text-xs font-mono text-blue-700 truncate">
                            {franchiseUrl}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(franchiseUrl);
                              setSuccess('Franchise URL copied!');
                            }}
                            className="px-3 py-2 bg-blue-600 text-white text-xs hover:bg-blue-700"
                            title="Copy URL"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Staff Login URL */}
                      <div>
                        <label className="text-xs font-medium text-gray-500 flex items-center">
                          <Users size={12} className="mr-1" /> Staff Login URL
                        </label>
                        <div className="flex items-center mt-1 bg-gray-50 rounded-lg overflow-hidden">
                          <code className="flex-1 px-3 py-2 text-xs font-mono text-purple-700 truncate">
                            {staffLoginUrl}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(staffLoginUrl);
                              setSuccess('Staff login URL copied!');
                            }}
                            className="px-3 py-2 bg-purple-600 text-white text-xs hover:bg-purple-700"
                            title="Copy URL"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Master Admin Credentials */}
                      <div className="pt-2 border-t">
                        <label className="text-xs font-medium text-gray-500 flex items-center">
                          <Key size={12} className="mr-1" /> Master Admin Login
                        </label>
                        <div className="mt-1 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-xs">
                                <span className="text-gray-500">Email: </span>
                                <span className="font-mono font-medium text-gray-900">
                                  {tenant.master_admin_email || `admin.${tenant.slug}@quickwing.com`}
                                </span>
                              </p>
                              <p className="text-xs text-gray-500">
                                Password: <span className="italic">Set during creation</span>
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(tenant.master_admin_email || `admin.${tenant.slug}@quickwing.com`);
                                setSuccess('Admin email copied!');
                              }}
                              className="p-2 text-amber-700 hover:bg-amber-100 rounded"
                              title="Copy email"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Footer - Actions */}
                    <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Created {formatDate(tenant.created_at)}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => fetchTenantDetails(tenant.id)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleImpersonate(tenant.id)}
                          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                          title="Impersonate"
                        >
                          <Shield size={16} />
                        </button>
                        {tenant.status === 'active' ? (
                          <button
                            onClick={() => handleSuspendTenant(tenant.id)}
                            className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg"
                            title="Suspend"
                          >
                            <Pause size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivateTenant(tenant.id)}
                            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                            title="Reactivate"
                          >
                            <Play size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setTenantToDelete(tenant);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete Franchise"
                          data-testid={`delete-tenant-${tenant.id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
              
            {tenants.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm border">
                <Building2 size={40} className="mx-auto mb-3 opacity-50" />
                <p>No tenants yet. Create your first franchise!</p>
              </div>
            )}

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
              </>
            )}

            {/* Admins Sub-Tab */}
            {tenantsSubTab === 'admins' && (
              <div className="space-y-6">
                {/* Super Admin Card */}
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                        <Crown size={28} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">{user?.name || 'Super Admin'}</h3>
                        <p className="text-gray-600">{user?.email}</p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white mt-1">
                          Super Admin
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Platform Owner</p>
                      <p className="text-xs text-gray-400">Full system access</p>
                    </div>
                  </div>
                </div>

                {/* Master Admins List */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="p-4 border-b bg-gray-50">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <Users size={18} className="mr-2 text-blue-600" />
                      Franchise Master Admins
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Manage franchise owners and reset their passwords</p>
                  </div>
                  
                  <div className="divide-y">
                    {tenants.map(tenant => {
                      // Find master admin for this tenant
                      const masterAdmin = allUsers.find(u => 
                        u.memberships?.some(m => m.tenant_id === tenant.id && m.role === 'master_admin')
                      );
                      
                      return (
                        <div key={tenant.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Building2 size={24} className="text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{tenant.name}</h4>
                                {masterAdmin ? (
                                  <div className="text-sm text-gray-600">
                                    <span className="font-medium">{masterAdmin.name}</span>
                                    <span className="mx-2">•</span>
                                    <span>{masterAdmin.email}</span>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">No master admin assigned</p>
                                )}
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${getStatusColor(tenant.status)}`}>
                                  {tenant.status}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {masterAdmin && (
                                <>
                                  <button
                                    onClick={() => {
                                      setResetPasswordData({
                                        userId: masterAdmin.id,
                                        userEmail: masterAdmin.email,
                                        newPassword: '',
                                        adminPassword: ''
                                      });
                                      setShowResetPasswordModal(true);
                                    }}
                                    className="flex items-center space-x-1 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm font-medium"
                                    title="Reset Password"
                                  >
                                    <Key size={16} />
                                    <span>Reset Password</span>
                                  </button>
                                  <button
                                    onClick={() => fetchUserDetails(masterAdmin.id)}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                    title="View Details"
                                  >
                                    <Eye size={18} />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  setNewUser({ email: '', password: '', name: '', role: 'admin', tenant_id: tenant.id });
                                  setShowCreateUserForm(true);
                                }}
                                className="flex items-center space-x-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
                                title="Create Backup Admin"
                              >
                                <UserPlus size={16} />
                                <span>Add Admin</span>
                              </button>
                            </div>
                          </div>
                          
                          {/* Show other admins for this tenant */}
                          {(() => {
                            const otherAdmins = allUsers.filter(u => 
                              u.memberships?.some(m => m.tenant_id === tenant.id && m.role === 'admin') &&
                              u.id !== masterAdmin?.id
                            );
                            if (otherAdmins.length === 0) return null;
                            return (
                              <div className="mt-3 ml-16 pl-4 border-l-2 border-gray-200">
                                <p className="text-xs text-gray-500 mb-2">Additional Admins:</p>
                                {otherAdmins.map(admin => (
                                  <div key={admin.id} className="flex items-center justify-between py-1">
                                    <div className="flex items-center space-x-2">
                                      <Shield size={14} className="text-gray-400" />
                                      <span className="text-sm text-gray-700">{admin.name}</span>
                                      <span className="text-xs text-gray-500">({admin.email})</span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setResetPasswordData({
                                          userId: admin.id,
                                          userEmail: admin.email,
                                          newPassword: '',
                                          adminPassword: ''
                                        });
                                        setShowResetPasswordModal(true);
                                      }}
                                      className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                                      title="Reset Password"
                                    >
                                      <Key size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                    
                    {tenants.length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        <Building2 size={40} className="mx-auto mb-3 opacity-50" />
                        <p>No franchises created yet</p>
                      </div>
                    )}
                  </div>
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
                  {allUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {u.name?.charAt(0) || u.email?.charAt(0)}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{u.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {u.tenant_count || 0} tenant(s)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          u.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {u.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              fetchUserDetails(u.id);
                            }}
                            className="flex items-center space-x-1 px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                            title="View Details"
                            data-testid={`view-user-${u.id}`}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setResetPasswordData({
                                userId: u.id,
                                userEmail: u.email,
                                newPassword: '',
                                adminPassword: ''
                              });
                              setShowResetPasswordModal(true);
                            }}
                            className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                            title="Reset Password"
                            data-testid={`reset-pwd-${u.id}`}
                          >
                            <Key size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteUserData({
                                userId: u.id,
                                userEmail: u.email,
                                adminPassword: ''
                              });
                              setShowDeleteUserModal(true);
                            }}
                            className="flex items-center space-x-1 px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                            title="Delete User"
                            data-testid={`delete-user-${u.id}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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

            {/* User Details Modal */}
            {showUserDetailsModal && userDetails && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold">User Details</h3>
                    <button onClick={() => { setShowUserDetailsModal(false); setUserDetails(null); setSelectedUser(null); }} className="text-gray-500">
                      <XCircle size={20} />
                    </button>
                  </div>
                  <div className="p-4 space-y-6">
                    {/* User Info */}
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-2xl">
                          {userDetails.user?.name?.charAt(0) || userDetails.user?.email?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">{userDetails.user?.name || 'N/A'}</h4>
                        <p className="text-gray-600">{userDetails.user?.email}</p>
                        <p className="text-sm text-gray-500">Created: {userDetails.user?.created_at?.split('T')[0]}</p>
                      </div>
                    </div>

                    {/* Memberships */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-gray-900">Tenant Memberships</h5>
                        <button
                          onClick={() => setShowAddToTenantModal(true)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                          data-testid="add-to-tenant-btn"
                        >
                          <UserPlus size={14} />
                          <span>Add to Tenant</span>
                        </button>
                      </div>
                      
                      {userDetails.memberships?.length === 0 ? (
                        <p className="text-gray-500 text-sm">No tenant memberships</p>
                      ) : (
                        <div className="space-y-2">
                          {userDetails.memberships?.map((m, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium text-gray-900">{m.tenant_name}</p>
                                <p className="text-sm text-gray-500">{m.tenant_slug}</p>
                              </div>
                              <div className="flex items-center space-x-3">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  m.role === 'master_admin' ? 'bg-purple-100 text-purple-700' :
                                  m.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                  m.role === 'super_admin' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {m.role}
                                </span>
                                {m.tenant_id && (
                                  <div className="flex items-center space-x-1">
                                    <button
                                      onClick={() => {
                                        setChangeRoleData({
                                          userId: userDetails.user.id,
                                          userEmail: userDetails.user.email,
                                          tenantId: m.tenant_id,
                                          tenantName: m.tenant_name,
                                          currentRole: m.role,
                                          newRole: '',
                                          adminPassword: ''
                                        });
                                        setShowChangeRoleModal(true);
                                      }}
                                      className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                                      title="Change Role"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRemoveFromTenantData({
                                          tenantId: m.tenant_id,
                                          tenantName: m.tenant_name,
                                          adminPassword: ''
                                        });
                                        setShowRemoveFromTenantModal(true);
                                      }}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                      title="Remove from Tenant"
                                    >
                                      <UserMinus size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Role Modal */}
            {showEditRoleModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl w-full max-w-md">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold">Edit User Role</h3>
                    <button onClick={() => setShowEditRoleModal(false)} className="text-gray-500">
                      <XCircle size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleUpdateUserRole} className="p-4 space-y-4">
                    <p className="text-sm text-gray-600">
                      Changing role for <strong>{selectedUser?.email}</strong> in <strong>{editRoleData.tenantName}</strong>
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Role</label>
                      <p className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">{editRoleData.currentRole}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Role *</label>
                      <select
                        value={editRoleData.newRole}
                        onChange={(e) => setEditRoleData({...editRoleData, newRole: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        required
                      >
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                        <option value="master_admin">Master Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your Password *</label>
                      <input
                        type="password"
                        value={editRoleData.adminPassword}
                        onChange={(e) => setEditRoleData({...editRoleData, adminPassword: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="Confirm with your password"
                        required
                      />
                    </div>
                    <div className="flex space-x-3 pt-2">
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                        Update Role
                      </button>
                      <button type="button" onClick={() => setShowEditRoleModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg hover:bg-gray-200">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Remove from Tenant Modal */}
            {showRemoveFromTenantModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl w-full max-w-md">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold text-red-600">Remove User from Tenant</h3>
                    <button onClick={() => setShowRemoveFromTenantModal(false)} className="text-gray-500">
                      <XCircle size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleRemoveUserFromTenant} className="p-4 space-y-4">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">
                        You are about to remove <strong>{selectedUser?.email}</strong> from <strong>{removeFromTenantData.tenantName}</strong>.
                        They will lose all access to this tenant.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your Password *</label>
                      <input
                        type="password"
                        value={removeFromTenantData.adminPassword}
                        onChange={(e) => setRemoveFromTenantData({...removeFromTenantData, adminPassword: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="Confirm with your password"
                        required
                      />
                    </div>
                    <div className="flex space-x-3 pt-2">
                      <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                        Remove User
                      </button>
                      <button type="button" onClick={() => setShowRemoveFromTenantModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg hover:bg-gray-200">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Add to Tenant Modal */}
            {showAddToTenantModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl w-full max-w-md">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold">Add User to Tenant</h3>
                    <button onClick={() => setShowAddToTenantModal(false)} className="text-gray-500">
                      <XCircle size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleAddUserToTenant} className="p-4 space-y-4">
                    <p className="text-sm text-gray-600">
                      Adding <strong>{selectedUser?.email}</strong> to a new tenant
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tenant *</label>
                      <select
                        value={addToTenantData.tenantId}
                        onChange={(e) => setAddToTenantData({...addToTenantData, tenantId: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        required
                      >
                        <option value="">Select tenant</option>
                        {tenants.filter(t => !userDetails?.memberships?.some(m => m.tenant_id === t.id)).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                      <select
                        value={addToTenantData.role}
                        onChange={(e) => setAddToTenantData({...addToTenantData, role: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        required
                      >
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                        <option value="master_admin">Master Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your Password *</label>
                      <input
                        type="password"
                        value={addToTenantData.adminPassword}
                        onChange={(e) => setAddToTenantData({...addToTenantData, adminPassword: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="Confirm with your password"
                        required
                      />
                    </div>
                    <div className="flex space-x-3 pt-2">
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                        Add to Tenant
                      </button>
                      <button type="button" onClick={() => setShowAddToTenantModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg hover:bg-gray-200">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports & Billing Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex space-x-2 border-b pb-3">
              {[
                { id: 'executive', label: 'Executive Summary' },
                { id: 'franchises', label: 'Franchises Report' },
                { id: 'invoices', label: 'Invoices' },
                { id: 'settings', label: 'Company Settings' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setReportsTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    reportsTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  data-testid={`reports-tab-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Executive Summary */}
            {reportsTab === 'executive' && executiveSummary && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Executive Summary</h2>
                  <button
                    onClick={() => downloadPdf('/platform/reports/executive-summary/pdf', 'executive_summary.pdf')}
                    disabled={downloadingPdf}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    data-testid="export-executive-pdf-btn"
                  >
                    <Download size={18} />
                    <span>{downloadingPdf ? 'Downloading...' : 'Export PDF'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <p className="text-sm text-gray-500">Total Franchises</p>
                    <p className="text-2xl font-bold text-gray-900">{executiveSummary.summary?.tenants?.total || 0}</p>
                    <p className="text-xs text-green-600">{executiveSummary.summary?.tenants?.active || 0} active</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <p className="text-sm text-gray-500">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{executiveSummary.summary?.users || 0}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <p className="text-sm text-gray-500">Revenue Collected</p>
                    <p className="text-2xl font-bold text-green-600">€{executiveSummary.summary?.revenue?.total_collected || 0}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <p className="text-sm text-gray-500">Pending Revenue</p>
                    <p className="text-2xl font-bold text-orange-600">€{executiveSummary.summary?.revenue?.pending || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Franchises Report */}
            {reportsTab === 'franchises' && franchisesReport && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">All Franchises ({franchisesReport.total})</h3>
                  <button
                    onClick={() => downloadPdf('/platform/reports/franchises/pdf', 'franchises_report.pdf')}
                    disabled={downloadingPdf}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                    data-testid="export-franchises-pdf-btn"
                  >
                    <Download size={16} />
                    <span>{downloadingPdf ? 'Downloading...' : 'Export PDF'}</span>
                  </button>
                </div>
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicles</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Billed</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {franchisesReport.franchises?.map(f => (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{f.name}</p>
                            <p className="text-xs text-gray-500">{f.slug}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(f.status)}`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{f.stats?.users || 0}</td>
                          <td className="px-4 py-3 text-sm">{f.stats?.vehicles || 0}</td>
                          <td className="px-4 py-3 text-sm">€{f.stats?.total_billed || 0}</td>
                          <td className="px-4 py-3 text-sm text-green-600">€{f.stats?.total_paid || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Invoices */}
            {reportsTab === 'invoices' && (
              <div className="space-y-4">
                {/* Summary Cards */}
                {invoicesReport && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-sm text-gray-500">Total Invoiced</p>
                      <p className="text-2xl font-bold text-gray-900">€{invoicesReport.grand_total || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-sm text-gray-500">Paid</p>
                      <p className="text-2xl font-bold text-green-600">€{invoicesReport.by_status?.paid?.amount || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                      <p className="text-sm text-gray-500">Pending</p>
                      <p className="text-2xl font-bold text-orange-600">
                        €{(invoicesReport.by_status?.sent?.amount || 0) + (invoicesReport.by_status?.draft?.amount || 0)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">Invoices</h3>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => downloadPdf('/platform/reports/invoices/pdf', 'invoices_report.pdf')}
                      disabled={downloadingPdf}
                      className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      data-testid="export-invoices-report-pdf-btn"
                    >
                      <Download size={16} />
                      <span>{downloadingPdf ? 'Downloading...' : 'Export Report'}</span>
                    </button>
                    <button
                      onClick={() => setShowCreateInvoice(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      data-testid="create-invoice-btn"
                    >
                      <Plus size={18} />
                      <span>Create Invoice</span>
                    </button>
                  </div>
                </div>

                {/* Invoices Table */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoices.map(invoice => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{invoice.invoice_number}</td>
                          <td className="px-4 py-3 text-sm">{invoice.tenant_name}</td>
                          <td className="px-4 py-3 font-medium">€{invoice.total?.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                              invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                              invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{invoice.due_date}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => downloadPdf(`/platform/invoices/${invoice.id}/pdf`, `invoice_${invoice.invoice_number}.pdf`)}
                                disabled={downloadingPdf}
                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                                title="Download PDF"
                              >
                                <FileText size={16} />
                              </button>
                              {invoice.status === 'draft' && (
                                <button
                                  onClick={() => handleUpdateInvoiceStatus(invoice.id, 'sent')}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Send Invoice"
                                >
                                  <Send size={16} />
                                </button>
                              )}
                              {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                                <button
                                  onClick={() => handleUpdateInvoiceStatus(invoice.id, 'paid')}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                  title="Mark as Paid"
                                >
                                  <CheckCircle size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {invoices.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <Receipt size={40} className="mx-auto mb-3 opacity-50" />
                      <p>No invoices yet</p>
                    </div>
                  )}
                </div>

                {/* Create Invoice Modal */}
                {showCreateInvoice && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto">
                      <div className="p-4 border-b flex justify-between items-center">
                        <h3 className="text-lg font-bold">Create Invoice</h3>
                        <button onClick={() => setShowCreateInvoice(false)} className="text-gray-500">
                          <XCircle size={20} />
                        </button>
                      </div>
                      <form onSubmit={handleCreateInvoice} className="p-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Franchise *</label>
                          <select
                            value={newInvoice.tenant_id}
                            onChange={(e) => setNewInvoice({...newInvoice, tenant_id: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg"
                            required
                          >
                            <option value="">Select franchise</option>
                            {tenants.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                          <input
                            type="text"
                            value={newInvoice.items[0].description}
                            onChange={(e) => setNewInvoice({
                              ...newInvoice,
                              items: [{ ...newInvoice.items[0], description: e.target.value }]
                            })}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="e.g., Monthly Subscription"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (€) *</label>
                            <input
                              type="number"
                              step="0.01"
                              value={newInvoice.items[0].unit_price}
                              onChange={(e) => setNewInvoice({
                                ...newInvoice,
                                items: [{ ...newInvoice.items[0], unit_price: parseFloat(e.target.value) || 0 }]
                              })}
                              className="w-full px-3 py-2 border rounded-lg"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                            <input
                              type="number"
                              value={newInvoice.tax_rate}
                              onChange={(e) => setNewInvoice({...newInvoice, tax_rate: parseFloat(e.target.value) || 0})}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                          <input
                            type="date"
                            value={newInvoice.due_date}
                            onChange={(e) => setNewInvoice({...newInvoice, due_date: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                          <textarea
                            value={newInvoice.notes}
                            onChange={(e) => setNewInvoice({...newInvoice, notes: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg"
                            rows={2}
                          />
                        </div>
                        <div className="flex space-x-3 pt-2">
                          <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            Create Invoice
                          </button>
                          <button type="button" onClick={() => setShowCreateInvoice(false)} className="flex-1 bg-gray-100 py-2 rounded-lg hover:bg-gray-200">
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Company Settings */}
            {reportsTab === 'settings' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Company Settings</h3>
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  {editSettings ? (
                    <form onSubmit={handleSaveSettings} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                          <input
                            type="text"
                            value={settingsForm.company_name || ''}
                            onChange={(e) => setSettingsForm({...settingsForm, company_name: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                          <input
                            type="text"
                            value={settingsForm.tax_id || ''}
                            onChange={(e) => setSettingsForm({...settingsForm, tax_id: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                          <textarea
                            value={settingsForm.address || ''}
                            onChange={(e) => setSettingsForm({...settingsForm, address: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                          <input
                            type="text"
                            value={settingsForm.phone || ''}
                            onChange={(e) => setSettingsForm({...settingsForm, phone: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={settingsForm.email || ''}
                            onChange={(e) => setSettingsForm({...settingsForm, email: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="flex space-x-3 pt-4">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          Save Settings
                        </button>
                        <button type="button" onClick={() => setEditSettings(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Company Name</p>
                          <p className="font-medium">{companySettings?.company_name || 'Quick Wing Fleet Management'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Tax ID</p>
                          <p className="font-medium">{companySettings?.tax_id || 'Not set'}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="font-medium">{companySettings?.address || 'Not set'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <p className="font-medium">{companySettings?.phone || 'Not set'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="font-medium">{companySettings?.email || 'Not set'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditSettings(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mt-4"
                      >
                        <Edit2 size={16} />
                        <span>Edit Settings</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plans Tab */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            {/* Plan Comparison Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Subscription Plans</h2>
                <p className="text-sm text-gray-500">Compare plans and manage franchise subscriptions</p>
              </div>
            </div>

            {/* Plan Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {planConfigs.map((plan) => {
                const tierStyles = {
                  standard: {
                    border: 'border-blue-200',
                    header: 'bg-gradient-to-br from-blue-50 to-sky-100',
                    badge: 'bg-blue-500',
                    icon: '🚐',
                    accent: 'text-blue-700'
                  },
                  essential: {
                    border: 'border-sky-400 ring-2 ring-sky-100',
                    header: 'bg-gradient-to-br from-sky-600 via-cyan-600 to-sky-700',
                    badge: 'bg-gradient-to-r from-sky-500 to-cyan-500',
                    icon: '◆',
                    accent: 'text-white',
                    headerText: 'text-white'
                  },
                  professional: {
                    border: 'border-violet-400 ring-2 ring-violet-100',
                    header: 'bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-800',
                    badge: 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500',
                    icon: '♛',
                    accent: 'text-white',
                    headerText: 'text-white'
                  }
                };
                const style = tierStyles[plan.id] || tierStyles.standard;
                const isColoredHeader = plan.id === 'essential' || plan.id === 'professional';
                
                return (
                  <div 
                    key={plan.id}
                    className={`rounded-xl shadow-lg border-2 relative overflow-hidden transition-transform hover:scale-[1.02] ${style.border}`}
                  >
                    {/* Premium Header */}
                    <div className={`${style.header} p-6 text-center relative`}>
                      {plan.is_popular && (
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                          <span className={`${style.badge} text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center shadow-lg`}>
                            <Zap size={12} className="mr-1" /> Most Popular
                          </span>
                        </div>
                      )}
                      {plan.id === 'professional' && (
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                          <span className={`${style.badge} text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center shadow-lg`}>
                            <Crown size={12} className="mr-1" /> Enterprise
                          </span>
                        </div>
                      )}
                      
                      <div className={`text-4xl mb-2 mt-4 ${isColoredHeader ? 'drop-shadow-lg' : ''}`}>{style.icon}</div>
                      <h3 className={`text-xl font-bold ${isColoredHeader ? 'text-white' : style.accent}`}>{plan.name}</h3>
                      <div className="mt-3">
                        <span className={`text-4xl font-black ${isColoredHeader ? 'text-white' : style.accent}`}>€{plan.price}</span>
                        <span className={`text-sm ${isColoredHeader ? 'text-white/80' : 'text-gray-500'}`}>/month</span>
                      </div>
                      <p className={`text-sm mt-2 italic ${isColoredHeader ? 'text-white/90' : 'text-gray-600'}`}>{plan.tagline}</p>
                    </div>

                    {/* Plan Details */}
                    <div className="bg-white p-6">
                      {/* Limits Section - More Prominent */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="flex items-center justify-center mb-1">
                              <Car size={18} className={plan.id === 'standard' ? 'text-slate-600' : plan.id === 'essential' ? 'text-sky-600' : 'text-violet-600'} />
                            </div>
                            <p className={`text-2xl font-black ${plan.id === 'standard' ? 'text-slate-700' : plan.id === 'essential' ? 'text-sky-700' : 'text-violet-700'}`}>
                              {plan.max_vehicles}
                            </p>
                            <p className="text-xs text-gray-500 font-medium">Vehicles</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-center mb-1">
                              <Users size={18} className={plan.id === 'standard' ? 'text-slate-600' : plan.id === 'essential' ? 'text-sky-600' : 'text-violet-600'} />
                            </div>
                            <p className={`text-2xl font-black ${plan.id === 'standard' ? 'text-slate-700' : plan.id === 'essential' ? 'text-sky-700' : 'text-violet-700'}`}>
                              {plan.max_users}
                            </p>
                            <p className="text-xs text-gray-500 font-medium">Users</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-center mb-1">
                              <Zap size={18} className={plan.id === 'standard' ? 'text-slate-600' : plan.id === 'essential' ? 'text-sky-600' : 'text-violet-600'} />
                            </div>
                            <p className={`text-2xl font-black ${plan.id === 'standard' ? 'text-slate-700' : plan.id === 'essential' ? 'text-sky-700' : 'text-violet-700'}`}>
                              {plan.customizations_per_month}
                            </p>
                            <p className="text-xs text-gray-500 font-medium">Custom/mo</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className={`font-bold text-sm mb-3 ${style.accent}`}>Features Included</h4>
                        {Object.entries(plan.features)
                          .filter(([key, enabled]) => enabled)  // Only show enabled features
                          .filter(([key]) => !['multi_location_support', 'custom_branding'].includes(key))  // Hide these features
                          .map(([key, enabled]) => (
                          <div key={key} className="flex items-center text-sm py-1">
                            <CheckCircle size={16} className="text-green-500 mr-2 flex-shrink-0" />
                            <span className="text-gray-700">
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tenant Plan Management Section */}
            <div className="bg-white rounded-xl shadow-sm border p-6 mt-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Settings size={20} className="mr-2 text-blue-600" />
                Manage Franchise Plans & Features
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Click on a franchise to view and override plan features, or change their subscription plan.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tenants.map((tenant) => {
                  const planConfig = planConfigs.find(p => p.id === tenant.plan) || planConfigs[0];
                  const usageVehicles = tenant.vehicles_count || 0;
                  const usageUsers = tenant.users_count || 0;
                  const vehiclePercent = (usageVehicles / (tenant.max_vehicles || 10)) * 100;
                  const userPercent = (usageUsers / (tenant.max_users || 20)) * 100;
                  
                  return (
                    <div 
                      key={tenant.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        setFeatureModalTenant(tenant);
                        setFeatureEdits({});
                        setShowFeatureModal(true);
                      }}
                      data-testid={`plan-manage-${tenant.slug}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">{tenant.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          tenant.plan === 'professional' ? 'bg-purple-100 text-purple-700' :
                          tenant.plan === 'essential' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {planConfig?.name?.split(' ').pop() || 'Standard'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <div className="flex justify-between text-gray-600 mb-1">
                            <span>Vehicles</span>
                            <span>{usageVehicles}/{tenant.max_vehicles || 10}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                vehiclePercent >= 100 ? 'bg-red-500' :
                                vehiclePercent >= 80 ? 'bg-amber-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(vehiclePercent, 100)}%` }}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-gray-600 mb-1">
                            <span>Users</span>
                            <span>{usageUsers}/{tenant.max_users || 20}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                userPercent >= 100 ? 'bg-red-500' :
                                userPercent >= 80 ? 'bg-amber-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(userPercent, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t mt-2">
                          <span className="text-gray-500">Customizations</span>
                          <span className="font-medium">
                            {tenant.customizations_remaining ?? planConfig?.customizations_per_month ?? 1} / {planConfig?.customizations_per_month ?? 1}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Feature Override Modal */}
        {showFeatureModal && featureModalTenant && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{featureModalTenant.name}</h3>
                    <p className="text-sm text-gray-500">Manage plan and features</p>
                  </div>
                  <button 
                    onClick={() => setShowFeatureModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Change Plan Section */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Layers size={18} className="mr-2 text-blue-600" />
                    Subscription Plan
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {planConfigs.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={async () => {
                          if (plan.id === featureModalTenant.plan) return;
                          try {
                            await axios.put(`${API}/platform/tenants/${featureModalTenant.id}/plan`, null, {
                              params: { new_plan: plan.id }
                            });
                            toast.success(`Plan changed to ${plan.name}`);
                            fetchTenants();
                            setShowFeatureModal(false);
                          } catch (err) {
                            toast.error(getErrorMessage(err, 'Failed to change plan'));
                          }
                        }}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          plan.id === featureModalTenant.plan
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-semibold text-sm">{plan.name.split(' ').pop()}</div>
                        <div className="text-xs text-gray-500">€{plan.price}/mo</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customization Credits Section */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Zap size={18} className="mr-2 text-amber-500" />
                    Customization Credits
                  </h4>
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {featureModalTenant.customizations_remaining ?? 
                          (planConfigs.find(p => p.id === featureModalTenant.plan)?.customizations_per_month ?? 1)}
                      </p>
                      <p className="text-sm text-gray-500">
                        of {planConfigs.find(p => p.id === featureModalTenant.plan)?.customizations_per_month ?? 1} remaining
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={async () => {
                          try {
                            await axios.post(`${API}/platform/tenants/${featureModalTenant.id}/use-customization`, null, {
                              params: { description: 'Manual deduction' }
                            });
                            toast.success('Customization credit used');
                            fetchTenants();
                          } catch (err) {
                            toast.error(getErrorMessage(err, 'No credits remaining'));
                          }
                        }}
                        className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm font-medium"
                      >
                        Use Credit
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await axios.post(`${API}/platform/tenants/${featureModalTenant.id}/reset-customizations`);
                            toast.success('Credits reset to monthly limit');
                            fetchTenants();
                          } catch (err) {
                            toast.error(getErrorMessage(err, 'Failed to reset credits'));
                          }
                        }}
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
                      >
                        Reset Credits
                      </button>
                    </div>
                  </div>
                </div>

                {/* Limit Overrides Section */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Settings size={18} className="mr-2 text-gray-600" />
                    Limit Overrides
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Max Vehicles</label>
                      <input
                        type="number"
                        value={featureEdits.max_vehicles ?? featureModalTenant.max_vehicles ?? 10}
                        onChange={(e) => setFeatureEdits({...featureEdits, max_vehicles: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min={1}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Max Users</label>
                      <input
                        type="number"
                        value={featureEdits.max_users ?? featureModalTenant.max_users ?? 20}
                        onChange={(e) => setFeatureEdits({...featureEdits, max_users: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min={1}
                      />
                    </div>
                  </div>
                </div>

                {/* Feature Overrides Section */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <CheckCircle size={18} className="mr-2 text-green-600" />
                    Feature Overrides
                  </h4>
                  <p className="text-sm text-gray-500 mb-3">
                    Toggle features on/off to override the plan defaults for this franchise.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {planConfigs[0]?.features && Object.keys(planConfigs[0].features).map((featureKey) => {
                      const planDefault = planConfigs.find(p => p.id === featureModalTenant.plan)?.features?.[featureKey] ?? false;
                      const currentOverride = featureModalTenant.feature_overrides?.[featureKey];
                      const effectiveValue = featureEdits.features?.[featureKey] ?? currentOverride ?? planDefault;
                      const isOverridden = currentOverride !== undefined || featureEdits.features?.[featureKey] !== undefined;
                      
                      return (
                        <div 
                          key={featureKey}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isOverridden ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <span className="text-sm text-gray-700">
                            {featureKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          <button
                            onClick={() => {
                              const newFeatures = {...(featureEdits.features || {})};
                              newFeatures[featureKey] = !effectiveValue;
                              setFeatureEdits({...featureEdits, features: newFeatures});
                            }}
                            className={`w-12 h-6 rounded-full transition-colors ${
                              effectiveValue ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                              effectiveValue ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
                <button
                  onClick={() => setShowFeatureModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await axios.put(`${API}/platform/tenants/${featureModalTenant.id}/features`, featureEdits);
                      toast.success('Features and limits updated');
                      fetchTenants();
                      setShowFeatureModal(false);
                    } catch (err) {
                      toast.error(getErrorMessage(err, 'Failed to update features'));
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            {/* Header with Export */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Audit Log</h2>
              <button
                onClick={() => {
                  const params = auditLogTab === 'all' ? '' : 
                    auditLogTab === 'command-centre' ? '?filter_type=command-centre' :
                    `?tenant_id=${auditLogTab}&filter_type=${auditLogTab}`;
                  downloadPdf(`/platform/audit-log/pdf${params}`, `audit_log_${auditLogTab}.pdf`);
                }}
                disabled={downloadingPdf}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Download size={18} />
                <span>{downloadingPdf ? 'Generating...' : 'Export PDF'}</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="bg-white rounded-xl shadow-sm border p-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAuditLogTab('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    auditLogTab === 'all' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Activity size={14} className="inline mr-2" />
                  All Activity
                </button>
                <button
                  onClick={() => setAuditLogTab('command-centre')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    auditLogTab === 'command-centre' 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <Crown size={14} className="inline mr-2" />
                  Command Centre
                </button>
                {tenants.map(tenant => (
                  <button
                    key={tenant.id}
                    onClick={() => setAuditLogTab(tenant.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      auditLogTab === tenant.id 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    <Building2 size={14} className="inline mr-2" />
                    {tenant.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtered Log Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {auditLogTab === 'all' ? 'All Activity' : 
                     auditLogTab === 'command-centre' ? 'Command Centre Activity' :
                     tenants.find(t => t.id === auditLogTab)?.name + ' Activity'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {auditLogTab === 'command-centre' 
                      ? 'Platform-level administrative actions' 
                      : auditLogTab === 'all'
                      ? 'All system activity across franchises'
                      : 'Franchise-specific activity log'}
                  </p>
                </div>
                <span className="text-sm text-gray-500">
                  {(() => {
                    const filtered = auditLogTab === 'all' ? auditLogs :
                      auditLogTab === 'command-centre' ? auditLogs.filter(l => !l.tenant_id) :
                      auditLogs.filter(l => l.tenant_id === auditLogTab);
                    return `${filtered.length} events`;
                  })()}
                </span>
              </div>
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
                  {(() => {
                    const filteredLogs = auditLogTab === 'all' ? auditLogs :
                      auditLogTab === 'command-centre' ? auditLogs.filter(l => !l.tenant_id) :
                      auditLogs.filter(l => l.tenant_id === auditLogTab);
                    
                    return filteredLogs.map(log => (
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
                            log.action.includes('delete') ? 'bg-red-100 text-red-700' :
                            log.action.includes('create') ? 'bg-green-100 text-green-700' :
                            log.action.includes('impersonation') ? 'bg-purple-100 text-purple-700' :
                            log.action.includes('login') ? 'bg-blue-100 text-blue-700' :
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
                    ));
                  })()}
                </tbody>
              </table>
              
              {(() => {
                const filteredLogs = auditLogTab === 'all' ? auditLogs :
                  auditLogTab === 'command-centre' ? auditLogs.filter(l => !l.tenant_id) :
                  auditLogs.filter(l => l.tenant_id === auditLogTab);
                
                if (filteredLogs.length === 0) {
                  return (
                    <div className="p-8 text-center text-gray-500">
                      <FileText size={40} className="mx-auto mb-3 opacity-50" />
                      <p>No audit events recorded for this filter</p>
                    </div>
                  );
                }
                return null;
              })()}
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

      {/* Delete User Modal */}
      {showDeleteUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md w-full m-4 overflow-hidden">
            <div className="p-6 bg-red-50 border-b border-red-100">
              <div className="flex items-center space-x-3">
                <Trash2 size={24} className="text-red-600" />
                <h3 className="text-lg font-bold text-red-800">Delete User</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">You are about to permanently delete:</p>
                <p className="text-red-900 font-bold">{deleteUserData.userEmail}</p>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle size={20} className="text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-yellow-800 font-medium">Warning: This action cannot be undone!</p>
                    <p className="text-yellow-700 text-sm mt-1">The user will be removed from all franchises and their account will be deleted.</p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Master Admin Password</label>
                <input
                  type="password"
                  value={deleteUserData.adminPassword}
                  onChange={(e) => setDeleteUserData({ ...deleteUserData, adminPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Confirm with your password"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteUserModal(false);
                  setDeleteUserData({ userId: '', userEmail: '', adminPassword: '' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={!deleteUserData.adminPassword}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change User Role Modal */}
      {showChangeRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md w-full m-4 overflow-hidden">
            <div className="p-6 bg-purple-50 border-b border-purple-100">
              <div className="flex items-center space-x-3">
                <Shield size={24} className="text-purple-600" />
                <h3 className="text-lg font-bold text-purple-800">Change User Role</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-purple-100 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-800 font-medium">Changing role for:</p>
                <p className="text-purple-900 font-bold">{changeRoleData.userEmail}</p>
                {changeRoleData.tenantName && (
                  <p className="text-purple-700 text-sm mt-1">Franchise: {changeRoleData.tenantName}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Role</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 capitalize">
                  {changeRoleData.currentRole?.replace('_', ' ') || 'N/A'}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Role</label>
                <select
                  value={changeRoleData.newRole}
                  onChange={(e) => setChangeRoleData({ ...changeRoleData, newRole: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select new role</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="master_admin">Master Admin</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Master Admin Password</label>
                <input
                  type="password"
                  value={changeRoleData.adminPassword}
                  onChange={(e) => setChangeRoleData({ ...changeRoleData, adminPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Confirm with your password"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex space-x-3">
              <button
                onClick={() => {
                  setShowChangeRoleModal(false);
                  setChangeRoleData({ userId: '', userEmail: '', currentRole: '', newRole: '', tenantId: '', tenantName: '', adminPassword: '' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeUserRole}
                disabled={!changeRoleData.newRole || !changeRoleData.adminPassword || changeRoleData.newRole === changeRoleData.currentRole}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Change Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformAdmin;
