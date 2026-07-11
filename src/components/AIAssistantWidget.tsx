import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Bot,
  X,
  Send,
  Sparkles,
  Trash2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  Compass,
  ChevronDown,
  Terminal,
} from "lucide-react";
import {
  streamAnswer,
  clearConversation,
  prewarmEmbeddings,
  getModelInfo,
  type SourceInfo,
  type AgentThought,
} from "../lib/ragEngine";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  sources?: SourceInfo[];
  error?: boolean;
}

const CONVERSATION_ID = "jobbridge-ai-widget";

function renderInline(text: string): React.ReactNode {
  const result: React.ReactNode[] = [];
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of boldParts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      result.push(
        <strong key={result.length} className="font-bold text-gray-900">
          {part.slice(2, -2)}
        </strong>,
      );
    } else {
      const italicParts = part.split(/(\*[^*]+\*)/g);
      for (const ip of italicParts) {
        if (ip.startsWith("*") && ip.endsWith("*") && ip.length > 2) {
          result.push(
            <em key={result.length} className="italic text-gray-700">
              {ip.slice(1, -1)}
            </em>,
          );
        } else {
          result.push(ip);
        }
      }
    }
  }
  return result.length === 1 ? result[0] : result;
}

// Custom Markdown message formatting component supporting code blocks, links, lists, and tables
function FormattedMessage({ text }: { text: string }) {
  const parts = text.split(
    /(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  );

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("http://") || part.startsWith("https://")) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline font-medium hover:text-blue-800 break-all inline-flex items-center gap-0.5"
            >
              {part}
            </a>
          );
        }
        if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(part)) {
          const href = part.endsWith("@gmail.com")
            ? `https://mail.google.com/mail/?view=cm&fs=1&to=${part}`
            : `mailto:${part}`;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline font-medium hover:text-blue-800 inline-flex items-center gap-0.5"
            >
              {part}
            </a>
          );
        }

        const lines = part.split("\n");
        const elements: React.ReactNode[] = [];
        let li = 0;

        while (li < lines.length) {
          const line = lines[li];
          const trimmed = line.trim();

          if (!trimmed) {
            elements.push(<div key={`${i}-br-${li}`} className="h-2" />);
            li++;
            continue;
          }

          // Headers
          const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
          if (headerMatch) {
            const level = headerMatch[1].length;
            const Tag = level === 3 ? "h4" : level === 2 ? "h3" : "h4";
            elements.push(
              <Tag
                key={`${i}-h-${li}`}
                className="font-bold text-gray-900 mt-3 mb-1 text-sm border-b border-gray-100 pb-0.5"
              >
                {renderInline(headerMatch[2])}
              </Tag>,
            );
            li++;
            continue;
          }

          // Fenced Code Blocks
          if (trimmed.startsWith("```")) {
            const lang = trimmed.slice(3).trim();
            const codeLines: string[] = [];
            li++;
            while (li < lines.length && !lines[li].trim().startsWith("```")) {
              codeLines.push(lines[li]);
              li++;
            }
            li++; // skip closing ```
            const codeStr = codeLines.join("\n");
            elements.push(
              <div
                key={`${i}-code-${li}`}
                className="relative my-2.5 rounded-xl border border-gray-100 bg-gray-900 overflow-hidden font-mono text-xs"
              >
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 text-gray-400 text-[10px]">
                  <span className="flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" />
                    {lang || "code"}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(codeStr)}
                    className="hover:text-white transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <pre className="p-3 overflow-x-auto text-gray-200">
                  <code>{codeStr}</code>
                </pre>
              </div>,
            );
            continue;
          }

          // Tables
          if (trimmed.startsWith("|")) {
            const rows: string[][] = [];
            while (li < lines.length && lines[li].trim().startsWith("|")) {
              const rowContent = lines[li]
                .split("|")
                .map((s) => s.trim())
                .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
              // Filter out markdown divider rows (e.g. ---)
              if (!rowContent.every((cell) => /^:?-+:?$/.test(cell))) {
                rows.push(rowContent);
              }
              li++;
            }
            if (rows.length > 0) {
              const headers = rows[0];
              const body = rows.slice(1);
              elements.push(
                <div
                  key={`${i}-table-${li}`}
                  className="overflow-x-auto my-3 rounded-xl border border-gray-100 shadow-sm bg-white"
                >
                  <table className="min-w-full divide-y divide-gray-100 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {headers.map((h, idx) => (
                          <th
                            key={idx}
                            className="px-3 py-2 text-left font-bold text-gray-700"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {body.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-gray-50/50 transition-colors"
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3 py-2 text-gray-600 whitespace-nowrap"
                            >
                              {renderInline(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>,
              );
            }
            continue;
          }

          // Bullet lists
          if (/^[-*•]\s/.test(trimmed)) {
            const items: React.ReactNode[] = [];
            while (li < lines.length && /^[-*•]\s/.test(lines[li].trim())) {
              items.push(
                <li key={`${i}-uli-${li}`} className="flex gap-2 text-gray-700">
                  <span className="text-blue-500">•</span>
                  <span>
                    {renderInline(lines[li].trim().replace(/^[-*•]\s+/, ""))}
                  </span>
                </li>,
              );
              li++;
            }
            elements.push(
              <ul key={`${i}-ul`} className="space-y-1 my-2.5 pl-1">
                {items}
              </ul>,
            );
            continue;
          }

          // Numbered lists
          const numberedMatch = trimmed.match(/^\d+[).]\s(.+)/);
          if (numberedMatch) {
            const items: React.ReactNode[] = [];
            while (li < lines.length) {
              const m = lines[li].trim().match(/^\d+[).]\s(.+)/);
              if (!m) break;
              items.push(
                <li key={`${i}-oli-${li}`} className="flex gap-2 text-gray-700">
                  <span className="font-bold text-blue-500 text-xs mt-0.5">
                    {items.length + 1}.
                  </span>
                  <span>{renderInline(m[1])}</span>
                </li>,
              );
              li++;
            }
            elements.push(
              <ol key={`${i}-ol`} className="space-y-1.5 my-2.5 pl-1">
                {items}
              </ol>,
            );
            continue;
          }

          elements.push(
            <p
              key={`${i}-p-${li}`}
              className="text-gray-700 leading-relaxed my-1"
            >
              {renderInline(trimmed)}
            </p>,
          );
          li++;
        }
        return elements;
      })}
    </div>
  );
}

const pagePrompts: Record<string, string[]> = {
  "/": [
    "What is JobBridge?",
    "Show me pricing plans",
    "How to find a job?",
    "AI Resume Builder",
  ],
  "/jobs": [
    "How to apply?",
    "Filter by remote jobs",
    "Save a job",
    "What job types are available?",
  ],
  "/my-jobs": [
    "Track my applications",
    "What does reviewed mean?",
    "Saved jobs list",
    "Application status",
  ],
  "/recruiter": [
    "Post a job",
    "How does AI Candidate Ranking work?",
    "Check my credits",
    "Review applications",
  ],
  "/pricing": [
    "Compare recruiter plans",
    "AI tools pricing",
    "Service provider plans",
    "Business ad packages",
  ],
  "/payment": [
    "How do payments work?",
    "Supported payment methods",
    "Bank transfer details",
    "Payment troubleshooting",
  ],
  "/ai-resume": [
    "Tailor my resume",
    "Generate cover letter",
    "Interview prep",
    "Skills extraction",
  ],
  "/providers": [
    "Find a service provider",
    "Become a provider",
    "Service categories",
    "How do provider plans work?",
  ],
  "/business": [
    "Create an advert",
    "Ad packages",
    "Featured business spotlight",
    "Manage my ads",
  ],
  "/profile": [
    "Help me complete my profile",
    "Change my password",
    "Account deletion",
    "Profile visibility",
  ],
  "/about": ["Company story", "Who founded JobBridge?", "Core values", "Mission"],
  "/ceo": ["CEO Victor Eniola", "Company roadmap", "Founder story", "Leave a message for the CEO"],
  "/support": ["Common FAQs", "How to apply for a job", "Payment issues", "Contact support"],
  "/blog": ["Latest articles", "Career advice", "AI in hiring", "Remote work tips"],
  "/games": ["Play memory game", "How does the game work?", "Highest scores", "Job quiz"],
  "/messages": ["How to send a message", "Unread conversations", "Chat with recruiters"],
  "/notifications": ["View my notifications", "Notification types", "Turn off alerts"],
  "/profile-visibility": ["Who can see my profile?", "Privacy settings", "Recruiter contact"],
  "/job-preferences": ["Set work type", "Salary expectations", "Job alerts"],
  "/following": ["Who am I following?", "Find people to follow", "Connections"],
  "/reviews": ["Leave a review", "My ratings", "Provider reviews"],
  "/talent-search": ["Find candidates", "Search talent", "Recruit professionals"],
};

const defaultPrompts = [
  "What is JobBridge?",
  "Show me pricing plans",
  "Take me to the Jobs page",
  "Help me with AI Resume",
];

let msgCounter = 0;
function nextId() {
  return `msg-${++msgCounter}`;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 17
      ? "Good afternoon"
      : "Good evening";
}

function pickVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((voice) =>
    voice.lang.startsWith("en") && /female|samantha|zira|victoria|ava|jessa|susan|alice|emma/i.test(voice.name),
  );

  return preferred ?? voices.find((voice) => voice.lang.startsWith("en")) ?? null;
}

function speakAssistantText(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  const normalized = text.replace(/[#*_`]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return;

  const expressiveText = normalized
    .replace(/([.!?])\s+/g, "$1 ")
    .replace(/\b(Here|Welcome|Let me|You can|To get started|On this page)\b/gi, "$1")
    .replace(/\b(JobBridge|AI|career|resume|jobs|profile)\b/gi, (match) => `${match}`);

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(expressiveText);
  utterance.lang = "en-US";
  utterance.rate = 1.02;
  utterance.pitch = 1.08;
  utterance.volume = 0.95;
  const voice = pickVoice();

  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

function AIAssistantWidget() {
  const { profile, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: nextId(),
      text: `${getTimeGreeting()}! I'm your JobBridge AI Career Agent. I have deep knowledge of the platform and can inspect your active page to help you guide actions or fill forms. Ask me anything!`,
      sender: "bot",
    },
  ]);

  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("");
  const [streamText, setStreamText] = useState("");
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [showThoughts, setShowThoughts] = useState(true);
  const [toastMsg, setToastMsg] = useState("");

  const lastUserMsgRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamText, phase, thoughts, scrollToBottom]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    prewarmEmbeddings();
  }, []);

  const currentPath = location.pathname.replace(/\/$/, "") || "/";
  const modelInfo = getModelInfo();

  // Generate dynamic suggested prompts based on current page, with smarter ones
  const suggestedPrompts = pagePrompts[currentPath] || pagePrompts[currentPath.replace(/\/\d+.*$/, "")] || defaultPrompts;

  // Extract rich page context to help AI understand what the user sees
  const getPageContextSummary = useCallback(() => {
    let summary = `Current URL Path: ${currentPath}\n`;

    const pageTopicMap: Record<string, string> = {
      "/": "Home page with hero, stats, featured jobs, testimonial",
      "/pricing": "Pricing and subscription plans for recruiters, AI tools, providers, ads",
      "/payment": "Payments and checkout with KoraPay — card, USSD, bank transfer",
      "/jobs": "Job search and applications with split-panel layout, filters",
      "/my-jobs": "Saved and applied jobs dashboard with tabs",
      "/recruiter": "Recruiter dashboard for posting jobs and managing candidates",
      "/profile": "User profile with edit form, completeness meter, account security",
      "/notifications": "Notification center with all types of alerts",
      "/messages": "Inbox with conversation threads and chat panel",
      "/ai-resume": "AI Resume Studio with 4 tools: extraction, tailoring, cover letter, interview prep",
      "/business": "Business advertisement creation and management",
      "/providers": "Service provider marketplace to find or become a provider",
      "/blog": "Career insights blog with categories",
      "/about": "Company story, mission, team, values",
      "/ceo": "CEO vision page with video message from Victor Eniola",
      "/support": "FAQ accordion and help center",
      "/contact": "Contact form and support information",
      "/games": "Memory card matching game and job quiz",
      "/privacy": "Privacy policy and data protection info",
      "/career": "Career opportunities at JobBridge (coming soon)",
      "/signup": "Registration page with role selection",
      "/login": "Sign in page",
      "/profile-visibility": "Profile visibility and privacy settings",
      "/job-preferences": "Work type, location, salary preferences",
      "/following": "Companies and users you follow",
      "/reviews": "Reviews and ratings",
      "/talent-search": "Talent search and candidate discovery",
    };

    summary += `Primary Page Topic: ${pageTopicMap[currentPath] || "JobBridge platform"}\n`;

    if (isAuthenticated && profile) {
      summary += `User Logged In: Yes\nRole: ${profile.role || "Not set"}\n`;
      if (profile.full_name) summary += `User Name: ${profile.full_name}\n`;
    } else {
      summary += `User Logged In: No (Guest)\n`;
    }

    // Extract ALL visible headings on the page for richer context
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4"))
      .map((el) => el.textContent?.trim())
      .filter((t): t is string => !!t && t.length > 0)
      .slice(0, 12);
    if (headings.length > 0) {
      summary += `Visible Headings: ${headings.join(" | ")}\n`;
    }

    // Extract buttons and CTAs for action context
    const buttons = Array.from(document.querySelectorAll("button, a[class*='btn'], a[class*='button']"))
      .map((el) => el.textContent?.trim())
      .filter((t): t is string => !!t && t.length > 0 && t.length < 50)
      .slice(0, 8);
    if (buttons.length > 0) {
      summary += `Available Actions: ${buttons.join(", ")}\n`;
    }

    // Form field detection for profile-like pages
    if (["/profile", "/ai-resume", "/signup", "/login", "/job-preferences", "/profile-visibility"].includes(currentPath)) {
      const inputLabels = Array.from(
        document.querySelectorAll("input, select, textarea"),
      )
        .map((el) => {
          const field = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          return (
            field.previousElementSibling?.textContent?.trim() ||
            ("placeholder" in field ? field.placeholder : "") ||
            field.name ||
            field.id
          );
        })
        .filter((t): t is string => !!t)
        .slice(0, 15);
      if (inputLabels.length > 0) {
        summary += `Visible Form Fields: ${inputLabels.join(", ")}\n`;
      }
    }

    // Job postings on jobs page
    if (currentPath.startsWith("/jobs")) {
      const cards = Array.from(
        document.querySelectorAll('[class*="job-card"], [class*="JobCard"], .border-b.border-gray-100')
      )
        .map((el) => {
          const titleEl = el.querySelector("h3");
          const companyEl = el.querySelector('[class*="text-gray-600"]');
          if (titleEl) {
            const title = titleEl.textContent?.trim() || "";
            const company = companyEl?.textContent?.trim() || "";
            return `${title}${company ? ` @ ${company}` : ""}`;
          }
          return null;
        })
        .filter((t): t is string => !!t)
        .slice(0, 6);
      if (cards.length > 0) {
        summary += `Visible Job Postings: ${cards.join(", ")}\n`;
      }
    }

    return summary;
  }, [currentPath, isAuthenticated, profile]);

  const handleAgentAction = useCallback(
    (actionType: string, params: Record<string, string>) => {
      if (actionType === "navigate") {
        const { path, selector } = params;
        navigate(path);
        setToastMsg(`Navigated to ${path}`);
        setTimeout(() => setToastMsg(""), 3000);

        if (selector) {
          setTimeout(() => {
            const el = document.querySelector(selector);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 600);
        }
      } else if (actionType === "autofill") {
        const { fieldSelector, value } = params;
        // Resolve dynamic input fields
        const query = `input[name="${fieldSelector}"], input[id="${fieldSelector}"], input[placeholder*="${fieldSelector}" i], select[name="${fieldSelector}"], textarea[name="${fieldSelector}"], [placeholder*="${fieldSelector}" i]`;
        const input = document.querySelector(query) as
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

        if (input) {
          input.value = value;
          // Dispatch synthetic events so React notices changes
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));

          // Visual flash confirmation
          input.classList.add("ring-2", "ring-emerald-400", "transition-all");
          setToastMsg(`Filled field "${fieldSelector}"`);
          setTimeout(() => {
            input.classList.remove("ring-2", "ring-emerald-400");
            setToastMsg("");
          }, 2000);
        } else {
          setToastMsg(`Field "${fieldSelector}" not found on page`);
          setTimeout(() => setToastMsg(""), 3000);
        }
      }
    },
    [navigate],
  );

  function handleSend(text?: string) {
    const msgText = text || input.trim();
    if (!msgText || phase) return;

    lastUserMsgRef.current = msgText;
    setMessages((prev) => [
      ...prev,
      { id: nextId(), text: msgText, sender: "user" },
    ]);
    setInput("");
    setPhase("Thinking...");
    setStreamText("");
    setThoughts([]);

    const pageState = {
      currentPath,
      domSummary: getPageContextSummary(),
      userProfile: profile,
    };

    streamAnswer(
      msgText,
      CONVERSATION_ID,
      {
        onPhase: (p) => setPhase(p),
        onToken: (tok) => setStreamText((prev) => prev + tok),
        onSources: () => undefined,
        onThought: (th) => {
          setThoughts((prev) => {
            // If thought tool is already running/recorded, update it, else add it
            const idx = prev.findIndex(
              (t) =>
                t.toolName === th.toolName &&
                t.query === th.query &&
                t.status === "running",
            );
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = th;
              return copy;
            }
            return [...prev, th];
          });
        },
        onAction: (act, params) => handleAgentAction(act, params),
        onError: (err) => {
          setPhase("");
          setMessages((prev) => [
            ...prev,
            { id: nextId(), text: err, sender: "bot", error: true },
          ]);
        },
        onDone: (final, finalSources) => {
          setPhase("");
          setStreamText("");
          const cleaned = final.replace(/\s+/g, " ").trim();
          setMessages((prev) => [
            ...prev,
            { id: nextId(), text: cleaned, sender: "bot", sources: finalSources },
          ]);
          if (cleaned) {
            speakAssistantText(cleaned);
          }
        },
      },
      pageState,
    );
  }

  function handleClear() {
    clearConversation(CONVERSATION_ID);
    setMessages([
      {
        id: nextId(),
        text: `Conversation history cleared. How can I help you navigate JobBridge now?`,
        sender: "bot",
      },
    ]);
    setThoughts([]);
    setStreamText("");
    setPhase("");
  }

  return (
    <>
      {/* Action execution toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 backdrop-blur text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 border border-gray-800 transition-all duration-300">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          {toastMsg}
        </div>
      )}

      {/* Launcher Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed z-40 w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center border border-white/10 hover:scale-105 active:scale-95 ${isOpen ? "scale-0 pointer-events-none" : "scale-100"}`}
        style={{
          bottom: "max(80px, env(safe-area-inset-bottom, 0px))",
          right: "max(16px, env(safe-area-inset-right, 0px))",
        }}
      >
        <div className="relative">
          <Bot className="w-6 h-6 animate-pulse" />
          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-emerald-400 rounded-full border border-white" />
        </div>
      </button>

      {/* Slide-out Agent Chat Panel */}
      <div
        className={`fixed z-50 transition-all duration-300 ease-out ${
          isOpen
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-6 scale-95 pointer-events-none"
        }`}
        style={{
          bottom: "max(80px, env(safe-area-inset-bottom, 0px))",
          right: "max(16px, env(safe-area-inset-right, 0px))",
          width: "calc(100vw - 32px)",
          maxWidth: "420px",
          maxHeight:
            "calc(100dvh - max(120px, env(safe-area-inset-bottom, 0px)))",
        }}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
          style={{
            maxHeight:
              "calc(100dvh - max(120px, env(safe-area-inset-bottom, 0px)))",
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm shadow-inner">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-white text-sm">
                    JobBridge AI Agent
                  </h3>
                  <span className="px-1.5 py-0.5 bg-emerald-400/25 border border-emerald-400/20 text-emerald-300 text-[9px] font-bold rounded-md">
                    {modelInfo.provider === "DeepSeek" ? "DeepSeek" : "GPT"}
                  </span>
                </div>
                <p className="text-xs text-blue-100 flex items-center gap-1">
                  <Compass className="w-3 h-3" />
                  Deep Reasoning & Page Router
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClear}
                title="Clear Conversation"
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f9fc]"
            style={{ minHeight: "260px" }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] px-4 py-3 rounded-2xl text-[13px] shadow-sm transition-all duration-200 ${
                    msg.sender === "user"
                      ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-tr-none"
                      : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                  }`}
                >
                  <FormattedMessage text={msg.text} />

                  {msg.sender === "bot" &&
                    msg.sources &&
                    msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3 pt-2.5 border-t border-gray-100">
                        {msg.sources.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-semibold"
                          >
                            <BookOpen className="w-3 h-3" />
                            {s.title}
                          </span>
                        ))}
                      </div>
                    )}

                  {msg.sender === "bot" && msg.error && (
                    <div className="flex items-center gap-2 mt-2">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <button
                        onClick={() => {
                          setMessages((prev) =>
                            prev.filter((m) => m.id !== msg.id),
                          );
                          if (lastUserMsgRef.current)
                            handleSend(lastUserMsgRef.current);
                        }}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3 animate-spin" /> Retry
                        Response
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* AI Agent Thought Process Log */}
            {thoughts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm text-xs transition-all duration-300">
                <button
                  onClick={() => setShowThoughts(!showThoughts)}
                  className="w-full flex items-center justify-between text-gray-500 font-semibold hover:text-gray-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-blue-600 font-bold">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Agent Thought Process
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${showThoughts ? "rotate-180" : ""}`}
                  />
                </button>
                {showThoughts && (
                  <div className="space-y-2 mt-2.5 border-l-2 border-blue-100 pl-2.5">
                    {thoughts.map((th, idx) => (
                      <div key={idx} className="flex flex-col text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px]">
                            {th.status === "running"
                              ? "⏳"
                              : th.status === "completed"
                                ? "✅"
                                : "❌"}
                          </span>
                          <span className="font-semibold text-gray-700">
                            {th.toolName}
                          </span>
                          {th.query && (
                            <span className="text-gray-400 italic font-mono text-[10px]">
                              ("{th.query}")
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Streaming Answer */}
            {(phase || streamText) && (
              <div className="flex justify-start">
                <div className="max-w-[88%] px-4 py-3 rounded-2xl text-[13px] bg-white text-gray-800 rounded-tl-none border border-gray-100 shadow-sm">
                  {!streamText && phase ? (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                        <span
                          className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                          style={{ animationDelay: "0.15s" }}
                        />
                        <span
                          className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                          style={{ animationDelay: "0.3s" }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        {phase}...
                      </span>
                    </div>
                  ) : (
                    <>
                      <FormattedMessage text={streamText} />
                      <span className="inline-block w-1.5 h-4 bg-blue-600 ml-0.5 animate-pulse align-middle" />
                    </>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="px-4 py-3 bg-white border-t border-gray-50 shrink-0">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  disabled={!!phase}
                  className="shrink-0 px-3.5 py-1.5 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-xl text-xs text-gray-600 transition-all border border-gray-100 font-medium disabled:opacity-40 whitespace-nowrap"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Chat Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-4 bg-white border-t border-gray-50 shrink-0"
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI Agent to search, route, or fill forms..."
                disabled={!!phase}
                className="flex-1 px-4 py-3 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-sm disabled:opacity-50 transition-all shadow-inner bg-gray-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || !!phase}
                className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md shadow-blue-200"
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
