import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from '../components/AppLayout';
import CompanyLogo from '../components/CompanyLogo';
import PageHero from '../components/PageHero';
import { HERO_CAROUSELS, IMG } from '../lib/media';
import { Bookmark, Briefcase, Calendar, Clock, MapPin, DollarSign, ChevronRight, Search, Archive, X, FileText } from 'lucide-react';
import { LOCAL_API_URL } from '../lib/supabase';

type Tab = 'saved' | 'applied' | 'interviews' | 'archived';

interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  salary_range?: string;
  benefits?: string;
  category?: string;
  description?: string;
  created_at?: string;
}

interface ApplicationItem {
  id: string;
  job_id: string;
  professional_headline: string;
  status: string;
  created_at: string;
  job: JobItem | null;
}

export default function MyJobs() {
  const { savedJobs, appliedJobs, toggleSaveJob, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('saved');
  const [allJobs, setAllJobs] = useState<JobItem[]>([]);
  const [myApplications, setMyApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`${LOCAL_API_URL}/jobs`).then(res => res.json()),
      isAuthenticated ? fetch(`${LOCAL_API_URL}/my-applications`, {
        headers: localStorage.getItem('jobbridge_token')
          ? { Authorization: `Bearer ${localStorage.getItem('jobbridge_token')}` }
          : {},
      }).then(res => res.json()) : Promise.resolve({ applications: [] }),
    ])
      .then(([jobsData, appsData]) => {
        setAllJobs(jobsData.jobs || jobsData || []);
        setMyApplications(appsData.applications || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isAuthenticated]);

  const savedJobItems = allJobs.filter(j => savedJobs.includes(j.id));
  const appliedJobItems = myApplications.map(app => ({
    ...app.job,
    application_status: app.status,
    applied_at: app.created_at,
  } as any)).filter(Boolean);
  // Interviews / Archived are empty for now (feature hooks)
  const interviewItems: JobItem[] = [];
  const archivedItems: JobItem[] = [];

  const tabs: { key: Tab; label: string; count: number; icon: typeof Bookmark }[] = [
    { key: 'saved', label: 'Saved', count: savedJobItems.length, icon: Bookmark },
    { key: 'applied', label: 'Applied', count: appliedJobItems.length, icon: Briefcase },
    { key: 'interviews', label: 'Interviews', count: interviewItems.length, icon: Calendar },
    { key: 'archived', label: 'Archived', count: archivedItems.length, icon: Archive },
  ];

  const currentItems =
    activeTab === 'saved' ? savedJobItems :
    activeTab === 'applied' ? appliedJobItems :
    activeTab === 'interviews' ? interviewItems :
    archivedItems;

  const filteredItems = searchTerm
    ? currentItems.filter(j =>
        j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.company.toLowerCase().includes(searchTerm.toLowerCase()))
    : currentItems;

  const emptyMessages: Record<Tab, { title: string; desc: string; icon: typeof Bookmark }> = {
    saved: { title: 'No jobs saved yet', desc: 'Jobs you save appear here.', icon: Bookmark },
    applied: { title: 'No applications yet', desc: 'Jobs you apply to appear here.', icon: Briefcase },
    interviews: { title: 'No interviews scheduled', desc: 'Upcoming interviews will show here.', icon: Calendar },
    archived: { title: 'No archived jobs', desc: 'Jobs you archive appear here.', icon: Archive },
  };

  const parseBenefits = (b: string | string[] | undefined): string[] => {
    if (!b) return [];
    if (Array.isArray(b)) return b;
    try { return JSON.parse(b); } catch { return []; }
  };

  return (
    <AppLayout>
      <PageHero
        compact
        title="My Jobs"
        subtitle="Track your saved, applied, and interview jobs"
        images={HERO_CAROUSELS.myJobs}
        imageAlt="Person organizing job applications"
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
          {tabs.map(({ key, label, count, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                activeTab === key
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Search within tab */}
        {currentItems.length > 0 && (
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab} jobs...`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <img src={IMG.empty.noSaved} alt="" className="w-full max-w-xs rounded-xl mb-5 object-cover" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {emptyMessages[activeTab].title}
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm">
              {emptyMessages[activeTab].desc}
            </p>
            {activeTab === 'saved' && (
              <div className="space-y-2 text-sm">
                <p className="text-gray-400">
                  Not seeing a job?{' '}
                  <Link to="/jobs" className="text-blue-600 hover:underline">Browse all jobs</Link>
                </p>
              </div>
            )}
            <Link
              to="/jobs"
              className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              Find Jobs <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* Job Cards */
          <div className="space-y-3">
            {filteredItems.map(job => {
              const benefits = parseBenefits(job.benefits);
              return (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Company + Logo placeholder */}
                      <div className="flex items-center gap-3 mb-2">
                        <CompanyLogo company={job.company} className="w-10 h-10 rounded-lg" />
                        <div>
                          <h3 className="font-semibold text-gray-900 text-base leading-tight">{job.title}</h3>
                          <p className="text-sm text-gray-500">{job.company}</p>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.type}</span>
                        {job.salary_range && (
                          <span className="flex items-center gap-1 text-green-600 font-medium"><DollarSign className="w-3.5 h-3.5" />{job.salary_range}</span>
                        )}
                        {job.category && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600">{job.category}</span>
                        )}
                      </div>

                      {/* Benefits chips */}
                      {benefits.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {benefits.slice(0, 4).map((b, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">{b}</span>
                          ))}
                          {benefits.length > 4 && (
                            <span className="text-xs px-2 py-0.5 text-gray-400">+{benefits.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {activeTab === 'saved' && (
                        <button
                          onClick={() => toggleSaveJob(job.id)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                          title="Remove from saved"
                        >
                          <Bookmark className="w-5 h-5 fill-current" />
                        </button>
                      )}
                      {activeTab === 'applied' && (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          (job as any).application_status === 'shortlisted' ? 'bg-green-50 text-green-700' :
                          (job as any).application_status === 'reviewed' ? 'bg-blue-50 text-blue-700' :
                          (job as any).application_status === 'rejected' ? 'bg-red-50 text-red-700' :
                          (job as any).application_status === 'hired' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {(job as any).application_status || 'Applied'}
                        </span>
                      )}
                      <Link
                        to="/jobs"
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help footer */}
        {!loading && (
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-400">
              Having an issue with My Jobs?{' '}
              <Link to="/support" className="text-blue-600 hover:underline">Tell us more</Link>
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
