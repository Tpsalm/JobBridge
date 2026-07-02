import { useState, useRef, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { Send, Search, MoreVertical, Lock, Check, CheckCheck, CircleDot } from 'lucide-react';
import CompanyLogo from '../components/CompanyLogo';
import { IMG } from '../lib/media';

interface Conversation {
  id: string;
  company: string;
  logo_initial: string;
  color: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  locked?: boolean;
  online?: boolean;
}

interface MessageItem {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
  read?: boolean;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: '1', company: 'Flutterwave', logo_initial: 'F', color: 'bg-orange-500', lastMessage: 'Thank you for your application. We would like to schedule an interview...', timestamp: '18 Jun 2025', unread: 2, online: true },
  { id: '2', company: 'Andela', logo_initial: 'A', color: 'bg-blue-600', lastMessage: 'Your application for Senior Developer has been received.', timestamp: '10 Jun 2025', unread: 0 },
  { id: '3', company: 'Paystack', logo_initial: 'P', color: 'bg-green-600', lastMessage: 'We have reviewed your portfolio and are impressed with your work.', timestamp: '2 Jun 2025', unread: 1, online: true },
  { id: '4', company: 'Kuda Bank', logo_initial: 'K', color: 'bg-purple-600', lastMessage: 'This conversation is no longer active.', timestamp: '15 May 2025', unread: 0, locked: true },
  { id: '5', company: 'MTN Nigeria', logo_initial: 'M', color: 'bg-yellow-500', lastMessage: 'Thank you for your interest in the Product Manager role.', timestamp: '28 Apr 2025', unread: 0 },
  { id: '6', company: 'Jumia', logo_initial: 'J', color: 'bg-orange-600', lastMessage: 'This conversation is no longer active.', timestamp: '12 Apr 2025', unread: 0, locked: true },
  { id: '7', company: 'OPay', logo_initial: 'O', color: 'bg-emerald-600', lastMessage: 'Welcome to OPay! We are excited to connect with you.', timestamp: '1 Jan 2025', unread: 0 },
];

const MOCK_MESSAGES: Record<string, MessageItem[]> = {
  '1': [
    { id: 'm1', sender: 'them', text: 'Hi there! Thank you for applying to Flutterwave. We have reviewed your application.', time: '10:00 AM' },
    { id: 'm2', sender: 'them', text: 'We would like to schedule a technical interview with you. Are you available this week?', time: '10:02 AM' },
    { id: 'm3', sender: 'me', text: 'Hello! Thank you for reaching out. Yes, I am available Thursday or Friday afternoon.', time: '10:30 AM', read: true },
    { id: 'm4', sender: 'them', text: 'Great! Let\'s schedule it for Thursday at 2:00 PM WAT. You will receive a calendar invite shortly.', time: '11:15 AM' },
    { id: 'm5', sender: 'me', text: 'Perfect, that works for me. Looking forward to it!', time: '11:20 AM', read: true },
  ],
  '2': [
    { id: 'm1', sender: 'them', text: 'Dear Applicant, we have received your application for the Senior Developer position at Andela.', time: '9:00 AM' },
    { id: 'm2', sender: 'them', text: 'Our team will review it and get back to you within 5 business days.', time: '9:01 AM' },
  ],
  '3': [
    { id: 'm1', sender: 'them', text: 'Hi! We reviewed your portfolio and are impressed with your work.', time: '2:00 PM' },
    { id: 'm2', sender: 'them', text: 'Could you share more about your experience with React and TypeScript?', time: '2:05 PM' },
    { id: 'm3', sender: 'me', text: 'Thank you! I have 4 years of experience building production React apps with TypeScript, including a fintech dashboard at my current role.', time: '3:00 PM', read: false },
  ],
};

export default function Messages() {
  const { isAuthenticated, profile } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Record<string, MessageItem[]>>(MOCK_MESSAGES);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = MOCK_CONVERSATIONS.find(c => c.id === selectedId);
  const currentMessages = selectedId ? (messages[selectedId] || []) : [];

  const filtered = MOCK_CONVERSATIONS.filter(c =>
    c.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, selectedId]);

  const handleSend = () => {
    if (!newMessage.trim() || !selectedId) return;
    const msg: MessageItem = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: newMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setMessages(prev => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), msg],
    }));
    setNewMessage('');
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100dvh-64px)]">
        {/* Conversation List */}
        <div className={`w-full sm:w-80 lg:w-96 border-r border-gray-100 flex flex-col bg-white ${selectedId ? 'hidden sm:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">Messages</h2>
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CircleDot className="w-3 h-3" /> Online
                </span>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Conversation Items */}
          <div className="flex-1 overflow-y-auto">
            {!isAuthenticated ? (
              <div className="p-6 text-center">
                <img src={IMG.empty.noMessages} alt="" className="w-full max-w-[200px] mx-auto rounded-lg mb-4 opacity-80" />
                <p className="text-sm text-gray-500 mb-3">Sign in to see your messages</p>
                <a href="/login" className="text-blue-600 text-sm font-medium hover:underline">Sign in</a>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <img src={IMG.empty.noMessages} alt="" className="w-full max-w-[200px] mx-auto rounded-lg mb-3 opacity-80" />
                <p className="text-sm text-gray-400">No conversations found</p>
              </div>
            ) : (
              filtered.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-gray-50 text-left transition-colors ${
                    selectedId === conv.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <CompanyLogo company={conv.company} className="w-11 h-11 rounded-full" fallbackClassName={conv.color} />
                    {conv.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${conv.unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {conv.company}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{conv.timestamp.split(' ')[0]}</span>
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${conv.unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                      {conv.locked && <Lock className="w-3 h-3 inline mr-1 text-gray-400" />}
                      {conv.lastMessage}
                    </p>
                  </div>

                  {/* Unread badge */}
                  {conv.unread > 0 && (
                    <span className="shrink-0 mt-1 w-5 h-5 bg-blue-600 text-white text-xs font-semibold rounded-full flex items-center justify-center">
                      {conv.unread}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message Panel */}
        <div className={`flex-1 flex flex-col bg-gray-50 ${selectedId ? 'flex' : 'hidden sm:flex'}`}>
          {!selectedId ? (
            /* Welcome state */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-32 h-32 mb-6 relative">
                <div className="w-20 h-20 bg-blue-100 rounded-full absolute top-4 left-6 flex items-center justify-center">
                  <Send className="w-8 h-8 text-blue-500" />
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-full absolute top-0 right-4 flex items-center justify-center">
                  <span className="text-purple-500 text-sm">💬</span>
                </div>
                <div className="w-8 h-8 bg-orange-100 rounded-full absolute bottom-4 right-8 flex items-center justify-center">
                  <span className="text-orange-500 text-xs">✨</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Welcome to Messages</h3>
              <p className="text-gray-500 text-sm max-w-xs">Select a conversation to view and respond to employers who have reached out to you.</p>
            </div>
          ) : (
            <>
              {/* Conversation Header */}
              <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="sm:hidden text-gray-500 hover:text-gray-700 mr-1"
                  >
                    ←
                  </button>
                  {selectedConversation && (
                    <CompanyLogo
                      company={selectedConversation.company}
                      className="w-9 h-9 rounded-full"
                      fallbackClassName={selectedConversation.color}
                    />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{selectedConversation?.company}</p>
                    <p className="text-xs text-gray-500">
                      {selectedConversation?.locked ? 'Conversation ended' : selectedConversation?.online ? 'Online' : 'Last seen recently'}
                    </p>
                  </div>
                </div>
                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {selectedConversation?.locked && (
                  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-700">
                    <Lock className="w-4 h-4" />
                    This conversation is no longer active.
                  </div>
                )}
                {currentMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs sm:max-w-sm rounded-2xl px-4 py-2.5 text-sm ${
                      msg.sender === 'me'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm'
                    }`}>
                      <p>{msg.text}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                        msg.sender === 'me' ? 'text-blue-200' : 'text-gray-400'
                      }`}>
                        {msg.time}
                        {msg.sender === 'me' && (
                          msg.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {!selectedConversation?.locked && (
                <div className="bg-white border-t border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!newMessage.trim()}
                      className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
