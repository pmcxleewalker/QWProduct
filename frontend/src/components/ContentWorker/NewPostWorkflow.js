import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Upload, Image, Video, ArrowLeft, ArrowRight, Check, 
  RefreshCw, AlertTriangle, Eye, Save, Send, X,
  Sparkles, FileText, Shield, Wand2
} from 'lucide-react';
import PrivacyEditor from './PrivacyEditor';
import FrameSelector from './FrameSelector';
import CaptionEditor from './CaptionEditor';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WORKFLOW_STEPS = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'select', label: 'Select Frame', icon: Image },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'caption', label: 'Caption', icon: FileText },
  { id: 'save', label: 'Save', icon: Save }
];

const CONTENT_FOCUS_OPTIONS = [
  { id: 'booking_simplicity', label: 'Booking Simplicity' },
  { id: 'calendar_visibility', label: 'Calendar Visibility' },
  { id: 'compliance_tracking', label: 'Compliance Tracking' },
  { id: 'admin_efficiency', label: 'Admin Efficiency' },
  { id: 'time_saving', label: 'Time Saving' },
  { id: 'reducing_chaos', label: 'Reducing Chaos' },
  { id: 'operational_clarity', label: 'Operational Clarity' }
];

const POST_TYPES = [
  { id: 'product_demo', label: 'Product Demo' },
  { id: 'pain_point', label: 'Pain Point' },
  { id: 'before_after', label: 'Before/After' },
  { id: 'educational', label: 'Educational' },
  { id: 'trust_proof', label: 'Trust Proof' },
  { id: 'feature_spotlight', label: 'Feature Spotlight' }
];

const FORMAT_TYPES = [
  { id: 'reel', label: 'Reel' },
  { id: 'carousel', label: 'Carousel' },
  { id: 'single_image', label: 'Single Image' },
  { id: 'story', label: 'Story' }
];

const NewPostWorkflow = ({ onNavigate, initialAsset }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Workflow data
  const [uploadedAsset, setUploadedAsset] = useState(initialAsset || null);
  const [isVideo, setIsVideo] = useState(false);
  const [extractedFrames, setExtractedFrames] = useState([]);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [detectedPrivacyZones, setDetectedPrivacyZones] = useState([]);
  const [blurZones, setBlurZones] = useState([]);
  const [privacyReviewed, setPrivacyReviewed] = useState(false);
  const [previewSquare, setPreviewSquare] = useState(null);
  const [previewPortrait, setPreviewPortrait] = useState(null);
  const [generatedCaptions, setGeneratedCaptions] = useState([]);
  const [selectedCaptionIndex, setSelectedCaptionIndex] = useState(0);

  // Form data
  const [postTitle, setPostTitle] = useState('');
  const [postType, setPostType] = useState('product_demo');
  const [formatType, setFormatType] = useState('reel');
  const [contentFocus, setContentFocus] = useState('operational_clarity');
  const [notes, setNotes] = useState('');

  // Get current image URL for processing
  const currentImageUrl = selectedFrame?.url || uploadedAsset?.original_file_url;
  const currentImageFilename = selectedFrame?.filename || uploadedAsset?.original_file_url?.split('/').pop();

  useEffect(() => {
    if (initialAsset) {
      setUploadedAsset(initialAsset);
      setIsVideo(initialAsset.file_type === 'video');
      if (initialAsset.file_type !== 'video') {
        setCurrentStep(2); // Skip to privacy step for images
      }
    }
  }, [initialAsset]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);

      const response = await axios.post(`${API}/content-worker/assets/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const asset = response.data.asset;
      setUploadedAsset(asset);
      setIsVideo(asset.file_type === 'video');
      
      if (asset.file_type === 'video') {
        await extractFrames(asset.id);
        setCurrentStep(1); // Go to frame selection
      } else {
        setCurrentStep(2); // Skip to privacy for images
      }
      
      toast.success('File uploaded successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const extractFrames = async (assetId) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/content-worker/extract-frames?asset_id=${assetId}&num_frames=3`);
      setExtractedFrames(response.data.frames || []);
      if (response.data.frames?.length > 0) {
        setSelectedFrame(response.data.frames[0]);
      }
    } catch (err) {
      toast.error('Failed to extract frames');
    } finally {
      setLoading(false);
    }
  };

  const detectPrivacy = async () => {
    if (!currentImageUrl) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFrame?.filename) {
        params.append('frame_filename', selectedFrame.filename);
      } else if (uploadedAsset?.id) {
        params.append('asset_id', uploadedAsset.id);
      }

      const response = await axios.post(`${API}/content-worker/detect-privacy?${params}`);
      const detected = response.data.detected_items || [];
      setDetectedPrivacyZones(detected);
      setBlurZones(detected);
      
      if (detected.length > 0) {
        toast.info(`Found ${detected.length} potential privacy issues`);
      } else {
        toast.success('No privacy issues detected');
      }
    } catch (err) {
      toast.error('Privacy detection failed');
    } finally {
      setLoading(false);
    }
  };

  const generatePreviews = async () => {
    if (!uploadedAsset?.id) return;
    
    setLoading(true);
    try {
      // Generate square preview
      const squareRes = await axios.post(`${API}/content-worker/generate-preview`, null, {
        params: {
          asset_id: uploadedAsset.id,
          preview_size: 'square',
          blur_zones: JSON.stringify(blurZones)
        }
      });
      setPreviewSquare(squareRes.data.preview_url);

      // Generate portrait preview
      const portraitRes = await axios.post(`${API}/content-worker/generate-preview`, null, {
        params: {
          asset_id: uploadedAsset.id,
          preview_size: 'portrait',
          blur_zones: JSON.stringify(blurZones)
        }
      });
      setPreviewPortrait(portraitRes.data.preview_url);

      toast.success('Previews generated');
    } catch (err) {
      toast.error('Failed to generate previews');
    } finally {
      setLoading(false);
    }
  };

  const generateCaptions = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/content-worker/generate-captions`, null, {
        params: { post_type: postType, content_focus: contentFocus }
      });
      setGeneratedCaptions(response.data.captions || []);
      toast.success('Captions generated');
    } catch (err) {
      toast.error('Failed to generate captions');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async (submitForReview = false) => {
    if (!postTitle.trim()) {
      toast.error('Please enter a post title');
      return;
    }

    setSaving(true);
    try {
      const draftData = {
        asset_id: uploadedAsset.id,
        post_title: postTitle,
        post_type: postType,
        format_type: formatType,
        content_focus: contentFocus,
        blur_zones: blurZones,
        generated_captions: generatedCaptions,
        selected_caption_index: selectedCaptionIndex,
        preview_url_square: previewSquare,
        preview_url_portrait: previewPortrait,
        privacy_reviewed: privacyReviewed,
        notes: notes
      };

      const response = await axios.post(`${API}/content-worker/drafts/create-with-workflow`, draftData);
      const draftId = response.data.draft?.id;

      if (submitForReview && draftId) {
        await axios.post(`${API}/content-worker/drafts/${draftId}/submit-review`);
        toast.success('Draft submitted for review');
      } else {
        toast.success('Draft saved');
      }

      onNavigate('review');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCaption = (index, updatedCaption) => {
    const updated = [...generatedCaptions];
    updated[index] = updatedCaption;
    setGeneratedCaptions(updated);
  };

  const goToStep = (stepIndex) => {
    setCurrentStep(stepIndex);
  };

  const nextStep = () => {
    if (currentStep < WORKFLOW_STEPS.length - 1) {
      // Trigger actions on step transitions
      if (currentStep === 1 && isVideo) {
        // After frame selection, detect privacy
        detectPrivacy();
      }
      if (currentStep === 2) {
        // After privacy, generate previews
        generatePreviews();
      }
      if (currentStep === 3) {
        // After preview, generate captions
        generateCaptions();
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Upload
        return (
          <div className="space-y-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {!uploadedAsset ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-pink-400 hover:bg-pink-50 transition-all"
                data-testid="upload-dropzone"
              >
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-lg font-medium text-gray-900">Upload Screenshot or Video</p>
                <p className="text-sm text-gray-500 mt-2">PNG, JPG, MP4, MOV up to 100MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-video rounded-xl overflow-hidden bg-gray-100 border">
                  {isVideo ? (
                    <video src={uploadedAsset.original_file_url} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={uploadedAsset.original_file_url} alt="Uploaded" className="w-full h-full object-contain" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {isVideo ? <Video size={20} className="text-purple-500" /> : <Image size={20} className="text-blue-500" />}
                    <span className="font-medium">{uploadedAsset.title}</span>
                  </div>
                  <button
                    onClick={() => {
                      setUploadedAsset(null);
                      setExtractedFrames([]);
                      setSelectedFrame(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 1: // Frame Selection (Video only)
        return (
          <div className="space-y-6">
            <FrameSelector
              frames={extractedFrames}
              selectedFrame={selectedFrame}
              onSelectFrame={setSelectedFrame}
              loading={loading}
            />
          </div>
        );

      case 2: // Privacy Detection
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Privacy Scan</h3>
                <p className="text-sm text-gray-500">Detect and blur sensitive information</p>
              </div>
              <button
                onClick={detectPrivacy}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                data-testid="scan-privacy-btn"
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <Shield size={18} />}
                <span>Scan for Privacy Issues</span>
              </button>
            </div>
            
            <PrivacyEditor
              imageUrl={currentImageUrl}
              detectedZones={detectedPrivacyZones}
              onZonesChange={setBlurZones}
              onMarkReviewed={() => setPrivacyReviewed(true)}
            />

            {privacyReviewed && (
              <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Check className="text-green-600" size={20} />
                <span className="text-green-700 font-medium">Privacy reviewed and approved</span>
              </div>
            )}
          </div>
        );

      case 3: // Preview Generation
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Branded Previews</h3>
                <p className="text-sm text-gray-500">Generate post previews with blur applied</p>
              </div>
              <button
                onClick={generatePreviews}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                data-testid="generate-preview-btn"
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <Wand2 size={18} />}
                <span>Generate Previews</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Square Preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Square (1080x1080)</label>
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border">
                  {previewSquare ? (
                    <img src={previewSquare} alt="Square Preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span>Click "Generate Previews"</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Portrait Preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Portrait (1080x1350)</label>
                <div className="aspect-[4/5] bg-gray-100 rounded-xl overflow-hidden border">
                  {previewPortrait ? (
                    <img src={previewPortrait} alt="Portrait Preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span>Click "Generate Previews"</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 4: // Caption Generation
        return (
          <div className="space-y-6">
            {/* Content Focus Selection */}
            <div className="bg-white rounded-xl border p-5 space-y-4">
              <h3 className="font-medium text-gray-900">Content Focus</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {CONTENT_FOCUS_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setContentFocus(option.id)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      contentFocus === option.id
                        ? 'bg-pink-500 text-white border-pink-500'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-pink-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              
              <button
                onClick={generateCaptions}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50"
                data-testid="generate-captions-btn"
              >
                {loading ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                <span>Generate Captions</span>
              </button>
            </div>

            {/* Caption Options */}
            <CaptionEditor
              captions={generatedCaptions}
              selectedIndex={selectedCaptionIndex}
              onSelectCaption={setSelectedCaptionIndex}
              onUpdateCaption={handleUpdateCaption}
            />
          </div>
        );

      case 5: // Save
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-5 space-y-4">
              <h3 className="font-medium text-gray-900">Post Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Post Title *</label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Enter a title for this post"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  data-testid="post-title-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Post Type</label>
                  <select
                    value={postType}
                    onChange={(e) => setPostType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  >
                    {POST_TYPES.map(type => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                  <select
                    value={formatType}
                    onChange={(e) => setFormatType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  >
                    {FORMAT_TYPES.map(type => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes for the team (not published)"
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl border p-5 space-y-3">
              <h3 className="font-medium text-gray-900">Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Privacy zones:</span>
                  <span className="font-medium">{blurZones.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Privacy reviewed:</span>
                  <span className={`font-medium ${privacyReviewed ? 'text-green-600' : 'text-yellow-600'}`}>
                    {privacyReviewed ? 'Yes' : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Captions generated:</span>
                  <span className="font-medium">{generatedCaptions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Previews:</span>
                  <span className="font-medium">{(previewSquare && previewPortrait) ? '2' : '0'}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" data-testid="new-post-workflow">
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
            <h2 className="text-2xl font-bold text-gray-900">Create Content</h2>
            <p className="text-gray-500 text-sm mt-1">Privacy-protected Instagram content workflow</p>
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between">
          {WORKFLOW_STEPS.map((step, index) => {
            // Skip frame selection for images
            if (step.id === 'select' && !isVideo && uploadedAsset) return null;
            
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const StepIcon = step.icon;
            
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => isCompleted && goToStep(index)}
                  disabled={!isCompleted && !isActive}
                  className={`flex flex-col items-center space-y-1 ${
                    isCompleted ? 'cursor-pointer' : isActive ? '' : 'opacity-50'
                  }`}
                  data-testid={`step-${step.id}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isActive 
                      ? 'bg-pink-500 text-white' 
                      : isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isCompleted ? <Check size={20} /> : <StepIcon size={20} />}
                  </div>
                  <span className={`text-xs font-medium ${
                    isActive ? 'text-pink-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </button>
                
                {index < WORKFLOW_STEPS.length - 1 && !(step.id === 'select' && !isVideo) && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border p-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <ArrowLeft size={18} />
          <span>Previous</span>
        </button>

        <div className="flex space-x-3">
          {currentStep === WORKFLOW_STEPS.length - 1 ? (
            <>
              <button
                onClick={() => handleSaveDraft(false)}
                disabled={saving || !postTitle.trim()}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
                data-testid="save-draft-btn"
              >
                <Save size={18} />
                <span>Save Draft</span>
              </button>
              <button
                onClick={() => handleSaveDraft(true)}
                disabled={saving || !postTitle.trim()}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50"
                data-testid="submit-review-btn"
              >
                {saving ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                <span>Submit for Review</span>
              </button>
            </>
          ) : (
            <button
              onClick={nextStep}
              disabled={loading || (!uploadedAsset && currentStep === 0)}
              className="flex items-center space-x-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50"
              data-testid="next-step-btn"
            >
              <span>Next</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewPostWorkflow;
