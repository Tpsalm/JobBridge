import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Clock, Bookmark, Share2, ChevronDown, ChevronUp, Briefcase, Building, Users, CheckCircle, ArrowLeft, Upload, Send, FileText, Edit3, Loader2 } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { fetchJobs, incrementJobViews, createApplication } from '../lib/supabaseQueries';
import PageHero from '../components/PageHero';
import CompanyLogo from '../components/CompanyLogo';
import { HERO_CAROUSELS } from '../lib/media';
import Card3D from '../components/Card3D';

const COMPANY_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-rose-600', 'bg-amber-600',
  'bg-cyan-600', 'bg-indigo-600', 'bg-pink-600', 'bg-teal-600', 'bg-orange-600',
];

function getCompanyColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COMPANY_COLORS[Math.abs(hash) % COMPANY_COLORS.length];
}

function getInitials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

function parseBenefits(benefits: string | string[] | null): string[] {
  if (!benefits) return [];
  if (Array.isArray(benefits)) return benefits;
  try { return JSON.parse(benefits); } catch { return []; }
}

const Jobs = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isAuthenticated } = useAuth();
  const { savedJobs, toggleSaveJob, markApplied, appliedJobs } = useAuth();

  const handleApply = (job: any) => {
    if (!isAuthenticated) {
      navigate('/signup');
      return;
    }
    setShowApplication(true);
    setApplyMethod(null);
  };

  // Application form state
  const [showApplication, setShowApplication] = useState(false);
  const [applyMethod, setApplyMethod] = useState<'upload' | 'manual' | null>(null);
  const [appForm, setAppForm] = useState({
    professional_headline: '',
    years_of_experience: '',
    cover_letter: '',
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvName, setCvName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [appError, setAppError] = useState('');
  const [applied, setApplied] = useState(false);

  const updateAppForm = (field: string, value: any) => setAppForm(prev => ({ ...prev, [field]: value }));

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'text/rtf'];
      if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|rtf)$/i)) { setAppError('Only pdf, doc, docx & rtf files allowed'); return; }
      if (file.size > 10 * 1024 * 1024) { setAppError('File must be smaller than 10MB'); return; }
      setAppError(''); setCvFile(file); setCvName(file.name);
    }
  };

  const handleSubmitApplication = async (jobId: string) => {
    if (applyMethod === 'upload' && !cvFile) { setAppError('Please upload your CV'); return; }
    if (applyMethod === 'manual' && (!appForm.professional_headline || !appForm.years_of_experience)) { setAppError('Professional headline and years of experience are required'); return; }
    setSubmitting(true); setAppError('');
    try {
      let resume_url = '';
      if (cvFile) {
        const fileExt = cvFile.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('resumes').upload(fileName, cvFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(fileName);
          resume_url = urlData?.publicUrl || '';
        }
      }
      await createApplication({ job_id: jobId, applicant_id: user?.id || '', cover_letter: appForm.cover_letter, resume_url });
      window.dispatchEvent(new CustomEvent('applications:updated'));
      markApplied(jobId);
      setAppliedLocal(prev => prev.includes(jobId) ? prev : [...prev, jobId]);
      setApplied(true);
    } catch (err: any) { setAppError(err.message || 'Failed to submit application'); }
    finally { setSubmitting(false); }
  };

  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showBenefits, setShowBenefits] = useState(true);
  const [mobileDetail, setMobileDetail] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const [appliedLocal, setAppliedLocal] = useState<string[]>(appliedJobs);

  useEffect(() => {
    setLoadingJobs(true);
    fetchJobs().then(data => { setJobs(data); setLoadingJobs(false); }).catch(() => setLoadingJobs(false));
    const handler = () => fetchJobs().then(data => setJobs(data)).catch(() => {});
    window.addEventListener('jobs:updated', handler);
    return () => window.removeEventListener('jobs:updated', handler);
  }, []);

  const categories = [...new Set(jobs.map(j => j.category).filter(Boolean))];

  const filteredJobs = jobs.filter(job => {
    const q = search.toLowerCase();
    const matchSearch = !search || job.title.toLowerCase().includes(q) || job.company.toLowerCase().includes(q) || (job.description || '').toLowerCase().includes(q);
    const matchLocation = !locationFilter || job.location.toLowerCase().includes(locationFilter.toLowerCase());
    const matchType = !typeFilter || job.type === typeFilter;
    const matchCategory = !categoryFilter || job.category === categoryFilter;
    return matchSearch && matchLocation && matchType && matchCategory;
  });

  useEffect(() => {
    setAppliedLocal(appliedJobs);
  }, [appliedJobs]);

  const toggleSave = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleSaveJob(id);
  };

  const selectJob = (job: any) => {
    setSelectedJob(job);
    setShowBenefits(true);
    setMobileDetail(true);
    setShowApplication(false);
    setApplyMethod(null);
    setApplied(false);
    setAppError('');
    // Increment view count
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, views: (j.views || 0) + 1 } : j));
    incrementJobViews(job.id, job.views).catch(() => {});
    setTimeout(() => detailRef.current?.scrollTo(0, 0), 50);
  };

  const benefits = selectedJob ? parseBenefits(selectedJob.benefits) : [];

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <Header />

      <main className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
        <PageHero
          compact
          title="Find your next role"
          subtitle="Browse thousands of verified jobs from top employers across Nigeria and beyond"
          images={HERO_CAROUSELS.jobs}
          imageAlt="Professional searching for jobs on laptop"
        />

        {/* Search Bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex-shrink-0">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Job title, company, or keywords"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="City, state, or 'remote'"
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 px-8 rounded-lg text-sm transition whitespace-nowrap">
                Find Jobs
              </button>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="text-xs font-medium border border-gray-300 rounded-full px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Job Type</option>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Internship</option>
                <option>Freelance</option>
              </select>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-xs font-medium border border-gray-300 rounded-full px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {(typeFilter || categoryFilter || search || locationFilter) && (
                <button
                  onClick={() => { setTypeFilter(''); setCategoryFilter(''); setSearch(''); setLocationFilter(''); }}
                  className="text-xs font-medium text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50 transition"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="bg-white border-b border-gray-100 px-4 py-2 flex-shrink-0">
          <div className="max-w-7xl mx-auto">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{filteredJobs.length}</span> jobs found
              {search && <span> for "<span className="font-medium">{search}</span>"</span>}
            </p>
          </div>
        </div>

        {/* Main Split Panel */}
        <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
          {/* Left Column: Job Cards */}
          <div className={`${selectedJob ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto stagger-children stagger-visible`}>
            {loadingJobs ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Loading jobs...</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-8 text-center">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No jobs match your search</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filteredJobs.map(job => {
                const isActive = selectedJob?.id === job.id;
                const isSaved = savedJobs.includes(job.id);
                const jobBenefits = parseBenefits(job.benefits);
                return (
                  <Card3D
                    key={job.id}
                    onClick={() => selectJob(job)}
                    className={`px-5 py-4 border-b border-gray-100 cursor-pointer transition-colors ${
                      isActive ? 'bg-blue-50 border-l-4 border-l-blue-700' : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }`}
                    strength={6}
                  >
                    <div className="flex items-start gap-3">
                      <CompanyLogo company={job.company} fallbackClassName={getCompanyColor(job.company)} />
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-sm leading-snug ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>{job.title}</h3>
                        <p className="text-xs text-gray-600 mt-0.5">{job.company}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{job.location}</span>
                          <span>·</span>
                          <span>{job.type}</span>
                        </div>
                        {job.salary_range && (
                          <p className="text-xs font-medium text-green-700 mt-1.5">{job.salary_range}</p>
                        )}
                        {jobBenefits.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {jobBenefits.slice(0, 3).map((b: string) => (
                              <span key={b} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">{b}</span>
                            ))}
                            {jobBenefits.length > 3 && (
                              <span className="text-[10px] text-gray-400">+{jobBenefits.length - 3} more</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{timeAgo(job.created_at)}
                          </span>
                          <div className="flex items-center gap-1">
                            {job.is_featured ? (
                              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-[10px] font-semibold rounded-full">Featured</span>
                            ) : null}
                            <button
                              onClick={(e) => toggleSave(job.id, e)}
                              className={`p-1 rounded-full transition ${isSaved ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}
                              title={isSaved ? 'Remove from saved' : 'Save job'}
                            >
                              <Bookmark className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card3D>
                );
              })
            )}
          </div>

          {/* Right Column: Job Detail */}
          <div ref={detailRef} className={`${selectedJob ? 'flex' : 'hidden lg:flex'} flex-col flex-1 bg-white overflow-y-auto`}>
            {selectedJob ? (
              <>
                {/* Mobile back button */}
                <button
                  onClick={() => { setMobileDetail(false); setSelectedJob(null); setShowApplication(false); setAppStep(1); }}
                  className="lg:hidden flex items-center gap-1 text-sm text-blue-700 font-medium px-4 py-3 border-b border-gray-100 hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to jobs
                </button>

                {/* Detail Header */}
                <div className="px-6 py-6 border-b border-gray-100">
                  <div className="flex items-start gap-4">
                    <CompanyLogo company={selectedJob.company} className="w-14 h-14 rounded-xl" fallbackClassName={`${getCompanyColor(selectedJob.company)} shadow-sm`} />
                    <div className="flex-1 min-w-0">
                      <h1 className="text-xl font-bold text-gray-900 leading-tight">{selectedJob.title}</h1>
                      <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-gray-400" />
                        {selectedJob.company}
                        {selectedJob.category && (
                          <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-full font-medium">{selectedJob.category}</span>
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{selectedJob.location}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{timeAgo(selectedJob.created_at)}</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{selectedJob.applications_count || 0} applicants</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 mt-5">
                    <button
                      onClick={() => handleApply(selectedJob)}
                      disabled={appliedLocal.includes(selectedJob.id) || applied}
                      className={`flex-1 font-semibold py-3 rounded-lg transition text-sm flex items-center justify-center gap-2 ${
                        appliedLocal.includes(selectedJob.id) || applied
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-blue-700 hover:bg-blue-800 text-white'
                      }`}
                    >
                      <Briefcase className="w-4 h-4" />
                      {appliedLocal.includes(selectedJob.id) || applied ? 'Applied' : 'Apply Now'}
                    </button>
                    <button
                      onClick={() => toggleSave(selectedJob.id)}
                      className={`p-3 rounded-lg border transition ${savedJobs.includes(selectedJob.id) ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                      title={savedJobs.includes(selectedJob.id) ? 'Saved' : 'Save this job'}
                    >
                      <Bookmark className="w-5 h-5" fill={savedJobs.includes(selectedJob.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => {
                      const text = `*${selectedJob.title}* at ${selectedJob.company}\n\n${window.location.origin}/job/${selectedJob.id}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }} className="p-3 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Pay Section */}
                {selectedJob.salary_range && (
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pay</h3>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-base font-semibold text-gray-900">{selectedJob.salary_range}</span>
                    </div>
                  </div>
                )}

                {/* Job Type */}
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Job Type</h3>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900">{selectedJob.type}</span>
                  </div>
                </div>

                {/* Benefits */}
                {benefits.length > 0 && (
                  <div className="px-6 py-4 border-b border-gray-100">
                    <button
                      onClick={() => setShowBenefits(!showBenefits)}
                      className="flex items-center justify-between w-full"
                    >
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Benefits ({benefits.length})
                      </h3>
                      {showBenefits ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {showBenefits && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {benefits.map((b: string) => (
                          <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 text-xs font-medium rounded-full">
                            <CheckCircle className="w-3 h-3 text-blue-600" />
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Full Description */}
                <div className="px-6 py-5">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Full Job Description</h3>
                  <div className="prose prose-sm max-w-none text-gray-700">
                    {selectedJob.description.split('\n').map((line: string, i: number) => {
                      if (!line.trim()) return <div key={i} className="h-3" />;
                      if (line.endsWith(':') || line.startsWith('About ') || line.startsWith('Role Overview') || line.startsWith('Responsibilities') || line.startsWith('Requirements')) {
                        return <h4 key={i} className="text-sm font-bold text-gray-900 mt-4 mb-1">{line}</h4>;
                      }
                      if (line.startsWith('•') || line.startsWith('- ')) {
                        return (
                          <div key={i} className="flex items-start gap-2 ml-2 my-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                            <span className="text-sm">{line.replace(/^[•\-]\s*/, '')}</span>
                          </div>
                        );
                      }
                      return <p key={i} className="text-sm leading-relaxed">{line}</p>;
                    })}
                  </div>
                </div>

                {/* Bottom Apply CTA / Application Form */}
                <div className="border-t border-gray-100 bg-gray-50">
                  {!showApplication ? (
                    <div className="px-6 py-5">
                      <button
                        onClick={() => handleApply(selectedJob)}
                        disabled={appliedLocal.includes(selectedJob.id) || applied}
                        className={`w-full font-semibold py-3 rounded-lg transition text-sm flex items-center justify-center gap-2 ${
                          appliedLocal.includes(selectedJob.id) || applied
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-blue-700 hover:bg-blue-800 text-white'
                        }`}
                      >
                        <Briefcase className="w-4 h-4" />
                        {applied || appliedLocal.includes(selectedJob.id) ? 'Applied ✓' : 'Apply Now'}
                      </button>
                      <p className="text-xs text-gray-400 text-center mt-2">
                        {selectedJob.applications_count || 0} people have already applied
                      </p>
                    </div>
                  ) : applied ? (
                    <div className="px-6 py-8 text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Application Submitted!</h3>
                      <p className="text-sm text-gray-500">Good luck! You'll hear from the recruiter if you're shortlisted.</p>
                    </div>
                  ) : !applyMethod ? (
                    <div className="px-6 py-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-blue-700" /> Apply for {selectedJob.title}
                        </h3>
                        <button onClick={() => { setShowApplication(false); setApplyMethod(null); }} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                      <p className="text-sm text-gray-600">Choose how you'd like to apply:</p>
                      <button onClick={() => setApplyMethod('upload')}
                        className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50 hover:bg-blue-100 rounded-xl p-6 text-center transition-colors">
                        <FileText className="w-10 h-10 mx-auto text-blue-500 mb-2" />
                        <p className="font-semibold text-blue-700">Upload my CV</p>
                        <p className="text-xs text-blue-500 mt-1">pdf, doc, docx & rtf — max 10MB</p>
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">OR</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <button onClick={() => setApplyMethod('manual')}
                        className="w-full border-2 border-gray-200 hover:border-gray-400 bg-white hover:bg-gray-50 rounded-xl p-6 text-center transition-colors">
                        <Edit3 className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                        <p className="font-semibold text-gray-700">Fill in details manually</p>
                        <p className="text-xs text-gray-500 mt-1">Professional headline, experience & cover letter</p>
                      </button>
                    </div>
                  ) : (
                    <div className="px-6 py-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-blue-700" /> Apply for {selectedJob.title}
                          <span className="text-xs font-normal text-gray-400 ml-1">— {applyMethod === 'upload' ? 'Upload CV' : 'Manual'}</span>
                        </h3>
                        <button onClick={() => setApplyMethod(null)} className="text-xs text-gray-500 hover:text-gray-700">Back</button>
                      </div>

                      {appError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{appError}</div>}

                      {applyMethod === 'upload' && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Upload your CV *</label>
                            <label className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 transition-colors block bg-blue-50/50">
                              <input type="file" accept=".pdf,.doc,.docx,.rtf" onChange={handleCvChange} className="hidden" />
                              {cvName ? (
                                <div className="flex items-center justify-center gap-2">
                                  <CheckCircle className="w-6 h-6 text-green-600" />
                                  <span className="text-sm font-medium text-gray-700">{cvName}</span>
                                </div>
                              ) : (
                                <div>
                                  <Upload className="w-10 h-10 mx-auto text-blue-400" />
                                  <p className="mt-2 text-sm font-semibold text-blue-700">Tap to upload your CV</p>
                                  <p className="text-xs text-gray-500 mt-1">pdf, doc, docx & rtf files no bigger than 10MB</p>
                                </div>
                              )}
                            </label>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Cover letter (optional)</label>
                            <textarea value={appForm.cover_letter} onChange={e => updateAppForm('cover_letter', e.target.value)} rows={3}
                              placeholder="Tell the employer why you're a great fit..."
                              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                          </div>
                          <button onClick={() => handleSubmitApplication(selectedJob.id)} disabled={submitting}
                            className="w-full bg-blue-700 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2">
                            {submitting ? (
                              <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Submitting...</>
                            ) : (
                              <><Send className="w-4 h-4" /> Submit Application</>
                            )}
                          </button>
                        </div>
                      )}

                      {applyMethod === 'manual' && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Professional headline / title *</label>
                            <input type="text" value={appForm.professional_headline} onChange={e => updateAppForm('professional_headline', e.target.value)} placeholder="e.g. Senior Accountant"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Years of Experience *</label>
                            <select value={appForm.years_of_experience} onChange={e => updateAppForm('years_of_experience', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                              <option value="">Select...</option>
                              {['Entry (0-1)', '1-2', '3-5', '5-7', '7-10', '10+'].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Cover letter (optional)</label>
                            <textarea value={appForm.cover_letter} onChange={e => updateAppForm('cover_letter', e.target.value)} rows={3}
                              placeholder="Tell the employer why you're a great fit..."
                              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                          </div>
                          <button onClick={() => handleSubmitApplication(selectedJob.id)} disabled={submitting}
                            className="w-full bg-blue-700 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2">
                            {submitting ? (
                              <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Submitting...</>
                            ) : (
                              <><Send className="w-4 h-4" /> Submit Application</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <Briefcase className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Select a job to view details</h3>
                  <p className="text-sm text-gray-500 max-w-xs">Click on any job from the list to see full details including pay, benefits, and requirements</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Jobs;
