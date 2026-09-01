import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { useAuthRequired } from '../hooks/useAuthRequired';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Users,
  Briefcase,
  Calendar,
  Award,
  Eye,
  MessageSquare,
  Clock,
  CheckCircle,
  Edit,
  TrendingUp,
  Sparkles,
  Star,
  ChevronDown,
  ChevronUp,
  X,
  CreditCard,
  Download,
  FileText,
  ExternalLink,
  Lock,
} from 'lucide-react';
import PageHero from '../components/PageHero';
import VideoPlayer from '../components/VideoPlayer';
import { HERO_CAROUSELS, VIDEO } from '../lib/media';
import { supabase } from '../lib/supabase';
import { fetchApplications, updateApplicationStatus as updateAppStatus } from '../lib/supabaseQueries';
import { sendEmail } from '../lib/email';
import type { Job } from '../lib/supabase';
import AnimatedSection from '../components/AnimatedSection';
import Card3D from '../components/Card3D';

export default function Recruiter() {
  const { openModal } = useModal();
  const { openProtectedModal } = useAuthRequired();
  const { user, subscription, subscriptionLoaded } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [postJobOpened, setPostJobOpened] = useState(false);

  // Real jobs from database
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  async function fetchMyJobs() {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('recruiter_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) setMyJobs(data);
    } catch (e) {
      console.error('fetch my jobs error', e);
    } finally {
      setJobsLoading(false);
    }
  }

  useEffect(() => { fetchMyJobs(); }, [user?.id]);

  const shouldOpenPostJob = searchParams.get('postJob') === 'true';

  useEffect(() => {
    if (!shouldOpenPostJob || postJobOpened) return;
    setPostJobOpened(true);
    if (!subscriptionLoaded) return;

    if (subscription.status === 'active') {
      openProtectedModal({ action: 'post-job', requiredRole: 'recruiter' });
      navigate('/recruiter', { replace: true });
      return;
    }
    navigate('/pricing', { replace: true });
  }, [shouldOpenPostJob, postJobOpened, subscription.status, subscriptionLoaded, openProtectedModal, navigate]);

  // Refresh when jobs are posted
  useEffect(() => {
    const handler = () => fetchMyJobs();
    window.addEventListener('jobs:updated', handler);
    return () => window.removeEventListener('jobs:updated', handler);
  }, [user?.id]);

  const totalApplicants = myJobs.reduce((sum, j) => sum + (j.applications_count || 0), 0);

  const stats = [
    { label: 'Active Jobs', value: String(myJobs.filter(j => j.is_active).length), icon: Briefcase, color: 'bg-blue-50 text-blue-700' },
    { label: 'Candidates', value: String(totalApplicants), icon: Users, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Views', value: String(myJobs.reduce((sum, j) => sum + (j.views || 0), 0)), icon: Eye, color: 'bg-amber-50 text-amber-700' },
    { label: 'Total Posts', value: String(myJobs.length), icon: Award, color: 'bg-rose-50 text-rose-700' },
  ];

  // AI JD Generator state
  const [showAIJD, setShowAIJD] = useState(false);
  const [aiTitle, setAiTitle] = useState('');
  const [aiCompany, setAiCompany] = useState('');
  const [aiSalary, setAiSalary] = useState('');
  const [aiReqs, setAiReqs] = useState(['', '', '']);
  const [generating, setGenerating] = useState('');
  const [generatedJD, setGeneratedJD] = useState<any>(null);

  // AI Candidate scoring state
  const [scoringJob, setScoringJob] = useState('');
  const [scoredCandidates, setScoredCandidates] = useState<any[]>([]);

  // Applications state
  const [applications, setApplications] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [resumeError, setResumeError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function fetchApps() {
    try {
      const data = await fetchApplications(user?.id);
      setApplications(data);
    } catch (e) {
      console.error('fetch applications error', e);
    } finally {
      setAppsLoading(false);
    }
  }

  useEffect(() => { fetchApps(); }, [user?.id]);

  async function updateStatus(appId: string, status: string) {
    try {
      await updateAppStatus(appId, status);
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
      if (selectedApp?.id === appId) setSelectedApp({ ...selectedApp, status });
      // Send status update email to applicant
      const app = applications.find(a => a.id === appId);
      if (app?.applicant?.email) {
        sendEmail({
          type: 'application_status',
          email: app.applicant.email,
          name: app.applicant.full_name || 'there',
          jobTitle: app.job?.title,
          company: app.job?.company,
          status,
        });
      }
    } catch (e) {
      console.error('update status error', e);
    }
  }

  const filteredApps = statusFilter === 'all'
    ? applications
    : applications.filter(a => a.status === statusFilter);

  const filteredJobs = myJobs;

  // Rank the recruiter's job postings exactly as requested: Premium Job Post
  // first, then Standard Job Post, then Basic Job Post at the bottom. Legacy
  // posts without a plan (post_plan NULL) are treated as Basic.
  const jobPlanRank = (j: Job) => {
    const plan = (j.post_plan || 'basic').toLowerCase();
    if (plan === 'job_premium' || plan === 'premium') return 0;
    if (plan === 'job_standard' || plan === 'standard') return 1;
    return 2;
  };
  const sortedJobs = [...filteredJobs].sort((a, b) => jobPlanRank(a) - jobPlanRank(b));
  const premiumJobs = sortedJobs.filter(j => jobPlanRank(j) === 0);
  const standardJobs = sortedJobs.filter(j => jobPlanRank(j) === 1);
  const basicJobs = sortedJobs.filter(j => jobPlanRank(j) === 2);

  const candidates = [
    {
      name: 'Alex Chen',
      role: 'Frontend Developer',
      match: '96%',
      img: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    },
    {
      name: 'Mia Johnson',
      role: 'UX Designer',
      match: '91%',
      img: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    },
    {
      name: 'Sam Park',
      role: 'Full Stack Engineer',
      match: '88%',
      img: 'https://images.pexels.com/photos/1121796/pexels-photo-1121796.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    },
    {
      name: 'Lisa Wong',
      role: 'Product Manager',
      match: '85%',
      img: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    },
  ];

  async function handleGenerateJD() {
    if (!aiTitle.trim()) return;
    setGenerating('jd');
    setGeneratedJD(null);
    try {
      // AI features require a backend with OpenAI key.
      // Call OpenAI directly if you have VITE_OPENAI_API_KEY set, or use a Supabase Edge Function.
      // For now this is a placeholder — AI JD gen is disabled.
      setGeneratedJD({
        title: aiTitle,
        company: aiCompany,
        salary: aiSalary,
        description: `We are looking for a talented ${aiTitle} to join ${aiCompany.trim() || 'our team'}.`,
        responsibilities: ['Collaborate with cross-functional teams', 'Deliver high-quality work', 'Contribute to team goals'],
        requirements: aiReqs.filter(Boolean).length > 0 ? aiReqs.filter(Boolean) : ['Relevant experience', 'Strong communication skills'],
        benefits: ['Competitive salary', 'Health insurance', 'Flexible work hours'],
      });
    } catch (e) { /* ignore */ }
    setGenerating('');
  }

  async function handleScoreCandidates(jobTitle: string) {
    setScoringJob(jobTitle);
    setScoredCandidates([]);
    const sampleCandidates = [
      { id: '1', name: 'Alex Chen', skills: ['React', 'TypeScript', 'Node.js', 'JavaScript', 'AWS'], resume_text: 'Senior frontend engineer with 5 years of experience building scalable web applications using React and TypeScript.' },
      { id: '2', name: 'Mia Johnson', skills: ['Figma', 'UI Design', 'UX Design', 'Prototyping', 'User Research'], resume_text: 'UX designer with expertise in user research, wireframing, and building design systems for consumer products.' },
      { id: '3', name: 'Sam Park', skills: ['React', 'Node.js', 'Python', 'PostgreSQL', 'Docker', 'GCP'], resume_text: 'Full stack engineer experienced in building end-to-end features across the stack.' },
      { id: '4', name: 'Lisa Wong', skills: ['Product Management', 'Agile', 'JIRA', 'Data Analysis', 'Roadmapping'], resume_text: 'Product manager with 6 years experience defining product strategy and leading cross-functional teams.' },
    ];
    try {
      // AI scoring disabled — use placeholder ranking
      const ranked = sampleCandidates.map((c, i) => ({
        ...c,
        match_score: Math.round(85 - i * 8 + Math.random() * 10),
      })).sort((a: any, b: any) => b.match_score - a.match_score);
      setScoredCandidates(ranked);
    } catch (e) { /* ignore */ }
    setScoringJob('');
  }

  function getMatchColor(score: number) {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50';
    if (score >= 60) return 'text-amber-700 bg-amber-50';
    return 'text-red-700 bg-red-50';
  }

  const renderJobCard = (job: Job) => (
    <Card3D
      key={job.id}
      className="border border-gray-100 rounded-xl p-4 sm:p-5 hover:shadow-md transition-shadow"
      strength={6}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{job.title}</h3>
            {job.is_featured && <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-[10px] font-semibold rounded-full">Featured</span>}
            {!job.is_active && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded-full">Inactive</span>}
          </div>
          <p className="text-sm text-gray-500 mt-1">{job.company} · {job.location}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {job.applications_count || 0} applicant{(job.applications_count || 0) !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {job.views || 0} views
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {job.type}
            </span>
          </div>
          {job.salary_range && (
            <p className="text-xs font-medium text-green-700 mt-1.5">{job.salary_range}</p>
          )}
        </div>
        <div className="flex gap-2 sm:ml-3 self-end sm:self-auto">
          <button
            onClick={() => navigate(`/jobs?id=${job.id}`)}
            className="flex items-center gap-1.5 text-blue-700 font-medium text-sm px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View
          </button>
        </div>
      </div>
    </Card3D>
  );

  return (
    <div className="min-h-screen bg-stone-50 pb-20 md:pb-6">
      <Header />

      <PageHero
        title="Recruiter Dashboard"
        subtitle="Post jobs, review candidates, and fill roles faster with AI-powered matching"
        images={HERO_CAROUSELS.recruiter}
        imageAlt="Recruiter reviewing candidate profiles"
      />

      <AnimatedSection direction="up" className="mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-600 p-6 shadow-xl text-white border border-white/10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.24em] text-sky-200 font-semibold mb-2">
                  Recruiter offer
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold">
                  Recruiter subscription is free for the first month.
                </h2>
                <p className="mt-3 text-sm sm:text-base text-sky-100/90 leading-7">
                  Start posting jobs now and pay only from month two. You’ll receive daily JobBridge updates, email alerts, and live notification pop-ups for recruiter activity.
                </p>
              </div>
              <div className="rounded-3xl bg-white/10 px-5 py-4 text-sm sm:text-base font-semibold text-white border border-white/15 shadow-inner">
                No recruiter fee for month one.
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats Row */}
        <AnimatedSection direction="up">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 stagger-children stagger-visible">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <Card3D key={label} className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm" strength={6}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{value}</div>
                  <div className="text-xs text-gray-500 truncate">{label}</div>
                </div>
              </div>
            </Card3D>
          ))}
        </div>
        </AnimatedSection>

        {/* Subscription Status */}
        <AnimatedSection direction="up" className="mb-6">
          {subscription.status === 'active' ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-emerald-800 flex-wrap">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{subscription.credits} job post credit{subscription.credits !== 1 ? 's' : ''} remaining</span>
                {subscription.tier && (
                  <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded capitalize">{subscription.tier} plan</span>
                )}
              </div>
              <div className="text-xs text-emerald-700">First month is free for recruiters on new subscriptions.</div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-amber-800 flex-wrap">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <span className="font-medium">No active plan</span>
                <span className="text-xs text-amber-600">Subscribe to post jobs</span>
              </div>
              <Link to="/pricing" className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700 transition-colors inline-flex items-center">
                View Plans
              </Link>
            </div>
          )}
        </AnimatedSection>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-6">
          {/* Main Content */}
          <div>
            {/* Action Buttons Row */}
            <AnimatedSection direction="up"><div className="grid grid-cols-2 gap-3 mb-8">
              {subscription.status === 'active' ? (
                <button
                  onClick={() => openProtectedModal({ action: 'post-job', requiredRole: 'recruiter' })}
                  className="flex items-center justify-center gap-2 bg-blue-700 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-blue-800 transition-colors shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Post New Job
                </button>
              ) : (
                <Link
                  to="/pricing"
                  className="flex items-center justify-center gap-2 bg-blue-100 text-blue-500 font-semibold px-6 py-3.5 rounded-xl border-2 border-blue-200 hover:bg-blue-200 transition-colors shadow-lg"
                >
                  <Lock className="w-5 h-5" />
                  Subscribe to Post
                </Link>
              )}
              {subscription.status === 'active' ? (
                <button
                  onClick={() => setShowAIJD(!showAIJD)}
                  className={`flex items-center justify-center gap-2 font-semibold px-6 py-3.5 rounded-xl transition-colors shadow-lg ${
                    showAIJD ? 'bg-purple-700 text-white' : 'bg-white text-purple-700 border-2 border-purple-200 hover:bg-purple-50'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  AI Write Description
                </button>
              ) : (
                <Link
                  to="/pricing"
                  className="flex items-center justify-center gap-2 bg-purple-100 text-purple-500 font-semibold px-6 py-3.5 rounded-xl border-2 border-purple-200 hover:bg-purple-200 transition-colors shadow-lg"
                >
                  <Lock className="w-5 h-5" />
                  Subscribe to AI Write
                </Link>
              )}
            </div></AnimatedSection>

            {/* AI Job Description Generator */}
            {showAIJD && (
              <AnimatedSection direction="up"><div className="bg-white rounded-2xl border border-purple-200 shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" /> AI Job Description Writer
                  </h3>
                  <button onClick={() => setShowAIJD(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-4">Enter the job title, company name, salary range, and up to 3 core requirements. AI will generate an optimized, bias-free job description you can review and publish.</p>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Job Title *</label>
                    <input
                      value={aiTitle}
                      onChange={e => setAiTitle(e.target.value)}
                      placeholder="Job title (e.g. Senior Frontend Engineer)"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Company Name</label>
                    <input
                      value={aiCompany}
                      onChange={e => setAiCompany(e.target.value)}
                      placeholder="Company name (e.g. TechStream Ltd.)"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Salary Range</label>
                    <input
                      value={aiSalary}
                      onChange={e => setAiSalary(e.target.value)}
                      placeholder="Salary range (e.g. ₦300,000 – ₦450,000)"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  {aiReqs.map((req, i) => (
                    <input
                      key={i}
                      value={req}
                      onChange={e => {
                        const next = [...aiReqs];
                        next[i] = e.target.value;
                        setAiReqs(next);
                      }}
                      placeholder={`Core requirement ${i + 1} (e.g. 5+ years React experience)`}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  ))}
                  <button
                    onClick={handleGenerateJD}
                    disabled={generating === 'jd' || !aiTitle.trim()}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-800 disabled:opacity-50 transition-colors"
                  >
                    {generating === 'jd' ? 'Generating...' : <><Sparkles className="w-4 h-4" /> Generate Description</>}
                  </button>
                </div>

                {generatedJD && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-3">{generatedJD.title}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Company Name</label>
                        <input
                          value={aiCompany}
                          onChange={e => { setAiCompany(e.target.value); setGeneratedJD({ ...generatedJD, company: e.target.value }); }}
                          placeholder="Company name"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Salary Range</label>
                        <input
                          value={aiSalary}
                          onChange={e => { setAiSalary(e.target.value); setGeneratedJD({ ...generatedJD, salary: e.target.value }); }}
                          placeholder="e.g. ₦300,000 – ₦450,000"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{generatedJD.description}</p>

                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Responsibilities:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-0.5">
                        {(generatedJD.responsibilities || []).map((r: string, i: number) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Requirements:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-0.5">
                        {(generatedJD.requirements || []).map((r: string, i: number) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Benefits:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-0.5">
                        {(generatedJD.benefits || []).map((b: string, i: number) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => openProtectedModal({
                        action: 'post-job',
                        requiredRole: 'recruiter',
                        modalData: {
                          autoPublish: true,
                          title: generatedJD.title,
                          description: generatedJD.description,
                          company: generatedJD.company || user?.user_metadata?.company || '',
                          salary: generatedJD.salary || '',
                          requirements: generatedJD.requirements,
                          benefits: generatedJD.benefits,
                        },
                      })}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Publish This Job
                    </button>
                  </div>
                )}
              </div></AnimatedSection>
            )}

            {/* Active Jobs */}
            <AnimatedSection direction="up"><div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Active Job Postings ({filteredJobs.length})</h2>
              </div>

              <div className="space-y-4 stagger-children stagger-visible">
                {jobsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="text-center py-8">
                    <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium">No jobs posted yet</p>
                    <p className="text-sm text-gray-400 mt-1">Click "Post New Job" to create your first listing.</p>
                  </div>
                ) : (
                  <>
                    {/* Premium Job Post — paid subscribers top the page */}
                    {premiumJobs.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-pink-600" />
                          <h3 className="font-semibold text-gray-900">Premium Job Post</h3>
                          <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-medium">{premiumJobs.length}</span>
                        </div>
                        <div className="space-y-4">
                          {premiumJobs.map(job => renderJobCard(job))}
                        </div>
                      </div>
                    )}

                    {/* Standard Job Post */}
                    {standardJobs.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Award className="w-4 h-4 text-blue-600" />
                          <h3 className="font-semibold text-gray-900">Standard Job Post</h3>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{standardJobs.length}</span>
                        </div>
                        <div className="space-y-4">
                          {standardJobs.map(job => renderJobCard(job))}
                        </div>
                      </div>
                    )}

                    {/* Basic Job Post — at the bottom */}
                    {basicJobs.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Briefcase className="w-4 h-4 text-slate-500" />
                          <h3 className="font-semibold text-gray-900">Basic Job Post</h3>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{basicJobs.length}</span>
                        </div>
                        <div className="space-y-4">
                          {basicJobs.map(job => renderJobCard(job))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div></AnimatedSection>

            {/* Applications Panel */}
            <AnimatedSection direction="up"><div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Applications ({filteredApps.length})</h2>
              </div>

              {appsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : selectedApp ? (
                /* Application Detail View */
                <div>
                  <button onClick={() => setSelectedApp(null)} className="flex items-center gap-1 text-sm text-blue-700 hover:underline mb-4">
                    <ChevronUp className="w-4 h-4" /> Back to all applications
                  </button>
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg break-words">{selectedApp.professional_headline || selectedApp.applicant?.professional_headline || 'Applicant'}</h3>
                        <p className="text-sm text-gray-500">{selectedApp.applicant?.full_name || 'Applicant'} · {selectedApp.applicant?.email}</p>
                        <p className="text-xs text-gray-400">Applied for: {selectedApp.job?.title || 'Job'} · {new Date(selectedApp.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${
                        selectedApp.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        selectedApp.status === 'shortlisted' ? 'bg-green-100 text-green-700' :
                        selectedApp.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                        selectedApp.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        selectedApp.status === 'hired' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}>{selectedApp.status}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-500">DOB:</span> <span className="font-medium">{selectedApp.date_of_birth || selectedApp.applicant?.date_of_birth || '-'}</span></div>
                      <div><span className="text-gray-500">Gender:</span> <span className="font-medium capitalize">{selectedApp.gender || selectedApp.applicant?.gender || '-'}</span></div>
                      <div><span className="text-gray-500">Experience:</span> <span className="font-medium">{selectedApp.years_of_experience || selectedApp.applicant?.years_of_experience || '-'}</span></div>
                      <div><span className="text-gray-500">Function:</span> <span className="font-medium">{selectedApp.function || selectedApp.applicant?.function || '-'}</span></div>
                      <div><span className="text-gray-500">Work Type:</span> <span className="font-medium">{selectedApp.work_type || selectedApp.applicant?.work_type || '-'}</span></div>
                      <div><span className="text-gray-500">Qualification:</span> <span className="font-medium">{selectedApp.highest_qualification || selectedApp.applicant?.highest_qualification || '-'}</span></div>
                      <div><span className="text-gray-500">Location:</span> <span className="font-medium">{selectedApp.location || selectedApp.applicant?.location || '-'}</span></div>
                      <div><span className="text-gray-500">Availability:</span> <span className="font-medium">{selectedApp.availability || selectedApp.applicant?.availability || '-'}</span></div>
                      <div className="col-span-2"><span className="text-gray-500">Salary:</span> <span className="font-medium">{selectedApp.salary_expectation || selectedApp.applicant?.salary_expectation ? `NGN ${Number.parseInt(selectedApp.salary_expectation || selectedApp.applicant?.salary_expectation || '0', 10).toLocaleString()}` : '-'}</span></div>
                    </div>

                    {(selectedApp.is_disabled || selectedApp.applicant?.is_disabled) === 'yes' ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">PWD</span> : null}
                    {(selectedApp.is_displaced || selectedApp.applicant?.is_displaced) === 'yes' ? <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded ml-2">Internally Displaced</span> : null}

                    {selectedApp.cover_letter && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Cover Letter:</p>
                        <p className="text-sm text-gray-600 bg-white rounded-lg p-3 border border-gray-200">{selectedApp.cover_letter}</p>
                      </div>
                    )}

                    {selectedApp.resume_url && (
                        <div>
                          <button
                            onClick={async () => {
                              setResumeError('');
                          const url = selectedApp.resume_url;
                            const pathMatch = url.match(/\/resumes\/([^?]+)/);
                            const path = pathMatch ? decodeURIComponent(pathMatch[1]) : null;
                          if (!path) {
                              setResumeError('This resume link is invalid. Ask the applicant to upload it again.');
                            return;
                          }
                          try {
                            const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path, 3600);
                            if (error) throw error;
                            if (data?.signedUrl) {
                              window.open(data.signedUrl, '_blank');
                            } else {
                              window.open(url, '_blank');
                            }
                          } catch (err) {
                            console.error('Error generating signed URL:', err);
                            setResumeError('Unable to fetch this resume. Please try again or ask the applicant to upload it again.');
                          }
                          }}
                          className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline bg-transparent border-none cursor-pointer p-0"
                        >
                          <Download className="w-4 h-4" /> Download CV
                        </button>
                        {resumeError && <p className="mt-2 text-xs text-red-600">{resumeError}</p>}
                      </div>
                    )}

                    {/* Status actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      {selectedApp.status !== 'shortlisted' && (
                        <button onClick={() => updateStatus(selectedApp.id, 'shortlisted')}
                          className="flex-1 text-sm bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
                          Shortlist
                        </button>
                      )}
                      {selectedApp.status !== 'reviewed' && (
                        <button onClick={() => updateStatus(selectedApp.id, 'reviewed')}
                          className="flex-1 text-sm bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                          Mark Reviewed
                        </button>
                      )}
                      {selectedApp.status !== 'rejected' && (
                        <button onClick={() => updateStatus(selectedApp.id, 'rejected')}
                          className="flex-1 text-sm bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors">
                          Reject
                        </button>
                      )}
                      {selectedApp.status !== 'hired' && (
                        <button onClick={() => updateStatus(selectedApp.id, 'hired')}
                          className="flex-1 text-sm bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                          Hire
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : filteredApps.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No applications yet</p>
                  <p className="text-sm text-gray-400 mt-1">Applications from job seekers will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredApps.map((app: any) => (
                    <Card3D key={app.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedApp(app)} strength={6}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 text-sm">{app.applicant?.full_name || 'Anonymous'}</h3>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                              app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              app.status === 'shortlisted' ? 'bg-green-100 text-green-700' :
                              app.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                              app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              app.status === 'hired' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                            }`}>{app.status}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-700">{app.professional_headline || app.applicant?.professional_headline || 'Applicant'}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {app.function} · {app.location} · {app.years_of_experience} exp · NGN {parseInt(app.salary_expectation || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">Applied for: {app.job?.title || 'Job'} · {new Date(app.created_at).toLocaleDateString()}</p>
                        </div>
                      <ChevronDown className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
                    </div>
                  </Card3D>
                ))}
                </div>
              )}
            </div></AnimatedSection>

            {/* Recruiting Tips Video */}
            <AnimatedSection direction="up"><div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Hire smarter with JobBridge</h2>
              <VideoPlayer
                src={VIDEO.recruiterDemo.src}
                poster={VIDEO.recruiterDemo.poster}
                title="Recruiter platform demo"
              />
            </div></AnimatedSection>

            {/* Premium Banner */}
            <AnimatedSection direction="up"><div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 sm:p-6 text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full bg-white blur-3xl" />
              </div>
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-bold mb-2">Upgrade to Premium</h3>
                  <p className="text-blue-100 text-sm">
                    Get advanced analytics, unlimited job postings, and priority candidate matching.
                  </p>
                </div>
                <Link to="/pricing" className="shrink-0 bg-white text-blue-700 font-semibold px-4 sm:px-6 py-2.5 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap inline-flex items-center self-start sm:self-auto">
                  {subscription.status === 'active' ? 'Get More Credits' : 'Subscribe Now'}
                </Link>
              </div>
            </div></AnimatedSection>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
