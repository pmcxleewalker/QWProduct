import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Lightbulb, Plus, Trash2, Check, X, Edit2, Star,
  RefreshCw, Filter, Sparkles, Target, MessageSquare,
  ChevronRight, Tag
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { id: 'product_demo', label: 'Product Demo', color: 'bg-blue-100 text-blue-700' },
  { id: 'pain_point', label: 'Pain Point', color: 'bg-red-100 text-red-700' },
  { id: 'educational', label: 'Educational', color: 'bg-green-100 text-green-700' },
  { id: 'trust_proof', label: 'Trust Proof', color: 'bg-purple-100 text-purple-700' },
  { id: 'feature_spotlight', label: 'Feature Spotlight', color: 'bg-orange-100 text-orange-700' },
  { id: 'trending', label: 'Trending Topic', color: 'bg-pink-100 text-pink-700' }
];

const FORMATS = [
  { id: 'reel', label: 'Reel' },
  { id: 'carousel', label: 'Carousel' },
  { id: 'single_image', label: 'Single Image' },
  { id: 'story', label: 'Story' }
];

const ContentIdeas = ({ onNavigate }) => {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingIdea, setEditingIdea] = useState(null);

  const [newIdea, setNewIdea] = useState({
    title: '',
    category: 'product_demo',
    recommended_format: 'reel',
    hook: '',
    caption_starter: '',
    cta: '',
    target_audience: '',
    reason_for_recommendation: ''
  });

  useEffect(() => {
    fetchIdeas();
  }, [categoryFilter]);

  const fetchIdeas = async () => {
    try {
      setLoading(true);
      const params = categoryFilter !== 'all' ? `?category=${categoryFilter}` : '';
      const response = await axios.get(`${API}/content-worker/ideas${params}`);
      setIdeas(response.data.ideas || []);
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
      toast.error('Failed to load ideas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIdea = async () => {
    if (!newIdea.title.trim()) {
      toast.error('Please enter an idea title');
      return;
    }

    try {
      await axios.post(`${API}/content-worker/ideas`, newIdea);
      toast.success('Idea created');
      setShowCreateModal(false);
      setNewIdea({
        title: '',
        category: 'product_demo',
        recommended_format: 'reel',
        hook: '',
        caption_starter: '',
        cta: '',
        target_audience: '',
        reason_for_recommendation: ''
      });
      fetchIdeas();
    } catch (err) {
      toast.error('Failed to create idea');
    }
  };

  const handleDeleteIdea = async (ideaId) => {
    if (!window.confirm('Delete this idea?')) return;
    try {
      await axios.delete(`${API}/content-worker/ideas/${ideaId}`);
      toast.success('Idea deleted');
      fetchIdeas();
    } catch (err) {
      toast.error('Failed to delete idea');
    }
  };

  const handleUseIdea = (idea) => {
    onNavigate('new-post', { 
      prefillData: {
        post_title: idea.title,
        post_type: idea.category,
        format_type: idea.recommended_format,
        hook: idea.hook,
        cta: idea.cta
      }
    });
  };

  const handleUpdateStatus = async (ideaId, status) => {
    try {
      await axios.put(`${API}/content-worker/ideas/${ideaId}`, null, {
        params: { status }
      });
      toast.success(`Idea marked as ${status}`);
      fetchIdeas();
    } catch (err) {
      toast.error('Failed to update idea');
    }
  };

  const getCategoryConfig = (categoryId) => {
    return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="content-ideas-loading">
        <RefreshCw className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="content-ideas">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Ideas</h2>
          <p className="text-gray-500 text-sm mt-1">Capture and organize your content inspiration</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg hover:from-orange-600 hover:to-yellow-600 transition-all shadow-md"
          data-testid="add-idea-btn"
        >
          <Plus size={18} />
          <span>Add Idea</span>
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 bg-white rounded-lg p-4 border">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            categoryFilter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          data-testid="filter-all"
        >
          All Ideas
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              categoryFilter === cat.id
                ? 'bg-gray-900 text-white'
                : `${cat.color} hover:opacity-80`
            }`}
            data-testid={`filter-${cat.id}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Ideas Grid */}
      {ideas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((idea) => {
            const catConfig = getCategoryConfig(idea.category);
            return (
              <div
                key={idea.id}
                className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-all group"
                data-testid={`idea-card-${idea.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${catConfig.color}`}>
                    {catConfig.label}
                  </span>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleUseIdea(idea)}
                      className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                      title="Use this idea"
                      data-testid={`use-idea-${idea.id}`}
                    >
                      <ChevronRight size={16} className="text-green-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteIdea(idea.id)}
                      className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete"
                      data-testid={`delete-idea-${idea.id}`}
                    >
                      <Trash2 size={16} className="text-red-600" />
                    </button>
                  </div>
                </div>

                <h4 className="font-semibold text-gray-900 mb-2">{idea.title}</h4>

                {idea.hook && (
                  <div className="flex items-start space-x-2 mb-2">
                    <Sparkles size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600 line-clamp-2">{idea.hook}</p>
                  </div>
                )}

                {idea.target_audience && (
                  <div className="flex items-start space-x-2 mb-2">
                    <Target size={14} className="text-purple-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-500">{idea.target_audience}</p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className="text-xs text-gray-400">
                    {idea.recommended_format}
                  </span>
                  <button
                    onClick={() => handleUseIdea(idea)}
                    className="flex items-center space-x-1 text-sm text-pink-600 hover:text-pink-700 font-medium"
                  >
                    <span>Create Post</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lightbulb className="text-orange-500" size={32} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No ideas yet</h3>
          <p className="text-gray-500 mb-4">
            Start capturing your content inspiration
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Add Your First Idea
          </button>
        </div>
      )}

      {/* Inspiration Section */}
      <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl border border-orange-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Star className="text-orange-500" size={20} />
          <span>Quick Inspiration</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { title: "Show a day in the life of fleet management", category: "educational" },
            { title: "Before/after fleet organization", category: "pain_point" },
            { title: "Customer success story highlight", category: "trust_proof" },
            { title: "Quick tip: Booking efficiency hack", category: "feature_spotlight" },
            { title: "Behind the scenes of a busy booking day", category: "product_demo" },
            { title: "Common fleet mistakes to avoid", category: "educational" }
          ].map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => {
                setNewIdea(prev => ({ ...prev, title: suggestion.title, category: suggestion.category }));
                setShowCreateModal(true);
              }}
              className="p-3 bg-white rounded-lg text-left hover:shadow-md transition-all border border-orange-100"
              data-testid={`suggestion-${idx}`}
            >
              <p className="text-sm font-medium text-gray-900">{suggestion.title}</p>
              <span className={`text-xs ${getCategoryConfig(suggestion.category).color} mt-1 inline-block px-2 py-0.5 rounded`}>
                {getCategoryConfig(suggestion.category).label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Create Idea Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Add Content Idea</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
                data-testid="close-create-modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Idea Title *</label>
                <input
                  type="text"
                  value={newIdea.title}
                  onChange={(e) => setNewIdea(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="What's your content idea?"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  data-testid="idea-title-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={newIdea.category}
                    onChange={(e) => setNewIdea(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    data-testid="idea-category-select"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                  <select
                    value={newIdea.recommended_format}
                    onChange={(e) => setNewIdea(prev => ({ ...prev, recommended_format: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    data-testid="idea-format-select"
                  >
                    {FORMATS.map(fmt => (
                      <option key={fmt.id} value={fmt.id}>{fmt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hook (Opening Line)</label>
                <input
                  type="text"
                  value={newIdea.hook}
                  onChange={(e) => setNewIdea(prev => ({ ...prev, hook: e.target.value }))}
                  placeholder="The attention-grabbing first line"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  data-testid="idea-hook-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                <input
                  type="text"
                  value={newIdea.target_audience}
                  onChange={(e) => setNewIdea(prev => ({ ...prev, target_audience: e.target.value }))}
                  placeholder="Who is this content for?"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  data-testid="idea-audience-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Call to Action</label>
                <input
                  type="text"
                  value={newIdea.cta}
                  onChange={(e) => setNewIdea(prev => ({ ...prev, cta: e.target.value }))}
                  placeholder="What should viewers do?"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  data-testid="idea-cta-input"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateIdea}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                data-testid="save-idea-btn"
              >
                Save Idea
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentIdeas;
