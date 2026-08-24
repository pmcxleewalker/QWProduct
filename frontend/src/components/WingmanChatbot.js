import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, User, Bot, Loader2, Minimize2, CheckCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const WingmanChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [conversationStep, setConversationStep] = useState(0);
  const [leadInfo, setLeadInfo] = useState({ name: '', company: '', challenge: '', email: '' });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Structured conversation flow
  const CONVERSATION_STEPS = {
    0: {
      question: "Welcome! To help you best, what is your name, company, and the #1 challenge you're currently facing in managing your fleet?",
      placeholder: "e.g., John from ABC Fleet - struggling with compliance tracking"
    },
    1: {
      question: "Understood. And what's the best work email for me to send some fleet-specific solutions over to?",
      placeholder: "your.email@company.com"
    },
    2: {
      // Final thank you - no more input needed
      question: null
    }
  };

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: CONVERSATION_STEPS[0].question
        }
      ]);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && !leadCaptured) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized, leadCaptured]);

  // Parse first response to extract name, company, challenge
  const parseFirstResponse = (text) => {
    // Try to extract name, company, and challenge from the response
    const info = { name: '', company: '', challenge: '' };
    
    // Simple extraction - the whole response is valuable context
    const parts = text.split(/[-–—,]/);
    
    if (parts.length >= 2) {
      // Format: "Name from Company - challenge"
      const firstPart = parts[0].trim();
      const fromMatch = firstPart.match(/^(.+?)\s+from\s+(.+)$/i);
      
      if (fromMatch) {
        info.name = fromMatch[1].trim();
        info.company = fromMatch[2].trim();
      } else {
        info.name = firstPart;
      }
      
      info.challenge = parts.slice(1).join(' - ').trim();
    } else {
      // Just use the whole thing as context
      info.challenge = text;
    }
    
    // Fallback - use the full text as the challenge if nothing parsed
    if (!info.challenge) {
      info.challenge = text;
    }
    
    return info;
  };

  const captureLead = async (finalLeadInfo) => {
    setIsLoading(true);
    
    try {
      await fetch(`${API}/api/chatbot/capture-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalLeadInfo.name || 'Not provided',
          company: finalLeadInfo.company || 'Not provided',
          email: finalLeadInfo.email,
          phone: '',
          initial_message: `Challenge: ${finalLeadInfo.challenge}`,
          session_id: sessionId
        })
      });

      setLeadCaptured(true);
      
      // Store conversation in backend
      await fetch(`${API}/api/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[Lead Captured] Name: ${finalLeadInfo.name}, Company: ${finalLeadInfo.company}, Email: ${finalLeadInfo.email}, Challenge: ${finalLeadInfo.challenge}`,
          session_id: sessionId
        })
      });

    } catch (error) {
      console.error('Lead capture error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || isLoading || leadCaptured) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // Handle based on conversation step
    if (conversationStep === 0) {
      // Parse name, company, challenge from first response
      const parsed = parseFirstResponse(userMessage);
      const updatedInfo = { ...leadInfo, ...parsed };
      setLeadInfo(updatedInfo);
      
      // Move to step 1 - ask for email
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: CONVERSATION_STEPS[1].question 
        }]);
        setConversationStep(1);
        setIsLoading(false);
      }, 800);
      
    } else if (conversationStep === 1) {
      // Got the email - capture lead and send thank you
      const email = userMessage.trim();
      const finalInfo = { ...leadInfo, email };
      setLeadInfo(finalInfo);
      
      // Show thank you message
      setTimeout(async () => {
        const thankYouMessage = `Thank you${finalInfo.name ? `, ${finalInfo.name.split(' ')[0]}` : ''}!

I really appreciate you taking the time to share your fleet challenges with me. Your information has been sent to our team, and either myself or one of our team will be in contact with you to arrange a call within the next 24hrs.

In the meantime, feel free to explore our website to learn more about how Quick Wing helps fleet managers like yourself cut admin time by 70%.

Talk soon!
— Lee, Quick Wing`;

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: thankYouMessage
        }]);
        setConversationStep(2);
        setIsLoading(false);
        
        // Capture lead and trigger email
        await captureLead(finalInfo);
      }, 800);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getPlaceholder = () => {
    if (leadCaptured) return "Thanks for connecting!";
    return CONVERSATION_STEPS[conversationStep]?.placeholder || "Type your message...";
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
        aria-label="Open chat"
        data-testid="wingman-chat-button"
      >
        <MessageCircle size={28} />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 transition-all duration-300 ${
        isMinimized ? 'h-14' : 'h-[500px]'
      }`}
      data-testid="wingman-chat-window"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Bot size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Wingman</h3>
            <p className="text-xs text-blue-100">Quick Wing Assistant</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
          >
            <Minimize2 size={18} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close chat"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="h-[340px] overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`px-4 py-2.5 rounded-2xl ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-md' 
                      : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <Bot size={16} className="text-gray-600" />
                  </div>
                  <div className="bg-white px-4 py-2.5 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                    <Loader2 size={18} className="animate-spin text-blue-600" />
                  </div>
                </div>
              </div>
            )}

            {/* Lead captured success indicator */}
            {leadCaptured && (
              <div className="flex justify-center">
                <div className="bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm flex items-center space-x-2 border border-green-200">
                  <CheckCircle size={16} />
                  <span>Details sent to our team!</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100">
            <div className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type={conversationStep === 1 ? "email" : "text"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={getPlaceholder()}
                className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || leadCaptured}
                data-testid="wingman-input"
              />
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isLoading || leadCaptured}
                className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send message"
                data-testid="wingman-send"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              Powered by Quick Wing
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default WingmanChatbot;
