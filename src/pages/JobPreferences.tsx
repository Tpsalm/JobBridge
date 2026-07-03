import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { Target, ArrowRight } from 'lucide-react';

export default function JobPreferences() {
  const [prefs, setPrefs] = useState({
    workType: 'Remote',
    location: 'Lagos',
    salary: '500000',
  });

  return (
    <AppLayout>
      <section className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Job Preferences</h1>
          </div>
          <p className="text-sm text-gray-600 mb-5">Set what jobs you want to be matched with.</p>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Work type</span>
              <select
                value={prefs.workType}
                onChange={(e) => setPrefs((p) => ({ ...p, workType: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              >
                <option>Remote</option>
                <option>On-site</option>
                <option>Hybrid</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Preferred location</span>
              <input
                value={prefs.location}
                onChange={(e) => setPrefs((p) => ({ ...p, location: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Min salary (₦)</span>
              <input
                value={prefs.salary}
                onChange={(e) => setPrefs((p) => ({ ...p, salary: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/profile" className="px-4 py-2 rounded-xl border border-outline-variant text-sm text-gray-700 hover:bg-gray-50">Back to profile</Link>
            <Link to="/jobs" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-container">
              Find matching jobs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
