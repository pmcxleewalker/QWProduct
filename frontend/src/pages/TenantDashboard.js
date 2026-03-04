import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  Car, Users, Calendar, BarChart3, Settings, Plus, RefreshCw,
  Building2, Receipt, FileText, TrendingUp, Clock, AlertTriangle,
  CheckCircle, XCircle, Edit2, Trash2, Eye, Download, UserPlus,
  ArrowRight, MoreVertical, BookOpen, HelpCircle, PieChart,
  Activity, TrendingDown, CalendarDays, QrCode, Camera, Gauge,
  ClipboardList
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

const TenantDashboard = () => {
  const navigate = useNavigate();
  const { user, activeTenant } = useAuth();
  
  // Determine if user is staff-only (limited access)
  const isAdminUser = activeTenant?.role === 'admin' || activeTenant?.role === 'master_admin' || 
                      user?.role === 'super_admin' || user?.role === 'master_admin';
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

  // Modal states
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showUserCredentials, setShowUserCredentials] = useState(false);
  const [newUserCredentials, setNewUserCredentials] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({ name: '', registration: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'staff' });
  const [showTraining, setShowTraining] = useState(false);

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
    if (activeTab === 'fleet-status' || activeTab === 'car-calendars' || activeTab === 'all-cars') {
      interval = setInterval(() => {
        fetchData(true); // silent refresh
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      // Always fetch overview data
      const [vehiclesRes, bookingsRes, usersRes] = await Promise.all([
        axios.get(`${API}/vehicles`),
        axios.get(`${API}/bookings`),
        isAdmin ? axios.get(`${API}/tenant/users`) : Promise.resolve({ data: { users: [] } })
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
      if (isAdmin && activeTab === 'reports') {
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IE', { 
      day: 'numeric', month: 'short', year: 'numeric' 
    });
  };

  // Staff only see: Live Fleet, Bookings
  // Admins and Master Admins see everything including Overview and Team management
  const tabs = isStaffUser 
    ? [
        { id: 'fleet-status', label: 'Live Fleet', icon: Car },
        { id: 'car-calendars', label: 'Car Calendars', icon: CalendarDays },
        { id: 'bookings', label: 'My Bookings', icon: Calendar },
      ]
    : [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'fleet-status', label: 'Live Fleet', icon: Car },
        { id: 'car-calendars', label: 'Car Calendars', icon: CalendarDays },
        { id: 'all-cars', label: 'All Cars', icon: Calendar },
        { id: 'vehicles', label: 'Vehicles', icon: Car },
        { id: 'team', label: 'Team', icon: Users },
        { id: 'reports', label: 'Reports', icon: PieChart }
      ];

  // Staff default to fleet-status tab
  useEffect(() => {
    if (isStaffUser && activeTab === 'overview') {
      setActiveTab('fleet-status');
    }
  }, [isStaffUser, activeTab]);

  return (
    <div className="min-h-screen bg-gray-50" data-testid="tenant-dashboard">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="dashboard-title">
                {activeTenant?.tenant_name || 'Dashboard'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">Fleet Management Dashboard</p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              data-testid="refresh-button"
            >
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowTraining(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
                data-testid="help-button"
              >
                <HelpCircle size={18} />
                <span>Help</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
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

            {/* Live Fleet Status Tab (Staff View) */}
            {activeTab === 'fleet-status' && (
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
            {activeTab === 'car-calendars' && (
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
                    <div className="w-4 h-4 rounded bg-purple-200 border border-purple-400"></div>
                    <span className="text-gray-600">Booked</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded bg-orange-200 border border-orange-400"></div>
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
            {activeTab === 'all-cars' && isAdmin && (
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
            {activeTab === 'vehicles' && (
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
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registration</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          {isAdmin && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {vehicles.map(vehicle => (
                          <tr key={vehicle.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{vehicle.name}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{vehicle.registration}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                vehicle.is_blocked 
                                  ? 'bg-red-100 text-red-700' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {vehicle.is_blocked ? 'Blocked' : 'Available'}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleDeleteVehicle(vehicle.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                  title="Delete Vehicle"
                                >
                                  <Trash2 size={16} />
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

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Bookings</h2>
                </div>

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
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
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
                              {formatDate(booking.start_time)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                booking.status === 'approved' 
                                  ? 'bg-green-100 text-green-700' 
                                  : booking.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
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
                  <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
                  <button
                    onClick={() => setShowAddUser(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    data-testid="add-team-member-btn"
                  >
                    <UserPlus size={18} />
                    <span>Add Member</span>
                  </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  {teamMembers.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <Users size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No team members yet</p>
                      <p className="text-sm mt-1">Add team members to give them access</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {teamMembers.map(member => (
                          <tr key={member.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{member.name}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{member.email}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                member.role === 'admin' || member.role === 'master_admin'
                                  ? 'bg-purple-100 text-purple-700' 
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {member.role}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {member.role !== 'master_admin' && member.id !== user?.id && (
                                <button
                                  onClick={() => handleRemoveUser(member.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                  title="Remove Member"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Reports Tab (Admin Only) */}
            {activeTab === 'reports' && isAdmin && (
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
        />
      )}

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onSuccess={() => {
          fetchData();
          setShowQRScanner(false);
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

      {/* Sticky Request a Lift Button for Staff on Mobile */}
      {isStaffUser && (
        <RequestLiftButton tenantSlug={activeTenant?.tenant_slug} />
      )}

      {/* Add padding at bottom for sticky button on mobile */}
      {isStaffUser && <div className="h-24 md:hidden"></div>}
    </div>
  );
};

export default TenantDashboard;
