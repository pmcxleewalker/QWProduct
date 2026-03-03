import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  Car, Users, Calendar, BarChart3, Settings, Plus, RefreshCw,
  Building2, Receipt, FileText, TrendingUp, Clock, AlertTriangle,
  CheckCircle, XCircle, Edit2, Trash2, Eye, Download, UserPlus,
  ArrowRight, MoreVertical
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

const TenantDashboard = () => {
  const navigate = useNavigate();
  const { user, activeTenant } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [stats, setStats] = useState({ vehicles: 0, users: 0, bookings: 0 });
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  // Modal states
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ name: '', registration: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '' });

  const isAdmin = activeTenant?.role === 'admin' || activeTenant?.role === 'master_admin' || 
                  user?.role === 'super_admin' || user?.role === 'master_admin';

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

  const fetchData = async () => {
    setLoading(true);
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

      // Generate recent activity from bookings
      const recent = bookingList.slice(0, 5).map(b => ({
        id: b.id,
        type: 'booking',
        description: `Booking for ${b.user_name}`,
        timestamp: b.created_at,
        status: b.status
      }));
      setRecentActivity(recent);

    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
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
      setError(err.response?.data?.detail || 'Failed to add vehicle');
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
      await axios.post(`${API}/tenant/users`, userForm, { params: { role: 'staff' } });
      setSuccess('Team member added successfully');
      setShowAddUser(false);
      setUserForm({ name: '', email: '', password: '' });
      fetchData();
    } catch (err) {
      // Handle Pydantic validation errors which come as an array
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Extract first validation error message
        setError(detail[0]?.msg || 'Validation error');
      } else if (typeof detail === 'string') {
        setError(detail);
      } else if (typeof detail === 'object' && detail?.msg) {
        setError(detail.msg);
      } else {
        setError('Failed to add team member');
      }
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'vehicles', label: 'Vehicles', icon: Car },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    ...(isAdmin ? [{ id: 'team', label: 'Team', icon: Users }] : [])
  ];

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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password *</label>
                <input
                  type="text"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Create a temporary password"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Share this with the team member</p>
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
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
    </div>
  );
};

export default TenantDashboard;
