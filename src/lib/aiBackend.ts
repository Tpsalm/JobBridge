import { supabase } from "./supabase";

type AIRequestType = "status" | "chat" | "embed" | "resume" | "cover-letter";
type AIMessageRole = "system" | "user" | "assistant" | "tool";

export interface AIChatMessage {
  role: AIMessageRole;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface AIResponse {
  ok: boolean;
  result?: string;
  embedding?: number[];
  error?: string;
  tool_calls?: AIChatMessage["tool_calls"];
}

class AIRequestFailure extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 12000;
const MAX_INPUT_LENGTH = 24000;

async function requestAI(
  body: Record<string, unknown> & { type: AIRequestType },
): Promise<AIResponse> {
  let primaryError = "";
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch("/api/ai-operations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null) as AIResponse | null;
    if (response.ok && result?.ok) return result;
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new AIRequestFailure(result?.error || "AI request was rejected.", response.status);
    }
    primaryError = result?.error || `AI service request failed (${response.status}).`;
  } catch (error) {
    if (error instanceof AIRequestFailure) {
      throw error;
    }
    primaryError = error instanceof Error ? error.message : "AI service is unavailable.";
  }

  const { data, error } = await supabase.functions.invoke<AIResponse>(
    "ai-operations",
    { body },
  );
  if (error) throw new Error(`${primaryError} ${error.message}`.trim());
  if (!data || typeof data !== "object" || typeof data.ok !== "boolean") {
    throw new Error("AI service returned an invalid response.");
  }
  if (!data.ok) {
    throw new Error(data.error || "AI service request failed.");
  }
  return data;
}

function validateText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required.`);
  if (value.length > MAX_INPUT_LENGTH) {
    throw new Error(`${label} exceeds the maximum supported length.`);
  }
}

function validateMessages(
  messages: Array<{ role: string; content: string }>,
): AIChatMessage[] {
  if (!messages.length || messages.length > MAX_MESSAGES) {
    throw new Error(`Chat must include between 1 and ${MAX_MESSAGES} messages.`);
  }
  return messages.map(({ role, content }) => {
    if (role !== "system" && role !== "user" && role !== "assistant") {
      throw new Error("Chat contains an unsupported message role.");
    }
    if (typeof content !== "string" || content.length > MAX_MESSAGE_LENGTH) {
      throw new Error("Chat message is empty or exceeds the supported length.");
    }
    return { role, content };
  });
}

function validateAgentMessages(messages: AIChatMessage[]): AIChatMessage[] {
  if (!messages.length || messages.length > MAX_MESSAGES) {
    throw new Error(`Chat must include between 1 and ${MAX_MESSAGES} messages.`);
  }
  let totalLength = 0;
  return messages.map((message) => {
    if (!["system", "user", "assistant", "tool"].includes(message.role)
      || typeof message.content !== "string"
      || message.content.length > MAX_MESSAGE_LENGTH
      || (message.role === "tool" && (!message.name || !message.tool_call_id))
      || (message.role === "assistant" && !message.content.trim() && !message.tool_calls?.length)
      || (message.tool_calls !== undefined && (
        message.role !== "assistant"
        || message.tool_calls.length === 0
        || !Array.isArray(message.tool_calls)
        || message.tool_calls.some((call) => (
          typeof call.id !== "string"
          || call.type !== "function"
          || typeof call.function?.name !== "string"
          || typeof call.function?.arguments !== "string"
          || call.function.arguments.length > MAX_MESSAGE_LENGTH
        ))
      ))) {
      throw new Error("Chat contains an invalid or oversized message.");
    }
    totalLength += message.content.length
      + (message.tool_calls?.reduce((length, call) => length + call.function.arguments.length, 0) || 0);
    if (totalLength > MAX_INPUT_LENGTH) {
      throw new Error("Chat exceeds the maximum supported length.");
    }
    return message;
  });
}

export async function isAIAvailable(): Promise<boolean> {
  try {
    await requestAI({ type: "status" });
    return true;
  } catch {
    return false;
  }
}

export async function aiChat(
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const completion = await aiChatCompletion(validateMessages(messages), false);
  if (!completion.content.trim()) throw new Error("AI service returned an empty chat response.");
  return completion.content;
}

export async function aiChatWithTools(messages: AIChatMessage[]): Promise<{
  content: string;
  toolCalls: NonNullable<AIResponse["tool_calls"]>;
}> {
  return aiChatCompletion(messages, true);
}

async function aiChatCompletion(
  messages: AIChatMessage[],
  enableTools: boolean,
): Promise<{ content: string; toolCalls: NonNullable<AIResponse["tool_calls"]> }> {
  const data = await requestAI({
    type: "chat",
    messages: validateAgentMessages(messages),
    enableTools,
  });
  const toolCalls = data.tool_calls || [];
  if ((!data.result || !data.result.trim()) && toolCalls.length === 0) {
    throw new Error("AI service returned an empty chat response.");
  }
  return { content: data.result || "", toolCalls };
}

export async function aiChatStream(
  messages: AIChatMessage[],
  onToken: (token: string) => void,
): Promise<string> {
  const completion = await aiChatCompletion(messages, false);
  if (!completion.content.trim()) throw new Error("AI service returned an empty chat response.");
  onToken(completion.content);
  return completion.content;
}

export async function aiEmbed(text: string): Promise<number[]> {
  validateText(text, "Text");
  const data = await requestAI({ type: "embed", text });
  if (
    !Array.isArray(data.embedding) ||
    data.embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("AI service returned an invalid embedding.");
  }
  return data.embedding;
}

export async function aiGenerateResume(
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
): Promise<string> {
  validateText(resumeText, "Resume");
  validateText(jobTitle, "Job title");
  if (jobDescription.length > MAX_INPUT_LENGTH) {
    throw new Error("Job description exceeds the maximum supported length.");
  }
  const data = await requestAI({
    type: "resume",
    resumeText,
    jobTitle,
    jobDescription,
  });
  if (typeof data.result !== "string" || !data.result.trim()) {
    throw new Error("AI service returned an empty resume.");
  }
  return data.result;
}

export async function aiGenerateCoverLetter(
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  companyName?: string,
): Promise<string> {
  validateText(resumeText, "Resume");
  validateText(jobTitle, "Job title");
  if (jobDescription.length > MAX_INPUT_LENGTH) {
    throw new Error("Job description exceeds the maximum supported length.");
  }
  const data = await requestAI({
    type: "cover-letter",
    resumeText,
    jobTitle,
    jobDescription,
    companyName: companyName?.trim() || "the company",
  });
  if (typeof data.result !== "string" || !data.result.trim()) {
    throw new Error("AI service returned an empty cover letter.");
  }
  return data.result;
}
