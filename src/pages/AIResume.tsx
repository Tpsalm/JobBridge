import { useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, FileText, Upload, Download, Send, Bot, ArrowRight, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Load PDF.js worker
let pdfWorkerInitialized = false;
const initPdfWorker = async () => {
  if (pdfWorkerInitialized) return;
  try {
    const pdfjsLib = (await import('pdfjs-dist')).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    pdfWorkerInitialized = true;
  } catch {
    console.warn('PDF.js not available, PDF parsing will be limited');
  }
};

// Extract text from PDF
async function extractPdfText(file: File): Promise<string> {
  try {
    await initPdfWorker();
    const { default: pdfjsLib } = await import('pdfjs-dist');
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Could not extract text from PDF. Try uploading a text-based PDF.');
  }
}

// AI features use direct OpenAI calls or local placeholders.
const AI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const AI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI(systemPrompt: string, userMessage: string): Promise<string> {
  if (!AI_API_KEY) {
    if (systemPrompt.includes('extract')) {
      const words = userMessage.split(/\s+/);
      const likelySkills = words.filter(w => w.length > 3 && /^(React|Node|Python|Java|AWS|Docker|Figma|SQL|TypeScript|JavaScript|CSS|HTML|Git|Agile|API|MongoDB)/i.test(w));
      return JSON.stringify({ skills: [...new Set(likelySkills)].slice(0, 15) });
    }
    if (systemPrompt.includes('tailor')) {
      return `Tailored resume for ${userMessage.split('\n')[0] || 'the role'}:\n\n• Led cross-functional teams to deliver projects on time and under budget\n• Improved key metrics by 35% through data-driven decision making\n• Developed and implemented strategic initiatives that drove 20% revenue growth\n• Collaborated with stakeholders to define requirements and deliver solutions\n• Mentored junior team members and fostered a culture of continuous improvement`;
    }
    if (systemPrompt.includes('cover')) {
      return `Dear Hiring Manager,\n\nI am writing to express my strong interest in the position. With my background and skills, I am confident I can make a significant contribution to your team.\n\nThroughout my career, I have developed expertise in delivering high-impact results. My experience includes leading projects, driving innovation, and collaborating effectively with cross-functional teams.\n\nI am excited about the opportunity to bring my skills to your organization.\n\nBest regards,\nApplicant`;
    }
    return 'AI service not configured. Set VITE_OPENAI_API_KEY in .env.local or your deployment environment to enable AI features.';
  }

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const errorMessage =
        data?.error?.message || data?.error || `OpenAI request failed with status ${res.status}`;
      console.error('[AIResume] OpenAI error:', res.status, data);
      throw new Error(errorMessage);
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[AIResume] OpenAI returned no content', data);
      throw new Error('AI service returned an empty response');
    }
    return content;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI service unavailable';
    throw new Error(message);
  }
}

export default function AIResume() {
  const { user, profile, aiSubscription } = useAuth();
  const navigate = useNavigate();
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tailoredResume, setTailoredResume] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFileName(file.name);
    setError('');
    try {
      let text = '';
      
      // Handle PDF files separately
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        text = await extractPdfText(file);
      } else {
        // For text, doc, docx files
        text = await file.text();
      }
      
      if (!text.trim()) {
        setError('Could not extract text from file. Try pasting the text directly.');
        return;
      }
      
      setResumeText(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read file. Try pasting the text directly.';
      setError(message);
      setResumeFileName('');
    }
    e.target.value = '';
  }

  async function extractSkills() {
    if (!resumeText.trim()) return;
    setExtracting(true);
    setError('');
    try {
      const result = await callOpenAI(
        'Extract technical and professional skills from the following resume text. Return them as a JSON array of strings under a "skills" key.',
        resumeText
      );
      const parsed = JSON.parse(result);
      if (parsed.skills) setSkills(parsed.skills);
    } catch {
      setError('Could not extract skills');
    }
    setExtracting(false);
  }

  async function handleTailorResume() {
    if (aiSubscription.ai_status !== 'active') { navigate('/pricing'); return; }
    if (!resumeText.trim() || !jobTitle.trim()) return;
    setLoading('tailor');
    setError('');
    try {
      const result = await callOpenAI(
        'You are a professional resume writer. Tailor the following resume for the specified job title and description. Return only the tailored resume text.',
        `Job Title: ${jobTitle}\nJob Description: ${jobDesc}\n\nResume:\n${resumeText}`
      );
      setTailoredResume(result);
    } catch {
      setError('Could not tailor resume');
    }
    setLoading('');
  }

  async function handleCoverLetter() {
    if (aiSubscription.ai_status !== 'active') { navigate('/pricing'); return; }
    if (!resumeText.trim() || !jobTitle.trim()) return;
    setLoading('cover');
    setError('');
    try {
      const result = await callOpenAI(
        'You are a professional cover letter writer. Generate a compelling cover letter based on the resume and job details provided.',
        `Job Title: ${jobTitle}\nCompany: ${companyName}\nJob Description: ${jobDesc}\n\nResume:\n${resumeText}`
      );
      setCoverLetter(result);
    } catch {
      setError('Could not generate cover letter');
    }
    setLoading('');
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI Resume Studio</h1>
            <p className="text-sm text-gray-500">Tailor your resume and generate cover letters with AI</p>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={async () => {
              // Quick CV generation smoke test using sample text
              const sample = `John Doe\nSoftware Engineer with 5 years experience in React, Node.js, AWS. Led teams and shipped products.`;
              setResumeText(sample);
              setJobTitle('Frontend Engineer');
              setJobDesc('Build responsive web applications using React and TypeScript.');
              setError('');
              try {
                setLoading('tailor');
                const tailored = await callOpenAI(
                  'You are a professional resume writer. Tailor the following resume for the specified job title and description. Return only the tailored resume text.',
                  `Job Title: Frontend Engineer\nJob Description: Build responsive web applications using React and TypeScript.\n\nResume:\n${sample}`
                );
                setTailoredResume(tailored);
                const cover = await callOpenAI(
                  'You are a professional cover letter writer. Generate a compelling cover letter based on the resume and job details provided.',
                  `Job Title: Frontend Engineer\nCompany: Acme\nJob Description: Build responsive web applications using React and TypeScript.\n\nResume:\n${sample}`
                );
                setCoverLetter(cover);
              } catch (e) {
                setError('CV test failed: ' + (e instanceof Error ? e.message : String(e)));
              } finally {
                setLoading('');
              }
            }}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition"
          >
            Run CV generation test
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {aiSubscription.ai_status !== 'active' && (
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
              <Lock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">AI Career Tools Require a Subscription</h2>
            <p className="text-sm text-gray-600 mb-4">Subscribe to unlock AI resume tailoring, cover letter generation, and more.</p>
            <button
              onClick={() => navigate('/pricing#ai')}
              className="inline-flex items-center gap-2 bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
            >
              View Pricing
            </button>
            <p className="mt-4 text-xs text-gray-500">
              If you want to test AI locally, add <code className="font-medium">VITE_OPENAI_API_KEY=YOUR_OPENAI_KEY</code> to <code className="font-medium">.env.local</code>, restart the dev server, and rebuild the site.
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <FileText className="w-4 h-4" /> Your Master Resume
              </label>
              <label className="flex items-center gap-2 mb-3 px-4 py-2.5 border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
                <Upload className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">{resumeFileName || 'Upload CV'}</span>
                <span className="text-xs text-gray-500">(.txt, .pdf, .doc)</span>
                <input type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleFileUpload} className="hidden" />
              </label>
              <textarea
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
                placeholder="Paste your full resume text here..."
                rows={8}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <button
                onClick={extractSkills}
                disabled={extracting || !resumeText.trim()}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <Bot className="w-4 h-4" /> {extracting ? 'Analyzing...' : 'Extract Skills'}
              </button>
            </div>

            {skills.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Extracted Skills ({skills.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map(s => (
                    <span key={s} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Target Job Details</h3>
              <div className="space-y-3">
                <input
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                  placeholder="Job title (e.g. Senior Frontend Engineer)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Company name (optional)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  value={jobDesc}
                  onChange={e => setJobDesc(e.target.value)}
                  placeholder="Paste job description here..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleTailorResume}
                    disabled={loading === 'tailor' || !resumeText.trim() || !jobTitle.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
                  >
                    {aiSubscription.ai_status !== 'active' ? <><Lock className="w-4 h-4" /> Subscribe to Unlock</> : loading === 'tailor' ? 'Generating...' : <><Sparkles className="w-4 h-4" /> Tailor Resume</>}
                  </button>
                  <button
                    onClick={handleCoverLetter}
                    disabled={loading === 'cover' || !resumeText.trim() || !jobTitle.trim()}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {aiSubscription.ai_status !== 'active' ? <><Lock className="w-4 h-4" /> Subscribe to Unlock</> : loading === 'cover' ? 'Generating...' : <><Send className="w-4 h-4" /> Cover Letter</>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Output */}
          <div className="space-y-4">
            {tailoredResume && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> Tailored Resume
                  </h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(tailoredResume)}
                    className="text-xs text-blue-700 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Copy
                  </button>
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg max-h-60 overflow-y-auto font-sans leading-relaxed">{tailoredResume}</pre>
              </div>
            )}

            {coverLetter && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-500" /> Cover Letter
                  </h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(coverLetter)}
                    className="text-xs text-blue-700 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Copy
                  </button>
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg max-h-60 overflow-y-auto font-sans leading-relaxed">{coverLetter}</pre>
              </div>
            )}

            {!tailoredResume && !coverLetter && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">AI-Powered Application Tools</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Paste your resume on the left, add the job details, and let AI generate a tailored resume and cover letter optimized for that specific role.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
