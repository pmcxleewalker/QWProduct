import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, Car, Gauge, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const QRScanner = ({ isOpen, onClose, onSuccess, tenantSlug }) => {
  const [scanning, setScanning] = useState(false);
  const [scannedVehicle, setScannedVehicle] = useState(null);
  const [mileage, setMileage] = useState('');
  const [status, setStatus] = useState('Free');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    if (isOpen && !scannedVehicle) {
      // Initialize scanner
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true
        },
        false
      );

      scanner.render(onScanSuccess, onScanFailure);
      scannerRef.current = scanner;
      setScanning(true);

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
        }
      };
    }
  }, [isOpen, scannedVehicle]);

  const onScanSuccess = async (decodedText) => {
    // Stop scanning
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
    }
    setScanning(false);

    try {
      // Parse QR code - handle both URL format and legacy format
      let vehicleId = null;
      
      // Check if it's a URL (new format)
      if (decodedText.startsWith('http')) {
        // Extract vehicle ID from URL like: https://domain.com/{tenant}/vehicle/{vehicle_id}/mileage
        const urlMatch = decodedText.match(/\/vehicle\/([a-zA-Z0-9-]+)/);
        if (urlMatch) {
          vehicleId = urlMatch[1];
        }
      } else {
        // Legacy format: "QUICKWING:VEHICLE:{vehicle_id}"
        const parts = decodedText.split(':');
        if (parts.length === 3 && parts[0] === 'QUICKWING' && parts[1] === 'VEHICLE') {
          vehicleId = parts[2];
        }
      }
      
      if (!vehicleId) {
        setError('Invalid QR code format. Please scan a valid Quick Wing vehicle QR code.');
        return;
      }
      
      // Fetch vehicle details
      const response = await axios.get(`${API}/vehicles/${vehicleId}`);
      setScannedVehicle(response.data);
      setMileage(response.data.current_mileage?.toString() || '');
      setStatus(response.data.current_status || 'Free');
      setError('');
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Vehicle not found. The QR code may be for a different franchise.');
      } else {
        setError('Failed to fetch vehicle details. Please try again.');
      }
      console.error('Scan error:', err);
    }
  };

  const onScanFailure = (error) => {
    // Ignore scan failures (happens continuously while scanning)
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!scannedVehicle) return;

    setSubmitting(true);
    setError('');

    try {
      // Update vehicle status and mileage
      const response = await axios.post(`${API}/vehicles/${scannedVehicle.id}/scan-update`, {
        current_status: status,
        current_mileage: mileage ? parseInt(mileage) : null,
        location: location || undefined,
        notes: notes || undefined
      });

      // Check for service alert
      if (response.data.service_alert) {
        const alert = response.data.service_alert;
        setSuccess(`${scannedVehicle.name} updated! ${alert.message}`);
      } else {
        setSuccess(`${scannedVehicle.name} updated successfully!`);
      }
      
      setTimeout(() => {
        if (onSuccess) onSuccess(response.data.service_alert);
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
    }
    setScanning(false);
    setScannedVehicle(null);
    setMileage('');
    setStatus('Free');
    setLocation('');
    setNotes('');
    setError('');
    setSuccess('');
    onClose();
  };

  const handleRescan = () => {
    setScannedVehicle(null);
    setMileage('');
    setStatus('Free');
    setLocation('');
    setNotes('');
    setError('');
    setSuccess('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white">
          <h3 className="text-lg font-bold flex items-center space-x-2">
            <Camera size={20} />
            <span>{scannedVehicle ? 'Update Vehicle' : 'Scan Vehicle QR'}</span>
          </h3>
          <button 
            onClick={handleClose}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
              <CheckCircle size={20} className="mr-2" />
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
              <AlertTriangle size={20} className="mr-2" />
              {error}
              <button 
                onClick={handleRescan}
                className="ml-auto text-sm underline"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Scanner View */}
          {!scannedVehicle && !error && (
            <div className="space-y-4">
              <div className="text-center text-gray-600 text-sm mb-4">
                Point your camera at the vehicle's QR code
              </div>
              <div 
                id="qr-reader" 
                className="rounded-lg overflow-hidden"
                style={{ width: '100%' }}
              ></div>
              {scanning && (
                <div className="text-center text-sm text-gray-500">
                  <div className="animate-pulse">Scanning...</div>
                </div>
              )}
            </div>
          )}

          {/* Vehicle Update Form */}
          {scannedVehicle && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Vehicle Info */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Car className="text-white" size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{scannedVehicle.name}</h4>
                    <p className="text-sm text-gray-600">{scannedVehicle.registration}</p>
                  </div>
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Free', 'In Use', 'Needs Cleaning', 'Needs Repair'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                        status === s
                          ? s === 'Free' ? 'bg-green-100 border-green-500 text-green-700' :
                            s === 'In Use' ? 'bg-orange-100 border-orange-500 text-orange-700' :
                            s === 'Needs Cleaning' ? 'bg-yellow-100 border-yellow-500 text-yellow-700' :
                            'bg-red-100 border-red-500 text-red-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mileage Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center space-x-1">
                    <Gauge size={16} />
                    <span>Current Mileage (km)</span>
                  </div>
                </label>
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="Enter current mileage"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                  min="0"
                />
                {scannedVehicle.current_mileage && (
                  <p className="text-xs text-gray-500 mt-1">
                    Previous: {scannedVehicle.current_mileage.toLocaleString()} km
                  </p>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Location (optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Main Office, Site A"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any issues or observations..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleRescan}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Scan Different
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Vehicle'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
