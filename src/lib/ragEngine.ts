import KB, { type KnowledgeSection } from './jobbridgeKnowledge';

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const LLM_MODEL = 'gpt-4o-mini';
const TOP_K = 6;
const MAX_HISTORY = 20;
const MAX_INPUT_LENGTH = 500;
const MIN_INTERVAL_MS = 1000;
const MAX_CALLS_PER_WINDOW = 25;
const WINDOW_MS = 60000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000;
const MAX_CONTEXT_LENGTH = 4000;
const CACHE_CONV_KEY = 'jb_conv_';

export interface SourceInfo {
  id: string;
  title: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onSources: (sources: SourceInfo[]) => void;
  onError: (err: string) => void;
  onPhase: (phase: string) => void;
  onDone: (fullText: string, sources: SourceInfo[]) => void;
}

export function hasApiKey(): boolean {
  return !!API_KEY;
}

// ─── Retry helper with exponential backoff ─────────────────────

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429 || attempt === retries) return res;
    const delay = RETRY_BASE_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
    await new Promise(r => setTimeout(r, delay));
  }
  throw new Error('Unreachable');
}

// ─── Input sanitization ─────────────────────────────────────────

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_INPUT_LENGTH);
}

// ─── Client-side rate limiter ──────────────────────────────────

const rateLimit = (() => {
  let lastCall = 0;
  let callCount = 0;
  let windowStart = Date.now();
  return {
    allow(): boolean {
      const now = Date.now();
      if (now - windowStart > WINDOW_MS) { callCount = 0; windowStart = now; }
      if (now - lastCall < MIN_INTERVAL_MS) return false;
      if (callCount >= MAX_CALLS_PER_WINDOW) return false;
      lastCall = now;
      callCount++;
      return true;
    },
  };
})();

// ─── Conversation memory ────────────────────────────────────────

type HistoryMsg = { role: 'user' | 'assistant'; content: string };

function getConversation(convId: string): HistoryMsg[] {
  try {
    const raw = localStorage.getItem(CACHE_CONV_KEY + convId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveConversation(convId: string, msgs: HistoryMsg[]) {
  try {
    localStorage.setItem(CACHE_CONV_KEY + convId, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  } catch {}
}

export function clearConversation(convId: string) {
  try { localStorage.removeItem(CACHE_CONV_KEY + convId); } catch {}
}

// ─── Page context map ──────────────────────────────────────────

const pageContextMap: Record<string, string> = {
  '/': 'the home page — JobBridge platform overview, how it works, featured jobs, testimonials, and stats',
  '/jobs': 'the Jobs page — browse, search, filter, and apply to job listings with the 3-step application form',
  '/my-jobs': 'the My Jobs page — track your saved jobs, applied jobs with status, interviews, and archived jobs',
  '/recruiter': 'the Recruiter Dashboard — post jobs, AI job description writer, applications panel, AI candidate ranking',
  '/pricing': 'the Pricing page — compare recruiter job plans, AI subscription plans, service provider plans, and business ad packages',
  '/payment': 'the Payment page — complete purchases via Paystack card payment or bank transfer to Moniepoint MFB',
  '/ai-resume': 'the AI Resume Studio — Skills Extraction, AI Tailor Resume, AI Cover Letter Generator, AI Interview Preparation',
  '/providers': 'the Service Provider Marketplace — browse professionals in engineering, design, marketing, finance, legal, and more',
  '/business': 'the Business Advertisements page — create and manage business ads with weekly, monthly, or featured packages',
  '/profile': 'the Profile page — personal info, professional info, inclusion fields, account security, and danger zone',
  '/settings': 'the Settings page — manage notifications, privacy controls, premium subscriptions, and connected apps',
  '/admin': 'the Admin Dashboard — manage users, moderate jobs, approve providers, view platform analytics',
  '/support': 'the Support page — FAQ accordion covering job seekers, recruiters, and general questions',
  '/contact': 'the Contact page — contact form and support email and phone information',
  '/blog': 'the Blog page — career insights articles, categories, and newsletter subscription',
  '/signup': 'the Sign Up page — create account with role selection: Job Seeker, Recruiter, or Service Provider',
  '/login': 'the Login page — sign in with email and password, forgot password link, rate limiting',
  '/about': 'the About page — company story, mission, values, team, and milestone information',
  '/ceo': 'the CEO Vision page — founder video message, photo gallery, company milestones, and user messages',
  '/games': 'the Games page — memory card matching game with multiple stages, scoring, and sound effects',
  '/analytics': 'the Analytics page — platform statistics, job market trends, and data visualizations',
  '/career': 'the Career page — coming soon careers section, subscribe for job opening notifications at JobBridge',
  '/privacy': 'the Privacy Center — data collection, usage, sharing policies, security practices, and user rights',
  '/messages': 'the Messages / Inbox page — conversation threads, chat panels, read receipts, and search',
  '/notifications': 'the Notifications & Alerts page — notification history, job alerts, and notification preferences',
};

function currentPageContext(): string {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return pageContextMap[path] || `the ${path} page`;
}

// ─── Improved scoring with multi-strategy matching ─────────────

function scoreSection(section: KnowledgeSection, query: string, pagePath: string): number {
  const lower = query.toLowerCase().trim();
  const queryWords = lower.split(/\s+/).filter(w => w.length > 1);
  if (queryWords.length === 0) return 0;

  let score = 0;

  // 1) Exact multi-word keyword phrase matching (highest weight)
  const phraseMatches = section.keywords.filter(kw => {
    const kl = kw.toLowerCase();
    return kl.length > 3 && lower.includes(kl);
  }).length;
  score += phraseMatches * 6;

  // 2) Single keyword word-match (one keyword word matches a query word exactly)
  const keywordWords = new Set(section.keywords.flatMap(k => k.toLowerCase().split(/\s+/)));
  const exactKeywordMatches = queryWords.filter(w => keywordWords.has(w)).length;
  score += exactKeywordMatches * 3;

  // 3) Title word matching
  const titleWords = section.title.toLowerCase().split(/\s+/);
  const titleMatches = queryWords.filter(w => titleWords.includes(w)).length;
  score += titleMatches * 4;

  // 4) Tag matching
  const tagMatches = section.tags.filter(t => lower.includes(t)).length;
  score += tagMatches * 2;

  // 5) Page context boost (stronger if section explicitly lists this page)
  if (section.pages.includes(pagePath)) {
    score += 5;
  } else if (section.pages.some(p => pagePath.startsWith(p) && p !== '/')) {
    score += 3;
  }

  // 6) Content word overlap
  const contentWords = (section.content + ' ' + section.title).toLowerCase().split(/\s+/);
  const contentWordSet = new Set(contentWords);
  const contentMatches = queryWords.filter(w => w.length > 2 && contentWordSet.has(w)).length;
  score += contentMatches * 0.5;

  // 7) Word prefix matching (for partial/plural matches)
  const prefixMatches = queryWords.filter(w => {
    if (w.length < 4) return false;
    return [...keywordWords].some(kw => kw.startsWith(w) || w.startsWith(kw));
  }).length;
  score += prefixMatches * 1.5;

  // 8) Question-type boost — if query is procedural, boost sections with step/click/go keywords
  const isProcedural = /^(how (to|do|can)|steps?|guide|walk|what are the steps)/i.test(lower);
  if (isProcedural && /click|step|go to|select|enter|choose|fill|upload|submit/i.test(section.content)) {
    score += 3;
  }

  // 9) Category relevance — if query has clear category, penalize wrong-tag sections slightly
  const categoryTags = ['auth', 'pricing', 'jobs', 'recruiter', 'ai', 'providers', 'business', 'security', 'technical'];
  const queryCatTags = categoryTags.filter(t => lower.includes(t));
  if (queryCatTags.length > 0) {
    const hasMatchingTag = queryCatTags.some(t => section.tags.includes(t));
    if (!hasMatchingTag) score -= 1;
  }

  return Math.max(0, score);
}

function retrieveRelevant(question: string, pagePath: string): KnowledgeSection[] {
  const trimmed = question.trim();
  if (!trimmed) return [];

  const scored = KB.map(section => ({
    section,
    score: scoreSection(section, trimmed, pagePath),
  }));

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter(s => s.score > 0).slice(0, TOP_K);

  if (top.length === 0) {
    const fallback = scored.slice(0, 3);
    if (fallback.some(s => s.score > 0)) {
      return fallback.filter(s => s.score > 0).map(s => s.section);
    }
  }

  return top.map(s => s.section);
}

// ─── Context trimming — keep within token budget ──────────────

function trimContext(sections: KnowledgeSection[]): string {
  let combined = '';
  for (const s of sections) {
    const block = `${s.title}\n${s.content}\n\n---\n\n`;
    if ((combined + block).length > MAX_CONTEXT_LENGTH) break;
    combined += block;
  }
  return combined || `${sections[0].title}\n${sections[0].content}`;
}

// ─── Streaming LLM call ─────────────────────────────────────────

async function streamLLM(
  messages: { role: string; content: string }[],
  onToken: (token: string) => void,
): Promise<string> {
  const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      max_tokens: 800,
      temperature: 0.3,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error: ${res.status} — ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content || '';
        if (token) {
          full += token;
          onToken(token);
        }
      } catch {}
    }
  }

  return full;
}

// ─── System prompt builder ──────────────────────────────────────

function buildSystemPrompt(
  context: string,
  pageContext: string,
  history: HistoryMsg[],
): string {
  return `You are the JobBridge AI Assistant — a warm, thoughtful, and knowledgeable career companion for Nigeria's #1 professional network.

## Your Personality
- Be warm, encouraging, and conversational — like a supportive career coach who genuinely cares
- When the user greets you or makes small talk, respond warmly and naturally. Build rapport first before diving into answers.
- Show enthusiasm about helping people with their career journey. Use phrases like "I'd love to help", "That's a great question", "Wonderful to hear"
- Be concise but personable. A short warm sentence before the answer makes all the difference.
- Use natural, conversational language. Write like a human, not a manual.

## Core Rules
- Answer ONLY based on the knowledge context below. Do not make up information, features, or pricing.
- If the context doesn't contain the answer, say: "I don't have that information. Please contact jobbridgesupport@gmail.com for help."
- Be concise (2-5 sentences) but thorough when needed. Use bullet points for lists of 2+ items.
- Do not mention "context", "internal notes", "knowledge base", or "retrieved" in your response.
- Include relevant page paths like /signup, /pricing, /recruiter, /profile when helpful.
- If the user asks about something outside JobBridge, politely redirect to platform topics.
- When giving instructions, use clear step-by-step format (1. 2. 3.).
- Do NOT use markdown formatting like **bold** or *italic* in your response.

## Current Page
The user is currently on: ${pageContext}

## Conversation History (last ${MAX_HISTORY} messages)
${history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

## Knowledge Context (use this to answer)
${context}`;
}

// ─── Conversational greeting detection ──────────────────────────

function buildConversationalResponse(input: string, historyLength: number): string | null {
  const lower = input.toLowerCase().trim();
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Pure greetings
  if (/^(hello|hi|hey|howdy|yo|sup|greetings|hi there|hello there|hey there)([^a-z]|$)/i.test(lower)) {
    if (historyLength === 0) {
      return `${timeGreeting}! I'm so glad you're here. I'm your JobBridge AI career assistant, and I'm here to help you make the most of your experience on the platform. Whether you're looking for your dream job, hoping to hire top talent, or wanting to showcase your professional services, I can guide you through every step. What brings you to JobBridge today?`;
    }
    return `Hello again! Great to see you back. How can I help you with JobBridge today?`;
  }

  // Time-based greetings
  if (/^good morning/i.test(lower)) {
    return `Good morning! I hope you're having a wonderful day. How can I assist you with JobBridge today?`;
  }
  if (/^good afternoon/i.test(lower)) {
    return `Good afternoon! I hope you're having a wonderful day. How can I assist you with JobBridge today?`;
  }
  if (/^good evening/i.test(lower)) {
    return `Good evening! I hope you're having a wonderful day. How can I assist you with JobBridge today?`;
  }

  // How are you / small talk
  if (/(how are you|how('s| is) it going|how are things|how('s| is) your day|how do you do|you good|you alright)/i.test(lower) && !/(how (much|many|to |do |can |does |would |will ))/i.test(lower)) {
    return `I'm doing great, thank you for asking! I'm energized and ready to help you navigate JobBridge and achieve your career or hiring goals. What would you like to explore today? You can ask me about finding jobs, posting vacancies, pricing, AI tools, or any other feature on the platform.`;
  }

  // Who are you / introduction
  if (/^(who are you|tell me about yourself|what can you do|what do you do|introduce your|what are you)\b/i.test(lower)) {
    return `I'm your JobBridge AI career assistant! Think of me as your personal guide to everything on JobBridge — Nigeria's number one professional network connecting job seekers, recruiters, and service providers.

Here is what I can help you with:
- Finding and applying to jobs that match your skills
- Understanding recruiter plans and posting job vacancies
- Navigating the AI Resume Studio with skills extraction, cover letter generation, and interview preparation
- Explaining pricing, subscriptions, and payment options
- Troubleshooting common issues
- Guiding you through any page or feature on the platform

I know every corner of JobBridge, so feel free to ask me anything! What would you like to learn about first?`;
  }

  // User sharing their role / situation
  if (/^i('m| am) (a |an |)(fresh graduate|graduate|job seeker|seeker|recruiter|recruiting|student|employer|business owner|freelancer|service provider|provider|hiring|hr professional|career changer|entry level)/i.test(lower)) {
    if (/fresh graduate|student|graduate|entry level|just finished|just graduated|career changer/i.test(lower)) {
      return `That's wonderful, and welcome to the JobBridge community! Starting your career journey is an exciting time, and I'm here to help you every step of the way. I'd suggest beginning at the Jobs page at /jobs to explore what's out there. Also, the AI Resume Studio at /ai-resume can help you build a standout CV, generate cover letters, and practice interviews. What kind of roles or industries are you interested in?`;
    }
    if (/recruiter|hiring|hr/i.test(lower)) {
      return `Great to have you here as a recruiter! JobBridge gives you powerful tools to find top talent — from posting jobs with AI-optimized descriptions to our candidate ranking feature that scores applicants by match percentage. Head over to the Recruiter Dashboard at /recruiter to get started. Do you have any roles you're looking to fill right now?`;
    }
    if (/provider|freelancer|service/i.test(lower)) {
      return `Excellent, welcome! As a service provider, JobBridge gives you a marketplace to showcase your skills to potential clients across Nigeria. I'd recommend starting at /providers to set up your profile and explore the categories. You can also check out the Featured Professional plan at /pricing for premium visibility. What services do you offer?`;
    }
    return `Nice to meet you! JobBridge has a lot to offer someone in your position. Feel free to ask me about any feature, and I'll guide you through it. What would you like to explore first?`;
  }

  // Tell me more / follow-up
  if (/^(tell me more|go on|continue|say more|what else|can you elaborate|elaborate|explain further|go deeper|i('d| would) like to know more|give me more details|expand|dig deeper)/i.test(lower)) {
    return `I'd love to go deeper! What aspect of JobBridge are you most curious about? You can ask me about specific pages like the Jobs page, Recruiter Dashboard, AI Resume Studio, or any feature you'd like to understand better.`;
  }

  // I don't understand
  if (/^(i (don't|do not) understand|i('m| am) (confused|lost)|can you clarify|clarify|what do you mean|that doesn't make sense|i don't get it|can you explain|explain it|explain again|simpler)/i.test(lower)) {
    return `I'm sorry if I wasn't clear enough! Let me try to help. Could you let me know what you're trying to do on JobBridge, and I'll explain it in a simple, step-by-step way? For example, are you looking to find a job, post a vacancy, use AI tools for your resume, or something else?`;
  }

  // Encouragement / confusion about careers
  if (/(i('m| am) (tired|frustrated|overwhelmed|discouraged|stressed|lost|struggling)|this is (hard|difficult|tough|challenging)|finding a job is (hard|difficult|tough)|i keep getting rejected)/i.test(lower)) {
    return `I hear you, and I want you to know that what you're feeling is completely valid. The job search journey can be challenging, but you don't have to go through it alone. JobBridge is designed to make things easier — from our AI-powered resume tools that help your application stand out, to personalized job matching. Let's take it one step at a time. What's the biggest challenge you're facing right now? I'd love to help.`;
  }

  // What should I do / advice
  if (/^(what should i do|any (advice|tips|suggestions)|what do you (recommend|suggest)|give me (advice|tips|some guidance)|how can i (improve|get started|find|get))/i.test(lower) && !/(how (to|can i|do i) (find|apply|post|create|make|use))/i.test(lower)) {
    return `I'd be happy to help guide you! The best place to start depends on what you're hoping to achieve on JobBridge. Are you looking to find a job, hire talent, offer your services, or promote your business? Let me know and I'll point you to exactly what you need!`;
  }

  // That's helpful / positive reactions
  if (/^(that('s| is) (helpful|great|good|awesome|perfect|exactly what i needed|useful)|good to know|makes sense|i (see|understand|get it)|sounds (good|great)|got it|okay|alright|nice|awesome|perfect|that helps)/i.test(lower)) {
    return `I'm really glad that helped! Is there anything else you'd like to know about JobBridge? Don't hesitate to ask — I'm here for you.`;
  }

  // Expressing interest in a feature
  if (/(that sounds (interesting|useful|helpful|good)|i('d| would) like to (try|use|see|explore)|this is (what i need|exactly what i('m| was) looking for))/i.test(lower)) {
    return `That's great to hear! Whenever you're ready to dive in, just let me know and I'll walk you through it step by step. Is there a particular feature you'd like to explore first?`;
  }

  // Thanks / gratitude
  if (/^(thanks|thank you|thank|appreciate it|thanks a lot|thx|thank you so much|much appreciated|i appreciate)/i.test(lower)) {
    return `You're most welcome! I'm always here whenever you need assistance with JobBridge. Is there anything else I can help you with today?`;
  }

  // Goodbye
  if (/^(bye|goodbye|see you|see ya|farewell|later|gotta go|take care|catch you|talk later|until next time)/i.test(lower)) {
    return `It was a pleasure chatting with you! Feel free to come back anytime you need help with JobBridge. Wishing you the very best in your career journey — you've got this!`;
  }

  // Compliments
  if (/^(you('re| are) (great|awesome|helpful|amazing|the best|wonderful|fantastic|kind|so helpful|incredible)|i love you|you rock|you are so)/i.test(lower)) {
    return `That truly means a lot — thank you! I'm here to make your experience on JobBridge as smooth and rewarding as possible. Is there anything else I can help you with?`;
  }

  // Never mind / forget it
  if (/^(never mind|forget it|forget about it|don't worry|not (really|right now)|nothing|no thanks|maybe later)/i.test(lower)) {
    return `No worries at all! If you ever have any questions about JobBridge in the future, I'll be right here. Just say hello whenever you need me!`;
  }

  return null;
}

// ─── Fallback answer helpers ────────────────────────────────────

function extractSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
}

function getStructuredAnswer(question: string, section: KnowledgeSection, maxParas: number = 3): string {
  const content = section.content;
  const paragraphs = content.split(/\n{2,}/);
  const q = question.toLowerCase();

  // For comprehensive questions, return ALL relevant paragraphs
  const isComprehensive = /^(tell me about|describe|explain|what (is|are|does) (all|everything|the|a|an))/i.test(q) || q.length < 8;
  const limit = isComprehensive ? Math.max(maxParas, 8) : maxParas;

  const relevantParas = paragraphs.filter(p => {
    const qWords = q.split(/\s+/).filter(w => w.length > 2);
    return qWords.length === 0 || qWords.some(w => p.toLowerCase().includes(w));
  });
  if (relevantParas.length > 0) {
    return relevantParas.slice(0, limit).join('\n\n');
  }
  const sents = extractSentences(content.replace(/###.*/g, '').trim());
  if (sents.length >= 3) return sents.slice(0, limit + 2).join(' ');
  return content.split(/\.\s+/).slice(0, limit + 2).join('. ') + '.';
}

function combineComprehensiveAnswer(question: string, topSections: { section: KnowledgeSection; score: number }[]): string {
  const parts: string[] = [];
  const addedTitles = new Set<string>();

  for (const item of topSections.slice(0, 4)) {
    if (addedTitles.has(item.section.title)) continue;
    addedTitles.add(item.section.title);

    const content = getStructuredAnswer(question, item.section, 6);
    if (content && content.length > 20) {
      parts.push(content);
    }
  }

  if (parts.length === 0) {
    return getStructuredAnswer(question, topSections[0].section, 8);
  }

  return parts.join('\n\n');
}

function buildFallbackAnswer(
  question: string,
  topSections: { section: KnowledgeSection; score: number }[],
): string {
  const best = topSections[0];
  const q = question.toLowerCase().trim();
  const parts: string[] = [];

  // Detect question type with more granularity
  const isHow = /^(how (to|do|can|does)|how do (i|you)|steps? to|guide|walk me through|what are the steps|tell me how)/i.test(q);
  const isWhat = /^(what|what is|what are|what does|whats|tell me about|describe|explain)/i.test(q) && !isHow;
  const isCompare = /(differe|vs|versus|compare|or |which (is better|should|one))/i.test(q);
  const isYesNo = /^(can (i|you)|is |are |does |do |will |should |has |was |did )/i.test(q) && !isHow;
  const isList = /^(list|what are the|name|types? of|categories? of|examples of|kinds of)/i.test(q);
  const isPrice = /(how much|cost|price|fee|pay|pricing|how many naira|naira|subscription cost|plan cost)/i.test(q);
  const isLocation = /(where|location|address|find|accessible|available in|country|region|which page|what page)/i.test(q);
  const isWhy = /^why/i.test(q);
  const isWhen = /^when/i.test(q);

  // Build conversational opening
  const warmOpeners: Record<string, string> = {
    how: "I'd be happy to walk you through that! Here's how to do it on JobBridge:",
    what: "Great question! Let me share what I know about that.",
    compare: "Let me break down the differences for you:",
    yesno: "",
    list: "",
    price: "Here's what you need to know about pricing:",
    default: "Here's what I found about that:",
  };

  // Build the answer
  if (isHow) {
    parts.push(warmOpeners.how);
    const sents = extractSentences(best.section.content);
    const steps = sents.filter(s => /^\d+[\)\.]|click|go to|select|enter|choose|fill|upload|submit/i.test(s));
    if (steps.length >= 2) {
      parts.push(steps.slice(0, 8).map(s => s.trim().replace(/^\d+[\)\.]\s*/, '')).join('\n'));
      const extra = sents.filter(s => !/click|go to|select|enter|choose|fill|upload|submit/i.test(s)).slice(0, 2);
      if (extra.length) parts.push(extra.join('\n'));
    } else {
      parts.push(getStructuredAnswer(question, best.section, 5));
    }
  } else if (isCompare) {
    parts.push(warmOpeners.compare);
    const allContent = topSections.slice(0, 3).map(s => {
      const first = extractSentences(s.section.content)[0] || s.section.content.split(/\./)[0];
      return `- ${s.section.title}: ${first.trim()}`;
    }).join('\n');
    parts.push(allContent || getStructuredAnswer(question, best.section, 5));
  } else if (isYesNo) {
    const positiveIndicators = /(yes|can|is |are|does|available|supported|free|welcome|allowed|enabled)/i;
    const contentStart = best.section.content.slice(0, 300);
    const isPositive = positiveIndicators.test(contentStart) && !/cannot|do not|does not|is not|are not|not available|not supported/i.test(contentStart);
    parts.push(isPositive ? 'Yes, that is available on JobBridge.' : 'Here is what I found:');
    parts.push(getStructuredAnswer(question, best.section, 4));
  } else if (isList) {
    const items = best.section.content.match(/[-*•]\s+[^\n]+/g);
    if (items && items.length >= 2) {
      parts.push(items.slice(0, 10).join('\n'));
    } else {
      const sents = extractSentences(best.section.content.replace(/###.*/g, ''));
      parts.push(sents.slice(0, 6).join('\n'));
    }
  } else if (isPrice) {
    parts.push(warmOpeners.price);
    const priceSents = best.section.content.match(/[^.!?]*(₦|Naira|naira)[^.!?]*[.!?]/g);
    if (priceSents && priceSents.length > 0) {
      parts.push(priceSents.slice(0, 10).join('\n'));
    } else {
      parts.push(getStructuredAnswer(question, best.section, 5));
    }
  } else if (isWhat) {
    // For "tell me about" and comprehensive questions, combine multiple related sections
    const isComprehensive = /^(tell me about|describe|explain|what (is|are) (all|everything|the|a|an))/i.test(q);
    if (isComprehensive && topSections.length > 1) {
      parts.push(combineComprehensiveAnswer(question, topSections));
    } else {
      parts.push(getStructuredAnswer(question, best.section, 6));
    }
  } else if (isLocation) {
    parts.push(getStructuredAnswer(question, best.section, 5));
  } else if (isWhy) {
    parts.push(warmOpeners.default);
    parts.push(getStructuredAnswer(question, best.section, 5));
  } else if (isWhen) {
    parts.push(warmOpeners.default);
    parts.push(getStructuredAnswer(question, best.section, 4));
  } else {
    parts.push(warmOpeners.default);
    parts.push(getStructuredAnswer(question, best.section, 4));
  }

  // Add related sections (for richer context, but skip if already comprehensive)
  if (topSections.length > 1 && !isCompare && !isWhat) {
    const extra = topSections.slice(1, 3).map(s => {
      const firstSent = extractSentences(s.section.content)[0] || '';
      return firstSent ? `- ${s.section.title}: ${firstSent.trim()}` : '';
    }).filter(Boolean).join('\n');
    if (extra) {
      parts.push(`\nRelated information:\n${extra}`);
    }
  }

  // Add relevant page links
  const allPages = [...new Set(topSections.flatMap(s => s.section.pages))].filter(Boolean).slice(0, 3);
  if (allPages.length > 0) {
    parts.push(`\nFor more details, visit: ${allPages.join(', ')}`);
  }

  parts.push(`\nFor more help, email jobbridgesupport@gmail.com`);

  return parts.join('\n\n');
}

// ─── Public API ─────────────────────────────────────────────────

export async function streamAnswer(
  question: string,
  conversationId: string,
  cb: StreamCallbacks,
): Promise<void> {
  const { onToken, onSources, onError, onPhase, onDone } = cb;

  const noApiKey = !API_KEY;
  if (noApiKey) {
    onPhase('Searching knowledge base...');
  }

  const questionClean = sanitize(question);

  if (!questionClean) {
    onError('Please enter a valid question.');
    return;
  }

  if (!rateLimit.allow()) {
    onError('Please wait a moment between questions.');
    return;
  }

  const pagePath = window.location.pathname.replace(/\/$/, '') || '/';

  try {
    const history = getConversation(conversationId);

    // Check for conversational input first — greetings, introductions, thanks, etc.
    const greetingResponse = buildConversationalResponse(questionClean, history.length);
    if (greetingResponse) {
      const updatedHistory: HistoryMsg[] = [
        ...history,
        { role: 'user', content: questionClean },
        { role: 'assistant', content: greetingResponse },
      ];
      saveConversation(conversationId, updatedHistory);
      onDone(greetingResponse, []);
      return;
    }

    onPhase('Analyzing your question...');

    onPhase('Searching knowledge base...');
    const sections = retrieveRelevant(questionClean, pagePath);

    if (sections.length === 0) {
      onError("I couldn't find relevant information in the knowledge base. Try rephrasing your question or contact jobbridgesupport@gmail.com for help.");
      return;
    }

    const sourceList = sections.map(s => ({ id: s.id, title: s.title }));
    onSources(sourceList);

    const contextStr = trimContext(sections);
    const pageCtx = currentPageContext();

    if (noApiKey) {
      const scored = KB.map(s => ({
        section: s,
        score: scoreSection(s, questionClean, pagePath),
      }));
      scored.sort((a, b) => b.score - a.score);
      const topSections = scored.filter(s => s.score > 0).slice(0, TOP_K);

      if (topSections.length === 0) {
        onError("I couldn't find relevant information. Try rephrasing your question or contact jobbridgesupport@gmail.com for help.");
        return;
      }

      const showSources = topSections.map(s => ({ id: s.section.id, title: s.section.title }));

      const fullText = buildFallbackAnswer(questionClean, topSections);

      const updatedHistory: HistoryMsg[] = [
        ...history,
        { role: 'user', content: questionClean },
        { role: 'assistant', content: fullText },
      ];
      saveConversation(conversationId, updatedHistory);
      onDone(fullText, showSources);
      return;
    }

    onPhase('Generating response...');

    const systemPrompt = buildSystemPrompt(contextStr, pageCtx, history);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: questionClean },
    ];

    let fullText = '';
    await streamLLM(messages, (token) => {
      fullText += token;
      onToken(token);
    });

    const updatedHistory: HistoryMsg[] = [
      ...history,
      { role: 'user', content: questionClean },
      { role: 'assistant', content: fullText },
    ];
    saveConversation(conversationId, updatedHistory);

    onDone(fullText, sourceList);
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('401')) {
      onError('OpenAI API key is invalid. Please check your VITE_OPENAI_API_KEY.');
    } else if (msg.includes('429') || msg.includes('rate')) {
      onError('The AI service is temporarily busy. Please try again in a few seconds.');
    } else if (msg.includes('fetch') || msg.includes('network')) {
      onError('Network error. Check your internet connection and try again.');
    } else {
      onError(`Something went wrong: ${msg || 'unexpected error'}. Please try again.`);
    }
  }
}

// ─── No-op prewarm (embeddings no longer needed) ────────────────

export function prewarmEmbeddings(): void {
  // Embeddings removed — retrieval is instant via keyword/tag matching
}
