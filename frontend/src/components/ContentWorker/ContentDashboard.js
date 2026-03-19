import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Image, Video, FileText, Clock, CheckCircle, XCircle,
  TrendingUp, Lightbulb, Calendar, Upload, Plus, Eye,
  Instagram, Send, AlertTriangle, RefreshCw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ContentDashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/content-worker/stats`);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch content stats:', err);
      toast.error('Failed to load content statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="content-dashboard-loading">
        <RefreshCw className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Drafts', value: stats?.stats?.total_drafts || 0, icon: FileText, color: 'bg-blue-500', onClick: () => onNavigate('drafts') },
    { label: 'In Review', value: stats?.stats?.in_review || 0, icon: Clock, color: 'bg-yellow-500', onClick: () => onNavigate('review') },
    { label: 'Approved', value: stats?.stats?.approved || 0, icon: CheckCircle, color: 'bg-green-500', onClick: () => onNavigate('review') },
    { label: 'Posted', value: stats?.stats?.posted || 0, icon: Send, color: 'bg-pink-500', onClick: () => onNavigate('posted') },
    { label: 'Rejected', value: stats?.stats?.rejected || 0, icon: XCircle, color: 'bg-red-500', onClick: () => onNavigate('review') },
    { label: 'Total Assets', value: stats?.stats?.total_assets || 0, icon: Image, color: 'bg-purple-500', onClick: () => onNavigate('assets') },
    { label: 'Content Ideas', value: stats?.stats?.total_ideas || 0, icon: Lightbulb, color: 'bg-orange-500', onClick: () => onNavigate('ideas') },
    { label: 'Scheduled', value: stats?.stats?.scheduled || 0, icon: Calendar, color: 'bg-indigo-500', onClick: () => onNavigate('posted') },
  ];

  return (
    <div className="space-y-6" data-testid="content-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">Manage your Instagram content pipeline</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => onNavigate('new-post')}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all shadow-md"
            data-testid="create-new-post-btn"
          >
            <Plus size={18} />
            <span>New Post</span>
          </button>
          <button
            onClick={() => onNavigate('assets')}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
            data-testid="upload-asset-btn"
          >
            <Upload size={18} />
            <span>Upload Asset</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <button
            key={index}
            onClick={stat.onClick}
            className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md transition-all text-left group"
            data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="text-white" size={20} />
              </div>
              <span className="text-3xl font-bold text-gray-900 group-hover:text-pink-600 transition-colors">
                {stat.value}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-3">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Assets */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Assets</h3>
            <button
              onClick={() => onNavigate('assets')}
              className="text-sm text-pink-600 hover:text-pink-700 font-medium"
            >
              View All
            </button>
          </div>
          {stats?.recent_assets?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_assets.map((asset) => (
                <div key={asset.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {asset.thumbnail_url ? (
                      <img src={asset.thumbnail_url} alt={asset.title} className="w-full h-full object-cover" />
                    ) : asset.file_type === 'video' ? (
                      <Video className="text-gray-400" size={20} />
                    ) : (
                      <Image className="text-gray-400" size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{asset.title}</p>
                    <p className="text-xs text-gray-500">{asset.file_type} • {new Date(asset.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Image className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">No assets uploaded yet</p>
              <button
                onClick={() => onNavigate('assets')}
                className="text-sm text-pink-600 hover:text-pink-700 font-medium mt-2"
              >
                Upload your first asset
              </button>
            </div>
          )}
        </div>

        {/* Content Ideas */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Content Ideas</h3>
            <button
              onClick={() => onNavigate('ideas')}
              className="text-sm text-pink-600 hover:text-pink-700 font-medium"
            >
              View All
            </button>
          </div>
          {stats?.recent_ideas?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_ideas.map((idea) => (
                <div key={idea.id} className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-100">
                  <div className="flex items-start space-x-2">
                    <Lightbulb className="text-orange-500 flex-shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{idea.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{idea.category} • {idea.recommended_format}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Lightbulb className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">No content ideas yet</p>
              <button
                onClick={() => onNavigate('ideas')}
                className="text-sm text-pink-600 hover:text-pink-700 font-medium mt-2"
              >
                Add your first idea
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Workflow Overview */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-6 text-white">
        <h3 className="font-semibold text-lg mb-4">Content Workflow</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Upload size={18} />
              </div>
              <span className="text-xs mt-2 opacity-80">Upload</span>
            </div>
            <div className="w-8 h-0.5 bg-white/30" />
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <FileText size={18} />
              </div>
              <span className="text-xs mt-2 opacity-80">Draft</span>
            </div>
            <div className="w-8 h-0.5 bg-white/30" />
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Eye size={18} />
              </div>
              <span className="text-xs mt-2 opacity-80">Review</span>
            </div>
            <div className="w-8 h-0.5 bg-white/30" />
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle size={18} />
              </div>
              <span className="text-xs mt-2 opacity-80">Approve</span>
            </div>
            <div className="w-8 h-0.5 bg-white/30" />
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Instagram size={18} />
              </div>
              <span className="text-xs mt-2 opacity-80">Post</span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all"
          >
            Configure Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentDashboard;
