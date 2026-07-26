import React, { useEffect, useState } from 'react';
import { X, MapPin, Save, Trash2, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { trackerAPI } from '../api/api';

/**
 * GeofenceModal
 * -------------
 * Per-vehicle geofence config for GPS Phase 5 alerts. Admin sets a base
 * lat/lon + radius (default 50 km). Whenever the poller sees the car
 * outside that circle, it fires a `geofence_exit` alert.
 *
 * "Use current position" auto-fills lat/lon from the last known tracker
 * position for this car so admins don't have to hunt for coordinates.
 *
 * Props:
 *   car         : { id, name, registration, geofence_center_lat, geofence_center_lon, geofence_radius_km, geofence_label }
 *   onClose     : () => void
 *   onSaved     : (updatedFields) => void  (parent can update local state)
 */
const GeofenceModal = ({ car, onClose, onSaved }) => {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radius, setRadius] = useState(50);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!car) return;
    setLat(car.geofence_center_lat != null ? String(car.geofence_center_lat) : '');
    setLon(car.geofence_center_lon != null ? String(car.geofence_center_lon) : '');
    setRadius(car.geofence_radius_km != null ? car.geofence_radius_km : 50);
    setLabel(car.geofence_label || '');
  }, [car]);

  if (!car) return null;

  const useCurrent = async () => {
    setFetching(true);
    try {
      const { data } = await trackerAPI.carPosition(car.id);
      if (data?.lat != null && data?.lon != null) {
        setLat(data.lat.toFixed(6));
        setLon(data.lon.toFixed(6));
        toast.success('Filled from current tracker position');
      } else {
        toast.error('No live position for this vehicle yet');
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No position available');
    } finally {
      setFetching(false);
    }
  };

  const save = async () => {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const radiusNum = parseFloat(radius);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum) || Number.isNaN(radiusNum)) {
      toast.error('Enter valid lat, lon and radius');
      return;
    }
    if (Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) {
      toast.error('Latitude must be -90..90 and longitude -180..180');
      return;
    }
    if (radiusNum <= 0 || radiusNum > 5000) {
      toast.error('Radius must be between 1 and 5000 km');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        geofence_center_lat: latNum,
        geofence_center_lon: lonNum,
        geofence_radius_km: radiusNum,
        geofence_label: label.trim() || null,
      };
      const { data } = await trackerAPI.setGeofence(car.id, payload);
      toast.success('Geofence saved');
      if (onSaved) onSaved(data);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not save geofence');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!window.confirm('Clear the geofence for this vehicle?')) return;
    setSaving(true);
    try {
      const payload = {
        geofence_center_lat: null,
        geofence_center_lon: null,
        geofence_radius_km: null,
        geofence_label: '',
      };
      const { data } = await trackerAPI.setGeofence(car.id, payload);
      toast.success('Geofence cleared');
      if (onSaved) onSaved(data);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not clear geofence');
    } finally {
      setSaving(false);
    }
  };

  const hasExisting = car.geofence_center_lat != null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      data-testid="geofence-modal"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center">
              <MapPin size={16} className="text-purple-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 truncate">Geofence · {car.name}</h3>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">{car.registration}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" data-testid="geofence-close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Centre latitude</label>
              <input
                type="number"
                step="0.000001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="53.3498"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                data-testid="geofence-lat"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Centre longitude</label>
              <input
                type="number"
                step="0.000001"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="-6.2603"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                data-testid="geofence-lon"
              />
            </div>
          </div>

          <button
            onClick={useCurrent}
            disabled={fetching}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-800"
            data-testid="geofence-use-current"
          >
            {fetching ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
            Use vehicle&apos;s current tracker position
          </button>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Radius (km)</label>
            <input
              type="number"
              min="1"
              max="5000"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              data-testid="geofence-radius"
            />
            <p className="text-[11px] text-slate-500 mt-1">Alert fires when vehicle is farther than this distance from the centre. Default: 50 km.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g. "Dublin office" or "Client base"'
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              data-testid="geofence-label"
            />
          </div>

          <div className="flex gap-2 text-[11px] p-3 bg-purple-50 border border-purple-100 text-purple-900 rounded-md">
            <Info size={13} className="text-purple-600 shrink-0 mt-0.5" />
            <span>
              Alerts are deduped — only one open geofence alert per vehicle at a time. Ack it in the
              Alerts page to arm the next detection.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-200 bg-slate-50">
          {hasExisting ? (
            <button
              onClick={clear}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50"
              data-testid="geofence-clear"
            >
              <Trash2 size={13} /> Clear
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              data-testid="geofence-save"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save geofence
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeofenceModal;
