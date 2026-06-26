import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ModalProvider } from './contexts/ModalContext';
import { ModalRenderer } from './components/Modal';
const AIAssistantWidget = lazy(() => import('./components/AIAssistantWidget'));
import Watermark from './components/Watermark';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Home from './pages/Home';
import Recruiter from './pages/Recruiter';
import Jobs from './pages/Jobs';
import Support from './pages/Support';
import Contact from './pages/Contact';
import About from './pages/About';
import Analytics from './pages/Analytics';
import Games from './pages/Games';
import Providers from './pages/Providers';
import Settings from './pages/Settings';
import Blog from './pages/Blog';
import BlogDetail from './pages/BlogDetail';
import CEO from './pages/CEO';
import Business from './pages/Business';
import Pricing from './pages/Pricing';
import Payment from './pages/Payment';
import MyJobs from './pages/MyJobs';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import AIResume from './pages/AIResume';
import Admin from './pages/Admin';
import AdminRoute from './components/AdminRoute';
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModalProvider>
          <Routes>
            {/* Auth pages */}
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />

            {/* Public pages - accessible without login */}
            <Route path="/" element={<Home />} />
            <Route path="/recruiter" element={<Recruiter />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/support" element={<Support />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/games" element={<Games />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:id" element={<BlogDetail />} />
            <Route path="/ceo" element={<CEO />} />
            <Route path="/business" element={<Business />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/my-jobs" element={<MyJobs />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/ai-resume" element={<AIResume />} />
            <Route path="/revenue" element={<Pricing />} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<Home />} />
          </Routes>
          <ModalRenderer />
          <Suspense fallback={null}>
            <AIAssistantWidget />
          </Suspense>
          <Watermark />
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
