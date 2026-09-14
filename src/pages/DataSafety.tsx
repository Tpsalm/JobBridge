import { Link } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';

const ITEMS = [
  ['Account and contact information', 'Name, email address, phone number, location, and professional profile details are used to create your account, match opportunities, and communicate with you.'],
  ['Resumes and applications', 'Resume files, cover letters, and application details are shared with the recruiter or employer for the job you choose to apply for.'],
  ['Location and preferences', 'Location, work type, category, and job preferences help show relevant local or remote opportunities. You can edit these details in your profile.'],
  ['Messages and support requests', 'Messages, reports, and support requests are used to provide the service, investigate abuse, and respond to you.'],
  ['Payments', 'Payment details are processed by our payment provider. JobBridge does not store full card numbers.'],
  ['Retention and deletion', 'We keep account data while your account is active and remove or anonymize it after a verified deletion request, except for records we must retain by law. Android users can request deletion in the app or at /delete-account.'],
] as const;

export default function DataSafety() {
  return <div className="min-h-screen bg-gray-50 pb-24"><Header /><main className="max-w-4xl mx-auto px-4 py-8">
    <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 mb-6"><ArrowLeft className="w-4 h-4" />Back to Home</Link>
    <div className="rounded-2xl bg-emerald-900 p-6 sm:p-8 text-white mb-8"><ShieldCheck className="w-9 h-9 text-emerald-200 mb-4" /><h1 className="text-2xl sm:text-3xl font-bold">Data Safety</h1><p className="text-emerald-100 mt-3 max-w-2xl">A plain-language summary of the information JobBridge collects, why it is used, and how you control it.</p></div>
    <div className="grid gap-4">{ITEMS.map(([title, content]) => <section key={title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /><div><h2 className="font-semibold text-gray-900">{title}</h2><p className="text-sm leading-relaxed text-gray-700 mt-2">{content}</p></div></section>)}</div>
    <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-semibold text-blue-950">Your controls</h2><p className="text-sm text-blue-900 mt-2">Review or change your profile, privacy settings, and account status from your account. To request a complete deletion, use the <Link to="/delete-account" className="font-semibold underline">account deletion page</Link>.</p></div>
  </main><BottomNav /></div>;
}
