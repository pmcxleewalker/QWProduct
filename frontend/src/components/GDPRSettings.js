import React, { useState } from 'react';
import { Download, Trash2, AlertTriangle, CheckCircle, Loader2, FileDown, Shield } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GDPRSettings = ({ onAccountDeleted }) => {
  const { user, logout } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadData = async () => {
    setIsDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/users/me/data-export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Your data has been downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download data. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Your account has been deleted');
      
      // Log out and redirect
      if (onAccountDeleted) {
        onAccountDeleted();
      } else {
        logout();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete account. Please contact support.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Shield className="text-blue-600" size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Data & Privacy</h2>
          <p className="text-sm text-gray-500">Manage your personal data and privacy settings</p>
        </div>
      </div>

      {/* Download Data Section */}
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Download Your Data</h3>
              <p className="text-sm text-gray-500 mt-1">
                Get a copy of all personal data we hold about you in a machine-readable format (JSON).
                This includes your profile, bookings, and activity history.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 ml-11">
          <button
            onClick={handleDownloadData}
            disabled={isDownloading}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                Preparing Download...
              </>
            ) : (
              <>
                <FileDown className="mr-2" size={18} />
                Download My Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="bg-white border border-red-200 rounded-xl p-5">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <Trash2 className="text-red-600" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Delete Your Account</h3>
            <p className="text-sm text-red-700 mt-1">
              Permanently delete your account and all associated personal data. 
              This action cannot be undone.
            </p>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="mt-4 inline-flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="mr-2" size={18} />
                Request Account Deletion
              </button>
            ) : (
              <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-start space-x-2 mb-4">
                  <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-red-900">Are you absolutely sure?</p>
                    <p className="text-sm text-red-700 mt-1">
                      This will permanently delete:
                    </p>
                    <ul className="text-sm text-red-700 list-disc list-inside mt-1">
                      <li>Your user profile and login credentials</li>
                      <li>Your booking history</li>
                      <li>Any data associated with your account</li>
                    </ul>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-red-900 mb-1">
                      Type <strong>DELETE</strong> to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={18} />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2" size={18} />
                          Permanently Delete Account
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Privacy Policy Link */}
      <div className="bg-gray-50 border rounded-xl p-4">
        <p className="text-sm text-gray-600">
          For more information about how we handle your data, please read our{' '}
          <a href="/privacy-policy" className="text-blue-600 hover:underline font-medium">
            Privacy Policy
          </a>
          . If you have any questions, contact us at{' '}
          <a href="mailto:Lee.quickwing@gmail.com" className="text-blue-600 hover:underline">
            Lee.quickwing@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default GDPRSettings;
