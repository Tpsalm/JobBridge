import { supabase } from "./supabase";

type AIRequestType = "status" | "chat" | "embed" | "resume" | "cover-letter";
type AIMessageRole = "system" | "user" | "assistant";

interface AIResponse {
  ok: boolean;
  result?: string;
  embedding?: number[];
  error?: string;
}

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 12000;
const MAX_INPUT_LENGTH = 24000;

async function requestAI(
  body: Record<string, unknown> & { type: AIRequestType },
): Promise<AIResponse> {
  const { data, error } = await supabase.functions.invoke<AIResponse>(
    "ai-operations",
    { body },
  );
  if (error) {
    throw new Error(`AI service request failed: ${error.message}`);
  }
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
): Array<{ role: AIMessageRole; content: string }> {
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
  const data = await requestAI({
    type: "chat",
    messages: validateMessages(messages),
  });
  if (typeof data.result !== "string" || !data.result.trim()) {
    throw new Error("AI service returned an empty chat response.");
  }
  return data.result;
}

export async function aiChatStream(
  messages: Array<{ role: string; content: string }>,
  onToken: (token: string) => void,
): Promise<string> {
  const result = await aiChat(messages);
  onToken(result);
  return result;
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
  validateText(jobDescription, "Job description");
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
  validateText(jobDescription, "Job description");
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
