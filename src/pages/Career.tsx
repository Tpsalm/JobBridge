import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import PageHero from '../components/PageHero';
import AnimatedSection from '../components/AnimatedSection';
import Card3D from '../components/Card3D';
import { HERO_CAROUSELS } from '../lib/media';
import {
  Briefcase, Bell, ArrowRight, Check, GraduationCap, Users, Target,
  FileText, MessageCircle, BookOpen, Tv, Trophy, Calendar,
  Sparkles, Loader2, ChevronRight, Clock,
} from 'lucide-react';

const UPCOMING_FEATURES = [
  {
    icon: GraduationCap,
    title: 'Career Coaching',
    desc: 'One-on-one sessions with certified career coaches to help you define your professional path, build confidence, and land your dream role.',
    color: 'from-blue-500 to-blue-700',
    tag: 'Expert-Led',
  },
  {
    icon: Users,
    title: 'Mentorship Program',
    desc: 'Connect with experienced professionals in your field who will guide you, share industry insights, and help you grow your network.',
    color: 'from-emerald-500 to-emerald-700',
    tag: 'Community',
  },
  {
    icon: Target,
    title: 'Skill Assessments',
    desc: 'Take verified assessments to benchmark your skills, identify gaps, and receive personalized recommendations for improvement.',
    color: 'from-purple-500 to-purple-700',
    tag: 'Verify',
  },
  {
    icon: FileText,
    title: 'Professional Certifications',
    desc: 'Earn JobBridge-recognized certifications in customer service, digital skills, sales, and more — backed by industry standards.',
    color: 'from-amber-500 to-amber-700',
    tag: 'Certified',
  },
  {
    icon: Tv,
    title: 'Career Workshops & Webinars',
    desc: 'Attend live and recorded sessions on CV writing, interview techniques, personal branding, and navigating the job market.',
    color: 'from-rose-500 to-rose-700',
    tag: 'Live',
  },
  {
    icon: MessageCircle,
    title: 'Peer Networking Groups',
    desc: 'Join industry-specific groups to share opportunities, advice, and support with peers at every stage of their career journey.',
    color: 'from-cyan-500 to-cyan-700',
    tag: 'Network',
  },
  {
    icon: BookOpen,
    title: 'Learning Library',
    desc: 'Access a growing library of articles, guides, templates, and resources covering everything from job searching to career advancement.',
    color: 'from-indigo-500 to-indigo-700',
    tag: 'Resource',
  },
  {
    icon: Trophy,
    title: 'Career Challenges & Rewards',
    desc: 'Take on career-building challenges — complete your profile, apply to jobs, upskill — and earn badges, points, and rewards.',
    color: 'from-orange-500 to-orange-700',
    tag: 'Gamified',
  },
];

const ROADMAP = [
  { phase: 'Q3 2026', title: 'Beta Launch', items: ['Career coaching booking', 'Mentorship matching (manual)', 'Learning library', 'Skill assessment pilot'] },
  { phase: 'Q4 2026', title: 'Expansion', items: ['Certification exams live', 'Workshop & webinar calendar', 'Peer networking groups', 'AI-powered career recommendations'] },
  { phase: 'Q1 2027', title: 'Full Release', items: ['Automated mentorship matching', 'Gamified challenges & rewards', 'Employer-sponsored coaching', 'Career progress dashboard'] },
];

export default function Career() {
  const navigate = useNavigate();
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  const handleNotify = async () => {
    setNotifying(true);
    await new Promise(r => setTimeout(r, 1500));
    setNotifying(false);
    setNotified(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <PageHero compact title="Career Hub" subtitle="Your complete career growth ecosystem — coming soon" images={HERO_CAROUSELS.career || []} imageAlt="Career" overlay="dark" />

      <div className="max-w-6xl mx-auto px-4 -mt-6 relative z-10">
        {/* Intro Banner */}
        <AnimatedSection direction="up">
          <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 sm:p-8 text-white mb-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-blue-300 blur-3xl" />
            </div>
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-6 h-6 text-amber-300" />
                <span className="text-sm font-semibold text-blue-200 tracking-wider uppercase">What's Coming</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Your Career Growth Starts Here</h2>
              <p className="text-blue-100 max-w-2xl mb-6">
                We're building a complete career ecosystem — from coaching and mentorship to certifications and peer networks.
                Everything you need to advance your career, all in one place.
              </p>
              {notified ? (
                <div className="inline-flex items-center gap-2 bg-white/15 text-white px-5 py-2.5 rounded-lg text-sm font-semibold">
                  <Check className="w-4 h-4 text-emerald-300" />
                  You're on the list — we'll notify you at launch
                </div>
              ) : (
                <button
                  onClick={handleNotify}
                  disabled={notifying}
                  className="inline-flex items-center gap-2 bg-white text-blue-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  {notifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Subscribing...</> : <><Bell className="w-4 h-4" /> Get Notified When Live</>}
                </button>
              )}
            </div>
          </div>
        </AnimatedSection>

        {/* Upcoming Features */}
        <AnimatedSection direction="up" delay={100}>
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">What to Expect</h2>
            <p className="text-sm text-gray-500">Explore the tools and opportunities coming to your Career Hub.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {UPCOMING_FEATURES.map((f) => (
              <Card3D key={f.title} className="bg-white rounded-xl p-5 border border-gray-100" strength={4}>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center mb-3`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 text-sm">{f.title}</h3>
                  <span className="shrink-0 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{f.tag}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </Card3D>
            ))}
          </div>
        </AnimatedSection>

        {/* Roadmap */}
        <AnimatedSection direction="up" delay={200}>
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm mb-8">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-blue-700" />
              <h2 className="text-xl font-bold text-gray-900">Launch Roadmap</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {ROADMAP.map((phase) => (
                <div key={phase.phase} className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 font-semibold">{phase.phase}</p>
                      <p className="font-bold text-gray-900 text-sm">{phase.title}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 ml-10">
                    {phase.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                        <ChevronRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* CTA Banner */}
        <AnimatedSection direction="up" delay={300}>
          <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden mb-8">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-1/2 w-72 h-72 rounded-full bg-white blur-3xl -translate-x-1/2" />
            </div>
            <div className="relative">
              <GraduationCap className="w-10 h-10 text-amber-300 mx-auto mb-3" />
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Ready to Take the Next Step?</h2>
              <p className="text-blue-100 max-w-lg mx-auto mb-6">
                While the Career Hub is being built, start exploring jobs or connect with service providers today.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate('/jobs')}
                  className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  <Briefcase className="w-4 h-4" />
                  Browse Jobs
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/providers')}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-500 transition-colors border border-blue-500"
                >
                  <Users className="w-4 h-4" />
                  Find Service Providers
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>

      <BottomNav />
    </div>
  );
}