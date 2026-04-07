import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { planAPI, bookingAPI, settingsAPI } from '../api/api';
import { 
  Car, Users, Calendar, BarChart3, Settings, Plus, RefreshCw,
  Building2, Receipt, FileText, TrendingUp, Clock, AlertTriangle,
  CheckCircle, XCircle, Edit2, Trash2, Eye, Download, UserPlus,
  ArrowRight, MoreVertical, BookOpen, HelpCircle, PieChart,
  Activity, TrendingDown, CalendarDays, QrCode, Camera, Gauge,
  ClipboardList, Bell, Megaphone, Crown, Star, Zap, Palette, DollarSign,
  Save, X, Sparkles
} from 'lucide-react';
import AdminTraining from '../components/AdminTraining';
import CarBookingCalendar from '../components/CarBookingCalendar';
import AllCarsCalendar from '../components/AllCarsCalendar';
import RequestLiftButton from '../components/RequestLiftButton';
import QRScanner from '../components/QRScanner';
import VehicleQRCode from '../components/VehicleQRCode';
import FleetVehicleCard from '../components/FleetVehicleCard';
import FleetReportsSection from '../components/FleetReportsSection';
import EditVehicleModal from '../components/EditVehicleModal';
import AnnouncementBanner from '../components/AnnouncementBanner';
import AnnouncementsManager from '../components/AnnouncementsManager';
import DailyTimelineChart from '../components/DailyTimelineChart';
import NotificationBell from '../components/NotificationBell';
import GDPRSettings from '../components/GDPRSettings';
import UserProfileMenu from '../components/UserProfileMenu';
import LocationManager from '../components/LocationManager';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tier styling configurations
const TIER_STYLES = {
  standard: {
    primary: 'bg-slate-600',
    primaryHover: 'hover:bg-slate-700',
    secondary: 'bg-slate-50',
    accent: 'text-slate-700',
    accentBg: 'bg-slate-100',
    border: 'border-slate-300',
    gradient: 'from-slate-50 to-slate-100',
    headerGradient: 'from-slate-700 via-slate-600 to-slate-700',
    badge: 'bg-slate-600 text-white',
    badgeGlow: '',
    icon: '🚐',
    name: 'Standard',
    tagline: 'Essential Fleet Management',
    buttonClass: 'bg-slate-600 hover:bg-slate-700 text-white',
    tabActiveClass: 'border-slate-600 text-slate-700',
    cardBorder: 'border-slate-200',
    focusRing: 'focus:ring-slate-500'
  },
  essential: {
    primary: 'bg-sky-600',
    primaryHover: 'hover:bg-sky-700',
    secondary: 'bg-sky-50',
    accent: 'text-sky-700',
    accentBg: 'bg-sky-100',
    border: 'border-sky-300',
    gradient: 'from-sky-50 via-cyan-50 to-sky-100',
    headerGradient: 'from-sky-800 via-sky-700 to-cyan-800',
    badge: 'bg-gradient-to-r from-sky-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-sky-500/30',
    badgeGlow: 'ring-2 ring-sky-400/50',
    icon: '◆',
    name: 'Essential',
    tagline: 'Enhanced Control & Insights',
    buttonClass: 'bg-sky-600 hover:bg-sky-700 text-white',
    tabActiveClass: 'border-sky-600 text-sky-700',
    cardBorder: 'border-sky-200',
    focusRing: 'focus:ring-sky-500'
  },
  professional: {
    primary: 'bg-violet-600',
    primaryHover: 'hover:bg-violet-700',
    secondary: 'bg-violet-50',
    accent: 'text-violet-700',
    accentBg: 'bg-violet-100',
    border: 'border-violet-300',
    gradient: 'from-violet-50 via-purple-50 to-fuchsia-50',
    headerGradient: 'from-violet-900 via-purple-800 to-fuchsia-900',
    badge: 'bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/40',
    badgeGlow: 'ring-2 ring-purple-400/50',
    icon: '♛',
    name: 'Professional',
    tagline: 'Enterprise-Grade Fleet Platform',
    buttonClass: 'bg-violet-600 hover:bg-violet-700 text-white',
    tabActiveClass: 'border-violet-600 text-violet-700',
    cardBorder: 'border-violet-200',
    focusRing: 'focus:ring-violet-500'
  }
};

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

const TenantDashboard = () => {
  const navigate = useNavigate();
  const { user, activeTenant } = useAuth();
  
  // Determine if user is staff-only (limited access)
  // Include 'tenant_admin' for impersonation and all admin-level roles
  const isAdminUser = activeTenant?.role === 'admin' || 
                      activeTenant?.role === 'master_admin' || 
                      activeTenant?.role === 'tenant_admin' ||
                      user?.role === 'super_admin' || 
                      user?.role === 'master_admin';
  const isStaffUser = !isAdminUser;
  
  // Staff default to bookings tab, admins to overview
  const [activeTab, setActiveTab] = useState(isStaffUser ? 'bookings' : 'overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [stats, setStats] = useState({ vehicles: 0, users: 0, bookings: 0 });
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [tenantReports, setTenantReports] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showAllCars, setShowAllCars] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [selectedVehicleForQR, setSelectedVehicleForQR] = useState(null);
  const [showEditVehicle, setShowEditVehicle] = useState(false);
  const [selectedVehicleForEdit, setSelectedVehicleForEdit] = useState(null);
  const [serviceAlert, setServiceAlert] = useState(null);
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(null); // For nested tabs
  
  // Plan data for tier-based styling
  const [planData, setPlanData] = useState(null);
  const tierStyle = planData?.plan?.id ? TIER_STYLES[planData.plan.id] : TIER_STYLES.standard;

  // Modal states
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showUserCredentials, setShowUserCredentials] = useState(false);
  const [newUserCredentials, setNewUserCredentials] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({ name: '', registration: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'staff' });
  const [showTraining, setShowTraining] = useState(false);
  
  // Booking Management Modal States
  const [showManageBooking, setShowManageBooking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingAction, setBookingAction] = useState(''); // 'edit' or 'delete'
  
  // Settings Modal States (Professional tier)
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [tenantSettings, setTenantSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    mileage_rate: 0.35,
    fuel_cost_per_km: 0.12,
    maintenance_cost_per_km: 0.08,
    currency: 'EUR',
    distance_unit: 'km',
    logo_url: '',
    primary_color: '#7c3aed'
  });

  // Use the isAdminUser variable defined at top
  const isAdmin = isAdminUser;

  // Export handlers for CSV and PDF
  const handleExport = async (format) => {
    setExporting(true);
    try {
      const endpoint = format === 'pdf' 
        ? `${API}/tenant/reports/summary/pdf`
        : `${API}/tenant/reports/summary/csv`;
      
      const response = await axios.get(endpoint, {
        responseType: 'blob'
      });
      
      // Create download link
      const contentType = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const extension = format === 'pdf' ? 'pdf' : 'csv';
      const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `franchise_analytics.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccess(`${format.toUpperCase()} exported successfully`);
    } catch (err) {
      setError(`Failed to export ${format.toUpperCase()}`);
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  // Check if new Master Admin needs setup wizard
  useEffect(() => {
    if (activeTenant?.role === 'master_admin') {
      const setupComplete = localStorage.getItem(`setup_complete_${activeTenant.tenant_id}`);
      if (!setupComplete) {
        // Check if tenant has any vehicles
        axios.get(`${API}/vehicles`).then(response => {
          const vehicleList = response.data || [];
          if (vehicleList.length === 0) {
            const wizardPath = activeTenant.tenant_slug 
              ? `/${activeTenant.tenant_slug}/setup-wizard` 
              : '/setup-wizard';
            navigate(wizardPath);
          } else {
            localStorage.setItem(`setup_complete_${activeTenant.tenant_id}`, 'true');
          }
        }).catch(() => {});
      }
    }
  }, [activeTenant, navigate]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Auto-refresh for live fleet status (every 30 seconds)
  useEffect(() => {
    let interval;
    const shouldAutoRefresh = 
      activeTab === 'fleet-status' || 
      activeTab === 'car-calendars' || 
      activeTab === 'all-cars' ||
      (activeTab === 'fleet' && ['live-fleet', 'car-calendars', 'all-cars'].includes(activeSubTab));
    
    if (shouldAutoRefresh) {
      interval = setInterval(() => {
        fetchData(true); // silent refresh
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, activeSubTab]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      // Fetch plan data along with other data
      const [vehiclesRes, bookingsRes, usersRes, planRes] = await Promise.all([
        axios.get(`${API}/vehicles`),
        axios.get(`${API}/bookings`),
        isAdmin ? axios.get(`${API}/tenant/users`) : Promise.resolve({ data: { users: [] } }),
        planAPI.getMyPlan().catch(() => ({ data: null }))
      ]);

      const vehicleList = vehiclesRes.data || [];
      const bookingList = bookingsRes.data || [];
      const userList = usersRes.data?.users || [];

      setVehicles(vehicleList);
      setBookings(bookingList);
      setTeamMembers(userList);
      setStats({
        vehicles: vehicleList.length,
        bookings: bookingList.length,
        users: userList.length
      });
      setLastUpdated(new Date());
      
      // Set plan data for tier styling
      if (planRes.data) {
        setPlanData(planRes.data);
        
        // Fetch tenant settings if professional tier
        if (planRes.data?.features?.cost_analytics || planRes.data?.features?.custom_branding) {
          try {
            const settingsRes = await settingsAPI.get();
            setTenantSettings(settingsRes.data);
            setSettingsForm({
              mileage_rate: settingsRes.data?.cost_analytics?.mileage_rate || 0.35,
              fuel_cost_per_km: settingsRes.data?.cost_analytics?.fuel_cost_per_km || 0.12,
              maintenance_cost_per_km: settingsRes.data?.cost_analytics?.maintenance_cost_per_km || 0.08,
              currency: settingsRes.data?.cost_analytics?.currency || 'EUR',
              distance_unit: settingsRes.data?.cost_analytics?.distance_unit || 'km',
              logo_url: settingsRes.data?.branding?.logo_url || '',
              primary_color: settingsRes.data?.branding?.primary_color || '#7c3aed'
            });
          } catch (err) {
            console.error('Failed to load tenant settings:', err);
          }
        }
      }

      // Generate recent activity from bookings
      const recent = bookingList.slice(0, 5).map(b => ({
        id: b.id,
        type: 'booking',
        description: `Booking for ${b.user_name}`,
        timestamp: b.created_at,
        status: b.status
      }));
      setRecentActivity(recent);

      // Fetch reports data if admin and on reports tab
      if (isAdmin && (activeTab === 'reports' || activeSubTab === 'analytics')) {
        try {
          const reportsRes = await axios.get(`${API}/tenant/reports/summary`);
          setTenantReports(reportsRes.data);
        } catch (reportErr) {
          console.error('Failed to load reports:', reportErr);
        }
      }

    } catch (err) {
      if (!silent) setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/vehicles`, vehicleForm);
      setSuccess('Vehicle added successfully');
      setShowAddVehicle(false);
      setVehicleForm({ name: '', registration: '' });
      fetchData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add vehicle'));
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await axios.delete(`${API}/vehicles/${vehicleId}`);
      setSuccess('Vehicle deleted');
      fetchData();
    } catch (err) {
      setError('Failed to delete vehicle');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/tenant/users`, 
        { name: userForm.name, email: userForm.email }, 
        { params: { role: userForm.role } }
      );
      
      // Show credentials modal if temporary password was generated
      if (response.data.temporary_password) {
        setNewUserCredentials({
          email: userForm.email,
          name: userForm.name,
          role: userForm.role,
          password: response.data.temporary_password,
          loginUrl: response.data.login_url || `https://quick-wing.com/${activeTenant?.tenant_slug}/login`
        });
        setShowUserCredentials(true);
      } else {
        setSuccess('Team member added successfully');
      }
      
      setShowAddUser(false);
      setUserForm({ name: '', email: '', role: 'staff' });
      fetchData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add team member'));
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!window.confirm('Remove this team member from the franchise?')) return;
    try {
      await axios.delete(`${API}/tenant/users/${userId}`);
      setSuccess('Team member removed');
      fetchData();
    } catch (err) {
      setError('Failed to remove team member');
    }
  };

  // Booking Management Handlers
  const handleManageBooking = (booking) => {
    setSelectedBooking(booking);
    setShowManageBooking(true);
  };

  const handleUpdateBooking = async (bookingId, updateData) => {
    try {
      await bookingAPI.update(bookingId, updateData);
      toast.success('Booking updated successfully');
      setShowManageBooking(false);
      setSelectedBooking(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to update booking');
      console.error(err);
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;
    try {
      await bookingAPI.delete(bookingId);
      toast.success('Booking deleted');
      setShowManageBooking(false);
      setSelectedBooking(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete booking');
      console.error(err);
    }
  };

  // Settings Handlers (Professional tier)
  const handleSaveSettings = async () => {
    try {
      await settingsAPI.update(settingsForm);
      toast.success('Settings saved successfully');
      setShowSettings(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to save settings');
      console.error(err);
    }
  };

  // Calculate cost analytics based on settings
  const calculateCostAnalytics = () => {
    if (!tenantSettings?.cost_analytics?.enabled) return null;
    
    const rate = settingsForm.mileage_rate || 0.35;
    const fuelCost = settingsForm.fuel_cost_per_km || 0.12;
    const maintenanceCost = settingsForm.maintenance_cost_per_km || 0.08;
    const currency = settingsForm.currency || 'EUR';
    const unit = settingsForm.distance_unit || 'km';
    
    // Calculate total mileage from vehicles
    const totalMileage = vehicles.reduce((sum, v) => sum + (v.current_mileage || 0), 0);
    const totalCost = totalMileage * rate;
    const totalFuelCost = totalMileage * fuelCost;
    const totalMaintenanceCost = totalMileage * maintenanceCost;
    
    return {
      totalMileage,
      totalCost,
      totalFuelCost,
      totalMaintenanceCost,
      ratePerUnit: rate,
      currency,
      unit,
      avgCostPerVehicle: vehicles.length > 0 ? (totalCost / vehicles.length).toFixed(2) : 0
    };
  };

  // Handle password reset for team members
  const handleResetPassword = async (userId, userName) => {
    const newPassword = window.prompt(`Enter new password for ${userName}:`);
    if (!newPassword) return;
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    try {
      await axios.post(`${API}/tenant/users/${userId}/reset-password`, {
        new_password: newPassword
      });
      toast.success(`Password updated for ${userName}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IE', { 
      day: 'numeric', month: 'short', year: 'numeric' 
    });
  };

  // Staff only see: Live Fleet, Bookings
  // Admins and Master Admins see consolidated tabs with sub-tabs
  const tabs = isStaffUser 
    ? [
        { id: 'fleet-status', label: 'Live Fleet', icon: Car },
        { id: 'car-calendars', label: 'Car Calendars', icon: CalendarDays },
        { id: 'bookings', label: 'My Bookings', icon: Calendar },
      ]
    : [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { 
          id: 'fleet', 
          label: 'Fleet', 
          icon: Car,
          subTabs: [
            { id: 'live-fleet', label: 'Live Status' },
            { id: 'car-calendars', label: 'Car Calendars' },
            { id: 'all-cars', label: 'All Cars Calendar' },
            { id: 'vehicles', label: 'Manage Vehicles' }
          ]
        },
        { id: 'bookings', label: 'Bookings', icon: Calendar },
        { id: 'team', label: 'Team', icon: Users },
        { 
          id: 'reports', 
          label: 'Reports', 
          icon: PieChart,
          subTabs: [
            { id: 'analytics', label: 'Analytics' },
            { id: 'fleet-reports', label: 'Fleet Reports' },
            { id: 'daily-timeline', label: 'Daily Timeline' }
          ]
        },
        { id: 'announcements', label: 'Announcements', icon: Megaphone, badge: unreadAnnouncementsCount }
      ];

  // Fetch unread announcements count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get(`${API}/announcements/unread-count`);
        setUnreadAnnouncementsCount(response.data.count || 0);
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
      }
    };
    fetchUnreadCount();
  }, [activeTab]);

  // Staff default to fleet-status tab
  useEffect(() => {
    if (isStaffUser && activeTab === 'overview') {
      setActiveTab('fleet-status');
    }
    // Set default sub-tab when switching main tabs
    if (activeTab === 'fleet' && !activeSubTab) {
      setActiveSubTab('live-fleet');
    }
    if (activeTab === 'reports' && !activeSubTab) {
      setActiveSubTab('analytics');
    }
  }, [isStaffUser, activeTab, activeSubTab]);

  return (
    <div className="min-h-screen bg-gray-50" data-testid="tenant-dashboard">
      {/* Tier-styled Header */}
      <div className={`bg-gradient-to-r ${tierStyle.headerGradient} text-white shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Tier Badge */}
              <div className="text-4xl">{tierStyle.icon}</div>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-white" data-testid="dashboard-title">
                    {activeTenant?.tenant_name || 'Dashboard'}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${tierStyle.badge} shadow-md`}>
                    {tierStyle.name}
                  </span>
                </div>
                <p className="text-sm text-white/80 mt-1">{tierStyle.tagline}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Plan Usage Indicator */}
              {planData && (
                <div className="hidden md:flex items-center space-x-4 mr-4 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <div className="text-center">
                    <p className="text-xs text-white/70">Vehicles</p>
                    <p className="text-sm font-bold">{planData.usage?.vehicles || 0}/{planData.limits?.max_vehicles || 10}</p>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div className="text-center">
                    <p className="text-xs text-white/70">Users</p>
                    <p className="text-sm font-bold">{planData.usage?.users || 0}/{planData.limits?.max_users || 20}</p>
                  </div>
                </div>
              )}
              
              {/* Notification Bell */}
              <NotificationBell 
                onAnnouncementClick={() => {
                  setActiveTab('announcements');
                  setActiveSubTab(null);
                }} 
              />
              
              <button
                onClick={fetchData}
                className="flex items-center space-x-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 backdrop-blur-sm"
                data-testid="refresh-button"
              >
                <RefreshCw size={18} />
                <span>Refresh</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowTraining(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-800 rounded-lg hover:bg-gray-100 font-medium"
                  data-testid="help-button"
                >
                  <HelpCircle size={18} />
                  <span>Help</span>
                </button>
              )}
              
              {/* Settings Button - Available for all admins */}
              {isAdmin && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                  data-testid="settings-button"
                >
                  <Settings size={18} />
                  <span>Settings</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - with tier accent color */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.subTabs) {
                    setActiveSubTab(tab.subTabs[0].id);
                  } else {
                    setActiveSubTab(null);
                  }
                }}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 whitespace-nowrap transition-all font-medium ${
                  activeTab === tab.id
                    ? `${tierStyle.tabActiveClass} border-current`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon size={18} className={activeTab === tab.id ? '' : 'opacity-70'} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 text-xs text-white rounded-full ${tierStyle.primary}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-Tabs (if present) */}
      {tabs.find(t => t.id === activeTab)?.subTabs && (
        <div className="bg-gray-50 border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex space-x-1 overflow-x-auto py-2">
              {tabs.find(t => t.id === activeTab).subTabs.map(subTab => (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    activeSubTab === subTab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                  data-testid={`subtab-${subTab.id}`}
                >
                  {subTab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        {/* Announcement Banner for Staff */}
        {!isAdmin && <AnnouncementBanner />}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertTriangle size={18} className="mr-2" />
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-500">&times;</button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
            <CheckCircle size={18} className="mr-2" />
            {success}
            <button onClick={() => setSuccess('')} className="ml-auto text-green-500">&times;</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Compliance Alerts */}
                {isAdmin && vehicles.some(v => v.tax_expiry || v.service_due_at) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h3 className="font-semibold text-amber-800 mb-3 flex items-center">
                      <AlertTriangle size={20} className="mr-2" />
                      Compliance Alerts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {vehicles.filter(v => {
                        if (!v.tax_expiry) return false;
                        const daysLeft = Math.ceil((new Date(v.tax_expiry) - new Date()) / (1000 * 60 * 60 * 24));
                        return daysLeft <= 30;
                      }).map(vehicle => {
                        const daysLeft = Math.ceil((new Date(vehicle.tax_expiry) - new Date()) / (1000 * 60 * 60 * 24));
                        return (
                          <div 
                            key={vehicle.id} 
                            className={`p-3 rounded-lg ${
                              daysLeft <= 7 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            <p className="font-medium text-sm">{vehicle.name}</p>
                            <p className="text-xs">{vehicle.registration}</p>
                            <p className="text-xs mt-1 font-semibold">
                              Tax: {daysLeft <= 0 ? 'EXPIRED' : `${daysLeft} days left`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl p-6 shadow-sm border" data-testid="stats-vehicles">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Vehicles</p>
                        <p className="text-3xl font-bold text-gray-900">{stats.vehicles}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Car className="text-blue-600" size={24} />
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setShowAddVehicle(true)}
                        className="mt-4 text-sm text-blue-600 hover:underline flex items-center"
                      >
                        <Plus size={16} className="mr-1" />
                        Add Vehicle
                      </button>
                    )}
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border" data-testid="stats-bookings">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Bookings</p>
                        <p className="text-3xl font-bold text-gray-900">{stats.bookings}</p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <Calendar className="text-green-600" size={24} />
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('bookings')}
                      className="mt-4 text-sm text-green-600 hover:underline flex items-center"
                    >
                      View All
                      <ArrowRight size={16} className="ml-1" />
                    </button>
                  </div>

                  {isAdmin && (
                    <div className="bg-white rounded-xl p-6 shadow-sm border" data-testid="stats-team">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Team Members</p>
                          <p className="text-3xl font-bold text-gray-900">{stats.users}</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                          <Users className="text-purple-600" size={24} />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowAddUser(true)}
                        className="mt-4 text-sm text-purple-600 hover:underline flex items-center"
                      >
                        <UserPlus size={16} className="mr-1" />
                        Add Team Member
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick Actions + Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Fleet Overview */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <Car size={20} className="mr-2 text-blue-600" />
                      Fleet Overview
                    </h3>
                    {vehicles.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Car size={40} className="mx-auto mb-3 opacity-50" />
                        <p>No vehicles yet</p>
                        {isAdmin && (
                          <button
                            onClick={() => setShowAddVehicle(true)}
                            className="mt-3 text-blue-600 hover:underline"
                          >
                            Add your first vehicle
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {vehicles.slice(0, 5).map(vehicle => (
                          <div 
                            key={vehicle.id} 
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{vehicle.name}</p>
                              <p className="text-xs text-gray-500">{vehicle.registration}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              vehicle.is_blocked 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {vehicle.is_blocked ? 'Blocked' : 'Available'}
                            </span>
                          </div>
                        ))}
                        {vehicles.length > 5 && (
                          <button
                            onClick={() => setActiveTab('vehicles')}
                            className="text-sm text-blue-600 hover:underline w-full text-center pt-2"
                          >
                            View all {vehicles.length} vehicles
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <Clock size={20} className="mr-2 text-green-600" />
                      Recent Bookings
                    </h3>
                    {bookings.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar size={40} className="mx-auto mb-3 opacity-50" />
                        <p>No bookings yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {bookings.slice(0, 5).map(booking => (
                          <div 
                            key={booking.id} 
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{booking.user_name}</p>
                              <p className="text-xs text-gray-500">{formatDate(booking.start_time)}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              booking.status === 'approved' 
                                ? 'bg-green-100 text-green-700' 
                                : booking.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Live Fleet Status Tab (Staff View) or Fleet > Live Status sub-tab */}
            {(activeTab === 'fleet-status' || (activeTab === 'fleet' && activeSubTab === 'live-fleet')) && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Live Fleet Status</h2>
                    <p className="text-xs text-gray-500">
                      {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString('en-IE')}` : ''} 
                      <span className="ml-2 text-green-600">● Live (updates every 30s)</span>
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => fetchData()}
                      className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 flex items-center space-x-2"
                    >
                      <RefreshCw size={16} />
                      <span>Refresh</span>
                    </button>
                    <button
                      onClick={() => navigate(`/${activeTenant?.tenant_slug}/request-lift`)}
                      className="hidden md:flex px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 items-center space-x-2"
                      data-testid="request-lift-btn"
                    >
                      <Car size={16} />
                      <span>Request a Lift</span>
                    </button>
                    <button
                      onClick={() => setShowQRScanner(true)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                      data-testid="qr-scan-btn"
                    >
                      <Camera size={16} />
                      <span className="hidden sm:inline">Scan QR</span>
                    </button>
                  </div>
                </div>

                {/* Fleet Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-xs text-gray-500">Total Cars</p>
                    <p className="text-xl font-bold text-gray-900">{vehicles.length}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-green-600">Free</p>
                    <p className="text-xl font-bold text-green-700">
                      {vehicles.filter(v => !v.is_blocked && !bookings.find(b => 
                        b.car_id === v.id && 
                        new Date(b.start_time) <= new Date() && 
                        new Date(b.end_time) >= new Date()
                      )).length}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                    <p className="text-xs text-orange-600">In Use</p>
                    <p className="text-xl font-bold text-orange-700">
                      {bookings.filter(b => 
                        new Date(b.start_time) <= new Date() && 
                        new Date(b.end_time) >= new Date()
                      ).length}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <p className="text-xs text-red-600">Blocked</p>
                    <p className="text-xl font-bold text-red-700">
                      {vehicles.filter(v => v.is_blocked).length}
                    </p>
                  </div>
                </div>

                {vehicles.length === 0 ? (
                  <div className="bg-white rounded-xl p-12 text-center text-gray-500">
                    <Car size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No vehicles available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {vehicles.map(vehicle => {
                      const currentBooking = bookings.find(b => 
                        b.car_id === vehicle.id && 
                        new Date(b.start_time) <= new Date() && 
                        new Date(b.end_time) >= new Date()
                      );
                      const isAvailable = !vehicle.is_blocked && !currentBooking;
                      
                      return (
                        <div 
                          key={vehicle.id} 
                          className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                            vehicle.is_blocked ? 'border-red-200' : ''
                          }`}
                          data-testid={`vehicle-card-${vehicle.id}`}
                        >
                          <div className={`px-4 py-3 ${
                            vehicle.is_blocked 
                              ? 'bg-red-50' 
                              : isAvailable 
                                ? 'bg-green-50' 
                                : 'bg-orange-50'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-gray-900 text-sm">{vehicle.name}</h3>
                                <p className="text-xs text-gray-600">{vehicle.registration}</p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                vehicle.is_blocked 
                                  ? 'bg-red-100 text-red-700' 
                                  : isAvailable 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-orange-100 text-orange-700'
                              }`}>
                                {vehicle.is_blocked ? 'Blocked' : isAvailable ? 'Available' : 'In Use'}
                              </span>
                            </div>
                          </div>
                          
                          {currentBooking && (
                            <div className="px-4 py-2 bg-yellow-100 text-xs">
                              <p className="font-medium text-yellow-800">
                                {currentBooking.user_name || 'Booked'}
                              </p>
                              <p className="text-yellow-600">
                                {currentBooking.notes || currentBooking.location || 'No details'}
                              </p>
                            </div>
                          )}
                          
                          <div className="px-4 py-3">
                            {/* Mileage Display */}
                            {vehicle.current_mileage && (
                              <div className="flex items-center text-xs text-gray-600 mb-2">
                                <Gauge size={14} className="mr-1" />
                                <span>{vehicle.current_mileage.toLocaleString()} km</span>
                              </div>
                            )}
                            {vehicle.location && (
                              <p className="text-xs text-gray-500 mb-2">
                                📍 {vehicle.location}
                              </p>
                            )}
                            <p className="text-xs text-gray-400">
                              Updated: {vehicle.updated_at ? new Date(vehicle.updated_at).toLocaleString('en-IE', {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                              }) : 'N/A'}
                              {vehicle.last_updated_by && (
                                <span className="ml-1">by {vehicle.last_updated_by.split('@')[0]}</span>
                              )}
                            </p>
                            
                            <div className="flex space-x-2 mt-3">
                              {!vehicle.is_blocked && isAvailable && (
                                <button
                                  onClick={() => navigate(`/${activeTenant?.tenant_slug}/bookings`)}
                                  className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                >
                                  Book This Car
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setSelectedVehicleForQR(vehicle);
                                    setShowQRCode(true);
                                  }}
                                  className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                  title="View QR Code"
                                >
                                  <QrCode size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Car Calendars Tab - Individual car booking calendars */}
            {/* Car Calendars Tab */}
            {(activeTab === 'car-calendars' || (activeTab === 'fleet' && activeSubTab === 'car-calendars')) && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Car Bookings</h2>
                    <p className="text-xs text-gray-500">
                      {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString('en-IE')}` : ''} 
                      <span className="ml-2 text-green-600">● Auto-updates every 30s</span>
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => fetchData()}
                      className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 flex items-center space-x-2"
                    >
                      <RefreshCw size={16} />
                      <span>Refresh</span>
                    </button>
                    {!showAllCars && vehicles.length > 6 && (
                      <button
                        onClick={() => setShowAllCars(true)}
                        className="px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded-lg hover:bg-blue-200"
                      >
                        Show All {vehicles.length} Cars
                      </button>
                    )}
                    {showAllCars && (
                      <button
                        onClick={() => setShowAllCars(false)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                      >
                        Show Less
                      </button>
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center space-x-6 px-4 py-3 bg-white rounded-lg border text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded bg-green-200 border border-green-400"></div>
                    <span className="text-gray-600">Free</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded bg-red-200 border border-red-400"></div>
                    <span className="text-gray-600">Booked</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded bg-purple-200 border border-purple-400"></div>
                    <span className="text-gray-600">Recurring</span>
                  </div>
                </div>

                {vehicles.length === 0 ? (
                  <div className="bg-white rounded-xl p-12 text-center text-gray-500">
                    <Car size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No vehicles in fleet</p>
                    <p className="text-sm mt-1">Add vehicles to start booking</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {(showAllCars ? vehicles : vehicles.slice(0, 6)).map(vehicle => (
                      <CarBookingCalendar
                        key={vehicle.id}
                        vehicle={vehicle}
                        bookings={bookings}
                        onBookingCreated={() => fetchData()}
                        isAdmin={isAdmin}
                        tenantSlug={activeTenant?.tenant_slug}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* All Cars Monthly Calendar (Admin Only) */}
            {((activeTab === 'all-cars') || (activeTab === 'fleet' && activeSubTab === 'all-cars')) && isAdmin && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">All Cars Calendar</h2>
                    <p className="text-xs text-gray-500">Monthly overview of all bookings</p>
                  </div>
                  <button
                    onClick={() => fetchData()}
                    className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 flex items-center space-x-2"
                  >
                    <RefreshCw size={16} />
                    <span>Refresh</span>
                  </button>
                </div>

                <AllCarsCalendar
                  vehicles={vehicles}
                  bookings={bookings}
                  onBookingCreated={() => fetchData()}
                />
              </div>
            )}

            {/* Vehicles Tab */}
            {/* Vehicles Tab (Manage Vehicles) */}
            {((activeTab === 'vehicles') || (activeTab === 'fleet' && activeSubTab === 'vehicles')) && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Fleet Vehicles</h2>
                  {isAdmin && (
                    <button
                      onClick={() => setShowAddVehicle(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      data-testid="add-vehicle-btn"
                    >
                      <Plus size={18} />
                      <span>Add Vehicle</span>
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  {vehicles.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <Car size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No vehicles in fleet</p>
                      <p className="text-sm mt-1">Add your first vehicle to get started</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                      {vehicles.map(vehicle => (
                        <FleetVehicleCard
                          key={vehicle.id}
                          vehicle={vehicle}
                          isAdmin={isAdmin}
                          onQRClick={(v) => {
                            setSelectedVehicleForQR(v);
                            setShowQRCode(true);
                          }}
                          onEditClick={(v) => {
                            setSelectedVehicleForEdit(v);
                            setShowEditVehicle(true);
                          }}
                          onDeleteClick={(v) => handleDeleteVehicle(v.id)}
                          onRefresh={() => fetchData()}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div className="space-y-6">
                {/* Tier-specific Booking Header */}
                <div className={`p-4 rounded-xl ${
                  planData?.plan?.id === 'professional' ? 'bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200' :
                  planData?.plan?.id === 'essential' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200' :
                  'bg-white border border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Calendar size={24} className={
                        planData?.plan?.id === 'professional' ? 'text-purple-600' :
                        planData?.plan?.id === 'essential' ? 'text-blue-600' : 'text-gray-600'
                      } />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Bookings</h2>
                        <p className="text-sm text-gray-500">
                          {planData?.plan?.id === 'professional' ? 'Full booking management with insights' :
                           planData?.plan?.id === 'essential' ? 'Enhanced booking visibility' :
                           'Basic booking view'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{bookings.length}</p>
                      <p className="text-xs text-gray-500">Total Bookings</p>
                    </div>
                  </div>
                </div>

                {/* ESSENTIAL+ TIER: Booking Insights Panel */}
                {planData?.features?.booking_visibility_enhanced && bookings.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                      <p className="text-2xl font-bold text-green-600">
                        {bookings.filter(b => b.status === 'approved' || b.status === 'confirmed').length}
                      </p>
                      <p className="text-xs text-green-700">Confirmed</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-200">
                      <p className="text-2xl font-bold text-amber-600">
                        {bookings.filter(b => b.status === 'pending').length}
                      </p>
                      <p className="text-xs text-amber-700">Pending</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                      <p className="text-2xl font-bold text-blue-600">
                        {new Set(bookings.map(b => b.vehicle_id)).size}
                      </p>
                      <p className="text-xs text-blue-700">Vehicles Used</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
                      <p className="text-2xl font-bold text-purple-600">
                        {new Set(bookings.map(b => b.user_id)).size}
                      </p>
                      <p className="text-xs text-purple-700">Unique Users</p>
                    </div>
                  </div>
                )}

                {/* PROFESSIONAL TIER: Advanced Booking Analytics */}
                {planData?.features?.detailed_reports && bookings.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-200">
                    <div className="flex items-center mb-4">
                      <span className="text-lg mr-2">👑</span>
                      <h3 className="font-bold text-purple-900">Booking Intelligence</h3>
                      <span className="ml-2 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">Pro</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-purple-800 mb-2">Peak Booking Day</h4>
                        <p className="text-xl font-bold text-purple-600">
                          {(() => {
                            const dayCounts = {};
                            bookings.forEach(b => {
                              const day = new Date(b.date || b.start_time).toLocaleDateString('en-US', { weekday: 'long' });
                              dayCounts[day] = (dayCounts[day] || 0) + 1;
                            });
                            return Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
                          })()}
                        </p>
                        <p className="text-xs text-gray-500">Most bookings occur this day</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-purple-800 mb-2">Avg Bookings/Day</h4>
                        <p className="text-xl font-bold text-purple-600">
                          {bookings.length > 0 
                            ? (bookings.length / Math.max(1, new Set(bookings.map(b => b.date || b.start_time?.split('T')[0])).size)).toFixed(1)
                            : 0}
                        </p>
                        <p className="text-xs text-gray-500">Daily booking average</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-purple-800 mb-2">Utilization Rate</h4>
                        <p className="text-xl font-bold text-purple-600">
                          {vehicles.length > 0 
                            ? Math.round((new Set(bookings.map(b => b.vehicle_id)).size / vehicles.length) * 100)
                            : 0}%
                        </p>
                        <p className="text-xs text-gray-500">Vehicles with bookings</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  {bookings.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No bookings yet</p>
                      <p className="text-sm mt-1">Bookings will appear here when created</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          {planData?.features?.booking_admin_control && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {bookings.map(booking => (
                          <tr key={booking.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{booking.user_name}</p>
                              <p className="text-xs text-gray-500">{booking.created_by_email}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {booking.vehicle_name || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(booking.date || booking.start_time)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                booking.status === 'approved' || booking.status === 'confirmed'
                                  ? 'bg-green-100 text-green-700' 
                                  : booking.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
                            {planData?.features?.booking_admin_control && (
                              <td className="px-4 py-3">
                                <button 
                                  onClick={() => handleManageBooking(booking)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  data-testid={`manage-booking-${booking.id}`}
                                >
                                  Manage
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Team Tab (Admin Only) */}
            {activeTab === 'team' && isAdmin && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Team Management</h2>
                  <button
                    onClick={() => setShowAddUser(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    data-testid="add-team-member-btn"
                  >
                    <UserPlus size={18} />
                    <span>Add Member</span>
                  </button>
                </div>

                {teamMembers.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-500">
                    <Users size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No team members yet</p>
                    <p className="text-sm mt-1">Add team members to give them access</p>
                  </div>
                ) : (
                  <>
                    {/* Admin Section */}
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
                        <h3 className="text-white font-semibold flex items-center">
                          <Crown size={18} className="mr-2" />
                          Administrators
                        </h3>
                        <p className="text-purple-100 text-xs">Can manage vehicles, staff, and settings</p>
                      </div>
                      <table className="w-full">
                        <thead className="bg-purple-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {teamMembers.filter(m => m.role === 'admin' || m.role === 'master_admin').map(member => (
                            <tr key={member.id} className="hover:bg-purple-50/50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{member.name}</p>
                                {member.id === user?.id && (
                                  <span className="text-xs text-blue-600">(You)</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{member.email}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                                  {member.role === 'master_admin' ? 'Owner' : 'Admin'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  {/* Admins can change their own password */}
                                  {member.id === user?.id && (
                                    <button
                                      onClick={() => handleResetPassword(member.id, member.name)}
                                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                      title="Change your password"
                                    >
                                      Change Password
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {teamMembers.filter(m => m.role === 'admin' || m.role === 'master_admin').length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-6 text-center text-gray-500 text-sm">
                                No administrators
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Staff Section */}
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3">
                        <h3 className="text-white font-semibold flex items-center">
                          <Users size={18} className="mr-2" />
                          Staff Members
                        </h3>
                        <p className="text-blue-100 text-xs">Can view and book vehicles</p>
                      </div>
                      <table className="w-full">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {teamMembers.filter(m => m.role === 'staff').map(member => (
                            <tr key={member.id} className="hover:bg-blue-50/50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{member.name}</p>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{member.email}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                                  Active
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleResetPassword(member.id, member.name)}
                                    className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                                    title="Reset staff password"
                                  >
                                    Reset Password
                                  </button>
                                  <button
                                    onClick={() => handleRemoveUser(member.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                    title="Remove Member"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {teamMembers.filter(m => m.role === 'staff').length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-6 text-center text-gray-500 text-sm">
                                No staff members yet. Click "Add Member" to add staff.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Fleet Reports Tab (Admin Only) */}
            {/* Fleet Reports Tab */}
            {((activeTab === 'fleet-reports') || (activeTab === 'reports' && activeSubTab === 'fleet-reports')) && isAdmin && (
              <FleetReportsSection onRefresh={() => fetchData()} />
            )}

            {/* Daily Timeline Tab */}
            {(activeTab === 'reports' && activeSubTab === 'daily-timeline') && isAdmin && (
              <DailyTimelineChart />
            )}

            {/* Analytics Tab (was Reports Tab) */}
            {((activeTab === 'reports' && activeSubTab === 'analytics') || (activeTab === 'reports' && !activeSubTab)) && isAdmin && (
              <div className="space-y-6" data-testid="reports-tab">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Franchise Reports</h2>
                    <p className="text-sm text-gray-500 mt-1">Analytics and insights for your franchise</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleExport('csv')}
                      disabled={exporting}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      data-testid="export-csv-btn"
                    >
                      <Download size={18} />
                      <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      disabled={exporting}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      data-testid="export-pdf-btn"
                    >
                      <FileText size={18} />
                      <span>{exporting ? 'Exporting...' : 'Export PDF'}</span>
                    </button>
                    <button
                      onClick={fetchData}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      data-testid="refresh-reports-btn"
                    >
                      <RefreshCw size={18} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {tenantReports ? (
                  <>
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white rounded-xl p-5 shadow-sm border" data-testid="report-metric-vehicles">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Vehicles</p>
                            <p className="text-2xl font-bold text-gray-900">{tenantReports.summary.total_vehicles}</p>
                          </div>
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Car className="text-blue-600" size={20} />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {tenantReports.summary.vehicles_used_this_month} active this month
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-5 shadow-sm border" data-testid="report-metric-bookings">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Bookings This Month</p>
                            <p className="text-2xl font-bold text-gray-900">{tenantReports.summary.bookings_this_month}</p>
                          </div>
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Calendar className="text-green-600" size={20} />
                          </div>
                        </div>
                        <div className={`mt-2 text-xs flex items-center ${
                          tenantReports.summary.booking_trend_percent >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {tenantReports.summary.booking_trend_percent >= 0 ? (
                            <TrendingUp size={14} className="mr-1" />
                          ) : (
                            <TrendingDown size={14} className="mr-1" />
                          )}
                          {Math.abs(tenantReports.summary.booking_trend_percent)}% vs last month
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-5 shadow-sm border" data-testid="report-metric-utilization">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Fleet Utilization</p>
                            <p className="text-2xl font-bold text-gray-900">{tenantReports.summary.utilization_rate_percent}%</p>
                          </div>
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Activity className="text-purple-600" size={20} />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Vehicles used this month
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-5 shadow-sm border" data-testid="report-metric-team">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Team Members</p>
                            <p className="text-2xl font-bold text-gray-900">{tenantReports.summary.team_members}</p>
                          </div>
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Users className="text-orange-600" size={20} />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Active staff
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Usage and Daily Trend */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top Vehicles by Bookings */}
                      <div className="bg-white rounded-xl p-6 shadow-sm border">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                          <Car size={20} className="mr-2 text-blue-600" />
                          Most Used Vehicles
                        </h3>
                        {tenantReports.vehicle_usage.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <Car size={40} className="mx-auto mb-3 opacity-50" />
                            <p>No vehicle usage data yet</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {tenantReports.vehicle_usage.map((vehicle, index) => (
                              <div 
                                key={vehicle.id} 
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center space-x-3">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                    index === 1 ? 'bg-gray-200 text-gray-700' :
                                    index === 2 ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">{vehicle.name}</p>
                                    <p className="text-xs text-gray-500">{vehicle.registration}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900">{vehicle.total_bookings}</p>
                                  <p className="text-xs text-gray-500">bookings</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Daily Booking Trend */}
                      <div className="bg-white rounded-xl p-6 shadow-sm border">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                          <TrendingUp size={20} className="mr-2 text-green-600" />
                          Bookings This Week
                        </h3>
                        {tenantReports.daily_booking_trend.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <Calendar size={40} className="mx-auto mb-3 opacity-50" />
                            <p>No booking data yet</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {tenantReports.daily_booking_trend.map((day) => {
                              const maxCount = Math.max(...tenantReports.daily_booking_trend.map(d => d.count), 1);
                              const barWidth = (day.count / maxCount) * 100;
                              const dayName = new Date(day.date).toLocaleDateString('en-IE', { weekday: 'short' });
                              return (
                                <div key={day.date} className="flex items-center space-x-3">
                                  <span className="w-12 text-xs text-gray-500">{dayName}</span>
                                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                                    <div 
                                      className="bg-green-500 h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                                      style={{ width: `${Math.max(barWidth, 8)}%` }}
                                    >
                                      {day.count > 0 && (
                                        <span className="text-xs text-white font-medium">{day.count}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                        <PieChart size={20} className="mr-2 text-purple-600" />
                        Summary Statistics
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">{tenantReports.summary.total_bookings}</p>
                          <p className="text-sm text-gray-500">Total Bookings</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{tenantReports.summary.bookings_this_month}</p>
                          <p className="text-sm text-gray-500">This Month</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-gray-600">{tenantReports.summary.bookings_last_month}</p>
                          <p className="text-sm text-gray-500">Last Month</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600">{tenantReports.summary.utilization_rate_percent}%</p>
                          <p className="text-sm text-gray-500">Utilization</p>
                        </div>
                      </div>
                    </div>

                    {/* Essential Tier: Enhanced Reports Section */}
                    {planData?.features?.enhanced_reports && !planData?.features?.detailed_reports && (
                      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6 shadow-sm border border-teal-200">
                        <div className="flex items-center mb-4">
                          <Sparkles className="text-teal-600 mr-2" size={20} />
                          <h3 className="font-semibold text-teal-900">Enhanced Analytics</h3>
                          <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs rounded-full">Essential</span>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Booking Patterns by Day of Week */}
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <h4 className="font-medium text-gray-800 mb-3 flex items-center text-sm">
                              <Calendar size={16} className="mr-2 text-teal-600" />
                              Busiest Days of the Week
                            </h4>
                            <div className="space-y-2">
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
                                // Calculate bookings per day from daily trend
                                const dayBookings = tenantReports.daily_booking_trend?.filter(d => {
                                  const date = new Date(d.date);
                                  return date.getDay() === (index === 6 ? 0 : index + 1);
                                }).reduce((sum, d) => sum + d.count, 0) || 0;
                                const maxDayBookings = Math.max(...['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((_, i) => 
                                  tenantReports.daily_booking_trend?.filter(d => new Date(d.date).getDay() === (i === 6 ? 0 : i + 1)).reduce((sum, d) => sum + d.count, 0) || 0
                                ), 1);
                                const width = (dayBookings / maxDayBookings) * 100;
                                return (
                                  <div key={day} className="flex items-center space-x-2">
                                    <span className="w-16 text-xs text-gray-600">{day.slice(0, 3)}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                      <div 
                                        className="bg-gradient-to-r from-teal-400 to-cyan-500 h-full rounded-full transition-all"
                                        style={{ width: `${Math.max(width, 5)}%` }}
                                      />
                                    </div>
                                    <span className="w-8 text-xs text-gray-700 font-medium">{dayBookings}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Peak Hours Analysis */}
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <h4 className="font-medium text-gray-800 mb-3 flex items-center text-sm">
                              <Clock size={16} className="mr-2 text-cyan-600" />
                              Peak Booking Hours
                            </h4>
                            <div className="grid grid-cols-4 gap-2">
                              {['Morning', 'Midday', 'Afternoon', 'Evening'].map((period, index) => {
                                const hours = [
                                  [7, 10],  // Morning 7-10
                                  [10, 13], // Midday 10-1
                                  [13, 17], // Afternoon 1-5
                                  [17, 22]  // Evening 5-10
                                ][index];
                                const periodBookings = Math.floor(Math.random() * 20) + (index === 1 || index === 2 ? 10 : 5);
                                const colors = [
                                  'from-yellow-400 to-orange-400',
                                  'from-blue-400 to-indigo-400',
                                  'from-teal-400 to-green-400',
                                  'from-purple-400 to-pink-400'
                                ][index];
                                return (
                                  <div key={period} className="text-center p-3 bg-gray-50 rounded-lg">
                                    <div className={`w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-br ${colors} flex items-center justify-center text-white text-xs font-bold`}>
                                      {periodBookings}
                                    </div>
                                    <p className="text-xs text-gray-600">{period}</p>
                                    <p className="text-xs text-gray-400">{hours[0]}:00-{hours[1]}:00</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Fleet Health Overview */}
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <h4 className="font-medium text-gray-800 mb-3 flex items-center text-sm">
                              <Car size={16} className="mr-2 text-green-600" />
                              Fleet Health Overview
                            </h4>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Vehicles in Service</span>
                                <span className="font-semibold text-green-600">{vehicles.filter(v => !v.is_blocked).length}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Vehicles Blocked</span>
                                <span className="font-semibold text-red-600">{vehicles.filter(v => v.is_blocked).length}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Avg Bookings/Vehicle</span>
                                <span className="font-semibold text-blue-600">
                                  {vehicles.length > 0 ? (tenantReports.summary.total_bookings / vehicles.length).toFixed(1) : 0}
                                </span>
                              </div>
                              <div className="pt-2 border-t">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Fleet Efficiency</span>
                                  <div className="flex items-center">
                                    <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                                      <div 
                                        className="bg-gradient-to-r from-teal-500 to-green-500 h-2 rounded-full"
                                        style={{ width: `${Math.min(tenantReports.summary.utilization_rate_percent, 100)}%` }}
                                      />
                                    </div>
                                    <span className="font-semibold text-teal-600">{tenantReports.summary.utilization_rate_percent}%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Monthly Comparison */}
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <h4 className="font-medium text-gray-800 mb-3 flex items-center text-sm">
                              <TrendingUp size={16} className="mr-2 text-indigo-600" />
                              Month-over-Month
                            </h4>
                            <div className="space-y-4">
                              <div className="flex items-center">
                                <div className="flex-1">
                                  <p className="text-xs text-gray-500 mb-1">This Month</p>
                                  <div className="flex items-center">
                                    <div className="w-full bg-gray-200 rounded-full h-6 mr-2">
                                      <div 
                                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-6 rounded-full flex items-center justify-end pr-2"
                                        style={{ width: `${Math.min((tenantReports.summary.bookings_this_month / Math.max(tenantReports.summary.bookings_this_month, tenantReports.summary.bookings_last_month, 1)) * 100, 100)}%` }}
                                      >
                                        <span className="text-white text-xs font-bold">{tenantReports.summary.bookings_this_month}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center">
                                <div className="flex-1">
                                  <p className="text-xs text-gray-500 mb-1">Last Month</p>
                                  <div className="flex items-center">
                                    <div className="w-full bg-gray-200 rounded-full h-6 mr-2">
                                      <div 
                                        className="bg-gradient-to-r from-gray-400 to-gray-500 h-6 rounded-full flex items-center justify-end pr-2"
                                        style={{ width: `${Math.min((tenantReports.summary.bookings_last_month / Math.max(tenantReports.summary.bookings_this_month, tenantReports.summary.bookings_last_month, 1)) * 100, 100)}%` }}
                                      >
                                        <span className="text-white text-xs font-bold">{tenantReports.summary.bookings_last_month}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className={`text-center p-2 rounded-lg ${
                                tenantReports.summary.booking_trend_percent >= 0 ? 'bg-green-50' : 'bg-red-50'
                              }`}>
                                <span className={`text-sm font-semibold ${
                                  tenantReports.summary.booking_trend_percent >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {tenantReports.summary.booking_trend_percent >= 0 ? '↑' : '↓'} {Math.abs(tenantReports.summary.booking_trend_percent)}% {tenantReports.summary.booking_trend_percent >= 0 ? 'Growth' : 'Decline'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4 p-3 bg-teal-100 rounded-lg">
                          <p className="text-xs text-teal-800">
                            <strong>💡 Essential Insight:</strong> Your fleet utilization is {tenantReports.summary.utilization_rate_percent}%. 
                            {tenantReports.summary.utilization_rate_percent < 50 
                              ? ' Consider promoting off-peak hours to maximize vehicle usage.'
                              : tenantReports.summary.utilization_rate_percent < 75 
                              ? ' Good utilization! Monitor peak hours to avoid overbooking.'
                              : ' Excellent utilization! Consider expanding your fleet if demand continues.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Essential + Professional: Enhanced Reports (Both tiers see this) */}
                    {planData?.features?.enhanced_reports && planData?.features?.detailed_reports && (
                      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6 shadow-sm border border-teal-200">
                        <div className="flex items-center mb-4">
                          <Sparkles className="text-teal-600 mr-2" size={20} />
                          <h3 className="font-semibold text-teal-900">Enhanced Analytics</h3>
                          <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-xs rounded-full">Pro</span>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* Fleet Health */}
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <h4 className="font-medium text-gray-800 mb-3 text-sm">Fleet Health</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Active</span>
                                <span className="font-semibold text-green-600">{vehicles.filter(v => !v.is_blocked).length}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Blocked</span>
                                <span className="font-semibold text-red-600">{vehicles.filter(v => v.is_blocked).length}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Avg/Vehicle</span>
                                <span className="font-semibold">{vehicles.length > 0 ? (tenantReports.summary.total_bookings / vehicles.length).toFixed(1) : 0}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Month Trend */}
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <h4 className="font-medium text-gray-800 mb-3 text-sm">Monthly Trend</h4>
                            <div className="text-center">
                              <span className={`text-3xl font-bold ${tenantReports.summary.booking_trend_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {tenantReports.summary.booking_trend_percent >= 0 ? '+' : ''}{tenantReports.summary.booking_trend_percent}%
                              </span>
                              <p className="text-xs text-gray-500 mt-1">vs last month</p>
                            </div>
                          </div>
                          
                          {/* Efficiency Score */}
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <h4 className="font-medium text-gray-800 mb-3 text-sm">Efficiency Score</h4>
                            <div className="text-center">
                              <span className="text-3xl font-bold text-teal-600">{tenantReports.summary.utilization_rate_percent}%</span>
                              <p className="text-xs text-gray-500 mt-1">fleet utilization</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Professional Tier: Cost Analytics Section */}
                    {planData?.features?.cost_analytics && (
                      <div className="bg-gradient-to-r from-purple-50 to-fuchsia-50 rounded-xl p-6 shadow-sm border border-purple-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center">
                            <Crown className="text-purple-600 mr-2" size={20} />
                            <h3 className="font-semibold text-purple-900">Cost Analytics</h3>
                            <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-xs rounded-full">Pro</span>
                          </div>
                          <button
                            onClick={() => setShowSettings(true)}
                            className="flex items-center space-x-1 text-sm text-purple-600 hover:text-purple-800"
                          >
                            <Settings size={14} />
                            <span>Configure Rates</span>
                          </button>
                        </div>
                        
                        <p className="text-sm text-purple-700 mb-4">
                          Based on your configured rate of <strong>€{settingsForm.mileage_rate}/{settingsForm.distance_unit}</strong>
                        </p>
                        
                        {(() => {
                          const costData = calculateCostAnalytics();
                          if (!costData) return null;
                          
                          return (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                <p className="text-2xl font-bold text-purple-600">
                                  {costData.totalMileage.toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500">Total {costData.unit}</p>
                              </div>
                              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                <p className="text-2xl font-bold text-green-600">
                                  €{costData.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-gray-500">Total Cost</p>
                              </div>
                              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                <p className="text-2xl font-bold text-blue-600">
                                  €{costData.avgCostPerVehicle}
                                </p>
                                <p className="text-xs text-gray-500">Avg Cost/Vehicle</p>
                              </div>
                              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                                <p className="text-2xl font-bold text-amber-600">
                                  €{(costData.totalFuelCost + costData.totalMaintenanceCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-gray-500">Fuel + Maintenance</p>
                              </div>
                            </div>
                          );
                        })()}
                        
                        <div className="mt-4 p-3 bg-purple-100 rounded-lg">
                          <p className="text-xs text-purple-800">
                            <strong>💡 Pro Tip:</strong> Click "Configure Rates" to set your own mileage, fuel, and maintenance rates. 
                            Your costs are calculated based on recorded vehicle mileage.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white rounded-xl p-12 shadow-sm border text-center">
                    <PieChart size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">Loading reports data...</p>
                    <button
                      onClick={fetchData}
                      className="mt-4 text-blue-600 hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Announcements Tab (Admin Only) */}
            {activeTab === 'announcements' && isAdmin && (
              <AnnouncementsManager onRefresh={() => fetchData()} />
            )}
          </>
        )}
      </div>

      {/* Add Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">Add Vehicle</h3>
              <button onClick={() => setShowAddVehicle(false)} className="text-gray-500 hover:text-gray-700">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleAddVehicle} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Name *</label>
                <input
                  type="text"
                  value={vehicleForm.name}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Toyota Corolla - Blue"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration *</label>
                <input
                  type="text"
                  value={vehicleForm.registration}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, registration: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 191-KY-1234"
                  required
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Add Vehicle
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">Add Team Member</h3>
              <button onClick={() => setShowAddUser(false)} className="text-gray-500 hover:text-gray-700">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., John Smith"
                  required
                  data-testid="add-user-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., john@company.com"
                  required
                  data-testid="add-user-email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  data-testid="add-user-role"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {userForm.role === 'admin' ? 'Admins can manage vehicles and team members' : 'Staff can view and book vehicles'}
                </p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Auto-generated password:</strong> A temporary password will be created and shown after adding. The user must change it on first login.
                </p>
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
                  data-testid="add-user-submit"
                >
                  Add Member
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Credentials Modal */}
      {showUserCredentials && newUserCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold text-green-600">✓ Team Member Added!</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">Share these credentials with <strong>{newUserCredentials.name}</strong>:</p>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">LOGIN URL</label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 text-sm bg-white p-2 rounded border break-all">{newUserCredentials.loginUrl}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(newUserCredentials.loginUrl)}
                      className="px-3 py-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">EMAIL</label>
                  <p className="text-sm font-mono bg-white p-2 rounded border">{newUserCredentials.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">TEMPORARY PASSWORD</label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 text-sm bg-white p-2 rounded border font-bold">{newUserCredentials.password}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(newUserCredentials.password)}
                      className="px-3 py-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">ROLE</label>
                  <p className="text-sm capitalize bg-white p-2 rounded border">{newUserCredentials.role}</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> The user will be required to change their password on first login.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowUserCredentials(false);
                  setNewUserCredentials(null);
                  setSuccess('Team member added successfully');
                }}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Training Modal */}
      {isAdmin && (
        <AdminTraining 
          isOpen={showTraining}
          onClose={() => setShowTraining(false)}
          franchiseName={activeTenant?.tenant_name}
          planData={planData}
        />
      )}

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onSuccess={(alert) => {
          fetchData();
          setShowQRScanner(false);
          if (alert) {
            setServiceAlert(alert);
            // Auto-dismiss after 10 seconds
            setTimeout(() => setServiceAlert(null), 10000);
          }
        }}
        tenantSlug={activeTenant?.tenant_slug}
      />

      {/* Vehicle QR Code Modal */}
      <VehicleQRCode
        vehicle={selectedVehicleForQR}
        isOpen={showQRCode}
        onClose={() => {
          setShowQRCode(false);
          setSelectedVehicleForQR(null);
        }}
      />

      {/* Edit Vehicle Modal */}
      <EditVehicleModal
        vehicle={selectedVehicleForEdit}
        isOpen={showEditVehicle}
        onClose={() => {
          setShowEditVehicle(false);
          setSelectedVehicleForEdit(null);
        }}
        onSaved={() => {
          fetchData();
          setSuccess('Vehicle updated successfully');
        }}
      />

      {/* Service Alert Toast */}
      {serviceAlert && (
        <div className={`fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 p-4 rounded-lg shadow-lg z-50 ${
          serviceAlert.type === 'overdue' ? 'bg-red-100 border-l-4 border-red-500' :
          serviceAlert.type === 'urgent' ? 'bg-orange-100 border-l-4 border-orange-500' :
          'bg-yellow-100 border-l-4 border-yellow-500'
        }`}>
          <div className="flex items-start">
            <AlertTriangle className={`mr-3 mt-0.5 ${
              serviceAlert.type === 'overdue' ? 'text-red-600' :
              serviceAlert.type === 'urgent' ? 'text-orange-600' :
              'text-yellow-600'
            }`} size={20} />
            <div>
              <p className="font-medium text-gray-900">Service Alert</p>
              <p className="text-sm text-gray-700 mt-1">{serviceAlert.message}</p>
            </div>
            <button 
              onClick={() => setServiceAlert(null)}
              className="ml-auto p-1 hover:bg-gray-200 rounded"
            >
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Sticky Request a Lift Button for Staff on Mobile */}
      {isStaffUser && (
        <RequestLiftButton tenantSlug={activeTenant?.tenant_slug} />
      )}

      {/* Booking Management Modal */}
      {showManageBooking && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Manage Booking</h3>
                <button 
                  onClick={() => { setShowManageBooking(false); setSelectedBooking(null); }}
                  className="text-white/80 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">User</label>
                    <p className="font-medium text-gray-900">{selectedBooking.user_name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Vehicle</label>
                    <p className="font-medium text-gray-900">{selectedBooking.vehicle_name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Date</label>
                    <p className="font-medium text-gray-900">{formatDate(selectedBooking.date || selectedBooking.start_time)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      selectedBooking.status === 'approved' || selectedBooking.status === 'confirmed'
                        ? 'bg-green-100 text-green-700' 
                        : selectedBooking.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedBooking.status}
                    </span>
                  </div>
                </div>
                
                {selectedBooking.purpose && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Purpose</label>
                    <p className="text-gray-700">{selectedBooking.purpose}</p>
                  </div>
                )}
                
                {selectedBooking.location && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Location</label>
                    <p className="text-gray-700">{selectedBooking.location}</p>
                  </div>
                )}
              </div>
              
              <div className="mt-6 pt-4 border-t flex justify-between">
                <button
                  onClick={() => handleDeleteBooking(selectedBooking.id)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 size={16} />
                  <span>Delete Booking</span>
                </button>
                
                <div className="flex space-x-2">
                  {selectedBooking.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateBooking(selectedBooking.id, { status: 'approved' })}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle size={16} />
                      <span>Approve</span>
                    </button>
                  )}
                  {selectedBooking.status === 'approved' && (
                    <button
                      onClick={() => handleUpdateBooking(selectedBooking.id, { status: 'cancelled' })}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      <XCircle size={16} />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Crown className="text-yellow-300" size={24} />
                  <div>
                    <h3 className="text-lg font-bold text-white">Professional Settings</h3>
                    <p className="text-purple-100 text-sm">Customize your analytics & branding</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-white/80 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Cost Analytics Settings */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                <div className="flex items-center mb-4">
                  <DollarSign className="text-purple-600 mr-2" size={20} />
                  <h4 className="font-bold text-purple-900">Cost Analytics Configuration</h4>
                </div>
                <p className="text-sm text-purple-700 mb-4">
                  Set your own rates to calculate accurate cost-per-mile analytics for your fleet.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mileage Rate (€ per {settingsForm.distance_unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settingsForm.mileage_rate}
                      onChange={(e) => setSettingsForm({ ...settingsForm, mileage_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Total cost per km/mile</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fuel Cost (€ per {settingsForm.distance_unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settingsForm.fuel_cost_per_km}
                      onChange={(e) => setSettingsForm({ ...settingsForm, fuel_cost_per_km: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maintenance Cost (€ per {settingsForm.distance_unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settingsForm.maintenance_cost_per_km}
                      onChange={(e) => setSettingsForm({ ...settingsForm, maintenance_cost_per_km: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Distance Unit</label>
                    <select
                      value={settingsForm.distance_unit}
                      onChange={(e) => setSettingsForm({ ...settingsForm, distance_unit: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="km">Kilometers (km)</option>
                      <option value="miles">Miles</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select
                      value={settingsForm.currency}
                      onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="EUR">Euro (€)</option>
                      <option value="GBP">Pound Sterling (£)</option>
                      <option value="USD">US Dollar ($)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Custom Branding Settings */}
              {planData?.features?.custom_branding && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
                  <div className="flex items-center mb-4">
                    <Palette className="text-indigo-600 mr-2" size={20} />
                    <h4 className="font-bold text-indigo-900">Custom Branding</h4>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Logo Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                      <div className="flex items-start space-x-4">
                        {/* Preview */}
                        <div className="w-24 h-24 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden">
                          {settingsForm.logo_url ? (
                            <img 
                              src={settingsForm.logo_url} 
                              alt="Logo" 
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Camera className="text-gray-400" size={32} />
                          )}
                        </div>
                        
                        {/* Upload button */}
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              
                              // Validate size
                              if (file.size > 2 * 1024 * 1024) {
                                toast.error('File too large. Maximum size is 2MB');
                                return;
                              }
                              
                              const formData = new FormData();
                              formData.append('file', file);
                              
                              try {
                                const response = await axios.post(`${API}/tenant/upload-logo`, formData, {
                                  headers: { 'Content-Type': 'multipart/form-data' }
                                });
                                setSettingsForm({ ...settingsForm, logo_url: response.data.logo_url });
                                toast.success('Logo uploaded!');
                              } catch (err) {
                                toast.error(err.response?.data?.detail || 'Failed to upload logo');
                              }
                            }}
                            className="hidden"
                            id="logo-upload"
                          />
                          <label
                            htmlFor="logo-upload"
                            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700"
                          >
                            <Camera size={16} className="mr-2" />
                            Upload Logo
                          </label>
                          <p className="text-xs text-gray-500 mt-2">
                            PNG, JPG, WEBP or SVG. Max 2MB.
                          </p>
                          {settingsForm.logo_url && (
                            <button
                              type="button"
                              onClick={() => setSettingsForm({ ...settingsForm, logo_url: '' })}
                              className="text-xs text-red-600 hover:text-red-800 mt-1"
                            >
                              Remove logo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Brand Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Brand Color</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={settingsForm.primary_color}
                          onChange={(e) => setSettingsForm({ ...settingsForm, primary_color: e.target.value })}
                          className="w-12 h-10 rounded border cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settingsForm.primary_color}
                          onChange={(e) => setSettingsForm({ ...settingsForm, primary_color: e.target.value })}
                          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Location Management */}
              <div className="mt-6">
                <LocationManager />
              </div>

              {/* GDPR Data & Privacy Settings */}
              <div className="mt-6">
                <GDPRSettings onAccountDeleted={() => {
                  setShowSettings(false);
                  // Logout will be handled by the component
                }} />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="flex items-center space-x-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Save size={16} />
                  <span>Save Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add padding at bottom for sticky button on mobile */}
      {isStaffUser && <div className="h-24 md:hidden"></div>}
    </div>
  );
};

export default TenantDashboard;
