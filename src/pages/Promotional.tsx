import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { pexel } from '../lib/media';
import { ArrowRight, Search, Users, Zap } from 'lucide-react';

const slides = [
  {
    title: 'Discover verified employers hiring now',
    subtitle: 'Explore thousands of active roles across top companies with trusted employer verification and real-time openings.',
    primary: { label: 'Find Jobs', href: '/jobs' },
    secondary: { label: 'See Employer Trust', href: '/providers' },
    image: pexel(5668855, 1400, 700),
  },
  {
    title: 'Hire talent with AI-powered matching',
    subtitle: 'Connect to vetted professionals instantly and scale your team with our intelligent talent search engine.',
    primary: { label: 'Hire Talent', href: '/providers' },
    secondary: { label: 'Talent Search', href: '/talent-search' },
    image: pexel(3771111, 1400, 700),
  },
  {
    title: 'Build an AI-optimized career profile',
    subtitle: 'Create a resume and profile that stands out to recruiters using JobBridge AI insights and tailored recommendations.',
    primary: { label: 'AI Resume', href: '/ai-resume' },
    secondary: { label: 'Complete Profile', href: '/profile' },
    image: pexel(8456191, 1400, 700),
  },
];

const tickerItems = [
  '24,500+ jobs actively hiring now',
  'Average placement time: 24 days',
  '500+ new talent connections daily',
  'AI career matches updated every minute',
  'Verified recruiters trust JobBridge for talent sourcing',
];

export default function Promotional() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6500);
    return () => clearInterval(interval);
  }, []);

  const currentSlide = slides[currentIndex];
  const pager = useMemo(
    () => slides.map((_, index) => index),
    [],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
    isDragging.current = true;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || startX.current === null) return;
    const delta = event.clientX - startX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
      } else {
        setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
      }
    }
    isDragging.current = false;
    startX.current = null;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-90"
          style={{ backgroundImage: `url(${currentSlide.image})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/50 to-slate-950/90" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div
            className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-center"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <div className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 shadow-lg shadow-slate-950/40 backdrop-blur-sm">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Live career insights updated every minute
              </div>
              <div className="space-y-6">
                <p className="text-3xl font-semibold uppercase tracking-[0.26em] text-emerald-300 sm:text-4xl lg:text-5xl">
                  {currentSlide.title}
                </p>
                <p className="max-w-2xl text-lg leading-8 text-slate-200/90 sm:text-xl">
                  {currentSlide.subtitle}
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link
                  to={currentSlide.primary.href}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  {currentSlide.primary.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={currentSlide.secondary.href}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/80 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:text-white"
                >
                  {currentSlide.secondary.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-2 ring-1 ring-slate-700">
                  <Search className="h-4 w-4 text-emerald-300" /> Real-time job discovery
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-2 ring-1 ring-slate-700">
                  <Users className="h-4 w-4 text-sky-300" /> Verified employer network
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-2 ring-1 ring-slate-700">
                  <Zap className="h-4 w-4 text-violet-300" /> AI-powered career guidance
                </span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/70 shadow-2xl shadow-slate-950/40">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-slate-950/20" />
              <div className="relative h-[420px] px-8 py-10 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-full bg-white/5 px-4 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    Verified employers only
                  </div>
                  <h2 className="text-3xl font-bold text-white">Career momentum starts here</h2>
                  <p className="max-w-xl text-slate-300 leading-7">
                    Swipe the slides to explore what JobBridge can do for your career or hiring journey — from talent search to AI resume building.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/20">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Trusted hiring</p>
                    <p className="mt-3 text-2xl font-semibold text-white">2,300+</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/20">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Fast placements</p>
                    <p className="mt-3 text-2xl font-semibold text-white">24 days avg.</p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Swipe to preview
                </div>
                <div className="flex items-center gap-2">
                  {pager.map((step) => (
                    <button
                      key={step}
                      onClick={() => setCurrentIndex(step)}
                      className={`h-2.5 rounded-full transition-all duration-300 ${step === currentIndex ? 'w-8 bg-emerald-300' : 'w-3 bg-slate-600/80'}`}
                      aria-label={`Go to slide ${step + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-t border-slate-800 bg-slate-950/95 py-5">
        <div className="relative mx-auto flex max-w-7xl items-center gap-6 overflow-hidden px-4 sm:px-6">
          <div className="shrink-0 rounded-full bg-slate-900/90 px-4 py-2 text-xs uppercase tracking-[0.32em] text-emerald-300 ring-1 ring-emerald-300/20">
            Live updates
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap text-sm font-medium text-slate-100/90" style={{ animationDuration: '24s' }}>
              {tickerItems.concat(tickerItems).map((item, index) => (
                <span key={index} className="inline-flex items-center gap-3 pr-16">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-slate-900/95 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid gap-8 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-8 shadow-2xl shadow-slate-950/30">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Verified employers</p>
            <h3 className="mt-4 text-2xl font-bold text-white">Trusted by hiring teams</h3>
            <p className="mt-4 text-slate-300 leading-7">Every employer is vetted so you can apply with confidence. Our platform highlights verified postings from real companies.</p>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-8 shadow-2xl shadow-slate-950/30">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Career acceleration</p>
            <h3 className="mt-4 text-2xl font-bold text-white">AI-driven match intelligence</h3>
            <p className="mt-4 text-slate-300 leading-7">JobBridge uses AI to surface roles that fit your profile, speed up hiring, and help your resume rise above the noise.</p>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-8 shadow-2xl shadow-slate-950/30">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Real-time talent</p>
            <h3 className="mt-4 text-2xl font-bold text-white">Search top candidates instantly</h3>
            <p className="mt-4 text-slate-300 leading-7">Employers can filter, shortlist, and message talent in real time — making hiring faster and more precise.</p>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation-name: marquee;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </main>
  );
}
