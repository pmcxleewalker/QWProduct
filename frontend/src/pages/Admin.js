import React, { useState, useEffect } from 'react';
import { carAPI, assistanceAPI, userAPI, bookingAPI, messageAPI } from '../api/api';
import { Car, Phone, Plus, Trash2, Edit2, QrCode, Users, Mail, Copy, CheckCircle, Lock, Unlock, Bell, Clock, Check, X, MessageSquare } from 'lucide-react';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('cars');
  const [cars, setCars] = useState([]);
  const [providers, setProviders] = useState([]);
  const [users, setUsers] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCarForm, setShowCarForm] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
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

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'staff',
  });

  const [messageForm, setMessageForm] = useState({
    title: '',
    content: '',
    requires_acknowledgment: true,
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      const promises = [
        carAPI.getAll(),
        assistanceAPI.getAll(),
        bookingAPI.getPending(),
        messageAPI.getAll(),
      ];
      
      if (activeTab === 'users') {
        promises.push(userAPI.getAll());
      }
      
      const results = await Promise.all(promises);
      setCars(results[0].data);
      setProviders(results[1].data);
      setPendingBookings(results[2].data);
      setMessages(results[3].data);
      
      if (results[4]) {
        setUsers(results[4].data);
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
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviteUrl('');

    try {
      const response = await userAPI.invite(inviteForm);
      setSuccess(`Invitation sent to ${inviteForm.email}!`);
      setInviteUrl(response.data.invite_url);
      setShowInviteForm(false);
      setInviteForm({ email: '', role: 'staff' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create invitation');
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6" data-testid="admin-title">Admin Panel</h1>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6" data-testid="success-message">
          <p className="text-green-800">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6" data-testid="error-message">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('cars')}
          data-testid="tab-cars"
          className={`pb-4 px-4 font-medium transition-colors ${
            activeTab === 'cars'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          <Car className="inline mr-2" size={20} />
          Manage Cars
        </button>
        <button
          onClick={() => setActiveTab('providers')}
          data-testid="tab-providers"
          className={`pb-4 px-4 font-medium transition-colors ${
            activeTab === 'providers'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          <Phone className="inline mr-2" size={20} />
          Manage Providers
        </button>
        <button
          onClick={() => setActiveTab('users')}
          data-testid="tab-users"
          className={`pb-4 px-4 font-medium transition-colors ${
            activeTab === 'users'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          <Users className="inline mr-2" size={20} />
          Manage Users
        </button>
      </div>

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
                      <p className="text-gray-600">Tax: {new Date(car.tax_due_date).toLocaleDateString()}</p>
                    )}
                    {car.nct_due_date && (
                      <p className="text-gray-600">NCT: {new Date(car.nct_due_date).toLocaleDateString()}</p>
                    )}
                    {car.service_due_date && (
                      <p className="text-gray-600">Service: {new Date(car.service_due_date).toLocaleDateString()}</p>
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
                setShowInviteForm(true);
                setInviteForm({ email: '', role: 'staff' });
              }}
              data-testid="invite-user-button"
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
              <span>Invite User</span>
            </button>
          </div>

          {/* Invite Form */}
          {showInviteForm && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-bold mb-4">Invite New User</h3>
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                    <input
                      type="email"
                      data-testid="invite-email-input"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                    <select
                      data-testid="invite-role-select"
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    data-testid="submit-invite-button"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                  >
                    Send Invitation
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Invite URL Display */}
          {inviteUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-start">
                <Mail className="text-blue-600 mr-3 mt-1" size={24} />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 mb-2">Invitation Created!</h3>
                  <p className="text-sm text-blue-700 mb-3">Share this link with the user to complete registration:</p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={inviteUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(inviteUrl)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
                    >
                      {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users List */}
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                data-testid={`user-card-${user.id}`}
                className="bg-white rounded-lg shadow-md p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{user.email}</h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
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
                      Joined: {new Date(user.created_at).toLocaleDateString()}
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
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;