import React, { useState, useEffect } from 'react';
import { statusAPI, complianceAPI } from '../api/api';
import StatusBadge from '../components/StatusBadge';
import { RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [liveStatus, setLiveStatus] = useState([]);
  const [complianceAlerts, setComplianceAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchLiveStatus = async () => {
    try {
      setLoading(true);
      const response = await statusAPI.getLive();
      setLiveStatus(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching live status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComplianceAlerts = async () => {
    if (user?.role === 'admin') {
      try {
        const response = await complianceAPI.getAlerts();
        setComplianceAlerts(response.data);
      } catch (error) {
        console.error('Error fetching compliance alerts:', error);
      }
    }
  };

  useEffect(() => {
    fetchLiveStatus();
    fetchComplianceAlerts();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchLiveStatus();
      fetchComplianceAlerts();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const formatTime = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Compliance Alerts Section - Admin Only */}
      {user?.role === 'admin' && complianceAlerts.length > 0 && (
        <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <AlertTriangle className="text-red-600 mr-2" size={24} />
            <h2 className="text-lg font-bold text-red-800">Compliance Alerts - Action Required</h2>
          </div>
          <div className="space-y-3">
            {complianceAlerts.map((car) => (
              <div key={car.car_id} className="bg-white rounded-lg p-3 border border-red-200">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-gray-900">{car.car_name}</span>
                    <span className="text-gray-500 ml-2">({car.registration})</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {car.alerts.map((alert, idx) => (
                    <span 
                      key={idx}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        alert.is_overdue 
                          ? 'bg-red-600 text-white' 
                          : alert.days_until <= 7 
                            ? 'bg-red-500 text-white'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {alert.type}: {alert.is_overdue 
                        ? `OVERDUE by ${Math.abs(alert.days_until)} days` 
                        : `${alert.days_until} days left`
                      } ({formatDate(alert.due_date)})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="dashboard-title">Fleet Status</h1>
          <p className="text-sm text-gray-500 flex items-center mt-1">
            <Clock size={14} className="mr-1" />
            Last updated: {lastUpdated ? formatTime(lastUpdated) : 'Loading...'}
          </p>
        </div>
        <button
          onClick={() => { fetchLiveStatus(); fetchComplianceAlerts(); }}
          data-testid="refresh-button"
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading State */}
      {loading && liveStatus.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading fleet status...</p>
        </div>
      ) : liveStatus.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No cars in the fleet. Add cars from the Admin panel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {liveStatus.map((item) => (
            <div
              key={item.car.id}
              data-testid={`car-card-${item.car.id}`}
              className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${
                item.car.is_blocked ? 'border-2 border-purple-400' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900" data-testid={`car-name-${item.car.id}`}>
                    {item.car.name}
                  </h3>
                  <p className="text-sm text-gray-500">{item.car.registration}</p>
                </div>
                <StatusBadge 
                  status={item.car.current_status} 
                  isBlocked={item.car.is_blocked}
                  blockReason={item.car.block_reason}
                />
              </div>

              {item.latest_status && (
                <div className="border-t pt-4 mt-4">
                  {item.latest_status.location && (
                    <div className="mb-3 bg-blue-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-blue-900">📍 {item.latest_status.location}</p>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Last updated:</span>
                    <span className="font-medium text-gray-700">
                      {formatTime(item.latest_status.timestamp)}
                    </span>
                  </div>
                  {item.latest_status.user_name && (
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-500">By:</span>
                      <span className="font-medium text-gray-700">
                        {item.latest_status.user_name}
                      </span>
                    </div>
                  )}
                  {item.latest_status.notes && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600 italic">&ldquo;{item.latest_status.notes}&rdquo;</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;