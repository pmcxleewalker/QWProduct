import React, { useState, useEffect } from 'react';
import { X, Car, Calendar, Gauge, MapPin, Wrench, CheckCircle } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const EditVehicleModal = ({ vehicle, isOpen, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: '',
    registration: '',
    current_status: 'Free',
    current_mileage: '',
    service_due_mileage: '',
    tax_due_date: '',
    nct_due_date: '',
    base_location: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchLocations();
    }
  }, [isOpen]);

  useEffect(() => {
    if (vehicle && isOpen) {
      setForm({
        name: vehicle.name || '',
        registration: vehicle.registration || '',
        current_status: vehicle.current_status || 'Free',
        current_mileage: vehicle.current_mileage?.toString() || '',
        service_due_mileage: vehicle.service_due_mileage?.toString() || '',
        tax_due_date: vehicle.tax_due_date ? vehicle.tax_due_date.split('T')[0] : '',
        nct_due_date: vehicle.nct_due_date ? vehicle.nct_due_date.split('T')[0] : '',
        base_location: vehicle.base_location || ''
      });
    }
  }, [vehicle, isOpen]);

  const fetchLocations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/locations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocations(response.data.locations || []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const updateData = {
        name: form.name,
        registration: form.registration,
        current_status: form.current_status,
        current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
        service_due_mileage: form.service_due_mileage ? parseInt(form.service_due_mileage) : null,
        tax_due_date: form.tax_due_date || null,
        nct_due_date: form.nct_due_date || null,
        base_location: form.base_location || null
      };

      await axios.put(`${API}/vehicles/${vehicle.id}`, updateData);
      
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update vehicle');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const statusOptions = [
    'Free',
    'In Use',
    'Needs Cleaning',
    'Needs Repair',
    'Reserved'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white">
          <h3 className="text-lg font-bold flex items-center">
            <Car size={20} className="mr-2" />
            Edit Vehicle
          </h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {/* Car Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Car Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              placeholder="e.g., Toyota Corolla"
            />
          </div>

          {/* Registration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Registration <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.registration}
              onChange={(e) => setForm({ ...form, registration: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              placeholder="e.g., 191-KY-1234"
            />
          </div>

          {/* Current Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Status
            </label>
            <select
              value={form.current_status}
              onChange={(e) => setForm({ ...form, current_status: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Mileage Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center space-x-1">
                  <Gauge size={14} />
                  <span>Current Mileage (km)</span>
                </div>
              </label>
              <input
                type="number"
                value={form.current_mileage}
                onChange={(e) => setForm({ ...form, current_mileage: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 45000"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center space-x-1">
                  <Wrench size={14} />
                  <span>Service Due At (km)</span>
                </div>
              </label>
              <input
                type="number"
                value={form.service_due_mileage}
                onChange={(e) => setForm({ ...form, service_due_mileage: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 50000"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">Alert when mileage approaches this value</p>
            </div>
          </div>

          {/* Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center space-x-1">
                  <Calendar size={14} />
                  <span>Tax Due Date</span>
                </div>
              </label>
              <input
                type="date"
                value={form.tax_due_date}
                onChange={(e) => setForm({ ...form, tax_due_date: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center space-x-1">
                  <CheckCircle size={14} />
                  <span>NCT Due Date</span>
                </div>
              </label>
              <input
                type="date"
                value={form.nct_due_date}
                onChange={(e) => setForm({ ...form, nct_due_date: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Base Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center space-x-1">
                <MapPin size={14} />
                <span>Base Location</span>
              </div>
            </label>
            {locations.length > 0 ? (
              <select
                value={form.base_location}
                onChange={(e) => setForm({ ...form, base_location: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Location --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name} {loc.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.base_location}
                onChange={(e) => setForm({ ...form, base_location: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Main Office, Depot A"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              {locations.length > 0 
                ? 'Select from configured locations' 
                : 'Add locations in Settings to use dropdown'}
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditVehicleModal;
