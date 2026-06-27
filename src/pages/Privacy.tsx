import { Link } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import AnimatedSection from '../components/AnimatedSection';
import { Shield, CheckCircle, ChevronRight, Mail, ArrowLeft } from 'lucide-react';

const SECTIONS = [
  {
    title: 'What Information We Collect',
    content: 'We collect only the information you provide to us: your name, email address, phone number, profile details (professional headline, experience, skills, education, location), resume/CV documents, job application data, payment information (processed securely by Paystack — we never store card details), and communications with other users. We also collect basic usage data like page views and feature interactions to improve our platform.',
  },
  {
    title: 'How We Use Your Information',
    content: 'Your information is used to: create and maintain your account, match you with relevant job opportunities, enable recruiters to find your profile, process your applications, provide AI-powered features (resume builder, cover letter generator, interview prep), process payments and activate subscriptions, send important account notifications, improve and personalize your experience on the platform.',
  },
  {
    title: 'Information Sharing',
    content: 'We do not sell your personal data to third parties. Your profile information is visible to recruiters and employers on the platform as part of the job matching process. We share data with trusted service providers strictly for platform operations: Paystack (payment processing), OpenAI (AI features — anonymized queries), Supabase (database hosting), and Resend (transactional emails). These providers are contractually bound to protect your data.',
  },
  {
    title: 'Data Storage & Security',
    content: 'Your data is stored securely on Supabase infrastructure with encryption in transit (TLS) and at rest. Passwords are hashed and never stored in plain text. Access to your data is restricted to authenticated users with appropriate permissions. We implement security best practices including rate limiting, input sanitization, and regular security reviews. However, no online platform can guarantee 100% security — we encourage you to use strong passwords and enable two-factor authentication.',
  },
  {
    title: 'Your Rights & Choices',
    content: 'You have full control over your data: Access — view all your profile information anytime from the Profile page at /profile; Edit — update your personal and professional information at any time; Delete — permanently delete your account and all associated data from the Danger Zone at /profile (contact jobbridgesupport@gmail.com for assistance); Privacy Settings — control profile visibility, talent search visibility, and recruiter contact preferences from the Settings page at /settings; Withdraw Consent — you may stop using the platform at any time and request data deletion.',
  },
  {
    title: 'Cookies & Tracking',
    content: 'JobBridge uses essential cookies and local storage for authentication (session management), user preferences (saved jobs, notification settings), and platform functionality. We do not use third-party tracking cookies, advertising cookies, or analytics cookies. The platform does not serve personalized ads. Local storage data is stored on your device and can be cleared at any time from your browser settings.',
  },
  {
    title: 'Data Retention',
    content: 'We retain your account information for as long as your account remains active. If you delete your account, your profile information, applications, and associated data are permanently removed from our systems. Usage analytics data may be retained in anonymized form for platform improvement. Payment records are retained as required by financial regulations.',
  },
  {
    title: 'Third-Party Links',
    content: 'The platform may contain links to third-party websites or services (e.g., social media pages, WhatsApp). We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information. This includes our WhatsApp chat support, LinkedIn, Instagram, Facebook, and X (Twitter) pages.',
  },
  {
    title: 'Children\'s Privacy',
    content: 'JobBridge is intended for users who are at least 18 years of age or the age of majority in their jurisdiction. We do not knowingly collect information from children under 18. If you believe a child has provided us with personal data, please contact us immediately at jobbridgesupport@gmail.com so we can take appropriate action.',
  },
  {
    title: 'Changes to This Policy',
    content: 'We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or platform features. Material changes will be communicated via email or platform notification. The "Last Updated" date at the top of this page will reflect the most recent revision. Your continued use of the platform after changes constitutes acceptance of the updated policy.',
  },
  {
    title: 'Contact Us',
    content: 'If you have questions, concerns, or requests regarding your privacy or this policy, please contact our support team: Email jobbridgesupport@gmail.com, visit the Support page at /support, or use the WhatsApp chat at 09136171354. We aim to respond to all privacy inquiries within 48 hours.',
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 sm:p-8 mb-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-blue-300 blur-3xl" />
          </div>
          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Privacy Center</h1>
              <p className="text-blue-100 text-sm">Last updated: June 2026</p>
              <p className="text-blue-100 mt-2 max-w-2xl">
                Your privacy matters to us. This policy explains how JobBridge collects, uses, stores, and protects your personal information when you use our platform.
              </p>
            </div>
          </div>
        </div>

        {/* Quick summary */}
        <AnimatedSection direction="up">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-8">
            <h2 className="font-bold text-gray-900 mb-4">Our Privacy Promise</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { title: 'We never sell your data', desc: 'Your personal information is yours. We do not sell it to anyone.' },
                { title: 'You stay in control', desc: 'View, edit, or delete your data anytime from your Profile and Settings.' },
                { title: 'Secure by default', desc: 'Encrypted in transit and at rest. Industry-standard security practices.' },
              ].map((item) => (
                <div key={item.title} className="bg-blue-50 rounded-xl p-4">
                  <CheckCircle className="w-5 h-5 text-blue-700 mb-2" />
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Policy sections */}
        <AnimatedSection direction="up" delay={100}>
          <div className="space-y-4">
            {SECTIONS.map((section, idx) => (
              <details key={section.title} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group">
                <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors list-none">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <h2 className="font-semibold text-gray-900 text-sm sm:text-base">{section.title}</h2>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <div className="px-5 pb-5 pt-0 border-t border-gray-100">
                  <p className="text-sm text-gray-700 leading-relaxed mt-4">{section.content}</p>
                </div>
              </details>
            ))}
          </div>
        </AnimatedSection>

        {/* Contact CTA */}
        <AnimatedSection direction="up" delay={200}>
          <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 sm:p-8 mt-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-1/2 w-72 h-72 rounded-full bg-white blur-3xl -translate-x-1/2" />
            </div>
            <div className="relative text-center">
              <Mail className="w-8 h-8 text-amber-300 mx-auto mb-3" />
              <h2 className="text-xl font-bold mb-2">Have a Privacy Question?</h2>
              <p className="text-blue-100 text-sm mb-5 max-w-md mx-auto">
                Our support team is ready to help with any questions about your data and privacy.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="mailto:jobbridgesupport@gmail.com"
                  className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-50 transition-colors text-sm"
                >
                  <Mail className="w-4 h-4" />
                  Email Privacy Team
                </a>
                <Link
                  to="/support"
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-500 transition-colors border border-blue-500 text-sm"
                >
                  Visit Support Page
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </main>

      <BottomNav />
    </div>
  );
}