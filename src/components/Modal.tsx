import { useModal } from '../contexts/ModalContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { createJob, createApplication, decrementCredits } from '../lib/supabaseQueries';
import { sendEmail } from '../lib/email';
import { checkRateLimit } from '../lib/security';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Wrench, ArrowRight, BadgeCheck, Loader2, CheckCircle, Mail, Eye, EyeOff, Lock } from 'lucide-react';

export function ModalRenderer() {
  const { modalType, modalData, closeModal } = useModal();

  if (!modalType) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={closeModal}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto ${modalType === 'signup' || modalType === 'auth-required' ? 'max-w-lg w-full' : 'max-w-md w-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {modalType === 'post-job' && <PostJobModal onClose={closeModal} />}
        {modalType === 'message' && <MessageModal data={modalData} onClose={closeModal} />}
        {modalType === 'profile' && <ProfileModal data={modalData} onClose={closeModal} />}
        {modalType === 'hire' && <HireModal data={modalData} onClose={closeModal} />}
        {modalType === 'premium' && <PremiumModal onClose={closeModal} />}
        {modalType === 'notifications' && <NotificationsModal onClose={closeModal} />}
        {modalType === 'schedule-interview' && <ScheduleInterviewModal data={modalData} onClose={closeModal} />}
        {modalType === 'apply-job' && <ApplyJobModal data={modalData} onClose={closeModal} />}
        {modalType === 'service-request' && <ServiceRequestModal onClose={closeModal} />}
        {modalType === 'ai-resume' && <AIResumeModal onClose={closeModal} />}
        {modalType === 'connect' && <ConnectModal data={modalData} onClose={closeModal} />}
        {modalType === 'info' && <InfoModal data={modalData} onClose={closeModal} />}
        {modalType === 'signup' && <SignupModal data={modalData} onClose={closeModal} />}
        {modalType === 'auth-required' && <AuthRequiredModal data={modalData} onClose={closeModal} />}
        {modalType === 'login' && <LoginModal data={modalData} onClose={closeModal} />}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between p-5 border-b border-outline-variant">
      <h2 className="text-lg font-bold text-on-surface">{title}</h2>
      <button onClick={onClose} className="p-1 hover:bg-surface-container rounded-full transition-colors">
        <span className="material-symbols-outlined text-on-surface-variant">close</span>
      </button>
    </div>
  );
}

function SuccessState({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="p-8 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-green-600 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      </div>
      <p className="text-on-surface font-semibold text-lg mb-2">{message}</p>
      <button onClick={onClose} className="mt-4 bg-primary text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity">Done</button>
    </div>
  );
}

function PostJobModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noCredits, setNoCredits] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', location: '', type: 'Full-time', salary: '', description: '' });
  const { user, profile, subscription, fetchSubscription } = useAuth();
  const navigate = useNavigate();

  if (noCredits) {
    return (
      <>
        <ModalHeader title="No Credits Available" onClose={onClose} />
        <div className="p-5 text-center">
          <span className="material-symbols-outlined text-5xl text-amber-500 mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>credit_card_off</span>
          <p className="text-gray-700 mb-2">You don't have any job posting credits.</p>
          <p className="text-sm text-gray-500 mb-6">Subscribe to a plan to get credits and post jobs.</p>
          <button
            onClick={() => { onClose(); navigate('/pricing'); }}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity mb-2"
          >
            View Plans
          </button>
          <button onClick={onClose} className="w-full border border-outline text-on-surface py-2.5 rounded-lg font-semibold hover:bg-surface-container transition-colors">
            Cancel
          </button>
        </div>
      </>
    );
  }

  if (submitted) return <SuccessState message="Your job posting is live! Candidates can now apply." onClose={onClose} />;

  return (
    <>
      <ModalHeader title="Post a New Job" onClose={onClose} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-surface-container-high'}`} />
          ))}
        </div>
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant font-semibold uppercase tracking-wider">Step 1: Job Details</p>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Job Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Senior Product Designer" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Company Name *</label>
              <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Your company name" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="City or Remote" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors bg-white">
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                  <option>Freelance</option>
                </select>
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={!form.title || !form.company} className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">Continue</button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant font-semibold uppercase tracking-wider">Step 2: Compensation & Description</p>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Salary Range</label>
              <input value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} placeholder="e.g. ₦80k - ₦120k" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Job Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={5} placeholder="Describe the role, responsibilities, and requirements..." className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-outline text-on-surface py-2.5 rounded-lg font-semibold hover:bg-surface-container transition-colors">Back</button>
              <button onClick={() => setStep(3)} disabled={!form.description} className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">Continue</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant font-semibold uppercase tracking-wider">Step 3: Review & Publish</p>
            <div className="bg-surface-container-low rounded-xl p-4 space-y-2">
              <div className="flex justify-between"><span className="text-xs text-on-surface-variant">Title</span><span className="text-sm font-semibold">{form.title}</span></div>
              <div className="flex justify-between"><span className="text-xs text-on-surface-variant">Company</span><span className="text-sm font-semibold">{form.company}</span></div>
              <div className="flex justify-between"><span className="text-xs text-on-surface-variant">Location</span><span className="text-sm font-semibold">{form.location || 'Remote'}</span></div>
              <div className="flex justify-between"><span className="text-xs text-on-surface-variant">Type</span><span className="text-sm font-semibold">{form.type}</span></div>
              {form.salary && <div className="flex justify-between"><span className="text-xs text-on-surface-variant">Salary</span><span className="text-sm font-semibold">{form.salary}</span></div>}
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <span className="text-xs font-bold text-primary uppercase">AI-Powered</span>
              </div>
              <p className="text-xs text-on-surface-variant">Our AI will automatically match your posting with relevant candidates and notify you of top matches within 24 hours.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-outline text-on-surface py-2.5 rounded-lg font-semibold hover:bg-surface-container transition-colors">Back</button>
              <button onClick={async () => {
                // Check subscription credits first
                if (subscription.status !== 'active' || subscription.credits < 1) {
                  setNoCredits(true);
                  return;
                }
                try {
                  setSubmitting(true);
                  await createJob({
                    recruiter_id: profile?.id || user?.id || '',
                    title: form.title,
                    company: form.company,
                    description: form.description,
                    location: form.location,
                    type: form.type,
                    salary_range: form.salary || '',
                    category: '',
                    requirements: [],
                    benefits: [],
                  });
                  // Decrement credits after successful job post
                  try {
                    await decrementCredits(user?.id || profile?.id || '');
                  } catch (creditErr) {
                    console.warn('Failed to decrement credits:', creditErr);
                  }
                  try { window.dispatchEvent(new CustomEvent('jobs:updated')); } catch (e) { console.warn('Failed to dispatch jobs:updated event', e); }
                  await fetchSubscription();
                  // Send job posted confirmation email
                  if (user?.email) {
                    sendEmail({ type: 'job_posted', email: user.email, name: profile?.full_name || 'there', jobTitle: form.title, company: form.company });
                  }
                  setSubmitted(true);
                } catch (err) {
                  console.error('Post job error', err);
                  alert('Failed to post job. See console for details.');
                } finally {
                  setSubmitting(false);
                }
              }} disabled={submitting} className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-lg">publish</span>
                {submitting ? 'Posting...' : 'Post Job'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function MessageModal({ data, onClose }: { data: { name?: string; role?: string }; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) return <SuccessState message={`Message sent to ${data.name || 'Candidate'}!`} onClose={onClose} />;

  return (
    <>
      <ModalHeader title={`Message ${data.name || 'Candidate'}`} onClose={onClose} />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-bold text-on-secondary-container text-sm">
            {(data.name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-sm">{data.name || 'Candidate'}</p>
            <p className="text-xs text-on-surface-variant">{data.role || 'Professional'}</p>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Subject</label>
          <input defaultValue="Opportunity at JobBridge" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder={`Hi ${data.name?.split(' ')[0] || 'there'}, I came across your profile and would love to connect...`} className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
        </div>
        <button onClick={() => message.trim() && setSent(true)} disabled={!message.trim()} className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-lg">send</span>
          Send Message
        </button>
      </div>
    </>
  );
}

function ProfileModal({ data, onClose }: { data: { name?: string; role?: string; match?: string }; onClose: () => void }) {
  const { openModal } = useModal();
  return (
    <>
      <ModalHeader title="Candidate Profile" onClose={onClose} />
      <div className="p-5 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-secondary-container flex items-center justify-center font-bold text-on-secondary-container text-xl flex-shrink-0">
            {(data.name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg">{data.name || 'Candidate'}</h3>
                <p className="text-sm text-on-surface-variant">{data.role || 'Professional'}</p>
              </div>
              {data.match && <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">{data.match}</span>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">location_on</span>
              <span className="text-xs text-on-surface-variant">Available for Remote / Hybrid</span>
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold text-on-surface-variant uppercase mb-2">Key Skills</h4>
          <div className="flex flex-wrap gap-2">
            {['Figma', 'User Research', 'Design Systems', 'Prototyping', 'B2B SaaS'].map(s => (
              <span key={s} className="px-3 py-1 bg-surface-container rounded-full text-xs font-medium text-on-surface-variant">{s}</span>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold text-on-surface-variant uppercase mb-2">Experience</h4>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-surface-container rounded flex items-center justify-center flex-shrink-0"><span className="material-symbols-outlined text-sm text-on-surface-variant">work</span></div>
              <div><p className="text-sm font-semibold">Senior UX Designer</p><p className="text-xs text-on-surface-variant">TechStream Inc. • 2021 – Present</p></div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-surface-container rounded flex items-center justify-center flex-shrink-0"><span className="material-symbols-outlined text-sm text-on-surface-variant">work</span></div>
              <div><p className="text-sm font-semibold">Product Designer</p><p className="text-xs text-on-surface-variant">Innovate UX • 2018 – 2021</p></div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => { onClose(); setTimeout(() => openModal('schedule-interview', data), 100); }} className="flex-1 border border-primary text-primary py-2.5 rounded-lg font-semibold hover:bg-primary-fixed transition-colors text-sm">Schedule Interview</button>
          <button onClick={() => { onClose(); setTimeout(() => openModal('message', data), 100); }} className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm">Send Message</button>
        </div>
      </div>
    </>
  );
}

function HireModal({ data, onClose }: { data: { name?: string; role?: string }; onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [details, setDetails] = useState('');

  if (submitted) return <SuccessState message={`Inquiry sent to ${data.name || 'Provider'}! They'll respond within 24 hours.`} onClose={onClose} />;

  return (
    <>
      <ModalHeader title={`Hire ${data.name || 'Provider'}`} onClose={onClose} />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
          <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center font-bold text-primary text-sm">
            {(data.name || 'P').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-sm">{data.name}</p>
            <p className="text-xs text-on-surface-variant">{data.role || 'Service Provider'}</p>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Project Title</label>
          <input placeholder="Brief project name" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Budget Range</label>
          <select className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white">
            <option>₦50k – ₦100k</option>
            <option>₦100k – ₦250k</option>
            <option>₦250k – ₦500k</option>
            <option>₦500k+</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Project Details</label>
          <textarea value={details} onChange={e => setDetails(e.target.value)} rows={4} placeholder="Describe what you need..." className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
        </div>
        <button onClick={() => details.trim() && setSubmitted(true)} disabled={!details.trim()} className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
          Send Hiring Request
        </button>
      </div>
    </>
  );
}

function PremiumModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState('monthly');
  const [subscribed, setSubscribed] = useState(false);

  if (subscribed) return <SuccessState message="Welcome to JobBridge Premium! All features are now unlocked." onClose={onClose} />;

  return (
    <>
      <ModalHeader title="Upgrade to Premium" onClose={onClose} />
      <div className="p-5 space-y-5">
        <div className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-5 text-white">
          <span className="material-symbols-outlined text-3xl mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
          <h3 className="font-bold text-xl">JobBridge Premium</h3>
          <p className="text-sm opacity-90 mt-1">Land your dream job 2x faster with premium tools</p>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-outline-variant">
          {[{ key: 'monthly', label: 'Monthly', price: '₦1,500' }, { key: 'yearly', label: 'Yearly', price: '₦15,000', badge: 'Save 17%' }].map(p => (
            <button key={p.key} onClick={() => setSelected(p.key)} className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${selected === p.key ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
              {p.label}
              <br />
              <span className={`text-xs font-normal ${selected === p.key ? 'opacity-80' : ''}`}>{p.price}</span>
              {p.badge && <span className="absolute -top-2 right-1 bg-green-500 text-white text-[9px] px-1 rounded-full">{p.badge}</span>}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {['Direct messaging to recruiters', 'AI-powered resume builder', 'Unlimited job applications', 'Priority in search results', 'Interview prep simulations', 'Salary insights & benchmarks'].map(f => (
            <div key={f} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <span className="text-sm">{f}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setSubscribed(true)} className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
          Start Premium {selected === 'monthly' ? '— ₦1,500/mo' : '— ₦15,000/yr'}
        </button>
        <p className="text-xs text-center text-on-surface-variant">Cancel anytime. No hidden fees.</p>
      </div>
    </>
  );
}

function NotificationsModal({ onClose }: { onClose: () => void }) {
  const notifications = [
    { icon: 'visibility', color: 'bg-secondary-container text-secondary', text: 'Google Recruitment Team viewed your profile', time: '2h ago', unread: true },
    { icon: 'work', color: 'bg-primary-fixed text-primary', text: 'New job match: Staff Product Designer at TechStream', time: '4h ago', unread: true },
    { icon: 'calendar_today', color: 'bg-tertiary-fixed text-tertiary', text: 'Interview scheduled with Stripe for Oct 15', time: '1d ago', unread: false },
    { icon: 'person_add', color: 'bg-surface-container-high text-on-surface-variant', text: 'Amara Okeke accepted your connection request', time: '2d ago', unread: false },
    { icon: 'trending_up', color: 'bg-green-100 text-green-700', text: 'Your profile is in the top 10% this week', time: '3d ago', unread: false },
  ];

  return (
    <>
      <ModalHeader title="Notifications" onClose={onClose} />
      <div className="divide-y divide-outline-variant">
        {notifications.map((n, i) => (
          <div key={i} className={`flex items-start gap-3 p-4 hover:bg-surface-container-low transition-colors cursor-pointer ${n.unread ? 'bg-primary-fixed/20' : ''}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${n.color}`}>
              <span className="material-symbols-outlined text-lg">{n.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${n.unread ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>{n.text}</p>
              <p className="text-xs text-on-surface-variant mt-1">{n.time}</p>
            </div>
            {n.unread && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />}
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-outline-variant">
        <button onClick={onClose} className="w-full text-primary font-semibold text-sm hover:underline">Mark all as read</button>
      </div>
    </>
  );
}

function ScheduleInterviewModal({ data, onClose }: { data: { name?: string }; onClose: () => void }) {
  const [scheduled, setScheduled] = useState(false);

  if (scheduled) return <SuccessState message={`Interview with ${data.name || 'Candidate'} has been scheduled!`} onClose={onClose} />;

  return (
    <>
      <ModalHeader title="Schedule Interview" onClose={onClose} />
      <div className="p-5 space-y-4">
        <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">person</span>
          <div>
            <p className="font-semibold text-sm">{data.name || 'Candidate'}</p>
            <p className="text-xs text-on-surface-variant">Interview Candidate</p>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Interview Type</label>
          <select className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white">
            <option>Video Call</option>
            <option>Phone Call</option>
            <option>In-Person</option>
            <option>Portfolio Review</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Date</label>
            <input type="date" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Time</label>
            <input type="time" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Notes</label>
          <textarea rows={3} placeholder="Any specific topics to discuss?" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
        </div>
        <button onClick={() => setScheduled(true)} className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-lg">event</span>
          Confirm Schedule
        </button>
      </div>
    </>
  );
}

function ApplyJobModal({ data, onClose }: { data: { job_id?: string; title?: string; company?: string }; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const [form, setForm] = useState({
    date_of_birth: '',
    gender: '',
    is_disabled: 'no',
    is_displaced: 'no',
    professional_headline: '',
    years_of_experience: '',
    function: '',
    work_type: '',
    highest_qualification: '',
    location: '',
    availability: '',
    salary_expectation: '',
    cover_letter: '',
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvName, setCvName] = useState('');

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'text/rtf'];
      if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|rtf)$/i)) {
        setError('Only pdf, doc, docx & rtf files allowed');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File must be smaller than 10MB');
        return;
      }
      setError('');
      setCvFile(file);
      setCvName(file.name);
    }
  };

  const handleSubmit = async () => {
    if (!form.professional_headline || !form.years_of_experience) {
      setError('Professional headline and years of experience are required');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      let resume_url = '';
      if (cvFile) {
        const fileExt = cvFile.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, cvFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('resumes')
            .getPublicUrl(fileName);
          resume_url = urlData?.publicUrl || '';
        }
      }

      await createApplication({
        job_id: data.job_id || '',
        applicant_id: user?.id || '',
        cover_letter: form.cover_letter,
        resume_url,
      });
      try { window.dispatchEvent(new CustomEvent('applications:updated')); } catch (e) {}
      setApplied(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (applied) return <SuccessState message={`Application submitted for ${data.title || 'the position'} at ${data.company || 'Company'}! Good luck!`} onClose={onClose} />;

  const inputClass = "w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors bg-white";
  const labelClass = "block text-xs font-semibold text-on-surface-variant uppercase mb-1";

  return (
    <>
      <ModalHeader title="Apply for Position" onClose={onClose} />
      <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
        {/* Job info */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="font-bold text-primary">{data.title || 'Position'}</p>
          <p className="text-sm text-on-surface-variant">{data.company || 'Company'}</p>
        </div>

        <p className="text-sm text-gray-700 font-medium">Let's get started, please take the time to fill out this form.</p>

        {step === 1 && (
          <div className="space-y-4">
            {/* Date of Birth */}
            <div>
              <label className={labelClass}>Date of birth *</label>
              <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} className={inputClass} />
            </div>

            {/* Gender */}
            <div>
              <label className={labelClass}>Gender</label>
              <div className="flex gap-4">
                {['Male', 'Female'].map(g => (
                  <button key={g} type="button" onClick={() => update('gender', g.toLowerCase())}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.gender === g.toLowerCase() ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline hover:border-primary'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Disabled */}
            <div>
              <label className={labelClass}>Disabled</label>
              <div className="flex gap-4">
                {['Yes', 'No'].map(v => (
                  <button key={v} type="button" onClick={() => update('is_disabled', v.toLowerCase())}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.is_disabled === v.toLowerCase() ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline hover:border-primary'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Internally displaced */}
            <div>
              <label className={labelClass}>Internally displaced person</label>
              <div className="flex gap-4">
                {['Yes', 'No'].map(v => (
                  <button key={v} type="button" onClick={() => update('is_displaced', v.toLowerCase())}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${form.is_displaced === v.toLowerCase() ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline hover:border-primary'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Inclusion note */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                <span className="font-semibold">Note:</span> Inclusion is our culture. We champion all talent: women, men, displaced, and PWDs.
              </p>
            </div>

            {/* Professional Headline */}
            <div>
              <label className={labelClass}>Professional headline / title *</label>
              <input type="text" value={form.professional_headline} onChange={e => update('professional_headline', e.target.value)} placeholder="e.g. Senior Accountant" className={inputClass} />
            </div>

            {/* Years of Experience */}
            <div>
              <label className={labelClass}>Years of Experience *</label>
              <select value={form.years_of_experience} onChange={e => update('years_of_experience', e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {['Entry (0-1)', '1-2', '3-5', '5-7', '7-10', '10+'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Function */}
            <div>
              <label className={labelClass}>Function *</label>
              <select value={form.function} onChange={e => update('function', e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {['Accounting', 'Administration', 'Banking & Finance', 'Customer Service', 'Education', 'Engineering', 'Healthcare', 'Hospitality', 'Human Resources', 'IT & Software', 'Legal', 'Logistics', 'Marketing', 'Operations', 'Sales', 'Security', 'Other'].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <button onClick={() => setStep(2)} disabled={!form.professional_headline || !form.years_of_experience || !form.function}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* Work Type */}
            <div>
              <label className={labelClass}>Work Type *</label>
              <select value={form.work_type} onChange={e => update('work_type', e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {['Full-time', 'Part-time', 'Contract', 'Remote', 'Hybrid', 'Freelance'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Highest Qualification */}
            <div>
              <label className={labelClass}>Highest Qualification *</label>
              <select value={form.highest_qualification} onChange={e => update('highest_qualification', e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {['SSCE / O-Level', 'OND / Diploma', 'HND / Bachelors', "Master's", 'PhD', 'Professional Certification', 'Vocational Training'].map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className={labelClass}>Location *</label>
              <input type="text" value={form.location} onChange={e => update('location', e.target.value)} placeholder="City, State" className={inputClass} />
            </div>

            {/* Availability */}
            <div>
              <label className={labelClass}>Availability *</label>
              <select value={form.availability} onChange={e => update('availability', e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {['Immediately', '2 weeks', '1 month', 'Notice period'].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Salary */}
            <div>
              <label className={labelClass}>Monthly Salary Expectation (Gross) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">NGN</span>
                <input type="number" value={form.salary_expectation} onChange={e => update('salary_expectation', e.target.value)} placeholder="0" className="w-full border border-outline rounded-lg pl-14 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-outline text-on-surface py-2.5 rounded-lg font-semibold hover:bg-surface-container transition-colors text-sm">Back</button>
              <button onClick={() => setStep(3)} disabled={!form.work_type || !form.highest_qualification || !form.location || !form.availability || !form.salary_expectation}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-sm">
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {/* CV Upload */}
            <div>
              <label className={labelClass}>Upload your CV</label>
              <p className="text-xs text-on-surface-variant mb-2">pdf, doc, docx & rtf files no bigger than 10MB.</p>
              <label className="border-2 border-dashed border-outline-variant rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors block">
                <input type="file" accept=".pdf,.doc,.docx,.rtf" onChange={handleCvChange} className="hidden" />
                {cvName ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="text-sm font-medium text-gray-700">{cvName}</span>
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">upload_file</span>
                    <p className="mt-1 text-sm font-semibold text-gray-700">Tap to upload your CV</p>
                  </>
                )}
              </label>
            </div>

            {/* Cover Letter */}
            <div>
              <label className={labelClass}>Cover letter (optional)</label>
              <textarea value={form.cover_letter} onChange={e => update('cover_letter', e.target.value)} rows={4}
                placeholder="Tell the employer why you're a great fit..."
                className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
            </div>

            {/* Error */}
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-outline text-on-surface py-2.5 rounded-lg font-semibold hover:bg-surface-container transition-colors text-sm">Back</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-sm flex items-center justify-center gap-2">
                {submitting ? (
                  <><span className="material-symbols-outlined animate-spin text-lg">refresh</span> Submitting...</>
                ) : (
                  'Submit and apply'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ServiceRequestModal({ onClose }: { onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return <SuccessState message="Service request posted! You'll receive bids within 2 hours." onClose={onClose} />;

  return (
    <>
      <ModalHeader title="Post a Service Request" onClose={onClose} />
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Service Type</label>
          <select className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white">
            <option>Software Development</option>
            <option>Graphic Design</option>
            <option>Plumbing</option>
            <option>Electrical Work</option>
            <option>Tutoring</option>
            <option>Legal Services</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Location</label>
          <input placeholder="City or 'Remote'" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Budget Range</label>
          <input placeholder="e.g. ₦50,000 – ₦100,000" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Description</label>
          <textarea rows={4} placeholder="Describe what you need in detail..." className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
        </div>
        <button onClick={() => setSubmitted(true)} className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity">Post Request</button>
      </div>
    </>
  );
}

function AIResumeModal({ onClose }: { onClose: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2000);
  };

  if (generated) return (
    <>
      <ModalHeader title="AI Resume Generated" onClose={onClose} />
      <div className="p-5 space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-green-600 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <div>
            <p className="font-semibold text-sm text-green-800">Resume Generated Successfully!</p>
            <p className="text-xs text-green-700">Tailored for Senior Product Designer roles</p>
          </div>
        </div>
        <div className="border border-outline-variant rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-lg">description</span><span className="font-semibold">Victor_Eniola_AI_Resume.pdf</span></div>
          <p className="text-xs text-on-surface-variant">Optimized with 94% keyword match rate for target roles</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-primary text-primary py-2.5 rounded-lg font-semibold hover:bg-primary-fixed transition-colors text-sm">Preview</button>
          <button onClick={onClose} className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg">download</span>Download
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <ModalHeader title="Build AI Resume" onClose={onClose} />
      <div className="p-5 space-y-4">
        <div className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-5 text-white">
          <span className="material-symbols-outlined text-3xl mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          <p className="font-bold text-lg">AI-Powered Resume Builder</p>
          <p className="text-sm opacity-90 mt-1">Generate a tailored resume in seconds</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Target Job Title</label>
          <input defaultValue="Senior Product Designer" className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Industry</label>
          <select className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white">
            <option>Technology</option>
            <option>Fintech</option>
            <option>Healthcare</option>
            <option>E-Commerce</option>
          </select>
        </div>
        <button onClick={handleGenerate} disabled={generating} className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-70 transition-opacity flex items-center justify-center gap-2">
          {generating ? (
            <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>Generating Resume...</>
          ) : (
            <><span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>Generate Resume</>
          )}
        </button>
      </div>
    </>
  );
}

function ConnectModal({ data, onClose }: { data: { name?: string; role?: string }; onClose: () => void }) {
  const [connected, setConnected] = useState(false);

  if (connected) return <SuccessState message={`Connection request sent to ${data.name}!`} onClose={onClose} />;

  return (
    <>
      <ModalHeader title="Connect" onClose={onClose} />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
          <div className="w-14 h-14 rounded-xl bg-secondary-container flex items-center justify-center font-bold text-on-secondary-container text-xl">
            {(data.name || 'C').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-bold">{data.name || 'Professional'}</p>
            <p className="text-sm text-on-surface-variant">{data.role || 'Professional'}</p>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">Add a Note (Optional)</label>
          <textarea rows={3} placeholder="Introduce yourself or mention why you'd like to connect..." className="w-full border border-outline rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
        </div>
        <button onClick={() => setConnected(true)} className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-lg">person_add</span>Send Connection Request
        </button>
      </div>
    </>
  );
}

function InfoModal({ data, onClose }: { data: { title?: string; content?: string }; onClose: () => void }) {
  return (
    <>
      <ModalHeader title={data.title || 'Information'} onClose={onClose} />
      <div className="p-5">
        <p className="text-sm text-on-surface-variant leading-relaxed">{data.content || 'More information coming soon.'}</p>
        <button onClick={onClose} className="mt-4 w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity">Got it</button>
      </div>
    </>
  );
}

function SignupModal({ data, onClose }: { data: { pendingAction?: string; requiredRole?: 'recruiter' | 'provider' }; onClose?: () => void }) {
  const { signUp, session } = useAuth();
  const navigate = useNavigate();
  const { closeModal: closeCurrentModal, openModal } = useModal();
  const [selectedRole, setSelectedRole] = useState<'recruiter' | 'provider' | null>(data.requiredRole || null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !formData.email || !formData.name || !formData.password) return;
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError(null);

    const { error: signupError, session: newSession } = await signUp(formData.email, formData.password, formData.name, selectedRole);

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    setLoading(false);

    // If user is now signed in (session returned — no email confirmation required), redirect
    if (newSession || session) {
      closeCurrentModal();
      window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: 'Account created!', type: 'success' } }));
      navigate('/profile');
      return;
    }

    // Show success popup for recruiters and providers (email confirmation required)
    if (selectedRole === 'recruiter' || selectedRole === 'provider') {
      setShowSuccess(true);
      window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: 'Account created successfully! Check your email.', type: 'success' } }));
      return;
    }

    // For other roles, proceed normally
    window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: 'Account created successfully', type: 'success' } }));
    closeCurrentModal();
    if (data.pendingAction === 'apply-job') {
      setTimeout(() => openModal('apply-job', data), 100);
    } else if (data.pendingAction === 'message') {
      setTimeout(() => openModal('message', data), 100);
    } else if (data.pendingAction === 'post-job') {
      setTimeout(() => openModal('post-job'), 100);
    } else if (data.pendingAction === 'hire') {
      setTimeout(() => openModal('hire', data), 100);
    } else if (data.pendingAction === 'service-request') {
      setTimeout(() => openModal('service-request'), 100);
    }
  };

  const handleSuccessContinue = () => {
    setShowSuccess(false);
    closeCurrentModal();
    navigate('/');
  };

  // Success state view
  if (showSuccess) {
    const isRecruiter = selectedRole === 'recruiter';
    return (
      <div className="p-6">
        {/* Success Header */}
        <div className="text-center mb-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isRecruiter ? 'bg-blue-100' : 'bg-emerald-100'}`}>
            <CheckCircle className={`w-10 h-10 ${isRecruiter ? 'text-blue-600' : 'text-emerald-600'}`} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account Created!</h2>
          <p className="text-sm text-gray-500">
            Your {isRecruiter ? 'Recruiter' : 'Service Provider'} account is ready
          </p>
        </div>

        {/* Next steps */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <h3 className="font-bold text-gray-900 text-sm mb-3">What happens next?</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${isRecruiter ? 'bg-blue-600' : 'bg-emerald-600'}`}>1</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Verify your email</p>
                <p className="text-xs text-gray-500">We've sent a code to <strong>{formData.email}</strong></p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${isRecruiter ? 'bg-blue-600' : 'bg-emerald-600'}`}>2</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Complete your profile</p>
                <p className="text-xs text-gray-500">{isRecruiter ? 'Add company details and start posting jobs' : 'Set up your service profile and showcase skills'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${isRecruiter ? 'bg-blue-600' : 'bg-emerald-600'}`}>3</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Start {isRecruiter ? 'hiring talent' : 'getting clients'}</p>
                <p className="text-xs text-gray-500">{isRecruiter ? 'Access AI-powered talent matching' : 'Receive inquiries and grow your business'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleSuccessContinue}
          className={`w-full py-3 rounded-lg font-semibold text-white transition flex items-center justify-center gap-2 ${isRecruiter ? 'bg-blue-700 hover:bg-blue-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}
        >
          <Mail className="w-5 h-5" />
          Verify Email & Continue
        </button>

        <p className="text-xs text-gray-400 text-center mt-3">
          Check your email inbox and spam folder for the verification code
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {!showForm ? (
        <>
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-700 flex items-center justify-center mx-auto mb-4">
              <BadgeCheck className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Create Your Account</h2>
            <p className="text-sm text-gray-500">
              {data.pendingAction
                ? `Sign up to ${data.pendingAction === 'apply-job' ? 'apply for jobs' : data.pendingAction === 'post-job' ? 'post jobs' : data.pendingAction === 'message' ? 'send messages' : 'continue'}`
                : 'Join JobBridge today'}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { setSelectedRole('recruiter'); setShowForm(true); }}
              className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Building className="w-5 h-5 text-blue-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Sign up as Recruiter</h3>
                  <p className="text-xs text-gray-500">Post jobs, find talent, hire</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
            </button>

            <button
              onClick={() => { setSelectedRole('provider'); setShowForm(true); }}
              className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <Wrench className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Sign up as Service Provider</h3>
                  <p className="text-xs text-gray-500">Offer services, find clients</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Already have an account?{' '}
            <button onClick={() => { closeCurrentModal(); setTimeout(() => navigate('/login'), 100); }} className="text-blue-700 font-medium hover:underline">
              Sign in
            </button>
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700">
              ← Back
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedRole === 'recruiter' ? 'bg-blue-700' : 'bg-emerald-700'}`}>
              {selectedRole === 'recruiter' ? (
                <Building className="w-5 h-5 text-white" />
              ) : (
                <Wrench className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Create {selectedRole === 'recruiter' ? 'Recruiter' : 'Service Provider'} Account</h2>
              <p className="text-xs text-gray-500">Fill in your details to continue</p>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  placeholder="Minimum 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.password.length > 0 && formData.password.length < 6 && (
                <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>
              )}
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || formData.password.length < 6}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${selectedRole === 'recruiter' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-emerald-700 hover:bg-emerald-800'} disabled:opacity-70`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account & Continue'
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function AuthRequiredModal({ data, onClose }: { data: { pendingAction?: string; requiredRole?: 'recruiter' | 'provider'; title?: string; company?: string; name?: string }; onClose?: () => void }) {
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();

  const actionMessages: Record<string, { title: string; description: string; icon: React.ReactNode }> = {
    'apply-job': { title: 'Sign up to Apply', description: 'Create an account to apply for this job and track your applications.', icon: '📄' },
    'message': { title: 'Sign up to Message', description: 'Create an account to send messages to candidates and providers.', icon: '💬' },
    'post-job': { title: 'Sign up to Post Jobs', description: 'Recruiters need an account to post jobs and find talent.', icon: '💼' },
    'hire': { title: 'Sign up to Hire', description: 'Create an account to hire service providers.', icon: '🤝' },
    'service-request': { title: 'Sign up to Request Services', description: 'Create an account to post service requests.', icon: '📋' },
    'connect': { title: 'Sign up to Connect', description: 'Create an account to connect with professionals.', icon: '🤝' },
    'schedule-interview': { title: 'Sign up to Schedule', description: 'Create an account to schedule interviews.', icon: '📅' },
  };

  const info = actionMessages[data.pendingAction || ''] || { title: 'Sign in Required', description: 'Create an account or sign in to continue.', icon: '✨' };

  return (
    <div className="p-6 text-center">
      <div className="text-4xl mb-4">{info.icon}</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{info.title}</h2>
      <p className="text-sm text-gray-500 mb-6">{info.description}</p>

      {data.requiredRole && (
        <div className={`mb-6 p-3 rounded-lg ${data.requiredRole === 'recruiter' ? 'bg-blue-50 border border-blue-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <p className={`text-sm font-medium ${data.requiredRole === 'recruiter' ? 'text-blue-800' : 'text-emerald-800'}`}>
            This action requires a <strong>{data.requiredRole}</strong> account
          </p>
        </div>
      )}

      <button
        onClick={() => { closeModal(); setTimeout(() => openModal('signup', data), 100); }}
        className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors mb-3"
      >
        Create Account
      </button>

      <button
        onClick={() => { closeModal(); setTimeout(() => openModal('login', data), 100); }}
        className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors mb-3"
      >
        Sign In
      </button>

      <p className="text-xs text-gray-400 mt-2">
        Or{' '}
        <button
          onClick={() => { closeModal(); navigate('/signup'); }}
          className="text-blue-700 font-medium hover:underline"
        >
          sign up on the full page
        </button>
      </p>
    </div>
  );
}

function LoginModal({ data, onClose }: { data: { pendingAction?: string; title?: string; company?: string; name?: string }; onClose?: () => void }) {
  const { signIn } = useAuth();
  const { closeModal, openModal } = useModal();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (!checkRateLimit('modal-signin', 5, 60000)) {
      setError('Too many attempts. Please wait a minute and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await signIn(email, password);
    setLoading(false);

    if (signInError) {
      const msg = signInError.message?.toLowerCase?.() || '';
      let displayMsg = signInError.message || 'Sign in failed';
      if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
        displayMsg = 'Please confirm your email first. Check your inbox for the confirmation link.';
      } else if (msg.includes('invalid login credentials')) {
        displayMsg = 'Invalid email or password. Please check and try again.';
      }
      setError(displayMsg);
      return;
    }

    // Sign in succeeded — handle pending action or close
    window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: 'Signed in successfully!', type: 'success' } }));
    closeModal();

    if (data.pendingAction === 'apply-job') {
      setTimeout(() => openModal('apply-job', data), 150);
    } else if (data.pendingAction === 'message') {
      setTimeout(() => openModal('message', data), 150);
    } else if (data.pendingAction === 'post-job') {
      setTimeout(() => openModal('post-job'), 150);
    } else if (data.pendingAction === 'hire') {
      setTimeout(() => openModal('hire', data), 150);
    } else if (data.pendingAction === 'service-request') {
      setTimeout(() => openModal('service-request'), 150);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-blue-700 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Welcome back</h2>
        <p className="text-sm text-gray-500 mt-1">Sign in to your JobBridge account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition"
              placeholder="Your password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
          ) : (
            <>Sign In <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </form>

      <div className="mt-5 text-center space-y-2">
        <p className="text-xs text-gray-500">
          Don't have an account?{' '}
          <button
            onClick={() => { closeModal(); setTimeout(() => openModal('signup', data), 100); }}
            className="text-blue-700 font-semibold hover:underline"
          >
            Sign up free
          </button>
        </p>
        <p className="text-xs text-gray-400">
          Or{' '}
          <button
            onClick={() => { closeModal(); navigate('/login'); }}
            className="text-blue-700 font-medium hover:underline"
          >
            open full sign-in page
          </button>
        </p>
      </div>
    </div>
  );
}
