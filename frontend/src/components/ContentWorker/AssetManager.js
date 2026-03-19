import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Image, Video, Upload, Trash2, Eye, Plus, X,
  Search, Filter, RefreshCw, Download, Edit2, CheckCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AssetManager = ({ onNavigate, onSelectAsset }) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/content-worker/assets`);
      setAssets(response.data.assets || []);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);

        await axios.post(`${API}/content-worker/assets/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      toast.success(`${files.length} asset(s) uploaded successfully`);
      fetchAssets();
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to upload asset');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAsset = async (assetId) => {
    if (!window.confirm('Delete this asset? This will also delete any associated drafts.')) return;

    try {
      await axios.delete(`${API}/content-worker/assets/${assetId}`);
      toast.success('Asset deleted');
      fetchAssets();
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(null);
        setShowPreview(false);
      }
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete asset');
    }
  };

  const handleCreateDraft = (asset) => {
    if (onSelectAsset) {
      onSelectAsset(asset);
    }
    onNavigate('new-post', { asset });
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || asset.file_type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="asset-manager-loading">
        <RefreshCw className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="asset-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Asset Library</h2>
          <p className="text-gray-500 text-sm mt-1">Upload and manage your media files</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            data-testid="file-upload-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all shadow-md disabled:opacity-50"
            data-testid="upload-btn"
          >
            {uploading ? (
              <>
                <RefreshCw className="animate-spin" size={18} />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload size={18} />
                <span>Upload Files</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 bg-white rounded-lg p-4 border">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            data-testid="search-assets-input"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter size={18} className="text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            data-testid="filter-type-select"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>
        </div>
      </div>

      {/* Assets Grid */}
      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="bg-white rounded-xl shadow-sm border overflow-hidden group hover:shadow-md transition-all"
              data-testid={`asset-card-${asset.id}`}
            >
              {/* Thumbnail */}
              <div className="relative aspect-square bg-gray-100">
                {asset.thumbnail_url || asset.original_file_url ? (
                  asset.file_type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                      <Video className="text-white" size={40} />
                    </div>
                  ) : (
                    <img
                      src={asset.thumbnail_url || asset.original_file_url}
                      alt={asset.title}
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="text-gray-300" size={40} />
                  </div>
                )}
                
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                  <button
                    onClick={() => { setSelectedAsset(asset); setShowPreview(true); }}
                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                    title="Preview"
                    data-testid={`preview-asset-${asset.id}`}
                  >
                    <Eye size={18} className="text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleCreateDraft(asset)}
                    className="p-2 bg-pink-500 rounded-full hover:bg-pink-600 transition-colors"
                    title="Create Post"
                    data-testid={`create-draft-${asset.id}`}
                  >
                    <Plus size={18} className="text-white" />
                  </button>
                  <button
                    onClick={() => handleDeleteAsset(asset.id)}
                    className="p-2 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                    title="Delete"
                    data-testid={`delete-asset-${asset.id}`}
                  >
                    <Trash2 size={18} className="text-white" />
                  </button>
                </div>

                {/* Type Badge */}
                <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded ${
                  asset.file_type === 'video' ? 'bg-purple-500' : 'bg-blue-500'
                } text-white`}>
                  {asset.file_type}
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 truncate">{asset.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(asset.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Image className="text-gray-400" size={32} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || filterType !== 'all'
              ? 'Try adjusting your search or filter'
              : 'Upload your first image or video to get started'}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
          >
            Upload Files
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && selectedAsset && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">{selectedAsset.title}</h3>
              <button
                onClick={() => { setShowPreview(false); setSelectedAsset(null); }}
                className="p-2 hover:bg-gray-100 rounded-full"
                data-testid="close-preview-btn"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-gray-100 min-h-[400px]">
              {selectedAsset.file_type === 'video' ? (
                <video
                  src={selectedAsset.original_file_url}
                  controls
                  className="max-w-full max-h-[60vh]"
                />
              ) : (
                <img
                  src={selectedAsset.original_file_url}
                  alt={selectedAsset.title}
                  className="max-w-full max-h-[60vh] object-contain"
                />
              )}
            </div>
            <div className="p-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <span>Uploaded by {selectedAsset.uploaded_by}</span>
                <span className="mx-2">•</span>
                <span>{new Date(selectedAsset.created_at).toLocaleString()}</span>
              </div>
              <button
                onClick={() => { handleCreateDraft(selectedAsset); setShowPreview(false); }}
                className="flex items-center space-x-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
                data-testid="create-post-from-preview-btn"
              >
                <Plus size={18} />
                <span>Create Post</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManager;
