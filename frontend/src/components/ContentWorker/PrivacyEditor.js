import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Eye, EyeOff, Plus, Trash2, Move, CheckCircle, 
  AlertTriangle, RefreshCw, ZoomIn, ZoomOut
} from 'lucide-react';

const PrivacyEditor = ({ 
  imageUrl, 
  detectedZones = [], 
  onZonesChange,
  onMarkReviewed 
}) => {
  const [zones, setZones] = useState(detectedZones);
  const [showBlurred, setShowBlurred] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    setZones(detectedZones);
  }, [detectedZones]);

  const handleZoneUpdate = useCallback((updatedZones) => {
    setZones(updatedZones);
    onZonesChange?.(updatedZones);
  }, [onZonesChange]);

  const addManualZone = () => {
    const newZone = {
      id: `manual_${Date.now()}`,
      type: 'manual',
      text: 'Manual blur zone',
      x: 40,
      y: 40,
      width: 20,
      height: 10,
      manually_adjusted: true
    };
    handleZoneUpdate([...zones, newZone]);
    setSelectedZone(newZone.id);
  };

  const removeZone = (zoneId) => {
    handleZoneUpdate(zones.filter(z => z.id !== zoneId));
    if (selectedZone === zoneId) setSelectedZone(null);
  };

  const handleMouseDown = (e, zone, action) => {
    e.stopPropagation();
    setSelectedZone(zone.id);
    
    if (action === 'move') {
      setIsDragging(true);
    } else if (action === 'resize') {
      setIsResizing(true);
    }
    
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      initialX: zone.x,
      initialY: zone.y,
      initialW: zone.width,
      initialH: zone.height
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current || (!isDragging && !isResizing)) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;
    
    const updatedZones = zones.map(zone => {
      if (zone.id !== selectedZone) return zone;
      
      if (isDragging) {
        return {
          ...zone,
          x: Math.max(0, Math.min(100 - zone.width, dragStart.initialX + deltaX)),
          y: Math.max(0, Math.min(100 - zone.height, dragStart.initialY + deltaY)),
          manually_adjusted: true
        };
      } else if (isResizing) {
        return {
          ...zone,
          width: Math.max(5, Math.min(100 - zone.x, dragStart.initialW + deltaX)),
          height: Math.max(5, Math.min(100 - zone.y, dragStart.initialH + deltaY)),
          manually_adjusted: true
        };
      }
      return zone;
    });
    
    setZones(updatedZones);
  }, [isDragging, isResizing, selectedZone, dragStart, zones]);

  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      onZonesChange?.(zones);
    }
    setIsDragging(false);
    setIsResizing(false);
  }, [isDragging, isResizing, zones, onZonesChange]);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const getTypeColor = (type) => {
    const colors = {
      email: 'border-red-500 bg-red-500/20',
      phone: 'border-orange-500 bg-orange-500/20',
      registration: 'border-yellow-500 bg-yellow-500/20',
      name_pattern: 'border-purple-500 bg-purple-500/20',
      potential_name: 'border-purple-400 bg-purple-400/20',
      sensitive_keyword: 'border-blue-500 bg-blue-500/20',
      time_booking: 'border-pink-500 bg-pink-500/20',
      date: 'border-teal-500 bg-teal-500/20',
      manual: 'border-gray-500 bg-gray-500/20'
    };
    return colors[type] || colors.manual;
  };

  return (
    <div className="space-y-4" data-testid="privacy-editor">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowBlurred(!showBlurred)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              showBlurred 
                ? 'bg-pink-100 text-pink-700' 
                : 'bg-gray-100 text-gray-700'
            }`}
            data-testid="toggle-blur-btn"
          >
            {showBlurred ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>{showBlurred ? 'Showing Blurred' : 'Showing Original'}</span>
          </button>
          
          <button
            onClick={addManualZone}
            className="flex items-center space-x-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
            data-testid="add-blur-zone-btn"
          >
            <Plus size={16} />
            <span>Add Blur Zone</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500">
            {zones.length} zone{zones.length !== 1 ? 's' : ''} detected
          </span>
          {onMarkReviewed && (
            <button
              onClick={onMarkReviewed}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
              data-testid="mark-reviewed-btn"
            >
              <CheckCircle size={16} />
              <span>Mark as Privacy Reviewed</span>
            </button>
          )}
        </div>
      </div>

      {/* Image Preview with Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Original / Editable View */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            {showBlurred ? 'Blurred Preview (Editable)' : 'Original (Editable)'}
          </label>
          <div 
            ref={containerRef}
            className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square border-2 border-gray-200"
            style={{ cursor: isDragging ? 'grabbing' : 'default' }}
            onClick={() => setSelectedZone(null)}
          >
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-full object-contain"
              draggable={false}
            />
            
            {/* Blur Zones */}
            {zones.map((zone) => (
              <div
                key={zone.id}
                className={`absolute border-2 rounded cursor-move transition-all ${
                  selectedZone === zone.id 
                    ? 'border-pink-500 ring-2 ring-pink-300' 
                    : getTypeColor(zone.type)
                }`}
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                  backdropFilter: showBlurred ? 'blur(10px)' : 'none',
                  backgroundColor: showBlurred ? 'rgba(0,0,0,0.3)' : 'transparent'
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedZone(zone.id); }}
                onMouseDown={(e) => handleMouseDown(e, zone, 'move')}
                data-testid={`blur-zone-${zone.id}`}
              >
                {/* Drag Handle */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Move size={20} className="text-white drop-shadow-lg" />
                </div>
                
                {/* Resize Handle */}
                <div
                  className="absolute bottom-0 right-0 w-4 h-4 bg-white border border-gray-400 rounded-br cursor-se-resize"
                  onMouseDown={(e) => handleMouseDown(e, zone, 'resize')}
                />
                
                {/* Delete Button */}
                {selectedZone === zone.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }}
                    className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-md"
                    data-testid={`remove-zone-${zone.id}`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Detection Info Panel */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Detected Privacy Issues</label>
          <div className="bg-white rounded-lg border p-4 h-[calc(100%-28px)] overflow-y-auto">
            {zones.length > 0 ? (
              <div className="space-y-2">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZone(zone.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedZone === zone.id 
                        ? 'border-pink-500 bg-pink-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`zone-info-${zone.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle size={14} className={`${
                          zone.type === 'email' || zone.type === 'phone' 
                            ? 'text-red-500' 
                            : 'text-yellow-500'
                        }`} />
                        <span className="text-sm font-medium text-gray-900">
                          {zone.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {zone.text && (
                      <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                        "{zone.text}"
                      </p>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      Position: {Math.round(zone.x)}%, {Math.round(zone.y)}% | 
                      Size: {Math.round(zone.width)}% x {Math.round(zone.height)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <CheckCircle size={32} className="mb-2 text-green-500" />
                <p className="text-sm">No privacy issues detected</p>
                <p className="text-xs mt-1">You can add manual blur zones if needed</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { type: 'email', label: 'Email' },
          { type: 'phone', label: 'Phone' },
          { type: 'registration', label: 'Registration' },
          { type: 'potential_name', label: 'Name' },
          { type: 'time_booking', label: 'Time/Booking' },
          { type: 'sensitive_keyword', label: 'Sensitive' },
          { type: 'manual', label: 'Manual' }
        ].map(item => (
          <div key={item.type} className="flex items-center space-x-1">
            <div className={`w-3 h-3 rounded border-2 ${getTypeColor(item.type)}`} />
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrivacyEditor;
