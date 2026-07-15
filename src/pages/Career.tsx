import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { supabase } from '../lib/supabase';
import { fetchJobs } from '../lib/supabaseQueries';
import { sendEmail } from '../lib/email';
import {
  Briefcase, Bell, ArrowRight, Check, GraduationCap, Users, Target,
  FileText, MessageCircle, BookOpen, Tv, Trophy, Calendar,
  Sparkles, Loader2, ChevronRight, Clock, Star, MapPin, Send, Mail
} from 'lucide-react';

const UPCOMING_FEATURES = [
  {
    icon: GraduationCap,
    title: 'Career Coaching',
    desc: 'One-on-one sessions with certified career coaches to define your path and land your dream role.',
    color: 'from-blue-500 to-indigo-600',
    tag: 'Expert-Led',
  },
  {
    icon: Users,
    title: 'Mentorship Program',
    desc: 'Connect with experienced professionals in your field who will guide you and share industry insights.',
    color: 'from-emerald-500 to-teal-600',
    tag: 'Community',
  },
  {
    icon: Target,
    title: 'Skill Assessments',
    desc: 'Take verified assessments to benchmark your skills and receive personalized recommendations.',
    color: 'from-purple-500 to-pink-600',
    tag: 'Verify',
  },
  {
    icon: FileText,
    title: 'Professional Certifications',
    desc: 'Earn JobBridge-recognized certifications in customer service, coding, and sales.',
    color: 'from-amber-500 to-orange-600',
    tag: 'Certified',
  },
  {
    icon: Tv,
    title: 'Workshops & Webinars',
    desc: 'Attend live and recorded sessions on CV writing, branding, and navigating the job market.',
    color: 'from-rose-500 to-red-600',
    tag: 'Live',
  },
  {
    icon: MessageCircle,
    title: 'Networking Groups',
    desc: 'Join industry-specific groups to share opportunities and support with peers.',
    color: 'from-cyan-500 to-blue-600',
    tag: 'Network',
  },
];

const ROADMAP = [
  { phase: 'Q3 2026', title: 'Beta Launch', items: ['Career coaching booking', 'Learning library', 'Skill assessment pilot'], gradient: 'from-blue-500 to-indigo-600' },
  { phase: 'Q4 2026', title: 'Expansion', items: ['Certification exams live', 'Workshop calendar', 'Peer networking groups'], gradient: 'from-emerald-500 to-teal-600' },
  { phase: 'Q1 2027', title: 'Full Release', items: ['Automated matching', 'Gamified rewards & badges', 'Progress dashboard'], gradient: 'from-purple-500 to-pink-600' },
];

export default function Career() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'roadmap'>('overview');
  const [emailInput, setEmailInput] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribeError, setSubscribeError] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Fetch dynamic listings from Database
  useEffect(() => {
    async function loadJobs() {
      try {
        setJobsLoading(true);
        const data = await fetchJobs();
        setJobs(data || []);
      } catch (err) {
        console.error('Error fetching jobs:', err);
      } finally {
        setJobsLoading(false);
      }
    }
    loadJobs();
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSubscribing(true);
    setSubscribeError('');

    try {
      const { error } = await supabase
        .from('blog_subscribers')
        .insert([{ email: emailInput.trim().toLowerCase() }]);

      if (error) {
        if (error.code === '23505') {
          // Unique violation
          setSubscribed(true);
        } else {
          throw error;
        }
      } else {
        setSubscribed(true);
      }

      void sendEmail({
        type: 'subscription',
        email: emailInput.trim().toLowerCase(),
      });
    } catch (err: any) {
      setSubscribeError(err.message || 'Failed to subscribe. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <Header />

      {/* Hero Banner with Background Gradient Cover */}
      <div className="relative h-48 sm:h-56 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-blue-600 to-teal-500" />
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-8 left-[15%] w-36 h-36 bg-white/20 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-6 right-[20%] w-48 h-48 bg-purple-300/25 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }} />
        <div className="max-w-6xl mx-auto px-4 h-full flex flex-col justify-end pb-8 relative z-10 text-white">
          <span className="text-[10px] font-bold uppercase tracking-widest text-teal-300 bg-white/10 px-2.5 py-1 rounded-md w-fit mb-2 backdrop-blur-sm border border-white/10">Coming Soon</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">JobBridge Career Hub</h1>
          <p className="text-xs sm:text-sm text-white/80 max-w-xl mt-1">Your comprehensive professional ecosystem for upskilling, mentorship, and career growth.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-6 pb-24 relative z-10">
        
        {/* Navigation Tabs (Overview, Dynamic Jobs, Roadmap) */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 hide-scrollbar">
          {[
            { id: 'overview', title: 'Hub Overview', icon: GraduationCap, color: 'from-blue-500 to-indigo-600' },
            { id: 'jobs', title: 'Featured Jobs', icon: Briefcase, color: 'from-emerald-500 to-teal-600' },
            { id: 'roadmap', title: 'Timeline & Roadmap', icon: Clock, color: 'from-purple-500 to-pink-600' },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-md border border-gray-100 scale-[1.02]'
                    : 'bg-white/50 text-gray-500 hover:bg-white hover:text-gray-700 border border-transparent'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                  isActive ? `bg-gradient-to-br ${tab.color} text-white shadow-sm` : 'bg-gray-100 text-gray-400'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                {tab.title}
              </button>
            );
          })}
        </div>

        {/* ─── TAB 1: OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <div className="space-y-6" style={{ animation: 'pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {UPCOMING_FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group cursor-default"
                  >
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 text-white shadow-sm`}>
                      <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-800 text-sm">{f.title}</h3>
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-md">{f.tag}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Newsletter signup panel */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 rounded-full -translate-y-8 translate-x-8 blur-2xl pointer-events-none" />
              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 text-center md:text-left">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded">Stay Updated</span>
                  <h3 className="text-xl font-bold text-gray-900 mt-2">Get Beta Access & Launch Alerts</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-md">Subscribe to be notified the instant these tools go live and secure your spot in our early-access coaching cohorts.</p>
                </div>
                <div className="w-full md:w-auto shrink-0 min-w-[280px]">
                  {subscribed ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center text-emerald-700 flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">You're on the list!</p>
                        <p className="text-xs text-emerald-600/80">We'll alert you the moment the hub launches.</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubscribe} className="flex gap-2">
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        placeholder="yourname@domain.com"
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 bg-gray-50/50 focus:bg-white transition-all"
                      />
                      <button
                        type="submit"
                        disabled={subscribing}
                        className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-semibold text-xs hover:shadow-lg transition-all flex items-center gap-1.5"
                      >
                        {subscribing ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Notify Me
                      </button>
                    </form>
                  )}
                  {subscribeError && (
                    <p className="text-[11px] text-rose-500 font-medium mt-2">{subscribeError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: DYNAMIC JOBS ─── */}
        {activeTab === 'jobs' && (
          <div className="space-y-6" style={{ animation: 'pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                <Briefcase className="w-4.5 h-4.5 text-emerald-500" />
                Featured Database Opportunities
              </h2>
              <p className="text-xs text-gray-500 mb-4">Live job postings fetched dynamically from our Postgres server database.</p>

              {jobsLoading ? (
                <div className="py-12 flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-100 border-t-emerald-500 animate-spin" />
                  <p className="text-xs text-gray-500">Querying database...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No active jobs found in the database. Please post a job as recruiter to see it listed here dynamically!
                </div>
              ) : (
                <div className="space-y-3.5">
                  {jobs.slice(0, 5).map(job => (
                    <div
                      key={job.id}
                      onClick={() => navigate('/jobs')}
                      className="border border-gray-100 bg-gray-50/50 hover:bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-sm hover:border-gray-200 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                    >
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm hover:text-blue-600 transition-colors">{job.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{job.company}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                            <MapPin className="w-3 h-3" /> {job.location}
                          </span>
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">{job.type}</span>
                        </div>
                      </div>
                      <button className="text-xs bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 px-3.5 py-1.5 rounded-lg text-gray-700 font-semibold transition-all flex items-center gap-1">
                        Apply Now
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTA panel */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden text-white">
              <h3 className="text-lg font-bold">Ready to Start Your Search?</h3>
              <p className="text-xs text-white/80 max-w-md mx-auto mt-1 mb-4">View the entire catalog of hundreds of jobs posted across Nigerian companies.</p>
              <button
                onClick={() => navigate('/jobs')}
                className="bg-white text-indigo-700 font-semibold px-6 py-2.5 rounded-xl text-xs hover:bg-indigo-50 transition-all inline-flex items-center gap-1 shadow-md hover:shadow-lg"
              >
                Browse All Listings
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB 3: ROADMAP ─── */}
        {activeTab === 'roadmap' && (
          <div className="space-y-6" style={{ animation: 'pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-gray-800">Launch Milestones</h2>
              </div>

              <div className="relative border-l-2 border-indigo-100 ml-3.5 space-y-8 py-2">
                {ROADMAP.map((phase) => (
                  <div key={phase.phase} className="relative pl-7 group">
                    {/* Floating checkpoint icon */}
                    <div className="absolute -left-[11px] top-0.5 w-5 h-5 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">{phase.phase}</span>
                      <h4 className="font-bold text-gray-800 text-sm mt-1">{phase.title}</h4>
                      <ul className="grid sm:grid-cols-2 gap-2 mt-3 pl-0">
                        {phase.items.map(item => (
                          <li key={item} className="flex items-center gap-2 text-xs text-gray-500">
                            <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  );
}