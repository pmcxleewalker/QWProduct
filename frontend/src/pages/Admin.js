import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { carAPI, assistanceAPI, userAPI, bookingAPI, messageAPI, todoAPI, reportsAPI } from '../api/api';
import { Car, Phone, Plus, Trash2, Edit2, QrCode, Users, CheckCircle, Lock, Unlock, Clock, Check, X, MessageSquare, ListTodo, Settings, Key, BarChart3, Download, TrendingUp, TrendingDown, Calendar as CalendarIcon } from 'lucide-react';

// Helper function to get username from email (removes @domain.com)
const getUsername = (email) => {
  if (!email) return '';
  return email.split('@')[0];
};

const Admin = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'cars');
  const [cars, setCars] = useState([]);
  const [providers, setProviders] = useState([]);
  const [users, setUsers] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCarForm, setShowCarForm] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [editingProvider, setEditingProvider] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [carForm, setCarForm] = useState({
    name: '',
    registration: '',
    current_status: 'Free',
    tax_due_date: '',
    nct_due_date: '',
    service_due_date: '',
  });

  const [blockForm, setBlockForm] = useState({
    carId: null,
    reason: 'Service',
  });

  const [unblockForm, setUnblockForm] = useState({
    carId: null,
    sign_off_notes: '',
  });

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showUnblockModal, setShowUnblockModal] = useState(false);

  const [providerForm, setProviderForm] = useState({
    region: 'Kerry',
    name: '',
    phone: '',
    service_type: 'Breakdown',
  });

  const [createUserForm, setCreateUserForm] = useState({
    email: '',
    password: '',
    role: 'staff',
  });

  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  
  // Password Reset State
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const [messageForm, setMessageForm] = useState({
    title: '',
    content: '',
    requires_acknowledgment: true,
    is_active: true,
  });

  // To-Do List State
  const [todos, setTodos] = useState([]);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [todoForm, setTodoForm] = useState({
    title: '',
    is_mandatory: false,
    schedule_type: null, // 'daily', 'weekly', 'monthly', or null
    schedule_days: [], // For weekly: [0-6] (Sun-Sat), For monthly: [1-31]
  });
  
  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Helper function to format schedule info
  const formatSchedule = (todo) => {
    if (!todo.schedule_type) return null;
    if (todo.schedule_type === 'daily') return '🔄 Daily';
    if (todo.schedule_type === 'weekly' && todo.schedule_days?.length) {
      const days = todo.schedule_days.sort((a, b) => a - b).map(d => DAYS_OF_WEEK[d]).join(', ');
      return `📅 Weekly: ${days}`;
    }
    if (todo.schedule_type === 'monthly' && todo.schedule_days?.length) {
      const dates = todo.schedule_days.sort((a, b) => a - b).join(', ');
      return `📆 Monthly: ${dates}`;
    }
    return null;
  };

  // Reports State
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [bookingsDetailReport, setBookingsDetailReport] = useState(null);
  const [bookingsDetailLoading, setBookingsDetailLoading] = useState(false);

  // Clear Bookings State
  const [showClearBookingsModal, setShowClearBookingsModal] = useState(false);
  const [clearStartDate, setClearStartDate] = useState('');
  const [clearEndDate, setClearEndDate] = useState('');
  const [clearingBookings, setClearingBookings] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportData();
      fetchBookingsDetailReport();
    }
  }, [activeTab]);

  const fetchReportData = async () => {
    setReportLoading(true);
    try {
      const response = await reportsAPI.getFleetUsage();
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setReportLoading(false);
    }
  };

  const fetchBookingsDetailReport = async () => {
    setBookingsDetailLoading(true);
    try {
      const response = await reportsAPI.getBookingsDetail();
      setBookingsDetailReport(response.data);
    } catch (error) {
      console.error('Error fetching bookings detail:', error);
    } finally {
      setBookingsDetailLoading(false);
    }
  };

  const handleClearBookings = async () => {
    if (!clearStartDate || !clearEndDate) {
      setError('Please select both start and end dates');
      return;
    }
    
    if (clearStartDate > clearEndDate) {
      setError('Start date must be before end date');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete ALL bookings from ${clearStartDate} to ${clearEndDate}? This action cannot be undone.`)) {
      return;
    }
    
    setClearingBookings(true);
    try {
      const response = await reportsAPI.clearBookings(clearStartDate, clearEndDate);
      setSuccess(response.data.message);
      setShowClearBookingsModal(false);
      setClearStartDate('');
      setClearEndDate('');
      fetchData();
      fetchReportData();
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to clear bookings');
    } finally {
      setClearingBookings(false);
    }
  };

  const exportBookingsDetailCSV = () => {
    if (!bookingsDetailReport?.bookings) return;
    
    const headers = ['Driver Name', 'Registration', 'Car', 'Location', 'Purpose', 'Date & Time', 'Status'];
    const rows = bookingsDetailReport.bookings.map(b => [
      b.driver_name,
      b.registration,
      b.car_name,
      b.location || '',
      b.purpose || '',
      b.date_time,
      b.status
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bookings_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportSummaryCSV = () => {
    if (!reportData) return;
    
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Vehicles', reportData.summary.total_vehicles],
      ['Total Bookings', reportData.summary.total_bookings],
      ['Pending Bookings', reportData.summary.pending_bookings],
      ['Blocked Vehicles', reportData.summary.blocked_vehicles],
      [''],
      ['Most Booked Cars'],
      ['Rank', 'Car Name', 'Registration', 'Total Bookings'],
      ...reportData.most_booked.slice(0, 10).map((car, i) => [i + 1, car.car_name, car.registration, car.total_bookings])
    ];
    
    const csvContent = summaryData
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fleet_summary_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportReport = () => {
    const token = localStorage.getItem('token');
    const exportUrl = `${reportsAPI.exportCSV()}`;
    
    // Create a temporary link with authorization
    fetch(exportUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleet_report_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    })
    .catch(error => console.error('Export failed:', error));
  };

  const fetchData = async () => {
    try {
      const promises = [
        carAPI.getAll(),
        assistanceAPI.getAll(),
        bookingAPI.getPending(),
        messageAPI.getAll(),
        todoAPI.getAll(),
      ];
      
      if (activeTab === 'users') {
        promises.push(userAPI.getAll());
      }
      
      const results = await Promise.all(promises);
      setCars(results[0].data);
      setProviders(results[1].data);
      setPendingBookings(results[2].data);
      setMessages(results[3].data);
      setTodos(results[4].data);
      
      if (results[5]) {
        setUsers(results[5].data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get car name helper
  const getCarName = (carId) => {
    const car = cars.find(c => c.id === carId);
    return car ? car.name : 'Unknown';
  };

  // Booking Approval Operations
  const handleApproveBooking = async (groupId) => {
    try {
      await bookingAPI.approve(groupId);
      setSuccess('Recurring booking approved!');
      fetchData();
    } catch (err) {
      setError('Failed to approve booking');
    }
  };

  const handleRejectBooking = async (groupId) => {
    if (!window.confirm('Are you sure you want to reject this recurring booking?')) return;
    try {
      await bookingAPI.reject(groupId);
      setSuccess('Recurring booking rejected');
      fetchData();
    } catch (err) {
      setError('Failed to reject booking');
    }
  };

  // Message Operations
  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingMessage) {
        await messageAPI.update(editingMessage.id, messageForm);
        setSuccess('Message updated!');
      } else {
        await messageAPI.create(messageForm);
        setSuccess('Message created! Staff will see it on next login.');
      }
      setShowMessageForm(false);
      setEditingMessage(null);
      setMessageForm({ title: '', content: '', requires_acknowledgment: true, is_active: true });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save message');
    }
  };

  const handleDeleteMessage = async (id) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await messageAPI.delete(id);
      setSuccess('Message deleted');
      fetchData();
    } catch (err) {
      setError('Failed to delete message');
    }
  };

  const handleEditMessage = (msg) => {
    setEditingMessage(msg);
    setMessageForm({
      title: msg.title,
      content: msg.content,
      requires_acknowledgment: msg.requires_acknowledgment,
      is_active: msg.is_active,
    });
    setShowMessageForm(true);
  };

  // To-Do List Operations
  const handleTodoSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingTodo) {
        await todoAPI.update(editingTodo.id, todoForm);
        setSuccess('To-do item updated!');
      } else {
        await todoAPI.create(todoForm);
        setSuccess('To-do item created!');
      }
      setShowTodoForm(false);
      setEditingTodo(null);
      setTodoForm({ title: '', is_mandatory: false, schedule_type: null, schedule_days: [] });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save to-do item');
    }
  };

  const handleToggleTodo = async (todo) => {
    try {
      await todoAPI.update(todo.id, { is_completed: !todo.is_completed });
      fetchData();
    } catch (err) {
      setError('Failed to update to-do item');
    }
  };

  const handleDeleteTodo = async (id) => {
    if (!window.confirm('Delete this to-do item?')) return;
    try {
      await todoAPI.delete(id);
      setSuccess('To-do item deleted');
      fetchData();
    } catch (err) {
      setError('Failed to delete to-do item');
    }
  };

  const handleEditTodo = (todo) => {
    setEditingTodo(todo);
    setTodoForm({
      title: todo.title,
      is_mandatory: todo.is_mandatory,
      schedule_type: todo.schedule_type || null,
      schedule_days: todo.schedule_days || [],
    });
    setShowTodoForm(true);
  };

  // Car CRUD Operations
  const handleCarSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingCar) {
        await carAPI.update(editingCar.id, carForm);
        setSuccess('Car updated successfully!');
      } else {
        await carAPI.create(carForm);
        setSuccess('Car created successfully!');
      }
      setShowCarForm(false);
      setEditingCar(null);
      setCarForm({ name: '', registration: '', current_status: 'Free', tax_due_date: '', nct_due_date: '', service_due_date: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save car');
    }
  };

  const handleDeleteCar = async (id) => {
    if (!window.confirm('Are you sure you want to delete this car?')) return;
    
    try {
      await carAPI.delete(id);
      setSuccess('Car deleted successfully');
      fetchData();
    } catch (err) {
      setError('Failed to delete car');
    }
  };

  const handleEditCar = (car) => {
    setEditingCar(car);
    setCarForm({
      name: car.name,
      registration: car.registration,
      current_status: car.current_status,
      tax_due_date: car.tax_due_date || '',
      nct_due_date: car.nct_due_date || '',
      service_due_date: car.service_due_date || '',
    });
    setShowCarForm(true);
  };

  // Block/Unblock Operations
  const handleBlockCar = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await carAPI.block(blockForm.carId, { reason: blockForm.reason });
      setSuccess('Car blocked successfully!');
      setShowBlockModal(false);
      setBlockForm({ carId: null, reason: 'Service' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to block car');
    }
  };

  const handleUnblockCar = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await carAPI.unblock(unblockForm.carId, { sign_off_notes: unblockForm.sign_off_notes });
      setSuccess('Car unblocked successfully!');
      setShowUnblockModal(false);
      setUnblockForm({ carId: null, sign_off_notes: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to unblock car');
    }
  };

  const openBlockModal = (car) => {
    setBlockForm({ carId: car.id, reason: 'Service' });
    setShowBlockModal(true);
  };

  const openUnblockModal = (car) => {
    setUnblockForm({ carId: car.id, sign_off_notes: '' });
    setShowUnblockModal(true);
  };

  // Provider CRUD Operations
  const handleProviderSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingProvider) {
        await assistanceAPI.update(editingProvider.id, providerForm);
        setSuccess('Provider updated successfully!');
      } else {
        await assistanceAPI.create(providerForm);
        setSuccess('Provider created successfully!');
      }
      setShowProviderForm(false);
      setEditingProvider(null);
      setProviderForm({ region: 'Kerry', name: '', phone: '', service_type: 'Breakdown' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save provider');
    }
  };

  const handleDeleteProvider = async (id) => {
    if (!window.confirm('Are you sure you want to delete this provider?')) return;
    
    try {
      await assistanceAPI.delete(id);
      setSuccess('Provider deleted successfully');
      fetchData();
    } catch (err) {
      setError('Failed to delete provider');
    }
  };

  const handleEditProvider = (provider) => {
    setEditingProvider(provider);
    setProviderForm({
      region: provider.region,
      name: provider.name,
      phone: provider.phone,
      service_type: provider.service_type,
    });
    setShowProviderForm(true);
  };

  // User Management Operations
  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (createUserForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await userAPI.create(createUserForm);
      setSuccess(`User account created for ${createUserForm.email}! They can now log in with the default password.`);
      setShowCreateUserForm(false);
      setCreateUserForm({ email: '', password: '', role: 'staff' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleToggleUserStatus = async (user) => {
    try {
      await userAPI.update(user.id, { is_active: !user.is_active });
      setSuccess(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchData();
    } catch (err) {
      setError('Failed to update user status');
    }
  };

  const handleChangeUserRole = async (user, newRole) => {
    try {
      await userAPI.update(user.id, { role: newRole });
      setSuccess(`User role updated to ${newRole}`);
      fetchData();
    } catch (err) {
      setError('Failed to update user role');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
    
    try {
      await userAPI.delete(id);
      setSuccess('User deactivated successfully');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to deactivate user');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      await userAPI.resetPassword(resetPasswordUser.id, newPassword);
      setSuccess(`Password reset successfully for ${getUsername(resetPasswordUser.email)}`);
      setShowResetPasswordModal(false);
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password');
    }
  };

  const handleDownloadQR = (carId, carName) => {
    const qrUrl = carAPI.getQRCode(carId);
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `${carName}-QRCode.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 sm:px-6 lg:px-8 pb-20 sm:pb-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6" data-testid="admin-title">Admin Panel</h1>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6" data-testid="success-message">
          <p className="text-green-800 text-sm sm:text-base">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6" data-testid="error-message">
          <p className="text-red-800 text-sm sm:text-base">{error}</p>
        </div>
      )}

      {/* Tabs - Scrollable on mobile */}
      <div className="flex space-x-1 sm:space-x-4 mb-4 sm:mb-6 border-b overflow-x-auto pb-px -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab('cars')}
          data-testid="tab-cars"
          className={`pb-3 sm:pb-4 px-2 sm:px-4 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'cars'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          <Car className="inline mr-1 sm:mr-2" size={18} />
          <span className="hidden sm:inline">Manage </span>Cars
        </button>
        <button
          onClick={() => setActiveTab('providers')}
          data-testid="tab-providers"
          className={`pb-3 sm:pb-4 px-2 sm:px-4 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'providers'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          <Phone className="inline mr-1 sm:mr-2" size={18} />
          Providers
        </button>
        <button
          onClick={() => setActiveTab('users')}
          data-testid="tab-users"
          className={`pb-3 sm:pb-4 px-2 sm:px-4 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'users'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          <Users className="inline mr-2" size={20} />
          Users
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          data-testid="tab-approvals"
          className={`pb-3 sm:pb-4 px-2 sm:px-4 font-medium transition-colors relative whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'approvals'
              ? 'border-b-2 border-orange-600 text-orange-600'
              : 'text-gray-600 hover:text-orange-600'
          }`}
        >
          <Clock className="inline mr-1 sm:mr-2" size={18} />
          Approvals
          {pendingBookings.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center text-[10px] sm:text-xs">
              {pendingBookings.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          data-testid="tab-messages"
          className={`pb-3 sm:pb-4 px-2 sm:px-4 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'messages'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-purple-600'
          }`}
        >
          <MessageSquare className="inline mr-1 sm:mr-2" size={18} />
          <span className="hidden sm:inline">Messages</span>
          <span className="sm:hidden">Msgs</span>
        </button>
        <button
          onClick={() => setActiveTab('todos')}
          data-testid="tab-todos"
          className={`pb-3 sm:pb-4 px-2 sm:px-4 font-medium transition-colors relative whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'todos'
              ? 'border-b-2 border-teal-600 text-teal-600'
              : 'text-gray-600 hover:text-teal-600'
          }`}
        >
          <ListTodo className="inline mr-1 sm:mr-2" size={18} />
          To-Do
          {todos.filter(t => !t.is_completed).length > 0 && (
            <span className="absolute -top-1 -right-1 bg-teal-500 text-white text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center text-[10px] sm:text-xs">
              {todos.filter(t => !t.is_completed).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          data-testid="tab-reports"
          className={`pb-3 sm:pb-4 px-2 sm:px-4 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'reports'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-indigo-600'
          }`}
        >
          <BarChart3 className="inline mr-1 sm:mr-2" size={18} />
          Reports
        </button>
      </div>

      {/* To-Do Alert Banner - Shows at top when there are pending mandatory tasks */}
      {todos.filter(t => !t.is_completed && t.is_mandatory).length > 0 && (
        <div className="mb-4 sm:mb-6 bg-amber-50 border-2 border-amber-400 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-400 rounded-full p-2">
              <ListTodo size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-amber-800">⚠️ Mandatory Tasks Pending</h3>
              <p className="text-sm text-amber-700">
                You have {todos.filter(t => !t.is_completed && t.is_mandatory).length} mandatory task(s) that need attention.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('todos')}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            View Tasks
          </button>
        </div>
      )}

      {/* Cars Tab */}
      {activeTab === 'cars' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Fleet Vehicles</h2>
            <button
              onClick={() => {
                setShowCarForm(true);
                setEditingCar(null);
                setCarForm({ name: '', registration: '', current_status: 'Free', tax_due_date: '', nct_due_date: '', service_due_date: '' });
              }}
              data-testid="add-car-button"
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
              <span>Add Car</span>
            </button>
          </div>

          {/* Car Form */}
          {showCarForm && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-bold mb-4">{editingCar ? 'Edit Car' : 'Add New Car'}</h3>
              <form onSubmit={handleCarSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Car Name *</label>
                    <input
                      type="text"
                      data-testid="car-name-input"
                      value={carForm.name}
                      onChange={(e) => setCarForm({ ...carForm, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Registration *</label>
                    <input
                      type="text"
                      data-testid="car-registration-input"
                      value={carForm.registration}
                      onChange={(e) => setCarForm({ ...carForm, registration: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Status</label>
                    <select
                      data-testid="car-status-select"
                      value={carForm.current_status}
                      onChange={(e) => setCarForm({ ...carForm, current_status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Free">Free</option>
                      <option value="In Use">In Use</option>
                      <option value="Needs Cleaning">Needs Cleaning</option>
                      <option value="Needs Repair">Needs Repair</option>
                    </select>
                  </div>
                </div>
                
                {/* Compliance Dates Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">📋 Compliance Dates (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tax Due Date</label>
                      <input
                        type="date"
                        data-testid="car-tax-date-input"
                        value={carForm.tax_due_date ? carForm.tax_due_date.split('T')[0] : ''}
                        onChange={(e) => setCarForm({ ...carForm, tax_due_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">NCT Due Date</label>
                      <input
                        type="date"
                        data-testid="car-nct-date-input"
                        value={carForm.nct_due_date ? carForm.nct_due_date.split('T')[0] : ''}
                        onChange={(e) => setCarForm({ ...carForm, nct_due_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Service Due Date</label>
                      <input
                        type="date"
                        data-testid="car-service-date-input"
                        value={carForm.service_due_date ? carForm.service_due_date.split('T')[0] : ''}
                        onChange={(e) => setCarForm({ ...carForm, service_due_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4 mt-4">
                  <button
                    type="submit"
                    data-testid="submit-car-button"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                  >
                    {editingCar ? 'Update Car' : 'Create Car'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCarForm(false);
                      setEditingCar(null);
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Cars List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cars.map((car) => (
              <div
                key={car.id}
                data-testid={`admin-car-card-${car.id}`}
                className={`bg-white rounded-lg shadow-md p-6 ${car.is_blocked ? 'border-2 border-purple-400' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{car.name}</h3>
                    <p className="text-sm text-gray-600">{car.registration}</p>
                  </div>
                  {car.is_blocked && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                      🚫 {car.block_reason}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Status: {car.current_status}</p>
                
                {/* Compliance Dates Display */}
                {(car.tax_due_date || car.nct_due_date || car.service_due_date) && (
                  <div className="mt-3 p-2 bg-gray-50 rounded-lg text-xs">
                    {car.tax_due_date && (
                      <p className="text-gray-600">Tax: {new Date(car.tax_due_date).toLocaleDateString('en-IE')}</p>
                    )}
                    {car.nct_due_date && (
                      <p className="text-gray-600">NCT: {new Date(car.nct_due_date).toLocaleDateString('en-IE')}</p>
                    )}
                    {car.service_due_date && (
                      <p className="text-gray-600">Service: {new Date(car.service_due_date).toLocaleDateString('en-IE')}</p>
                    )}
                  </div>
                )}
                
                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={() => handleDownloadQR(car.id, car.name)}
                    data-testid={`qr-button-${car.id}`}
                    className="flex-1 flex items-center justify-center space-x-1 bg-purple-600 text-white py-2 px-3 rounded-lg hover:bg-purple-700 text-sm"
                  >
                    <QrCode size={16} />
                    <span>QR</span>
                  </button>
                  <button
                    onClick={() => handleEditCar(car)}
                    data-testid={`edit-car-${car.id}`}
                    className="flex-1 flex items-center justify-center space-x-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Edit2 size={16} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteCar(car.id)}
                    data-testid={`delete-car-${car.id}`}
                    className="flex-1 flex items-center justify-center space-x-1 bg-red-600 text-white py-2 px-3 rounded-lg hover:bg-red-700 text-sm"
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
                
                {/* Block/Unblock Button */}
                <div className="mt-2">
                  {car.is_blocked ? (
                    <button
                      onClick={() => openUnblockModal(car)}
                      data-testid={`unblock-car-${car.id}`}
                      className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 text-sm"
                    >
                      <Unlock size={16} />
                      <span>Sign Off & Unblock</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => openBlockModal(car)}
                      data-testid={`block-car-${car.id}`}
                      className="w-full flex items-center justify-center space-x-2 bg-gray-600 text-white py-2 px-3 rounded-lg hover:bg-gray-700 text-sm"
                    >
                      <Lock size={16} />
                      <span>Block for Appointment</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Block Modal */}
          {showBlockModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Block Car for Appointment</h3>
                <form onSubmit={handleBlockCar} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                    <select
                      value={blockForm.reason}
                      onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="Service">Service Appointment</option>
                      <option value="Cleaning">Cleaning Appointment</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700"
                    >
                      Block Car
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBlockModal(false)}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Unblock Modal */}
          {showUnblockModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Sign Off & Unblock Car</h3>
                <form onSubmit={handleUnblockCar} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sign Off Notes (Optional)</label>
                    <textarea
                      value={unblockForm.sign_off_notes}
                      onChange={(e) => setUnblockForm({ ...unblockForm, sign_off_notes: e.target.value })}
                      placeholder="e.g., Service completed, oil changed, tires rotated"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
                    >
                      Sign Off & Unblock
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUnblockModal(false)}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Providers Tab */}
      {activeTab === 'providers' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Assistance Providers</h2>
            <button
              onClick={() => {
                setShowProviderForm(true);
                setEditingProvider(null);
                setProviderForm({ region: 'Kerry', name: '', phone: '', service_type: 'Breakdown' });
              }}
              data-testid="add-provider-button"
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
              <span>Add Provider</span>
            </button>
          </div>

          {/* Provider Form */}
          {showProviderForm && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-bold mb-4">{editingProvider ? 'Edit Provider' : 'Add New Provider'}</h3>
              <form onSubmit={handleProviderSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Region *</label>
                    <select
                      data-testid="provider-region-select"
                      value={providerForm.region}
                      onChange={(e) => setProviderForm({ ...providerForm, region: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="Kerry">Kerry</option>
                      <option value="West Cork">West Cork</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Provider Name *</label>
                    <input
                      type="text"
                      data-testid="provider-name-input"
                      value={providerForm.name}
                      onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                    <input
                      type="tel"
                      data-testid="provider-phone-input"
                      value={providerForm.phone}
                      onChange={(e) => setProviderForm({ ...providerForm, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Service Type *</label>
                    <input
                      type="text"
                      data-testid="provider-service-input"
                      value={providerForm.service_type}
                      onChange={(e) => setProviderForm({ ...providerForm, service_type: e.target.value })}
                      placeholder="e.g., Breakdown, Towing, Maintenance"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    data-testid="submit-provider-button"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                  >
                    {editingProvider ? 'Update Provider' : 'Create Provider'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProviderForm(false);
                      setEditingProvider(null);
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Providers List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((provider) => (
              <div
                key={provider.id}
                data-testid={`admin-provider-card-${provider.id}`}
                className="bg-white rounded-lg shadow-md p-6"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{provider.name}</h3>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {provider.region}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{provider.phone}</p>
                <p className="text-xs text-gray-500 mt-1">{provider.service_type}</p>
                
                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={() => handleEditProvider(provider)}
                    data-testid={`edit-provider-${provider.id}`}
                    className="flex-1 flex items-center justify-center space-x-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Edit2 size={16} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteProvider(provider.id)}
                    data-testid={`delete-provider-${provider.id}`}
                    className="flex-1 flex items-center justify-center space-x-1 bg-red-600 text-white py-2 px-3 rounded-lg hover:bg-red-700 text-sm"
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">User Management</h2>
            <button
              onClick={() => {
                setShowCreateUserForm(true);
                setCreateUserForm({ email: '', password: '', role: 'staff' });
              }}
              data-testid="create-user-button"
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus size={18} />
              <span>Create User</span>
            </button>
          </div>

          {/* Create User Form */}
          {showCreateUserForm && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-green-200">
              <h3 className="text-lg font-bold mb-4 text-green-800">Create User Account</h3>
              <p className="text-sm text-gray-600 mb-4">Create an account directly with a default password. The user can change their password after logging in.</p>
              <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                    <input
                      type="email"
                      data-testid="create-email-input"
                      value={createUserForm.email}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Default Password *</label>
                    <input
                      type="text"
                      data-testid="create-password-input"
                      value={createUserForm.password}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Min 6 characters"
                      minLength={6}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                    <select
                      data-testid="create-role-select"
                      value={createUserForm.role}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, role: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    data-testid="submit-create-button"
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 font-medium"
                  >
                    Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateUserForm(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users List - Separated by Role */}
          {/* Admin Users Section */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-lg mr-2">👑</span>
              Administrators ({users.filter(u => u.role === 'admin').length})
            </h3>
            <div className="space-y-4">
              {users.filter(u => u.role === 'admin').length === 0 ? (
                <div className="bg-purple-50 rounded-lg p-4 text-center text-purple-600">
                  No admin users found
                </div>
              ) : (
                users.filter(u => u.role === 'admin').map((user) => (
                  <div
                    key={user.id}
                    data-testid={`user-card-${user.id}`}
                    className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{getUsername(user.email)}</h3>
                          <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                            {user.role}
                          </span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              user.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          Joined: {new Date(user.created_at).toLocaleDateString('en-IE')}
                        </p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeUserRole(user, e.target.value)}
                          data-testid={`role-select-${user.id}`}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                        
                        <button
                          onClick={() => {
                            setResetPasswordUser(user);
                            setNewPassword('');
                            setShowResetPasswordModal(true);
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center space-x-1"
                          title="Reset Password"
                        >
                          <Key size={16} />
                          <span>Reset PW</span>
                        </button>
                        
                        <button
                          onClick={() => handleToggleUserStatus(user)}
                          data-testid={`toggle-status-${user.id}`}
                          className={`px-4 py-2 rounded-lg text-sm font-medium ${
                            user.is_active
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          data-testid={`delete-user-${user.id}`}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                        >
                          <Trash2 size={16} className="inline" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Staff Users Section */}
          <div>
            <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg mr-2">👤</span>
              Staff Members ({users.filter(u => u.role === 'staff').length})
            </h3>
            <div className="space-y-4">
              {users.filter(u => u.role === 'staff').length === 0 ? (
                <div className="bg-blue-50 rounded-lg p-4 text-center text-blue-600">
                  No staff users found
                </div>
              ) : (
                users.filter(u => u.role === 'staff').map((user) => (
                  <div
                    key={user.id}
                    data-testid={`user-card-${user.id}`}
                    className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{getUsername(user.email)}</h3>
                          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                            {user.role}
                          </span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              user.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          Joined: {new Date(user.created_at).toLocaleDateString('en-IE')}
                        </p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeUserRole(user, e.target.value)}
                          data-testid={`role-select-${user.id}`}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                        
                        <button
                          onClick={() => {
                            setResetPasswordUser(user);
                            setNewPassword('');
                            setShowResetPasswordModal(true);
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center space-x-1"
                          title="Reset Password"
                        >
                          <Key size={16} />
                          <span>Reset PW</span>
                        </button>
                        
                        <button
                          onClick={() => handleToggleUserStatus(user)}
                          data-testid={`toggle-status-${user.id}`}
                          className={`px-4 py-2 rounded-lg text-sm font-medium ${
                            user.is_active
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          data-testid={`delete-user-${user.id}`}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                        >
                          <Trash2 size={16} className="inline" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Pending Recurring Bookings</h2>
            <span className="text-sm text-gray-500">
              {pendingBookings.length} pending approval{pendingBookings.length !== 1 ? 's' : ''}
            </span>
          </div>

          {pendingBookings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <CheckCircle className="mx-auto text-green-500" size={48} />
              <p className="text-gray-500 mt-4">No pending bookings to approve!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingBookings.map((group) => (
                <div
                  key={group.group_id}
                  className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {getCarName(group.car_id)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Requested by: <span className="font-medium">{getUsername(group.created_by_email)}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Booked for: <span className="font-medium">{group.user_name}</span>
                      </p>
                    </div>
                    <span className="bg-orange-100 text-orange-800 text-sm px-3 py-1 rounded-full">
                      {group.recurrence_type} × {group.bookings.length}
                    </span>
                  </div>

                  {/* Purpose and Location - Quick View */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {(group.first_booking?.purpose || group.first_booking?.destination_notes) && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <p className="text-xs font-medium text-purple-600 mb-1">📋 Purpose</p>
                        <p className="text-sm text-purple-900">{group.first_booking.purpose || group.first_booking.destination_notes}</p>
                      </div>
                    )}
                    {group.first_booking?.location && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <p className="text-xs font-medium text-blue-600 mb-1">📍 Location (Eircode)</p>
                        <p className="text-sm text-blue-900">{group.first_booking.location}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">First:</span>{' '}
                      {new Date(group.first_booking.start_time).toLocaleString('en-IE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Repeats:</span>{' '}
                      {group.recurrence_type} for {group.bookings.length} occurrences
                    </p>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleApproveBooking(group.group_id)}
                      className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
                    >
                      <Check size={18} />
                      <span>Approve All</span>
                    </button>
                    <button
                      onClick={() => handleRejectBooking(group.group_id)}
                      className="flex-1 flex items-center justify-center space-x-2 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
                    >
                      <X size={18} />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Staff Announcements</h2>
            <button
              onClick={() => {
                setShowMessageForm(true);
                setEditingMessage(null);
                setMessageForm({ title: '', content: '', requires_acknowledgment: true, is_active: true });
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus size={18} />
              <span>New Message</span>
            </button>
          </div>

          {/* Message Form */}
          {showMessageForm && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 border-purple-500">
              <h3 className="text-lg font-bold mb-4">
                {editingMessage ? 'Edit Message' : 'Create New Message'}
              </h3>
              <form onSubmit={handleMessageSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={messageForm.title}
                    onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
                    placeholder="e.g., New Safety Policy Update"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                  <textarea
                    value={messageForm.content}
                    onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                    placeholder="Enter your message for staff..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={4}
                    required
                  />
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={messageForm.requires_acknowledgment}
                      onChange={(e) => setMessageForm({ ...messageForm, requires_acknowledgment: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Require acknowledgment on login</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={messageForm.is_active}
                      onChange={(e) => setMessageForm({ ...messageForm, is_active: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700"
                  >
                    {editingMessage ? 'Update Message' : 'Create Message'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMessageForm(false);
                      setEditingMessage(null);
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Messages List */}
          {messages.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <MessageSquare className="mx-auto text-gray-400" size={48} />
              <p className="text-gray-500 mt-4">No messages yet. Create your first announcement!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`bg-white rounded-lg shadow-md p-6 ${!msg.is_active ? 'opacity-50' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{msg.title}</h3>
                      <p className="text-xs text-gray-500">
                        Posted {new Date(msg.created_at).toLocaleDateString('en-IE')} by {getUsername(msg.created_by)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {msg.requires_acknowledgment && (
                        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                          Requires Ack
                        </span>
                      )}
                      {!msg.is_active && (
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap mb-4">{msg.content}</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditMessage(msg)}
                      className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                    >
                      <Edit2 size={14} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* To-Do List Tab */}
      {activeTab === 'todos' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">To-Do List</h2>
            <button
              onClick={() => {
                setShowTodoForm(true);
                setEditingTodo(null);
                setTodoForm({ title: '', is_mandatory: false, schedule_type: null, schedule_days: [] });
              }}
              data-testid="add-todo-button"
              className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Plus size={18} />
              <span>Add Task</span>
            </button>
          </div>

          {/* To-Do Form */}
          {showTodoForm && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 border-teal-500">
              <h3 className="text-lg font-bold mb-4">
                {editingTodo ? 'Edit Task' : 'Add New Task'}
              </h3>
              <form onSubmit={handleTodoSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task Title *</label>
                  <input
                    type="text"
                    value={todoForm.title}
                    onChange={(e) => setTodoForm({ ...todoForm, title: e.target.value })}
                    placeholder="e.g., Check all vehicles for cleanliness"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
                    <input
                      type="checkbox"
                      checked={todoForm.is_mandatory}
                      onChange={(e) => setTodoForm({ 
                        ...todoForm, 
                        is_mandatory: e.target.checked,
                        schedule_type: e.target.checked ? todoForm.schedule_type : null,
                        schedule_days: e.target.checked ? todoForm.schedule_days : []
                      })}
                      className="w-5 h-5 text-amber-600 rounded"
                    />
                    <div className="flex items-center space-x-2">
                      <Settings size={16} className="text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">Mandatory Task</span>
                    </div>
                  </label>
                  <span className="text-xs text-gray-500">Mandatory tasks auto-reset after 24 hours</span>
                </div>
                
                {/* Scheduling Options - Only shown for mandatory tasks */}
                {todoForm.is_mandatory && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        <Clock size={14} className="inline mr-1" />
                        Schedule Type
                      </label>
                      <select
                        value={todoForm.schedule_type || ''}
                        onChange={(e) => setTodoForm({ 
                          ...todoForm, 
                          schedule_type: e.target.value || null,
                          schedule_days: []
                        })}
                        className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        data-testid="schedule-type-select"
                      >
                        <option value="">One-time (resets after 24h once completed)</option>
                        <option value="daily">Daily (resets every 24 hours)</option>
                        <option value="weekly">Weekly (resets on selected days)</option>
                        <option value="monthly">Monthly (resets on selected dates)</option>
                      </select>
                    </div>
                    
                    {/* Weekly day selector */}
                    {todoForm.schedule_type === 'weekly' && (
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-2">
                          Select Days of the Week
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {DAYS_OF_WEEK.map((day, index) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const newDays = todoForm.schedule_days.includes(index)
                                  ? todoForm.schedule_days.filter(d => d !== index)
                                  : [...todoForm.schedule_days, index];
                                setTodoForm({ ...todoForm, schedule_days: newDays });
                              }}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                todoForm.schedule_days.includes(index)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white border border-blue-300 text-blue-800 hover:bg-blue-100'
                              }`}
                              data-testid={`day-${day.toLowerCase()}`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                        {todoForm.schedule_days.length === 0 && (
                          <p className="text-xs text-amber-600 mt-2">⚠️ Please select at least one day</p>
                        )}
                      </div>
                    )}
                    
                    {/* Monthly date selector */}
                    {todoForm.schedule_type === 'monthly' && (
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-2">
                          Select Days of the Month
                        </label>
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const newDays = todoForm.schedule_days.includes(day)
                                  ? todoForm.schedule_days.filter(d => d !== day)
                                  : [...todoForm.schedule_days, day];
                                setTodoForm({ ...todoForm, schedule_days: newDays });
                              }}
                              className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                                todoForm.schedule_days.includes(day)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white border border-blue-300 text-blue-800 hover:bg-blue-100'
                              }`}
                              data-testid={`date-${day}`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                        {todoForm.schedule_days.length === 0 && (
                          <p className="text-xs text-amber-600 mt-2">⚠️ Please select at least one date</p>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-blue-600">
                      💡 Scheduled tasks will automatically become pending again based on the schedule.
                    </p>
                  </div>
                )}
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700"
                  >
                    {editingTodo ? 'Update Task' : 'Add Task'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTodoForm(false);
                      setEditingTodo(null);
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* To-Do List */}
          {todos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <ListTodo className="mx-auto text-gray-400" size={48} />
              <p className="text-gray-500 mt-4">No tasks yet. Add your first to-do item!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Incomplete Tasks */}
              {todos.filter(t => !t.is_completed).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                    Pending Tasks ({todos.filter(t => !t.is_completed).length})
                  </h3>
                  <div className="space-y-2">
                    {todos.filter(t => !t.is_completed).map((todo) => (
                      <div
                        key={todo.id}
                        className={`bg-white rounded-lg shadow-md p-4 flex items-center justify-between ${
                          todo.is_mandatory ? 'border-l-4 border-amber-500 bg-amber-50' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <button
                            onClick={() => handleToggleTodo(todo)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              todo.is_mandatory
                                ? 'border-amber-500 hover:bg-amber-100'
                                : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {/* Empty circle for incomplete */}
                          </button>
                          <div className="flex-1">
                            <p className={`font-medium ${todo.is_mandatory ? 'text-amber-900' : 'text-gray-900'}`}>
                              {todo.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {todo.is_mandatory && (
                                <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded font-medium">
                                  ⚠️ Mandatory
                                </span>
                              )}
                              {formatSchedule(todo) && (
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-medium">
                                  {formatSchedule(todo)}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                Added by {getUsername(todo.created_by)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditTodo(todo)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
              {todos.filter(t => t.is_completed).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                    Completed ({todos.filter(t => t.is_completed).length})
                  </h3>
                  <div className="space-y-2">
                    {todos.filter(t => t.is_completed).map((todo) => (
                      <div
                        key={todo.id}
                        className="bg-gray-50 rounded-lg shadow-sm p-4 flex items-center justify-between opacity-70"
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <button
                            onClick={() => handleToggleTodo(todo)}
                            className="w-6 h-6 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center"
                          >
                            <Check size={14} className="text-white" />
                          </button>
                          <div className="flex-1">
                            <p className="font-medium text-gray-500 line-through">
                              {todo.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {todo.is_mandatory && (
                                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded">
                                  Mandatory
                                </span>
                              )}
                              {formatSchedule(todo) && (
                                <span className="bg-blue-50 text-blue-500 text-xs px-2 py-0.5 rounded">
                                  {formatSchedule(todo)}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">
                                Completed by {getUsername(todo.completed_by)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            className="p-2 text-red-400 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Fleet Usage Reports</h2>
            <button
              onClick={handleExportReport}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Download size={18} />
              <span>Export CSV</span>
            </button>
          </div>

          {reportLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading report data...</p>
            </div>
          ) : reportData ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <p className="text-3xl font-bold text-indigo-600">{reportData.summary.total_vehicles}</p>
                  <p className="text-sm text-gray-500">Total Vehicles</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{reportData.summary.total_bookings}</p>
                  <p className="text-sm text-gray-500">Total Bookings</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{reportData.summary.approved_bookings}</p>
                  <p className="text-sm text-gray-500">Approved</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <p className="text-3xl font-bold text-orange-600">{reportData.summary.pending_bookings}</p>
                  <p className="text-sm text-gray-500">Pending</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <p className="text-3xl font-bold text-purple-600">{reportData.summary.unique_users}</p>
                  <p className="text-sm text-gray-500">Unique Users</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">{reportData.summary.blocked_vehicles}</p>
                  <p className="text-sm text-gray-500">Blocked</p>
                </div>
              </div>

              {/* Most Booked & Most Used */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Most Booked Cars */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <TrendingUp className="mr-2 text-green-600" size={20} />
                    Most Booked Cars
                  </h3>
                  <div className="space-y-3">
                    {reportData.most_booked.slice(0, 5).map((car, index) => (
                      <div key={car.car_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                          }`}>
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium">{car.car_name}</p>
                            <p className="text-xs text-gray-500">{car.registration}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-indigo-600">{car.total_bookings}</p>
                          <p className="text-xs text-gray-500">bookings</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Most Used Cars (by status updates) */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <Car className="mr-2 text-blue-600" size={20} />
                    Most Active Cars
                  </h3>
                  <div className="space-y-3">
                    {reportData.most_used.slice(0, 5).map((car, index) => (
                      <div key={car.car_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-blue-400' : index === 2 ? 'bg-blue-300' : 'bg-gray-300'
                          }`}>
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium">{car.car_name}</p>
                            <p className="text-xs text-gray-500">{car.registration}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600">{car.in_use_count}</p>
                          <p className="text-xs text-gray-500">times used</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Least Used Cars */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <TrendingDown className="mr-2 text-red-600" size={20} />
                  Least Used Cars
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {reportData.least_used.slice(0, 6).map((car) => (
                    <div key={car.car_id} className={`p-3 rounded-lg border ${
                      car.total_bookings === 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{car.car_name}</p>
                          <p className="text-xs text-gray-500">{car.registration}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${car.total_bookings === 0 ? 'text-red-600' : 'text-gray-600'}`}>
                            {car.total_bookings}
                          </p>
                          <p className="text-xs text-gray-500">bookings</p>
                        </div>
                      </div>
                      {car.total_bookings === 0 && (
                        <p className="text-xs text-red-600 mt-2">⚠️ Never booked</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Full Fleet Table */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Complete Fleet Statistics</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left p-3 font-medium">Vehicle</th>
                        <th className="text-left p-3 font-medium">Registration</th>
                        <th className="text-center p-3 font-medium">Status</th>
                        <th className="text-center p-3 font-medium">Total Bookings</th>
                        <th className="text-center p-3 font-medium">Approved</th>
                        <th className="text-center p-3 font-medium">Times Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.all_cars.map((car) => (
                        <tr key={car.car_id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{car.car_name}</td>
                          <td className="p-3 text-gray-600">{car.registration}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              car.is_blocked ? 'bg-purple-100 text-purple-800' :
                              car.current_status === 'Free' ? 'bg-green-100 text-green-800' :
                              car.current_status === 'In Use' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {car.is_blocked ? 'Blocked' : car.current_status}
                            </span>
                          </td>
                          <td className="p-3 text-center font-medium">{car.total_bookings}</td>
                          <td className="p-3 text-center text-green-600">{car.approved_bookings}</td>
                          <td className="p-3 text-center text-blue-600">{car.in_use_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Daily Availability Report */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <CalendarIcon className="mr-2 text-indigo-600" size={20} />
                    Live Daily Availability Report
                  </h3>
                  <div className="flex items-center space-x-3">
                    <label className="text-sm text-gray-600">Date:</label>
                    <input
                      type="date"
                      value={availabilityDate}
                      onChange={handleDateChange}
                      className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setAvailabilityDate(today);
                        fetchDailyAvailability(today);
                      }}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                    >
                      Today
                    </button>
                  </div>
                </div>

                {dailyAvailabilityLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading availability...</p>
                  </div>
                ) : dailyAvailability ? (
                  <div className="space-y-4">
                    {/* Date Display */}
                    <div className="text-center pb-2 border-b">
                      <p className="text-lg font-semibold text-gray-800">{dailyAvailability.report_date_display}</p>
                      <p className="text-xs text-gray-500">Generated at: {new Date(dailyAvailability.generated_at).toLocaleString('en-IE')}</p>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-indigo-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-indigo-600">{dailyAvailability.summary.total_cars}</p>
                        <p className="text-xs text-gray-600">Active Cars</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-600">{dailyAvailability.summary.total_available_hours}</p>
                        <p className="text-xs text-gray-600">Available Hours</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-red-600">{dailyAvailability.summary.total_booked_hours}</p>
                        <p className="text-xs text-gray-600">Booked Hours</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-blue-600">{dailyAvailability.summary.availability_percentage}%</p>
                        <p className="text-xs text-gray-600">Availability Rate</p>
                      </div>
                    </div>

                    {/* Hourly Grid Legend */}
                    <div className="flex items-center justify-center space-x-4 text-xs">
                      <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
                        <span>Available</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
                        <span>Booked</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 rounded bg-purple-100 border border-purple-300"></div>
                        <span>Recurring</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
                        <span>Past</span>
                      </div>
                    </div>

                    {/* Availability Grid */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left p-2 font-medium sticky left-0 bg-gray-50 min-w-[140px]">Car</th>
                            {dailyAvailability.work_hours.map(hour => (
                              <th key={hour} className="text-center p-1 font-medium min-w-[45px]">
                                {`${hour}:00`}
                              </th>
                            ))}
                            <th className="text-center p-2 font-medium min-w-[60px]">Free</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyAvailability.cars.map((car) => (
                            <tr key={car.car_id} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium sticky left-0 bg-white">
                                <div className="truncate max-w-[130px]" title={car.car_name}>
                                  {car.car_name}
                                </div>
                                <div className="text-[10px] text-gray-400">{car.registration}</div>
                              </td>
                              {car.hourly_availability.map((slot) => (
                                <td 
                                  key={slot.hour} 
                                  className="p-0.5 text-center"
                                  title={slot.booked_by ? `${slot.booked_by}${slot.purpose ? ` - ${slot.purpose}` : ''}` : 'Available'}
                                >
                                  <div className={`w-full h-6 rounded flex items-center justify-center text-[10px] ${
                                    slot.status === 'available' ? 'bg-green-100 text-green-700' :
                                    slot.status === 'recurring' ? 'bg-purple-100 text-purple-700' :
                                    slot.status === 'booked' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-400'
                                  }`}>
                                    {slot.status === 'available' ? '✓' :
                                     slot.status === 'past' ? '-' :
                                     slot.is_recurring ? '🔄' : '●'}
                                  </div>
                                </td>
                              ))}
                              <td className="p-2 text-center">
                                <span className={`font-bold ${
                                  car.stats.available_hours > 10 ? 'text-green-600' :
                                  car.stats.available_hours > 5 ? 'text-amber-600' :
                                  'text-red-600'
                                }`}>
                                  {car.stats.available_hours}h
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarIcon className="mx-auto mb-2 text-gray-400" size={32} />
                    <p>Select a date to view availability</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <BarChart3 className="mx-auto text-gray-400" size={48} />
              <p className="text-gray-500 mt-4">No report data available</p>
            </div>
          )}
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Reset Password</h3>
            <p className="text-sm text-gray-600 mb-4">
              Reset password for: <span className="font-medium">{resetPasswordUser?.email}</span>
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new password (min 6 characters)"
                  minLength={6}
                  required
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                >
                  Reset Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setResetPasswordUser(null);
                    setNewPassword('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
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

export default Admin;