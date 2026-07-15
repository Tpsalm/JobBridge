import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToasts } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";
import { fetchUnreadNotificationCount } from "../lib/supabaseQueries";
import {
  Bell,
  Menu,
  X,
  Briefcase,
  Home,
  Users,
  Wrench,
  BarChart3,
  CreditCard,
  ChevronDown,
  Bookmark,
  MessageSquare,
  UserCircle,
  Settings,
  HelpCircle,
  Shield,
  LogOut,
} from "lucide-react";
import JobBridgeLogo from "./JobBridgeLogo";
import HeroSlides from './HeroSlides';

const navLinks = [
  { label: "Home", path: "/", icon: Home },
  { label: "Jobs", path: "/jobs", icon: Briefcase },
  { label: "Providers", path: "/providers", icon: Users },
  { label: "Business", path: "/business", icon: BarChart3 },
  { label: "Pricing", path: "/pricing", icon: Wrench },
  { label: "Payment", path: "/payment", icon: CreditCard },
];

const moreLinks = [
  { label: "Recruiter", path: "/recruiter" },
  { label: "AI Resume Studio", path: "/ai-resume" },
  { label: "Support", path: "/support" },
  { label: "Blog", path: "/blog" },
  { label: "About", path: "/about" },
  { label: "Career", path: "/career" },
  { label: "Games", path: "/games" },
  { label: "CEO Vision", path: "/ceo" },
];

export default function Header() {
  const { user, profile, isAuthenticated, savedJobs, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const { push } = useToasts();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) {
      setNotifCount(0);
      return;
    }

    let active = true;

    const refreshCount = async () => {
      try {
        const count = await fetchUnreadNotificationCount(user.id);
        if (active) setNotifCount(count);
      } catch {
        if (active) setNotifCount(0);
      }
    };

    refreshCount();

    const channel = supabase
      .channel(`header-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as unknown as {
            title: string;
            content?: string;
          };
          refreshCount();
          if (next?.title) {
            push({
              message: `${next.title}${next.content ? ` — ${next.content}` : ""}`,
              type: "info",
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshCount();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshCount();
        },
      )
      .subscribe();

    const onFocus = () => {
      refreshCount();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setProfileOpen(false);
    await signOut();
  };

  const displayName = profile?.full_name || user?.email || "User";
  const displayEmail = user?.email || profile?.email || "";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const profileMenuItems = [
    { label: "My Profile", path: "/profile", icon: UserCircle },
    { label: "My Jobs", path: "/my-jobs", icon: Bookmark },
    { label: "Account Settings", path: "/profile", icon: Settings },
    { label: "Help", path: "/support", icon: HelpCircle },
    { label: "Privacy Center", path: "/privacy", icon: Shield },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <JobBridgeLogo variant="horizontal" iconSize={32} />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ label, path }) => (
              <Link
                key={path}
                to={path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(path)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {label}
              </Link>
            ))}

            {/* More Dropdown */}
            <div className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                More{" "}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                />
              </button>
              {moreOpen && (
                <div
                  className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50"
                  onMouseLeave={() => setMoreOpen(false)}
                >
                  {moreLinks.map(({ label, path }) => (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setMoreOpen(false)}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        isActive(path)
                          ? "text-blue-700 bg-blue-50"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1">
            {/* Saved Jobs */}
            <Link
              to="/my-jobs"
              className={`relative p-2 rounded-lg transition-colors ${
                isActive("/my-jobs")
                  ? "text-blue-700 bg-blue-50"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
              aria-label="Saved jobs"
              title="My Jobs"
            >
              <Bookmark className="w-5 h-5" />
              {savedJobs.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {savedJobs.length}
                </span>
              )}
            </Link>

            {/* Messages */}
            <Link
              to="/messages"
              className={`p-2 rounded-lg transition-colors ${
                isActive("/messages")
                  ? "text-blue-700 bg-blue-50"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
              aria-label="Messages"
              title="Messages"
            >
              <MessageSquare className="w-5 h-5" />
            </Link>

            {/* Notifications */}
            <Link
              to="/notifications"
              className={`relative p-2 rounded-lg transition-colors ${
                isActive("/notifications")
                  ? "text-blue-700 bg-blue-50"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow">
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </Link>

            {/* Profile Dropdown or Login */}
            {isAuthenticated ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-50 transition-colors ml-1"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                      {initials || "U"}
                    </div>
                  )}
                  <ChevronDown
                    className={`w-3 h-3 text-gray-500 transition-transform hidden sm:block ${profileOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {profileOpen && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {displayName}
                      </p>
                      {displayEmail && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {displayEmail}
                        </p>
                      )}
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      {profileMenuItems.map(({ label, path, icon: Icon }) => (
                        <Link
                          key={label}
                          to={path}
                          onClick={() => setProfileOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            isActive(path) && label !== "Profile"
                              ? "text-blue-700 bg-blue-50"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <Icon className="w-4 h-4 text-gray-500" />
                          {label}
                        </Link>
                      ))}
                    </div>

                    {/* Sign out */}
                    <div className="border-t border-gray-100 py-1">
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="hidden sm:inline-flex px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            {[...navLinks, ...moreLinks].map(({ label, path }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(path)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {label}
              </Link>
            ))}

            {/* Mobile: My Jobs, Messages, Notifications */}
            <div className="pt-2 border-t border-gray-100 mt-2 space-y-1">
              <Link
                to="/my-jobs"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <Bookmark className="w-4 h-4" /> My Jobs
              </Link>
              <Link
                to="/messages"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <MessageSquare className="w-4 h-4" /> Messages
              </Link>
              <Link
                to="/notifications"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <Bell className="w-4 h-4" /> Notifications
              </Link>
            </div>

            {/* Mobile: Profile or Login */}
            <div className="pt-2 border-t border-gray-100 mt-2">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                        {initials || "U"}
                      </div>
                    )}
                    {displayName}
                  </Link>
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleSignOut();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 pt-1">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Hero Slides shown below header on all pages */}
      <div className="w-full">
        <HeroSlides />
      </div>
    </header>
  );
}
