import React, { useState, useEffect } from 'react';
import { statusAPI } from '../api/api';
import StatusBadge from '../components/StatusBadge';
import { RefreshCw, Clock } from 'lucide-react';

const Dashboard = () => {
  const [liveStatus, setLiveStatus] = useState([]);
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

  useEffect(() => {
    fetchLiveStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLiveStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
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
          onClick={fetchLiveStatus}
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
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900" data-testid={`car-name-${item.car.id}`}>
                    {item.car.name}
                  </h3>
                  <p className="text-sm text-gray-500">{item.car.registration}</p>
                </div>
                <StatusBadge status={item.car.current_status} />
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
                      <p className="text-sm text-gray-600 italic">"{item.latest_status.notes}"</p>
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