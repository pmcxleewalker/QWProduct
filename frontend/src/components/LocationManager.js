import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Check, X, Loader2, Building2, Star } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LocationManager = ({ onLocationsChange }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    type: 'depot',
    is_default: false
  });
  const [saving, setSaving] = useState(false);

  const locationTypes = [
    { value: 'depot', label: 'Depot / Base' },
    { value: 'office', label: 'Office' },
    { value: 'warehouse', label: 'Warehouse' },
    { value: 'service_center', label: 'Service Center' },
    { value: 'client_site', label: 'Client Site' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const response = await axios.get(`${API}/locations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocations(response.data.locations || []);
      if (onLocationsChange) {
        onLocationsChange(response.data.locations || []);
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      // Don't show toast for auth errors on initial load
      if (error.response?.status !== 401) {
        toast.error('Failed to load locations');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Location name is required');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      if (editingId) {
        // Update existing location
        await axios.put(`${API}/locations/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Location updated');
      } else {
        // Create new location
        await axios.post(`${API}/locations`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Location added');
      }

      // Reset form and refresh
      setFormData({ name: '', address: '', type: 'depot', is_default: false });
      setShowAddForm(false);
      setEditingId(null);
      fetchLocations();
    } catch (error) {
      console.error('Failed to save location:', error);
      toast.error(error.response?.data?.detail || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (location) => {
    setFormData({
      name: location.name,
      address: location.address || '',
      type: location.type || 'depot',
      is_default: location.is_default || false
    });
    setEditingId(location.id);
    setShowAddForm(true);
  };

  const handleDelete = async (locationId) => {
    if (!window.confirm('Are you sure you want to delete this location?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/locations/${locationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Location deleted');
      fetchLocations();
    } catch (error) {
      console.error('Failed to delete location:', error);
      toast.error('Failed to delete location');
    }
  };

  const cancelEdit = () => {
    setFormData({ name: '', address: '', type: 'depot', is_default: false });
    setShowAddForm(false);
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-blue-600" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MapPin className="text-red-500" size={20} />
          <h3 className="font-semibold text-gray-900">Manage Locations</h3>
          <span className="text-sm text-gray-500">({locations.length})</span>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            <span>Add Location</span>
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Dublin Depot, Cork Office"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {locationTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address (Optional)
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g., 123 Main Street, Dublin 2"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_default"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_default" className="text-sm text-gray-700">
              Set as default location
            </label>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              <span>{editingId ? 'Update' : 'Add'} Location</span>
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex items-center space-x-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
            >
              <X size={16} />
              <span>Cancel</span>
            </button>
          </div>
        </form>
      )}

      {/* Location List */}
      {locations.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <MapPin className="mx-auto text-gray-400 mb-2" size={32} />
          <p className="text-gray-500 text-sm">No locations configured yet</p>
          <p className="text-gray-400 text-xs mt-1">Add locations to organize your fleet by area</p>
        </div>
      ) : (
        <div className="space-y-2">
          {locations.map((location) => (
            <div
              key={location.id}
              className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-blue-200 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  location.type === 'depot' ? 'bg-blue-100' :
                  location.type === 'office' ? 'bg-purple-100' :
                  location.type === 'warehouse' ? 'bg-orange-100' :
                  location.type === 'service_center' ? 'bg-green-100' :
                  'bg-gray-100'
                }`}>
                  <Building2 size={18} className={`${
                    location.type === 'depot' ? 'text-blue-600' :
                    location.type === 'office' ? 'text-purple-600' :
                    location.type === 'warehouse' ? 'text-orange-600' :
                    location.type === 'service_center' ? 'text-green-600' :
                    'text-gray-600'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">{location.name}</span>
                    {location.is_default && (
                      <span className="flex items-center space-x-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                        <Star size={10} />
                        <span>Default</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span className="capitalize">{location.type?.replace('_', ' ')}</span>
                    {location.address && (
                      <>
                        <span>•</span>
                        <span>{location.address}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleEdit(location)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit location"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(location.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete location"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-gray-500">
        Locations help organize your fleet by area. Assign vehicles to locations in the vehicle settings, 
        then view the "By Location Summary" in Reports.
      </p>
    </div>
  );
};

export default LocationManager;
