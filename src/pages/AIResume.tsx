import { useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, FileText, Upload, Download, Send, Bot, ArrowRight, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LOCAL_API_URL } from '../lib/supabase';

export default function AIResume() {
  const { user, profile, aiSubscription } = useAuth();
  const navigate = useNavigate();
  const [resumeText, setResumeText] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tailoredResume, setTailoredResume] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const token = localStorage.getItem('jobbridge_token');

  async function extractSkills() {
    if (!resumeText.trim()) return;
    setExtracting(true);
    setError('');
    try {
      const resp = await fetch(LOCAL_API_URL + '/ai/extract-skills', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ text: resumeText }),
      });
      const data = await resp.json();
      if (data.success) setSkills(data.skills || []);
      else setError(data.error || 'Failed to extract skills');
    } catch (e) {
      setError('Could not connect to AI service');
    }
    setExtracting(false);
  }

  async function handleTailorResume() {
    if (!resumeText.trim() || !jobTitle.trim()) return;
    setLoading('tailor');
    setError('');
    try {
      const resp = await fetch(LOCAL_API_URL + '/ai/tailor-resume', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ resume_text: resumeText, job_description: jobDesc, job_title: jobTitle }),
      });
      const data = await resp.json();
      if (data.success) setTailoredResume(data.tailored_resume);
      else setError(data.error || 'Failed');
    } catch (e) {
      setError('Could not connect to AI service');
    }
    setLoading('');
  }

  async function handleCoverLetter() {
    if (!resumeText.trim() || !jobTitle.trim()) return;
    setLoading('cover');
    setError('');
    try {
      const resp = await fetch(LOCAL_API_URL + '/ai/generate-cover-letter', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ resume_text: resumeText, job_description: jobDesc, job_title: jobTitle, company_name: companyName }),
      });
      const data = await resp.json();
      if (data.success) setCoverLetter(data.cover_letter);
      else setError(data.error || 'Failed');
    } catch (e) {
      setError('Could not connect to AI service');
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
              onClick={() => navigate('/pricing')}
              className="inline-flex items-center gap-2 bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
            >
              View Pricing
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <FileText className="w-4 h-4" /> Your Master Resume
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
                    {loading === 'tailor' ? 'Generating...' : <><Sparkles className="w-4 h-4" /> Tailor Resume</>}
                  </button>
                  <button
                    onClick={handleCoverLetter}
                    disabled={loading === 'cover' || !resumeText.trim() || !jobTitle.trim()}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {loading === 'cover' ? 'Generating...' : <><Send className="w-4 h-4" /> Cover Letter</>}
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
