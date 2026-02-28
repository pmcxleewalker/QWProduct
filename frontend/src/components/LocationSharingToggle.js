import React, { useState, useEffect, useCallback, useRef } from 'react';
import { locationAPI } from '../api/api';
import { MapPin, Navigation, Loader, Check, X, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

const LocationSharingToggle = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, requesting, sharing, error
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);

  // Check if geolocation is supported
  const isGeolocationSupported = 'geolocation' in navigator;

  // Fetch current sharing status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await locationAPI.getMyStatus();
        setIsSharing(response.data.is_sharing);
        if (response.data.is_sharing) {
          setStatus('sharing');
          setLastUpdate(response.data.last_updated);
        }
      } catch (err) {
        console.error('Error fetching location status:', err);
      }
    };
    fetchStatus();
  }, []);

  // Send location to server
  const sendLocation = useCallback(async (position) => {
    try {
      await locationAPI.updateLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed
      });
      setLastUpdate(new Date().toISOString());
      setError(null);
    } catch (err) {
      console.error('Error sending location:', err);
      setError('Failed to update location');
    }
  }, []);

  // Start location sharing
  const startSharing = useCallback(() => {
    if (!isGeolocationSupported) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setStatus('requesting');
    setError(null);

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        sendLocation(position);
        setStatus('sharing');
        setIsSharing(true);

        // Watch position for real-time updates
        watchIdRef.current = navigator.geolocation.watchPosition(
          sendLocation,
          (err) => {
            console.error('Watch position error:', err);
            // Don't stop sharing on watch error, just log it
          },
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 60000
          }
        );

        // Also send periodic updates every 2 minutes as backup
        intervalRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            sendLocation,
            (err) => console.error('Periodic update error:', err),
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
          );
        }, 120000);
      },
      (err) => {
        setStatus('error');
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Please allow location access in your browser settings.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable. Please check your GPS settings.');
            break;
          case err.TIMEOUT:
            setError('Location request timed out. Please try again.');
            break;
          default:
            setError('An error occurred while getting your location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  }, [isGeolocationSupported, sendLocation]);

  // Stop location sharing
  const stopSharing = useCallback(async () => {
    // Clear watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Clear interval
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Notify server
    try {
      await locationAPI.stopSharing();
    } catch (err) {
      console.error('Error stopping location sharing:', err);
    }

    setIsSharing(false);
    setStatus('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IE', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  };

  if (!isGeolocationSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center space-x-3">
        <AlertTriangle className="text-yellow-600" size={20} />
        <span className="text-sm text-yellow-700">
          Location sharing is not supported by your browser
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-4 border-2 transition-colors ${
      isSharing 
        ? 'bg-green-50 border-green-300' 
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${isSharing ? 'bg-green-100' : 'bg-gray-200'}`}>
            {status === 'requesting' ? (
              <Loader className="text-blue-600 animate-spin" size={24} />
            ) : isSharing ? (
              <Navigation className="text-green-600" size={24} />
            ) : (
              <MapPin className="text-gray-500" size={24} />
            )}
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Location Sharing</h3>
            <p className="text-sm text-gray-500">
              {status === 'requesting' && 'Requesting permission...'}
              {status === 'sharing' && (
                <span className="flex items-center text-green-600">
                  <Wifi size={12} className="mr-1" />
                  Sharing • Last update: {formatTime(lastUpdate)}
                </span>
              )}
              {status === 'idle' && 'Share your location with admins'}
              {status === 'error' && <span className="text-red-600">{error}</span>}
            </p>
          </div>
        </div>

        <button
          onClick={isSharing ? stopSharing : startSharing}
          disabled={status === 'requesting'}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isSharing
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } ${status === 'requesting' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSharing ? (
            <>
              <WifiOff size={18} />
              <span>Stop Sharing</span>
            </>
          ) : status === 'requesting' ? (
            <>
              <Loader size={18} className="animate-spin" />
              <span>Requesting...</span>
            </>
          ) : (
            <>
              <Wifi size={18} />
              <span>Start Sharing</span>
            </>
          )}
        </button>
      </div>

      {/* Status indicators */}
      {isSharing && (
        <div className="mt-3 pt-3 border-t border-green-200 flex items-center space-x-4 text-sm">
          <span className="flex items-center text-green-600">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Live
          </span>
          <span className="text-gray-500">
            Your location is visible to admins
          </span>
        </div>
      )}

      {error && status === 'error' && (
        <div className="mt-3 pt-3 border-t border-red-200">
          <p className="text-sm text-red-600 flex items-center">
            <AlertTriangle size={14} className="mr-2" />
            {error}
          </p>
          <button
            onClick={startSharing}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default LocationSharingToggle;
