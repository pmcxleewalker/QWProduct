import React, { useState } from 'react';
import { 
  BookOpen, ChevronDown, ChevronRight, Upload, Image, Shield, 
  Eye, MessageSquare, Save, CheckCircle, Clock, Send, BarChart3,
  Lightbulb, Settings, Instagram, AlertTriangle, Play, Calendar,
  HelpCircle, Zap, Target, Users, FileText
} from 'lucide-react';

const TrainingGuide = ({ onNavigate }) => {
  const [expandedSections, setExpandedSections] = useState(['getting-started']);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Zap,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            The <strong>Quick Wing Content Worker</strong> is your complete Instagram content management system. 
            It helps you create, review, schedule, and publish professional content while protecting sensitive information.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Key Features</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Privacy-first workflow with automatic sensitive data detection</li>
              <li>• AI-powered caption generation</li>
              <li>• Brand-consistent preview generation</li>
              <li>• Approval workflow for quality control</li>
              <li>• Analytics to track performance</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Dashboard', icon: BarChart3, tab: 'dashboard' },
              { label: 'Assets', icon: Image, tab: 'assets' },
              { label: 'New Post', icon: FileText, tab: 'new-post' },
              { label: 'Review', icon: Clock, tab: 'review' },
              { label: 'Posted', icon: Send, tab: 'posted' },
              { label: 'Analytics', icon: BarChart3, tab: 'analytics' },
              { label: 'Ideas', icon: Lightbulb, tab: 'ideas' },
              { label: 'Settings', icon: Settings, tab: 'settings' },
            ].map(item => (
              <button
                key={item.tab}
                onClick={() => onNavigate(item.tab)}
                className="flex items-center space-x-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
              >
                <item.icon size={18} className="text-purple-600" />
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'create-post',
      title: 'Creating a New Post (6-Step Workflow)',
      icon: FileText,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Follow these 6 steps to create professional, privacy-compliant Instagram content:
          </p>

          <div className="space-y-3">
            {[
              { 
                step: 1, 
                title: 'Upload Media', 
                icon: Upload,
                desc: 'Select an existing asset from your library or upload a new image/video. Supported: PNG, JPG, WEBP, GIF, MP4, MOV, WEBM (max 100MB).'
              },
              { 
                step: 2, 
                title: 'Select Frame (Videos)', 
                icon: Image,
                desc: 'For videos, choose one of 3 automatically extracted key frames to use as your cover image. Skip this for images.'
              },
              { 
                step: 3, 
                title: 'Privacy Review', 
                icon: Shield,
                desc: 'Review automatically detected sensitive info (emails, phones, names, registration numbers). Add manual blur zones if needed. Always mark as "Privacy Reviewed" before continuing.'
              },
              { 
                step: 4, 
                title: 'Generate Preview', 
                icon: Eye,
                desc: 'Create branded Instagram-ready images in Square (1080x1080) and Portrait (1080x1350) formats with Quick Wing branding.'
              },
              { 
                step: 5, 
                title: 'Generate Captions', 
                icon: MessageSquare,
                desc: 'Select a content focus (e.g., Booking Simplicity, Time Saving) and get 3 AI-generated caption options with hooks, CTAs, and hashtags.'
              },
              { 
                step: 6, 
                title: 'Save Draft', 
                icon: Save,
                desc: 'Add internal notes and either Save as Draft for later editing or Submit for Review to send for approval.'
              },
            ].map(item => (
              <div key={item.step} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-purple-600">{item.step}</span>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <item.icon size={16} className="text-purple-600" />
                    <h4 className="font-medium text-gray-900">{item.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigate('new-post')}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-colors"
          >
            Start Creating a Post
          </button>
        </div>
      )
    },
    {
      id: 'review-approval',
      title: 'Review & Approval Process',
      icon: CheckCircle,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            All content goes through an approval workflow to ensure quality and compliance.
          </p>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Content Status Flow</h4>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-3 py-1 bg-gray-200 rounded-full">Draft</span>
              <ChevronRight size={16} className="text-gray-400" />
              <span className="px-3 py-1 bg-yellow-200 rounded-full">In Review</span>
              <ChevronRight size={16} className="text-gray-400" />
              <span className="px-3 py-1 bg-green-200 rounded-full">Approved</span>
              <ChevronRight size={16} className="text-gray-400" />
              <span className="px-3 py-1 bg-blue-200 rounded-full">Scheduled</span>
              <ChevronRight size={16} className="text-gray-400" />
              <span className="px-3 py-1 bg-purple-200 rounded-full">Posted</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Rejected content returns to Draft status for revision.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Review Actions</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <h5 className="font-medium text-green-800">Approve</h5>
                <p className="text-sm text-green-700">Content is ready to publish</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <h5 className="font-medium text-red-800">Reject</h5>
                <p className="text-sm text-red-700">Doesn't meet standards (add notes)</p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <h5 className="font-medium text-gray-800">Send Back</h5>
                <p className="text-sm text-gray-700">Minor changes needed</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('review')}
            className="w-full py-2 border border-purple-500 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
          >
            Go to Review Queue
          </button>
        </div>
      )
    },
    {
      id: 'publishing',
      title: 'Scheduling & Publishing',
      icon: Send,
      content: (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="font-medium text-orange-900">Instagram Connection Required</h4>
                <p className="text-sm text-orange-800">
                  You must connect your Instagram account in Settings before publishing.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Publishing Options</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="text-blue-600" size={20} />
                  <h5 className="font-medium">Schedule for Later</h5>
                </div>
                <p className="text-sm text-gray-600">
                  Set a specific date and time. The post will be automatically published at the scheduled time.
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Play className="text-purple-600" size={20} />
                  <h5 className="font-medium">Publish Now</h5>
                </div>
                <p className="text-sm text-gray-600">
                  Immediately publish the approved content to your connected Instagram account.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Content Calendar Tabs</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="p-2 bg-purple-50 rounded text-center">
                <span className="font-medium text-purple-700">Posted</span>
                <p className="text-xs text-purple-600">Published content</p>
              </div>
              <div className="p-2 bg-blue-50 rounded text-center">
                <span className="font-medium text-blue-700">Scheduled</span>
                <p className="text-xs text-blue-600">Awaiting publish time</p>
              </div>
              <div className="p-2 bg-green-50 rounded text-center">
                <span className="font-medium text-green-700">Ready to Post</span>
                <p className="text-xs text-green-600">Approved content</p>
              </div>
              <div className="p-2 bg-red-50 rounded text-center">
                <span className="font-medium text-red-700">Failed</span>
                <p className="text-xs text-red-600">Publishing errors</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('posted')}
            className="w-full py-2 border border-purple-500 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
          >
            Go to Content Calendar
          </button>
        </div>
      )
    },
    {
      id: 'analytics',
      title: 'Understanding Analytics',
      icon: BarChart3,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Track your content performance to understand what resonates with your audience.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Likes', desc: 'Total hearts received' },
              { label: 'Comments', desc: 'Total comments' },
              { label: 'Reach', desc: 'Unique accounts' },
              { label: 'Saves', desc: 'Times saved' },
              { label: 'Engagement', desc: 'Interaction rate' },
            ].map(metric => (
              <div key={metric.label} className="p-3 bg-gray-50 rounded-lg text-center">
                <h5 className="font-medium text-gray-900">{metric.label}</h5>
                <p className="text-xs text-gray-500">{metric.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Sync Your Metrics</h4>
            <p className="text-sm text-blue-800">
              Click the <strong>"Sync Metrics"</strong> button to pull the latest performance data from Instagram.
              Do this regularly to keep your analytics up-to-date.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Analytics Sections</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <strong>Overview Cards</strong> - Total metrics at a glance</li>
              <li>• <strong>Top Posts</strong> - Your best performing content</li>
              <li>• <strong>Recent Posts</strong> - Latest published content</li>
              <li>• <strong>By Category</strong> - Which content types work best</li>
              <li>• <strong>By Format</strong> - Reels vs Carousels vs Images</li>
            </ul>
          </div>

          <button
            onClick={() => onNavigate('analytics')}
            className="w-full py-2 border border-purple-500 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
          >
            View Analytics
          </button>
        </div>
      )
    },
    {
      id: 'content-ideas',
      title: 'Using the Content Ideas Engine',
      icon: Lightbulb,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Get AI-powered content suggestions tailored for Quick Wing franchises.
          </p>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Content Goals</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
              {['Reach', 'Engagement', 'Leads', 'Education', 'Awareness'].map(goal => (
                <div key={goal} className="p-2 bg-purple-50 rounded text-center">
                  <span className="font-medium text-purple-700">{goal}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              Select a goal to filter ideas based on what you want to achieve.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Quick Tip</h4>
            <p className="text-sm text-green-800">
              Click <strong>"Create Draft"</strong> on any idea to automatically start a new post 
              with the title, hook, and caption pre-filled. This saves time and ensures consistency!
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Top Performing Content Types</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <h5 className="font-medium">By Category</h5>
                <ol className="text-gray-600 mt-1 space-y-0.5">
                  <li>1. Trust/Proof</li>
                  <li>2. Pain Point</li>
                  <li>3. Before/After</li>
                </ol>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <h5 className="font-medium">By Format</h5>
                <ol className="text-gray-600 mt-1 space-y-0.5">
                  <li>1. Reels</li>
                  <li>2. Carousels</li>
                  <li>3. Single Images</li>
                </ol>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('ideas')}
            className="w-full py-2 border border-purple-500 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
          >
            Browse Content Ideas
          </button>
        </div>
      )
    },
    {
      id: 'instagram-setup',
      title: 'Instagram Connection Setup',
      icon: Instagram,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Connect your Instagram Business account to enable publishing directly from Content Worker.
          </p>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Connection Steps</h4>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start space-x-2">
                <span className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-purple-600 font-medium text-xs">1</span>
                <span>Go to the <strong>Settings</strong> tab</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-purple-600 font-medium text-xs">2</span>
                <span>Click <strong>"Connect Account"</strong> in the Instagram Connection section</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-purple-600 font-medium text-xs">3</span>
                <span>Enter your Instagram account name and access token from Meta Developer Portal</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-purple-600 font-medium text-xs">4</span>
                <span>Click <strong>"Connect"</strong> to complete setup</span>
              </li>
            </ol>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-2">Token Expiry</h4>
            <p className="text-sm text-yellow-800">
              Instagram access tokens expire periodically. You'll see a warning when your token is about 
              to expire. Click <strong>"Refresh Token"</strong> to re-authenticate and keep publishing enabled.
            </p>
          </div>

          <button
            onClick={() => onNavigate('settings')}
            className="w-full py-2 border border-purple-500 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
          >
            Go to Settings
          </button>
        </div>
      )
    },
    {
      id: 'best-practices',
      title: 'Best Practices & Tips',
      icon: Target,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Content Creation</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Use high-quality images (min 1080x1080)</li>
                <li>• Keep videos under 60 seconds for Reels</li>
                <li>• Always complete the privacy review</li>
                <li>• Choose captions that match your brand voice</li>
              </ul>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Publishing Schedule</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Schedule posts for optimal times</li>
                <li>• Maintain consistent posting frequency</li>
                <li>• Use the Content Calendar to plan ahead</li>
                <li>• Monitor analytics to find best times</li>
              </ul>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Team Workflow</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Use internal notes for context</li>
                <li>• Provide clear feedback when rejecting</li>
                <li>• Check Review Queue regularly</li>
                <li>• Approve content promptly</li>
              </ul>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Performance</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Sync metrics regularly</li>
                <li>• Study your top-performing posts</li>
                <li>• Double down on what works</li>
                <li>• Test different content formats</li>
              </ul>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2">Pre-Publish Checklist</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-purple-800">
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded text-purple-600" />
                <span>Privacy zones reviewed</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded text-purple-600" />
                <span>Caption selected</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded text-purple-600" />
                <span>Preview looks professional</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded text-purple-600" />
                <span>Instagram connected</span>
              </label>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6" data-testid="training-guide">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <BookOpen className="text-purple-600" size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Training Guide</h2>
            <p className="text-gray-600 mt-1">
              Learn how to use the Content Worker to create and publish professional Instagram content.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('new-post')}
          className="flex items-center justify-center space-x-2 p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors"
        >
          <FileText size={18} />
          <span className="font-medium">Create Post</span>
        </button>
        <button
          onClick={() => onNavigate('review')}
          className="flex items-center justify-center space-x-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Clock size={18} className="text-yellow-600" />
          <span className="font-medium">Review Queue</span>
        </button>
        <button
          onClick={() => onNavigate('analytics')}
          className="flex items-center justify-center space-x-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <BarChart3 size={18} className="text-blue-600" />
          <span className="font-medium">Analytics</span>
        </button>
        <button
          onClick={() => onNavigate('ideas')}
          className="flex items-center justify-center space-x-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Lightbulb size={18} className="text-amber-500" />
          <span className="font-medium">Get Ideas</span>
        </button>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.id} className="bg-white rounded-xl border overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <section.icon className="text-purple-600" size={20} />
                </div>
                <h3 className="font-semibold text-gray-900">{section.title}</h3>
              </div>
              {expandedSections.includes(section.id) ? (
                <ChevronDown className="text-gray-400" size={20} />
              ) : (
                <ChevronRight className="text-gray-400" size={20} />
              )}
            </button>
            {expandedSections.includes(section.id) && (
              <div className="px-4 pb-4 border-t bg-gray-50">
                <div className="pt-4">
                  {section.content}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Help Footer */}
      <div className="bg-gray-100 rounded-xl p-4 text-center">
        <div className="flex items-center justify-center space-x-2 text-gray-600">
          <HelpCircle size={18} />
          <span>Need more help? Contact your Quick Wing administrator.</span>
        </div>
      </div>
    </div>
  );
};

export default TrainingGuide;
