import React from 'react';
import { Check, Video, RefreshCw } from 'lucide-react';

const FrameSelector = ({ 
  frames = [], 
  selectedFrame, 
  onSelectFrame, 
  loading = false 
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border" data-testid="frame-selector-loading">
        <RefreshCw className="animate-spin text-pink-500 mr-2" size={20} />
        <span className="text-gray-600">Extracting frames from video...</span>
      </div>
    );
  }

  if (!frames.length) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border text-gray-500">
        <Video className="mr-2" size={20} />
        <span>No frames extracted yet</span>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="frame-selector">
      <label className="text-sm font-medium text-gray-700">
        Select Best Frame ({frames.length} extracted)
      </label>
      <div className="grid grid-cols-3 gap-3">
        {frames.map((frame) => (
          <button
            key={frame.id}
            onClick={() => onSelectFrame(frame)}
            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all group ${
              selectedFrame?.id === frame.id
                ? 'border-pink-500 ring-2 ring-pink-200'
                : 'border-gray-200 hover:border-gray-400'
            }`}
            data-testid={`frame-option-${frame.id}`}
          >
            <img
              src={frame.url}
              alt={`Frame ${frame.frame_number}`}
              className="w-full h-full object-cover"
            />
            
            {/* Frame Number Badge */}
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
              Frame {frame.frame_number}
            </div>
            
            {/* Selection Indicator */}
            {selectedFrame?.id === frame.id && (
              <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center">
                  <Check className="text-white" size={24} />
                </div>
              </div>
            )}
            
            {/* Hover Effect */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>
        ))}
      </div>
      
      {selectedFrame && (
        <p className="text-sm text-green-600 flex items-center space-x-1">
          <Check size={14} />
          <span>Frame {selectedFrame.frame_number} selected</span>
        </p>
      )}
    </div>
  );
};

export default FrameSelector;
