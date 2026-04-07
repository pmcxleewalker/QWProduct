import React, { useState } from 'react';
import { User, Download, Trash2, LogOut, Shield, ChevronRight, Loader2, AlertTriangle, X, FileDown } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const UserProfileMenu = ({ isOpen, onClose }) => {
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
      toast.error('Failed to download data');
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
      logout();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Slide-up panel */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user?.name || 'User'}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-4 space-y-2">
          {/* Data & Privacy Section */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-3">
              <Shield className="text-blue-600" size={18} />
              <span className="text-sm font-semibold text-gray-700">Data & Privacy</span>
            </div>

            {/* Download Data */}
            <button
              onClick={handleDownloadData}
              disabled={isDownloading}
              className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors mb-2"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Download className="text-green-600" size={20} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Download My Data</p>
                  <p className="text-xs text-gray-500">Get a copy of all your data</p>
                </div>
              </div>
              {isDownloading ? (
                <Loader2 className="animate-spin text-gray-400" size={20} />
              ) : (
                <ChevronRight className="text-gray-400" size={20} />
              )}
            </button>

            {/* Delete Account */}
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-between p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Trash2 className="text-red-600" size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-red-900">Delete Account</p>
                    <p className="text-xs text-red-600">Permanently remove your data</p>
                  </div>
                </div>
                <ChevronRight className="text-red-400" size={20} />
              </button>
            ) : (
              <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                <div className="flex items-start space-x-2 mb-3">
                  <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-red-900">Are you sure?</p>
                    <p className="text-xs text-red-700 mt-1">
                      This will permanently delete your account and all your data. This cannot be undone.
                    </p>
                  </div>
                </div>
                
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm mb-3"
                />
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    className="flex-1 py-2 text-sm text-gray-600 bg-white border rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                    className="flex-1 py-2 text-sm text-white bg-red-600 rounded-lg disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Privacy Policy Link */}
          <Link
            to="/privacy-policy"
            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            onClick={onClose}
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileDown className="text-blue-600" size={20} />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Privacy Policy</p>
                <p className="text-xs text-gray-500">How we handle your data</p>
              </div>
            </div>
            <ChevronRight className="text-gray-400" size={20} />
          </Link>

          {/* Logout */}
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors mt-4"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-200 rounded-lg">
                <LogOut className="text-gray-600" size={20} />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Log Out</p>
                <p className="text-xs text-gray-500">Sign out of your account</p>
              </div>
            </div>
            <ChevronRight className="text-gray-400" size={20} />
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <p className="text-xs text-center text-gray-500">
            Quick Wing Fleet Management · <Link to="/privacy-policy" className="text-blue-600" onClick={onClose}>Privacy</Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default UserProfileMenu;
