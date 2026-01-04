import React, { useState, useEffect } from 'react';
import { messageAPI } from '../api/api';
import { Bell, CheckCircle, AlertTriangle, X } from 'lucide-react';

const MessageAcknowledgmentModal = ({ onComplete }) => {
  const [messages, setMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    fetchUnacknowledgedMessages();
  }, []);

  const fetchUnacknowledgedMessages = async () => {
    try {
      const response = await messageAPI.getUnacknowledged();
      setMessages(response.data);
      if (response.data.length === 0) {
        onComplete();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      onComplete(); // Continue even if there's an error
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (acknowledging) return;
    
    setAcknowledging(true);
    try {
      await messageAPI.acknowledge(messages[currentIndex].id);
      
      if (currentIndex < messages.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onComplete();
      }
    } catch (error) {
      console.error('Error acknowledging message:', error);
    } finally {
      setAcknowledging(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return null;
  }

  const currentMessage = messages[currentIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-4">
      {/* Block everything underneath */}
      <div className="absolute inset-0 backdrop-blur-sm"></div>
      
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 text-white p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={28} />
            <div>
              <h2 className="text-xl font-bold">⚠️ Important Notice - Please Read</h2>
              <p className="text-sm opacity-90">
                Message {currentIndex + 1} of {messages.length} - You must acknowledge to continue
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start space-x-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <Bell className="text-red-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">{currentMessage.title}</h3>
              <p className="text-sm text-gray-500">
                Posted on {formatDate(currentMessage.created_at)}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 max-h-64 overflow-y-auto">
            <p className="text-gray-700 whitespace-pre-wrap text-base leading-relaxed">{currentMessage.content}</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800 font-medium text-center">
              🔒 You must acknowledge this message to access the app
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 p-4">
          <button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-4 px-4 rounded-lg hover:bg-green-700 transition-colors font-bold text-lg disabled:opacity-50"
          >
            {acknowledging ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle size={24} />
                <span>I Have Read & Acknowledge This Message</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageAcknowledgmentModal;
