import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Instagram, Settings as SettingsIcon, Save, RefreshCw,
  Link, Unlink, AlertCircle, CheckCircle, Key, Globe,
  Palette, Layout, Plus, Trash2, X, Edit2, Clock, Shield
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ContentSettings = ({ onNavigate }) => {
  const [instagramSettings, setInstagramSettings] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const [connectionData, setConnectionData] = useState({
    access_token: '',
    account_id: '',
    account_name: ''
  });

  const [newTemplate, setNewTemplate] = useState({
    template_name: '',
    format_type: 'reel',
    brand_style: '',
    logo_position: 'bottom_right',
    active: true
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [igRes, templatesRes] = await Promise.all([
        axios.get(`${API}/content-worker/instagram-settings`),
        axios.get(`${API}/content-worker/templates`)
      ]);
      setInstagramSettings(igRes.data);
      setTemplates(templatesRes.data.templates || []);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!connectionData.access_token || !connectionData.account_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setConnecting(true);
    try {
      await axios.post(`${API}/content-worker/instagram/connect`, {
        access_token: connectionData.access_token,
        account_id: connectionData.account_id || `ig_${Date.now()}`,
        account_name: connectionData.account_name,
        token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days
      });
      toast.success('Instagram connected successfully');
      setShowConnectModal(false);
      setConnectionData({ access_token: '', account_id: '', account_name: '' });
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to connect Instagram');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Instagram? You will need to reconnect to publish content.')) return;

    try {
      await axios.post(`${API}/content-worker/instagram/disconnect`);
      toast.success('Instagram disconnected');
      fetchSettings();
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  const handleRefreshToken = async () => {
    setRefreshingToken(true);
    try {
      await axios.post(`${API}/content-worker/instagram/refresh-token`);
      toast.success('Token refreshed');
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to refresh token');
    } finally {
      setRefreshingToken(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.template_name.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    try {
      await axios.post(`${API}/content-worker/templates`, newTemplate);
      toast.success('Template created');
      setShowTemplateModal(false);
      setNewTemplate({
        template_name: '',
        format_type: 'reel',
        brand_style: '',
        logo_position: 'bottom_right',
        active: true
      });
      fetchSettings();
    } catch (err) {
      toast.error('Failed to create template');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await axios.delete(`${API}/content-worker/templates/${templateId}`);
      toast.success('Template deleted');
      fetchSettings();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const handleToggleTemplate = async (template) => {
    try {
      await axios.put(`${API}/content-worker/templates/${template.id}`, null, {
        params: { active: !template.active }
      });
      toast.success(`Template ${template.active ? 'disabled' : 'enabled'}`);
      fetchSettings();
    } catch (err) {
      toast.error('Failed to update template');
    }
  };

  const getTokenStatus = () => {
    if (!instagramSettings?.token_expires_at) return null;
    const expires = new Date(instagramSettings.token_expires_at);
    const now = new Date();
    const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) return { status: 'expired', text: 'Token expired', color: 'text-red-600 bg-red-50' };
    if (daysLeft <= 7) return { status: 'expiring', text: `Expires in ${daysLeft} days`, color: 'text-yellow-600 bg-yellow-50' };
    return { status: 'valid', text: `Valid for ${daysLeft} days`, color: 'text-green-600 bg-green-50' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="settings-loading">
        <RefreshCw className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  const isConnected = instagramSettings?.connection_status === 'connected';
  const tokenStatus = getTokenStatus();

  return (
    <div className="space-y-6" data-testid="content-settings">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Settings</h2>
          <p className="text-gray-500 text-sm mt-1">Configure Instagram connection and publishing settings</p>
        </div>
      </div>

      {/* Instagram Connection */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Instagram className="text-white" size={24} />
            </div>
            <div className="text-white">
              <h3 className="font-semibold text-lg">Instagram Connection</h3>
              <p className="text-white/80 text-sm">Connect to publish content directly</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div>
                <p className="font-medium text-gray-900">
                  {isConnected ? 'Connected' : 'Not Connected'}
                </p>
                {isConnected && instagramSettings?.account_name && (
                  <p className="text-sm text-gray-500">@{instagramSettings.account_name}</p>
                )}
              </div>
            </div>
            {isConnected ? (
              <button
                onClick={handleDisconnect}
                className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                data-testid="disconnect-btn"
              >
                <Unlink size={18} />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                onClick={() => setShowConnectModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
                data-testid="connect-btn"
              >
                <Link size={18} />
                <span>Connect Account</span>
              </button>
            )}
          </div>

          {/* Token Status & Details */}
          {isConnected && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center space-x-2 text-gray-500 text-sm mb-1">
                    <Key size={14} />
                    <span>Token Status</span>
                  </div>
                  {tokenStatus && (
                    <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${tokenStatus.color}`}>
                      {tokenStatus.text}
                    </span>
                  )}
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center space-x-2 text-gray-500 text-sm mb-1">
                    <Clock size={14} />
                    <span>Last Sync</span>
                  </div>
                  <p className="font-medium text-gray-900">
                    {instagramSettings?.last_sync_at 
                      ? new Date(instagramSettings.last_sync_at).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              {/* Refresh Token */}
              {tokenStatus && (tokenStatus.status === 'expired' || tokenStatus.status === 'expiring') && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="text-yellow-600" size={18} />
                      <p className="text-sm text-yellow-800">
                        {tokenStatus.status === 'expired' 
                          ? 'Your token has expired. Refresh to continue publishing.'
                          : 'Your token is expiring soon. Refresh to avoid interruptions.'}
                      </p>
                    </div>
                    <button
                      onClick={handleRefreshToken}
                      disabled={refreshingToken}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm disabled:opacity-50"
                      data-testid="refresh-token-btn"
                    >
                      {refreshingToken ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                      <span>Refresh Token</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Connected Account Info */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-900 mb-3">Account Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account</span>
                    <span className="font-medium">@{instagramSettings?.account_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account ID</span>
                    <span className="font-mono text-gray-600">{instagramSettings?.account_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Connected</span>
                    <span className="text-gray-600">
                      {instagramSettings?.connected_at 
                        ? new Date(instagramSettings.connected_at).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Not Connected Info */}
          {!isConnected && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <Shield className="text-blue-500 mt-0.5" size={20} />
                <div>
                  <p className="text-sm text-blue-800 font-medium">How to connect Instagram</p>
                  <ol className="text-sm text-blue-700 mt-2 space-y-1 list-decimal list-inside">
                    <li>Go to Meta for Developers and create an app</li>
                    <li>Add Instagram Graph API permissions</li>
                    <li>Generate a long-lived access token</li>
                    <li>Enter your credentials below to connect</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Post Templates */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Layout className="text-blue-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Post Templates</h3>
              <p className="text-sm text-gray-500">Pre-defined styles for quick content creation</p>
            </div>
          </div>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            data-testid="add-template-btn"
          >
            <Plus size={18} />
            <span>Add Template</span>
          </button>
        </div>

        {templates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`p-4 rounded-lg border transition-all ${
                  template.active 
                    ? 'bg-white border-blue-200 shadow-sm' 
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
                data-testid={`template-card-${template.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{template.template_name}</h4>
                    <span className="text-xs text-gray-500">{template.format_type}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleToggleTemplate(template)}
                      className={`p-1.5 rounded transition-colors ${
                        template.active 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={template.active ? 'Disable' : 'Enable'}
                    >
                      <CheckCircle size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {template.brand_style && (
                    <div className="flex items-center space-x-2">
                      <Palette size={14} className="text-gray-400" />
                      <span className="text-gray-600">{template.brand_style}</span>
                    </div>
                  )}
                  {template.logo_position && (
                    <div className="flex items-center space-x-2">
                      <Layout size={14} className="text-gray-400" />
                      <span className="text-gray-600">Logo: {template.logo_position.replace('_', ' ')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Layout className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">No templates created yet</p>
          </div>
        )}
      </div>

      {/* Workflow Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <SettingsIcon className="text-green-600" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Publishing Settings</h3>
            <p className="text-sm text-gray-500">Configure your publishing workflow</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Require Approval Before Publishing</p>
              <p className="text-sm text-gray-500">All posts must be approved before they can be scheduled or published</p>
            </div>
            <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-not-allowed">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Privacy Review Required</p>
              <p className="text-sm text-gray-500">Prompt to review privacy flags before publishing</p>
            </div>
            <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Manual approval is always required before publishing to Instagram. 
              This ensures content quality and privacy compliance.
            </p>
          </div>
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Connect Instagram</h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  value={connectionData.account_name}
                  onChange={(e) => setConnectionData({ ...connectionData, account_name: e.target.value })}
                  placeholder="@youraccount"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  data-testid="account-name-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Token *</label>
                <input
                  type="password"
                  value={connectionData.access_token}
                  onChange={(e) => setConnectionData({ ...connectionData, access_token: e.target.value })}
                  placeholder="Your Instagram access token"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  data-testid="access-token-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account ID (Optional)</label>
                <input
                  type="text"
                  value={connectionData.account_id}
                  onChange={(e) => setConnectionData({ ...connectionData, account_id: e.target.value })}
                  placeholder="Instagram Business Account ID"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
                data-testid="confirm-connect-btn"
              >
                {connecting ? <RefreshCw className="animate-spin" size={18} /> : <Link size={18} />}
                <span>Connect</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Create Template</h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={newTemplate.template_name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, template_name: e.target.value })}
                  placeholder="e.g., Product Showcase"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Format Type</label>
                <select
                  value={newTemplate.format_type}
                  onChange={(e) => setNewTemplate({ ...newTemplate, format_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="reel">Reel</option>
                  <option value="carousel">Carousel</option>
                  <option value="single_image">Single Image</option>
                  <option value="story">Story</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Style</label>
                <input
                  type="text"
                  value={newTemplate.brand_style}
                  onChange={(e) => setNewTemplate({ ...newTemplate, brand_style: e.target.value })}
                  placeholder="e.g., Modern, Minimal"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo Position</label>
                <select
                  value={newTemplate.logo_position}
                  onChange={(e) => setNewTemplate({ ...newTemplate, logo_position: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="top_left">Top Left</option>
                  <option value="top_right">Top Right</option>
                  <option value="bottom_left">Bottom Left</option>
                  <option value="bottom_right">Bottom Right</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentSettings;
