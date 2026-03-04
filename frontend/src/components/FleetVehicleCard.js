import React, { useState } from 'react';
import { 
  Car, QrCode, Edit2, Trash2, Lock, Unlock, Gauge, Calendar, 
  AlertTriangle, Clock, MapPin, Wrench, Sparkles, MoreHorizontal,
  CheckCircle
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FleetVehicleCard = ({ 
  vehicle, 
  onQRClick, 
  onEditClick, 
  onDeleteClick, 
  onRefresh,
  isAdmin 
}) => {
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('Service');
  const [blockNotes, setBlockNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isBlocked = vehicle.is_blocked;
  const currentMileage = vehicle.current_mileage || 0;
  const serviceDue = vehicle.service_due_mileage || 0;
  const mileageRemaining = serviceDue > 0 ? serviceDue - currentMileage : null;

  // Determine service status
  const getServiceStatus = () => {
    if (!serviceDue || !currentMileage) return null;
    if (mileageRemaining <= 0) return { type: 'overdue', color: 'text-red-600 bg-red-50' };
    if (mileageRemaining <= 500) return { type: 'urgent', color: 'text-orange-600 bg-orange-50' };
    if (mileageRemaining <= 1000) return { type: 'warning', color: 'text-yellow-600 bg-yellow-50' };
    return null;
  };

  const serviceStatus = getServiceStatus();

  const handleBlock = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API}/vehicles/${vehicle.id}/block`, {
        reason: blockReason,
        notes: blockNotes
      });
      setShowBlockModal(false);
      setBlockNotes('');
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to block vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API}/vehicles/${vehicle.id}/unblock`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to unblock vehicle');
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    try {
      return new Date(dateStr).toLocaleDateString('en-IE', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Format timestamp
  const formatTimestamp = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-IE', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <div 
        className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
          isBlocked ? 'border-red-300 bg-red-50/30' : 'hover:shadow-md'
        }`}
        data-testid={`fleet-card-${vehicle.id}`}
      >
        {/* Header with Status */}
        <div className={`px-4 py-3 border-b ${isBlocked ? 'bg-red-100' : 'bg-gray-50'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-gray-900">{vehicle.name}</h3>
              <p className="text-sm text-gray-600">{vehicle.registration}</p>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              isBlocked 
                ? 'bg-red-200 text-red-800' 
                : vehicle.current_status === 'In Use'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {vehicle.current_status || 'Free'}
            </span>
          </div>
        </div>

        {/* Service Alert Banner */}
        {serviceStatus && (
          <div className={`px-4 py-2 ${serviceStatus.color} flex items-center text-sm`}>
            <AlertTriangle size={16} className="mr-2" />
            {serviceStatus.type === 'overdue' && (
              <span className="font-medium">SERVICE OVERDUE by {Math.abs(mileageRemaining).toLocaleString()} km!</span>
            )}
            {serviceStatus.type === 'urgent' && (
              <span className="font-medium">Service due in {mileageRemaining.toLocaleString()} km</span>
            )}
            {serviceStatus.type === 'warning' && (
              <span>Service approaching: {mileageRemaining.toLocaleString()} km remaining</span>
            )}
          </div>
        )}

        {/* Blocked Info Banner */}
        {isBlocked && (
          <div className="px-4 py-2 bg-red-100 text-red-800 text-sm">
            <div className="flex items-center">
              <Lock size={14} className="mr-2" />
              <span className="font-medium">Blocked: {vehicle.blocked_reason}</span>
            </div>
            {vehicle.blocked_notes && (
              <p className="text-xs mt-1 text-red-600">{vehicle.blocked_notes}</p>
            )}
            <p className="text-xs mt-1 opacity-75">
              by {vehicle.blocked_by} on {formatDate(vehicle.blocked_at)}
            </p>
          </div>
        )}

        {/* Main Info */}
        <div className="p-4 space-y-3">
          {/* Current Mileage */}
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-600">
              <Gauge size={16} className="mr-2 text-blue-500" />
              <span className="text-sm">Current Mileage:</span>
            </div>
            <span className="font-bold text-lg text-gray-900">
              {currentMileage > 0 ? `${currentMileage.toLocaleString()} km` : 'Not recorded'}
            </span>
          </div>

          {/* Service Due At */}
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-600">
              <Wrench size={16} className="mr-2 text-purple-500" />
              <span className="text-sm">Service Due At:</span>
            </div>
            <span className={`font-medium ${serviceStatus ? serviceStatus.color.replace('bg-', 'text-').split(' ')[0] : 'text-gray-700'}`}>
              {serviceDue > 0 ? `${serviceDue.toLocaleString()} km` : 'Not set'}
            </span>
          </div>

          {/* Tax Due Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-600">
              <Calendar size={16} className="mr-2 text-green-500" />
              <span className="text-sm">Tax:</span>
            </div>
            <span className="text-gray-700">{formatDate(vehicle.tax_due_date)}</span>
          </div>

          {/* NCT Due Date (if set) */}
          {vehicle.nct_due_date && (
            <div className="flex items-center justify-between">
              <div className="flex items-center text-gray-600">
                <CheckCircle size={16} className="mr-2 text-teal-500" />
                <span className="text-sm">NCT:</span>
              </div>
              <span className="text-gray-700">{formatDate(vehicle.nct_due_date)}</span>
            </div>
          )}

          {/* Location */}
          {vehicle.base_location && (
            <div className="flex items-center justify-between">
              <div className="flex items-center text-gray-600">
                <MapPin size={16} className="mr-2 text-red-500" />
                <span className="text-sm">Location:</span>
              </div>
              <span className="text-gray-700">{vehicle.base_location}</span>
            </div>
          )}

          {/* Last Updated */}
          <div className="pt-2 border-t text-xs text-gray-500">
            <div className="flex items-center">
              <Clock size={12} className="mr-1" />
              <span>Last updated: {formatTimestamp(vehicle.updated_at)}</span>
            </div>
            {vehicle.last_updated_by && (
              <p className="mt-0.5 pl-4">by {vehicle.last_updated_by}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-4 space-y-2">
          {/* Top Row: QR, Edit, Delete */}
          <div className="flex space-x-2">
            <button
              onClick={() => onQRClick && onQRClick(vehicle)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center space-x-1 text-sm"
              title="View QR Code"
            >
              <QrCode size={16} className="text-purple-600" />
              <span>QR</span>
            </button>
            <button
              onClick={() => onEditClick && onEditClick(vehicle)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center space-x-1 text-sm"
              title="Edit Vehicle"
            >
              <Edit2 size={16} className="text-purple-600" />
              <span>Edit</span>
            </button>
            <button
              onClick={() => onDeleteClick && onDeleteClick(vehicle)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center space-x-1 text-sm"
              title="Delete Vehicle"
            >
              <Trash2 size={16} className="text-red-600" />
              <span>Delete</span>
            </button>
          </div>

          {/* Block/Unblock Button */}
          {isAdmin && (
            isBlocked ? (
              <button
                onClick={handleUnblock}
                disabled={loading}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
              >
                <Unlock size={16} />
                <span>{loading ? 'Unblocking...' : 'Unblock & Return to Fleet'}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowBlockModal(true)}
                className="w-full py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center justify-center space-x-2 text-sm"
              >
                <Lock size={16} />
                <span>Block for Appointment</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Block Car for Appointment</h3>
              <p className="text-sm text-gray-600 mt-1">{vehicle.name} ({vehicle.registration})</p>
            </div>
            
            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Service', 'Cleaning', 'Other'].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setBlockReason(reason)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center space-x-1 ${
                        blockReason === reason
                          ? reason === 'Service' ? 'bg-purple-100 border-purple-500 text-purple-700' :
                            reason === 'Cleaning' ? 'bg-blue-100 border-blue-500 text-blue-700' :
                            'bg-gray-200 border-gray-500 text-gray-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {reason === 'Service' && <Wrench size={14} />}
                      {reason === 'Cleaning' && <Sparkles size={14} />}
                      {reason === 'Other' && <MoreHorizontal size={14} />}
                      <span>{reason}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={blockNotes}
                  onChange={(e) => setBlockNotes(e.target.value)}
                  placeholder="Additional details..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex space-x-3 rounded-b-xl">
              <button
                onClick={() => setShowBlockModal(false)}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={loading}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Blocking...' : 'Block Car'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FleetVehicleCard;
