import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Clock, CheckCircle, XCircle, Eye, MessageSquare, Edit2,
  Image, Video, RefreshCw, Filter, ChevronDown, Send,
  AlertTriangle, User, Calendar
} from 'lucide-react';

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
  const [showPreview, setShowPreview] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

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
      const response = await axios.get(`${API}/content-worker/drafts/${draft.id}`);
      setSelectedDraft(response.data);
      setShowPreview(true);
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

      {/* Preview Modal */}
      {showPreview && selectedDraft && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b z-10">
              <h3 className="font-semibold text-gray-900">{selectedDraft.post_title}</h3>
              <button
                onClick={() => { setShowPreview(false); setSelectedDraft(null); }}
                className="p-2 hover:bg-gray-100 rounded-full"
                data-testid="close-preview-modal"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* Asset Preview */}
              <div>
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  {selectedDraft.asset?.file_type === 'video' ? (
                    <video
                      src={selectedDraft.asset?.original_file_url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={selectedDraft.asset?.original_file_url}
                      alt={selectedDraft.post_title}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                {selectedDraft.privacy_flags?.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-yellow-700">
                      <AlertTriangle size={16} />
                      <span className="text-sm font-medium">{selectedDraft.privacy_flags.length} privacy flag(s) detected</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Content Details */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  {(() => {
                    const statusConfig = STATUS_CONFIG[selectedDraft.status] || STATUS_CONFIG.draft;
                    const StatusIcon = statusConfig.icon;
                    return (
                      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                        <StatusIcon size={14} />
                        <span>{statusConfig.label}</span>
                      </span>
                    );
                  })()}
                  <span className="text-sm text-gray-500">{selectedDraft.format_type}</span>
                </div>

                {selectedDraft.hook && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Hook</label>
                    <p className="text-gray-900 font-medium">{selectedDraft.hook}</p>
                  </div>
                )}

                {selectedDraft.selected_caption && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Selected Caption</label>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedDraft.selected_caption}</p>
                  </div>
                )}

                {selectedDraft.cta && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Call to Action</label>
                    <p className="text-gray-700">{selectedDraft.cta}</p>
                  </div>
                )}

                {selectedDraft.hashtags && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Hashtags</label>
                    <p className="text-pink-600">{selectedDraft.hashtags}</p>
                  </div>
                )}

                {selectedDraft.notes && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Internal Notes</label>
                    <p className="text-gray-600 italic">{selectedDraft.notes}</p>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Created by: {selectedDraft.created_by}</p>
                    <p>Created: {new Date(selectedDraft.created_at).toLocaleString()}</p>
                    {selectedDraft.approved_by && <p className="text-green-600">Approved by: {selectedDraft.approved_by}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 bg-gray-50 p-4 border-t flex items-center justify-between">
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
                      onClick={() => setShowRejectModal(true)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(selectedDraft.id)}
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
