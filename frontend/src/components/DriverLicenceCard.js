import React, { useState, useEffect, useMemo } from 'react';
import { IdCard, Check, AlertTriangle, Edit2, Save, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Inline self-service card for a staff member to record / update their
 * driver's licence expiry.  Shown on the staff mobile dashboard (Home tab).
 *
 * - Visible to every signed-in user (admin or staff) — they can keep their
 *   own licence up to date.
 * - 30-day amber warning, expired = red, otherwise green "valid".
 */
export const computeLicenceStatus = (expiryStr, warningDays = 30) => {
  if (!expiryStr) {
    return { state: 'missing', daysUntil: null, label: 'Not recorded' };
  }
  const expiry = new Date(expiryStr);
  if (Number.isNaN(expiry.getTime())) {
    return { state: 'missing', daysUntil: null, label: 'Invalid date' };
  }
  expiry.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) {
    return {
      state: 'expired',
      daysUntil,
      label: `Expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`,
    };
  }
  if (daysUntil <= warningDays) {
    return {
      state: 'warning',
      daysUntil,
      label: daysUntil === 0
        ? 'Expires today'
        : `Expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
    };
  }
  return {
    state: 'valid',
    daysUntil,
    label: `Valid · ${daysUntil} days left`,
  };
};

const STATE_STYLES = {
  valid:   { wrap: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600 bg-emerald-100', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
  warning: { wrap: 'bg-amber-50 border-amber-200',     icon: 'text-amber-600 bg-amber-100',     text: 'text-amber-800',   badge: 'bg-amber-100 text-amber-700' },
  expired: { wrap: 'bg-red-50 border-red-200',         icon: 'text-red-600 bg-red-100',         text: 'text-red-800',     badge: 'bg-red-100 text-red-700' },
  missing: { wrap: 'bg-slate-50 border-slate-200',     icon: 'text-slate-500 bg-slate-100',     text: 'text-slate-700',   badge: 'bg-slate-100 text-slate-600' },
};

const DriverLicenceCard = ({ user, onUpdated }) => {
  const initialDate = user?.driver_licence_expiry || '';
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);

  // Keep local state in sync if the parent reloads the user
  useEffect(() => {
    setDate(user?.driver_licence_expiry || '');
  }, [user?.driver_licence_expiry]);

  const status = useMemo(
    () => computeLicenceStatus(user?.driver_licence_expiry),
    [user?.driver_licence_expiry]
  );
  const styles = STATE_STYLES[status.state];

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      await axios.patch(
        `${API}/users/me/profile`,
        { driver_licence_expiry: date || '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(date ? 'Driver\u2019s licence saved' : 'Driver\u2019s licence cleared');
      setEditing(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save licence');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDate(initialDate);
    setEditing(false);
  };

  const formattedExpiry = user?.driver_licence_expiry
    ? new Date(user.driver_licence_expiry).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div
      className={`rounded-xl border p-3 ${styles.wrap}`}
      data-testid="driver-licence-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.icon}`}>
            {status.state === 'expired' || status.state === 'warning' ? (
              <AlertTriangle size={18} />
            ) : status.state === 'valid' ? (
              <Check size={18} />
            ) : (
              <IdCard size={18} />
            )}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${styles.text}`}>Driver&rsquo;s Licence</p>
            <p className="text-xs text-slate-600 truncate">
              Expiry: <span className="font-medium">{formattedExpiry}</span>
            </p>
            <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${styles.badge}`}>
              {status.label}
            </span>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1 flex-shrink-0"
            data-testid="driver-licence-edit-btn"
          >
            <Edit2 size={12} />
            {user?.driver_licence_expiry ? 'Update' : 'Add'}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-t border-slate-200/70">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Expiry date
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="driver-licence-date-input"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              title="Save"
              data-testid="driver-licence-save-btn"
            >
              <Save size={14} />
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="p-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
              title="Cancel"
              data-testid="driver-licence-cancel-btn"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            We&rsquo;ll remind you and your admin 30 days before expiry.
          </p>
        </div>
      )}
    </div>
  );
};

export default DriverLicenceCard;
