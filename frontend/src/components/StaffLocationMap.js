import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { locationAPI } from '../api/api';
import { MapPin, Navigation, Clock, Users, UserCheck, UserX, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const createCustomIcon = (color, isActive = true) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="36" height="36">
      <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2" opacity="${isActive ? 1 : 0.5}"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

// Component to auto-fit map bounds
const FitBounds = ({ locations }) => {
  const map = useMap();
  
  useEffect(() => {
    if (locations && locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.latitude, loc.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [locations, map]);
  
  return null;
};

const StaffLocationMap = () => {
  const [locationData, setLocationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Ireland default center (Kerry area)
  const defaultCenter = [52.0588, -9.5072];
  const defaultZoom = 10;

  const fetchLocations = useCallback(async () => {
    try {
      setError(null);
      const response = await locationAPI.getAllStaffLocations();
      setLocationData(response.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching staff locations:', err);
      setError('Failed to fetch staff locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchLocations, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLocations]);

  const formatTime = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IE', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading staff locations...</p>
        </div>
      </div>
    );
  }

  const activeLocations = locationData?.active_locations || [];
  const inactiveUsers = locationData?.inactive_users || [];

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-3">
          <div className="bg-green-100 p-3 rounded-full">
            <UserCheck className="text-green-600" size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{locationData?.total_active || 0}</p>
            <p className="text-sm text-gray-500">Active Now</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-3">
          <div className="bg-gray-100 p-3 rounded-full">
            <UserX className="text-gray-600" size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{locationData?.total_inactive || 0}</p>
            <p className="text-sm text-gray-500">Not Sharing</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-3">
          <div className="bg-blue-100 p-3 rounded-full">
            <Users className="text-blue-600" size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{(locationData?.total_active || 0) + (locationData?.total_inactive || 0)}</p>
            <p className="text-sm text-gray-500">Total Staff</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-3">
          <div className="bg-indigo-100 p-3 rounded-full">
            <Clock className="text-indigo-600" size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{formatTime(lastRefresh.toISOString())}</p>
            <p className="text-sm text-gray-500">Last Refresh</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <MapPin className="text-blue-600" size={20} />
          <span className="font-medium text-gray-900">Staff Location Map</span>
          <span className="text-sm text-gray-500">(Live tracking via mobile GPS)</span>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              autoRefresh 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {autoRefresh ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}</span>
          </button>
          
          <button
            onClick={fetchLocations}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '500px' }}>
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {activeLocations.length > 0 && <FitBounds locations={activeLocations} />}
          
          {activeLocations.map((location) => (
            <Marker
              key={location.user_id}
              position={[location.latitude, location.longitude]}
              icon={createCustomIcon('#10B981', true)}
            >
              <Popup>
                <div className="min-w-48">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-bold text-sm">
                        {location.user_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{location.user_name}</p>
                      <p className="text-xs text-gray-500">{location.user_email}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-sm border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span className="text-green-600 font-medium flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                        Active
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Updated:</span>
                      <span className="text-gray-900">{getTimeAgo(location.last_updated)}</span>
                    </div>
                    {location.accuracy && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Accuracy:</span>
                        <span className="text-gray-900">±{Math.round(location.accuracy)}m</span>
                      </div>
                    )}
                    {location.speed !== null && location.speed > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Speed:</span>
                        <span className="text-gray-900">{Math.round(location.speed * 3.6)} km/h</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2 pt-2 border-t text-xs text-gray-400">
                    Lat: {location.latitude.toFixed(5)}, Lng: {location.longitude.toFixed(5)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Active Staff List */}
      {activeLocations.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center">
            <UserCheck className="text-green-600 mr-2" size={20} />
            Currently Sharing Location ({activeLocations.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeLocations.map((location) => (
              <div 
                key={location.user_id}
                className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200"
              >
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold">
                    {location.user_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{location.user_name}</p>
                  <p className="text-xs text-gray-500 flex items-center">
                    <Clock size={10} className="mr-1" />
                    {getTimeAgo(location.last_updated)}
                    {location.speed !== null && location.speed > 0 && (
                      <span className="ml-2 flex items-center">
                        <Navigation size={10} className="mr-1" />
                        {Math.round(location.speed * 3.6)} km/h
                      </span>
                    )}
                  </p>
                </div>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Staff List */}
      {inactiveUsers.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center">
            <UserX className="text-gray-500 mr-2" size={20} />
            Not Sharing Location ({inactiveUsers.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {inactiveUsers.map((user) => (
              <div 
                key={user.user_id}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg"
              >
                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-500 text-xs font-medium">
                    {user.user_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <span className="text-sm text-gray-600">{user.user_name}</span>
                {user.role === 'admin' && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Admin</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeLocations.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Locations</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            No staff members are currently sharing their location. 
            Staff can enable location sharing from their mobile devices.
          </p>
        </div>
      )}

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">How Location Sharing Works:</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600">
          <li>Staff members can enable GPS sharing from their mobile device</li>
          <li>Locations are updated automatically while sharing is active</li>
          <li>Staff who haven't updated in 30+ minutes are shown as inactive</li>
          <li>All location data is encrypted and only visible to admins</li>
        </ul>
      </div>
    </div>
  );
};

export default StaffLocationMap;
