import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchConversations,
  fetchConversationById,
  fetchConversationMessages,
  createConversationMessage,
  markConversationRead,
} from '../lib/supabaseQueries';
import { supabase } from '../lib/supabase';
import { Send, Search, ArrowLeft, Check, CheckCheck, CircleDot, Clock, Lock, MoreVertical } from 'lucide-react';
import CompanyLogo from '../components/CompanyLogo';
import { IMG } from '../lib/media';

// ─── Types ──────────────────────────────────────────────────────────────────

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
  isoTime?: string;
  read?: boolean;
  temp?: boolean;
}

// ─── Time helpers (WhatsApp-style) ─────────────────────────────────────────

/** Conversation list timestamp: time for today, "Yesterday", weekday, else date. */
function formatListTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - startMsg) / 86400000);

  if (diffDays <= 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/** Message bubble timestamp under each bubble: e.g. "8:44 am". */
function formatBubbleTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Day separator chip label. */
function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - startMsg) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ─── Mapping ───────────────────────────────────────────────────────────────

// Privacy: the chat header/list must never expose the other person's
// location/address. Even if the backend ever returns those fields, strip them
// here so they can't leak into the Messages UI.
function cleanParticipant(participant: any): any {
  if (!participant) return participant;
  const clean = { ...participant };
  delete clean.location;
  delete clean.address;
  delete clean.city;
  delete clean.state;
  delete clean.country;
  delete clean.lga;
  return clean;
}

function mapConversation(conv: any, userId: string): Conversation {
  const otherParticipant = cleanParticipant(
    conv.participant1_id === userId ? conv.participant2 : conv.participant1,
  );
  const name = otherParticipant?.full_name || 'Conversation';
  const isOwnLast = conv.last_message_sender_id === userId;
  const lastMessage = conv.last_message
    ? (isOwnLast ? `You: ${conv.last_message}` : conv.last_message)
    : 'New conversation';
  return {
    id: conv.id,
    company: name,
    logo_initial: name.charAt(0) || 'U',
    color: 'bg-blue-600',
    lastMessage,
    timestamp: formatListTime(conv.last_message_at || conv.created_at),
    unread: conv.unread_count || 0,
    recipientId: otherParticipant?.id || '',
    recipientName: name,
    recipientEmail: otherParticipant?.email || undefined,
  };
}

function mapMessage(msg: any, userId: string): MessageItem {
  return {
    id: msg.id,
    sender: msg.sender_id === userId ? 'me' : 'them',
    text: msg.content,
    time: formatBubbleTime(msg.created_at),
    isoTime: msg.created_at,
    read: !!msg.is_read,
    temp: false,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function Messages() {
  const { isAuthenticated, profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const queryConversationId = searchParams.get('conversationId');
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<string | null>(queryConversationId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, MessageItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Record<string, MessageItem[]>>({});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Keep the URL in sync so a selected conversation is shareable / survives reloads.
  useEffect(() => {
    if (!selectedId) return;
    if (queryConversationId === selectedId) return;
    navigate(`/messages?conversationId=${encodeURIComponent(selectedId)}`, { replace: true });
  }, [selectedId, queryConversationId, navigate]);

  // Reflect a conversationId arriving via the URL (e.g. from a notification).
  useEffect(() => {
    if (queryConversationId && selectedId !== queryConversationId) {
      setSelectedId(queryConversationId);
    }
  }, [queryConversationId, selectedId]);

  // ── Load the conversation list ───────────────────────────────────────────
  const reloadConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const convs = await fetchConversations(user.id);
      setConversations(convs.map((c) => mapConversation(c, user.id)));
    } catch (err) {
      console.error('[Messages] reloadConversations failed:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const convs = await fetchConversations(user.id);
        const items = convs.map((c) => mapConversation(c, user.id));

        // If the URL points at a conversation that is not in the list (e.g. it
        // was just created), fetch it directly so the thread opens correctly.
        if (queryConversationId && !items.some((c) => c.id === queryConversationId)) {
          const missing = await fetchConversationById(queryConversationId);
          if (missing && (missing.participant1_id === user.id || missing.participant2_id === user.id)) {
            items.push(mapConversation(missing, user.id));
          }
        }

        setConversations(items);
        if (queryConversationId && items.some((c) => c.id === queryConversationId)) {
          setSelectedId(queryConversationId);
        }
      } catch (error) {
        console.error('[Messages] error loading conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, queryConversationId]);

  // ── Load messages for the selected conversation + mark it read ───────────
  const reloadMessages = useCallback(
    async (convId: string) => {
      if (!user?.id) return;
      try {
        const msgs = await fetchConversationMessages(convId);
        setMessages((prev) => ({
          ...prev,
          [convId]: msgs.map((msg) => mapMessage(msg, user.id)),
        }));
      } catch (err) {
        console.error('[Messages] reloadMessages failed:', err);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (!selectedId || !user?.id) return;

    const cached = messagesRef.current[selectedId];
    if (!cached || cached.length === 0) {
      reloadMessages(selectedId);
    }

    // WhatsApp-style "Seen" receipt: mark everything the user received as read.
    markConversationRead(selectedId, user.id);
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, unread: 0 } : c)),
    );
  }, [selectedId, user?.id, reloadMessages]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[selectedId || '']?.length, selectedId]);

  // ── Real-time: new messages + read receipts in the OPEN conversation ─────
  useEffect(() => {
    if (!selectedId || !user?.id) return;

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

          setMessages((prev) => {
            const existing = prev[selectedId] || [];
            if (existing.some((m) => m.id === newMsg.id)) return prev;

            const entry: MessageItem = {
              id: newMsg.id,
              sender: isOwn ? 'me' : 'them',
              text: newMsg.content,
              time: formatBubbleTime(newMsg.created_at),
              isoTime: newMsg.created_at,
              // Messages arriving in the open thread are seen immediately.
              read: isOwn ? !!newMsg.is_read : true,
              temp: false,
            };

            if (isOwn) {
              // Replace the optimistic bubble (if any) with the server one.
              const idx = existing.findIndex((m) => m.temp && m.text === newMsg.content);
              if (idx !== -1) {
                const next = [...existing];
                next[idx] = entry;
                return { ...prev, [selectedId]: next };
              }
              return { ...prev, [selectedId]: [...existing, entry] };
            }

            // Incoming message → append and send a read receipt to the sender.
            markConversationRead(selectedId, user.id);
            return { ...prev, [selectedId]: [...existing, entry] };
          });

          // Keep the list's last-message + unread state in sync for BOTH sides.
          reloadConversations();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const upd = payload.new as any;
          // Only my own messages matter here — this flips them to "Seen" when
          // the recipient opens the thread.
          if (upd.sender_id === user.id) {
            setMessages((prev) => {
              const list = prev[selectedId] || [];
              return {
                ...prev,
                [selectedId]: list.map((m) =>
                  m.id === upd.id ? { ...m, read: !!upd.is_read } : m,
                ),
              };
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, user?.id, reloadConversations]);

  // ── Real-time: conversation list stays in sync for both participants ─────
  useEffect(() => {
    if (!user?.id) return;

    const refresh = () => {
      reloadConversations();
    };

    const channel = supabase
      .channel(`conversations-live:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `participant1_id=eq.${user.id}`,
      }, refresh)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `participant2_id=eq.${user.id}`,
      }, refresh)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `participant1_id=eq.${user.id}`,
      }, refresh)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `participant2_id=eq.${user.id}`,
      }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, reloadConversations]);

  // ── Send a message (optimistic, appended to the SAME thread only) ────────
  const handleSend = useCallback(async () => {
    const text = newMessage.trim();
    if (!text || !selectedId || !user?.id || !profile?.full_name || sending) return;

    const selectedConv = conversations.find((c) => c.id === selectedId);
    if (!selectedConv) return;

    setNewMessage('');
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => ({
      ...prev,
      [selectedId]: [
        ...(prev[selectedId] || []),
        {
          id: tempId,
          sender: 'me' as const,
          text,
          time: formatBubbleTime(new Date().toISOString()),
          isoTime: new Date().toISOString(),
          read: false,
          temp: true,
        },
      ],
    }));
    setSending(true);

    try {
      await createConversationMessage({
        senderId: user.id,
        senderName: profile.full_name,
        recipientId: selectedConv.recipientId,
        recipientName: selectedConv.recipientName,
        recipientEmail: selectedConv.recipientEmail,
        message: text,
      });

      // Replace the optimistic bubble with the server-confirmed message, then
      // refresh the list so the thread + preview update immediately.
      await reloadMessages(selectedId);
      await reloadConversations();
    } catch (error) {
      console.error('[Messages] handleSend failed:', error);
      setMessages((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] || []).filter((m) => m.id !== tempId),
      }));
    } finally {
      setSending(false);
    }
  }, [
    newMessage,
    selectedId,
    user?.id,
    profile?.full_name,
    conversations,
    sending,
    reloadMessages,
    reloadConversations,
  ]);

  // ── Derived state ────────────────────────────────────────────────────────
  const selectedConversation = conversations.find((c) => c.id === selectedId);
  const currentMessages = selectedId ? messages[selectedId] || [] : [];
  const filtered = conversations.filter((c) =>
    c.company.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleBackToList = useCallback(() => {
    setSelectedId(null);
    navigate('/messages', { replace: true });
  }, [navigate]);

  const openConversation = useCallback(
    (convId: string) => {
      setSelectedId(convId);
      navigate(`/messages?conversationId=${encodeURIComponent(convId)}`, { replace: true });
    },
    [navigate],
  );

  // Build the message list with WhatsApp-style day separators.
  const renderedMessages: Array<{ type: 'day' | 'message'; key: string; day?: string; msg?: MessageItem }> = [];
  let lastDay = '';
  for (const msg of currentMessages) {
    const dk = msg.isoTime ? dayKey(msg.isoTime) : '';
    if (dk && dk !== lastDay) {
      renderedMessages.push({ type: 'day', key: `day-${dk}`, day: formatDayLabel(msg.isoTime!) });
      lastDay = dk;
    }
    renderedMessages.push({ type: 'message', key: msg.id, msg });
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100dvh-64px)]">
        {/* ── Conversation List (WhatsApp main screen) ─────────────────── */}
        <div
          className={`w-full sm:w-80 lg:w-96 border-r border-gray-100 flex-col bg-white ${selectedId ? 'hidden sm:flex' : 'flex'}`}
        >
          <div className="px-4 pt-4 pb-2 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Messages</h2>
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CircleDot className="w-3 h-3" /> Online
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!isAuthenticated ? (
              <div className="p-6 text-center">
                <img
                  src={IMG.empty.noMessages}
                  alt=""
                  className="w-full max-w-[200px] mx-auto rounded-lg mb-4 opacity-80"
                />
                <p className="text-sm text-gray-500 mb-3">Sign in to see your messages</p>
                <a href="/login" className="text-blue-600 text-sm font-medium hover:underline">
                  Sign in
                </a>
              </div>
            ) : loading ? (
              <div className="p-6 text-center">
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <img
                  src={IMG.empty.noMessages}
                  alt=""
                  className="w-full max-w-[200px] mx-auto rounded-lg mb-3 opacity-80"
                />
                <p className="text-sm text-gray-400">No conversations yet</p>
                <p className="text-xs text-gray-400 mt-2">
                  When you contact a service provider, your chat will appear here.
                </p>
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-gray-50 text-left transition-colors ${
                    selectedId === conv.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <CompanyLogo
                      company={conv.company}
                      className="w-11 h-11 rounded-full"
                      fallbackClassName={conv.color}
                    />
                    {conv.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm truncate ${
                          conv.unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                        }`}
                      >
                        {conv.company}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0 ml-2">{conv.timestamp}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-xs truncate ${
                          conv.unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'
                        }`}
                      >
                        {conv.locked && <Lock className="w-3 h-3 inline mr-1 text-gray-400" />}
                        {conv.lastMessage}
                      </p>
                      {conv.unread > 0 && (
                        <span className="shrink-0 w-5 h-5 bg-green-500 text-white text-[11px] font-semibold rounded-full flex items-center justify-center">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Chat View (full-screen on mobile, panel on desktop) ──────── */}
        <div className={`flex-1 flex-col bg-[#efeae2] ${selectedId ? 'flex' : 'hidden sm:flex'}`}>
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-5">
                <Send className="w-9 h-9 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">JobBridge Messages</h3>
              <p className="text-gray-500 text-sm max-w-xs">
                Select a conversation to view and reply. Each conversation is private to you and the
                other person.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-[#f0f2f5] border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={handleBackToList}
                    className="sm:hidden text-gray-600 hover:text-gray-900 -ml-1"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  {selectedConversation && (
                    <CompanyLogo
                      company={selectedConversation.company}
                      className="w-9 h-9 rounded-full"
                      fallbackClassName={selectedConversation.color}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {selectedConversation?.company}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedConversation?.locked ? 'Conversation ended' : 'Private chat'}
                    </p>
                  </div>
                </div>
                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {selectedConversation?.locked && (
                  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-700 mb-3">
                    <Lock className="w-4 h-4" />
                    This conversation is no longer active.
                  </div>
                )}

                {currentMessages.length === 0 && !sending ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-xs">
                      <p className="text-sm text-gray-500 font-medium mb-1">
                        No messages yet
                      </p>
                      <p className="text-xs text-gray-400">
                        Say hello to start the conversation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {renderedMessages.map((item) =>
                      item.type === 'day' ? (
                        <div key={item.key} className="flex justify-center my-3">
                          <span className="text-xs text-gray-600 bg-white/70 rounded-lg px-3 py-1 shadow-sm">
                            {item.day}
                          </span>
                        </div>
                      ) : (
                        <div
                          key={item.key}
                          className={`flex ${item.msg!.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] sm:max-w-sm rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                              item.msg!.sender === 'me'
                                ? 'bg-[#d9fdd3] text-gray-800 rounded-br-sm'
                                : 'bg-white text-gray-800 rounded-bl-sm'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{item.msg!.text}</p>
                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[11px] ${
                                item.msg!.sender === 'me' ? 'text-gray-500' : 'text-gray-400'
                              }`}
                            >
                              {item.msg!.temp && (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>Sending…</span>
                                </>
                              )}
                              {!item.msg!.temp && item.msg!.time}
                              {item.msg!.sender === 'me' && !item.msg!.temp && (
                                item.msg!.read ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-gray-500" />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input — fixed at the bottom */}
              {!selectedConversation?.locked && (
                <div className="bg-[#f0f2f5] border-t border-gray-200 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2.5 rounded-full bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!newMessage.trim() || sending}
                      className="p-2.5 bg-[#00a884] text-white rounded-full hover:bg-[#019374] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                      aria-label="Send message"
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
