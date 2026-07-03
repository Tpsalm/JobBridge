import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { Eye, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'jobbridge_profile_visible';

function initialVisibility() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export default function ProfileVisibility() {
  const [visible, setVisible] = useState<boolean>(initialVisibility);

  const toggle = () => {
    const next = !visible;
    setVisible(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore local storage failures
    }
  };

  return (
    <AppLayout>
      <section className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Hiring Visibility</h1>
          </div>

          <p className="text-sm text-gray-600 mb-5">
            Control whether employers can discover your profile in talent search.
          </p>

          <div className="flex items-center justify-between rounded-xl border border-outline-variant p-4 mb-5">
            <div>
              <p className="text-sm font-semibold text-gray-900">Hiring employers can find you</p>
              <p className="text-xs text-gray-500">Currently: {visible ? 'Visible' : 'Hidden'}</p>
            </div>
            <button
              onClick={toggle}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                visible ? 'bg-primary text-white' : 'bg-surface-container text-gray-700'
              }`}
            >
              {visible ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/profile" className="px-4 py-2 rounded-xl border border-outline-variant text-sm text-gray-700 hover:bg-gray-50">Back to profile</Link>
            <Link to="/jobs" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-container">
              Browse jobs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
