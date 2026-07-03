import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { Star, ArrowRight } from 'lucide-react';

const SAMPLE_REVIEWS = [
  { id: 1, author: 'TalentHub Ltd', rating: 5, text: 'Great communication and very reliable delivery.' },
  { id: 2, author: 'Fintech Recruiter', rating: 4, text: 'Strong problem-solving and timely updates.' },
];

export default function Reviews() {
  return (
    <AppLayout>
      <section className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reviews & Contributions</h1>
          </div>
          <p className="text-sm text-gray-600">Your profile reviews and contribution history.</p>
        </div>

        <div className="space-y-3">
          {SAMPLE_REVIEWS.map((review) => (
            <div key={review.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-900">{review.author}</p>
                <p className="text-xs text-primary font-semibold">{review.rating}.0 ★</p>
              </div>
              <p className="text-sm text-gray-600">{review.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Link to="/profile" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-container">
            Back to profile <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}
