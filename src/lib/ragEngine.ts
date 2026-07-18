import KB, { type KnowledgeSection } from "./jobbridgeKnowledge";
import { aiChat, aiChatStream, aiEmbed } from "./aiBackend";

// ══════════════════════════════════════════════════════════════════
//  MODEL CONFIGURATION
// ══════════════════════════════════════════════════════════════════

// All AI operations are now handled through the secure backend.
// API keys are server-side only and never exposed to the client.
const LLM_MODEL = "gpt-4o-mini";

const TOP_K = 8;
const MAX_HISTORY = 30;
const MAX_INPUT_LENGTH = 2000;
const MIN_INTERVAL_MS = 800;
const MAX_CALLS_PER_WINDOW = 30;
const WINDOW_MS = 60000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000;
const MAX_CONTEXT_LENGTH = 12000;
const CACHE_CONV_KEY = "jb_conv_";

export type IntentType =
  | "home"
  | "pricing"
  | "payment"
  | "jobs"
  | "my-jobs"
  | "recruiter"
  | "profile"
  | "ai-resume"
  | "profile-visibility"
  | "job-preferences"
  | "notifications"
  | "messages"
  | "business"
  | "providers"
  | "blog"
  | "blog-detail"
  | "about"
  | "ceo"
  | "support"
  | "contact"
  | "games"
  | "privacy"
  | "career"
  | "signup"
  | "login"
  | "analytics"
  | "following"
  | "reviews"
  | "talent-search"
  | "services"
  | "revenue"
  | null;

// ─── COMPREHENSIVE INTENT → PAGE ROUTER ─────────────────────────
// Maps ANY user phrasing to the correct JobBridge page using
// synonyms, misspellings, contextual phrases, and fuzzy matching.

const INTENT_SIGNATURES: Record<Exclude<IntentType, null>, {
  patterns: RegExp[];
  primaryRoute: string;
  title: string;
  description: string;
  synonyms: string[];
  contexts: string[];
}> = {
  home: {
    patterns: [
      /^(home|landing|main page|front page|what is jobbridge)\b/i,
      /what (is|does) jobbridge/i,
      /\b(platform overview|features)\b/i,
    ],
    primaryRoute: "/",
    title: "Home Page",
    description: "Platform overview, stats, featured jobs, CTA",
    synonyms: ["home", "landing", "main", "front page", "index"],
    contexts: ["platform overview", "what is this", "get started"],
  },
  pricing: {
    patterns: [
      /(price|pricing|plan|plans?|subscription|tier|cost|fee|fees|amount|how much|naira|ngn|pay for|buy|purchase|subscription plan)/i,
      /(basic|standard|premium|compare|what.*cost|recruiter plan|ai tool.*price)/i,
      /\bupgrade\b/i,
    ],
    primaryRoute: "/pricing",
    title: "Pricing Plans",
    description: "Recruiter plans, AI tools pricing, service provider plans, ad packages",
    synonyms: ["pricing", "plans", "subscription", "cost", "price", "premium"],
    contexts: ["how much", "buy plan", "subscription cost", "upgrade"],
  },
  payment: {
    patterns: [
      /(pay|payment|checkout|korapay|card|bank transfer|debit|credit card|verve|mastercard|visa|transaction|receipt|billing|invoice|pay for|make payment|payment method)/i,
    ],
    primaryRoute: "/payment",
    title: "Payment Page",
    description: "Card payment, USSD, bank transfer, KoraPay integration, payment activation",
    synonyms: ["payment", "pay", "checkout", "korapay", "transaction"],
    contexts: ["how to pay", "payment method", "card", "bank transfer"],
  },
  jobs: {
    patterns: [
      /(job|jobs|apply|application|find job|search job|browse job|hiring|open(ing|ings)|position|vacancy|career|work at|employment)/i,
      /(how to apply|candidate|recruiter|interview)/i,
    ],
    primaryRoute: "/jobs",
    title: "Jobs Page",
    description: "Browse jobs, search, filter, apply, save bookmarks",
    synonyms: ["jobs", "apply", "hiring", "vacancy", "position", "work"],
    contexts: ["find a job", "search jobs", "apply for job", "job listing"],
  },
  "my-jobs": {
    patterns: [
      /(my jobs|my application|applied|save job|bookmark|track|application status|my.*job|applied job|job tracker|where.*applied)/i,
    ],
    primaryRoute: "/my-jobs",
    title: "My Jobs Dashboard",
    description: "Track applications, saved jobs, interview status, archived jobs",
    synonyms: ["my jobs", "my applications", "applied jobs", "saved"],
    contexts: ["track application", "application status", "my saved jobs"],
  },
  recruiter: {
    patterns: [
      /(recruiter|post job|hire|manage job|edit job.*post|candidate.*score|ai.*rank|application.*panel|shortlist|hiring pipeline|candidate matching)/i,
    ],
    primaryRoute: "/recruiter",
    title: "Recruiter Dashboard",
    description: "Post jobs, AI candidate ranking, manage applications, job credits",
    synonyms: ["recruiter", "hire", "post job", "candidates"],
    contexts: ["recruiter dashboard", "post a job", "review applicants"],
  },
  profile: {
    patterns: [
      /(profile|my account|edit profile|update.*profile|personal info|bio|password|change.*password|delete.*account|danger.*zone|profile.*completeness|avatar|cover.*photo)/i,
    ],
    primaryRoute: "/profile",
    title: "Profile Page",
    description: "Personal info, professional details, account security, danger zone",
    synonyms: ["profile", "account", "edit profile", "my profile"],
    contexts: ["edit profile", "update info", "change password", "delete account"],
  },
  "ai-resume": {
    patterns: [
      /(ai resume|resume builder|cover letter|resume.*tailor|skills extraction|interview.*prep|ai.*cv|optimize.*resume|resume.*generator|build.*resume|resume tool)/i,
    ],
    primaryRoute: "/ai-resume",
    title: "AI Resume Studio",
    description: "Skills extraction, AI tailor resume, cover letter generator, interview prep",
    synonyms: ["ai resume", "resume", "cover letter", "interview prep"],
    contexts: ["build resume", "tailor resume", "generate cover letter"],
  },
  "profile-visibility": {
    patterns: [
      /(profile visibility|who can see|profile privacy|search visibility|hide.*profile|private.*profile|recruiter.*contact|activity.*status|visibility.*setting)/i,
    ],
    primaryRoute: "/profile-visibility",
    title: "Profile Visibility Settings",
    description: "Control who sees your profile, search visibility, recruiter contact",
    synonyms: ["profile visibility", "privacy", "visibility settings"],
    contexts: ["who can see my profile", "hide profile", "privacy controls"],
  },
  "job-preferences": {
    patterns: [
      /(job preference|work type|job.*alert|prefer.*work|remote|hybrid|on.?site|salary.*expect|industry.*prefer|function.*prefer)/i,
    ],
    primaryRoute: "/job-preferences",
    title: "Job Preferences",
    description: "Set preferred work type, location, salary expectations, job alerts",
    synonyms: ["job preferences", "work preferences", "job alerts"],
    contexts: ["set job preferences", "work type", "salary expectations"],
  },
  notifications: {
    patterns: [
      /(notification|alert|bell|notif|update.*alert|digest|job.*alert|notification.*setting|turn.*notification|.*notification.*on|.*notification.*off)/i,
    ],
    primaryRoute: "/notifications",
    title: "Notifications Page",
    description: "View and manage all notifications, job alerts, activity feed",
    synonyms: ["notifications", "alerts", "bell", "notifs"],
    contexts: ["check notifications", "notification settings", "job alerts"],
  },
  messages: {
    patterns: [
      /(message|inbox|chat|conversation|mail|dm|direct message|employer.*message|recruiter.*message|messaging)/i,
    ],
    primaryRoute: "/messages",
    title: "Messages / Inbox",
    description: "Conversation threads, chat with recruiters and providers",
    synonyms: ["messages", "inbox", "chat", "conversations"],
    contexts: ["check messages", "inbox", "recruiter messages"],
  },
  business: {
    patterns: [
      /(business|advert|advertisement|promote.*business|ad.*package|weekly.*ad|monthly.*ad|featured.*business|create.*advert|manage.*ad|business.*listing)/i,
    ],
    primaryRoute: "/business",
    title: "Business Advertisements",
    description: "Create ads, ad packages, manage advert campaigns, promote business",
    synonyms: ["business", "advert", "advertisement", "promote"],
    contexts: ["create advert", "advertise business", "ad packages"],
  },
  providers: {
    patterns: [
      /(service provider|provider|freelancer|professional service|hire.*provider|find.*service|service marketplace|become.*provider|offer.*service|specialty|consultant|engineer|designer|marketer)/i,
    ],
    primaryRoute: "/providers",
    title: "Service Providers",
    description: "Find and hire service providers, become a provider, marketplace",
    synonyms: ["providers", "freelancers", "services", "professionals"],
    contexts: ["find a provider", "hire freelancer", "become provider"],
  },
  blog: {
    patterns: [
      /(blog|article|career insight|read.*article|blog.*post|blog.*article|career.*advice|blog.*category|insight)/i,
    ],
    primaryRoute: "/blog",
    title: "Blog & Career Insights",
    description: "Career advice articles, AI in hiring, remote work tips",
    synonyms: ["blog", "articles", "career advice", "insights"],
    contexts: ["read blog", "career articles", "blog posts"],
  },
  "blog-detail": {
    patterns: [
      /(blog.*\d+|article.*\d+|read.*blog.*about|blog post about|article about)/i,
    ],
    primaryRoute: "/blog/",
    title: "Blog Article Detail",
    description: "Individual blog post with full content",
    synonyms: ["blog post", "article detail"],
    contexts: ["read specific article"],
  },
  about: {
    patterns: [
      /(about|about.*jobbridge|company|team|our story|who we are|what we do|about.*platform|about.*us)/i,
    ],
    primaryRoute: "/about",
    title: "About JobBridge",
    description: "Company story, core values, founding team, mission",
    synonyms: ["about", "company", "team", "our story"],
    contexts: ["about us", "company info", "team info"],
  },
  ceo: {
    patterns: [
      /(ceo|founder|victor.*eniola|ceo.*vision|founder.*message|leadership|ceo.*page|vision.*page|ceo.*message|founder.*story)/i,
    ],
    primaryRoute: "/ceo",
    title: "CEO Vision Page",
    description: "Victor Eniola's vision, founder journey, company milestones",
    synonyms: ["ceo", "founder", "victor eniola", "leadership"],
    contexts: ["ceo vision", "founder message", "leadership"],
  },
  support: {
    patterns: [
      /(support|help|faq|help center|customer support|question|problem|issue|how to|troubleshoot|common.*question|get help|need help)/i,
    ],
    primaryRoute: "/support",
    title: "Support & Help Center",
    description: "FAQ, troubleshooting, common questions, customer support",
    synonyms: ["support", "help", "faq", "help center"],
    contexts: ["get help", "faq", "customer support"],
  },
  contact: {
    patterns: [
      /(contact|contact.*us|reach.*us|email.*support|call.*us|send.*message|get in touch|contact.*form|phone|whatsapp)/i,
    ],
    primaryRoute: "/contact",
    title: "Contact Page",
    description: "Contact form, email, phone, WhatsApp support",
    synonyms: ["contact", "reach us", "get in touch"],
    contexts: ["contact support", "send message", "call us"],
  },
  games: {
    patterns: [
      /(game|memory.*game|card.*game|play.*game|quiz|fun|entertain|memory.*match|flip.*card|game.*zone|jobbridge.*game)/i,
    ],
    primaryRoute: "/games",
    title: "Games & Memory Card Game",
    description: "Memory matching game, job quiz, fun and entertainment",
    synonyms: ["games", "memory game", "quiz", "fun"],
    contexts: ["play games", "memory match", "quiz"],
  },
  privacy: {
    patterns: [
      /(privacy|data.*policy|data.*protect|gdpr|ndpr|personal.*data|cookie|privacy.*center|data.*collect|information.*collected|how.*data.*used|data.*share)/i,
    ],
    primaryRoute: "/privacy",
    title: "Privacy Center",
    description: "Data policy, privacy controls, GDPR, NDPR compliance",
    synonyms: ["privacy", "data policy", "gdpr"],
    contexts: ["privacy policy", "data protection", "cookies"],
  },
  career: {
    patterns: [
      /(career.*page|join.*jobbridge|work.*at.*jobbridge|career.*opportunity|job.*at.*jobbridge|jobbridge.*career|jobbridge.*hiring|work.*with.*us|join.*team)/i,
    ],
    primaryRoute: "/career",
    title: "Career Page (Join JobBridge)",
    description: "Career opportunities at JobBridge, coming soon notification",
    synonyms: ["career at jobbridge", "work at jobbridge", "join team"],
    contexts: ["jobs at jobbridge", "career opportunities"],
  },
  signup: {
    patterns: [
      /(sign.?up|register|create.*account|join|new.*account|become.*member|get.*started|sign.*up|registration)/i,
    ],
    primaryRoute: "/signup",
    title: "Sign Up",
    description: "Create account, registration, select role",
    synonyms: ["signup", "register", "create account", "join"],
    contexts: ["create account", "sign up", "register"],
  },
  login: {
    patterns: [
      /(login|sign.?in|log.*in|signin|welcome.*back|sign.*in|login.*page)/i,
    ],
    primaryRoute: "/login",
    title: "Sign In / Login",
    description: "Sign in to your JobBridge account",
    synonyms: ["login", "sign in", "log in"],
    contexts: ["sign in", "log in", "login"],
  },
  analytics: {
    patterns: [
      /(analytics|dashboard|insight|stat|metric|trend|report|platform.*analytics)/i,
    ],
    primaryRoute: "/analytics",
    title: "Analytics Page",
    description: "Platform analytics, insights, metrics",
    synonyms: ["analytics", "stats", "insights", "metrics"],
    contexts: ["view analytics", "platform stats"],
  },
  following: {
    patterns: [
      /(follow|following|connect|network|connection|follow.*company|follow.*user)/i,
    ],
    primaryRoute: "/following",
    title: "Following Page",
    description: "Companies and users you follow, connections",
    synonyms: ["following", "connections", "network"],
    contexts: ["who I follow", "my connections"],
  },
  reviews: {
    patterns: [
      /(review|rating|testimonial|feedback|rate|star.*review|review.*provider|review.*service)/i,
    ],
    primaryRoute: "/reviews",
    title: "Reviews Page",
    description: "Reviews and ratings for providers and services",
    synonyms: ["reviews", "ratings", "feedback", "testimonials"],
    contexts: ["leave review", "check ratings"],
  },
  "talent-search": {
    patterns: [
      /(talent.*search|find.*talent|search.*candidate|recruit.*talent|find.*candidate|search.*professional)/i,
    ],
    primaryRoute: "/talent-search",
    title: "Talent Search",
    description: "Search for talent, find candidates, recruit professionals",
    synonyms: ["talent search", "find talent", "search candidates"],
    contexts: ["find talent", "search candidates"],
  },
  services: {
    patterns: [
      /(services|service.*page|professional.*offer|service.*category|service.*list|request.*service|post.*service)/i,
    ],
    primaryRoute: "/services",
    title: "Services Page",
    description: "Professional services offered on the platform",
    synonyms: ["services", "service offerings"],
    contexts: ["view services", "request service"],
  },
  revenue: {
    patterns: [
      /(revenue|earning|income|payout|financial|profit|revenue.*page|my.*earning)/i,
    ],
    primaryRoute: "/revenue",
    title: "Revenue Page",
    description: "Earnings, payouts, financial summary",
    synonyms: ["revenue", "earnings", "income", "payouts"],
    contexts: ["my earnings", "revenue dashboard"],
  },
};

// ─── INTENT RESOLVER ────────────────────────────────────────────
// Resolves ANY user query to the most relevant JobBridge page.

function resolveIntent(query: string): {
  intent: IntentType;
  matches: IntentType[];
  confidence: number;
} {
  const q = query.toLowerCase().trim();
  if (!q) return { intent: null, matches: [], confidence: 0 };

  const scored: { intent: IntentType; score: number; route: string }[] = [];

  for (const [intentKey, signature] of Object.entries(INTENT_SIGNATURES)) {
    let score = 0;

    // Pattern matching
    for (const pattern of signature.patterns) {
      if (pattern.test(q)) {
        score += 15;
        break;
      }
    }

    // Synonym matching
    const synonymMatches = signature.synonyms.filter((s) => {
      const normalized = s.toLowerCase();
      return (
        q.includes(normalized) ||
        normalized.split(/\s+/).some((word) => q.includes(word))
      );
    }).length;
    score += synonymMatches * 5;

    // Context phrase matching
    const contextMatches = signature.contexts.filter((ctx) => {
      const words = ctx.toLowerCase().split(/\s+/);
      const matchedWords = words.filter((w) => q.includes(w));
      return matchedWords.length >= Math.ceil(words.length * 0.6);
    }).length;
    score += contextMatches * 8;

    // Word-level intersection
    const queryWords = new Set(q.split(/\s+/).filter((w) => w.length > 2));
    const signatureWords = new Set(
      [...signature.synonyms, ...signature.contexts]
        .join(" ")
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
    const intersection = [...queryWords].filter((w) => signatureWords.has(w))
      .length;
    score += intersection * 3;

    // Penalize very short but common matches (e.g., "job" matching many)
    if (
      score > 0 &&
      q.split(/\s+/).length <= 2 &&
      synonymMatches === 0 &&
      contextMatches === 0
    ) {
      score = Math.min(score, 10);
    }

    if (score > 0) {
      scored.push({ intent: intentKey as IntentType, score, route: signature.primaryRoute });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { intent: null, matches: [], confidence: 0 };
  }

  const topScore = scored[0].score;
  const matches = scored.filter((s) => s.score > 0).map((s) => s.intent);
  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);

  // Normalize confidence
  const confidence = Math.min(1, topScore / 50);

  return { intent: scored[0].intent, matches, confidence };
}

function getRouteForIntent(intent: IntentType): string {
  if (!intent) return "/";
  return INTENT_SIGNATURES[intent]?.primaryRoute || "/";
}

function getPageTitleForIntent(intent: IntentType): string {
  if (!intent) return "JobBridge";
  return INTENT_SIGNATURES[intent]?.title || "JobBridge";
}

function buildPageHint(intent: IntentType | null): string {
  if (!intent) return "";
  const route = getRouteForIntent(intent);
  const title = getPageTitleForIntent(intent);
  return `\n\nVisit ${route} to open the ${title} page on JobBridge.`;
}

// ─── PUBLIC EXPORTS ─────────────────────────────────────────────

export function resolveUserIntent(query: string): {
  intent: IntentType;
  primaryRoute: string;
  pageTitle: string;
  confidence: number;
  matches: string[];
} {
  const result = resolveIntent(query);
  return {
    intent: result.intent,
    primaryRoute: getRouteForIntent(result.intent),
    pageTitle: getPageTitleForIntent(result.intent),
    confidence: result.confidence,
    matches: result.matches.filter(Boolean) as string[],
  };
}

// ─── EXPORTED INTERFACES ─────────────────────────────────────────

export interface SourceInfo {
  id: string;
  title: string;
}

export interface AgentThought {
  toolName: string;
  status: "running" | "completed" | "failed";
  query?: string;
  output?: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onSources: (sources: SourceInfo[]) => void;
  onError: (err: string) => void;
  onPhase: (phase: string) => void;
  onThought?: (thought: AgentThought) => void;
  onAction?: (actionType: string, params: any) => void;
  onDone: (fullText: string, sources: SourceInfo[]) => void;
}

export interface PageState {
  currentPath: string;
  domSummary: string;
  userProfile?: any;
}

export function hasApiKey(): boolean {
  // API keys are handled server-side, so this always returns true
  // The backend will handle authentication and key validation
  return true;
}

export function getModelInfo(): { model: string; provider: string } {
  return {
    model: LLM_MODEL,
    provider: USE_DEEPSEEK ? "DeepSeek" : "OpenAI",
  };
}

// ══════════════════════════════════════════════════════════════════
//  RETRY HELPER (exponential backoff)
// ══════════════════════════════════════════════════════════════════

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429 || attempt === retries) return res;
    const delay =
      RETRY_BASE_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error("Unreachable");
}

// ══════════════════════════════════════════════════════════════════
//  INPUT SANITIZATION
// ══════════════════════════════════════════════════════════════════

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_INPUT_LENGTH);
}

// ══════════════════════════════════════════════════════════════════
//  CLIENT-SIDE RATE LIMITER
// ══════════════════════════════════════════════════════════════════

const rateLimit = (() => {
  let lastCall = 0;
  let callCount = 0;
  let windowStart = Date.now();
  return {
    allow(): boolean {
      const now = Date.now();
      if (now - windowStart > WINDOW_MS) {
        callCount = 0;
        windowStart = now;
      }
      if (now - lastCall < MIN_INTERVAL_MS) return false;
      if (callCount >= MAX_CALLS_PER_WINDOW) return false;
      lastCall = now;
      callCount++;
      return true;
    },
  };
})();

// ══════════════════════════════════════════════════════════════════
//  CONVERSATION MEMORY
// ══════════════════════════════════════════════════════════════════

type HistoryMsg = {
  role: "system" | "user" | "assistant" | "tool";
  name?: string;
  tool_call_id?: string;
  content: string | null;
  tool_calls?: any[];
};

function getConversation(convId: string): HistoryMsg[] {
  try {
    const raw = localStorage.getItem(CACHE_CONV_KEY + convId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversation(convId: string, msgs: HistoryMsg[]) {
  try {
    localStorage.setItem(
      CACHE_CONV_KEY + convId,
      JSON.stringify(msgs.slice(-MAX_HISTORY)),
    );
  } catch {}
}

export function clearConversation(convId: string) {
  try {
    localStorage.removeItem(CACHE_CONV_KEY + convId);
  } catch {}
}

// ══════════════════════════════════════════════════════════════════
//  KNOWLEDGE BASE SCORING & RETRIEVAL
// ══════════════════════════════════════════════════════════════════

function sectionMatchesIntent(
  section: KnowledgeSection,
  intent: IntentType,
): boolean {
  if (!intent) return true;

  const tags = section.tags.map((t) => t.toLowerCase());
  const pages = section.pages.map((p) => p.toLowerCase());
  const signaturePages =
    INTENT_SIGNATURES[intent]?.synonyms.map((s) => s.toLowerCase()) || [];

  return (
    tags.some((t) => signaturePages.some((sp) => t.includes(sp))) ||
    pages.some((p) => signaturePages.some((sp) => p.includes(sp))) ||
    INTENT_SIGNATURES[intent]?.patterns.some((pat) =>
      pat.test(section.title + " " + section.content.slice(0, 200)),
    ) ||
    false
  );
}

function scoreSection(
  section: KnowledgeSection,
  query: string,
  pagePath: string,
  detectedIntents: IntentType[],
): number {
  const lower = query.toLowerCase().trim();
  const queryWords = lower.split(/\s+/).filter((w) => w.length > 1);
  if (queryWords.length === 0) return 0;

  let score = 0;

  // Exact phrase match in keywords (weighted heavily)
  const phraseMatches = section.keywords.filter((kw) => {
    const kl = kw.toLowerCase();
    return kl.length > 3 && lower.includes(kl);
  }).length;
  score += phraseMatches * 12;

  // Word matches in keywords
  const keywordWords = new Set(
    section.keywords.flatMap((k) => k.toLowerCase().split(/\s+/)),
  );
  const exactKeywordMatches = queryWords.filter((w) =>
    keywordWords.has(w),
  ).length;
  score += exactKeywordMatches * 6;

  // Title matches
  const titleWords = section.title.toLowerCase().split(/\s+/);
  const titleMatches = queryWords.filter((w) => titleWords.includes(w)).length;
  score += titleMatches * 8;

  // Tag matches
  const tagMatches = section.tags.filter((t) => lower.includes(t)).length;
  score += tagMatches * 4;

  // Path context boost
  if (section.pages.includes(pagePath)) {
    score += 10;
  }

  // Intent match boost
  if (detectedIntents.length > 0) {
    const matched = detectedIntents.some((intent) =>
      sectionMatchesIntent(section, intent),
    );
    if (matched) score += 15;
  }

  // Content overlap
  const contentWords = (section.content + " " + section.title)
    .toLowerCase()
    .split(/\s+/);
  const contentWordSet = new Set(contentWords);
  const contentMatches = queryWords.filter(
    (w) => w.length > 2 && contentWordSet.has(w),
  ).length;
  score += contentMatches * 2;

  return Math.max(0, score);
}

function retrieveRelevant(
  question: string,
  pagePath: string,
): { sections: KnowledgeSection[]; detectedIntents: IntentType[] } {
  const trimmed = question.trim();
  if (!trimmed) return { sections: [], detectedIntents: [] };

  const { intent, matches } = resolveIntent(trimmed);
  const detectedIntents = [intent, ...matches].filter(Boolean) as IntentType[];

  const scored = KB.map((section) => ({
    section,
    score: scoreSection(section, trimmed, pagePath, detectedIntents),
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { sections: [], detectedIntents };

  // Prefer sections matching detected intents
  const intentFiltered = detectedIntents.length
    ? scored.filter((s) =>
        detectedIntents.some((i) => sectionMatchesIntent(s.section, i)),
      )
    : scored;

  const finalList = intentFiltered.length > 0 ? intentFiltered : scored;

  return {
    sections: finalList.slice(0, TOP_K).map((s) => s.section),
    detectedIntents,
  };
}

function trimContext(sections: KnowledgeSection[]): string {
  let combined = "";
  for (const s of sections) {
    const block = `## ${s.title}\n${s.content}\n\n---\n\n`;
    if ((combined + block).length > MAX_CONTEXT_LENGTH) break;
    combined += block;
  }
  return (
    combined ||
    (sections.length > 0
      ? `## ${sections[0].title}\n${sections[0].content}`
      : "")
  );
}

// ══════════════════════════════════════════════════════════════════
//  CONVERSATIONAL / FALLBACK RESPONSES (when no API key)
// ══════════════════════════════════════════════════════════════════

function buildConversationalResponse(
  input: string,
  historyLength: number,
): string | null {
  const lower = input.toLowerCase().trim();
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const detected = resolveIntent(lower);
  const pageHint = buildPageHint(detected.intent);

  if (/^what is jobbridge\??$/i.test(lower)) {
    return `JobBridge is Nigeria's professional network for job seekers, recruiters, and service providers. It helps people find jobs, hire talent, and grow careers in one platform.${pageHint || "\n\nVisit / to explore the JobBridge homepage."}`;
  }

  if (
    /^(hello|hi|hey|greetings|hi there|hello there|hey there)([^a-z]|$)/i.test(
      lower,
    )
  ) {
    if (historyLength === 0) {
      return `${timeGreeting}. I am your JobBridge AI Career Agent powered by ${USE_DEEPSEEK ? "DeepSeek V4 Flash" : "advanced AI"}. I have deep knowledge of all JobBridge pages and can navigate you anywhere. How can I help you today?`;
    }
    return "Hello again. I am ready to help you with any JobBridge page or task.";
  }

  if (
    /^(who are you|what do you do|what are your features|introduce yourself)/i.test(
      lower,
    )
  ) {
    return `I am the JobBridge AI Career Agent (powered by ${USE_DEEPSEEK ? "DeepSeek V4 Flash" : "advanced AI"}). I can:\n- Guide you to any JobBridge page\n- Explain features, pricing, and how-to guides\n- Help with profile, jobs, recruiter tools\n- Detect what you need and route you there\n- Answer questions about the platform`;
  }

  if (/^(thanks|thank you|appreciate it)/i.test(lower)) {
    return "You are welcome. Let me know if you need anything else — I can navigate you to any JobBridge page instantly.";
  }

  if (/^(navigate|go to|take me to|open|show me|i want to see|route me|where is|find me)\s+(.+)/i.test(lower)) {
    const match = lower.match(/^(?:navigate|go to|take me to|open|show me|i want to see|route me|where is|find me)\s+(.+)/i);
    if (match) {
      const destination = match[1].trim();
      const detected2 = resolveIntent(destination);
      if (detected2.intent && detected2.confidence > 0.3) {
        return `Navigating you to the ${getPageTitleForIntent(detected2.intent)} now.${buildPageHint(detected2.intent)}`;
      }
    }
  }

  return null;
}

function cleanAssistantText(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,2}/g, "")
    .replace(/^Related topics[^]*$/gim, "")
    .replace(/^Relevant pages:[^]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getStructuredAnswer(
  question: string,
  section: KnowledgeSection,
): string {
  const blocks = section.content.split(/\n{2,}/);
  return cleanAssistantText(blocks.slice(0, 3).join("\n\n"));
}

function buildFallbackAnswer(
  question: string,
  topSections: KnowledgeSection[],
  detectedIntents: IntentType[],
): string {
  const best = topSections[0];
  const pageRoute =
    detectedIntents.length > 0 ? getRouteForIntent(detectedIntents[0]) : null;
  const pageTitle =
    detectedIntents.length > 0
      ? getPageTitleForIntent(detectedIntents[0])
      : best.title;
  const summary = getStructuredAnswer(question, best);
  const pageHint = pageRoute
    ? `\n\nRecommended page: ${pageTitle} (${pageRoute})`
    : "";
  const nextStep = pageRoute
    ? `\n\nWhat to do next: Open ${pageRoute} to continue on the ${pageTitle} page and find the exact information or action you need.`
    : "";
  const text = `Answer for ${pageTitle} on JobBridge:\n\n${summary}${pageHint}${nextStep}`;
  return cleanAssistantText(text);
}

// ══════════════════════════════════════════════════════════════════
//  CHAIN-OF-THOUGHT SYSTEM PROMPT (DeepSeek-level reasoning)
// ══════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are the JobBridge AI Career Agent — an intelligent reasoning assistant for the JobBridge platform. Your reasoning depth is modeled after DeepSeek V4 Flash: you think step-by-step, consider multiple interpretations, and only then produce your final answer.

Core reasoning process (always follow internally before answering):
1. UNDERSTAND: Parse what the user's underlying need is. Do they want information? Navigation? Form help? Troubleshooting?
2. DETECT: Use the intent resolution system to find the most relevant JobBridge page(s). Map their words — even indirect phrasing — to the correct feature or page.
3. RETRIEVE: Search the knowledge base for facts about the requested topic. Prefer exact knowledge over invention.
4. REASON: Connect the user's needs to the knowledge base. If they ask about "cost to hire people," reason that they need the Recruiter pricing page.
5. RESPOND: Give a precise, complete, professional answer. Include the page route when relevant.

Core rules:
1. Relevance first — answer ONLY what was asked. Do not pad with unrelated info.
2. Page routing — whenever the user wants a specific feature or action, clearly tell them the exact route path (e.g., /pricing, /jobs, /profile).
3. Page context — if pageState.currentPath is provided, center the response around that page and use its route in the answer. If the user is on a specific page, offer recommendations or instructions that match that page even if the wording is vague.
4. Knowledge base — use only facts from the knowledge base for plans, policies, payments. Never invent values.
5. Tone — professional, concise, helpful. Use plain text. No markdown headings (no ###), no hashtags.
6. Navigation — if the user says "I want to post a job," detect the Recruiter intent and guide them to /recruiter. If they say "show me pricing," guide them to /pricing.
7. Multi-intent queries — if the user asks about multiple things (e.g., "pricing and how to apply"), address both separately.
8. Actions — when you use navigate_to_page or autofill_form, mention what action was completed.
9. Page details — when the active page is known, prioritize it and do not answer as if the user were on a generic help page.
`;

const FINAL_SYSTEM_PROMPT = `Write the final response for the user now.

Requirements:
- Be directly relevant to the user's exact question. No padding.
- If the user seems to want a specific page, include the route path.
- Use plain professional text only.
- No markdown headings, hashtags, or asterisks.
- If an action was performed (navigation, autofill), mention it briefly.
- Keep it concise but complete — the user should have everything they need.`;

// ══════════════════════════════════════════════════════════════════
//  LLM CHAT COMPLETION (streaming)
// ══════════════════════════════════════════════════════════════════

async function streamLLM(
  messages: HistoryMsg[],
  onToken: (token: string) => void,
): Promise<string> {
  // Call the backend AI service (which handles OpenAI/DeepSeek internally)
  const messageList = messages.map((m) => ({
    role: m.role,
    name: m.name,
    tool_call_id: m.tool_call_id,
    content: m.content,
  }));

  return await aiChatStream(messageList, onToken);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content || "";
        if (token) {
          full += token;
          onToken(token);
        }
      } catch {}
    }
  }

  return full;
}

// ══════════════════════════════════════════════════════════════════
//  AGENTIC REASONING LOOP with Tool Calling
// ══════════════════════════════════════════════════════════════════

async function runAgenticLoop(
  messages: HistoryMsg[],
  pageState: PageState,
  conversationId: string,
  cb: StreamCallbacks,
): Promise<void> {
  const { onToken, onSources, onError, onPhase, onThought, onAction, onDone } =
    cb;

  // First, resolve intent from the user's message to guide the agent
  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  const userQuery = lastUserMsg?.content || "";
  const resolvedIntent = resolveUserIntent(userQuery);
  const detectedIntent = resolvedIntent.intent;
  const primaryRoute = resolvedIntent.primaryRoute;

  const tools = [
    {
      type: "function",
      function: {
        name: "search_knowledge_base",
        description:
          "Queries the comprehensive JobBridge knowledge base for FAQs, pricing details, candidate matching metrics, and step-by-step guides for any feature across all 30+ pages.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "The topic, FAQ question, or keyword phrase to query. Be specific.",
            },
            intent: {
              type: "string",
              description:
                "Optional: the detected intent to narrow results (e.g., 'pricing', 'jobs', 'profile').",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "inspect_current_page_context",
        description:
          "Inspects what the user is looking at right now, including visible text, page headings, form fields, loaded items, buttons, and profile details. Use to understand what the user sees.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "navigate_to_page",
        description:
          "Redirects the user to a specific JobBridge page. Use whenever the user wants to visit a feature, make a purchase, or access a tool. Detects the correct page even from vague descriptions.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "The route path (e.g., '/pricing', '/payment', '/ai-resume', '/jobs', '/profile', '/recruiter', '/business', '/providers', '/blog', '/support', '/about', '/ceo', '/games', '/messages', '/notifications', '/signup', '/login').",
            },
            reason: {
              type: "string",
              description: "Brief explanation of why you are navigating there.",
            },
          },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "resolve_and_navigate",
        description:
          "Intelligently resolves what the user is looking for and navigates them to the correct page. Use when the user asks where something is or expresses a need that maps to a specific page.",
        parameters: {
          type: "object",
          properties: {
            userRequest: {
              type: "string",
              description: "The user's request or question.",
            },
          },
          required: ["userRequest"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "autofill_form_field",
        description:
          "Helps the user fill in fields on the active page's forms. Use when the user asks for help completing a form or entering information.",
        parameters: {
          type: "object",
          properties: {
            fieldSelector: {
              type: "string",
              description:
                "The form input element's label text, name attribute, or placeholder text.",
            },
            value: {
              type: "string",
              description: "The value to input into the field.",
            },
          },
          required: ["fieldSelector", "value"],
        },
      },
    },
  ];

  const loopMessages: HistoryMsg[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "system",
      content: `Current page context:
Active page path: ${pageState.currentPath}
Visible page content summary:
${pageState.domSummary || "No page context available."}`,
    },
    ...messages,
  ];

  let step = 0;
  const maxSteps = 8;

  while (step < maxSteps) {
    step++;
    onPhase(detectedIntent ? `Analyzing for ${getPageTitleForIntent(detectedIntent)}...` : "Reasoning...");

    // Call backend AI service which handles OpenAI/DeepSeek internally
    const messageList = loopMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await aiChat(messageList);
      const json = { choices: [{ message: { content: result } }] };
    const assistantMsg = json.choices?.[0]?.message;

    if (!assistantMsg) {
      throw new Error("Empty assistant message from API");
    }

    // Check if assistant made tool calls
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      loopMessages.push({
        role: "assistant",
        content: null,
        tool_calls: assistantMsg.tool_calls,
      });

      for (const call of assistantMsg.tool_calls) {
        const name = call.function.name;
        const args = JSON.parse(call.function.arguments || "{}");
        let toolOutput = "";

        if (onThought) {
          onThought({
            toolName: name,
            status: "running",
            query: args.query || args.path || args.fieldSelector || args.userRequest,
          });
        }

        try {
          if (name === "search_knowledge_base") {
            onPhase(`Searching knowledge base for \"${args.query}\"...`);
            const { sections } = retrieveRelevant(
              args.query,
              pageState.currentPath,
            );
            toolOutput = trimContext(sections);

            const sourceList = sections.map((s) => ({
              id: s.id,
              title: s.title,
            }));
            onSources(sourceList);

            if (sections.length === 0) {
              toolOutput = "No relevant information found in the knowledge base for this query. Please ask the user to rephrase or contact support.";
            }
          } else if (name === "inspect_current_page_context") {
            onPhase("Inspecting page contents...");
            toolOutput = pageState.domSummary;
          } else if (name === "navigate_to_page") {
            onPhase(`Navigating to ${args.path}...`);
            if (onAction) {
              onAction("navigate", args);
            }
            toolOutput = `Redirected user to ${args.path}.`;
          } else if (name === "resolve_and_navigate") {
            onPhase(`Resolving \"${args.userRequest}\"...`);
            const resolved = resolveUserIntent(args.userRequest || userQuery);
            const route = resolved.primaryRoute;
            const title = resolved.pageTitle;

            if (resolved.intent && resolved.confidence > 0.3) {
              if (onAction) {
                onAction("navigate", { path: route });
              }
              toolOutput = `Based on analysis, the user is looking for the ${title} at ${route}. Navigated them there.`;
            } else {
              const { sections } = retrieveRelevant(
                args.userRequest || userQuery,
                pageState.currentPath,
              );
              toolOutput = trimContext(sections);
              if (!toolOutput) {
                toolOutput = "Could not determine which page the user needs. Ask them to clarify.";
              }
            }
          } else if (name === "autofill_form_field") {
            onPhase(`Auto-filling \"${args.fieldSelector}\"...`);
            if (onAction) {
              onAction("autofill", args);
            }
            toolOutput = `Autofilled field \"${args.fieldSelector}\" with value \"${args.value}\".`;
          }

          if (onThought) {
            onThought({
              toolName: name,
              status: "completed",
              query: args.query || args.path || args.fieldSelector || args.userRequest,
              output: toolOutput.slice(0, 150) + "...",
            });
          }
        } catch (toolErr: any) {
          toolOutput = `Error executing tool: ${toolErr.message || "unknown error"}`;
          if (onThought) {
            onThought({
              toolName: name,
              status: "failed",
              query: args.query || args.path || args.fieldSelector || args.userRequest,
            });
          }
        }

        loopMessages.push({
          role: "tool",
          name: name,
          tool_call_id: call.id,
          content: toolOutput,
        });
      }
    } else {
      // Assistant is ready to produce the final answer
      onPhase("Writing response...");

      const cleanedMessages = loopMessages.filter((m) => m.role !== "system");

      cleanedMessages.unshift({
        role: "system",
        content: FINAL_SYSTEM_PROMPT,
      });

      let finalContent = "";
      await streamLLM(cleanedMessages, (token) => {
        finalContent += token;
        onToken(token);
      });

      // Save to local storage history
      const savedMsgs = [
        ...messages,
        { role: "assistant" as const, content: finalContent },
      ];
      saveConversation(conversationId, savedMsgs);

      // Extract any sources from knowledge base calls in the loop
      const sourceInfo = extractSourcesFromLoop(loopMessages, pageState.currentPath, userQuery);

      onDone(cleanAssistantText(finalContent), sourceInfo);
      return;
    }
  }

  onError(
    "Agent reached the maximum reasoning steps. Please try rephrasing your question or visit jobbridgesupport@gmail.com.",
  );
}

function extractSourcesFromLoop(
  loopMessages: HistoryMsg[],
  currentPath: string,
  userQuery: string,
): SourceInfo[] {
  // Try to get sources from the last search_knowledge_base tool result
  const lastToolMsg = [...loopMessages]
    .reverse()
    .find(
      (m) =>
        m.role === "tool" && m.name === "search_knowledge_base" && m.content,
    );

  if (lastToolMsg?.content && lastToolMsg.content.length > 50) {
    // Extract section titles from tool output
    const { sections } = retrieveRelevant(userQuery, currentPath);
    return sections.map((s) => ({ id: s.id, title: s.title }));
  }

  return [];
}

// ══════════════════════════════════════════════════════════════════
//  PUBLIC ENTRY POINT
// ══════════════════════════════════════════════════════════════════

export async function streamAnswer(
  question: string,
  conversationId: string,
  cb: StreamCallbacks,
  pageState: PageState,
): Promise<void> {
  const { onToken, onSources, onError, onPhase, onDone } = cb;
  const questionClean = sanitize(question);

  if (!questionClean) {
    onError("Please enter a valid message.");
    return;
  }

  if (!rateLimit.allow()) {
    onError("Please wait a moment before sending another message.");
    return;
  }

  // Pre-resolve the user's intent to set the right context
  const intentResult = resolveUserIntent(questionClean);

  try {
    const history = getConversation(conversationId);

    // 1. Direct conversational responses (greetings/thanks/simple navigation)
    const greetResponse = buildConversationalResponse(
      questionClean,
      history.length,
    );
    if (greetResponse) {
      // If it's a navigation request, trigger the action
      const navMatch = questionClean.match(/^(?:navigate|go to|take me to|open|show me|i want to see|route me)\s+(.+)/i);
      if (navMatch && intentResult.intent && intentResult.confidence > 0.3 && cb.onAction) {
        cb.onAction("navigate", { path: intentResult.primaryRoute });
      }

      const updatedHistory: HistoryMsg[] = [
        ...history,
        { role: "user", content: questionClean },
        { role: "assistant", content: greetResponse },
      ];
      saveConversation(conversationId, updatedHistory);
      onDone(cleanAssistantText(greetResponse), []);
      return;
    }

    // 2. Local fallback mode if no API key is set
    if (!LLM_API_KEY) {
      onPhase("Searching knowledge base...");
      const { sections, detectedIntents } = retrieveRelevant(
        questionClean,
        pageState.currentPath,
      );

      if (sections.length === 0) {
        // Try a broader search
        onError(
          "I couldn't find exact matches in my knowledge base. Please try rephrasing or email jobbridgesupport@gmail.com.",
        );
        return;
      }

      onSources(
        sections.map((s) => ({ id: s.id, title: s.title })),
      );

      const pageRoute =
        detectedIntents.length > 0
          ? getRouteForIntent(detectedIntents[0])
          : null;

      const textResponse = buildFallbackAnswer(
        questionClean,
        sections,
        detectedIntents,
      );

      const responseWithNav = textResponse;

      const updatedHistory: HistoryMsg[] = [
        ...history,
        { role: "user", content: questionClean },
        { role: "assistant", content: responseWithNav },
      ];
      saveConversation(conversationId, updatedHistory);
      onDone(
        cleanAssistantText(responseWithNav),
        sections.map((s) => ({ id: s.id, title: s.title })),
      );
      return;
    }

    // 3. Agentic loop execution with DeepSeek / OpenAI
    const userMessage: HistoryMsg = { role: "user", content: questionClean };
    const messages = [...history, userMessage];

    await runAgenticLoop(messages, pageState, conversationId, cb);
  } catch (err: any) {
    const msg = err?.message || "";
    if (msg.includes("401")) {
      onError(
        `The ${USE_DEEPSEEK ? "DeepSeek" : "OpenAI"} API key is invalid. Please verify your VITE_${USE_DEEPSEEK ? "DEEPSEEK" : "OPENAI"}_API_KEY environment variable.`,
      );
    } else if (msg.includes("429")) {
      onError("Rate limit exceeded. Please try again in a few moments.");
    } else {
      onError(`I encountered an error: ${msg || "unexpected issue"}. Please try again.`);
    }
  }
}

// ─── NO-OP PREWARM ──────────────────────────────────────────────

export function prewarmEmbeddings(): void {
  // No-op
}
