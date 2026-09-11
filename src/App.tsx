import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { Suspense, lazy } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ModalProvider } from "./contexts/ModalContext";
import { ModalRenderer } from "./components/Modal";
import SwipeNavigator from "./components/SwipeNavigator";
import ProtectedRoute from "./components/ProtectedRoute";

// Eagerly loaded core entry pages for instant landing speed
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

// Lazy-loaded pages for high runtime performance and light initial bundle
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Recruiter = lazy(() => import("./pages/Recruiter"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Support = lazy(() => import("./pages/Support"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Games = lazy(() => import("./pages/Games"));
const Providers = lazy(() => import("./pages/Providers"));
const Profile = lazy(() => import("./pages/Profile"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogDetail = lazy(() => import("./pages/BlogDetail"));
const CEO = lazy(() => import("./pages/CEO"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Business = lazy(() => import("./pages/Business"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Payment = lazy(() => import("./pages/Payment"));
const MyJobs = lazy(() => import("./pages/MyJobs"));
const Messages = lazy(() => import("./pages/Messages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AIResume = lazy(() => import("./pages/AIResume"));
const EmailLogsAdmin = lazy(() => import("./pages/EmailLogsAdmin"));
const Career = lazy(() => import("./pages/Career"));
const Following = lazy(() => import("./pages/Following"));
const Reviews = lazy(() => import("./pages/Reviews"));
const ProfileVisibility = lazy(() => import("./pages/ProfileVisibility"));
const JobPreferences = lazy(() => import("./pages/JobPreferences"));
const AIAssistantWidget = lazy(() => import("./components/AIAssistantWidget"));

function PageLoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-gray-500">Loading JobBridge...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModalProvider>
          <SwipeNavigator />
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              {/* Auth pages */}
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Public pages */}
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
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
          <Suspense fallback={null}>
            <AIAssistantWidget />
          </Suspense>
          <ModalRenderer />
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
