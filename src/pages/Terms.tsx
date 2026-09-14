import { Link } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { ArrowLeft, FileText } from 'lucide-react';

const SECTIONS = [
  ['Using JobBridge', 'JobBridge connects job seekers, recruiters, and service providers. You must provide accurate information, keep your account secure, and use the platform lawfully. You must be at least 18 years old or the age of majority where you live.'],
  ['Job postings and user content', 'Recruiters are responsible for the accuracy and legitimacy of job postings. Do not post scams, discriminatory requirements, misleading offers, malware, or requests for money or sensitive information. Users must not upload resume spam, impersonate another person, or harass other users.'],
  ['Applications and resumes', 'You decide what profile and resume information to share with a recruiter. JobBridge does not guarantee an interview, offer, employment outcome, or the accuracy of information submitted by another user.'],
  ['Payments and subscriptions', 'Paid plans and advertising services are described at checkout. Payment processing is handled by our payment provider. Unless required by law or stated at checkout, completed digital services are non-refundable.'],
  ['Moderation and enforcement', 'We may review, limit, remove, or suspend content and accounts that violate these terms, our policies, or applicable law. Use the report feature to notify us about suspicious or abusive content.'],
  ['Disclaimers and limitation of liability', 'JobBridge is provided on an as-available basis. To the extent permitted by law, we are not liable for indirect losses, employment decisions, third-party conduct, or content submitted by users.'],
  ['Changes and contact', 'We may update these terms when the service or law changes. Continued use after an update means you accept the revised terms. Questions can be sent to jobbridgesupport@gmail.com.'],
] as const;

export default function Terms() {
  return <div className="min-h-screen bg-gray-50 pb-24"><Header /><main className="max-w-4xl mx-auto px-4 py-8">
    <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 mb-6"><ArrowLeft className="w-4 h-4" />Back to Home</Link>
    <div className="rounded-2xl bg-slate-900 p-6 sm:p-8 text-white mb-8"><FileText className="w-9 h-9 text-amber-300 mb-4" /><h1 className="text-2xl sm:text-3xl font-bold">Terms of Service</h1><p className="text-slate-300 text-sm mt-2">Last updated: September 2026</p><p className="text-slate-300 mt-4 max-w-2xl">These terms set the rules for using JobBridge and help keep the professional community trustworthy.</p></div>
    <div className="space-y-4">{SECTIONS.map(([title, content], index) => <section key={title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"><h2 className="font-semibold text-gray-900"><span className="text-blue-700 mr-2">{index + 1}.</span>{title}</h2><p className="text-sm leading-relaxed text-gray-700 mt-3">{content}</p></section>)}</div>
    <p className="text-sm text-gray-600 mt-8">Read our <Link to="/privacy" className="text-blue-700 font-medium hover:underline">Privacy Policy</Link> and <Link to="/data-safety" className="text-blue-700 font-medium hover:underline">Data Safety information</Link>.</p>
  </main><BottomNav /></div>;
}
