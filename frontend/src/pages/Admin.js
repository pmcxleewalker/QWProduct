import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { carAPI, assistanceAPI, userAPI, bookingAPI, messageAPI, todoAPI, reportsAPI } from '../api/api';
import { Car, Phone, Plus, Trash2, Edit2, QrCode, Users, CheckCircle, Lock, Unlock, Clock, Check, X, MessageSquare, ListTodo, Settings, Key, BarChart3, Download, TrendingUp, TrendingDown, Calendar as CalendarIcon, PieChart, List, MapPin, AlertCircle, Crown, ShieldAlert, ChevronDown, ChevronUp, Activity, Map } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Lazy load the map component to avoid loading Leaflet until needed
const BookingLocationsMap = lazy(() => import('../components/BookingLocationsMap'));

// Helper function to get username from email (removes @domain.com)
const getUsername = (email) => {
  if (!email) return '';
  return email.split('@')[0];
};

const Admin = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
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
    service_due_mileage: '',
    base_location: '',
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

  // Master Admin State
  const MASTER_ADMIN_EMAIL = 'carlyodonovan@bluebirdcare.ie';
  const [showAdminDeleteModal, setShowAdminDeleteModal] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);
  const [masterAdminPassword, setMasterAdminPassword] = useState('');
  const isMasterAdmin = user?.email === MASTER_ADMIN_EMAIL;

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
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [bookingChartsData, setBookingChartsData] = useState(null);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [bookingsDetailSubTab, setBookingsDetailSubTab] = useState('list'); // 'list' or 'charts'
  const [carsWithoutBookings, setCarsWithoutBookings] = useState(null);
  const [dailyReportDate, setDailyReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReportLoading, setDailyReportLoading] = useState(false);
  const [dailyAvailabilityTab, setDailyAvailabilityTab] = useState('overview'); // overview, by-location, timeline, trends
  const [bookingDetailsCollapsed, setBookingDetailsCollapsed] = useState(false);

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
      fetchReportData(reportStartDate, reportEndDate);
      fetchBookingsDetailReport(reportStartDate, reportEndDate);
      fetchBookingChartsData(reportStartDate, reportEndDate);
      fetchCarsWithoutBookings(dailyReportDate);
    }
  }, [activeTab]);

  const fetchReportData = async (startDate, endDate) => {
    setReportLoading(true);
    try {
      const response = await reportsAPI.getFleetUsage(startDate || null, endDate || null);
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setReportLoading(false);
    }
  };

  const fetchBookingChartsData = async (startDate, endDate) => {
    setChartsLoading(true);
    try {
      const response = await reportsAPI.getBookingCharts(startDate || null, endDate || null);
      setBookingChartsData(response.data);
    } catch (error) {
      console.error('Error fetching charts data:', error);
    } finally {
      setChartsLoading(false);
    }
  };

  const fetchCarsWithoutBookings = async (date) => {
    setDailyReportLoading(true);
    try {
      const response = await reportsAPI.getCarsWithoutBookings(date);
      setCarsWithoutBookings(response.data);
    } catch (error) {
      console.error('Error fetching cars without bookings:', error);
    } finally {
      setDailyReportLoading(false);
    }
  };

  const fetchBookingsDetailReport = async (startDate, endDate) => {
    setBookingsDetailLoading(true);
    try {
      const response = await reportsAPI.getBookingsDetail(startDate || null, endDate || null);
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
    
    const headers = ['Vehicle Details', 'Registration', 'Booked By', 'Start Time', 'End Time', 'Location (Eircode)', 'Purpose', 'Status', 'Recurring'];
    const rows = bookingsDetailReport.bookings.map(b => [
      b.vehicle_name,
      b.vehicle_registration,
      b.booked_by,
      b.start_time,
      b.end_time,
      b.location || '',
      b.purpose || '',
      b.status,
      b.is_recurring ? 'Yes' : 'No'
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const dateRange = reportStartDate && reportEndDate ? `_${reportStartDate}_to_${reportEndDate}` : '';
    link.download = `bookings_report${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const handleGenerateReport = () => {
    fetchReportData(reportStartDate, reportEndDate);
    fetchBookingsDetailReport(reportStartDate, reportEndDate);
    fetchBookingChartsData(reportStartDate, reportEndDate);
  };

  const handleDailyReportDateChange = (date) => {
    setDailyReportDate(date);
    fetchCarsWithoutBookings(date);
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

  const exportDailyAvailabilityCSV = () => {
    if (!carsWithoutBookings?.all_cars) return;
    
    const headers = ['Car Name', 'Registration', 'Location', 'Free Hours', 'Utilization %', 'Total Bookings', 'Status'];
    const rows = carsWithoutBookings.all_cars.map(car => [
      car.name,
      car.registration,
      car.location,
      car.free_hours,
      car.utilization_percent,
      car.total_bookings,
      car.is_fully_free ? 'Fully Free' : car.free_minutes === 0 ? 'Fully Booked' : 'Partial'
    ]);
    
    const csvContent = [
      [`Daily Availability Report - ${carsWithoutBookings.date}`],
      [`Total Cars: ${carsWithoutBookings.total_cars}, Fully Free: ${carsWithoutBookings.total_available}, Partially Free: ${carsWithoutBookings.total_partially_free}, Fully Booked: ${carsWithoutBookings.total_fully_booked}`],
      [],
      headers,
      ...rows
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily_availability_${carsWithoutBookings.date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      // Prepare form data - convert empty strings to null for optional fields
      const submitData = {
        ...carForm,
        tax_due_date: carForm.tax_due_date || null,
        nct_due_date: carForm.nct_due_date || null,
        service_due_mileage: carForm.service_due_mileage ? parseInt(carForm.service_due_mileage) : null,
        base_location: carForm.base_location || null,
      };

      if (editingCar) {
        await carAPI.update(editingCar.id, submitData);
        setSuccess('Car updated successfully!');
      } else {
        await carAPI.create(submitData);
        setSuccess('Car created successfully!');
      }
      setShowCarForm(false);
      setEditingCar(null);
      setCarForm({ name: '', registration: '', current_status: 'Free', tax_due_date: '', nct_due_date: '', service_due_mileage: '', base_location: '' });
      fetchData();
    } catch (err) {
      // Handle validation errors properly
      const errorDetail = err.response?.data?.detail;
      if (Array.isArray(errorDetail)) {
        // Pydantic validation error - extract message
        const messages = errorDetail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
        setError(messages || 'Validation error');
      } else if (typeof errorDetail === 'object') {
        setError(errorDetail.msg || errorDetail.message || JSON.stringify(errorDetail));
      } else {
        setError(errorDetail || 'Failed to save car');
      }
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
      service_due_mileage: car.service_due_mileage || '',
      base_location: car.base_location || '',
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

  const handleDeleteUser = async (userId, targetUser = null) => {
    // Find the target user if not provided
    const userToDelete = targetUser || users.find(u => u.id === userId);
    
    // Check if target is master admin - cannot delete
    if (userToDelete?.email === MASTER_ADMIN_EMAIL) {
      setError('Cannot delete the Master Admin account');
      return;
    }
    
    // If target is an admin, require master admin approval
    if (userToDelete?.role === 'admin') {
      if (!isMasterAdmin) {
        setError('Only Master Admin (Carly O\'Donovan) can delete admin accounts');
        return;
      }
      // Show the admin delete modal for password confirmation
      setAdminToDelete(userToDelete);
      setShowAdminDeleteModal(true);
      return;
    }
    
    // For staff users, proceed with normal deletion
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
    
    try {
      await userAPI.delete(userId);
      setSuccess('User deactivated successfully');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to deactivate user');
    }
  };

  const handleDeleteAdminConfirm = async () => {
    if (!adminToDelete) return;
    
    try {
      await userAPI.deleteAdmin(adminToDelete.id, masterAdminPassword);
      setSuccess(`Admin ${adminToDelete.email} has been deactivated`);
      setShowAdminDeleteModal(false);
      setAdminToDelete(null);
      setMasterAdminPassword('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete admin. Check your password.');
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
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900" data-testid="admin-title">Admin Panel</h1>
        <span className="text-xs text-gray-400 hidden sm:inline">Fleet Management</span>
      </div>

      {/* Success/Error Messages - Compact */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center" data-testid="success-message">
          <CheckCircle size={16} className="text-green-600 mr-2 flex-shrink-0" />
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6" data-testid="error-message">
          <p className="text-red-800 text-sm sm:text-base">{error}</p>
        </div>
      )}

      {/* Tabs - Clean grouped navigation */}
      <div className="mb-6">
        {/* Primary tabs with action badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Action items with badges - always visible */}
          {pendingBookings.length > 0 && (
            <button
              onClick={() => setActiveTab('approvals')}
              data-testid="tab-approvals"
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === 'approvals'
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
            >
              <Clock size={16} />
              <span>Approvals</span>
              <span className="bg-white text-orange-600 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {pendingBookings.length}
              </span>
            </button>
          )}
          
          {todos.filter(t => !t.is_completed).length > 0 && (
            <button
              onClick={() => setActiveTab('todos')}
              data-testid="tab-todos"
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === 'todos'
                  ? 'bg-teal-500 text-white shadow-md'
                  : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
              }`}
            >
              <ListTodo size={16} />
              <span>Tasks</span>
              <span className="bg-white text-teal-600 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {todos.filter(t => !t.is_completed).length}
              </span>
            </button>
          )}
        </div>

        {/* Main navigation - clean pill tabs */}
        <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('cars')}
            data-testid="tab-cars"
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'cars'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Car size={16} />
            <span>Fleet</span>
          </button>
          
          <button
            onClick={() => setActiveTab('staffmap')}
            data-testid="tab-staffmap"
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'staffmap'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Map size={16} />
            <span>Map</span>
          </button>
          
          <button
            onClick={() => setActiveTab('users')}
            data-testid="tab-users"
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'users'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users size={16} />
            <span>Users</span>
          </button>
          
          <button
            onClick={() => setActiveTab('reports')}
            data-testid="tab-reports"
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'reports'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 size={16} />
            <span>Reports</span>
          </button>
          
          {/* More dropdown for less used items */}
          <div className="relative group">
            <button
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                ['providers', 'messages', 'approvals', 'todos'].includes(activeTab) && 
                !(['approvals', 'todos'].includes(activeTab) && (pendingBookings.length > 0 || todos.filter(t => !t.is_completed).length > 0))
                  ? 'bg-white text-gray-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Activity size={16} />
              <span>More</span>
              <ChevronDown size={14} />
            </button>
            
            {/* Dropdown menu */}
            <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="py-1">
                <button
                  onClick={() => setActiveTab('providers')}
                  data-testid="tab-providers"
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm transition-colors ${
                    activeTab === 'providers' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Phone size={16} />
                  <span>Service Providers</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('messages')}
                  data-testid="tab-messages"
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm transition-colors ${
                    activeTab === 'messages' ? 'bg-purple-50 text-purple-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <MessageSquare size={16} />
                  <span>Announcements</span>
                </button>
                
                {pendingBookings.length === 0 && (
                  <button
                    onClick={() => setActiveTab('approvals')}
                    className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm transition-colors ${
                      activeTab === 'approvals' ? 'bg-orange-50 text-orange-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Clock size={16} />
                    <span>Approvals</span>
                  </button>
                )}
                
                {todos.filter(t => !t.is_completed).length === 0 && (
                  <button
                    onClick={() => setActiveTab('todos')}
                    className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm transition-colors ${
                      activeTab === 'todos' ? 'bg-teal-50 text-teal-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ListTodo size={16} />
                    <span>To-Do List</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* To-Do Alert Banner - Shows only when there are pending mandatory tasks and not on todos tab */}
      {activeTab !== 'todos' && todos.filter(t => !t.is_completed && t.is_mandatory).length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle size={18} className="text-amber-600" />
            <span className="text-sm text-amber-800">
              <strong>{todos.filter(t => !t.is_completed && t.is_mandatory).length}</strong> mandatory task(s) pending
            </span>
          </div>
          <button
            onClick={() => setActiveTab('todos')}
            className="text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            View →
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
                setCarForm({ name: '', registration: '', current_status: 'Free', tax_due_date: '', nct_due_date: '', service_due_mileage: '' });
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Service Due At (km)</label>
                      <input
                        type="number"
                        data-testid="car-service-mileage-input"
                        value={carForm.service_due_mileage || ''}
                        onChange={(e) => setCarForm({ ...carForm, service_due_mileage: e.target.value ? parseInt(e.target.value) : '' })}
                        placeholder="e.g. 50000"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Base Location</label>
                      <select
                        data-testid="car-base-location-select"
                        value={carForm.base_location || ''}
                        onChange={(e) => setCarForm({ ...carForm, base_location: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Location</option>
                        <option value="Tralee">Tralee</option>
                        <option value="Bantry">Bantry</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Used for location-based reports</p>
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
                
                {/* Mileage Display - Always Visible */}
                <div className={`mt-3 p-3 rounded-lg text-sm border ${
                  car.current_mileage && car.service_due_mileage && car.current_mileage >= car.service_due_mileage
                    ? 'bg-red-50 border-red-300'
                    : car.current_mileage && car.service_due_mileage && car.current_mileage >= (car.service_due_mileage - 500)
                    ? 'bg-orange-50 border-orange-300'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-medium">📍 Current Mileage:</span>
                    <span className={`font-bold text-lg ${
                      car.current_mileage && car.service_due_mileage && car.current_mileage >= car.service_due_mileage
                        ? 'text-red-600'
                        : car.current_mileage && car.service_due_mileage && car.current_mileage >= (car.service_due_mileage - 500)
                        ? 'text-orange-600'
                        : 'text-blue-600'
                    }`}>
                      {car.current_mileage ? `${car.current_mileage.toLocaleString()} km` : 'Not recorded'}
                    </span>
                  </div>
                  
                  {car.service_due_mileage && (
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-gray-500">🔧 Service Due At:</span>
                      <span className="text-gray-700 font-medium">{car.service_due_mileage.toLocaleString()} km</span>
                    </div>
                  )}
                  
                  {car.current_mileage && car.service_due_mileage && car.current_mileage >= car.service_due_mileage && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-center">
                      <p className="text-red-700 font-bold text-sm">⚠️ SERVICE OVERDUE!</p>
                    </div>
                  )}
                  {car.current_mileage && car.service_due_mileage && car.current_mileage >= (car.service_due_mileage - 500) && car.current_mileage < car.service_due_mileage && (
                    <div className="mt-2 p-2 bg-orange-100 rounded text-center">
                      <p className="text-orange-700 font-semibold text-sm">⚠️ Service approaching</p>
                    </div>
                  )}
                  
                  {car.last_mileage_update && (
                    <p className="text-gray-400 text-[10px] mt-2">
                      Last updated: {new Date(car.last_mileage_update).toLocaleString('en-IE')}
                      {car.last_mileage_updated_by && ` by ${car.last_mileage_updated_by}`}
                    </p>
                  )}
                </div>
                
                {/* Compliance Dates Display */}
                {(car.tax_due_date || car.nct_due_date) && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs">
                    {car.tax_due_date && (
                      <p className="text-gray-600">Tax: {new Date(car.tax_due_date).toLocaleDateString('en-IE')}</p>
                    )}
                    {car.nct_due_date && (
                      <p className="text-gray-600">NCT: {new Date(car.nct_due_date).toLocaleDateString('en-IE')}</p>
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
                users.filter(u => u.role === 'admin').map((adminUser) => {
                  const isThisMasterAdmin = adminUser.email === MASTER_ADMIN_EMAIL;
                  return (
                  <div
                    key={adminUser.id}
                    data-testid={`user-card-${adminUser.id}`}
                    className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
                      isThisMasterAdmin ? 'border-yellow-500 bg-gradient-to-r from-yellow-50 to-white' : 'border-purple-500'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {isThisMasterAdmin && (
                            <Crown size={20} className="text-yellow-500" />
                          )}
                          <h3 className="text-lg font-bold text-gray-900">{getUsername(adminUser.email)}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            isThisMasterAdmin 
                              ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {isThisMasterAdmin ? '👑 Master Admin' : adminUser.role}
                          </span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              adminUser.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {adminUser.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          Joined: {new Date(adminUser.created_at).toLocaleDateString('en-IE')}
                        </p>
                        {isThisMasterAdmin && (
                          <p className="text-xs text-amber-600 mt-1 flex items-center">
                            <ShieldAlert size={12} className="mr-1" />
                            Master Admin has elevated permissions over all users
                          </p>
                        )}
                      </div>
                      
                      <div className="flex space-x-2">
                        {/* Role selector - Master Admin can change anyone, others cannot change Master Admin */}
                        {!isThisMasterAdmin && (
                          <select
                            value={adminUser.role}
                            onChange={(e) => handleChangeUserRole(adminUser, e.target.value)}
                            data-testid={`role-select-${adminUser.id}`}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                        
                        {/* Reset Password - Only Master Admin can reset Master Admin's password */}
                        <button
                          onClick={() => {
                            if (isThisMasterAdmin && !isMasterAdmin) {
                              setError('Only Master Admin can change their own password');
                              return;
                            }
                            setResetPasswordUser(adminUser);
                            setNewPassword('');
                            setShowResetPasswordModal(true);
                          }}
                          className={`px-3 py-2 rounded-lg text-sm flex items-center space-x-1 ${
                            isThisMasterAdmin && !isMasterAdmin
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={isThisMasterAdmin && !isMasterAdmin ? 'Only Master Admin can change their own password' : 'Reset Password'}
                        >
                          <Key size={16} />
                          <span>Reset PW</span>
                          {isThisMasterAdmin && !isMasterAdmin && <span className="text-xs">🔒</span>}
                        </button>
                        
                        {!isThisMasterAdmin && (
                          <>
                            <button
                              onClick={() => handleToggleUserStatus(adminUser)}
                              data-testid={`toggle-status-${adminUser.id}`}
                              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                adminUser.is_active
                                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              {adminUser.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            
                            <button
                              onClick={() => handleDeleteUser(adminUser.id, adminUser)}
                              data-testid={`delete-user-${adminUser.id}`}
                              className={`px-4 py-2 rounded-lg text-sm flex items-center space-x-1 ${
                                isMasterAdmin 
                                  ? 'bg-red-600 text-white hover:bg-red-700'
                                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              }`}
                              title={isMasterAdmin ? 'Delete Admin' : 'Only Master Admin can delete admins'}
                            >
                              <Trash2 size={16} />
                              {!isMasterAdmin && <span className="text-xs">🔒</span>}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )})
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
            <div>
              <h2 className="text-xl font-bold">Pending Recurring Bookings</h2>
              <span className="text-sm text-gray-500">
                {pendingBookings.length} pending approval{pendingBookings.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => setShowClearBookingsModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Trash2 size={18} />
              <span>Clear Bookings</span>
            </button>
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
          {/* Header with Date Range Filter for ALL reports */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold">Fleet Reports</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">From:</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">To:</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleGenerateReport}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                Apply Dates
              </button>
              <button
                onClick={exportSummaryCSV}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                <Download size={16} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Date Range Indicator */}
          {(reportStartDate || reportEndDate) && (
            <div className="mb-4 p-2 bg-indigo-50 rounded-lg text-sm text-indigo-700 flex items-center justify-between">
              <span>
                📅 Showing data from <strong>{reportStartDate || 'beginning'}</strong> to <strong>{reportEndDate || 'present'}</strong>
              </span>
              <button
                onClick={() => {
                  setReportStartDate('');
                  setReportEndDate('');
                  fetchReportData(null, null);
                  fetchBookingsDetailReport(null, null);
                  fetchBookingChartsData(null, null);
                }}
                className="text-indigo-600 hover:text-indigo-800 text-xs underline"
              >
                Clear dates
              </button>
            </div>
          )}

          {reportLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading report data...</p>
            </div>
          ) : reportData ? (
            <div className="space-y-6">
              {/* Summary Cards - Date-filtered numbers */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <p className="text-3xl font-bold text-indigo-600">{reportData.summary.total_vehicles}</p>
                  <p className="text-sm text-gray-500">Total Vehicles</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{reportData.summary.total_bookings}</p>
                  <p className="text-sm text-gray-500">Total Bookings</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <p className="text-3xl font-bold text-orange-600">{reportData.summary.pending_bookings}</p>
                  <p className="text-sm text-gray-500">Pending Bookings</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">{reportData.summary.blocked_vehicles}</p>
                  <p className="text-sm text-gray-500">Blocked Cars</p>
                </div>
              </div>

              {/* Most Booked Cars */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="mr-2 text-green-600" size={20} />
                  Most Booked Cars (Ranked)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {reportData.most_booked.slice(0, 9).map((car, index) => (
                    <div key={car.car_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{car.car_name}</p>
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

              {/* Daily Report - Cars availability by location - ENHANCED */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <MapPin className="mr-2 text-blue-600" size={20} />
                    Daily Availability Report
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Date:</label>
                      <input
                        type="date"
                        value={dailyReportDate}
                        onChange={(e) => handleDailyReportDateChange(e.target.value)}
                        className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={exportDailyAvailabilityCSV}
                      disabled={!carsWithoutBookings?.all_cars}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                    >
                      <Download size={14} />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {/* Multi-tab navigation */}
                <div className="flex flex-wrap gap-1 mb-4 bg-gray-100 rounded-lg p-1">
                  {[
                    { id: 'overview', label: '📊 Overview', icon: PieChart },
                    { id: 'by-location', label: '📍 By Location', icon: MapPin },
                    { id: 'timeline', label: '⏰ Timeline', icon: Clock },
                    { id: 'details', label: '📋 Details', icon: List },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setDailyAvailabilityTab(tab.id)}
                      className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        dailyAvailabilityTab === tab.id
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
                
                {dailyReportLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : carsWithoutBookings ? (
                  <div>
                    {/* Overview Tab - Pie Chart & Summary */}
                    {dailyAvailabilityTab === 'overview' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                          <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-blue-600">{carsWithoutBookings.total_cars}</p>
                            <p className="text-sm text-blue-700">Total Fleet</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-green-600">{carsWithoutBookings.total_available}</p>
                            <p className="text-sm text-green-700">Fully Free</p>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-amber-600">{carsWithoutBookings.total_partially_free}</p>
                            <p className="text-sm text-amber-700">Partially Free</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-red-600">{carsWithoutBookings.total_fully_booked}</p>
                            <p className="text-sm text-red-700">Fully Booked</p>
                          </div>
                        </div>

                        {/* Pie Chart Visualization */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="border rounded-lg p-4">
                            <h4 className="font-bold text-gray-900 mb-4">🥧 Fleet Availability</h4>
                            <div className="flex items-center justify-center">
                              <div className="relative w-48 h-48">
                                {/* Simple CSS pie chart */}
                                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                  {(() => {
                                    const total = carsWithoutBookings.total_cars || 1;
                                    const free = (carsWithoutBookings.total_available / total) * 100;
                                    const partial = (carsWithoutBookings.total_partially_free / total) * 100;
                                    const booked = (carsWithoutBookings.total_fully_booked / total) * 100;
                                    let offset = 0;
                                    
                                    return (
                                      <>
                                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#22c55e" strokeWidth="20"
                                          strokeDasharray={`${free * 2.51} ${251 - free * 2.51}`}
                                          strokeDashoffset={-offset * 2.51} />
                                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f59e0b" strokeWidth="20"
                                          strokeDasharray={`${partial * 2.51} ${251 - partial * 2.51}`}
                                          strokeDashoffset={-(offset + free) * 2.51} />
                                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ef4444" strokeWidth="20"
                                          strokeDasharray={`${booked * 2.51} ${251 - booked * 2.51}`}
                                          strokeDashoffset={-(offset + free + partial) * 2.51} />
                                      </>
                                    );
                                  })()}
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-800">{carsWithoutBookings.total_cars}</p>
                                    <p className="text-xs text-gray-500">Total</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Legend */}
                            <div className="flex justify-center gap-4 mt-4">
                              <div className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                <span className="text-xs">Free ({carsWithoutBookings.total_available})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                                <span className="text-xs">Partial ({carsWithoutBookings.total_partially_free})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                                <span className="text-xs">Booked ({carsWithoutBookings.total_fully_booked})</span>
                              </div>
                            </div>
                          </div>

                          {/* Location Summary */}
                          <div className="border rounded-lg p-4">
                            <h4 className="font-bold text-gray-900 mb-4">📍 By Location Summary</h4>
                            <div className="space-y-3">
                              {carsWithoutBookings.location_summaries && Object.entries(carsWithoutBookings.location_summaries).map(([loc, stats]) => (
                                <div key={loc} className="p-3 bg-gray-50 rounded-lg">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium">{loc}</span>
                                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{stats.total_cars} cars</span>
                                  </div>
                                  <div className="flex gap-2 text-xs">
                                    <span className="text-green-600">✓ {stats.fully_free} free</span>
                                    <span className="text-amber-600">◐ {stats.partially_free} partial</span>
                                    <span className="text-red-600">✗ {stats.fully_booked} booked</span>
                                  </div>
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Utilization:</span>
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats.avg_utilization}%` }}></div>
                                    </div>
                                    <span className="text-xs font-medium">{stats.avg_utilization}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* By Location Tab */}
                    {dailyAvailabilityTab === 'by-location' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {['Tralee', 'Bantry', 'Unassigned'].map(location => {
                          const locationCars = carsWithoutBookings.cars_by_location?.[location] || [];
                          const colorClass = location === 'Tralee' ? 'green' : location === 'Bantry' ? 'blue' : 'gray';
                          
                          return (
                            <div key={location} className={`border rounded-lg p-4 ${location === 'Unassigned' && locationCars.length > 0 ? 'lg:col-span-2' : ''}`}>
                              <h4 className="font-bold text-gray-900 mb-3 flex items-center">
                                <span className={`w-3 h-3 bg-${colorClass}-500 rounded-full mr-2`}></span>
                                {location}
                                <span className={`ml-2 px-2 py-0.5 bg-${colorClass}-100 text-${colorClass}-800 text-xs rounded-full`}>
                                  {locationCars.length} cars
                                </span>
                              </h4>
                              {locationCars.length > 0 ? (
                                <div className={`grid ${location === 'Unassigned' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                  {locationCars.map(car => (
                                    <div key={car.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                      <div>
                                        <p className="font-medium text-sm">{car.name}</p>
                                        <p className="text-xs text-gray-500">{car.registration}</p>
                                      </div>
                                      <div className="text-right">
                                        <span className={`text-xs px-2 py-1 rounded ${
                                          car.is_fully_free ? 'bg-green-100 text-green-700' :
                                          car.free_minutes === 0 ? 'bg-red-100 text-red-700' :
                                          'bg-amber-100 text-amber-700'
                                        }`}>
                                          {car.free_hours}h free
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 italic">No cars in {location}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Timeline Tab - Hourly Availability */}
                    {dailyAvailabilityTab === 'timeline' && carsWithoutBookings.time_slots && (
                      <div>
                        <h4 className="font-bold text-gray-900 mb-4">⏰ Hourly Availability (8am - 6pm)</h4>
                        <div className="overflow-x-auto">
                          <div className="flex gap-1 min-w-max">
                            {Object.entries(carsWithoutBookings.time_slots).map(([time, data]) => {
                              const freePercent = (data.free / data.total) * 100;
                              return (
                                <div key={time} className="flex flex-col items-center w-16">
                                  <div className="h-32 w-10 bg-gray-200 rounded-t relative flex flex-col-reverse overflow-hidden">
                                    <div 
                                      className="bg-green-500 w-full transition-all"
                                      style={{ height: `${freePercent}%` }}
                                    ></div>
                                    <div 
                                      className="bg-red-400 w-full"
                                      style={{ height: `${100 - freePercent}%` }}
                                    ></div>
                                  </div>
                                  <div className="text-xs font-medium mt-1">{time}</div>
                                  <div className="text-xs text-green-600">{data.free} free</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex justify-center gap-6 mt-4">
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-green-500 rounded"></span>
                            <span className="text-xs">Available</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-red-400 rounded"></span>
                            <span className="text-xs">Booked</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Details Tab - All Cars with Info */}
                    {dailyAvailabilityTab === 'details' && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="text-left p-2">Car</th>
                              <th className="text-left p-2">Location</th>
                              <th className="text-center p-2">Free Hours</th>
                              <th className="text-center p-2">Utilization</th>
                              <th className="text-center p-2">Bookings</th>
                              <th className="text-center p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {carsWithoutBookings.all_cars?.sort((a, b) => b.free_hours - a.free_hours).map(car => (
                              <tr key={car.id} className="border-b hover:bg-gray-50">
                                <td className="p-2">
                                  <div className="font-medium">{car.name}</div>
                                  <div className="text-xs text-gray-500">{car.registration}</div>
                                </td>
                                <td className="p-2">{car.location}</td>
                                <td className="p-2 text-center font-medium">{car.free_hours}h</td>
                                <td className="p-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-16">
                                      <div className={`h-2 rounded-full ${
                                        car.utilization_percent > 80 ? 'bg-red-500' :
                                        car.utilization_percent > 50 ? 'bg-amber-500' : 'bg-green-500'
                                      }`} style={{ width: `${car.utilization_percent}%` }}></div>
                                    </div>
                                    <span className="text-xs">{car.utilization_percent}%</span>
                                  </div>
                                </td>
                                <td className="p-2 text-center">{car.total_bookings}</td>
                                <td className="p-2 text-center">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    car.is_fully_free ? 'bg-green-100 text-green-700' :
                                    car.free_minutes === 0 ? 'bg-red-100 text-red-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {car.is_fully_free ? 'Free' : car.free_minutes === 0 ? 'Booked' : 'Partial'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Select a date to see car availability</p>
                )}
              </div>

              {/* Booking Details Report with Sub-tabs - COLLAPSIBLE */}
              <div className="bg-white rounded-lg shadow-md">
                <div 
                  className="flex justify-between items-center p-6 cursor-pointer hover:bg-gray-50"
                  onClick={() => setBookingDetailsCollapsed(!bookingDetailsCollapsed)}
                >
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <BarChart3 className="mr-2 text-indigo-600" size={20} />
                    Booking Details Report
                    {bookingsDetailReport && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({bookingsDetailReport.total_records} records)
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-4">
                    {bookingsDetailReport?.double_up_calls > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                        👥 {bookingsDetailReport.double_up_calls} Double-up calls
                      </span>
                    )}
                    {bookingDetailsCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                  </div>
                </div>

                {!bookingDetailsCollapsed && (
                  <div className="p-6 pt-0">
                    {/* Date Range Selector for Booking Details */}
                    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">From:</label>
                        <input
                          type="date"
                          value={reportStartDate}
                          onChange={(e) => setReportStartDate(e.target.value)}
                          className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">To:</label>
                        <input
                          type="date"
                          value={reportEndDate}
                          onChange={(e) => setReportEndDate(e.target.value)}
                          className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        onClick={() => {
                          fetchBookingsDetailReport(reportStartDate, reportEndDate);
                          fetchBookingChartsData(reportStartDate, reportEndDate);
                        }}
                        className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                      >
                        Filter
                      </button>
                    </div>

                    {/* Sub-tabs: List vs Charts */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setBookingsDetailSubTab('list')}
                          className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            bookingsDetailSubTab === 'list'
                              ? 'bg-white text-indigo-600 shadow-sm'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          <List size={16} />
                          <span>List</span>
                        </button>
                        <button
                          onClick={() => setBookingsDetailSubTab('charts')}
                          className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            bookingsDetailSubTab === 'charts'
                              ? 'bg-white text-indigo-600 shadow-sm'
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          <PieChart size={16} />
                          <span>Charts</span>
                        </button>
                      </div>
                      
                      {bookingsDetailSubTab === 'list' && (
                        <button
                          onClick={exportBookingsDetailCSV}
                          disabled={!bookingsDetailReport?.bookings?.length}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                        >
                          <Download size={16} />
                          <span>Export CSV</span>
                        </button>
                      )}
                    </div>

                {/* List View */}
                {bookingsDetailSubTab === 'list' && (
                  <>
                    {bookingsDetailLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading report...</p>
                      </div>
                    ) : bookingsDetailReport?.bookings?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="text-left p-3 font-medium">Vehicle Details</th>
                              <th className="text-left p-3 font-medium">Booked By</th>
                              <th className="text-left p-3 font-medium">Start Time</th>
                              <th className="text-left p-3 font-medium">End Time</th>
                              <th className="text-left p-3 font-medium">Location</th>
                              <th className="text-left p-3 font-medium">Purpose</th>
                              <th className="text-center p-3 font-medium">Type</th>
                              <th className="text-center p-3 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookingsDetailReport.bookings.slice(0, 100).map((booking, index) => (
                              <tr key={index} className={`border-b hover:bg-gray-50 ${booking.is_recurring ? 'bg-purple-50' : ''} ${booking.is_double_up_call ? 'bg-amber-50' : ''}`}>
                                <td className="p-3">
                                  <div className="font-medium">{booking.vehicle_name}</div>
                                  <div className="text-xs text-gray-500">{booking.vehicle_registration}</div>
                                </td>
                                <td className="p-3 font-medium">{booking.booked_by}</td>
                                <td className="p-3 text-gray-600">{booking.start_time}</td>
                                <td className="p-3 text-gray-600">{booking.end_time}</td>
                                <td className="p-3 text-gray-600">{booking.location || '-'}</td>
                                <td className="p-3 text-gray-600 max-w-xs truncate" title={booking.purpose}>{booking.purpose || '-'}</td>
                                <td className="p-3 text-center">
                                  {booking.is_double_up_call && (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs mr-1" title="Double up call">👥</span>
                                  )}
                                  {booking.is_recurring && (
                                    <span className="text-purple-600" title="Recurring booking">🔄</span>
                                  )}
                                  {!booking.is_double_up_call && !booking.is_recurring && '-'}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    booking.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    booking.status === 'pending_approval' ? 'bg-orange-100 text-orange-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {booking.status === 'pending_approval' ? 'Pending' : booking.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {bookingsDetailReport.bookings.length > 100 && (
                          <p className="text-center text-sm text-gray-500 mt-4">
                            Showing 100 of {bookingsDetailReport.total_records} records. Export CSV for full data.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-8">No bookings found for the selected date range</p>
                    )}
                  </>
                )}

                {/* Charts View */}
                {bookingsDetailSubTab === 'charts' && (
                  <>
                    {chartsLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading charts...</p>
                      </div>
                    ) : bookingChartsData ? (
                      <div className="space-y-6">
                        {/* Total Bookings Summary */}
                        <div className="p-4 bg-indigo-50 rounded-lg text-center">
                          <p className="text-4xl font-bold text-indigo-600">{bookingChartsData.total_bookings}</p>
                          <p className="text-sm text-indigo-700">Total Bookings in Period</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Bookings by Status */}
                          <div className="border rounded-lg p-4">
                            <h4 className="font-bold text-gray-900 mb-4">📊 Bookings by Status</h4>
                            <div className="space-y-3">
                              {bookingChartsData.by_status.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <span className={`w-3 h-3 rounded-full ${
                                      item.status === 'approved' ? 'bg-green-500' :
                                      item.status === 'pending_approval' ? 'bg-orange-500' :
                                      item.status === 'rejected' ? 'bg-red-500' : 'bg-gray-500'
                                    }`}></span>
                                    <span className="text-sm capitalize">{item.status.replace('_', ' ')}</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-32 bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${
                                          item.status === 'approved' ? 'bg-green-500' :
                                          item.status === 'pending_approval' ? 'bg-orange-500' :
                                          item.status === 'rejected' ? 'bg-red-500' : 'bg-gray-500'
                                        }`}
                                        style={{ width: `${Math.min((item.count / bookingChartsData.total_bookings) * 100, 100)}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">{item.count}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Double Up Calls */}
                          <div className="border rounded-lg p-4">
                            <h4 className="font-bold text-gray-900 mb-4">👥 Double Up Calls</h4>
                            <div className="flex items-center justify-center space-x-8">
                              <div className="text-center">
                                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                                  <span className="text-2xl font-bold text-amber-600">{bookingChartsData.double_up_calls?.double_up || 0}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">Double Up</p>
                              </div>
                              <div className="text-center">
                                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                                  <span className="text-2xl font-bold text-blue-600">{bookingChartsData.double_up_calls?.single || 0}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">Single</p>
                              </div>
                            </div>
                          </div>

                          {/* Recurring vs One-time */}
                          <div className="border rounded-lg p-4">
                            <h4 className="font-bold text-gray-900 mb-4">🔄 Recurring vs One-time</h4>
                            <div className="flex items-center justify-center space-x-8">
                              <div className="text-center">
                                <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mx-auto">
                                  <span className="text-2xl font-bold text-purple-600">{bookingChartsData.recurring_vs_onetime.recurring}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">Recurring</p>
                              </div>
                              <div className="text-center">
                                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                                  <span className="text-2xl font-bold text-blue-600">{bookingChartsData.recurring_vs_onetime.one_time}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">One-time</p>
                              </div>
                            </div>
                          </div>

                          {/* Bookings by Day of Week */}
                          <div className="border rounded-lg p-4">
                            <h4 className="font-bold text-gray-900 mb-4">📅 Bookings by Day of Week</h4>
                            <div className="space-y-2">
                              {bookingChartsData.by_day_of_week.map((item, idx) => {
                                const maxCount = Math.max(...bookingChartsData.by_day_of_week.map(d => d.count));
                                return (
                                  <div key={idx} className="flex items-center space-x-2">
                                    <span className="text-xs w-12 text-gray-600">{item.day.slice(0, 3)}</span>
                                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                                      <div
                                        className="bg-indigo-500 h-4 rounded-full flex items-center justify-end pr-2"
                                        style={{ width: maxCount > 0 ? `${Math.max((item.count / maxCount) * 100, 5)}%` : '5%' }}
                                      >
                                        <span className="text-xs text-white font-medium">{item.count}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Top Users */}
                          <div className="border rounded-lg p-4">
                            <h4 className="font-bold text-gray-900 mb-4">👤 Top Bookers</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {bookingChartsData.by_user.slice(0, 10).map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <div className="flex items-center space-x-2">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                      idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-gray-300'
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <span className="text-sm truncate max-w-32">{item.user}</span>
                                  </div>
                                  <span className="text-sm font-bold text-indigo-600">{item.count}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Top Cars */}
                          <div className="border rounded-lg p-4">
                            <h4 className="font-bold text-gray-900 mb-4">🚗 Top Booked Cars</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {bookingChartsData.by_car.slice(0, 10).map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <div className="flex items-center space-x-2">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                      idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-gray-300'
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <span className="text-sm truncate max-w-32">{item.car}</span>
                                  </div>
                                  <span className="text-sm font-bold text-indigo-600">{item.count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-8">No chart data available</p>
                    )}
                  </>
                )}
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

      {/* Admin Delete Confirmation Modal - Master Admin Only */}
      {showAdminDeleteModal && adminToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <ShieldAlert className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-600">Delete Admin Account</h3>
                <p className="text-sm text-gray-500">Master Admin Authorization Required</p>
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-amber-800">
                You are about to delete the admin account: <br />
                <span className="font-bold">{adminToDelete.email}</span>
              </p>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              To confirm this action, please enter your Master Admin password:
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Crown size={14} className="inline mr-1 text-yellow-500" />
                  Master Admin Password *
                </label>
                <input
                  type="password"
                  value={masterAdminPassword}
                  onChange={(e) => setMasterAdminPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Enter your password to confirm"
                  required
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={handleDeleteAdminConfirm}
                  disabled={!masterAdminPassword}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminDeleteModal(false);
                    setAdminToDelete(null);
                    setMasterAdminPassword('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Bookings Modal */}
      {showClearBookingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-red-600">⚠️ Clear Bookings</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete ALL bookings within the selected date range. This action cannot be undone.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                <input
                  type="date"
                  value={clearStartDate}
                  onChange={(e) => setClearStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                <input
                  type="date"
                  value={clearEndDate}
                  onChange={(e) => setClearEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <div className="flex space-x-4 pt-2">
                <button
                  onClick={handleClearBookings}
                  disabled={clearingBookings || !clearStartDate || !clearEndDate}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clearingBookings ? 'Clearing...' : 'Clear Bookings'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowClearBookingsModal(false);
                    setClearStartDate('');
                    setClearEndDate('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Locations Map Tab */}
      {activeTab === 'staffmap' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center">
              <Map className="mr-2 text-emerald-600" size={24} />
              Booking Locations Map
            </h2>
          </div>
          <Suspense fallback={
            <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading map...</p>
              </div>
            </div>
          }>
            <BookingLocationsMap height="500px" showDatePicker={true} />
          </Suspense>
        </div>
      )}

    </div>
  );
};

export default Admin;