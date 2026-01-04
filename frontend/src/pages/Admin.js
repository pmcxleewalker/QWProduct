import React, { useState, useEffect } from 'react';
import { carAPI, assistanceAPI } from '../api/api';
import { Car, Phone, Plus, Trash2, Edit2, QrCode } from 'lucide-react';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('cars');
  const [cars, setCars] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCarForm, setShowCarForm] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [editingProvider, setEditingProvider] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [carForm, setCarForm] = useState({
    name: '',
    registration: '',
    current_status: 'Free',
  });

  const [providerForm, setProviderForm] = useState({
    region: 'Kerry',
    name: '',
    phone: '',
    service_type: 'Breakdown',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [carsRes, providersRes] = await Promise.all([
        carAPI.getAll(),
        assistanceAPI.getAll(),
      ]);
      setCars(carsRes.data);
      setProviders(providersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
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
      setCarForm({ name: '', registration: '', current_status: 'Free' });
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
    });
    setShowCarForm(true);
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
                setCarForm({ name: '', registration: '', current_status: 'Free' });
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
                <div className="flex space-x-4">
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
                className="bg-white rounded-lg shadow-md p-6"
              >
                <h3 className="text-lg font-bold text-gray-900">{car.name}</h3>
                <p className="text-sm text-gray-600">{car.registration}</p>
                <p className="text-xs text-gray-500 mt-2">Status: {car.current_status}</p>
                
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
              </div>
            ))}
          </div>
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
    </div>
  );
};

export default Admin;