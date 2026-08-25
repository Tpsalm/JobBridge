import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { Star, ArrowRight, Trash2, Send, LogIn, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchReviews,
  createReview,
  updateReview,
  deleteReview,
  fetchProviders,
  fetchMyReviewForTarget,
} from '../lib/supabaseQueries';
import type { Profile, Review } from '../lib/supabase';

// ─── Interactive star rating input ──────────────────────────────────────────
function StarRatingInput({
  value,
  onChange,
  size = 32,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="p-0.5 transition-transform hover:scale-125 focus:outline-none"
        >
          <Star
            style={{ width: size, height: size }}
            className={`${n <= active ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} transition-colors`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm font-semibold text-gray-700 min-w-8">
        {active || '—'}
      </span>
    </div>
  );
}

// ─── Read-only star display ─────────────────────────────────────────────────
function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
        />
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function Reviews() {
  const location = useLocation();
  const { user, profile } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [providers, setProviders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Review form state
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [myExisting, setMyExisting] = useState<Review | null>(null);

  const isAuthenticated = !!user;

  const loadReviews = useCallback(async () => {
    setLoading(true);
    const data = await fetchReviews(selectedProviderId || undefined);
    setReviews(data);
    setLoading(false);
  }, [selectedProviderId]);

  useEffect(() => {
    loadReviews().catch(() => setLoading(false));
  }, [loadReviews]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchProviders()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [isAuthenticated]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const providerId = params.get('providerId') || '';
    if (providerId) {
      setSelectedProviderId(providerId);
    }
  }, [location.search]);

  // When a provider is picked, detect whether the user already reviewed them.
  useEffect(() => {
    if (!isAuthenticated || !selectedProviderId) {
      setMyExisting(null);
      setRating(0);
      setComment('');
      return;
    }
    let cancelled = false;
    fetchMyReviewForTarget(user.id, selectedProviderId).then((existing) => {
      if (cancelled) return;
      setMyExisting(existing);
      setRating(existing?.rating || 0);
      setComment(existing?.comment || '');
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, selectedProviderId, user?.id]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) || null,
    [providers, selectedProviderId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user) return;
    if (!selectedProviderId) {
      setError('Please choose a provider to review.');
      return;
    }
    if (rating < 1) {
      setError('Please select a star rating (1–5).');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if (myExisting) {
        await updateReview(myExisting.id, { rating, comment });
      } else {
        await createReview({
          reviewerId: user.id,
          reviewerName: profile?.full_name || user.email || 'A user',
          revieweeId: selectedProviderId,
          targetType: 'provider',
          rating,
          comment,
        });
      }
      await loadReviews();
      const updatedReview = await fetchMyReviewForTarget(user.id, selectedProviderId);
      setMyExisting(updatedReview);
      setRating(updatedReview?.rating || rating);
      setComment(updatedReview?.comment || comment);
    } catch (err) {
      console.error('[Reviews] submit failed:', err);
      setError('Could not save your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (review: Review) => {
    if (!isAuthenticated) return;
    if (!window.confirm('Delete this review?')) return;
    try {
      await deleteReview(review.id);
      await loadReviews();
    } catch (err) {
      console.error('[Reviews] delete failed:', err);
    }
  };

  const myReviewIds = useMemo(
    () => new Set(reviews.filter((r) => r.reviewer_id === user?.id).map((r) => r.id)),
    [reviews, user?.id],
  );

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length;
  }, [reviews]);

  return (
    <AppLayout>
      <section className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reviews & Ratings</h1>
          </div>
          <p className="text-sm text-gray-600">
            Leave a star rating for a service provider and see what the community says.
          </p>

          {reviews.length > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
              <StarDisplay rating={averageRating} size={18} />
              <span className="text-sm font-bold text-gray-900">
                {averageRating.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500">
                based on {reviews.length} review{reviews.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>

        {/* Leave a review */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Leave a Review</h2>
          <p className="text-xs text-gray-500 mb-4">
            Rate a provider and share your experience. You can update or delete your review anytime.
          </p>

          {!isAuthenticated ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl bg-gray-50 border border-gray-100 p-4">
              <LogIn className="w-5 h-5 text-gray-400 shrink-0" />
              <p className="text-sm text-gray-600 flex-1">
                Sign in to leave a review and star rating.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-container"
              >
                Sign in <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Provider selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider to review
                </label>
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">— Select a provider —</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email || 'Provider'} — {p.specialty || p.service_category || 'Professional'}
                    </option>
                  ))}
                </select>
                {providers.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No providers available yet.</p>
                )}
              </div>

              {/* Star rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your rating
                </label>
                <StarRatingInput value={rating} onChange={setRating} />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your review
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Tell others about your experience with this provider…"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              {myExisting && selectedProvider && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  You already reviewed {selectedProvider.full_name || 'this provider'} — save to update it.
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {selectedProvider && (
                <div className="text-xs text-gray-500 mt-1">
                  Reviewing: <span className="font-semibold text-gray-700">{selectedProvider.full_name || selectedProvider.email}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !selectedProviderId}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {myExisting ? 'Update Review' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>

        {/* Reviews list */}
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {selectedProvider ? `Reviews for ${selectedProvider.full_name || selectedProvider.email}` : 'All Reviews'}
          </h2>
          <span className="text-xs text-gray-500">{reviews.length} total</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
            <Star className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              No reviews yet. Be the first to leave a review!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white border border-gray-100 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">
                        {review.reviewer_name || 'Anonymous'}
                      </p>
                      <span className="text-xs text-gray-400">
                        reviewed {review.reviewee_name || 'a provider'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StarDisplay rating={review.rating} />
                      <span className="text-xs text-gray-400">
                        {review.rating}.0 · {formatDate(review.created_at)}
                      </span>
                    </div>
                  </div>
                  {myReviewIds.has(review.id) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(review)}
                      aria-label="Delete review"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-600">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-container"
          >
            Back to profile <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}
