import React, { useState } from 'react';
import { 
  LayoutDashboard, Image, PenSquare, Clock, Send, 
  Lightbulb, Settings, ChevronLeft, BarChart3, BookOpen,
  Menu, X, ChevronDown
} from 'lucide-react';

import ContentDashboard from './ContentDashboard';
import AssetManager from './AssetManager';
import NewPostWorkflow from './NewPostWorkflow';
import ReviewQueue from './ReviewQueue';
import PostedContent from './PostedContent';
import ContentIdeasEngine from './ContentIdeasEngine';
import ContentSettings from './ContentSettings';
import ContentAnalytics from './ContentAnalytics';
import TrainingGuide from './TrainingGuide';

const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'assets', label: 'Assets', icon: Image },
  { id: 'new-post', label: 'New Post', icon: PenSquare },
  { id: 'review', label: 'Review', icon: Clock },
  { id: 'posted', label: 'Posted', icon: Send },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help', icon: BookOpen }
];

const ContentWorker = ({ onBack }) => {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [navData, setNavData] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigate = (view, data = null) => {
    setActiveView(view);
    setNavData(data);
    setMobileMenuOpen(false);
    if (data?.asset) {
      setSelectedAsset(data.asset);
    }
  };

  const getActiveLabel = () => {
    const item = NAVIGATION_ITEMS.find(i => i.id === activeView);
    return item?.label || 'Dashboard';
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
          <NewPostWorkflow 
            onNavigate={handleNavigate} 
            initialAsset={selectedAsset || navData?.asset}
          />
        );
      case 'review':
      case 'drafts':
        return <ReviewQueue onNavigate={handleNavigate} />;
      case 'posted':
        return <PostedContent onNavigate={handleNavigate} />;
      case 'analytics':
        return <ContentAnalytics onNavigate={handleNavigate} />;
      case 'ideas':
        return <ContentIdeasEngine onNavigate={handleNavigate} />;
      case 'settings':
        return <ContentSettings onNavigate={handleNavigate} />;
      case 'help':
        return <TrainingGuide onNavigate={handleNavigate} />;
      default:
        return <ContentDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="content-worker-module">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                  data-testid="back-to-command-centre"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold truncate">Content Worker</h1>
                <p className="text-xs sm:text-sm text-white/70 hidden sm:block">Instagram Content Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 sm:px-3 py-1 bg-white/20 rounded-full text-xs sm:text-sm hidden sm:inline-flex">
                Social Media Manager
              </span>
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
                data-testid="mobile-menu-toggle"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 hidden md:block">
          <div className="flex space-x-1 overflow-x-auto pb-2 -mb-px scrollbar-hide">
            {NAVIGATION_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`flex items-center space-x-2 px-3 lg:px-4 py-2.5 rounded-t-lg font-medium text-sm whitespace-nowrap transition-all ${
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

        {/* Mobile Current Tab Indicator */}
        <div className="md:hidden px-3 pb-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-between w-full px-3 py-2 bg-white/10 rounded-lg"
          >
            <div className="flex items-center space-x-2">
              {(() => {
                const ActiveIcon = NAVIGATION_ITEMS.find(i => i.id === activeView)?.icon || LayoutDashboard;
                return <ActiveIcon size={16} />;
              })()}
              <span className="font-medium text-sm">{getActiveLabel()}</span>
            </div>
            <ChevronDown size={16} className={`transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute left-0 right-0 bg-white shadow-lg border-t z-50 max-h-[60vh] overflow-y-auto">
            <div className="p-2">
              {NAVIGATION_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-left transition-colors ${
                    activeView === item.id || (item.id === 'review' && activeView === 'drafts')
                      ? 'bg-purple-50 text-purple-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  data-testid={`mobile-nav-${item.id}`}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {renderContent()}
      </div>

      {/* Mobile Bottom Navigation - Quick Actions */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-30">
        <div className="flex items-center justify-around py-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
            { id: 'new-post', icon: PenSquare, label: 'Create' },
            { id: 'review', icon: Clock, label: 'Review' },
            { id: 'posted', icon: Send, label: 'Posted' },
            { id: 'analytics', icon: BarChart3, label: 'Stats' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`flex flex-col items-center px-3 py-1 rounded-lg transition-colors ${
                activeView === item.id
                  ? 'text-purple-600'
                  : 'text-gray-500'
              }`}
              data-testid={`bottom-nav-${item.id}`}
            >
              <item.icon size={20} />
              <span className="text-xs mt-0.5">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom padding for mobile nav */}
      <div className="md:hidden h-16" />
    </div>
  );
};

export default ContentWorker;
