import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { Suspense } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ModalProvider } from "./contexts/ModalContext";
import { ModalRenderer } from "./components/Modal";
import SwipeNavigator from "./components/SwipeNavigator";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Home from "./pages/Home";
import Recruiter from "./pages/Recruiter";
import Jobs from "./pages/Jobs";
import Support from "./pages/Support";
import Contact from "./pages/Contact";
import About from "./pages/About";
import Analytics from "./pages/Analytics";
import Games from "./pages/Games";
import Providers from "./pages/Providers";
import Profile from "./pages/Profile";
import Blog from "./pages/Blog";
import BlogDetail from "./pages/BlogDetail";
import CEO from "./pages/CEO";
import Privacy from "./pages/Privacy";
import Business from "./pages/Business";
import Pricing from "./pages/Pricing";
import Payment from "./pages/Payment";
import MyJobs from "./pages/MyJobs";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import AIResume from "./pages/AIResume";
import EmailLogsAdmin from "./pages/EmailLogsAdmin";
import Career from "./pages/Career";
import Following from "./pages/Following";
import Reviews from "./pages/Reviews";
import ProfileVisibility from "./pages/ProfileVisibility";
import JobPreferences from "./pages/JobPreferences";
import ProtectedRoute from "./components/ProtectedRoute";
const AIAssistantWidget = React.lazy(() => import("./components/AIAssistantWidget"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModalProvider>
          <SwipeNavigator />
          <Routes>
            {/* Auth pages */}
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Public pages - accessible without login */}
            <Route path="/" element={<Home />} />
            <Route path="/recruiter" element={<Recruiter />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/support" element={<Support />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/games" element={<Games />} />
            <Route path="/career" element={<Career />} />
            <Route path="/privacy" element={<Privacy />} />
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
            <Route
              path="/admin/email-logs"
              element={
                <ProtectedRoute>
                  <EmailLogsAdmin />
                </ProtectedRoute>
              }
            />
            <Route path="/profile-visibility" element={<ProfileVisibility />} />
            <Route path="/job-preferences" element={<JobPreferences />} />
            <Route path="/following" element={<Following />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/revenue" element={<Pricing />} />
            <Route
              path="/settings"
              element={<Navigate to="/profile" replace />}
            />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Home />} />
          </Routes>
          <Suspense fallback={null}>
            <AIAssistantWidget />
          </Suspense>
          <ModalRenderer />
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
