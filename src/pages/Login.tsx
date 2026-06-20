import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, Mail, ArrowRight } from 'lucide-react';
import JobBridgeLogo from '../components/JobBridgeLogo';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const { error } = await signIn(email, password);
    if (error) {
      window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: error.message || 'Sign in failed', type: 'error' } }));
      return;
    }
    window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: 'Signed in', type: 'success' } }));
    navigate('/');
  };

  const handleDemoLogin = (role: 'recruiter' | 'provider') => {
    (async () => {
      const demoEmail = role === 'recruiter' ? 'recruiter@demo.com' : 'provider@demo.com';
      const demoPassword = 'demo1234';
      let r = await signIn(demoEmail, demoPassword);
      if (r.error) {
        // create demo user then sign in
        await signUp(demoEmail, demoPassword, role === 'recruiter' ? 'Demo Recruiter' : 'Demo Provider', role);
        r = await signIn(demoEmail, demoPassword);
      }
      if (r.error) {
        window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: r.error.message || 'Demo sign-in failed', type: 'error' } }));
        return;
      }
      window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message: 'Signed in (demo)', type: 'success' } }));
      navigate('/');
    })();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
        <img
          src="https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&dpr=2"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-5"
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white mb-4 shadow-lg">
            <JobBridgeLogo variant="icon" iconSize={40} />
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome back</h1>
          <p className="text-blue-200 mt-2">Sign in to your JobBridge account</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-800 transition"
            >
              Sign In <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with demo</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDemoLogin('recruiter')}
              className="flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition text-sm font-medium text-gray-700"
            >
              <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">R</span>
              Recruiter Demo
            </button>
            <button
              onClick={() => handleDemoLogin('provider')}
              className="flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition text-sm font-medium text-gray-700"
            >
              <span className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">P</span>
              Provider Demo
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-blue-700 hover:text-blue-800">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
