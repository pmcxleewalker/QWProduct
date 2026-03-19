import React, { useState } from 'react';
import { 
  LayoutDashboard, Image, PenSquare, Clock, Send, 
  Lightbulb, Settings, ChevronLeft
} from 'lucide-react';

import ContentDashboard from './ContentDashboard';
import AssetManager from './AssetManager';
import NewPost from './NewPost';
import ReviewQueue from './ReviewQueue';
import PostedContent from './PostedContent';
import ContentIdeas from './ContentIdeas';
import ContentSettings from './ContentSettings';

const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'assets', label: 'Assets', icon: Image },
  { id: 'new-post', label: 'New Post', icon: PenSquare },
  { id: 'review', label: 'Review Queue', icon: Clock },
  { id: 'posted', label: 'Posted', icon: Send },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'settings', label: 'Settings', icon: Settings }
];

const ContentWorker = ({ onBack }) => {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [navData, setNavData] = useState(null);

  const handleNavigate = (view, data = null) => {
    setActiveView(view);
    setNavData(data);
    if (data?.asset) {
      setSelectedAsset(data.asset);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <ContentDashboard onNavigate={handleNavigate} />;
      case 'assets':
        return (
          <AssetManager 
            onNavigate={handleNavigate} 
            onSelectAsset={setSelectedAsset} 
          />
        );
      case 'new-post':
        return (
          <NewPost 
            onNavigate={handleNavigate} 
            initialAsset={selectedAsset || navData?.asset}
          />
        );
      case 'review':
      case 'drafts':
        return <ReviewQueue onNavigate={handleNavigate} />;
      case 'posted':
        return <PostedContent onNavigate={handleNavigate} />;
      case 'ideas':
        return <ContentIdeas onNavigate={handleNavigate} />;
      case 'settings':
        return <ContentSettings onNavigate={handleNavigate} />;
      default:
        return <ContentDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="content-worker-module">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  data-testid="back-to-command-centre"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold">Quick Wing Content Worker</h1>
                <p className="text-sm text-white/70">Instagram Content Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                Social Media Manager
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto pb-2 -mb-px">
            {NAVIGATION_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-lg font-medium text-sm whitespace-nowrap transition-all ${
                  activeView === item.id || (item.id === 'review' && activeView === 'drafts')
                    ? 'bg-gray-50 text-purple-600'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
                data-testid={`nav-${item.id}`}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {renderContent()}
      </div>
    </div>
  );
};

export default ContentWorker;
