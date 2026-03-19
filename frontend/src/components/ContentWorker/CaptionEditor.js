import React, { useState } from 'react';
import { Check, Edit2, Copy, MessageSquare, Sparkles, Target, Hash } from 'lucide-react';
import { toast } from 'sonner';

const CaptionEditor = ({ 
  captions = [], 
  selectedIndex = 0, 
  onSelectCaption,
  onUpdateCaption,
  readOnly = false
}) => {
  const [editingCaption, setEditingCaption] = useState(null);
  const [editValues, setEditValues] = useState({});

  const handleStartEdit = (index) => {
    if (readOnly) return;
    setEditingCaption(index);
    setEditValues({ ...captions[index] });
  };

  const handleSaveEdit = (index) => {
    onUpdateCaption?.(index, editValues);
    setEditingCaption(null);
    setEditValues({});
    toast.success('Caption updated');
  };

  const handleCancelEdit = () => {
    setEditingCaption(null);
    setEditValues({});
  };

  const copyCaption = (caption) => {
    const text = `${caption.hook}\n\n${caption.body}\n\n${caption.cta}\n\n${caption.hashtags}`;
    navigator.clipboard.writeText(text);
    toast.success('Caption copied to clipboard');
  };

  if (!captions.length) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border text-gray-500">
        <MessageSquare className="mr-2" size={20} />
        <span>No captions generated yet</span>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="caption-editor">
      <label className="text-sm font-medium text-gray-700">
        Caption Options (Select one)
      </label>
      
      <div className="space-y-3">
        {captions.map((caption, index) => (
          <div
            key={index}
            className={`relative rounded-xl border-2 transition-all ${
              selectedIndex === index
                ? 'border-pink-500 bg-pink-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            data-testid={`caption-option-${index}`}
          >
            {/* Selection Header */}
            <div 
              onClick={() => !readOnly && onSelectCaption?.(index)}
              className="flex items-center justify-between p-4 cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedIndex === index 
                    ? 'bg-pink-500 border-pink-500' 
                    : 'border-gray-300'
                }`}>
                  {selectedIndex === index && <Check size={14} className="text-white" />}
                </div>
                <span className="font-medium text-gray-900">Option {index + 1}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => { e.stopPropagation(); copyCaption(caption); }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Copy caption"
                >
                  <Copy size={16} />
                </button>
                {!readOnly && editingCaption !== index && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStartEdit(index); }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit caption"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Caption Content */}
            <div className="px-4 pb-4 space-y-3">
              {editingCaption === index ? (
                // Edit Mode
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center space-x-1 text-xs font-medium text-gray-500 mb-1">
                      <Sparkles size={12} />
                      <span>Hook</span>
                    </label>
                    <input
                      type="text"
                      value={editValues.hook || ''}
                      onChange={(e) => setEditValues({ ...editValues, hook: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-1 text-xs font-medium text-gray-500 mb-1">
                      <MessageSquare size={12} />
                      <span>Body</span>
                    </label>
                    <textarea
                      value={editValues.body || ''}
                      onChange={(e) => setEditValues({ ...editValues, body: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-1 text-xs font-medium text-gray-500 mb-1">
                      <Target size={12} />
                      <span>CTA</span>
                    </label>
                    <input
                      type="text"
                      value={editValues.cta || ''}
                      onChange={(e) => setEditValues({ ...editValues, cta: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-1 text-xs font-medium text-gray-500 mb-1">
                      <Hash size={12} />
                      <span>Hashtags</span>
                    </label>
                    <input
                      type="text"
                      value={editValues.hashtags || ''}
                      onChange={(e) => setEditValues({ ...editValues, hashtags: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(index)}
                      className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                // Display Mode
                <div className="space-y-2">
                  {caption.hook && (
                    <div>
                      <span className="text-xs font-medium text-pink-600 uppercase tracking-wide">Hook</span>
                      <p className="text-sm text-gray-900 font-medium">{caption.hook}</p>
                    </div>
                  )}
                  
                  {caption.body && (
                    <div>
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Body</span>
                      <p className="text-sm text-gray-700">{caption.body}</p>
                    </div>
                  )}
                  
                  {caption.cta && (
                    <div>
                      <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">CTA</span>
                      <p className="text-sm text-gray-800">{caption.cta}</p>
                    </div>
                  )}
                  
                  {caption.hashtags && (
                    <p className="text-xs text-pink-600 font-medium">{caption.hashtags}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CaptionEditor;
