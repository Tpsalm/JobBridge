import KB, { type KnowledgeSection } from './jobbridgeKnowledge';

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const LLM_MODEL = 'gpt-4o-mini'; // Can be upgraded to 'gpt-4o' if available
const TOP_K = 8;
const MAX_HISTORY = 25;
const MAX_INPUT_LENGTH = 1000;
const MIN_INTERVAL_MS = 1000;
const MAX_CALLS_PER_WINDOW = 25;
const WINDOW_MS = 60000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000;
const MAX_CONTEXT_LENGTH = 8000;
const CACHE_CONV_KEY = 'jb_conv_';

export interface SourceInfo {
  id: string;
  title: string;
}

export interface AgentThought {
  toolName: string;
  status: 'running' | 'completed' | 'failed';
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

type HistoryMsg = { role: 'system' | 'user' | 'assistant' | 'tool'; name?: string; tool_call_id?: string; content: string | null; tool_calls?: any[] };

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

// ─── Scoring logic ──────────────────────────────────────────────

function scoreSection(section: KnowledgeSection, query: string, pagePath: string): number {
  const lower = query.toLowerCase().trim();
  const queryWords = lower.split(/\s+/).filter(w => w.length > 1);
  if (queryWords.length === 0) return 0;

  let score = 0;

  // Exact phrase match in keywords
  const phraseMatches = section.keywords.filter(kw => {
    const kl = kw.toLowerCase();
    return kl.length > 3 && lower.includes(kl);
  }).length;
  score += phraseMatches * 8;

  // Word matches in keywords
  const keywordWords = new Set(section.keywords.flatMap(k => k.toLowerCase().split(/\s+/)));
  const exactKeywordMatches = queryWords.filter(w => keywordWords.has(w)).length;
  score += exactKeywordMatches * 4;

  // Title matches
  const titleWords = section.title.toLowerCase().split(/\s+/);
  const titleMatches = queryWords.filter(w => titleWords.includes(w)).length;
  score += titleMatches * 5;

  // Tag matches
  const tagMatches = section.tags.filter(t => lower.includes(t)).length;
  score += tagMatches * 3;

  // Path context boost
  if (section.pages.includes(pagePath)) {
    score += 8;
  }

  // Content overlap
  const contentWords = (section.content + ' ' + section.title).toLowerCase().split(/\s+/);
  const contentWordSet = new Set(contentWords);
  const contentMatches = queryWords.filter(w => w.length > 2 && contentWordSet.has(w)).length;
  score += contentMatches * 1;

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
  return scored.filter(s => s.score > 0).slice(0, TOP_K).map(s => s.section);
}

function trimContext(sections: KnowledgeSection[]): string {
  let combined = '';
  for (const s of sections) {
    const block = `## ${s.title}\n${s.content}\n\n---\n\n`;
    if ((combined + block).length > MAX_CONTEXT_LENGTH) break;
    combined += block;
  }
  return combined || (sections.length > 0 ? `## ${sections[0].title}\n${sections[0].content}` : '');
}

// ─── Conversational / Fallback responses when API Key is absent ────────────────

function buildConversationalResponse(input: string, historyLength: number): string | null {
  const lower = input.toLowerCase().trim();
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (/^(hello|hi|hey|greetings|hi there|hello there|hey there)([^a-z]|$)/i.test(lower)) {
    if (historyLength === 0) {
      return `${timeGreeting}! I'm your JobBridge AI Career Agent. I can help you search for jobs, optimize your profile, post hiring ads, and navigate all sections of the platform. What can I do for you today?`;
    }
    return `Hello again! How can I help you on JobBridge right now?`;
  }

  if (/^(who are you|what do you do|what are your features|introduce yourself)/i.test(lower)) {
    return `I am the JobBridge AI Assistant — Nigeria's top career agent. I can guide you through every page, explain pricing, help write job descriptions, rank candidates, customize resumes, and even trigger direct actions like routing you to pricing or helping you auto-fill profile fields. Ask me anything!`;
  }

  if (/^(thanks|thank you|appreciate it)/i.test(lower)) {
    return `You're very welcome! Let me know if you need anything else.`;
  }

  return null;
}

function extractSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
}

function getStructuredAnswer(question: string, section: KnowledgeSection): string {
  return section.content.split(/\n{2,}/).slice(0, 4).join('\n\n');
}

function buildFallbackAnswer(question: string, topSections: KnowledgeSection[]): string {
  const best = topSections[0];
  const parts = [
    `Here's what I found in the JobBridge knowledge base:`,
    getStructuredAnswer(question, best)
  ];

  if (topSections.length > 1) {
    const related = topSections.slice(1, 3).map(s => `- ${s.title}: ${extractSentences(s.content)[0] || ''}`).join('\n');
    parts.push(`### Related Topics\n${related}`);
  }

  const paths = [...new Set(topSections.flatMap(s => s.pages))].filter(Boolean);
  if (paths.length > 0) {
    parts.push(`### Navigation\nYou can explore this feature directly at: ${paths.join(', ')}`);
  }

  return parts.join('\n\n');
}

// ─── Tool-calling LLM Loop (Agentic) ────────────────────────────────

async function streamLLM(
  messages: HistoryMsg[],
  onToken: (token: string) => void,
): Promise<string> {
  const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: messages.map(m => ({ role: m.role, name: m.name, tool_call_id: m.tool_call_id, content: m.content })),
      max_tokens: 1500,
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

async function runAgenticLoop(
  messages: HistoryMsg[],
  pageState: PageState,
  conversationId: string,
  cb: StreamCallbacks
): Promise<void> {
  const { onToken, onSources, onError, onPhase, onThought, onAction, onDone } = cb;

  const tools = [
    {
      type: "function",
      function: {
        name: "search_knowledge_base",
        description: "Queries the comprehensive JobBridge knowledge base for FAQs, pricing details, candidate matching metrics, and step-by-step guides.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The topic, FAQ question, or keyword phrase to query."
            }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_current_page_context",
        description: "Inspects what the user is looking at right now, including visible text, active elements, loaded items, and profile details.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    {
      type: "function",
      function: {
        name: "navigate_to_page",
        description: "Redirects the user programmatically to a specific page or scrolls to a target section in JobBridge. Use this when they want to visit a feature or purchase something.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "The route path (e.g. '/pricing', '/ai-resume', '/jobs', '/profile', '/settings')."
            },
            selector: {
              type: "string",
              description: "Optional element ID/class to scroll to."
            }
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "autofill_form",
        description: "Helps the user fill in fields in the active page's forms (e.g. full name, bio, specialty).",
        parameters: {
          type: "object",
          properties: {
            fieldSelector: {
              type: "string",
              description: "The form input element's label, name or placeholder."
            },
            value: {
              type: "string",
              description: "The value to input."
            }
          },
          required: ["fieldSelector", "value"]
        }
      }
    }
  ];

  const loopMessages: HistoryMsg[] = [
    {
      role: 'system',
      content: `You are the JobBridge AI Assistant — a highly capable, empathetic, and professional career agent (comparable to Claude in reasoning). You help users navigate JobBridge (Nigeria's leading professional network).
      
      You have access to tools that let you search the knowledge base, inspect the active page context, route the user, and autofill forms.
      
      RULES:
      - Always inspect the page using 'get_current_page_context' to see what page they are on and what they are viewing.
      - Use 'search_knowledge_base' to check pricing, guides, and policies. Do not invent pricing or rules.
      - Use clean markdown styling. For headings, use ##. Keep lists clean and concise.
      - If you use 'navigate_to_page' or 'autofill_form', let the user know what you did.`
    },
    ...messages
  ];

  let step = 0;
  const maxSteps = 6;

  while (step < maxSteps) {
    step++;
    onPhase("Reasoning...");

    const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: loopMessages.map(m => ({ role: m.role, name: m.name, tool_call_id: m.tool_call_id, content: m.content, tool_calls: m.tool_calls })),
        tools,
        tool_choice: "auto",
        temperature: 0.2
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API error: ${res.status} — ${err}`);
    }

    const json = await res.json();
    const assistantMsg = json.choices?.[0]?.message;

    if (!assistantMsg) {
      throw new Error("Empty assistant message from API");
    }

    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      // Append assistant call to messages
      loopMessages.push({
        role: "assistant",
        content: null,
        tool_calls: assistantMsg.tool_calls
      });

      for (const call of assistantMsg.tool_calls) {
        const name = call.function.name;
        const args = JSON.parse(call.function.arguments || '{}');
        let toolOutput = "";

        if (onThought) {
          onThought({ toolName: name, status: "running", query: args.query || args.path || args.fieldSelector });
        }

        try {
          if (name === "search_knowledge_base") {
            onPhase(`Searching knowledge base for "${args.query}"...`);
            const sections = retrieveRelevant(args.query, pageState.currentPath);
            toolOutput = trimContext(sections);
            
            const sourceList = sections.map(s => ({ id: s.id, title: s.title }));
            onSources(sourceList);
          } 
          else if (name === "get_current_page_context") {
            onPhase("Inspecting page contents...");
            toolOutput = pageState.domSummary;
          } 
          else if (name === "navigate_to_page") {
            onPhase(`Redirecting to ${args.path}...`);
            if (onAction) {
              onAction("navigate", args);
            }
            toolOutput = `Redirected user to ${args.path}. Tell the user they have been navigated.`;
          } 
          else if (name === "autofill_form") {
            onPhase(`Auto-filling "${args.fieldSelector}"...`);
            if (onAction) {
              onAction("autofill", args);
            }
            toolOutput = `Autofilled field "${args.fieldSelector}" with value "${args.value}".`;
          }

          if (onThought) {
            onThought({ toolName: name, status: "completed", query: args.query || args.path || args.fieldSelector, output: toolOutput.slice(0, 150) + "..." });
          }
        } catch (toolErr: any) {
          toolOutput = `Error executing tool: ${toolErr.message || 'unknown error'}`;
          if (onThought) {
            onThought({ toolName: name, status: "failed", query: args.query || args.path || args.fieldSelector });
          }
        }

        loopMessages.push({
          role: "tool",
          name: name,
          tool_call_id: call.id,
          content: toolOutput
        });
      }
    } else {
      // The assistant has finished reasoning and is ready to stream the final textual output.
      onPhase("Writing response...");
      
      // Remove system prompt and past system prompts before streaming to keep it clean
      const cleanedMessages = loopMessages.filter(m => m.role !== 'system');
      
      // Inject system context to guide the final stream response
      cleanedMessages.unshift({
        role: 'system',
        content: `You are the JobBridge AI Assistant. You have just gathered all information and executed any necessary actions. Now, formulate the final user-facing response. 
        Ensure you are conversational, encouraging, and highly accurate. Maintain standard markdown formatting (especially lists).`
      });

      let finalContent = "";
      await streamLLM(cleanedMessages, (token) => {
        finalContent += token;
        onToken(token);
      });

      // Update local storage history
      const savedMsgs = [
        ...messages,
        { role: 'assistant' as const, content: finalContent }
      ];
      saveConversation(conversationId, savedMsgs);

      onDone(finalContent, []);
      return;
    }
  }

  onError("Agent reached max reasoning steps without producing a final answer.");
}

// ─── Public Entry Point ─────────────────────────────────────────────

export async function streamAnswer(
  question: string,
  conversationId: string,
  cb: StreamCallbacks,
  pageState: PageState
): Promise<void> {
  const { onToken, onSources, onError, onPhase, onDone } = cb;
  const questionClean = sanitize(question);

  if (!questionClean) {
    onError('Please enter a valid message.');
    return;
  }

  if (!rateLimit.allow()) {
    onError('Please wait a moment before sending another message.');
    return;
  }

  try {
    const history = getConversation(conversationId);

    // 1. Direct Conversational Responses (greetings/thanks)
    const greetResponse = buildConversationalResponse(questionClean, history.length);
    if (greetResponse) {
      const updatedHistory: HistoryMsg[] = [
        ...history,
        { role: 'user', content: questionClean },
        { role: 'assistant', content: greetResponse },
      ];
      saveConversation(conversationId, updatedHistory);
      onDone(greetResponse, []);
      return;
    }

    // 2. Local Fallback Mode if No API Key is set
    if (!API_KEY) {
      onPhase('Searching local database...');
      const results = retrieveRelevant(questionClean, pageState.currentPath);
      if (results.length === 0) {
        onError("I couldn't find matches in the knowledge base. Please try rephrasing or email jobbridgesupport@gmail.com.");
        return;
      }
      onSources(results.map(s => ({ id: s.id, title: s.title })));
      
      const textResponse = buildFallbackAnswer(questionClean, results);
      const updatedHistory: HistoryMsg[] = [
        ...history,
        { role: 'user', content: questionClean },
        { role: 'assistant', content: textResponse },
      ];
      saveConversation(conversationId, updatedHistory);
      onDone(textResponse, results.map(s => ({ id: s.id, title: s.title })));
      return;
    }

    // 3. Agentic Loop Execution
    const userMessage: HistoryMsg = { role: 'user', content: questionClean };
    const messages = [...history, userMessage];

    await runAgenticLoop(messages, pageState, conversationId, cb);

  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('401')) {
      onError('OpenAI API key is invalid or unauthorized. Please verify VITE_OPENAI_API_KEY.');
    } else if (msg.includes('429')) {
      onError('OpenAI rate limit exceeded. Please try again in a few moments.');
    } else {
      onError(`Agent error: ${msg || 'an unexpected error occurred'}.`);
    }
  }
}

// ─── No-op prewarm ──────────────────────────────────────────────

export function prewarmEmbeddings(): void {
  // Embedded model prewarming disabled
}
