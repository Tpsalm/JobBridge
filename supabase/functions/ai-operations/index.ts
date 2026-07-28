import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

// Read keys from Supabase secret environment
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

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
  if (!DEEPSEEK_API_KEY) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${error}`);
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
        error: 'AI service not configured. Please set DEEPSEEK_API_KEY in Supabase secrets.',
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
