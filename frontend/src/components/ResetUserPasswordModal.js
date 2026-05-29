import React, { useState, useEffect } from 'react';
import { X, KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Modal for an admin to reset another tenant user's password.
 *
 * Replaces the old `window.prompt()` flow which silently failed because
 * the backend `/tenant/users/{user_id}/reset-password` endpoint requires
 * BOTH the admin's current password (for confirmation) and the new
 * password — but the prompt only collected the new password, so every
 * call returned 422 and the user saw what looked like a blank screen.
 */
const ResetUserPasswordModal = ({ isOpen, onClose, targetUser, onSuccess }) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAdminPw, setShowAdminPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAdminPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowAdminPw(false);
      setShowNewPw(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!adminPassword) {
      setError('Please enter your own password to confirm this action.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/tenant/users/${targetUser.id}/reset-password`, {
        admin_password: adminPassword,
        new_password: newPassword,
      });
      toast.success(`Password updated for ${targetUser.name}`);
      onSuccess?.();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      // Backend returns 401 for wrong admin password — show it inline
      // instead of as a toast so the admin can correct without losing
      // the new password they already typed.
      if (err.response?.status === 401) {
        setError('Your password is incorrect. Please try again.');
      } else {
        setError(detail || 'Failed to reset password. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b bg-amber-500 text-white rounded-t-xl">
          <h3 className="text-lg font-bold flex items-center">
            <KeyRound size={20} className="mr-2" />
            Reset Password
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded"
            disabled={submitting}
            data-testid="reset-pw-close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
            <ShieldCheck size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              You are resetting the password for{' '}
              <span className="font-semibold">{targetUser.name}</span>
              {targetUser.email && (
                <span className="text-amber-700"> ({targetUser.email})</span>
              )}
              . They will need to use the new password the next time they log in.
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" data-testid="reset-pw-error">
              {error}
            </div>
          )}

          {/* Admin's own password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showAdminPw ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-amber-500"
                placeholder="Confirm with your own password"
                autoComplete="current-password"
                required
                data-testid="reset-pw-admin-password"
              />
              <button
                type="button"
                onClick={() => setShowAdminPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                tabIndex={-1}
              >
                {showAdminPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Required for security — proves it&apos;s really you making this change.
            </p>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New password for {targetUser.name} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-amber-500"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
                minLength={6}
                data-testid="reset-pw-new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                tabIndex={-1}
              >
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm new password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password <span className="text-red-500">*</span>
            </label>
            <input
              type={showNewPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
              placeholder="Re-enter the new password"
              autoComplete="new-password"
              required
              minLength={6}
              data-testid="reset-pw-confirm-password"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium"
              data-testid="reset-pw-submit"
            >
              {submitting ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetUserPasswordModal;
