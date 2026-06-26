import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import PageHero from '../components/PageHero';
import { HERO_CAROUSELS } from '../lib/media';
import { Briefcase, ArrowLeft, Bell } from 'lucide-react';

export default function Career() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header />
      <PageHero compact title="Career" subtitle="Your career growth hub" images={HERO_CAROUSELS.career || []} imageAlt="Career" overlay="dark" />
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 shadow-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
            <Briefcase className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Coming Soon</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            We're building something exciting to help you grow your career. Stay tuned for career resources, mentorship opportunities, and professional development tools.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
            <button
              onClick={() => navigate('/notifications')}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Bell className="w-4 h-4" /> Get Notified When Live
            </button>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
