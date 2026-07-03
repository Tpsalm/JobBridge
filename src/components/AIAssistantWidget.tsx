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
    "How to find a job?",
    "Recruiter plans",
    "AI Resume Builder",
  ],
  "/jobs": [
    "How to apply?",
    "Filter by remote jobs",
    "What is the salary expectation field?",
    "Save a job",
  ],
  "/my-jobs": [
    "Track applications",
    "What does reviewed mean?",
    "Interviews list",
    "Archive a job",
  ],
  "/recruiter": [
    "Post a job",
    "What is AI Candidate Ranking?",
    "Write job description",
    "Check my credits",
  ],
  "/pricing": [
    "Compare recruiter plans",
    "AI tools pricing",
    "Naira pricing details",
    "Plan comparison",
  ],
  "/payment": [
    "How do payments work?",
    "Supported payment methods",
    "Currency and billing",
    "Payment troubleshooting",
  ],
  "/ai-resume": [
    "Tailor my resume",
    "Generate cover letter",
    "Resume interview prep",
    "Skills extraction",
  ],
  "/providers": [
    "Become a provider",
    "Hourly rates list",
    "Service categories",
    "Verify provider listing",
  ],
  "/business": [
    "Weekly ad package",
    "Featured business spotlight",
    "Create advert",
    "Manage ads",
  ],
  "/profile": [
    "Help me fill in my profile",
    "Disability status field",
    "Account deletion",
    "Profile strength",
  ],
};

const defaultPrompts = [
  "What is JobBridge?",
  "How do payments work?",
  "AI Resume Studio options",
  "Contact support",
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
  const suggestedPrompts = pagePrompts[currentPath] || defaultPrompts;

  // Extract focused page context to avoid irrelevant assistant output
  const getPageContextSummary = useCallback(() => {
    let summary = `Current URL Path: ${currentPath}\n`;

    const pageTopicMap: Record<string, string> = {
      "/pricing": "Pricing and subscription plans",
      "/payment": "Payments and checkout",
      "/jobs": "Job search and applications",
      "/my-jobs": "Saved and applied jobs",
      "/recruiter": "Recruiter dashboard and hiring",
      "/profile": "User profile and account details",
      "/notifications": "Notification settings and alerts",
    };

    summary += `Primary Page Topic: ${pageTopicMap[currentPath] || "General platform information"}\n`;

    if (isAuthenticated && profile) {
      summary += `User Logged In: Yes\nRole: ${profile.role || ""}\n`;
    } else {
      summary += `User Logged In: No (Guest)\n`;
    }

    const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
      .map((el) => el.textContent?.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (headings.length > 0) {
      summary += `Visible Headings: ${headings.join(" | ")}\n`;
    }

    if (currentPath === "/profile" || currentPath === "/ai-resume") {
      const inputLabels = Array.from(
        document.querySelectorAll("input, select, textarea"),
      )
        .map((el) => {
          const field = el as
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          const placeholder = "placeholder" in field ? field.placeholder : "";
          return (
            field.previousElementSibling?.textContent?.trim() ||
            placeholder ||
            field.name ||
            field.id
          );
        })
        .filter(Boolean)
        .slice(0, 10);
      if (inputLabels.length > 0) {
        summary += `Visible Form Fields: ${inputLabels.join(", ")}\n`;
      }
    }

    if (currentPath.startsWith("/jobs")) {
      const cards = Array.from(
        document.querySelectorAll('.job-card, [class*="job-card"]'),
      )
        .map((el) => el.querySelector("h3")?.textContent?.trim())
        .filter(Boolean)
        .slice(0, 5);
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
          setMessages((prev) => [
            ...prev,
            { id: nextId(), text: final, sender: "bot", sources: finalSources },
          ]);
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
                    V2
                  </span>
                </div>
                <p className="text-xs text-blue-100 flex items-center gap-1">
                  <Compass className="w-3 h-3" />
                  Reasoning & Action Mode
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
