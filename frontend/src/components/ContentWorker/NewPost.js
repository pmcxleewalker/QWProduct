import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Image, Video, FileText, Save, Send, X, Upload,
  Hash, Type, MessageSquare, Target, Sparkles,
  ChevronDown, Check, ArrowLeft, Eye, RefreshCw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const POST_TYPES = [
  { id: 'product_demo', label: 'Product Demo', description: 'Showcase a feature or product' },
  { id: 'pain_point', label: 'Pain Point', description: 'Address customer problems' },
  { id: 'before_after', label: 'Before/After', description: 'Show transformation results' },
  { id: 'educational', label: 'Educational', description: 'Teach something valuable' },
  { id: 'trust_proof', label: 'Trust Proof', description: 'Testimonials and social proof' },
  { id: 'feature_spotlight', label: 'Feature Spotlight', description: 'Highlight specific feature' }
];

const FORMAT_TYPES = [
  { id: 'reel', label: 'Reel', description: 'Vertical video (9:16)' },
  { id: 'carousel', label: 'Carousel', description: 'Multiple images/videos' },
  { id: 'single_image', label: 'Single Image', description: 'Single photo post' },
  { id: 'story', label: 'Story', description: '24h temporary content' }
];

const NewPost = ({ onNavigate, initialAsset }) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    asset_id: initialAsset?.id || '',
    post_title: '',
    post_type: 'product_demo',
    format_type: 'reel',
    caption_option_1: '',
    caption_option_2: '',
    caption_option_3: '',
    selected_caption: '',
    hook: '',
    cta: '',
    hashtags: '',
    notes: '',
    scheduled_at: ''
  });

  const [selectedAsset, setSelectedAsset] = useState(initialAsset || null);

  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    if (initialAsset) {
      setSelectedAsset(initialAsset);
      setFormData(prev => ({ ...prev, asset_id: initialAsset.id }));
    }
  }, [initialAsset]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/content-worker/assets?limit=100`);
      setAssets(response.data.assets || []);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('title', file.name);

      const response = await axios.post(`${API}/content-worker/assets/upload`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newAsset = response.data.asset;
      setAssets(prev => [newAsset, ...prev]);
      setSelectedAsset(newAsset);
      setFormData(prev => ({ ...prev, asset_id: newAsset.id }));
      toast.success('Asset uploaded');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload');
    }
  };

  const handleSubmit = async (submitForReview = false) => {
    if (!formData.asset_id) {
      toast.error('Please select an asset');
      return;
    }
    if (!formData.post_title.trim()) {
      toast.error('Please enter a post title');
      return;
    }

    setSaving(true);
    try {
      // Create draft
      const response = await axios.post(`${API}/content-worker/drafts`, formData);
      const draftId = response.data.draft?.id;

      // Submit for review if requested
      if (submitForReview && draftId) {
        await axios.post(`${API}/content-worker/drafts/${draftId}/submit-review`);
        toast.success('Draft submitted for review');
      } else {
        toast.success('Draft saved');
      }

      onNavigate('drafts');
    } catch (err) {
      console.error('Save failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const selectAsset = (asset) => {
    setSelectedAsset(asset);
    setFormData(prev => ({ ...prev, asset_id: asset.id }));
    setShowAssetPicker(false);
  };

  return (
    <div className="space-y-6" data-testid="new-post-form">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg"
            data-testid="back-btn"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create New Post</h2>
            <p className="text-gray-500 text-sm mt-1">Design your Instagram content</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
            data-testid="save-draft-btn"
          >
            <Save size={18} />
            <span>Save Draft</span>
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50"
            data-testid="submit-review-btn"
          >
            {saving ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
            <span>Submit for Review</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Asset Selection */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Media Asset</h3>
            
            {selectedAsset ? (
              <div className="space-y-4">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  {selectedAsset.file_type === 'video' ? (
                    <video
                      src={selectedAsset.original_file_url}
                      className="w-full h-full object-cover"
                      controls
                    />
                  ) : (
                    <img
                      src={selectedAsset.thumbnail_url || selectedAsset.original_file_url}
                      alt={selectedAsset.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{selectedAsset.title}</p>
                <button
                  onClick={() => setShowAssetPicker(true)}
                  className="w-full py-2 text-sm text-pink-600 hover:text-pink-700 font-medium"
                  data-testid="change-asset-btn"
                >
                  Change Asset
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-pink-400 hover:bg-pink-50 transition-colors"
                  onClick={() => setShowAssetPicker(true)}
                  data-testid="select-asset-placeholder"
                >
                  <Image className="text-gray-400 mb-2" size={40} />
                  <p className="text-sm text-gray-500">Select an asset</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowAssetPicker(true)}
                    className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    data-testid="browse-assets-btn"
                  >
                    Browse Library
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 text-sm bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors"
                    data-testid="upload-new-btn"
                  >
                    Upload New
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Post Type & Format */}
          <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Post Type</label>
              <select
                value={formData.post_type}
                onChange={(e) => setFormData(prev => ({ ...prev, post_type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                data-testid="post-type-select"
              >
                {POST_TYPES.map(type => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
              <select
                value={formData.format_type}
                onChange={(e) => setFormData(prev => ({ ...prev, format_type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                data-testid="format-type-select"
              >
                {FORMAT_TYPES.map(type => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right: Content Details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border p-5 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Type size={16} className="inline mr-2" />
                Post Title
              </label>
              <input
                type="text"
                value={formData.post_title}
                onChange={(e) => setFormData(prev => ({ ...prev, post_title: e.target.value }))}
                placeholder="Give your post a descriptive title"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                data-testid="post-title-input"
              />
            </div>

            {/* Hook */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Sparkles size={16} className="inline mr-2" />
                Hook (First Line)
              </label>
              <input
                type="text"
                value={formData.hook}
                onChange={(e) => setFormData(prev => ({ ...prev, hook: e.target.value }))}
                placeholder="The attention-grabbing first line"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                data-testid="hook-input"
              />
            </div>

            {/* Caption Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MessageSquare size={16} className="inline mr-2" />
                Caption Options
              </label>
              <div className="space-y-3">
                {[1, 2, 3].map(num => (
                  <div key={num} className="relative">
                    <span className="absolute left-3 top-3 text-xs font-medium text-gray-400">Option {num}</span>
                    <textarea
                      value={formData[`caption_option_${num}`]}
                      onChange={(e) => setFormData(prev => ({ ...prev, [`caption_option_${num}`]: e.target.value }))}
                      placeholder={`Write caption option ${num}...`}
                      rows={3}
                      className="w-full px-4 pt-8 pb-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                      data-testid={`caption-option-${num}-input`}
                    />
                    {formData[`caption_option_${num}`] && (
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, selected_caption: formData[`caption_option_${num}`] }))}
                        className={`absolute right-3 top-3 p-1 rounded ${
                          formData.selected_caption === formData[`caption_option_${num}`]
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                        title="Select this caption"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Target size={16} className="inline mr-2" />
                Call to Action
              </label>
              <input
                type="text"
                value={formData.cta}
                onChange={(e) => setFormData(prev => ({ ...prev, cta: e.target.value }))}
                placeholder="What action should viewers take?"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                data-testid="cta-input"
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hash size={16} className="inline mr-2" />
                Hashtags
              </label>
              <textarea
                value={formData.hashtags}
                onChange={(e) => setFormData(prev => ({ ...prev, hashtags: e.target.value }))}
                placeholder="#fleetmanagement #quickwing #business"
                rows={2}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                data-testid="hashtags-input"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText size={16} className="inline mr-2" />
                Internal Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes for the team (not published)"
                rows={2}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                data-testid="notes-input"
              />
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule Post (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                data-testid="schedule-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Asset Picker Modal */}
      {showAssetPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Select Asset</h3>
              <button
                onClick={() => setShowAssetPicker(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
                data-testid="close-asset-picker-btn"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="animate-spin text-pink-500" size={32} />
                </div>
              ) : assets.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                  {assets.map(asset => (
                    <button
                      key={asset.id}
                      onClick={() => selectAsset(asset)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedAsset?.id === asset.id
                          ? 'border-pink-500 ring-2 ring-pink-200'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                      data-testid={`asset-picker-item-${asset.id}`}
                    >
                      {asset.file_type === 'video' ? (
                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                          <Video className="text-white" size={24} />
                        </div>
                      ) : (
                        <img
                          src={asset.thumbnail_url || asset.original_file_url}
                          alt={asset.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {selectedAsset?.id === asset.id && (
                        <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                          <Check className="text-white bg-pink-500 rounded-full p-1" size={24} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Image className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-500">No assets available</p>
                  <button
                    onClick={() => { setShowAssetPicker(false); onNavigate('assets'); }}
                    className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg"
                  >
                    Upload Assets
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewPost;
