import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Bot, X, Send, ChevronUp, Sparkles, FileText, MessageCircle, TrendingUp, Trash2, AlertCircle, RefreshCw, BookOpen } from 'lucide-react';
import { streamAnswer, hasApiKey, clearConversation, prewarmEmbeddings, type SourceInfo } from '../lib/ragEngine';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  sources?: SourceInfo[];
  error?: boolean;
}

type Phase = 'idle' | 'analyzing' | 'searching' | 'generating';

const CONVERSATION_ID = 'jobbridge-ai-widget';
const PHASE_LABELS: Record<Phase, string> = {
  idle: '',
  analyzing: 'Analyzing your question',
  searching: 'Searching knowledge base',
  generating: 'Generating response',
};

function renderInline(text: string): React.ReactNode {
  const result: React.ReactNode[] = [];
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of boldParts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      result.push(<strong key={result.length}>{part.slice(2, -2)}</strong>);
    } else {
      const italicParts = part.split(/(\*[^*]+\*)/g);
      for (const ip of italicParts) {
        if (ip.startsWith('*') && ip.endsWith('*') && ip.length > 2) {
          result.push(<em key={result.length}>{ip.slice(1, -1)}</em>);
        } else {
          result.push(ip);
        }
      }
    }
  }
  return result.length === 1 ? result[0] : result;
}

function formatMessage(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
  return parts.map((part, i) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 break-all">{part}</a>;
    }
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(part)) {
      const href = part.endsWith('@gmail.com')
        ? `https://mail.google.com/mail/?view=cm&fs=1&to=${part}`
        : `mailto:${part}`;
      return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">{part}</a>;
    }
    const lines = part.split('\n');
    const elements: React.ReactNode[] = [];
    let li = 0;
    while (li < lines.length) {
      const line = lines[li];
      const trimmed = line.trim();
      if (!trimmed) {
        elements.push(<br key={`${i}-br-${li}`} />);
        li++;
        continue;
      }
      const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const Tag = level === 3 ? 'h3' : level === 2 ? 'h2' : 'h3';
        elements.push(<Tag key={`${i}-h-${li}`} className="font-bold mt-2 mb-1 text-sm">{renderInline(headerMatch[2])}</Tag>);
        li++;
        continue;
      }
      if (/^[-*•]\s/.test(trimmed)) {
        const items: React.ReactNode[] = [];
        while (li < lines.length && /^[-*•]\s/.test(lines[li].trim())) {
          items.push(<li key={`${i}-uli-${li}`}>{renderInline(lines[li].trim().replace(/^[-*•]\s+/, ''))}</li>);
          li++;
        }
        elements.push(<ul key={`${i}-ul`} className="list-disc list-inside mb-2 space-y-0.5">{items}</ul>);
        continue;
      }
      const numberedMatch = trimmed.match(/^\d+[\)\.]\s(.+)/);
      if (numberedMatch) {
        const items: React.ReactNode[] = [];
        while (li < lines.length) {
          const m = lines[li].trim().match(/^\d+[\)\.]\s(.+)/);
          if (!m) break;
          items.push(<li key={`${i}-oli-${li}`}>{renderInline(m[1])}</li>);
          li++;
        }
        elements.push(<ol key={`${i}-ol`} className="list-decimal list-inside mb-2 space-y-0.5">{items}</ol>);
        continue;
      }
      elements.push(<p key={`${i}-p-${li}`} className="mb-2 last:mb-0">{renderInline(trimmed)}</p>);
      li++;
    }
    return elements;
  });
}

const pagePrompts: Record<string, string[]> = {
  '/': ['What is JobBridge?', 'How to find a job?', 'Recruiter plans', 'AI Resume Builder'],
  '/jobs': ['How to apply?', 'Job types available', 'Save jobs', 'Application tips'],
  '/my-jobs': ['Track applications', 'Saved jobs', 'Application status', 'Job alerts'],
  '/recruiter': ['Post a job', 'AI candidate ranking', 'Applications panel', 'Recruiter plans'],
  '/pricing': ['Recruiter plans', 'AI tools pricing', 'How to pay', 'Payment methods'],
  '/ai-resume': ['Build resume', 'Cover letter', 'Extract skills', 'AI subscription'],
  '/providers': ['Become a provider', 'Provider plans', 'Featured listing', 'Service categories'],
  '/business': ['Ad packages', 'Create advert', 'Featured business', 'Promote business'],
  '/settings': ['Change password', 'Notifications', 'Privacy', 'Delete account'],
  '/admin': ['Admin tools', 'Manage users', 'Approve jobs', 'Platform stats'],
};

const defaultPrompts = ['What is JobBridge?', 'How to find a job?', 'Recruiter plans', 'Contact support'];

let msgCounter = 0;
function nextId() { return `msg-${++msgCounter}`; }

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return greeting;
}

function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: nextId(),
      text: `${getTimeGreeting()}! I'm your JobBridge AI assistant. I can answer questions about finding jobs, posting vacancies, pricing, AI tools, and more. What would you like to know?`,
      sender: 'bot',
    },
  ]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [streamText, setStreamText] = useState('');
  const [streamSources, setStreamSources] = useState<SourceInfo[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  const lastUserMsgRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aborterRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamText, phase]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    return () => { aborterRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => prewarmEmbeddings());
    } else {
      setTimeout(prewarmEmbeddings, 2000);
    }
  }, []);

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const suggestedPrompts = pagePrompts[path] || defaultPrompts;

  function appendBotMessage(text: string, sources?: SourceInfo[]) {
    setMessages(prev => [...prev, { id: nextId(), text, sender: 'bot', sources }]);
  }

  function handleSend(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || phase !== 'idle') return;

    lastUserMsgRef.current = messageText;
    setMessages(prev => [...prev, { id: nextId(), text: messageText, sender: 'user' }]);
    setInput('');
    setPhase('analyzing');
    setStreamText('');
    setStreamSources([]);

    streamAnswer(messageText, CONVERSATION_ID, {
      onPhase: (p) => {
        if (p.includes('Analyzing')) setPhase('analyzing');
        else if (p.includes('Searching')) setPhase('searching');
        else setPhase('generating');
      },
      onToken: (token) => {
        setStreamText(prev => prev + token);
      },
      onSources: (sources) => {
        setStreamSources(sources);
      },
      onError: (err) => {
        setPhase('idle');
        setStreamText('');
        setStreamSources([]);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.sender === 'bot' && last.id.startsWith('msg-')) {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, text: err, error: true };
            return updated;
          }
          return [...prev, { id: nextId(), text: err, sender: 'bot', error: true }];
        });
      },
      onDone: (finalText, finalSources) => {
        setPhase('idle');
        appendBotMessage(finalText, finalSources);
        setStreamText('');
        setStreamSources([]);
      },
    });
  }

  function handleClear() {
    clearConversation(CONVERSATION_ID);
    setMessages([
      {
        id: nextId(),
        text: `Conversation cleared. ${getTimeGreeting()}! How can I help you today?`,
        sender: 'bot',
      },
    ]);
    setStreamText('');
    setStreamSources([]);
    setPhase('idle');
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Launcher button */}
      <button
        onClick={() => setShowIntro(true)}
        className={`fixed z-40 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center ${isOpen ? 'scale-0' : 'scale-100'}`}
        style={{ bottom: 'max(80px, env(safe-area-inset-bottom, 0px))', right: 'max(16px, env(safe-area-inset-right, 0px))' }}
      >
        <div className="relative">
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
        </div>
      </button>

      {/* Intro modal */}
      {showIntro && !isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowIntro(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-3">Say hello to your AI Career Assistant!</h2>
            <p className="text-sm text-gray-700 mb-3">We've just launched an innovative tool to help you boost your career chances, whether you're just starting out or aiming for your next leadership role.</p>
            <p className="text-sm text-gray-700 font-semibold mb-2">Now you can easily:</p>
            <ul className="list-disc list-inside text-sm text-gray-700 mb-4 space-y-1">
              <li>Build a standout CV from scratch or improve your current one</li>
              <li>Generate job-specific cover letters in minutes</li>
              <li>Practice mock interviews tailored to your role or industry</li>
              <li>Negotiate job offers confidently with AI-generated counteroffers</li>
            </ul>
            <p className="text-sm text-gray-700 mb-4">And the best part? It's affordable.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowIntro(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => { setShowIntro(false); setIsOpen(true); }} className="px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800">Try it now</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat panel */}
      <div
        className={`fixed z-50 transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{
          bottom: 'max(80px, env(safe-area-inset-bottom, 0px))',
          right: 'max(16px, env(safe-area-inset-right, 0px))',
          width: 'calc(100vw - 32px)',
          maxWidth: '400px',
          maxHeight: 'calc(100dvh - max(120px, env(safe-area-inset-bottom, 0px)))',
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200" style={{ maxHeight: 'calc(100dvh - max(120px, env(safe-area-inset-bottom, 0px)))' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between shrink-0">
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
              <button onClick={handleClear} title="Clear conversation" className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4 text-white" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <ChevronUp className="w-4 h-4 text-white" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50" style={{ minHeight: '200px' }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] px-3 py-2 rounded-xl text-sm ${
                  msg.sender === 'user'
                    ? 'bg-blue-700 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                }`}>
                  <div className="text-sm leading-relaxed">{formatMessage(msg.text)}</div>
                  {msg.sender === 'bot' && msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                      {msg.sources.map(s => (
                        <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">
                          <BookOpen className="w-2.5 h-2.5" />
                          {s.title}
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.sender === 'bot' && msg.error && (
                    <div className="flex items-center gap-2 mt-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <button
                        onClick={() => {
                          setMessages(prev => prev.filter(m => m.id !== msg.id));
                          if (lastUserMsgRef.current) handleSend(lastUserMsgRef.current);
                        }}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {(phase !== 'idle' || streamText) && (
              <div className="flex justify-start">
                <div className="max-w-[88%] px-3 py-2 rounded-xl text-sm bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100">
                  {!streamText && phase !== 'idle' ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                          <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                        </div>
                        <span className="text-xs text-gray-500">{PHASE_LABELS[phase]}...</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm leading-relaxed">{formatMessage(streamText)}</div>
                      {phase === 'generating' && (
                        <span className="inline-block w-1.5 h-4 bg-blue-600 ml-0.5 animate-pulse" style={{ verticalAlign: 'text-bottom' }} />
                      )}
                      {streamSources.length > 0 && !streamText && (
                        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                          {streamSources.map(s => (
                            <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">
                              <BookOpen className="w-2.5 h-2.5" />
                              {s.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested prompts */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 shrink-0">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={phase !== 'idle'}
                  className="shrink-0 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="px-3 pb-1 bg-white shrink-0">
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
                  disabled={phase !== 'idle'}
                  className="flex flex-col items-center gap-1 p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Icon className="w-4 h-4 text-blue-700" />
                  <span className="text-[10px] text-gray-600">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="p-3 bg-white border-t border-gray-100 shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything..."
                disabled={phase !== 'idle'}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || phase !== 'idle'}
                className="p-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default memo(AIAssistantWidget);
