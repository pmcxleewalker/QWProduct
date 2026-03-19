import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  BarChart3, Heart, MessageCircle, Eye, Bookmark, Share2,
  RefreshCw, TrendingUp, ExternalLink, Calendar, Award,
  ArrowUp, ArrowDown, Image
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ContentAnalytics = ({ onNavigate }) => {
  const [overview, setOverview] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [topPosts, setTopPosts] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [formatStats, setFormatStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [topMetric, setTopMetric] = useState('likes');

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchTopPosts(topMetric);
  }, [topMetric]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOverview(),
        fetchRecentPosts(),
        fetchTopPosts(topMetric),
        fetchCategoryStats(),
        fetchFormatStats()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverview = async () => {
    try {
      const response = await axios.get(`${API}/content-worker/analytics/overview`);
      setOverview(response.data);
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  };

  const fetchRecentPosts = async () => {
    try {
      const response = await axios.get(`${API}/content-worker/analytics/posts?limit=10`);
      setRecentPosts(response.data.posts || []);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  };

  const fetchTopPosts = async (metric) => {
    try {
      const response = await axios.get(`${API}/content-worker/analytics/top-posts?metric=${metric}&limit=5`);
      setTopPosts(response.data.posts || []);
    } catch (err) {
      console.error('Failed to fetch top posts:', err);
    }
  };

  const fetchCategoryStats = async () => {
    try {
      const response = await axios.get(`${API}/content-worker/analytics/by-category`);
      setCategoryStats(response.data.categories || []);
    } catch (err) {
      console.error('Failed to fetch category stats:', err);
    }
  };

  const fetchFormatStats = async () => {
    try {
      const response = await axios.get(`${API}/content-worker/analytics/by-format`);
      setFormatStats(response.data.formats || []);
    } catch (err) {
      console.error('Failed to fetch format stats:', err);
    }
  };

  const handleSyncMetrics = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API}/content-worker/analytics/sync`);
      toast.success('Metrics synced from Instagram');
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to sync metrics');
    } finally {
      setSyncing(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="analytics-loading">
        <RefreshCw className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="content-analytics">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">Track your Instagram content performance</p>
        </div>
        <button
          onClick={handleSyncMetrics}
          disabled={syncing}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
          data-testid="sync-metrics-btn"
        >
          {syncing ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
          <span>Sync Metrics</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
              <Heart className="text-pink-500" size={20} />
            </div>
            <span className="text-2xl font-bold text-gray-900">{formatNumber(overview?.total_likes || 0)}</span>
          </div>
          <p className="text-sm text-gray-500">Total Likes</p>
          <p className="text-xs text-gray-400 mt-1">
            {overview?.avg_likes_per_post || 0} avg/post
          </p>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="text-blue-500" size={20} />
            </div>
            <span className="text-2xl font-bold text-gray-900">{formatNumber(overview?.total_comments || 0)}</span>
          </div>
          <p className="text-sm text-gray-500">Total Comments</p>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Eye className="text-purple-500" size={20} />
            </div>
            <span className="text-2xl font-bold text-gray-900">{formatNumber(overview?.total_reach || 0)}</span>
          </div>
          <p className="text-sm text-gray-500">Total Reach</p>
          <p className="text-xs text-gray-400 mt-1">
            {overview?.avg_reach_per_post || 0} avg/post
          </p>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Bookmark className="text-yellow-500" size={20} />
            </div>
            <span className="text-2xl font-bold text-gray-900">{formatNumber(overview?.total_saves || 0)}</span>
          </div>
          <p className="text-sm text-gray-500">Total Saves</p>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-green-500" size={20} />
            </div>
            <span className="text-2xl font-bold text-gray-900">{overview?.engagement_rate || 0}%</span>
          </div>
          <p className="text-sm text-gray-500">Engagement Rate</p>
          <p className="text-xs text-gray-400 mt-1">
            {overview?.total_posts || 0} posts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Posts */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Award className="text-yellow-500" size={20} />
              <h3 className="font-semibold text-gray-900">Top Posts</h3>
            </div>
            <select
              value={topMetric}
              onChange={(e) => setTopMetric(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              data-testid="top-metric-select"
            >
              <option value="likes">By Likes</option>
              <option value="comments">By Comments</option>
              <option value="reach">By Reach</option>
              <option value="saves">By Saves</option>
            </select>
          </div>

          {topPosts.length > 0 ? (
            <div className="space-y-3">
              {topPosts.map((post, index) => (
                <div key={post.id || index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <div className="w-12 h-12 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden">
                    {post.thumbnail ? (
                      <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="text-gray-400" size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{post.post_title}</p>
                    <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                      <span className="flex items-center space-x-1">
                        <Heart size={12} className="text-pink-500" />
                        <span>{post.metrics?.likes || 0}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Eye size={12} className="text-purple-500" />
                        <span>{formatNumber(post.metrics?.reach || 0)}</span>
                      </span>
                    </div>
                  </div>
                  {post.instagram_post_url && (
                    <a
                      href={post.instagram_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-pink-500 hover:bg-pink-50 rounded-lg transition-colors"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">No published posts yet</p>
            </div>
          )}
        </div>

        {/* Recent Posts */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center space-x-2 mb-4">
            <Calendar className="text-blue-500" size={20} />
            <h3 className="font-semibold text-gray-900">Recent Posts</h3>
          </div>

          {recentPosts.length > 0 ? (
            <div className="space-y-3">
              {recentPosts.slice(0, 5).map((post, index) => (
                <div key={post.id || index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden">
                    {post.thumbnail ? (
                      <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="text-gray-400" size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{post.post_title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {post.published_at ? new Date(post.published_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{post.metrics?.likes || 0}</p>
                    <p className="text-xs text-gray-500">likes</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">No published posts yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Category & Format Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="text-green-500" size={20} />
            <h3 className="font-semibold text-gray-900">Performance by Category</h3>
          </div>

          {categoryStats.length > 0 ? (
            <div className="space-y-3">
              {categoryStats.map((cat, index) => (
                <div key={cat.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {cat.category?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-xs text-gray-500">{cat.posts} posts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{cat.avg_likes} avg likes</p>
                    <p className="text-xs text-gray-500">{cat.engagement_rate}% eng</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No data available yet</p>
              <p className="text-xs mt-1">Publish content to see category performance</p>
            </div>
          )}
        </div>

        {/* By Format */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="text-purple-500" size={20} />
            <h3 className="font-semibold text-gray-900">Performance by Format</h3>
          </div>

          {formatStats.length > 0 ? (
            <div className="space-y-3">
              {formatStats.map((fmt, index) => (
                <div key={fmt.format} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {fmt.format?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-xs text-gray-500">{fmt.posts} posts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{fmt.avg_likes} avg likes</p>
                    <p className="text-xs text-gray-500">{formatNumber(fmt.avg_reach)} avg reach</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No data available yet</p>
              <p className="text-xs mt-1">Publish content to see format performance</p>
            </div>
          )}
        </div>
      </div>

      {/* Note about data */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Analytics data is synced from Instagram. Click "Sync Metrics" to fetch the latest performance data for your published posts.
          In demo mode, sample metrics are generated for testing purposes.
        </p>
      </div>
    </div>
  );
};

export default ContentAnalytics;
