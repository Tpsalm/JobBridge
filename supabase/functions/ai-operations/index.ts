import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

// Read keys from Supabase secret environment
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';
const GEMINI_API_KEY = Deno.env.get('VITE_GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY') || '';

// Smart fallback configuration prioritizing free Gemini
const USE_GEMINI = !!GEMINI_API_KEY;
const USE_DEEPSEEK = !USE_GEMINI && !!DEEPSEEK_API_KEY;

interface AIRequest {
  type: 'chat' | 'embed' | 'resume' | 'cover-letter';
  messages?: Array<{ role: string; content: string }>;
  text?: string;
  prompt?: string;
  systemPrompt?: string;
  userPrompt?: string;
  resumeText?: string;
  jobDescription?: string;
  jobTitle?: string;
  companyName?: string;
}

interface AIResponse {
  ok: boolean;
  result?: string;
  embedding?: number[];
  error?: string;
}

async function chat(messages: Array<{ role: string; content: string }>): Promise<string> {
  // 1. Google Gemini Native Fetch Implementation (Free Tier)
  if (USE_GEMINI) {
    // Transform OpenAI array structure to Google Gemini contents structure.
    // Gemini expects alternating user/model turns; merge consecutive messages
    // with the same effective role and keep system instructions separate.
    const geminiContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      const effectiveRole: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
      const last = geminiContents[geminiContents.length - 1];
      if (last && last.role === effectiveRole) {
        last.parts[0].text += '\n\n' + msg.content;
      } else {
        geminiContents.push({ role: effectiveRole, parts: [{ text: msg.content }] });
      }
    }

    // Extract system instructions if present in messages array
    const systemMessage = messages.find(msg => msg.role === 'system');
    const systemInstruction = systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiContents,
          systemInstruction: systemInstruction,
          generationConfig: {
            maxOutputTokens: 4000,
            temperature: 0.7,
          }
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    // Surface Gemini safety / blocking info so it is visible in logs
    if (data?.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked request: ${data.promptFeedback.blockReason}`);
    }
    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      console.warn('[ai-operations] Gemini finishReason:', candidate.finishReason);
    }
    return candidate?.content?.parts?.[0]?.text || '';
  }

  // 2. OpenAI / DeepSeek Backup Pipeline
  const LLM_API_KEY = DEEPSEEK_API_KEY || OPENAI_API_KEY;
  if (!LLM_API_KEY) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  const LLM_BASE_URL = USE_DEEPSEEK ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1';
  const LLM_MODEL = USE_DEEPSEEK ? 'deepseek-chat' : 'gpt-4o-mini';

  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: messages,
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

async function embed(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.data[0]?.embedding || [];
}

async function generateResume(
  resumeText: string,
  jobTitle: string,
  jobDescription: string
): Promise<string> {
  const systemPrompt = `You are an expert resume writer. Your task is to tailor a resume for a specific job.
Follow these rules:
1. Keep the resume to one page maximum
2. Use action verbs and quantifiable achievements
3. Highlight skills matching the job description
4. Maintain professional formatting
5. Remove irrelevant experience
6. Optimize for ATS (Applicant Tracking Systems)
7. Include keywords from the job description
8. Return ONLY the tailored resume text, no explanations or markdown commentary`;

  const userPrompt = `Tailor this resume for the "${jobTitle}" position.

Current Resume:
${resumeText}

Job Description:
${jobDescription}

Please provide a tailored resume that highlights relevant experience, incorporates keywords from the job description, and is ATS-friendly.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  return await chat(messages);
}

async function generateCoverLetter(
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  companyName: string
): Promise<string> {
  const systemPrompt = `You are an expert cover letter writer. Create compelling, personalized cover letters.
Guidelines:
1. 3-4 paragraphs maximum
2. Show genuine interest in the company
3. Match skills to job requirements
4. Tell a compelling professional story
5. End with a strong call-to-action
6. Maintain professional tone
7. Return ONLY the cover letter text, no explanations or markdown commentary`;

  const userPrompt = `Create a cover letter for applying to:
- Position: ${jobTitle}
- Company: ${companyName}

My Resume:
${resumeText}

Job Description:
${jobDescription}

Please write a personalized, compelling cover letter.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  return await chat(messages);
}

async function handleRequest(body: AIRequest): Promise<AIResponse> {
  try {
    switch (body.type) {
      case 'chat': {
        if (!body.messages || body.messages.length === 0) {
          return { ok: false, error: 'Missing messages' };
        }
        const result = await chat(body.messages);
        return { ok: true, result };
      }

      case 'embed': {
        if (!body.text) {
          return { ok: false, error: 'Missing text for embedding' };
        }
        const embedding = await embed(body.text);
        return { ok: true, embedding };
      }

      case 'resume': {
        if (!body.resumeText || !body.jobTitle || !body.jobDescription) {
          return {
            ok: false,
            error: 'Missing required fields: resumeText, jobTitle, jobDescription',
          };
        }
        const result = await generateResume(
          body.resumeText,
          body.jobTitle,
          body.jobDescription
        );
        return { ok: true, result };
      }

      case 'cover-letter': {
        if (!body.resumeText || !body.jobTitle || !body.jobDescription) {
          return {
            ok: false,
            error: 'Missing required fields: resumeText, jobTitle, jobDescription',
          };
        }
        const companyName = body.companyName || 'the company';
        const result = await generateCoverLetter(
          body.resumeText,
          body.jobTitle,
          body.jobDescription,
          companyName
        );
        return { ok: true, result };
      }

      default:
        return { ok: false, error: 'Unknown request type' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage === 'AI_NOT_CONFIGURED') {
      return {
        ok: false,
        error: 'AI service not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY.',
      };
    }

    console.error('AI Operation Error:', errorMessage);
    return { ok: false, error: errorMessage };
  }
}

serve(async (req) => {
  if (handleCors(req)) return new Response(null, { headers: getCorsHeaders(req.headers.get('origin')) });

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await req.json() as AIRequest;
    const result = await handleRequest(body);

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Request handling error:', errorMessage);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      }
    );
  }
});
