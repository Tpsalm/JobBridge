import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { Users, ArrowRight, Briefcase } from 'lucide-react';

const SUGGESTIONS = [
  { id: 1, name: 'Frontend Developers NG', kind: 'Community', members: '18k members' },
  { id: 2, name: 'Product Managers Africa', kind: 'Community', members: '9k members' },
  { id: 3, name: 'Remote Jobs Nigeria', kind: 'Topic', members: '22k members' },
];

export default function Following() {
  return (
    <AppLayout>
      <section className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Following</h1>
          </div>
          <p className="text-sm text-gray-600">Manage people and communities you follow to personalize your job feed.</p>
        </div>

        <div className="space-y-3">
          {SUGGESTIONS.map((item) => (
            <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.kind} • {item.members}</p>
              </div>
              <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary-container text-primary hover:bg-primary-fixed transition-colors">
                Follow
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/providers" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant text-sm text-gray-700 hover:bg-gray-50">
            <Briefcase className="w-4 h-4" /> Explore providers
          </Link>
          <Link to="/messages" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-container">
            Go to messages <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}
