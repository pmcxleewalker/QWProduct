import React, { useState, useEffect } from 'react';
import { messageAPI } from '../api/api';
import { Bell, CheckCircle, AlertTriangle } from 'lucide-react';

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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-orange-500 text-white p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={24} />
            <div>
              <h2 className="text-lg font-bold">Important Notice</h2>
              <p className="text-sm opacity-80">
                {currentIndex + 1} of {messages.length} message{messages.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start space-x-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Bell className="text-orange-600" size={20} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">{currentMessage.title}</h3>
              <p className="text-sm text-gray-500">
                Posted on {formatDate(currentMessage.created_at)}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-gray-700 whitespace-pre-wrap">{currentMessage.content}</p>
          </div>

          <p className="text-sm text-gray-500 text-center mb-4">
            You must acknowledge this message to continue using the app.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
          >
            {acknowledging ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                <span>I Acknowledge & Accept</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageAcknowledgmentModal;
