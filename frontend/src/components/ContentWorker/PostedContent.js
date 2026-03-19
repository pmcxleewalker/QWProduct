import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Send, Calendar, CheckCircle, Image, Video, Eye,
  RefreshCw, ExternalLink, Copy, Clock, Instagram,
  Play, X, RotateCcw, AlertTriangle, Heart, MessageCircle,
  BarChart3
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PostedContent = ({ onNavigate }) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('posted'); // 'posted', 'scheduled', 'approved', 'failed'
  const [publishing, setPublishing] = useState(null); // track which draft is being published
  const [instagramConnected, setInstagramConnected] = useState(false);

  useEffect(() => {
    fetchDrafts();
    checkInstagramConnection();
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

  const checkInstagramConnection = async () => {
    try {
      const response = await axios.get(`${API}/content-worker/instagram-settings`);
      setInstagramConnected(response.data?.connection_status === 'connected');
    } catch (err) {
      setInstagramConnected(false);
    }
  };

  const handleSchedule = async (draftId, scheduledAt) => {
    if (!scheduledAt) return;
    try {
      await axios.post(`${API}/content-worker/drafts/${draftId}/schedule?scheduled_at=${scheduledAt}`);
      toast.success('Post scheduled');
      fetchDrafts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to schedule post');
    }
  };

  const handleUnschedule = async (draftId) => {
    try {
      await axios.post(`${API}/content-worker/drafts/${draftId}/unschedule`);
      toast.success('Post unscheduled');
      fetchDrafts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to unschedule post');
    }
  };

  const handlePublishNow = async (draftId) => {
    if (!instagramConnected) {
      toast.error('Please connect Instagram first in Settings');
      return;
    }
    if (!window.confirm('Publish this post to Instagram now?')) return;
    
    setPublishing(draftId);
    try {
      const response = await axios.post(`${API}/content-worker/drafts/${draftId}/publish`);
      toast.success('Post published successfully!');
      if (response.data.post_url) {
        toast.info(`View on Instagram: ${response.data.post_url}`);
      }
      fetchDrafts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to publish post');
    } finally {
      setPublishing(null);
    }
  };

  const handleRetryPublish = async (draftId) => {
    setPublishing(draftId);
    try {
      const response = await axios.post(`${API}/content-worker/drafts/${draftId}/retry-publish`);
      toast.success('Post published successfully!');
      fetchDrafts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to retry publishing');
    } finally {
      setPublishing(null);
    }
  };

  const copyCaption = (draft) => {
    const text = `${draft.hook || ''}\n\n${draft.selected_caption || ''}\n\n${draft.cta || ''}\n\n${draft.hashtags || ''}`;
    navigator.clipboard.writeText(text.trim());
    toast.success('Caption copied to clipboard');
  };

  const getStatusConfig = (status) => {
    const configs = {
      posted: { label: 'Posted', color: 'bg-purple-500', icon: Send },
      scheduled: { label: 'Scheduled', color: 'bg-blue-500', icon: Calendar },
      approved: { label: 'Ready', color: 'bg-green-500', icon: CheckCircle },
      failed: { label: 'Failed', color: 'bg-red-500', icon: AlertTriangle },
      publishing: { label: 'Publishing', color: 'bg-purple-500', icon: RefreshCw }
    };
    return configs[status] || configs.approved;
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
        <div className="flex items-center space-x-2">
          {instagramConnected ? (
            <span className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm">
              <CheckCircle size={14} />
              <span>Instagram Connected</span>
            </span>
          ) : (
            <button
              onClick={() => onNavigate('settings')}
              className="flex items-center space-x-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm hover:bg-orange-200 transition-colors"
            >
              <AlertTriangle size={14} />
              <span>Connect Instagram</span>
            </button>
          )}
          <button
            onClick={fetchDrafts}
            className="p-2 border rounded-lg hover:bg-gray-50"
            data-testid="refresh-content-btn"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex space-x-2 bg-white rounded-lg p-1 border">
        {[
          { id: 'posted', label: 'Posted', icon: Send },
          { id: 'scheduled', label: 'Scheduled', icon: Calendar },
          { id: 'approved', label: 'Ready to Post', icon: CheckCircle },
          { id: 'failed', label: 'Failed', icon: AlertTriangle }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
              viewMode === tab.id
                ? tab.id === 'failed' ? 'bg-red-500 text-white' : 'bg-pink-500 text-white'
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
          {drafts.map((draft) => {
            const statusConfig = getStatusConfig(draft.status);
            const StatusIcon = statusConfig.icon;
            const isPublishing = publishing === draft.id;

            return (
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
                  <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${statusConfig.color} text-white flex items-center space-x-1`}>
                    {isPublishing ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <StatusIcon size={12} />
                    )}
                    <span>{isPublishing ? 'Publishing...' : statusConfig.label}</span>
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
                    {draft.instagram_post_url && (
                      <a
                        href={draft.instagram_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-colors"
                        title="View on Instagram"
                      >
                        <ExternalLink size={18} className="text-white" />
                      </a>
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
                  
                  {/* Scheduled Time */}
                  {draft.scheduled_at && (
                    <div className="flex items-center space-x-1 mt-2 text-sm text-blue-600">
                      <Clock size={14} />
                      <span>{new Date(draft.scheduled_at).toLocaleString()}</span>
                    </div>
                  )}

                  {/* Posted Time & URL */}
                  {draft.published_at && (
                    <div className="flex items-center space-x-1 mt-2 text-sm text-purple-600">
                      <Send size={14} />
                      <span>Posted {new Date(draft.published_at).toLocaleDateString()}</span>
                    </div>
                  )}

                  {/* Failure Reason */}
                  {draft.status === 'failed' && draft.publish_error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      <span className="font-medium">Error:</span> {draft.publish_error}
                    </div>
                  )}

                  {draft.hook && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{draft.hook}</p>
                  )}

                  {/* Quick Actions based on status */}
                  {viewMode === 'approved' && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex space-x-2">
                        <input
                          type="datetime-local"
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={(e) => handleSchedule(draft.id, e.target.value)}
                          className="flex-1 text-xs px-2 py-1.5 border rounded focus:ring-2 focus:ring-pink-500"
                          data-testid={`schedule-input-${draft.id}`}
                        />
                      </div>
                      <button
                        onClick={() => handlePublishNow(draft.id)}
                        disabled={isPublishing || !instagramConnected}
                        className="w-full py-2 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                        data-testid={`publish-now-${draft.id}`}
                      >
                        {isPublishing ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Instagram size={14} />
                        )}
                        <span>{isPublishing ? 'Publishing...' : 'Publish to Instagram'}</span>
                      </button>
                    </div>
                  )}

                  {viewMode === 'scheduled' && (
                    <div className="mt-3 pt-3 border-t flex space-x-2">
                      <button
                        onClick={() => handleUnschedule(draft.id)}
                        className="flex-1 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center justify-center space-x-1"
                        data-testid={`unschedule-${draft.id}`}
                      >
                        <X size={12} />
                        <span>Unschedule</span>
                      </button>
                      <button
                        onClick={() => handlePublishNow(draft.id)}
                        disabled={isPublishing || !instagramConnected}
                        className="flex-1 py-1.5 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded hover:from-purple-600 hover:to-pink-600 transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
                        data-testid={`publish-now-scheduled-${draft.id}`}
                      >
                        {isPublishing ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                        <span>{isPublishing ? 'Publishing...' : 'Publish Now'}</span>
                      </button>
                    </div>
                  )}

                  {viewMode === 'failed' && (
                    <div className="mt-3 pt-3 border-t">
                      <button
                        onClick={() => handleRetryPublish(draft.id)}
                        disabled={isPublishing || !instagramConnected}
                        className="w-full py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                        data-testid={`retry-publish-${draft.id}`}
                      >
                        {isPublishing ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        <span>{isPublishing ? 'Retrying...' : 'Retry Publish'}</span>
                      </button>
                    </div>
                  )}

                  {viewMode === 'posted' && draft.instagram_post_url && (
                    <div className="mt-3 pt-3 border-t flex space-x-2">
                      <a
                        href={draft.instagram_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded hover:from-purple-600 hover:to-pink-600 transition-colors flex items-center justify-center space-x-1"
                      >
                        <ExternalLink size={12} />
                        <span>View on Instagram</span>
                      </a>
                      <button
                        onClick={() => onNavigate('analytics')}
                        className="flex-1 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center justify-center space-x-1"
                      >
                        <BarChart3 size={12} />
                        <span>View Analytics</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {viewMode === 'posted' ? <Send className="text-pink-500" size={32} /> :
             viewMode === 'scheduled' ? <Calendar className="text-blue-500" size={32} /> :
             viewMode === 'failed' ? <AlertTriangle className="text-red-500" size={32} /> :
             <CheckCircle className="text-green-500" size={32} />}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {viewMode === 'posted' ? 'No posted content yet' :
             viewMode === 'scheduled' ? 'No scheduled posts' :
             viewMode === 'failed' ? 'No failed posts' :
             'No content ready to post'}
          </h3>
          <p className="text-gray-500 mb-4">
            {viewMode === 'approved' 
              ? 'Approved content will appear here ready to be posted'
              : viewMode === 'failed'
              ? 'Failed publishing attempts will show here'
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
      {!instagramConnected && (
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
      )}
    </div>
  );
};

export default PostedContent;
