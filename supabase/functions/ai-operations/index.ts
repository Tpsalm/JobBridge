import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

// Read keys from Supabase secret environment
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || Deno.env.get('VITE_DEEPSEEK_API_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('VITE_OPENAI_API_KEY') || '';

interface AIRequest {
  type: 'status' | 'chat' | 'embed' | 'resume' | 'cover-letter';
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

function sanitizeMarkdownOutput(text: string): string {
  return String(text ?? '')
    .trim()
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

async function generateResume(
  resumeText: string,
  jobTitle: string,
  jobDescription: string
): Promise<string> {
  const systemPrompt = `You are a Principal Technical Resume Writer and ATS Compliance Architect specializing in the United States corporate hiring standard. Your job is to parse raw user career history and output a highly optimized, high-impact resume.

[US ATS COMPLIANCE ARCHITECTURE]
- Font Strategy Layout: Emulate a clean, single-column design. Do not use columns, tables, graphics, headers, or footers in the text output, as these break ATS parsers.
- Chronological Order: Work history and education must be presented in reverse chronological order (most recent first).
- Quantified Impact: Every bullet point in the professional history section must utilize the Google X-Y-Z formula: 'Accomplished [X] as measured by [Y], by doing [Z]' using strong action verbs (e.g., Spearheaded, Architected, Engineered).
- Factual Integrity: Use only facts supported by the source career history. Never invent names, dates, credentials, tools, responsibilities, or metrics. Apply X-Y-Z with supplied metrics; when no metric is supplied, write a truthful impact-focused bullet without fabricating one.

[REQUIRED 8 PROFESSIONAL SECTIONS]
Use these exact section headings, once each, in this order:
1. PROFESSIONAL CONTACT SUMMARY (name, title, location, LinkedIn, portfolio link)
2. EXECUTIVE SUMMARY (3-4 sentences covering value proposition, experience, and domain expertise)
3. CORE COMPETENCIES & EXPERTISE (hard skills, technical tools, and frameworks as simple bullets)
4. PROFESSIONAL EXPERIENCE (company, location, role, dates, and 3-5 impact-focused bullets per role)
5. TECHNICAL PROJECTS (project, tech stack, role, and architectural or performance outcomes)
6. EDUCATION & CREDENTIALS (degree, major, institution, graduation year, and supported distinctions)
7. CERTIFICATIONS & LICENSES (credential, issuing authority, and dates when supplied)
8. LEADERSHIP & AWARDS (volunteering, publications, open-source contributions, and awards when supplied)

[OUTPUT RULES]
Output the content directly in clean Markdown (or the application's exact target JSON scheme). Do not add any conversational filler before or after the resume (e.g., do not say 'Here is your resume'). Start immediately with Section 1.`;

  const userPrompt = `Tailor and rewrite the candidate's raw career history into a US-standard ATS-compliant resume for the "${jobTitle}" role.

Raw career history:
${resumeText}

Target role:
${jobTitle}

Target job description:
${jobDescription}

Requirements:
- Use exact section names and order listed above.
- Use reverse chronological work and education order.
- Keep the single-column, ATS-safe structure.
- Use the Google X-Y-Z formula for PROFESSIONAL EXPERIENCE bullets when the source provides the facts and metrics; never invent a metric to satisfy the formula.
- Do not infer or fabricate missing contact details, dates, qualifications, achievements, or credentials. Omit unavailable facts rather than inserting placeholders.
- Include relevant keywords from the job description without keyword stuffing.
- Remove filler, generic summaries, and anything not directly relevant to the target role.
- Format as clean Markdown only. Start immediately with the first section header and do not include any extra intro or closing text.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const result = await chat(messages);
  return sanitizeMarkdownOutput(result);
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
      case 'status': {
        if (!DEEPSEEK_API_KEY) {
          return { ok: false, error: 'AI service not configured. Please set DEEPSEEK_API_KEY in Supabase secrets.' };
        }
        return { ok: true, result: 'DeepSeek API key is configured.' };
      }

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
