import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Clock, CheckCircle, XCircle, Eye, MessageSquare, Edit2,
  Image, Video, RefreshCw, Filter, ChevronDown, Send,
  AlertTriangle, User, Calendar, Shield, ArrowLeft, Copy
} from 'lucide-react';
import CaptionEditor from './CaptionEditor';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit2 },
  review: { label: 'In Review', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: Calendar },
  posted: { label: 'Posted', color: 'bg-purple-100 text-purple-700', icon: Send }
};

const ReviewQueue = ({ onNavigate }) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [fullDraftData, setFullDraftData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedCaptionIndex, setSelectedCaptionIndex] = useState(0);
  const [viewMode, setViewMode] = useState('processed'); // 'original' or 'processed'
  const [loadingDraft, setLoadingDraft] = useState(false);

  useEffect(() => {
    fetchDrafts();
  }, [statusFilter]);

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await axios.get(`${API}/content-worker/drafts${params}`);
      setDrafts(response.data.drafts || []);
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
      toast.error('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  };

  const fetchFullDraft = async (draftId) => {
    setLoadingDraft(true);
    try {
      const response = await axios.get(`${API}/content-worker/drafts/${draftId}/full`);
      setFullDraftData(response.data);
      setSelectedCaptionIndex(response.data.selected_caption_index || 0);
      setReviewNotes(response.data.review_notes || '');
    } catch (err) {
      toast.error('Failed to load draft details');
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleReviewAction = async (action) => {
    if (!selectedDraft) return;
    
    try {
      await axios.put(`${API}/content-worker/drafts/${selectedDraft.id}/review-action`, null, {
        params: {
          action: action,
          notes: reviewNotes,
          selected_caption_index: selectedCaptionIndex
        }
      });
      
      const messages = {
        approve: 'Draft approved',
        reject: 'Draft rejected',
        send_back: 'Draft sent back to creator'
      };
      
      toast.success(messages[action]);
      setShowPreview(false);
      setShowRejectModal(false);
      setRejectNotes('');
      fetchDrafts();
    } catch (err) {
      toast.error(`Failed to ${action} draft`);
    }
  };

  const handleApprove = async (draftId) => {
    try {
      await axios.post(`${API}/content-worker/drafts/${draftId}/approve`);
      toast.success('Draft approved');
      fetchDrafts();
      setShowPreview(false);
    } catch (err) {
      toast.error('Failed to approve draft');
    }
  };

  const handleReject = async () => {
    if (!selectedDraft) return;
    try {
      await axios.post(`${API}/content-worker/drafts/${selectedDraft.id}/reject`, null, {
        params: { notes: rejectNotes }
      });
      toast.success('Draft rejected');
      setShowRejectModal(false);
      setRejectNotes('');
      setShowPreview(false);
      fetchDrafts();
    } catch (err) {
      toast.error('Failed to reject draft');
    }
  };

  const handleDelete = async (draftId) => {
    if (!window.confirm('Delete this draft permanently?')) return;
    try {
      await axios.delete(`${API}/content-worker/drafts/${draftId}`);
      toast.success('Draft deleted');
      fetchDrafts();
      setShowPreview(false);
    } catch (err) {
      toast.error('Failed to delete draft');
    }
  };

  const handleSubmitForReview = async (draftId) => {
    try {
      await axios.post(`${API}/content-worker/drafts/${draftId}/submit-review`);
      toast.success('Submitted for review');
      fetchDrafts();
    } catch (err) {
      toast.error('Failed to submit for review');
    }
  };

  const openPreview = async (draft) => {
    try {
      setSelectedDraft(draft);
      setShowPreview(true);
      // Fetch full draft data including blur zones and captions
      await fetchFullDraft(draft.id);
    } catch (err) {
      toast.error('Failed to load draft details');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="review-queue-loading">
        <RefreshCw className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="review-queue">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Review</h2>
          <p className="text-gray-500 text-sm mt-1">Review, approve, or request changes</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter size={18} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              data-testid="status-filter-select"
            >
              <option value="all">All Status</option>
              <option value="draft">Drafts</option>
              <option value="review">In Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
          <button
            onClick={fetchDrafts}
            className="p-2 border rounded-lg hover:bg-gray-50"
            data-testid="refresh-btn"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Drafts List */}
      {drafts.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="divide-y">
            {drafts.map((draft) => {
              const statusConfig = STATUS_CONFIG[draft.status] || STATUS_CONFIG.draft;
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={draft.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                  data-testid={`draft-item-${draft.id}`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      {draft.asset?.thumbnail_url || draft.asset?.original_file_url ? (
                        draft.asset?.file_type === 'video' ? (
                          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                            <Video className="text-white" size={24} />
                          </div>
                        ) : (
                          <img
                            src={draft.asset?.thumbnail_url || draft.asset?.original_file_url}
                            alt={draft.post_title}
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="text-gray-300" size={24} />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{draft.post_title}</h4>
                          <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
                            <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                              <StatusIcon size={12} />
                              <span>{statusConfig.label}</span>
                            </span>
                            <span>{draft.post_type?.replace('_', ' ')}</span>
                            <span>{draft.format_type}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openPreview(draft)}
                            className="p-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                            title="Preview"
                            data-testid={`preview-draft-${draft.id}`}
                          >
                            <Eye size={18} />
                          </button>
                          {draft.status === 'draft' && (
                            <button
                              onClick={() => handleSubmitForReview(draft.id)}
                              className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg transition-colors"
                              data-testid={`submit-review-${draft.id}`}
                            >
                              Submit for Review
                            </button>
                          )}
                          {draft.status === 'review' && (
                            <>
                              <button
                                onClick={() => handleApprove(draft.id)}
                                className="px-3 py-1.5 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors"
                                data-testid={`approve-draft-${draft.id}`}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => { setSelectedDraft(draft); setShowRejectModal(true); }}
                                className="px-3 py-1.5 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors"
                                data-testid={`reject-draft-${draft.id}`}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {draft.hook && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-1">
                          <span className="font-medium">Hook:</span> {draft.hook}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center space-x-1">
                          <User size={12} />
                          <span>{draft.created_by}</span>
                        </span>
                        <span>{new Date(draft.created_at).toLocaleDateString()}</span>
                        {draft.approved_by && (
                          <span className="text-green-600">Approved by {draft.approved_by}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Clock className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No drafts found</h3>
          <p className="text-gray-500 mb-4">
            {statusFilter !== 'all'
              ? `No drafts with "${statusFilter}" status`
              : 'Create your first post to see it here'}
          </p>
          <button
            onClick={() => onNavigate('new-post')}
            className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
          >
            Create New Post
          </button>
        </div>
      )}

      {/* Enhanced Preview Modal */}
      {showPreview && selectedDraft && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b z-10">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => { setShowPreview(false); setSelectedDraft(null); setFullDraftData(null); }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedDraft.post_title}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    {(() => {
                      const statusConfig = STATUS_CONFIG[selectedDraft.status] || STATUS_CONFIG.draft;
                      const StatusIcon = statusConfig.icon;
                      return (
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon size={12} />
                          <span>{statusConfig.label}</span>
                        </span>
                      );
                    })()}
                    <span className="text-xs text-gray-500">{selectedDraft.format_type} • {selectedDraft.post_type}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setShowPreview(false); setSelectedDraft(null); setFullDraftData(null); }}
                className="p-2 hover:bg-gray-100 rounded-full"
                data-testid="close-preview-modal"
              >
                <XCircle size={20} />
              </button>
            </div>

            {loadingDraft ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="animate-spin text-pink-500" size={32} />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Image Previews - Original vs Processed */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Preview</label>
                    <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('original')}
                        className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                          viewMode === 'original' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        Original
                      </button>
                      <button
                        onClick={() => setViewMode('processed')}
                        className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                          viewMode === 'processed' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        Processed (Blurred)
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="text-xs text-gray-500">Square (1080x1080)</span>
                      <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border">
                        <img
                          src={viewMode === 'processed' && fullDraftData?.preview_url_square 
                            ? fullDraftData.preview_url_square 
                            : selectedDraft.asset?.original_file_url}
                          alt="Square Preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs text-gray-500">Portrait (1080x1350)</span>
                      <div className="aspect-[4/5] bg-gray-100 rounded-xl overflow-hidden border">
                        <img
                          src={viewMode === 'processed' && fullDraftData?.preview_url_portrait 
                            ? fullDraftData.preview_url_portrait 
                            : selectedDraft.asset?.original_file_url}
                          alt="Portrait Preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Privacy / Blur Zones */}
                {fullDraftData?.blur_zones?.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 text-yellow-700 mb-3">
                      <Shield size={18} />
                      <span className="font-medium">Privacy Zones ({fullDraftData.blur_zones.length})</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {fullDraftData.blur_zones.map((zone, idx) => (
                        <div key={zone.id || idx} className="bg-white p-2 rounded-lg border border-yellow-200 text-xs">
                          <span className="font-medium text-gray-700">{zone.type?.replace('_', ' ')}</span>
                          {zone.text && <p className="text-gray-500 truncate mt-1">"{zone.text}"</p>}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center space-x-2 mt-3">
                      <CheckCircle size={14} className={fullDraftData.privacy_reviewed ? 'text-green-600' : 'text-gray-400'} />
                      <span className={`text-sm ${fullDraftData.privacy_reviewed ? 'text-green-600' : 'text-gray-500'}`}>
                        {fullDraftData.privacy_reviewed ? 'Privacy reviewed' : 'Privacy review pending'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Caption Options */}
                {fullDraftData?.generated_captions?.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Caption Options</label>
                    <CaptionEditor
                      captions={fullDraftData.generated_captions}
                      selectedIndex={selectedCaptionIndex}
                      onSelectCaption={setSelectedCaptionIndex}
                      readOnly={selectedDraft.status !== 'review'}
                    />
                  </div>
                )}

                {/* Reviewer Notes */}
                {selectedDraft.status === 'review' && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Internal Review Notes</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add notes for the team (optional)"
                      rows={3}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                      data-testid="review-notes-input"
                    />
                  </div>
                )}

                {/* Draft Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Created by</span>
                      <p className="font-medium text-gray-900">{selectedDraft.created_by}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Created</span>
                      <p className="font-medium text-gray-900">{new Date(selectedDraft.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Content Focus</span>
                      <p className="font-medium text-gray-900">{fullDraftData?.content_focus?.replace('_', ' ') || 'N/A'}</p>
                    </div>
                    {selectedDraft.approved_by && (
                      <div>
                        <span className="text-gray-500">Approved by</span>
                        <p className="font-medium text-green-600">{selectedDraft.approved_by}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="sticky bottom-0 bg-white p-4 border-t flex items-center justify-between">
              <button
                onClick={() => handleDelete(selectedDraft.id)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                data-testid="delete-draft-btn"
              >
                Delete Draft
              </button>
              <div className="flex space-x-3">
                {selectedDraft.status === 'draft' && (
                  <button
                    onClick={() => handleSubmitForReview(selectedDraft.id)}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    Submit for Review
                  </button>
                )}
                {selectedDraft.status === 'review' && (
                  <>
                    <button
                      onClick={() => handleReviewAction('send_back')}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Send Back to Draft
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleReviewAction('approve')}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Reject Draft</h3>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Add feedback for the creator (optional)"
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none mb-4"
              data-testid="reject-notes-input"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => { setShowRejectModal(false); setRejectNotes(''); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                data-testid="confirm-reject-btn"
              >
                Reject Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewQueue;
