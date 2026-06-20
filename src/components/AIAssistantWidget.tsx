import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, ChevronUp, Sparkles, FileText, MessageCircle, TrendingUp } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const suggestedPrompts = [
  'Review my resume',
  'Interview tips',
  'Salary negotiation',
  'Career pivot advice',
  'Skills gap analysis',
  'Top companies hiring',
];

export default function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I'm your AI career assistant. I can help with resume writing, interview prep, job search strategies, and salary negotiation. What can I help you with today?",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [faq, setFaq] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // load pre-extracted site knowledge JSON
    fetch('/data/site_knowledge.json')
      .then((r) => r.json())
      .then((j) => setKnowledge(j.items || []))
      .catch(() => setKnowledge([]));
    // load FAQ mapping
    fetch('/data/faq.json')
      .then((r) => r.json())
      .then((j) => setFaq(j.items || []))
      .catch(() => setFaq([]));
  }, []);

  const getFaqAnswer = (query: string) => {
    if (!query || !faq.length) return null;
    const q = query.toLowerCase();
    for (const f of faq) {
      if (!f.keywords) continue;
      for (const kw of f.keywords) {
        if (q.includes(kw.toLowerCase())) return f.answer;
      }
    }
    return null;
  };

  const getRelevantPages = (query: string, top = 3) => {
    if (!query || !knowledge.length) return [];
    const q = query.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ');
    const qWords = [...new Set(q.split(/\s+/).filter(Boolean))];
    const scores = knowledge.map((item) => {
      const hay = (item.title + ' ' + item.text).toLowerCase();
      let score = 0;
      for (const w of qWords) {
        if (hay.includes(w)) score += 1;
      }
      return { item, score };
    });
    return scores
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, top)
      .map((s) => s.item);
  };

  const cleanText = (raw: string) => {
    if (!raw) return '';
    // aggressive sanitization to avoid returning source code or JSX fragments
    let t = raw || '';
    // remove JSX/HTML tags and their attributes
    t = t.replace(/<[^>]+>/g, ' ');
    // remove curly brace content like {expr}
    t = t.replace(/\{[^}]*\}/g, ' ');
    // remove common code/JS keywords and dotted identifiers (e.g. msg.content)
    t = t.replace(/\b(const|let|var|interface|export|import|from|return|=>|function|React|useState|props|className|map|=>)\b/gi, ' ');
    t = t.replace(/\b[a-zA-Z0-9_]+\.[a-zA-Z0-9_\.]+\b/g, ' ');
    // drop punctuation that often appears in code
    t = t.replace(/[=;:\/\\|<>\[\]*~`@#$%^&*()+]/g, ' ');
    // collapse whitespace
    t = t.replace(/\s+/g, ' ').trim();

    if (!t) return '';

    // split into sentence-like fragments and pick the most natural ones
    const parts = t.split(/(?<=[\.\?\!])\s+/).map(s => s.trim()).filter(Boolean);
    // prefer sentences with reasonable length and containing verbs
    const good = parts.filter(p => p.split(' ').length > 6 && /\b(is|are|can|will|should|provide|help|helping|includes|includes)\b/i);
    const chosenList = good.length ? good : parts.filter(p => p.split(' ').length > 6);
    const chosen = (chosenList.length ? chosenList : parts).slice(0, 2).join(' ');

    // final safety: if still suspiciously short or contains code-like tokens, return empty
    if (!chosen || chosen.length < 40 || /\b(msg|className|props|=>|React)\b/i.test(chosen)) return '';
    return chosen;
  };

  const humanizePageSummary = (item: any) => {
    if (!item) return '';
    const s = cleanText(item.text || '');
    if (s) return s;
    // fallback: produce a short humanized phrase based on the title
    const title = (item.title || '').replace(/[-_]/g, ' ').trim();
    return `Overview and details about ${title || 'this page'}.`;
  };

  const handleSend = (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Simulate AI response / local retrieval then call backend LLM for improved answer
    setTimeout(() => {
      const responses: Record<string, string> = {
        'Review my resume': "I'd be happy to review your resume! Please share it and I'll provide specific feedback on structure, keywords, and impact. Key areas I check: ATS compatibility, quantifiable achievements, relevant skills, and clear formatting.",
        'Interview tips': "Here are my top interview tips:\n\n1. Research the company thoroughly\n2. Practice the STAR method for behavioral questions\n3. Prepare 3-5 questions to ask them\n4. Dress appropriately (remote interviews matter too!)\n5. Follow up within 24 hours\n\nNeed help with specific questions?",
        'Salary negotiation': "For salary negotiation:\n\n1. Research the market rate for your role\n2. Know your 'walk away' number\n3. Let them make the first offer if possible\n4. Focus on value you bring\n5. Consider total compensation (equity, benefits, growth)\n\nWould you like me to help craft your negotiation script?",
        'Career pivot advice': "Career pivots are possible at any stage! Here's my framework:\n\n1. Identify transferable skills\n2. Fill knowledge gaps with courses/certs\n3. Network with people in your target field\n4. Consider contract/freelance to test waters\n5. Update your resume to highlight relevant experience\n\nWhat's your target field?",
        'Skills gap analysis': "To analyze your skills gaps:\n\n1. Identify your target role\n2. Review 10+ job postings for that role\n3. List required vs your current skills\n4. Prioritize: high-demand gaps first\n5. Create a learning plan with deadlines\n\nWould you like recommendations for specific learning resources?",
        'Top companies hiring': "Based on current market trends, top companies hiring include:\n\n• Tech: Andela, Flutterwave, Paystack\n• Finance: ALAT, PiggyVest, Cowrywise\n• Startups: growing rapidly\n• Remote: Global opportunities on Upwork, Toptal\n\nWould you like help tailoring your application?",
      };

      let reply = responses[messageText];

      // First check FAQ mapping for a curated answer
      const faqAns = getFaqAnswer(messageText);
      if (faqAns) {
        reply = faqAns;
      } else {
        // Intent: become a service provider -> provide direct steps as fallback
        const mq = messageText.toLowerCase();
        if (/(become|how do i become|how to become|becoming)\s+.*service provider/.test(mq) || (mq.includes('service provider') && mq.includes('how'))) {
          reply = `To become a Service Provider on JobBridge:\n\n` +
            `1) Go to Sign up and choose the 'Service Provider' role.\n` +
            `2) Enter your full name, email, company (if any) and create a password.\n` +
            `3) For Recruiter/Provider accounts you'll be asked to verify via OTP — complete verification on the Verify OTP page.\n` +
            `4) After signup, complete your Provider profile: add service categories, descriptions, hourly rate, samples, and contact info.\n` +
            `5) Optionally pick a paid plan on Pricing and complete payment on the Payment page to get featured placement.\n\n` +
            `If you'd like, I can open the Signup or Providers page and expand the exact form fields.`;
        } else if (!reply) {
          // run simple retrieval over site knowledge and produce cleaned snippets
          const pages = getRelevantPages(messageText, 4);
          if (pages.length) {
            reply = `I found information on these pages relevant to your question:\n\n` +
              pages.map((p: any) => `• ${p.title} — ${humanizePageSummary(p)}`).join('\n\n') +
              `\n\nIf you'd like, I can expand any of these sections or answer more specifically.`;
          } else {
            reply = "That's a great question! I couldn't find an exact match in the site content — could you give me more detail or ask about a specific page (e.g., Pricing, Signup, Payment)?";
          }
        }
      }

      // push initial reply
      const botMessageInitial: Message = {
        id: messages.length + 2,
        text: reply,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessageInitial]);

      // async: try backend LLM and append improved answer
      const tryBackendAndAppend = async () => {
        try {
          const resp = await fetch('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: messageText }),
          });
          if (resp.ok) {
            const j = await resp.json();
            if (j.ok && j.answer) {
              const botMessageImproved: Message = {
                id: messages.length + 3,
                text: j.answer,
                sender: 'bot',
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, botMessageImproved]);
            }
          }
        } catch (e) {
          // ignore
        }
      };
      tryBackendAndAppend();
    }, 800);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setShowIntro(true)}
        className={`fixed bottom-20 right-4 md:bottom-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <div className="relative">
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
        </div>
      </button>

      {/* Intro Modal shown before opening chat */}
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

      {/* Chat Panel */}
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
          {/* Header */}
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
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ChevronUp className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[350px] bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    message.sender === 'user'
                      ? 'bg-blue-700 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts */}
          <div className="px-3 py-2 bg-white border-t border-gray-100">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="shrink-0 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-gray-100"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Quick Actions */}
          <div className="px-3 pb-3 bg-white">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { icon: FileText, label: 'Resume' },
                { icon: MessageCircle, label: 'Interview' },
                { icon: TrendingUp, label: 'Salary' },
                { icon: Sparkles, label: 'Improve' },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => handleSend(`Help me with ${label.toLowerCase()}`)}
                  className="flex flex-col items-center gap-1 p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
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
