import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Instagram, Settings as SettingsIcon, Save, RefreshCw,
  Link, Unlink, AlertCircle, CheckCircle, Key, Globe,
  Palette, Layout, Plus, Trash2, X, Edit2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ContentSettings = ({ onNavigate }) => {
  const [instagramSettings, setInstagramSettings] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

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

  const handleSaveInstagramSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/content-worker/instagram-settings`, null, {
        params: { account_name: instagramSettings.account_name }
      });
      toast.success('Instagram settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="settings-loading">
        <RefreshCw className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="content-settings">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Settings</h2>
          <p className="text-gray-500 text-sm mt-1">Configure your content workflow and integrations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Instagram Connection */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-lg flex items-center justify-center">
              <Instagram className="text-white" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Instagram Connection</h3>
              <p className="text-sm text-gray-500">Connect to post directly</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Connection Status</span>
              <span className={`flex items-center space-x-1 text-sm font-medium ${
                instagramSettings?.connection_status === 'connected' 
                  ? 'text-green-600' 
                  : 'text-gray-500'
              }`}>
                {instagramSettings?.connection_status === 'connected' ? (
                  <>
                    <CheckCircle size={14} />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <Unlink size={14} />
                    <span>Not Connected</span>
                  </>
                )}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instagram Account Name
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={instagramSettings?.account_name || ''}
                  onChange={(e) => setInstagramSettings(prev => ({ ...prev, account_name: e.target.value }))}
                  placeholder="@youraccount"
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  data-testid="instagram-account-input"
                />
                <button
                  onClick={handleSaveInstagramSettings}
                  disabled={saving}
                  className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50"
                  data-testid="save-instagram-btn"
                >
                  {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
                <div className="text-sm text-yellow-700">
                  <p className="font-medium">Coming Soon</p>
                  <p className="mt-1">Direct Instagram API integration is planned for a future update. For now, content is prepared and you can manually post to Instagram.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Settings */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Palette className="text-purple-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Brand Defaults</h3>
              <p className="text-sm text-gray-500">Default styles for new content</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border border-pink-100">
              <p className="text-sm text-gray-600">
                Brand settings are inherited from your Quick Wing franchise branding configuration. 
                Visit the main settings to update your brand colors and logo.
              </p>
              <button
                onClick={() => window.location.href = '/admin'}
                className="mt-3 text-sm text-pink-600 hover:text-pink-700 font-medium"
              >
                Go to Franchise Settings →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-xs text-gray-500 mb-1">Default Format</p>
                <p className="font-medium text-gray-900">Reel (9:16)</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-xs text-gray-500 mb-1">Logo Position</p>
                <p className="font-medium text-gray-900">Bottom Right</p>
              </div>
            </div>
          </div>
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
                      data-testid={`delete-template-${template.id}`}
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
            <button
              onClick={() => setShowTemplateModal(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
            >
              Create your first template
            </button>
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
            <h3 className="font-semibold text-gray-900">Workflow Settings</h3>
            <p className="text-sm text-gray-500">Configure your approval process</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Require Approval</p>
              <p className="text-sm text-gray-500">All posts must be approved before publishing</p>
            </div>
            <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Privacy Check</p>
              <p className="text-sm text-gray-500">Prompt to review privacy flags before posting</p>
            </div>
            <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Auto-schedule</p>
              <p className="text-sm text-gray-500">Automatically pick optimal posting times</p>
            </div>
            <div className="w-12 h-6 bg-gray-300 rounded-full relative cursor-pointer">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
            </div>
          </div>
        </div>
      </div>

      {/* Create Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Create Template</h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
                data-testid="close-template-modal"
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
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, template_name: e.target.value }))}
                  placeholder="e.g., Product Showcase"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="template-name-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Format Type</label>
                <select
                  value={newTemplate.format_type}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, format_type: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="template-format-select"
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
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, brand_style: e.target.value }))}
                  placeholder="e.g., Modern, Minimal"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="template-style-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo Position</label>
                <select
                  value={newTemplate.logo_position}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, logo_position: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="template-logo-select"
                >
                  <option value="top_left">Top Left</option>
                  <option value="top_right">Top Right</option>
                  <option value="bottom_left">Bottom Left</option>
                  <option value="bottom_right">Bottom Right</option>
                  <option value="center">Center</option>
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
                data-testid="save-template-btn"
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
