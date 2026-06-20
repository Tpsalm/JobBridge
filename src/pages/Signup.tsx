import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { Briefcase, Wrench, ArrowRight, Check, Shield, Users, Building, Eye, EyeOff, X, CheckCircle, Mail, ArrowLeft, User, KeyRound, Lock } from 'lucide-react';
import JobBridgeLogo from '../components/JobBridgeLogo';

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminCodeError, setAdminCodeError] = useState('');
  const [adminCodeVerified, setAdminCodeVerified] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    serviceCategory: '',
    agreeToTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setStep('form');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      const { error } = await signUp(formData.email, formData.password, formData.name, selectedRole, formData.company);
      setLoading(false);
      if (error) {
        setError(error.message || 'Failed to create account');
        window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: error.message || 'Failed to create account', type: 'error' } }));
        return;
      }

      // Show success popup for recruiters and providers
      if (selectedRole === 'recruiter' || selectedRole === 'provider') {
        setShowSuccess(true);
        window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: 'Account created successfully!', type: 'success' } }));
      } else {
        navigate('/');
        window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: 'Account created!', type: 'success' } }));
      }
    })();
  };

  const handleSuccessContinue = () => {
    setShowSuccess(false);
    navigate('/verify-otp', { state: { email: formData.email, role: selectedRole } });
  };

  const handleBack = () => {
    setStep('role');
    setSelectedRole(null);
  };

  // Success Popup Modal
  if (showSuccess) {
    const isRecruiter = selectedRole === 'recruiter';
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Success Header */}
            <div className={`p-8 text-center ${isRecruiter ? 'bg-gradient-to-br from-blue-600 to-blue-800' : 'bg-gradient-to-br from-emerald-600 to-emerald-800'}`}>
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to JobBridge!</h2>
              <p className="text-white/80 text-sm">Your {isRecruiter ? 'Recruiter' : 'Service Provider'} account has been created successfully</p>
            </div>

            {/* Success Body */}
            <div className="p-8">
              {/* What happens next */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-4">What happens next?</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${isRecruiter ? 'bg-blue-600' : 'bg-emerald-600'}`}>1</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Verify your email</p>
                      <p className="text-xs text-gray-500">We've sent a verification code to <strong>{formData.email}</strong></p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${isRecruiter ? 'bg-blue-600' : 'bg-emerald-600'}`}>2</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Complete your profile</p>
                      <p className="text-xs text-gray-500">{isRecruiter ? 'Add your company details and start posting jobs' : 'Set up your service profile and showcase your skills'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${isRecruiter ? 'bg-blue-600' : 'bg-emerald-600'}`}>3</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Start {isRecruiter ? 'hiring top talent' : 'getting clients'}</p>
                      <p className="text-xs text-gray-500">{isRecruiter ? 'Access our AI-powered talent database' : 'Receive inquiries and grow your business'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleSuccessContinue}
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition flex items-center justify-center gap-2 ${isRecruiter ? 'bg-blue-700 hover:bg-blue-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}
              >
                <Mail className="w-5 h-5" />
                Verify Email & Continue
              </button>

              <p className="text-xs text-gray-400 text-center mt-4">
                Check your email inbox and spam folder for the verification code
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
        <img
          src="https://images.pexels.com/photos/3194519/pexels-photo-3194519.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&dpr=2"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-5"
        />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white mb-4 shadow-lg">
            <JobBridgeLogo variant="icon" iconSize={40} />
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome to JobBridge</h1>
          <p className="text-blue-200 mt-2">Connect. Hire. Grow. Nigeria's #1 Professional Network</p>
        </div>

        {step === 'role' ? (
          /* Role Selection */
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Choose how you want to join</h2>
            <p className="text-gray-500 text-center mb-8">Select your role to get started</p>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Recruiter */}
              <button
                onClick={() => handleRoleSelect('recruiter')}
                className="group relative p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Building className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">Sign up as Recruiter</h3>
                    <p className="text-sm text-gray-600 mt-1">Post jobs, find talent, and hire top candidates</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <ul className="space-y-2">
                    {['Post unlimited jobs', 'Access talent database', 'AI-powered matching', 'Schedule interviews'].map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-blue-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </button>

              {/* Service Provider */}
              <button
                onClick={() => handleRoleSelect('provider')}
                className="group relative p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Wrench className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">Sign up as Service Provider</h3>
                    <p className="text-sm text-gray-600 mt-1">Offer services, get clients, grow your business</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="mt-4 pt-4 border-t border-emerald-200">
                  <ul className="space-y-2">
                    {['Create service profile', 'Receive inquiries', 'Chat with clients', 'Get featured visibility'].map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-emerald-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            </div>

            <div className="mt-4">
              <button
                onClick={() => handleRoleSelect('job_seeker')}
                className="group relative w-full p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-2xl hover:border-purple-500 hover:shadow-lg transition-all text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">Join as Job Seeker</h3>
                  </div>
                  <ArrowRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <button onClick={() => navigate('/login')} className="font-semibold text-blue-700 hover:text-blue-800">
                  Sign in
                </button>
              </p>
              <button
                onClick={() => setShowAdminGate(!showAdminGate)}
                className="mt-3 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 mx-auto"
              >
                <Lock className="w-3 h-3" /> Admin access
              </button>
              {showAdminGate && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {adminCodeVerified ? (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-emerald-700 mb-2">Admin code verified</p>
                      <button
                        onClick={() => handleRoleSelect('admin')}
                        className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                      >
                        <Shield className="w-4 h-4" /> Sign up as Admin
                      </button>
                      <button
                        onClick={() => { setAdminCodeVerified(false); setAdminCode(''); }}
                        className="mt-2 text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={adminCode}
                        onChange={e => { setAdminCode(e.target.value); setAdminCodeError(''); }}
                        placeholder="Enter admin secret code"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-500"
                      />
                      <button
                        onClick={async () => {
                          if (!adminCode.trim()) return;
                          try {
                            const resp = await fetch('/admin/check-secret', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ code: adminCode }),
                            });
                            const data = await resp.json();
                            if (data.valid) {
                              setAdminCodeVerified(true);
                            } else {
                              setAdminCodeError('Invalid admin code');
                            }
                          } catch {
                            setAdminCodeError('Could not verify code');
                          }
                        }}
                        className="px-3 py-1.5 bg-gray-900 text-white rounded text-xs font-medium hover:bg-gray-800 transition-colors"
                      >
                        Verify
                      </button>
                    </div>
                  )}
                  {adminCodeError && (
                    <p className="text-xs text-red-500 mt-1">{adminCodeError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Signup Form */
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10">
            <button onClick={handleBack} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
              ← Back to role selection
            </button>

              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedRole === 'recruiter' ? 'bg-blue-600' : selectedRole === 'provider' ? 'bg-emerald-600' : selectedRole === 'admin' ? 'bg-gray-900' : 'bg-purple-600'
                }`}>
                  {selectedRole === 'recruiter' ? (
                    <Building className="w-5 h-5 text-white" />
                  ) : selectedRole === 'provider' ? (
                    <Wrench className="w-5 h-5 text-white" />
                  ) : selectedRole === 'admin' ? (
                    <Shield className="w-5 h-5 text-white" />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedRole === 'recruiter' ? 'Create Recruiter Account' : selectedRole === 'provider' ? 'Create Service Provider Account' : selectedRole === 'admin' ? 'Create Admin Account' : 'Create Job Seeker Account'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedRole === 'admin' ? 'JobBridge platform administrator' : 'Fill in your details to get started'}
                  </p>
                </div>
              </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Minimum 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formData.password.length > 0 && formData.password.length < 6 && (
                  <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>
                )}
              </div>

              {selectedRole === 'recruiter' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name (Optional)</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Your company name"
                  />
                </div>
              )}

              {selectedRole === 'provider' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Category *</label>
                  <select
                    required
                    value={formData.serviceCategory}
                    onChange={(e) => setFormData({ ...formData, serviceCategory: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  >
                    <option value="">Select your service category</option>
                    <option value="design">Graphic Design</option>
                    <option value="development">Web Development</option>
                    <option value="writing">Content Writing</option>
                    <option value="marketing">Digital Marketing</option>
                    <option value="photography">Photography</option>
                    <option value="consulting">Business Consulting</option>
                    <option value="finance">Financial Services</option>
                    <option value="legal">Legal Services</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical Work</option>
                    <option value="tutoring">Tutoring</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={formData.agreeToTerms}
                  onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                  className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="terms" className="text-sm text-gray-600">
                  I agree to the{' '}
                  <button type="button" className="text-blue-700 hover:underline">
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button type="button" className="text-blue-700 hover:underline">
                    Privacy Policy
                  </button>
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!formData.agreeToTerms || loading || formData.password.length < 6}
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition flex items-center justify-center gap-2 ${
                  formData.agreeToTerms && formData.password.length >= 6
                    ? selectedRole === 'recruiter'
                      ? 'bg-blue-700 hover:bg-blue-800'
                      : selectedRole === 'provider'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : selectedRole === 'admin'
                      ? 'bg-gray-900 hover:bg-gray-800'
                      : 'bg-purple-700 hover:bg-purple-800'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>

              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Shield className="w-5 h-5 text-gray-400" />
                <span>Your information is secure and encrypted</span>
              </div>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{' '}
              <button onClick={() => navigate('/login')} className="font-semibold text-blue-700 hover:text-blue-800">
                Sign in
              </button>
            </p>
          </div>
        )}

        <p className="text-center text-blue-300 text-xs mt-6">
          By continuing, you agree to JobBridge's Terms of Service and acknowledge our Privacy Policy.
        </p>
      </div>
    </div>
  );
}
