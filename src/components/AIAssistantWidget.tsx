import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, ChevronUp, Sparkles, FileText, MessageCircle, TrendingUp } from 'lucide-react';
import { answerWithRAG, hasApiKey } from '../lib/ragEngine';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const suggestedPrompts = [
  'What is JobBridge?',
  'How to find a job?',
  'AI Resume Builder',
  'Recruiter plans',
  'How to apply?',
  'Contact support',
];

export default function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "👋 Hello! I'm your JobBridge AI assistant. I can help you find jobs, build your resume, explain our plans, and more. What would you like to know?\n\n🌐 Visit us: **https://jobbridge.com**",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addBotMessage = (text: string) => {
    setMessages((prev) => [...prev, {
      id: prev.length + 1,
      text,
      sender: 'bot',
      timestamp: new Date(),
    }]);
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    setMessages((prev) => [...prev, {
      id: prev.length + 1,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    }]);
    setInput('');
    setLoading(true);

    try {
      if (hasApiKey()) {
        const result = await answerWithRAG(messageText);
        addBotMessage(result.answer);
      } else {
        addBotMessage("The AI assistant is not fully configured. Set VITE_OPENAI_API_KEY in your environment to enable intelligent answers. For now, try the Support page at /support or email jobbridgesupport@gmail.com.");
      }
    } catch (err) {
      addBotMessage("Sorry, I encountered an error. Please try again or contact jobbridgesupport@gmail.com for help.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        onClick={() => setShowIntro(true)}
        className={`fixed bottom-20 right-4 md:bottom-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <div className="relative">
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
        </div>
      </button>

      {showIntro && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowIntro(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-on-surface mb-3">Say hello to your AI Career Assistant!</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">We've just launched an innovative tool to help you boost your career chances, whether you're just starting out or aiming for your next leadership role.</p>
            <p className="text-sm text-gray-700 font-semibold mb-2">Now you can easily:</p>
            <ul className="list-disc list-inside text-sm text-gray-700 mb-4 space-y-1">
              <li>Build a standout CV from scratch or improve your current one</li>
              <li>Generate job-specific cover letters in minutes</li>
              <li>Practice mock interviews tailored to your role or industry</li>
              <li>Negotiate job offers confidently with AI-generated counteroffers</li>
            </ul>
            <p className="text-sm text-gray-700 mb-4">And the best part? It's affordable.</p>
            <p className="text-sm text-gray-700 mb-4">Run out of time? Don't worry, our packages are still available and very affordable for you.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowIntro(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowIntro(false);
                  setIsOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800"
              >
                Try it now
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`fixed z-50 transition-all duration-300 ${
          isOpen
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{
          bottom: '80px',
          right: '16px',
          width: 'calc(100vw - 32px)',
          maxWidth: '380px',
          maxHeight: 'calc(100vh - 120px)',
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">JobBridge AI</h3>
                <p className="text-xs text-blue-100">Your career assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><ChevronUp className="w-4 h-4 text-white" /></button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-white" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[350px] bg-gray-50">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  message.sender === 'user'
                    ? 'bg-blue-700 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                }`}>
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3 py-2 rounded-xl text-sm bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-2 bg-white border-t border-gray-100">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="shrink-0 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 bg-white border-t border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                disabled={loading}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
              />
              <button type="submit" disabled={!input.trim() || loading} className="p-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="px-3 pb-3 bg-white">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { icon: FileText, label: 'Resume' },
                { icon: MessageCircle, label: 'Interview' },
                { icon: TrendingUp, label: 'Salary' },
                { icon: Sparkles, label: 'Plans' },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => handleSend(`Tell me about ${label.toLowerCase()}`)}
                  disabled={loading}
                  className="flex flex-col items-center gap-1 p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Icon className="w-4 h-4 text-blue-700" />
                  <span className="text-[10px] text-gray-600">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
