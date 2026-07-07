import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import JobBridgeLogo from '../components/JobBridgeLogo';
import { useModal } from '../contexts/ModalContext';
import { useAuthRequired } from '../hooks/useAuthRequired';
import { Briefcase, Search, Users, Star, TrendingUp, ArrowRight, Zap, Shield, Globe, ChevronRight } from 'lucide-react';
import AnimatedSection from '../components/AnimatedSection';
import Card3D from '../components/Card3D';
import { pexel, ENTREPRENEURSHIP_VIDEOS } from '../lib/media';

const stats = [
  { label: 'Active Jobs', value: '24,500+', icon: Briefcase, color: 'bg-blue-50 text-blue-700' },
  { label: 'Companies', value: '3,200+', icon: Users, color: 'bg-emerald-50 text-emerald-700' },
  { label: 'Placements', value: '18,900+', icon: Star, color: 'bg-amber-50 text-amber-700' },
  { label: 'Success Rate', value: '94%', icon: TrendingUp, color: 'bg-rose-50 text-rose-700' },
];

const featuredJobs = [
  { title: 'Senior Frontend Engineer', company: 'TechCorp', location: 'Remote', salary: '₦120k–₦160k', match: '98%', badge: 'Hot' },
  { title: 'Product Manager', company: 'InnovateCo', location: 'New York', salary: '₦110k–₦140k', match: '92%', badge: 'New' },
  { title: 'Data Scientist', company: 'DataFlow', location: 'San Francisco', salary: '₦130k–₦170k', match: '89%', badge: '' },
  { title: 'UX Designer', company: 'DesignHub', location: 'Hybrid', salary: '₦90k–₦120k', match: '95%', badge: 'Featured' },
];

const testimonials = [
  { name: 'Sarah K.', role: 'Software Engineer', company: 'Google', quote: 'Found my dream job in 3 weeks. The AI matching is incredible — every suggestion felt tailor-made.', avatar: pexel(774909, 100, 100) },
  { name: 'Marcus T.', role: 'Recruiter', company: 'Stripe', quote: 'We filled 12 senior positions in a month. The talent quality here is unmatched.', avatar: pexel(220453, 100, 100) },
  { name: 'Priya M.', role: 'Designer', company: 'Figma', quote: 'The platform understood my portfolio and connected me with exactly the right companies.', avatar: pexel(415829, 100, 100) },
];

const profileCards = [
  { name: 'Evelyn', role: 'Marketing Manager', img: pexel(1239291, 300, 400) },
  { name: 'Aaliyah', role: 'Senior Data Analyst', img: pexel(1681010, 300, 400) },
  { name: 'Jacob', role: 'Frontend Developer', img: pexel(774909, 300, 400) },
];

function CarouselImg({ images, className }: { images: string[]; className?: string }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % images.length), 3500);
    return () => clearInterval(t);
  }, [images.length]);
  return (
    <div className={`relative ${className || ''}`}>
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === idx ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  );
}

/** Rotating HD video background for the hero section — all videos rendered with CSS crossfade */
function HeroVideoBackground({ activeIdx }: { activeIdx: number }) {
  const videos = ENTREPRENEURSHIP_VIDEOS;
  const nextIdx = (activeIdx + 1) % videos.length;

  return (
    <div className="absolute inset-0 overflow-hidden bg-black z-0">
      {/* All videos rendered — only active is visible via CSS opacity transition */}
      {videos.map((video, i) => (
        <video
          key={i}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            i === activeIdx ? 'opacity-100' : 'opacity-0'
          }`}
          autoPlay={i === activeIdx}
          muted
          loop={i === activeIdx}
          playsInline
          disablePictureInPicture
          preload={i === activeIdx || i === nextIdx ? 'auto' : 'metadata'}
          poster={video.poster}
          style={{ willChange: 'opacity' }}
        >
          <source src={video.src} type="video/mp4" />
        </video>
      ))}
    </div>
  );
}

export default function Home() {
  const { openModal } = useModal();
  const { openProtectedModal } = useAuthRequired();
  const [heroVideoIdx, setHeroVideoIdx] = useState(0);
  const videos = ENTREPRENEURSHIP_VIDEOS;

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroVideoIdx(i => (i + 1) % videos.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []); // empty deps — functional updater ensures we always get latest state

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Hero — Entrepreneurship Video Background */}
      <section className="relative overflow-hidden bg-black" style={{ perspective: '1000px' }}>
        {/* Rotating HD entrepreneurship video carousel */}
        <HeroVideoBackground activeIdx={heroVideoIdx} />

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/75 via-blue-800/50 to-blue-900/75 pointer-events-none z-10" />
        <div className="absolute inset-0 opacity-10 pointer-events-none z-10">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-blue-300 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28 z-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-blue-100 mb-6 animate-float">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                24,500+ jobs actively hiring now
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 preserve-3d" style={{ transform: 'translateZ(40px)' }}>
                Your career bridge to what's <span className="text-blue-300">next</span>
              </h1>
              <p className="text-lg text-blue-100 mb-8 max-w-xl leading-relaxed preserve-3d" style={{ transform: 'translateZ(20px)' }}>
                AI-powered job matching, verified employers, and real-time talent search — all in one professional network.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 preserve-3d" style={{ transform: 'translateZ(30px)' }}>
                <Link to="/jobs" className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-all hover:shadow-xl shadow-lg">
                  <Search className="w-4 h-4" /> Find Jobs
                </Link>
                <Link to="/providers" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-500 transition-all hover:shadow-xl border border-blue-500">
                  <Users className="w-4 h-4" /> Hire Talent
                </Link>
                <Link to="/ai-resume" className="inline-flex items-center justify-center gap-2 bg-transparent text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-all hover:shadow-xl border border-white/30">
                  <Zap className="w-4 h-4" /> AI Resume
                </Link>
              </div>
            </div>
            <div className="hidden lg:block relative">
              {/* Entrepreneurship showcase card — updates with active video */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10 hover:shadow-blue-500/20 transition-shadow duration-500" style={{ transform: 'rotateY(-2deg) rotateX(2deg)', transformStyle: 'preserve-3d' }}>
                <div className="relative h-[420px] bg-gradient-to-br from-blue-900/60 via-blue-800/40 to-transparent flex flex-col items-center justify-center p-8 text-center">
                  {/* Decorative background pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white blur-3xl" />
                  </div>
                  {/* Field icon */}
                  <div className="relative z-10 mb-6">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                      <span className="text-3xl">💼</span>
                    </div>
                  </div>
                  <p className="relative z-10 text-white/60 text-xs uppercase tracking-[0.2em] mb-2">Now Showing</p>
                  <h3
                    key={heroVideoIdx}
                    className="relative z-10 text-white text-2xl font-bold mb-2 animate-fadeIn"
                  >
                    {videos[heroVideoIdx].label}
                  </h3>
                  <p
                    key={`desc-${heroVideoIdx}`}
                    className="relative z-10 text-blue-200/80 text-sm max-w-xs animate-fadeIn"
                  >
                    {videos[heroVideoIdx].description}
                  </p>
                  {/* Carousel dots */}
                  <div className="relative z-10 flex gap-2 mt-6">
                    {videos.map((_, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                          i === heroVideoIdx ? 'bg-white w-4' : 'bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Floating stat card */}
              <div className="absolute -left-6 top-8 bg-white rounded-xl shadow-xl p-4 flex items-center gap-3 animate-float">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">94% Success</p>
                  <p className="text-xs text-gray-500">Placement rate</p>
                </div>
              </div>
              {/* Entrepreneurship field indicator — bottom-left of right card */}
              <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3">
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white/80 text-xs font-medium uppercase tracking-wider">Entrepreneurship</span>
                  <span className="text-white/40 mx-1">·</span>
                  <span className="text-white text-sm font-semibold">{videos[heroVideoIdx].label}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400" placeholder="Job title, keyword, or company" />
            </div>
            <div className="flex-1 flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <Globe className="w-4 h-4 text-gray-400 shrink-0" />
              <input className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400" placeholder="Location or Remote" />
            </div>
            <Link to="/jobs" className="flex items-center justify-center gap-2 bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-800 transition-colors whitespace-nowrap">
              Search Jobs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <AnimatedSection className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children stagger-visible">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <Card3D key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4" strength={5}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            </Card3D>
          ))}
        </div>
      </AnimatedSection>

      {/* Features */}
      <AnimatedSection className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Why professionals choose JobBridge</h2>
          <p className="text-gray-500 mt-2">Built for the modern workforce</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 stagger-children stagger-visible">
          {[
            { icon: Zap, title: 'AI-Powered Matching', desc: 'Smart algorithms match you with the perfect opportunities based on skills, experience, and preferences.', imgs: [pexel(7176027, 400, 250), pexel(8386440, 400, 250), pexel(5466785, 400, 250)] },
            { icon: Shield, title: 'Verified Employers', desc: 'Every company on our platform is verified and vetted to ensure legitimate opportunities only.', imgs: [pexel(3952020, 400, 250), pexel(5668855, 400, 250), pexel(3771111, 400, 250)] },
            { icon: Globe, title: 'Remote & Global', desc: 'Find opportunities worldwide — remote, hybrid, or on-site across every industry and timezone.', imgs: [pexel(7575322, 400, 250), pexel(3194519, 400, 250), pexel(927022, 400, 250)] },
          ].map(({ icon: Icon, title, desc, imgs }) => (
            <Card3D key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md overflow-hidden" strength={6}>
              <CarouselImg images={imgs} className="w-full h-40" />
              <div className="p-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 -mt-12 relative z-10 border-4 border-white shadow">
                  <Icon className="w-6 h-6 text-blue-700" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </Card3D>
          ))}
        </div>
      </AnimatedSection>

      {/* Featured Jobs */}
      <AnimatedSection className="max-w-7xl mx-auto px-4 sm:px-6 pb-12" delay={100}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Featured Opportunities</h2>
            <p className="text-sm text-gray-500 mt-0.5">Handpicked matches based on market demand</p>
          </div>
          <Link to="/jobs" className="text-sm font-medium text-blue-700 hover:text-blue-800 flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 stagger-children stagger-visible">
          {featuredJobs.map((job) => (
            <Card3D key={job.title} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm group" strength={5}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {job.company[0]}
                </div>
                {job.badge && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    job.badge === 'Hot' ? 'bg-red-50 text-red-600' :
                    job.badge === 'New' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>{job.badge}</span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{job.title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{job.company} · {job.location}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm font-medium text-gray-700">{job.salary}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">{job.match} match</span>
                  <button
                    onClick={() => openProtectedModal({ action: 'apply-job', modalData: { title: job.title, company: job.company } })}
                    className="text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-800 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </Card3D>
          ))}
        </div>
      </AnimatedSection>

      {/* Profile Cards Section */}
      <AnimatedSection className="py-14 bg-amber-50" direction="scale">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Professionals who found their path</h2>
            <p className="text-gray-500 mt-2">Join thousands of professionals who landed their dream roles</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center stagger-children stagger-visible">
            {profileCards.map(({ name, role, img }) => (
              <Card3D key={name} className="bg-white rounded-2xl shadow-lg overflow-hidden w-64" strength={8}>
                <img src={img} alt={name} className="w-full h-64 object-cover" />
                <div className="p-4 text-center">
                  <h3 className="font-bold text-gray-900 text-lg">{name}</h3>
                  <p className="text-sm text-blue-700 font-medium">{role}</p>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-xs text-gray-500">Hired via JobBridge</span>
                  </div>
                </div>
              </Card3D>
            ))}
          </div>
        </div>
      </AnimatedSection>



      {/* Testimonials */}
      <AnimatedSection className="bg-white border-y border-gray-100 py-14" delay={150}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Trusted by top talent & teams</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 stagger-children stagger-visible">
            {testimonials.map(({ name, role, company, quote, avatar }) => (
              <Card3D key={name} className="bg-gray-50 rounded-2xl p-6 border border-gray-100" strength={4}>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">"{quote}"</p>
                <div className="flex items-center gap-3">
                  <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover border-2 border-blue-100" />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{name}</div>
                    <div className="text-xs text-gray-500">{role} at {company}</div>
                  </div>
                </div>
              </Card3D>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* CTA Banner */}
      <AnimatedSection className="max-w-7xl mx-auto px-4 sm:px-6 py-14" direction="scale" delay={200}>
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden animate-glow">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-blue-300 blur-3xl" />
          </div>
          <div className="relative preserve-3d" style={{ transform: 'translateZ(20px)' }}>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Ready to find your next opportunity?</h2>
            <p className="text-blue-100 mb-7 max-w-lg mx-auto">Join over 2 million professionals already using JobBridge to advance their careers.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/payment" className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-all hover:shadow-xl">
                Go to Payment
              </Link>
              <Link
                to="/pricing"
                className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-500 transition-all hover:shadow-xl border border-blue-500 text-center"
              >
                View Premium Plans
              </Link>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white pb-20 md:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <JobBridgeLogo variant="horizontal" iconSize={24} />
            </div>
            <div className="flex flex-wrap gap-4 justify-center text-xs text-gray-500">
              <Link to="/about" className="hover:text-gray-900 transition-colors">About</Link>
              <Link to="/blog" className="hover:text-gray-900 transition-colors">Blog</Link>
              <Link to="/contact" className="hover:text-gray-900 transition-colors">Contact</Link>
              <Link to="/support" className="hover:text-gray-900 transition-colors">Support</Link>
              <button onClick={() => openModal('info', { title: 'Privacy Policy', content: 'JobBridge respects your privacy. We collect only necessary data, never sell your information, and allow full data deletion on request.' })} className="hover:text-gray-900 transition-colors">Privacy</button>
            </div>
            <p className="text-xs text-gray-400">© 2026 JobBridge. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
