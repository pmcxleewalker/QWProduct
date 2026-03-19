import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Lightbulb, Plus, Trash2, Check, X, ChevronRight, 
  RefreshCw, Filter, Sparkles, Target, TrendingUp,
  BarChart3, Zap, Eye, Users, BookOpen, Package,
  ArrowRight, Star, Calendar
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { id: 'product_demo', label: 'Product Demo', color: 'bg-blue-100 text-blue-700', icon: Package },
  { id: 'pain_point', label: 'Pain Point', color: 'bg-red-100 text-red-700', icon: Zap },
  { id: 'before_after', label: 'Before/After', color: 'bg-purple-100 text-purple-700', icon: ArrowRight },
  { id: 'educational', label: 'Educational', color: 'bg-green-100 text-green-700', icon: BookOpen },
  { id: 'trust_proof', label: 'Trust/Proof', color: 'bg-yellow-100 text-yellow-700', icon: Star },
  { id: 'feature_spotlight', label: 'Feature Spotlight', color: 'bg-orange-100 text-orange-700', icon: Eye }
];

const FORMATS = [
  { id: 'reel', label: 'Reel' },
  { id: 'carousel', label: 'Carousel' },
  { id: 'single_image', label: 'Single Image' },
  { id: 'story', label: 'Story' }
];

const GOALS = [
  { id: 'reach', label: 'Reach', description: 'Maximize visibility', icon: Eye },
  { id: 'engagement', label: 'Engagement', description: 'Drive interactions', icon: Users },
  { id: 'leads', label: 'Leads', description: 'Generate enquiries', icon: Target },
  { id: 'education', label: 'Education', description: 'Build authority', icon: BookOpen },
  { id: 'product_awareness', label: 'Product Awareness', description: 'Showcase features', icon: Package }
];

const ContentIdeasEngine = ({ onNavigate }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [performance, setPerformance] = useState({ categories: [], formats: [] });
  const [loading, setLoading] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Filters
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('suggestions');

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (selectedGoal !== null) {
      fetchSuggestions(selectedGoal);
    }
  }, [selectedGoal]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSuggestions(),
        fetchSavedIdeas(),
        fetchPerformance()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async (goal = null) => {
    setLoadingSuggestions(true);
    try {
      const params = goal ? `?goal=${goal}&limit=7` : '?limit=7';
      const response = await axios.get(`${API}/content-worker/ideas/suggestions${params}`);
      setSuggestions(response.data.suggestions || []);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const fetchSavedIdeas = async () => {
    try {
      const response = await axios.get(`${API}/content-worker/ideas`);
      setSavedIdeas(response.data.ideas || []);
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
    }
  };

  const fetchPerformance = async () => {
    try {
      const response = await axios.get(`${API}/content-worker/ideas/performance`);
      setPerformance(response.data);
    } catch (err) {
      console.error('Failed to fetch performance:', err);
    }
  };

  const handleSaveSuggestion = async (suggestion) => {
    try {
      await axios.post(`${API}/content-worker/ideas/from-suggestion`, {
        title: suggestion.title,
        category: suggestion.category,
        recommended_format: suggestion.recommended_format,
        hook: suggestion.hook,
        caption_starter: suggestion.caption_starter,
        cta: suggestion.cta,
        target_audience: suggestion.target_audience,
        reason_for_recommendation: suggestion.reason,
        confidence_score: suggestion.confidence,
        goal: suggestion.goals?.[0]
      });
      toast.success('Idea saved to your library');
      fetchSavedIdeas();
    } catch (err) {
      toast.error('Failed to save idea');
    }
  };

  const handleCreateDraft = async (idea) => {
    // If it's a suggestion, save it first
    if (idea.id?.startsWith('suggestion_')) {
      try {
        const saveRes = await axios.post(`${API}/content-worker/ideas/from-suggestion`, {
          title: idea.title,
          category: idea.category,
          recommended_format: idea.recommended_format,
          hook: idea.hook,
          caption_starter: idea.caption_starter,
          cta: idea.cta,
          target_audience: idea.target_audience,
          reason_for_recommendation: idea.reason,
          confidence_score: idea.confidence,
          goal: idea.goals?.[0]
        });
        
        // Now create draft from saved idea
        const draftRes = await axios.post(`${API}/content-worker/ideas/${saveRes.data.idea.id}/create-draft`);
        toast.success('Draft created');
        onNavigate('review');
      } catch (err) {
        toast.error('Failed to create draft');
      }
    } else {
      // It's a saved idea
      try {
        await axios.post(`${API}/content-worker/ideas/${idea.id}/create-draft`);
        toast.success('Draft created');
        onNavigate('review');
      } catch (err) {
        toast.error('Failed to create draft');
      }
    }
  };

  const handleDeleteIdea = async (ideaId) => {
    if (!window.confirm('Delete this idea?')) return;
    try {
      await axios.delete(`${API}/content-worker/ideas/${ideaId}`);
      toast.success('Idea deleted');
      fetchSavedIdeas();
    } catch (err) {
      toast.error('Failed to delete idea');
    }
  };

  const getCategoryConfig = (categoryId) => {
    return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];
  };

  const getConfidenceColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 80) return 'text-blue-600 bg-blue-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  // Filter saved ideas
  const filteredIdeas = savedIdeas.filter(idea => {
    if (categoryFilter !== 'all' && idea.category !== categoryFilter) return false;
    if (formatFilter !== 'all' && idea.recommended_format !== formatFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="ideas-engine-loading">
        <RefreshCw className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="content-ideas-engine">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Ideas Engine</h2>
          <p className="text-gray-500 text-sm mt-1">AI-powered content suggestions for Quick Wing</p>
        </div>
        <button
          onClick={() => fetchSuggestions(selectedGoal)}
          disabled={loadingSuggestions}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg hover:from-orange-600 hover:to-pink-600 transition-all disabled:opacity-50"
          data-testid="refresh-suggestions-btn"
        >
          {loadingSuggestions ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
          <span>Refresh Ideas</span>
        </button>
      </div>

      {/* Goal Selector */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Content Goal</h3>
            <p className="text-sm text-gray-500">Prioritize ideas based on your current objective</p>
          </div>
          {selectedGoal && (
            <button
              onClick={() => { setSelectedGoal(null); fetchSuggestions(); }}
              className="text-sm text-pink-600 hover:text-pink-700"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {GOALS.map(goal => (
            <button
              key={goal.id}
              onClick={() => setSelectedGoal(goal.id)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                selectedGoal === goal.id
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              data-testid={`goal-${goal.id}`}
            >
              <goal.icon className={`mb-2 ${selectedGoal === goal.id ? 'text-pink-500' : 'text-gray-400'}`} size={20} />
              <p className="font-medium text-gray-900 text-sm">{goal.label}</p>
              <p className="text-xs text-gray-500 mt-1">{goal.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        {[
          { id: 'suggestions', label: 'Suggested This Week', count: suggestions.length },
          { id: 'saved', label: 'Saved Ideas', count: savedIdeas.length },
          { id: 'performance', label: 'Performance Insights' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-pink-100 text-pink-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Suggested This Week */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          {loadingSuggestions ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-pink-500" size={32} />
            </div>
          ) : suggestions.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {suggestions.map((suggestion, index) => {
                const catConfig = getCategoryConfig(suggestion.category);
                const CatIcon = catConfig.icon;
                
                return (
                  <div
                    key={suggestion.id}
                    className="bg-white rounded-xl border p-5 hover:shadow-md transition-all group"
                    data-testid={`suggestion-${index}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Position Badge */}
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-lg">{suggestion.title}</h4>
                            <div className="flex items-center flex-wrap gap-2 mt-2">
                              <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${catConfig.color}`}>
                                <CatIcon size={12} />
                                <span>{catConfig.label}</span>
                              </span>
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                {suggestion.recommended_format}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                                {suggestion.confidence}% confidence
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleSaveSuggestion(suggestion)}
                              className="p-2 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                              title="Save to library"
                              data-testid={`save-suggestion-${index}`}
                            >
                              <Plus size={18} />
                            </button>
                            <button
                              onClick={() => handleCreateDraft(suggestion)}
                              className="flex items-center space-x-1 px-3 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm"
                              data-testid={`create-draft-${index}`}
                            >
                              <span>Create Draft</span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="mt-4 space-y-3">
                          {suggestion.hook && (
                            <div>
                              <span className="text-xs font-medium text-pink-600 uppercase tracking-wide">Hook</span>
                              <p className="text-gray-900 font-medium mt-1">{suggestion.hook}</p>
                            </div>
                          )}
                          
                          {suggestion.caption_starter && (
                            <div>
                              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Caption Starter</span>
                              <p className="text-gray-700 text-sm mt-1">{suggestion.caption_starter}</p>
                            </div>
                          )}

                          <div className="flex items-start justify-between pt-3 border-t">
                            <div className="flex-1">
                              {suggestion.cta && (
                                <p className="text-sm text-blue-600 font-medium">{suggestion.cta}</p>
                              )}
                              {suggestion.target_audience && (
                                <p className="text-xs text-gray-500 mt-1">
                                  <strong>Target:</strong> {suggestion.target_audience}
                                </p>
                              )}
                            </div>
                            {suggestion.reason && (
                              <div className="flex-shrink-0 max-w-xs">
                                <p className="text-xs text-gray-500 italic bg-gray-50 px-3 py-2 rounded-lg">
                                  <Lightbulb size={12} className="inline mr-1 text-yellow-500" />
                                  {suggestion.reason}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border">
              <Lightbulb className="mx-auto text-gray-300 mb-4" size={48} />
              <h3 className="font-medium text-gray-900">No suggestions available</h3>
              <p className="text-gray-500 text-sm mt-1">Try selecting a different goal</p>
            </div>
          )}
        </div>
      )}

      {/* Saved Ideas */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center space-x-4 bg-white rounded-lg p-4 border">
            <div className="flex items-center space-x-2">
              <Filter size={16} className="text-gray-400" />
              <span className="text-sm text-gray-500">Filter:</span>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              data-testid="category-filter"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              data-testid="format-filter"
            >
              <option value="all">All Formats</option>
              {FORMATS.map(fmt => (
                <option key={fmt.id} value={fmt.id}>{fmt.label}</option>
              ))}
            </select>
          </div>

          {filteredIdeas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIdeas.map((idea) => {
                const catConfig = getCategoryConfig(idea.category);
                const CatIcon = catConfig.icon;
                
                return (
                  <div
                    key={idea.id}
                    className="bg-white rounded-xl border p-5 hover:shadow-md transition-all group"
                    data-testid={`saved-idea-${idea.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${catConfig.color}`}>
                        <CatIcon size={12} />
                        <span>{catConfig.label}</span>
                      </span>
                      <div className="flex items-center space-x-1">
                        {idea.status === 'draft_created' && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                            Draft Created
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteIdea(idea.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          data-testid={`delete-idea-${idea.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-semibold text-gray-900 mb-2">{idea.title}</h4>
                    
                    {idea.hook && (
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-medium text-pink-600">Hook:</span> {idea.hook}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span className="px-2 py-0.5 bg-gray-100 rounded">{idea.recommended_format}</span>
                        {idea.confidence_score && (
                          <span>{idea.confidence_score}% confidence</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCreateDraft(idea)}
                        disabled={idea.status === 'draft_created'}
                        className="flex items-center space-x-1 text-sm text-pink-600 hover:text-pink-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid={`create-draft-saved-${idea.id}`}
                      >
                        <span>Create Draft</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border">
              <Lightbulb className="mx-auto text-gray-300 mb-4" size={48} />
              <h3 className="font-medium text-gray-900">No saved ideas</h3>
              <p className="text-gray-500 text-sm mt-1">Save suggestions from the "Suggested This Week" tab</p>
            </div>
          )}
        </div>
      )}

      {/* Performance Insights */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Note about placeholder data */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <BarChart3 className="text-blue-500 mt-0.5" size={20} />
              <div>
                <p className="text-sm text-blue-800 font-medium">Performance data coming soon</p>
                <p className="text-xs text-blue-600 mt-1">
                  Current metrics are based on industry benchmarks. Real analytics will be available when Instagram is connected.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performing Categories */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="text-green-500" size={20} />
                <h3 className="font-semibold text-gray-900">Top Performing Categories</h3>
              </div>
              <div className="space-y-3">
                {performance.categories?.map((cat, index) => {
                  const catConfig = getCategoryConfig(cat.id);
                  return (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full text-xs font-bold text-gray-600">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{cat.name}</p>
                          <p className="text-xs text-gray-500">{cat.posts_count} posts</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{cat.score}</p>
                        <p className="text-xs text-gray-500">{cat.engagement_rate}% eng.</p>
                        {cat.trend === 'up' && (
                          <span className="text-xs text-green-600">↑ Trending</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Performing Formats */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center space-x-2 mb-4">
                <BarChart3 className="text-purple-500" size={20} />
                <h3 className="font-semibold text-gray-900">Top Performing Formats</h3>
              </div>
              <div className="space-y-3">
                {performance.formats?.map((fmt, index) => (
                  <div key={fmt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full text-xs font-bold text-gray-600">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{fmt.name}</p>
                        <p className="text-xs text-gray-500">~{fmt.avg_reach.toLocaleString()} reach</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{fmt.score}</p>
                      <p className="text-xs text-gray-500">{fmt.engagement_rate}% eng.</p>
                      {fmt.trend === 'up' && (
                        <span className="text-xs text-green-600">↑ Trending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Recommendations */}
          <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl border border-orange-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <Sparkles className="text-orange-500" size={20} />
              <span>Quick Recommendations</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <p className="font-medium text-gray-900 text-sm">Post More Reels</p>
                <p className="text-xs text-gray-500 mt-1">Reels have 40% higher reach than images</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="font-medium text-gray-900 text-sm">Try Pain Point Content</p>
                <p className="text-xs text-gray-500 mt-1">Highest engagement category at 5.1%</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="font-medium text-gray-900 text-sm">Add Trust/Proof Posts</p>
                <p className="text-xs text-gray-500 mt-1">Only 1 post this month - high opportunity</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentIdeasEngine;
