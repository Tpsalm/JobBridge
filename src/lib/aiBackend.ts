/**
 * AI Backend Communication Helper
 * 
 * This module provides secure communication with JobBridge AI services
 * running on Supabase Edge Functions. All sensitive API keys are handled
 * server-side only, never exposed to the client.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Get the AI operations endpoint URL
 */
export function getAIEndpoint(): string {
  const url = new URL(`${SUPABASE_URL}/functions/v1/ai-operations`);
  return url.toString();
}

/**
 * Check if AI services are available
 */
export async function isAIAvailable(): Promise<boolean> {
  try {
    const response = await fetch(getAIEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ type: 'status' }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Send a chat request to the AI backend
 */
export async function aiChat(messages: Array<{ role: string; content: string }>): Promise<string> {
  const response = await fetch(getAIEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      type: 'chat',
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI Chat API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || 'Unknown error from AI service');
  }

  return data.result;
}

/**
 * Send a streaming chat request to the AI backend
 */
export async function aiChatStream(
  messages: Array<{ role: string; content: string }>,
  onToken: (token: string) => void
): Promise<string> {
  const response = await fetch(getAIEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      type: 'chat',
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI Chat API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || 'Unknown error from AI service');
  }

  // For non-streaming response, call onToken with the full result
  if (data.result) {
    onToken(data.result);
  }

  return data.result;
}

/**
 * Generate an embedding for text
 */
export async function aiEmbed(text: string): Promise<number[]> {
  const response = await fetch(getAIEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      type: 'embed',
      text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI Embed API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || 'Unknown error from AI service');
  }

  return data.embedding || [];
}

/**
 * Generate a tailored resume
 */
export async function aiGenerateResume(
  resumeText: string,
  jobTitle: string,
  jobDescription: string
): Promise<string> {
  const response = await fetch(getAIEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      type: 'resume',
      resumeText,
      jobTitle,
      jobDescription,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI Resume API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || 'Unknown error from AI service');
  }

  return data.result;
}

/**
 * Generate a cover letter
 */
export async function aiGenerateCoverLetter(
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  companyName?: string
): Promise<string> {
  const response = await fetch(getAIEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      type: 'cover-letter',
      resumeText,
      jobTitle,
      jobDescription,
      companyName: companyName || 'the company',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI Cover Letter API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || 'Unknown error from AI service');
  }

  return data.result;
}
