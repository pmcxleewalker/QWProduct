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
  Globe, Copy, Layers, Star, Zap, ArrowRight, Instagram,
  BarChart3, Headphones as HeadphonesIcon, MessageSquare,
  Database, HardDrive, CloudDownload, RotateCcw, AlertCircle, Scale,
  LogIn, Mail, ExternalLink, X
} from 'lucide-react';
import ContentWorker from '../components/ContentWorker';
import LegalRecordsSection from '../components/LegalRecordsSection';
import { useConfirm } from '../components/ConfirmDialog';
import { demoAPI } from '../api/api';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Compact row showing a URL with copy + open buttons. Used on the dashboard
// tenant cards.
const UrlRow = ({ icon: Icon, label, url, onCopy, onOpen }) => (
  <div className="flex items-center gap-2 group">
    <Icon size={13} className="text-slate-400 flex-shrink-0" />
    <div className="min-w-0 flex-1">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xs font-mono text-slate-700 truncate" title={url}>{url}</div>
    </div>
    <button
      onClick={onCopy}
      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md flex-shrink-0"
      title={`Copy ${label}`}
    >
      <Copy size={12} />
    </button>
    <button
      onClick={onOpen}
      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md flex-shrink-0"
      title={`Open ${label}`}
    >
      <ExternalLink size={12} />
    </button>
  </div>
);

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
  const confirm = useConfirm();
  
  const [activeTab, setActiveTab] = useState('overview');
  
  // Set default tab based on user role after user data is available
  useEffect(() => {
    if (user?.role === 'content_manager') {
      setActiveTab('content-worker');
    } else if (user?.role === 'bot') {
      setActiveTab('tenants');
    }
  }, [user]);
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
    plan: 'custom',
    master_admin_email: '', 
    master_admin_name: '',
    custom_max_vehicles: 10,
    custom_max_users: 15,
    custom_price: 199,
    is_demo: false,
    demo_link_expires_in_days: 30,
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
  const [featureRegistry, setFeatureRegistry] = useState(null);
  
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

  // Replace owner state — proper modal with a "send welcome email" checkbox
  const [replaceOwnerTenant, setReplaceOwnerTenant] = useState(null);
  const [replaceOwnerForm, setReplaceOwnerForm] = useState({
    email: '',
    name: '',
    displayName: '',
    password: 'QuickWing123!',
    adminPassword: '',
    sendWelcomeEmail: true,
    deleteOldOwnerUser: true,
    forcePasswordChange: true,
  });
  const [replaceOwnerSubmitting, setReplaceOwnerSubmitting] = useState(false);

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
    // Content managers don't need platform-wide data
    if (isPlatformAdmin() && user?.role !== 'content_manager') {
      fetchData();
    } else if (user?.role === 'content_manager') {
      // Content manager doesn't need to load platform data
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportsData();
    }
  }, [activeTab, reportsTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // For bot role, only fetch tenants and plans (what they need)
      if (user?.role === 'bot') {
        const [tenantsRes, plansRes] = await Promise.all([
          axios.get(`${API}/platform/tenants`),
          axios.get(`${API}/platform/plans`)
        ]);
        setTenants(tenantsRes.data.tenants || []);
        setPlanConfigs(plansRes.data.plans || []);
      } else {
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
      }
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
      
      const response = await axios.post(`${API}/platform/tenants`, {
        ...newTenant,
        master_admin_email: newTenant.master_admin_email || undefined,
        master_admin_name: newTenant.master_admin_name || undefined,
      });
      // Store the result to show credentials
      setCreatedTenantResult(response.data);
      setShowCreateForm(false);
      setNewTenant({ 
        name: '', 
        slug: '', 
        plan: 'custom', 
        master_admin_email: '', 
        master_admin_name: '',
        custom_max_vehicles: 10,
        custom_max_users: 15,
        custom_price: 199,
        is_demo: false,
        demo_link_expires_in_days: 30,
      });
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
    if (!await confirm({
      title: 'Sign in as this tenant?',
      description: 'You will assume their admin role for the session. Every action you take is logged in the audit trail.',
      confirmLabel: 'Sign in',
      tone: 'info',
    })) return;
    
    try {
      const tenant = await impersonateTenant(tenantId);
      setSuccess('Now impersonating tenant');
      // Redirect to tenant's dashboard using their slug
      window.location.href = `/${tenant.slug}`;
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

  const handleRenameTenant = async (tenant) => {
    const newName = window.prompt(
      `Rename tenant "${tenant.name}"?\n\n` +
      `Note: this only changes the display name. The URL slug (${tenant.slug}) and existing login URLs stay the same.\n\n` +
      `Enter the new tenant name:`,
      tenant.name
    );
    if (newName === null) return; // cancelled
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty');
      return;
    }
    if (trimmed === tenant.name) return; // no change
    try {
      await axios.put(`${API}/platform/tenants/${tenant.id}`, { name: trimmed });
      toast.success(`Renamed to "${trimmed}"`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to rename tenant');
    }
  };

  const handleReplaceOwner = (tenant) => {
    setReplaceOwnerTenant(tenant);
    setReplaceOwnerForm({
      email: '',
      name: '',
      displayName: '',
      password: 'QuickWing123!',
      adminPassword: '',
      sendWelcomeEmail: true,
      deleteOldOwnerUser: true,
      forcePasswordChange: true,
    });
  };

  const submitReplaceOwner = async () => {
    const tenant = replaceOwnerTenant;
    if (!tenant) return;
    const {
      email, name, displayName, password, adminPassword,
      sendWelcomeEmail, deleteOldOwnerUser, forcePasswordChange,
    } = replaceOwnerForm;
    const trimmedEmail = (email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error('Please enter a valid email');
      return;
    }
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!adminPassword) {
      toast.error('Please enter your super-admin password to confirm');
      return;
    }
    setReplaceOwnerSubmitting(true);
    try {
      const res = await axios.post(
        `${API}/platform/tenants/${tenant.id}/replace-master-admin`,
        {
          email: trimmedEmail,
          name: name?.trim() || undefined,
          display_name: (displayName || '').trim() || undefined,
          password,
          delete_old_owner_user: deleteOldOwnerUser,
          send_welcome_email: sendWelcomeEmail,
          force_password_change: forcePasswordChange,
          admin_password: adminPassword,
        }
      );
      const o = res.data?.new_owner;
      const removed = res.data?.removed?.deleted_user_emails || [];
      const emailStatus = res.data?.email || {};
      const emailLine = !sendWelcomeEmail
        ? '\u2139\uFE0F  Welcome email skipped (already sent manually).'
        : emailStatus.sent
          ? `\u2709\uFE0F  Welcome email sent to ${o?.email}`
          : emailStatus.error
            ? `\u26A0\uFE0F  Welcome email failed: ${emailStatus.error}`
            : '\u2139\uFE0F  Welcome email skipped.';
      toast.success(`Owner replaced for ${tenant.name}`);
      window.alert(
        `\u2705 New owner ready for ${tenant.name}\n\n` +
        `Email: ${o?.email}\n` +
        `Password: ${o?.password}\n` +
        `Login URL: ${o?.login_url}\n\n` +
        `${emailLine}\n` +
        (removed.length
          ? `Old owner removed: ${removed.join(', ')}`
          : 'Old owner detached from this tenant.')
      );
      setReplaceOwnerTenant(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to replace owner');
    } finally {
      setReplaceOwnerSubmitting(false);
    }
  };

  const handleResetTenantData = async (tenant) => {
    // Hard guard: typed-name + password confirm so this can't fire by accident.
    const typed = window.prompt(
      `\u26A0\uFE0F  Reset ALL data for "${tenant.name}"?\n\n` +
      `This will permanently delete:\n` +
      `  \u2022 every vehicle, booking and incident\n` +
      `  \u2022 every staff and admin account (master admin kept)\n` +
      `  \u2022 every custom document, mileage log, lift request and todo\n\n` +
      `The tenant, plan and branding are preserved so the client can log in to a blank slate.\n\n` +
      `To confirm, type the tenant name exactly:`
    );
    if (typed === null) return;
    if (typed.trim() !== tenant.name) {
      toast.error('Tenant name did not match \u2014 reset cancelled');
      return;
    }
    const password = window.prompt('Enter your super-admin password to proceed:');
    if (!password) return;
    try {
      const res = await axios.post(
        `${API}/platform/tenants/${tenant.id}/reset-data`,
        { password, confirm: true }
      );
      toast.success(res.data?.message || `${tenant.name} reset to blank slate`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset tenant data');
    }
  };

  const handleResetMasterAdmin = async (tenant) => {
    const newPassword = window.prompt(
      `Reset master admin password for ${tenant.name}?\n\n` +
      `Master admin email: ${tenant.master_admin_email || `admin.${tenant.slug}@quickwing.com`}\n\n` +
      `Enter new password (min 6 chars):`
    );
    if (!newPassword) return;
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await axios.post(`${API}/platform/tenants/${tenant.id}/reset-master-admin-password`, {
        new_password: newPassword,
      });
      toast.success(`Password reset for ${tenant.name}'s master admin`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
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

      {/* Header - Hide on mobile when Content Worker is active */}
      <div className={`bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white ${activeTab === 'content-worker' ? 'hidden md:block' : ''}`}>
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
                <h1 className="text-lg font-bold tracking-tight">Command Centre</h1>
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
                  {user?.role === 'super_admin' ? 'Super Admin' : 
                   user?.role === 'content_manager' ? 'Content Manager' :
                   user?.role === 'bot' ? 'Bot' : 'Master Admin'}
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

      {/* Navigation Tabs - Hide on mobile when Content Worker is active */}
      <div className={`bg-white border-b sticky top-0 z-10 ${activeTab === 'content-worker' ? 'hidden md:block' : ''}`}>
        <div className="max-w-7xl mx-auto px-4">
          {/* Main Tabs */}
          <div className="flex space-x-1 py-2 overflow-x-auto">
            {[
              { id: 'overview', label: 'Dashboard', sublabel: 'Platform Overview', icon: Activity, roles: ['super_admin', 'master_admin'] },
              { id: 'tenants', label: 'Clients', sublabel: 'Manage Clients', icon: Building2, roles: ['super_admin', 'master_admin', 'bot'] },
              { id: 'reports', label: 'Finance', sublabel: 'Reports & Billing', icon: Receipt, roles: ['super_admin', 'master_admin'] },
              { id: 'audit', label: 'Activity', sublabel: 'Audit Log', icon: FileText, roles: ['super_admin', 'master_admin'] },
              { id: 'backup', label: 'Backup', sublabel: 'Disaster Recovery', icon: Database, roles: ['super_admin', 'master_admin'] },
              { id: 'legal-records', label: 'Legal', sublabel: 'Legal Records', icon: Scale, roles: ['super_admin'] }
            ]
            .filter(tab => !tab.roles || tab.roles.includes(user?.role))
            .map(tab => (
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
      <div className={`max-w-7xl mx-auto ${activeTab === 'content-worker' ? 'px-0 py-0 md:px-4 md:py-6' : 'px-4 py-6'}`}>
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
        {activeTab === 'overview' && (
          <div className="space-y-6" data-testid="dashboard-overview">
            {/* Welcome strip */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-300 mb-1">
                    Tenant Command Centre
                  </p>
                  <h1 className="text-2xl font-bold">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
                  <p className="text-sm text-slate-300 mt-1">
                    {tenants.length} client{tenants.length === 1 ? '' : 's'} · signed in as <span className="font-mono">{user?.email || 'super admin'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setActiveTab('tenants'); setShowCreateForm(true); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-900 text-sm font-semibold rounded-lg hover:bg-slate-100"
                    data-testid="dashboard-new-client-btn"
                  >
                    <Plus size={15} />
                    New Client
                  </button>
                  <button
                    onClick={fetchData}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-white/30 text-white text-sm rounded-lg hover:bg-white/10"
                    title="Refresh"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tenant cards grid */}
            {tenants.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <Building2 size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600 font-medium mb-1">No clients yet</p>
                <p className="text-sm text-slate-500 mb-4">Create your first tenant to get started.</p>
                <button
                  onClick={() => { setActiveTab('tenants'); setShowCreateForm(true); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                >
                  <Plus size={15} /> Add a client
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {tenants.map((tenant) => {
                  const baseUrl = window.location.origin;
                  const tenantUrl = `${baseUrl}/${tenant.slug}`;
                  const loginUrl = `${baseUrl}/${tenant.slug}/login`;
                  const masterEmail = tenant.master_admin_email || `admin.${tenant.slug}@quickwing.com`;
                  const copy = (text, label) => {
                    navigator.clipboard.writeText(text);
                    toast.success(`${label} copied`);
                  };
                  return (
                    <div
                      key={tenant.id}
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
                      data-testid={`dashboard-tenant-card-${tenant.slug}`}
                    >
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg">
                            {(tenant.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-slate-900 truncate">{tenant.name}</h3>
                              <button
                                onClick={() => handleRenameTenant(tenant)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                                title="Rename tenant"
                                data-testid={`dashboard-rename-${tenant.slug}`}
                              >
                                <Edit2 size={12} />
                              </button>
                              <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${getStatusColor(tenant.status)}`}>
                                {tenant.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              <span className="font-mono">{tenant.slug}</span>
                              {tenant.plan && <> · <span className="capitalize">{tenant.plan}</span> plan</>}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleImpersonate(tenant.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 flex-shrink-0"
                          title="Sign in as super admin to this tenant"
                          data-testid={`dashboard-signin-${tenant.slug}`}
                        >
                          <LogIn size={13} />
                          Sign in
                        </button>
                      </div>

                      {/* URLs section */}
                      <div className="px-5 py-4 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Tenant URLs
                        </div>
                        <UrlRow
                          icon={Globe}
                          label="Tenant home"
                          url={tenantUrl}
                          onCopy={() => copy(tenantUrl, 'Tenant URL')}
                          onOpen={() => window.open(tenantUrl, '_blank')}
                        />
                        <UrlRow
                          icon={LogIn}
                          label="Login URL"
                          url={loginUrl}
                          onCopy={() => copy(loginUrl, 'Login URL')}
                          onOpen={() => window.open(loginUrl, '_blank')}
                        />
                      </div>

                      {/* Credentials section */}
                      <div className="px-5 pb-4 space-y-3">
                        {/* Super admin (you) */}
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                              Your access (super admin)
                            </span>
                          </div>
                          <p className="text-sm font-mono text-slate-800 truncate">
                            {user?.email || 'superadmin@quickwing.com'}
                          </p>
                          <p className="text-xs text-blue-600 mt-0.5">
                            Use the <strong>Sign in</strong> button above — your platform credentials work across every tenant.
                          </p>
                        </div>

                        {/* Master admin */}
                        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                              Master admin (client)
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-mono text-slate-800 truncate flex-1" title={masterEmail}>
                              {masterEmail}
                            </p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => copy(masterEmail, 'Master admin email')}
                                className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-md"
                                title="Copy email"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                onClick={() => handleResetMasterAdmin(tenant)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white text-xs font-medium rounded-md hover:bg-amber-700"
                                title="Reset master admin password"
                                data-testid={`dashboard-reset-master-${tenant.slug}`}
                              >
                                <Key size={11} />
                                Reset password
                              </button>
                              <button
                                onClick={() => handleReplaceOwner(tenant)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600 text-white text-xs font-medium rounded-md hover:bg-purple-700"
                                title="Replace the master admin (owner) of this client"
                                data-testid={`dashboard-replace-owner-${tenant.slug}`}
                              >
                                <UserPlus size={11} />
                                Replace owner
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Danger zone — reset to blank slate */}
                      <div className="px-5 pb-4">
                        <button
                          onClick={() => handleResetTenantData(tenant)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 hover:bg-rose-100"
                          title="Wipe all data for this client (cars, staff, bookings) and reset to a blank slate. Master admin is preserved."
                          data-testid={`dashboard-reset-data-${tenant.slug}`}
                        >
                          <RotateCcw size={12} />
                          Reset client data
                        </button>
                      </div>

                      {/* Footer */}
                      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          Created {formatDate(tenant.created_at)}
                        </span>
                        <button
                          onClick={() => { setActiveTab('tenants'); }}
                          className="text-blue-700 hover:underline font-medium inline-flex items-center gap-1"
                        >
                          Manage <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                  Clients
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

            {/* Clients Sub-Tab */}
            {tenantsSubTab === 'franchises' && (
              <>
            {/* Create Tenant Form */}
            {showCreateForm && (
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <h3 className="font-semibold text-gray-900 mb-4">Create New Client</h3>

                {/* Real / Demo toggle */}
                <div className="mb-5 flex gap-2 p-1 bg-gray-100 rounded-lg" data-testid="tenant-type-toggle">
                  <button
                    type="button"
                    onClick={() => setNewTenant({ ...newTenant, is_demo: false })}
                    data-testid="tenant-type-real"
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                      !newTenant.is_demo ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Real client
                    <span className="block text-[10px] font-normal text-gray-400 mt-0.5">
                      Full tenant with login credentials
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTenant({ ...newTenant, is_demo: true })}
                    data-testid="tenant-type-demo"
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                      newTenant.is_demo ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Demo (blank + magic link)
                    <span className="block text-[10px] font-normal text-gray-400 mt-0.5">
                      No password — access via a shareable URL
                    </span>
                  </button>
                </div>

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
                  
                  {/* Custom Plan Configuration */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Plan Configuration</h4>
                    <p className="text-xs text-gray-500 mb-4">Set the limits and price for this franchise's custom plan.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Number of Cars *</label>
                        <input
                          type="number"
                          min="1"
                          value={newTenant.custom_max_vehicles ?? ''}
                          onChange={(e) => setNewTenant({ ...newTenant, custom_max_vehicles: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. 25"
                          required
                          data-testid="tenant-vehicles-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Number of Staff *</label>
                        <input
                          type="number"
                          min="1"
                          value={newTenant.custom_max_users ?? ''}
                          onChange={(e) => setNewTenant({ ...newTenant, custom_max_users: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. 30"
                          required
                          data-testid="tenant-users-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Cost (€) *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={newTenant.custom_price ?? ''}
                            onChange={(e) => setNewTenant({ ...newTenant, custom_price: e.target.value ? parseFloat(e.target.value) : null })}
                            className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. 199"
                            required
                            data-testid="tenant-price-input"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">/ month</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Master Admin Section — hidden for demo tenants */}
                  {!newTenant.is_demo && (
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
                  )}

                  {/* Demo magic-link config — shown for demo tenants */}
                  {newTenant.is_demo && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-amber-900 mb-1 flex items-center gap-2">
                      <Zap size={16} className="text-amber-500" /> Magic link settings
                    </h4>
                    <p className="text-sm text-gray-500 mb-3">
                      A shareable URL is generated on submit. Anyone with the link enters this
                      blank tenant as a demo user — no signup, no password. Master admin
                      credentials are not created.
                    </p>
                    <div className="max-w-xs">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Link expires in</label>
                      <select
                        value={newTenant.demo_link_expires_in_days}
                        onChange={(e) => setNewTenant({ ...newTenant, demo_link_expires_in_days: parseInt(e.target.value, 10) })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                        data-testid="demo-expires-select"
                      >
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                      </select>
                    </div>
                  </div>
                  )}
                  
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className={`px-4 py-2 text-white rounded-lg ${newTenant.is_demo ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      data-testid="create-tenant-submit-btn"
                    >
                      {newTenant.is_demo ? 'Create Demo & Get Magic Link' : 'Create Franchise'}
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
                    <div className={`p-4 rounded-lg ${createdTenantResult.is_demo ? 'bg-amber-50' : 'bg-blue-50'}`}>
                      <p className={`text-sm font-medium mb-1 ${createdTenantResult.is_demo ? 'text-amber-700' : 'text-blue-600'}`}>
                        {createdTenantResult.is_demo ? 'Demo Client Name' : 'Franchise Name'}
                      </p>
                      <p className={`text-lg font-bold ${createdTenantResult.is_demo ? 'text-amber-900' : 'text-blue-900'}`}>
                        {createdTenantResult.tenant?.name}
                      </p>
                    </div>

                    {createdTenantResult.is_demo ? (
                      // Demo — show magic link, no credentials
                      <>
                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg" data-testid="demo-magic-link-panel">
                          <p className="text-sm text-emerald-800 font-semibold mb-2 flex items-center gap-1.5">
                            <Zap size={14} /> Magic link (share this with the prospect)
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 font-mono text-xs text-emerald-900 bg-white border border-emerald-200 px-2 py-1.5 rounded overflow-auto" data-testid="demo-magic-link-url">
                              {createdTenantResult.magic_link?.url}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(createdTenantResult.magic_link?.url || '');
                                setSuccess('Magic link copied to clipboard!');
                              }}
                              className="px-2 py-1.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700"
                              data-testid="demo-magic-link-copy"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="mt-2 text-xs text-emerald-700">
                            Expires {createdTenantResult.magic_link?.expires_at ? new Date(createdTenantResult.magic_link.expires_at).toLocaleDateString() : ''}.
                            No signup, no password. Anyone with the link enters a blank sandbox tenant.
                          </p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
                            <p className="text-sm text-amber-800">
                              This is a <b>blank demo tenant</b> — no cars, drivers or bookings.
                              The demo user has <b>no password</b>. Email + password login is disabled for this account.
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      // Real client — original credentials + login URL
                      <>
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
                      </>
                    )}
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
                const isDemo = !!tenant.is_demo;
                const magicLink = tenant.magic_link;

                const regenerateMagicLink = async () => {
                  if (!window.confirm(`Generate a new magic link for "${tenant.name}"? Any previous link stops working immediately.`)) return;
                  try {
                    const { data } = await demoAPI.regenerateForTenant(tenant.id, { expires_in_days: 30 });
                    try { await navigator.clipboard.writeText(data.url); } catch { /* clipboard unavailable */ }
                    setSuccess('New magic link generated and copied to clipboard');
                    fetchData();
                  } catch (e) {
                    setError(getErrorMessage(e, 'Could not regenerate magic link'));
                  }
                };

                return (
                  <div key={tenant.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${isDemo ? 'ring-1 ring-amber-200' : ''}`}>
                    {/* Card Header */}
                    <div className={`p-4 border-b ${isDemo ? 'bg-gradient-to-r from-amber-50 to-orange-50' : 'bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${isDemo ? 'bg-amber-500' : 'bg-blue-600'}`}>
                            {isDemo ? <Zap size={24} className="text-white" /> : <Building2 size={24} className="text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900">{tenant.name}</h3>
                              {isDemo && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-500 text-white" data-testid={`demo-badge-${tenant.id}`}>
                                  Demo
                                </span>
                              )}
                            </div>
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

                    {/* Card Body — Demo vs Real */}
                    {isDemo ? (
                      <div className="p-4 space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 flex items-center">
                            <Zap size={12} className="mr-1 text-amber-500" /> Magic link (no password, no signup)
                          </label>
                          {magicLink ? (
                            <>
                              <div className="flex items-center mt-1 bg-emerald-50 border border-emerald-200 rounded-lg overflow-hidden">
                                <code className="flex-1 px-3 py-2 text-xs font-mono text-emerald-900 truncate" data-testid={`tenant-magic-url-${tenant.id}`}>
                                  {magicLink.url}
                                </code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(magicLink.url);
                                    setSuccess('Magic link copied!');
                                  }}
                                  className="px-3 py-2 bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                                  title="Copy magic link"
                                  data-testid={`tenant-magic-copy-${tenant.id}`}
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-1.5">
                                Expires {magicLink.expires_at ? new Date(magicLink.expires_at).toLocaleDateString() : '—'} · used {magicLink.use_count || 0}×
                              </p>
                            </>
                          ) : (
                            <div className="mt-1 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                              No active magic link. Click <b>Regenerate</b> below to create one.
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t">
                          <button
                            onClick={regenerateMagicLink}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-200 rounded-lg"
                            data-testid={`tenant-magic-regenerate-${tenant.id}`}
                          >
                            <RefreshCw size={13} /> {magicLink ? 'Regenerate link' : 'Generate magic link'}
                          </button>
                          <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                            Master admin credentials do not apply — this tenant has no password login.
                          </p>
                        </div>
                      </div>
                    ) : (
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
                    )}
                    
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
                      // Find ALL master admins for this tenant (a tenant may
                      // have multiple co-owners).
                      const tenantMasterAdmins = allUsers.filter(u =>
                        u.memberships?.some(m => m.tenant_id === tenant.id && m.role === 'master_admin')
                      );
                      const masterAdmin = tenantMasterAdmins[0]; // primary, for legacy actions

                      return (
                        <div key={tenant.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Building2 size={24} className="text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{tenant.name}</h4>
                                {tenantMasterAdmins.length > 0 ? (
                                  <div className="text-sm text-gray-600 space-y-0.5">
                                    {tenantMasterAdmins.map((ma, idx) => (
                                      <div key={ma.id} className="flex items-center flex-wrap">
                                        <span className="font-medium">{ma.name}</span>
                                        <span className="mx-2">•</span>
                                        <span>{ma.email}</span>
                                        {tenantMasterAdmins.length > 1 && idx === 0 && (
                                          <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                            {tenantMasterAdmins.length} owners
                                          </span>
                                        )}
                                      </div>
                                    ))}
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
                            const masterAdminIds = new Set(tenantMasterAdmins.map(u => u.id));
                            const otherAdmins = allUsers.filter(u =>
                              u.memberships?.some(m => m.tenant_id === tenant.id && m.role === 'admin') &&
                              !masterAdminIds.has(u.id)
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
                  {(newUser.role === 'staff' || newUser.role === 'admin' || newUser.role === 'master_admin') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tenant {newUser.role === 'master_admin' && <span className="text-xs text-purple-600 font-normal">(owner of this client)</span>}
                      </label>
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
                      {newUser.role === 'master_admin' && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          The new master admin will be the workspace owner for the selected client.
                        </p>
                      )}
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

        {/* Vehicles Management Tab */}
        {activeTab === 'vehicles' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Vehicle Management</h2>
                  <p className="text-sm text-gray-500 mt-1">Manage fleet vehicles across all franchises</p>
                </div>
              </div>
              
              <div className="text-center py-12 text-gray-500">
                <Car size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Vehicle Management</p>
                <p className="text-sm mt-2">
                  To manage vehicles for a specific franchise, please select a franchise from the 
                  <button 
                    onClick={() => setActiveTab('tenants')} 
                    className="text-blue-600 hover:underline mx-1"
                  >
                    Franchises tab
                  </button>
                  and use the "Impersonate" feature to access their dashboard.
                </p>
                <p className="text-sm mt-4 text-gray-400">
                  Vehicle management is handled at the franchise level for proper data isolation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reports & Billing Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex space-x-2 border-b pb-3">
              {[
                { id: 'executive', label: 'Executive Summary' },
                { id: 'franchises', label: 'Clients Report' },
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
                    <p className="text-sm text-gray-500">Total Clients</p>
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

            {/* Clients Report */}
            {reportsTab === 'franchises' && franchisesReport && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">All Clients ({franchisesReport.total})</h3>
                  <button
                    onClick={() => downloadPdf('/platform/reports/franchises/pdf', 'clients_report.pdf')}
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
          <div className="space-y-8">
            {/* Plan Comparison Header */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Subscription Plans</h2>
              <p className="text-gray-500 mt-2">Choose the plan that fits your fleet management needs</p>
            </div>

            {/* Plan Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {planConfigs.map((plan) => {
                const tierStyles = {
                  standard: {
                    border: 'border-blue-200 hover:border-blue-300',
                    header: 'bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100',
                    badge: 'bg-blue-500',
                    icon: '🚐',
                    accent: 'text-blue-700',
                    accentBg: 'bg-blue-50',
                    checkColor: 'text-blue-500'
                  },
                  essential: {
                    border: 'border-sky-400 ring-2 ring-sky-200 shadow-sky-100',
                    header: 'bg-gradient-to-br from-sky-600 via-cyan-600 to-teal-600',
                    badge: 'bg-gradient-to-r from-sky-500 to-cyan-500',
                    icon: '✦',
                    accent: 'text-white',
                    accentBg: 'bg-sky-50',
                    checkColor: 'text-sky-500',
                    headerText: 'text-white'
                  },
                  professional: {
                    border: 'border-violet-400 ring-2 ring-violet-200 shadow-violet-100',
                    header: 'bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-700',
                    badge: 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500',
                    icon: '♛',
                    accent: 'text-white',
                    accentBg: 'bg-violet-50',
                    checkColor: 'text-violet-500',
                    headerText: 'text-white'
                  }
                };
                const style = tierStyles[plan.id] || tierStyles.standard;
                const isColoredHeader = plan.id === 'essential' || plan.id === 'professional';
                
                // Feature display names mapping
                const featureNames = {
                  vehicle_booking: 'Vehicle Booking',
                  fleet_compliance: 'Fleet Compliance',
                  basic_reports: 'Basic Reports',
                  staff_calendars: 'Staff Calendars',
                  admin_all_cars_calendar: 'Admin All Cars Calendar',
                  email_support: 'Email Support',
                  standard_onboarding: 'Standard Onboarding',
                  enhanced_reports: 'Enhanced Reports',
                  booking_visibility_enhanced: 'Booking Visibility Enhanced',
                  booking_admin_control: 'Booking Admin Control',
                  compliance_oversight_broad: 'Compliance Oversight Broad',
                  cost_analytics: 'Cost Analytics',
                  faster_support: 'Faster Support Response',
                  detailed_reports: 'Detailed Reporting Dashboard',
                  priority_support: 'Priority Support',
                  multi_site_oversight: 'Multi-Site / Franchise Oversight',
                  advanced_permissions: 'Advanced Permissions',
                  custom_exports: 'Custom Exports'
                };

                // Get features to display based on tier
                const getDisplayFeatures = () => {
                  if (plan.id === 'standard') {
                    return [
                      'vehicle_booking', 'fleet_compliance', 'basic_reports', 
                      'staff_calendars', 'admin_all_cars_calendar', 
                      'email_support', 'standard_onboarding'
                    ];
                  } else if (plan.id === 'essential') {
                    return [
                      { text: 'Everything in Standard', isHeader: true },
                      'enhanced_reports', 'booking_visibility_enhanced', 
                      'booking_admin_control', 'compliance_oversight_broad',
                      'cost_analytics', 'faster_support'
                    ];
                  } else {
                    return [
                      { text: 'Everything in Essential', isHeader: true },
                      'detailed_reports', 'priority_support', 
                      'multi_site_oversight', 'advanced_permissions',
                      'custom_exports',
                      { text: 'Greater Operational Visibility', isFeature: true }
                    ];
                  }
                };
                
                return (
                  <div 
                    key={plan.id}
                    className={`rounded-2xl shadow-lg border-2 relative overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col ${style.border} ${plan.is_popular ? 'md:-mt-4 md:mb-4' : ''}`}
                  >
                    {/* Badge */}
                    {plan.is_popular && (
                      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                        <span className={`${style.badge} text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center shadow-lg`}>
                          <Zap size={12} className="mr-1" /> Most Popular
                        </span>
                      </div>
                    )}
                    {plan.id === 'professional' && (
                      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                        <span className={`${style.badge} text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center shadow-lg`}>
                          <Crown size={12} className="mr-1" /> Enterprise
                        </span>
                      </div>
                    )}

                    {/* Header */}
                    <div className={`${style.header} p-6 pt-10 text-center`}>
                      <div className={`text-4xl mb-3 ${isColoredHeader ? 'drop-shadow-lg' : ''}`}>{style.icon}</div>
                      <h3 className={`text-xl font-bold ${isColoredHeader ? 'text-white' : style.accent}`}>{plan.name}</h3>
                      
                      {/* Price */}
                      <div className="mt-4">
                        <span className={`text-5xl font-black ${isColoredHeader ? 'text-white' : style.accent}`}>€{plan.price}</span>
                        <span className={`text-sm ${isColoredHeader ? 'text-white/80' : 'text-gray-500'}`}>/month</span>
                      </div>
                      
                      {/* Sub-label */}
                      <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        isColoredHeader ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {plan.sub_label || (plan.id === 'standard' ? 'Best for small teams' : plan.id === 'essential' ? 'Best value' : 'Best for multi-site operations')}
                      </div>
                      
                      {/* Tagline */}
                      <p className={`text-sm mt-3 ${isColoredHeader ? 'text-white/90' : 'text-gray-600'}`}>
                        {plan.tagline}
                      </p>
                    </div>

                    {/* Plan Details */}
                    <div className="bg-white p-6 flex-1 flex flex-col">
                      {/* Limits Section */}
                      <div className={`${style.accentBg} rounded-xl p-4 mb-6`}>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <Car size={20} className={plan.id === 'standard' ? 'text-blue-600 mx-auto mb-1' : plan.id === 'essential' ? 'text-sky-600 mx-auto mb-1' : 'text-violet-600 mx-auto mb-1'} />
                            <p className={`text-2xl font-black ${plan.id === 'standard' ? 'text-blue-700' : plan.id === 'essential' ? 'text-sky-700' : 'text-violet-700'}`}>
                              {plan.max_vehicles}
                            </p>
                            <p className="text-xs text-gray-600 font-medium">Vehicles</p>
                          </div>
                          <div>
                            <Users size={20} className={plan.id === 'standard' ? 'text-blue-600 mx-auto mb-1' : plan.id === 'essential' ? 'text-sky-600 mx-auto mb-1' : 'text-violet-600 mx-auto mb-1'} />
                            <p className={`text-2xl font-black ${plan.id === 'standard' ? 'text-blue-700' : plan.id === 'essential' ? 'text-sky-700' : 'text-violet-700'}`}>
                              {plan.max_users}
                            </p>
                            <p className="text-xs text-gray-600 font-medium">Users</p>
                          </div>
                          <div>
                            <Zap size={20} className={plan.id === 'standard' ? 'text-blue-600 mx-auto mb-1' : plan.id === 'essential' ? 'text-sky-600 mx-auto mb-1' : 'text-violet-600 mx-auto mb-1'} />
                            <p className={`text-2xl font-black ${plan.id === 'standard' ? 'text-blue-700' : plan.id === 'essential' ? 'text-sky-700' : 'text-violet-700'}`}>
                              {plan.customizations_per_month}
                            </p>
                            <p className="text-xs text-gray-600 font-medium leading-tight">Credit{plan.customizations_per_month > 1 ? 's' : ''}/mo</p>
                          </div>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="space-y-2.5 flex-1">
                        <h4 className={`font-bold text-sm mb-3 ${plan.id === 'standard' ? 'text-blue-700' : plan.id === 'essential' ? 'text-sky-700' : 'text-violet-700'}`}>
                          Features Included
                        </h4>
                        {getDisplayFeatures().map((feature, idx) => {
                          if (typeof feature === 'object' && feature.isHeader) {
                            return (
                              <div key={idx} className={`flex items-center text-sm py-1.5 font-semibold ${plan.id === 'essential' ? 'text-sky-700' : 'text-violet-700'}`}>
                                <ArrowRight size={14} className="mr-2 flex-shrink-0" />
                                <span>{feature.text}</span>
                              </div>
                            );
                          }
                          if (typeof feature === 'object' && feature.isFeature) {
                            return (
                              <div key={idx} className="flex items-center text-sm py-1">
                                <CheckCircle size={16} className={`${style.checkColor} mr-2 flex-shrink-0`} />
                                <span className="text-gray-700">{feature.text}</span>
                              </div>
                            );
                          }
                          return (
                            <div key={feature} className="flex items-center text-sm py-1">
                              <CheckCircle size={16} className={`${style.checkColor} mr-2 flex-shrink-0`} />
                              <span className="text-gray-700">{featureNames[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Customisation Credits Clarification */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center max-w-3xl mx-auto">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-700">Minor customisation credits</span> cover small changes such as layout tweaks, field additions, or report adjustments. They do not include major new feature development.
              </p>
            </div>

            {/* Feature Addon Pricing Section */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                <h3 className="text-xl font-bold flex items-center">
                  <Layers size={24} className="mr-3" />
                  Individual Feature Add-ons
                </h3>
                <p className="text-blue-100 mt-2 text-sm">
                  Upgrade any plan with individual features. Prices shown are monthly add-on costs.
                </p>
              </div>
              
              <div className="p-6">
                {featureRegistry ? (
                  <div className="space-y-6">
                    {Object.entries(featureRegistry.categories).map(([categoryKey, category]) => {
                      const sellableFeatures = category.features.filter(f => f.sellable && f.addon_price > 0);
                      if (sellableFeatures.length === 0) return null;
                      
                      return (
                        <div key={categoryKey}>
                          <h4 className="font-bold text-gray-900 mb-3 flex items-center">
                            {categoryKey === 'bookings' && <Calendar size={18} className="mr-2 text-blue-500" />}
                            {categoryKey === 'reports' && <BarChart3 size={18} className="mr-2 text-green-500" />}
                            {categoryKey === 'fleet' && <Car size={18} className="mr-2 text-amber-500" />}
                            {categoryKey === 'compliance' && <Shield size={18} className="mr-2 text-red-500" />}
                            {categoryKey === 'admin' && <Settings size={18} className="mr-2 text-purple-500" />}
                            {categoryKey === 'support' && <HeadphonesIcon size={18} className="mr-2 text-cyan-500" />}
                            {categoryKey === 'communication' && <MessageSquare size={18} className="mr-2 text-pink-500" />}
                            {categoryKey === 'integrations' && <Zap size={18} className="mr-2 text-orange-500" />}
                            {category.name}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {sellableFeatures.map(feature => (
                              <div 
                                key={feature.key}
                                className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="font-semibold text-gray-900 text-sm">{feature.name}</h5>
                                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">
                                    +€{feature.addon_price}/mo
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mb-3">{feature.description}</p>
                                <div className="flex items-center space-x-1 text-xs">
                                  <span className="text-gray-500">Included in:</span>
                                  {feature.default_plans.map(plan => (
                                    <span 
                                      key={plan}
                                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                        plan === 'professional' ? 'bg-purple-100 text-purple-700' :
                                        plan === 'essential' ? 'bg-sky-100 text-sky-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}
                                    >
                                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <button
                      onClick={async () => {
                        try {
                          const res = await axios.get(`${API}/platform/feature-registry`);
                          setFeatureRegistry(res.data);
                        } catch (err) {
                          console.error('Failed to load feature registry', err);
                        }
                      }}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center"
                    >
                      <Layers size={18} className="mr-2" />
                      Load Feature Pricing
                    </button>
                  </div>
                )}
                
                {/* Pricing Summary */}
                <div className="mt-6 pt-6 border-t">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h5 className="font-semibold text-blue-900 mb-2">How Add-on Pricing Works</h5>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Add-on prices are <strong>monthly</strong> and added to the base plan cost</li>
                      <li>• Features included in a plan don't incur additional charges</li>
                      <li>• Add-ons can be enabled/disabled per franchise in the management section below</li>
                      <li>• Upgrading to a higher plan often provides better value than multiple add-ons</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Tenant Plan Management Section */}
            <div className="bg-white rounded-xl shadow-sm border p-6 mt-4">
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
                      onClick={async () => {
                        setFeatureModalTenant(tenant);
                        setFeatureEdits({});
                        // Fetch feature registry if not already loaded
                        if (!featureRegistry) {
                          try {
                            const res = await axios.get(`${API}/platform/feature-registry`);
                            setFeatureRegistry(res.data);
                          } catch (err) {
                            console.error('Failed to load feature registry', err);
                          }
                        }
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
                            setShowFeatureModal(false);
                            fetchData();
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
                            fetchData();
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
                            fetchData();
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

                {/* Feature Overrides Section - Enhanced with Registry */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <CheckCircle size={18} className="mr-2 text-green-600" />
                    Feature Toggles
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Enable or disable features for this franchise. Overrides are highlighted in blue.
                  </p>
                  
                  {featureRegistry ? (
                    <div className="space-y-4">
                      {Object.entries(featureRegistry.categories).map(([categoryKey, category]) => (
                        category.features.length > 0 && (
                          <div key={categoryKey} className="border rounded-lg overflow-hidden">
                            <div className="bg-gray-100 px-4 py-2 font-medium text-gray-700 text-sm">
                              {category.name}
                            </div>
                            <div className="divide-y">
                              {category.features.map((feature) => {
                                const planDefault = feature.default_plans.includes(featureModalTenant.plan);
                                const currentOverride = featureModalTenant.feature_overrides?.[feature.key];
                                const editOverride = featureEdits.features?.[feature.key];
                                const effectiveValue = editOverride !== undefined 
                                  ? editOverride 
                                  : currentOverride !== undefined 
                                    ? currentOverride 
                                    : planDefault;
                                const isOverridden = currentOverride !== undefined || editOverride !== undefined;
                                
                                return (
                                  <div 
                                    key={feature.key}
                                    className={`flex items-center justify-between p-3 ${
                                      isOverridden ? 'bg-blue-50' : 'bg-white'
                                    }`}
                                  >
                                    <div className="flex-1 pr-4">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-medium text-gray-900 text-sm">
                                          {feature.name}
                                        </span>
                                        {feature.sellable && feature.addon_price > 0 && (
                                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                            +€{feature.addon_price}/mo addon
                                          </span>
                                        )}
                                        {!planDefault && (
                                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                                            Not in plan
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 mt-0.5">{feature.description}</p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const newFeatures = {...(featureEdits.features || {})};
                                        newFeatures[feature.key] = !effectiveValue;
                                        setFeatureEdits({...featureEdits, features: newFeatures});
                                      }}
                                      className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
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
                        )
                      ))}
                    </div>
                  ) : (
                    // Fallback to original display if registry not loaded
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
                  )}
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
                      setShowFeatureModal(false);
                      fetchData();
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

        {/* Content Worker Tab */}
        {activeTab === 'content-worker' && (
          <ContentWorker onBack={user?.role === 'content_manager' ? null : () => setActiveTab('overview')} />
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

        {/* Backup & Disaster Recovery Tab */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 text-white">
              <div className="flex items-center space-x-3 mb-2">
                <Database size={28} />
                <h2 className="text-2xl font-bold">Backup & Disaster Recovery</h2>
              </div>
              <p className="text-emerald-100">
                Protect your franchise data with regular backups. Download backup files and store them safely.
              </p>
            </div>

            {/* Warning Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-medium text-amber-800">Important: Store backups securely</p>
                <p className="text-sm text-amber-700 mt-1">
                  Downloaded backup files contain sensitive data. Store them in a secure location like encrypted cloud storage (Google Drive, Dropbox) or an offline hard drive.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Platform Backup */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <HardDrive className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Full Platform Backup</h3>
                    <p className="text-sm text-gray-500">All franchises, users & data</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Download a complete backup of your entire Quick Wing platform including all {tenants.length} franchises.
                </p>
                <button
                  onClick={async () => {
                    try {
                      toast.loading('Creating full platform backup...', { id: 'backup' });
                      const token = localStorage.getItem('token');
                      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/platform/backup/full`, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (!response.ok) throw new Error('Backup failed');
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `quickwing-full-backup-${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                      toast.success('Full backup downloaded!', { id: 'backup' });
                    } catch (err) {
                      toast.error('Failed to create backup', { id: 'backup' });
                    }
                  }}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <CloudDownload size={18} />
                  <span>Download Full Backup</span>
                </button>
              </div>

              {/* Individual Franchise Backup */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Building2 className="text-purple-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Franchise Backup</h3>
                    <p className="text-sm text-gray-500">Single franchise data</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Download backup for a specific franchise. Useful for restoring individual businesses.
                </p>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-sm"
                  id="backup-franchise-select"
                  defaultValue=""
                >
                  <option value="" disabled>Select a franchise...</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    const select = document.getElementById('backup-franchise-select');
                    const tenantId = select.value;
                    if (!tenantId) {
                      toast.error('Please select a franchise');
                      return;
                    }
                    const tenantName = tenants.find(t => t.id === tenantId)?.name || 'franchise';
                    try {
                      toast.loading(`Creating backup for ${tenantName}...`, { id: 'backup' });
                      const token = localStorage.getItem('token');
                      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/platform/backup/tenant/${tenantId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (!response.ok) throw new Error('Backup failed');
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `quickwing-${tenantName.replace(/\s+/g, '-').toLowerCase()}-backup-${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                      toast.success(`${tenantName} backup downloaded!`, { id: 'backup' });
                    } catch (err) {
                      toast.error('Failed to create backup', { id: 'backup' });
                    }
                  }}
                  className="w-full flex items-center justify-center space-x-2 bg-purple-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  <CloudDownload size={18} />
                  <span>Download Franchise Backup</span>
                </button>
              </div>
            </div>

            {/* Backup Schedule Recommendation */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <Clock size={20} className="text-gray-400" />
                <span>Recommended Backup Schedule</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <p className="font-medium text-green-800">Daily</p>
                  <p className="text-sm text-green-600 mt-1">Individual franchise backups for active businesses</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <p className="font-medium text-blue-800">Weekly</p>
                  <p className="text-sm text-blue-600 mt-1">Full platform backup every Sunday</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                  <p className="font-medium text-purple-800">Monthly</p>
                  <p className="text-sm text-purple-600 mt-1">Archive backup to offline storage</p>
                </div>
              </div>
            </div>

            {/* Restore Information */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
                <RotateCcw size={20} className="text-gray-400" />
                <span>Need to Restore Data?</span>
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                If you need to restore a franchise from a backup file, please contact support or use the API endpoint. 
                Restoration requires careful handling to avoid data conflicts.
              </p>
              <div className="bg-white rounded-lg p-4 border">
                <p className="text-xs font-mono text-gray-500">
                  POST /api/platform/backup/restore/tenant
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Upload backup JSON file to restore franchise data
                </p>
              </div>
            </div>

            {/* MongoDB Atlas Recommendation */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Database className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-green-900 mb-2">Upgrade to MongoDB Atlas for Automated Backups</h3>
                  <p className="text-sm text-green-700 mb-3">
                    For production-grade disaster recovery, we recommend migrating to MongoDB Atlas which provides:
                  </p>
                  <ul className="text-sm text-green-700 space-y-1 mb-4">
                    <li className="flex items-center space-x-2">
                      <CheckCircle size={14} className="text-green-600" />
                      <span>Automated backups every 6 hours</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle size={14} className="text-green-600" />
                      <span>Point-in-time recovery (restore to any second)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle size={14} className="text-green-600" />
                      <span>Multi-region replication for high availability</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle size={14} className="text-green-600" />
                      <span>99.995% uptime SLA</span>
                    </li>
                  </ul>
                  <a 
                    href="https://www.mongodb.com/atlas" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-green-700 hover:text-green-800 font-medium text-sm"
                  >
                    <span>Learn more about MongoDB Atlas</span>
                    <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legal Records Tab */}
        {activeTab === 'legal-records' && (
          <LegalRecordsSection
            token={localStorage.getItem('token') || sessionStorage.getItem('token')}
            isSuperAdmin={user?.role === 'super_admin'}
          />
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

      {/* Replace owner modal */}
      {replaceOwnerTenant && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !replaceOwnerSubmitting) {
              setReplaceOwnerTenant(null);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl"
            data-testid="replace-owner-modal"
          >
            <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-100">
                    Replace owner
                  </div>
                  <h2 className="text-lg font-bold mt-0.5">
                    {replaceOwnerTenant.name}
                  </h2>
                </div>
                <button
                  onClick={() => !replaceOwnerSubmitting && setReplaceOwnerTenant(null)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-purple-100 mt-1.5">
                Detaches the current owner ({replaceOwnerTenant.master_admin_email || 'unknown'}) and sets a new one in one atomic step.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New owner email</label>
                <input
                  type="email"
                  value={replaceOwnerForm.email}
                  onChange={(e) => setReplaceOwnerForm({ ...replaceOwnerForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  placeholder="owner@example.com"
                  data-testid="replace-owner-email"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full name</label>
                <input
                  type="text"
                  value={replaceOwnerForm.name}
                  onChange={(e) => setReplaceOwnerForm({ ...replaceOwnerForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  placeholder="Karen O'Sullivan"
                  data-testid="replace-owner-name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Greeting nickname <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={replaceOwnerForm.displayName}
                  onChange={(e) => setReplaceOwnerForm({ ...replaceOwnerForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  placeholder='e.g. "K"'
                  maxLength={30}
                  data-testid="replace-owner-display-name"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Shown in greetings on their dashboard (&ldquo;Good morning, K&rdquo;). Leave blank to use first name.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary password</label>
                <input
                  type="text"
                  value={replaceOwnerForm.password}
                  onChange={(e) => setReplaceOwnerForm({ ...replaceOwnerForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-mono"
                  data-testid="replace-owner-password"
                />
                <p className="text-[11px] text-slate-500 mt-1">They can change it after first login.</p>
              </div>

              <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={replaceOwnerForm.sendWelcomeEmail}
                  onChange={(e) => setReplaceOwnerForm({ ...replaceOwnerForm, sendWelcomeEmail: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  data-testid="replace-owner-send-email"
                />
                <div className="text-sm">
                  <div className="font-medium text-slate-900">Send welcome email</div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    Email the new owner their credentials and login URL via Resend.
                    Uncheck if you've already emailed them manually.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={replaceOwnerForm.forcePasswordChange}
                  onChange={(e) => setReplaceOwnerForm({ ...replaceOwnerForm, forcePasswordChange: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  data-testid="replace-owner-force-pw"
                />
                <div className="text-sm">
                  <div className="font-medium text-slate-900">Force password change on first login</div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    Recommended. The new owner will be prompted to set their own password on first login.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={replaceOwnerForm.deleteOldOwnerUser}
                  onChange={(e) => setReplaceOwnerForm({ ...replaceOwnerForm, deleteOldOwnerUser: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div className="text-sm">
                  <div className="font-medium text-slate-900">Delete previous owner's account</div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    If the old owner doesn't belong to any other tenant, fully delete their user record.
                  </div>
                </div>
              </label>

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm with your super-admin password</label>
                <input
                  type="password"
                  value={replaceOwnerForm.adminPassword}
                  onChange={(e) => setReplaceOwnerForm({ ...replaceOwnerForm, adminPassword: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && submitReplaceOwner()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  placeholder="Your password"
                  data-testid="replace-owner-admin-pw"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setReplaceOwnerTenant(null)}
                disabled={replaceOwnerSubmitting}
                className="flex-1 px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitReplaceOwner}
                disabled={replaceOwnerSubmitting || !replaceOwnerForm.email || !replaceOwnerForm.adminPassword}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                data-testid="replace-owner-submit"
              >
                {replaceOwnerSubmitting ? 'Replacing...' : 'Replace owner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformAdmin;
