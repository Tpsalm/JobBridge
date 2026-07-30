import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { fetchConversations, fetchConversationById, fetchConversationMessages, createConversationMessage } from '../lib/supabaseQueries';
import { supabase } from '../lib/supabase';
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
  recipientId: string;
  recipientName: string;
  recipientEmail?: string;
}

interface MessageItem {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
  read?: boolean;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: '1', company: 'Flutterwave', logo_initial: 'F', color: 'bg-orange-500', lastMessage: 'Thank you for your application. We would like to schedule an interview...', timestamp: '18 Jun 2025', unread: 2, online: true, recipientId: '', recipientName: 'Flutterwave' },
  { id: '2', company: 'Andela', logo_initial: 'A', color: 'bg-blue-600', lastMessage: 'Your application for Senior Developer has been received.', timestamp: '10 Jun 2025', unread: 0, recipientId: '', recipientName: 'Andela' },
  { id: '3', company: 'Paystack', logo_initial: 'P', color: 'bg-green-600', lastMessage: 'We have reviewed your portfolio and are impressed with your work.', timestamp: '2 Jun 2025', unread: 1, online: true, recipientId: '', recipientName: 'Paystack' },
  { id: '4', company: 'Kuda Bank', logo_initial: 'K', color: 'bg-purple-600', lastMessage: 'This conversation is no longer active.', timestamp: '15 May 2025', unread: 0, locked: true, recipientId: '', recipientName: 'Kuda Bank' },
  { id: '5', company: 'MTN Nigeria', logo_initial: 'M', color: 'bg-yellow-500', lastMessage: 'Thank you for your interest in the Product Manager role.', timestamp: '28 Apr 2025', unread: 0, recipientId: '', recipientName: 'MTN Nigeria' },
  { id: '6', company: 'Jumia', logo_initial: 'J', color: 'bg-orange-600', lastMessage: 'This conversation is no longer active.', timestamp: '12 Apr 2025', unread: 0, locked: true, recipientId: '', recipientName: 'Jumia' },
  { id: '7', company: 'OPay', logo_initial: 'O', color: 'bg-emerald-600', lastMessage: 'Welcome to OPay! We are excited to connect with you.', timestamp: '1 Jan 2025', unread: 0, recipientId: '', recipientName: 'OPay' },
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
  const { isAuthenticated, profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const queryConversationId = searchParams.get('conversationId');
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(queryConversationId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [pendingApplied, setPendingApplied] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{ tempId: string; text: string } | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, MessageItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversation threads and messages
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadConversations = async () => {
      try {
        const convs = await fetchConversations(user.id);
        const convItems: Conversation[] = [];
        const msgMap = new Map<string, MessageItem[]>();

        for (const conv of convs) {
          const otherParticipant = conv.participant1_id === user.id ? conv.participant2 : conv.participant1;
          const convId = conv.id;
          const name = otherParticipant?.full_name || 'Conversation';
          const otherId = otherParticipant?.id || '';

          convItems.push({
            id: convId,
            company: name,
            logo_initial: (name.charAt(0) || 'U'),
            color: 'bg-blue-600',
            lastMessage: conv.last_message || 'New conversation',
            timestamp: conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : new Date(conv.created_at).toLocaleDateString(),
            unread: 0,
            recipientId: otherId,
            recipientName: name,
            recipientEmail: otherParticipant?.email || undefined,
          });

          const msgs = await fetchConversationMessages(convId);
          msgMap.set(convId, msgs.map(msg => ({
            id: msg.id,
            sender: msg.sender_id === user.id ? 'me' : 'them',
            text: msg.content,
            time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: msg.is_read,
          })));
        }

        // If there's a specific conversation target and it wasn't in the list, fetch it directly
        if (queryConversationId && !convItems.some(c => c.id === queryConversationId)) {
          const missingConv = await fetchConversationById(queryConversationId);
          if (missingConv && (missingConv.participant1_id === user.id || missingConv.participant2_id === user.id)) {
            const otherParticipant = missingConv.participant1_id === user.id ? missingConv.participant2 : missingConv.participant1;
            const name = otherParticipant?.full_name || 'Conversation';
            const otherId = otherParticipant?.id || '';
            convItems.push({
              id: missingConv.id,
              company: name,
              logo_initial: (name.charAt(0) || 'U'),
              color: 'bg-blue-600',
              lastMessage: missingConv.last_message || 'New conversation',
              timestamp: missingConv.last_message_at ? new Date(missingConv.last_message_at).toLocaleDateString() : new Date(missingConv.created_at).toLocaleDateString(),
              unread: 0,
              recipientId: otherId,
              recipientName: name,
              recipientEmail: otherParticipant?.email || undefined,
            });

            const missingMsgs = await fetchConversationMessages(queryConversationId);
            msgMap.set(queryConversationId, missingMsgs.map(msg => ({
              id: msg.id,
              sender: msg.sender_id === user.id ? 'me' : 'them',
              text: msg.content,
              time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              read: msg.is_read,
            })));
          }
        }

        if (convItems.length === 0) {
          // If no conversations at all, show the specific one if available from query param
          if (queryConversationId && msgMap.has(queryConversationId)) {
            // convItems was already populated above from the missing fetch
            setConversations(convItems);
            setMessages(Object.fromEntries(msgMap));
            setSelectedId(queryConversationId);
          } else {
            // Only fall back to mock data when there's no target conversation
            setConversations(MOCK_CONVERSATIONS);
            setMessages(MOCK_MESSAGES);
          }
        } else {
          setConversations(convItems);
          setMessages(Object.fromEntries(msgMap));
          if (queryConversationId && convItems.some(c => c.id === queryConversationId)) {
            setSelectedId(queryConversationId);
          }
        }
      } catch (error) {
        console.error('[Messages] error loading conversations:', error);
        // If we have a target conversation, try to load just that one instead of mock data
        if (queryConversationId) {
          try {
            const missingConv = await fetchConversationById(queryConversationId);
            if (missingConv && (missingConv.participant1_id === user.id || missingConv.participant2_id === user.id)) {
              const otherParticipant = missingConv.participant1_id === user.id ? missingConv.participant2 : missingConv.participant1;
              const name = otherParticipant?.full_name || 'Conversation';
              const otherId = otherParticipant?.id || '';
              const singleConv: Conversation = {
                id: missingConv.id,
                company: name,
                logo_initial: (name.charAt(0) || 'U'),
                color: 'bg-blue-600',
                lastMessage: missingConv.last_message || 'New conversation',
                timestamp: missingConv.last_message_at ? new Date(missingConv.last_message_at).toLocaleDateString() : new Date(missingConv.created_at).toLocaleDateString(),
                unread: 0,
                recipientId: otherId,
                recipientName: name,
                recipientEmail: otherParticipant?.email || undefined,
              };
              setConversations([singleConv]);
              setSelectedId(queryConversationId);
              // Also load messages for this conversation
              const msgs = await fetchConversationMessages(queryConversationId);
              setMessages({
                [queryConversationId]: msgs.map(msg => ({
                  id: msg.id,
                  sender: msg.sender_id === user.id ? 'me' : 'them',
                  text: msg.content,
                  time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  read: msg.is_read,
                })),
              });
            } else {
              setConversations(MOCK_CONVERSATIONS);
              setMessages(MOCK_MESSAGES);
            }
          } catch {
            setConversations(MOCK_CONVERSATIONS);
            setMessages(MOCK_MESSAGES);
          }
        } else {
          setConversations(MOCK_CONVERSATIONS);
          setMessages(MOCK_MESSAGES);
        }
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [user?.id, queryConversationId]);

  useEffect(() => {
    if (!queryConversationId || !conversations.length) return;
    if (selectedId === queryConversationId) return;
    if (conversations.some(c => c.id === queryConversationId)) {
      setSelectedId(queryConversationId);
    }
  }, [queryConversationId, conversations, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (queryConversationId === selectedId) return;
    navigate(`/messages?conversationId=${encodeURIComponent(selectedId)}`, { replace: true });
  }, [selectedId, queryConversationId, navigate]);

  // Real-time subscription for new messages in the selected conversation
  useEffect(() => {
    if (!selectedId || !user?.id) return;

    const loadSelectedConversation = async () => {
      if (!conversations.some(c => c.id === selectedId)) {
        const missingConv = await fetchConversationById(selectedId);
        if (missingConv && (missingConv.participant1_id === user.id || missingConv.participant2_id === user.id)) {
          const otherParticipant = missingConv.participant1_id === user.id ? missingConv.participant2 : missingConv.participant1;
          const name = otherParticipant?.full_name || 'Conversation';
          const otherId = otherParticipant?.id || '';
          setConversations(prev => [
            ...prev,
            {
              id: missingConv.id,
              company: name,
              logo_initial: (name.charAt(0) || 'U'),
              color: 'bg-blue-600',
              lastMessage: missingConv.last_message || 'New conversation',
              timestamp: missingConv.last_message_at ? new Date(missingConv.last_message_at).toLocaleDateString() : new Date(missingConv.created_at).toLocaleDateString(),
              unread: 0,
              recipientId: otherId,
              recipientName: name,
              recipientEmail: otherParticipant?.email || undefined,
            },
          ]);
        }
      }

      if (!messages[selectedId]) {
        const msgs = await fetchConversationMessages(selectedId);
        setMessages(prev => ({
          ...prev,
          [selectedId]: msgs.map(msg => ({
            id: msg.id,
            sender: msg.sender_id === user.id ? 'me' : 'them',
            text: msg.content,
            time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: msg.is_read,
          })),
        }));
      }

      // If there's a pending message stored (from Providers), show it immediately
      try {
        const key = `pendingMessage:${selectedId}`;
        const pendingRaw = sessionStorage.getItem(key) || sessionStorage.getItem('pendingMessage:fallback');
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw);
          setMessages(prev => {
            const existing = prev[selectedId] || [];
            if (existing.some(m => String(m.id) === String(pending.id) || m.text === pending.text)) {
              try { sessionStorage.removeItem(key); sessionStorage.removeItem('pendingMessage:fallback'); } catch (e) {}
              return prev;
            }
            const appended = [...existing, {
              id: pending.id,
              sender: 'me' as const,
              text: pending.text,
              time: new Date(pending.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              read: false,
            }];
            try { sessionStorage.removeItem(key); sessionStorage.removeItem('pendingMessage:fallback'); } catch (e) {}
            // mark pending and wait for server confirmation
            setPendingApplied(true);
            setPendingConfirmation({ tempId: pending.id, text: pending.text });
            return { ...prev, [selectedId]: appended };
          });
        }
      } catch (e) {
        // ignore
      }
    };

    loadSelectedConversation().catch(error => {
      console.error('[Messages] loadSelectedConversation failed:', error);
    });

    const channel = supabase
      .channel(`messages-live:${selectedId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          const isOwn = newMsg.sender_id === user.id;
          setMessages(prev => {
            const existing = prev[selectedId] || [];
            // Avoid duplicates
            if (existing.some(m => m.id === newMsg.id)) return prev;

            // If this is our own message, try to replace the optimistic message
            if (isOwn) {
              const idx = existing.findIndex(m => String(m.id).startsWith('msg-') && m.text === newMsg.content);
              const serverMsg = {
                id: newMsg.id,
                sender: 'me' as const,
                text: newMsg.content,
                time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                read: newMsg.is_read,
              };
              if (idx !== -1) {
                const updated = [...existing];
                updated[idx] = serverMsg;
                // clear pending state if it matches
                if (pendingConfirmation && pendingConfirmation.text === newMsg.content) {
                  setPendingApplied(false);
                  setPendingConfirmation(null);
                }
                return { ...prev, [selectedId]: updated };
              }
              // If no optimistic match, just append
              return { ...prev, [selectedId]: [...existing, serverMsg] };
            }

            // Message from the other participant
            return {
              ...prev,
              [selectedId]: [...existing, {
                id: newMsg.id,
                sender: 'them' as const,
                text: newMsg.content,
                time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                read: newMsg.is_read,
              }],
            };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, user?.id, conversations, messages]);

  // Real-time subscription for new conversations
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`conversations-live:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `participant1_id=eq.${user.id}`,
        },
        () => {
          // Reload conversations when a new one appears
          fetchConversations(user.id).then(convs => {
            const convItems: Conversation[] = [];
            for (const conv of convs) {
              const otherParticipant = conv.participant1_id === user.id ? conv.participant2 : conv.participant1;
              const name = otherParticipant?.full_name || 'Conversation';
              const otherId = otherParticipant?.id || '';
              convItems.push({
                id: conv.id,
                company: name,
                logo_initial: (name.charAt(0) || 'U'),
                color: 'bg-blue-600',
                lastMessage: conv.last_message || 'New conversation',
                timestamp: conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : new Date(conv.created_at).toLocaleDateString(),
                unread: 0,
                recipientId: otherId,
                recipientName: name,
                recipientEmail: otherParticipant?.email || undefined,
              });
            }
            setConversations(convItems);
          }).catch(() => {});
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `participant2_id=eq.${user.id}`,
        },
        () => {
          fetchConversations(user.id).then(convs => {
            const convItems: Conversation[] = [];
            for (const conv of convs) {
              const otherParticipant = conv.participant1_id === user.id ? conv.participant2 : conv.participant1;
              const name = otherParticipant?.full_name || 'Conversation';
              const otherId = otherParticipant?.id || '';
              convItems.push({
                id: conv.id,
                company: name,
                logo_initial: (name.charAt(0) || 'U'),
                color: 'bg-blue-600',
                lastMessage: conv.last_message || 'New conversation',
                timestamp: conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : new Date(conv.created_at).toLocaleDateString(),
                unread: 0,
                recipientId: otherId,
                recipientName: name,
                recipientEmail: otherParticipant?.email || undefined,
              });
            }
            setConversations(convItems);
          }).catch(() => {});
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const selectedConversation = conversations.find(c => c.id === selectedId);
  const currentMessages = selectedId ? (messages[selectedId] || []) : [];

  const filtered = conversations.filter(c =>
    c.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, selectedId]);

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || !selectedId || !user?.id || !profile?.full_name || sending) return;

    const selectedConv = conversations.find(c => c.id === selectedId);
    if (!selectedConv) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    // Optimistically add to local state
    const tempId = `msg-${Date.now()}`;
    const optimisticMsg: MessageItem = {
      id: tempId,
      sender: 'me',
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setMessages(prev => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), optimisticMsg],
    }));

    // set pending confirmation so UI shows persistent toast until server confirms
    setPendingApplied(true);
    setPendingConfirmation({ tempId, text: messageText });

    setSending(true);

    try {
      await createConversationMessage({
        senderId: user.id,
        senderName: profile.full_name,
        recipientId: selectedConv.recipientId,
        recipientName: selectedConv.recipientName,
        recipientEmail: selectedConv.recipientEmail,
        message: messageText,
      });

      // Update the conversation's last message in local state
      setConversations(prev => prev.map(c =>
        c.id === selectedId
          ? { ...c, lastMessage: messageText, timestamp: new Date().toLocaleDateString() }
          : c
      ));
    } catch (error) {
      console.error('[Messages] handleSend failed:', error);
      // Remove optimistic message on failure
      setMessages(prev => ({
        ...prev,
        [selectedId]: (prev[selectedId] || []).filter(m => m.id !== tempId),
      }));
      // clear pending UI
      setPendingApplied(false);
      setPendingConfirmation(null);
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedId, user?.id, profile?.full_name, conversations, sending]);

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
            ) : loading ? (
              <div className="p-6 text-center">
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <img src={IMG.empty.noMessages} alt="" className="w-full max-w-[200px] mx-auto rounded-lg mb-3 opacity-80" />
                <p className="text-sm text-gray-400">No message notifications yet</p>
                <p className="text-xs text-gray-400 mt-2">When recruiters and job seekers message you, they will appear here.</p>
              </div>
            ) : (
              filtered.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedId(conv.id);
                    navigate(`/messages?conversationId=${encodeURIComponent(conv.id)}`, { replace: true });
                  }}
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
                {/* Toast: persistent until server confirmation */}
                {pendingApplied && (
                  <div className="fixed right-6 top-20 z-50">
                    <div className="flex items-center gap-3 bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-3">
                      <svg className="w-5 h-5 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M4 12a8 8 0 018-8"/></svg>
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">Sending message…</div>
                        <div className="text-xs text-gray-500">Your message will appear in the chat shortly.</div>
                      </div>
                    </div>
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
                      disabled={!newMessage.trim() || sending}
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