import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, Plus, Trash2, AlertTriangle, Info, CheckCircle, Clock, Users, X } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AnnouncementsManager = ({ onRefresh }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'normal',
    requires_acknowledgment: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(`${API}/announcements`);
      setAnnouncements(response.data || []);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      await axios.post(`${API}/messages`, form);
      setSuccess('Announcement created successfully');
      setShowCreateModal(false);
      setForm({ title: '', content: '', priority: 'normal', requires_acknowledgment: true });
      fetchAnnouncements();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create announcement');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    
    setDeleting(id);
    try {
      await axios.delete(`${API}/announcements/${id}`);
      setSuccess('Announcement deleted');
      fetchAnnouncements();
    } catch (err) {
      setError('Failed to delete announcement');
    } finally {
      setDeleting(null);
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="text-red-500" size={16} />;
      case 'high': return <AlertTriangle className="text-orange-500" size={16} />;
      case 'low': return <Info className="text-gray-400" size={16} />;
      default: return <Bell className="text-blue-500" size={16} />;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'low': return 'bg-gray-100 text-gray-600';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="space-y-6" data-testid="announcements-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Staff Announcements</h2>
          <p className="text-sm text-gray-500">Create announcements that staff must acknowledge</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          data-testid="create-announcement-btn"
        >
          <Plus size={18} />
          <span>New Announcement</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center">
          <AlertTriangle size={18} className="mr-2" />
          {error}
          <button onClick={() => setError('')} className="ml-auto">&times;</button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center">
          <CheckCircle size={18} className="mr-2" />
          {success}
          <button onClick={() => setSuccess('')} className="ml-auto">&times;</button>
        </div>
      )}

      {/* Announcements List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Bell size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No announcements yet</p>
            <p className="text-sm mt-1">Create your first announcement to notify staff</p>
          </div>
        ) : (
          <div className="divide-y">
            {announcements.map(announcement => (
              <div key={announcement.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getPriorityIcon(announcement.priority)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{announcement.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadge(announcement.priority)}`}>
                          {announcement.priority?.toUpperCase()}
                        </span>
                        {announcement.requires_acknowledgment && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            Requires Ack
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{announcement.content}</p>
                      
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Clock size={12} className="mr-1" />
                          {new Date(announcement.created_at).toLocaleDateString('en-IE', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        <span className="flex items-center">
                          <Users size={12} className="mr-1" />
                          {announcement.acknowledged_by?.length || 0} acknowledged
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(announcement.id)}
                    disabled={deleting === announcement.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    {deleting === announcement.id ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg" data-testid="create-announcement-modal">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">Create Announcement</h3>
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Important: New Parking Rules"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Enter the announcement details..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="requires_ack"
                  checked={form.requires_acknowledgment}
                  onChange={(e) => setForm({ ...form, requires_acknowledgment: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="requires_ack" className="text-sm text-gray-700">
                  Require staff to acknowledge this announcement
                </label>
              </div>
              
              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Create Announcement
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsManager;
