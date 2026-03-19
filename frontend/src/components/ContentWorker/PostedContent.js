import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Send, Calendar, CheckCircle, Image, Video, Eye,
  RefreshCw, ExternalLink, Copy, Clock, Instagram
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PostedContent = ({ onNavigate }) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('posted'); // 'posted', 'scheduled', 'approved'

  useEffect(() => {
    fetchDrafts();
  }, [viewMode]);

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/content-worker/drafts?status=${viewMode}`);
      setDrafts(response.data.drafts || []);
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPosted = async (draftId) => {
    try {
      await axios.put(`${API}/content-worker/drafts/${draftId}`, { status: 'posted' });
      toast.success('Marked as posted');
      fetchDrafts();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleSchedule = async (draftId, scheduledAt) => {
    try {
      await axios.put(`${API}/content-worker/drafts/${draftId}`, { 
        status: 'scheduled',
        scheduled_at: scheduledAt 
      });
      toast.success('Post scheduled');
      fetchDrafts();
    } catch (err) {
      toast.error('Failed to schedule post');
    }
  };

  const copyCaption = (draft) => {
    const text = `${draft.hook || ''}\n\n${draft.selected_caption || ''}\n\n${draft.cta || ''}\n\n${draft.hashtags || ''}`;
    navigator.clipboard.writeText(text.trim());
    toast.success('Caption copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="posted-content-loading">
        <RefreshCw className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="posted-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Calendar</h2>
          <p className="text-gray-500 text-sm mt-1">Track posted, scheduled, and approved content</p>
        </div>
        <button
          onClick={fetchDrafts}
          className="p-2 border rounded-lg hover:bg-gray-50"
          data-testid="refresh-content-btn"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* View Tabs */}
      <div className="flex space-x-2 bg-white rounded-lg p-1 border">
        {[
          { id: 'posted', label: 'Posted', icon: Send, count: drafts.filter(d => d.status === 'posted').length },
          { id: 'scheduled', label: 'Scheduled', icon: Calendar },
          { id: 'approved', label: 'Ready to Post', icon: CheckCircle }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
              viewMode === tab.id
                ? 'bg-pink-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Grid */}
      {drafts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white rounded-xl shadow-sm border overflow-hidden group"
              data-testid={`content-card-${draft.id}`}
            >
              {/* Thumbnail */}
              <div className="relative aspect-square bg-gray-100">
                {draft.asset?.file_type === 'video' ? (
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <Video className="text-white" size={40} />
                  </div>
                ) : draft.asset?.thumbnail_url || draft.asset?.original_file_url ? (
                  <img
                    src={draft.asset?.thumbnail_url || draft.asset?.original_file_url}
                    alt={draft.post_title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="text-gray-300" size={40} />
                  </div>
                )}

                {/* Status Badge */}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                  viewMode === 'posted' ? 'bg-purple-500' :
                  viewMode === 'scheduled' ? 'bg-blue-500' : 'bg-green-500'
                } text-white flex items-center space-x-1`}>
                  {viewMode === 'posted' && <Send size={12} />}
                  {viewMode === 'scheduled' && <Calendar size={12} />}
                  {viewMode === 'approved' && <CheckCircle size={12} />}
                  <span>{viewMode === 'posted' ? 'Posted' : viewMode === 'scheduled' ? 'Scheduled' : 'Ready'}</span>
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                  <button
                    onClick={() => copyCaption(draft)}
                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                    title="Copy Caption"
                    data-testid={`copy-caption-${draft.id}`}
                  >
                    <Copy size={18} className="text-gray-700" />
                  </button>
                  {viewMode === 'approved' && (
                    <button
                      onClick={() => handleMarkAsPosted(draft.id)}
                      className="p-2 bg-pink-500 rounded-full hover:bg-pink-600 transition-colors"
                      title="Mark as Posted"
                      data-testid={`mark-posted-${draft.id}`}
                    >
                      <Send size={18} className="text-white" />
                    </button>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h4 className="font-medium text-gray-900 truncate">{draft.post_title}</h4>
                <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                  <span className="px-2 py-0.5 bg-gray-100 rounded">{draft.format_type}</span>
                  <span>{draft.post_type?.replace('_', ' ')}</span>
                </div>
                
                {draft.scheduled_at && (
                  <div className="flex items-center space-x-1 mt-2 text-sm text-blue-600">
                    <Clock size={14} />
                    <span>{new Date(draft.scheduled_at).toLocaleString()}</span>
                  </div>
                )}

                {draft.hook && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{draft.hook}</p>
                )}

                {/* Quick Actions */}
                {viewMode === 'approved' && (
                  <div className="mt-3 pt-3 border-t flex space-x-2">
                    <input
                      type="datetime-local"
                      onChange={(e) => e.target.value && handleSchedule(draft.id, e.target.value)}
                      className="flex-1 text-xs px-2 py-1 border rounded focus:ring-2 focus:ring-pink-500"
                      data-testid={`schedule-input-${draft.id}`}
                    />
                    <button
                      onClick={() => handleMarkAsPosted(draft.id)}
                      className="px-3 py-1 text-xs bg-pink-500 text-white rounded hover:bg-pink-600 transition-colors"
                    >
                      Posted
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {viewMode === 'posted' ? <Send className="text-pink-500" size={32} /> :
             viewMode === 'scheduled' ? <Calendar className="text-blue-500" size={32} /> :
             <CheckCircle className="text-green-500" size={32} />}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {viewMode === 'posted' ? 'No posted content yet' :
             viewMode === 'scheduled' ? 'No scheduled posts' :
             'No content ready to post'}
          </h3>
          <p className="text-gray-500 mb-4">
            {viewMode === 'approved' 
              ? 'Approved content will appear here ready to be posted'
              : 'Create and approve content to see it here'}
          </p>
          <button
            onClick={() => onNavigate('new-post')}
            className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
          >
            Create New Post
          </button>
        </div>
      )}

      {/* Instagram Connection Banner */}
      <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Instagram size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Connect Instagram</h3>
              <p className="text-white/80 text-sm">Auto-publish approved content directly to Instagram</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-white/90 transition-colors"
            data-testid="connect-instagram-btn"
          >
            Configure
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostedContent;
