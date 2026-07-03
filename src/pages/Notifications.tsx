import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import {
  Bell,
  Briefcase,
  MessageSquare,
  Calendar,
  Star,
  Shield,
  CreditCard,
  Check,
  CheckCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Settings,
  Search,
  X,
  Flame,
} from "lucide-react";
import PageHero from "../components/PageHero";
import { HERO_CAROUSELS } from "../lib/media";

type NotifType =
  | "job_application"
  | "message"
  | "interview"
  | "review"
  | "system"
  | "payment"
  | "advert";

interface NotifItem {
  id: string;
  type: NotifType;
  title: string;
  content: string;
  time: string;
  isRead: boolean;
}

interface JobAlert {
  id: string;
  query: string;
  location: string;
  count: number;
  enabled: boolean;
}

const INITIAL_ALERTS: JobAlert[] = [
  {
    id: "a1",
    query: "Frontend Developer",
    location: "Lagos",
    count: 42,
    enabled: true,
  },
  {
    id: "a2",
    query: "Product Manager",
    location: "Remote",
    count: 18,
    enabled: false,
  },
  {
    id: "a3",
    query: "Software Engineer",
    location: "Abuja",
    count: 98,
    enabled: true,
  },
];

const INITIAL_NOTIFICATIONS: NotifItem[] = [
  {
    id: "n1",
    type: "job_application",
    title: "Application received",
    content:
      "Flutterwave has received your application for Senior Frontend Engineer.",
    time: "2 hours ago",
    isRead: false,
  },
  {
    id: "n2",
    type: "interview",
    title: "Interview scheduled",
    content:
      "Your interview with Paystack is scheduled for Thursday, 20 Jun at 2:00 PM.",
    time: "5 hours ago",
    isRead: false,
  },
  {
    id: "n3",
    type: "message",
    title: "New message from Andela",
    content:
      "We would like to discuss your application further. Please check your messages.",
    time: "1 day ago",
    isRead: false,
  },
  {
    id: "n4",
    type: "system",
    title: "Profile complete!",
    content:
      "Your profile is now 100% complete. Recruiters can find you more easily.",
    time: "2 days ago",
    isRead: true,
  },
  {
    id: "n5",
    type: "review",
    title: "New review on your profile",
    content:
      "A client has left a 5-star review on your service provider profile.",
    time: "3 days ago",
    isRead: true,
  },
  {
    id: "n6",
    type: "payment",
    title: "Payment confirmed",
    content:
      "Your payment of ₦15,000 for the Featured plan has been confirmed.",
    time: "5 days ago",
    isRead: true,
  },
  {
    id: "n7",
    type: "job_application",
    title: "Application shortlisted",
    content:
      "Congratulations! MTN Nigeria has shortlisted your application for Product Manager.",
    time: "1 week ago",
    isRead: true,
  },
  {
    id: "n8",
    type: "system",
    title: "Welcome to JobBridge!",
    content:
      "Start exploring jobs and building your career. Complete your profile to get started.",
    time: "2 weeks ago",
    isRead: true,
  },
];

const typeConfig: Record<
  NotifType,
  { icon: typeof Bell; color: string; bg: string }
> = {
  job_application: {
    icon: Briefcase,
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  message: {
    icon: MessageSquare,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
  },
  interview: { icon: Calendar, color: "text-purple-600", bg: "bg-purple-100" },
  review: { icon: Star, color: "text-yellow-600", bg: "bg-yellow-100" },
  system: { icon: Shield, color: "text-gray-600", bg: "bg-gray-100" },
  payment: { icon: CreditCard, color: "text-green-600", bg: "bg-green-100" },
  advert: { icon: Bell, color: "text-orange-600", bg: "bg-orange-100" },
};

function isStreakNotif(notif: NotifItem) {
  return notif.id.startsWith("streak-") || notif.title.includes("Streak");
}

function loadLocalNotifs(): NotifItem[] {
  try {
    const raw = localStorage.getItem("jobbridge_notifications");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalNotifs(items: NotifItem[]) {
  localStorage.setItem("jobbridge_notifications", JSON.stringify(items));
  window.dispatchEvent(new Event("storage"));
}

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState<JobAlert[]>(INITIAL_ALERTS);
  const [notifications, setNotifications] = useState<NotifItem[]>(() => {
    const local = loadLocalNotifs();
    const merged = [...local];
    for (const init of INITIAL_NOTIFICATIONS) {
      if (!merged.find((n) => n.id === init.id)) merged.push(init);
    }
    return merged;
  });
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const toggleAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    );
  };

  const markRead = (id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      saveLocalNotifs(next);
      return next;
    });
  };

  const markAllRead = () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, isRead: true }));
      saveLocalNotifs(next);
      return next;
    });
  };

  const deleteNotif = (id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      saveLocalNotifs(next);
      return next;
    });
  };

  const displayed = notifications
    .filter((n) => filter === "all" || !n.isRead)
    .filter(
      (n) =>
        !searchTerm ||
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.content.toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <AppLayout>
      <PageHero
        compact
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
            : "Stay updated on your job search"
        }
        images={HERO_CAROUSELS.notifications}
        imageAlt="Person checking notifications"
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {unreadCount > 0 && (
          <div className="flex justify-end mb-6">
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          </div>
        )}

        {/* Job Alerts Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Job Alerts
            </h2>
            <Link
              to="/profile"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" /> Edit profile preferences
            </Link>
          </div>

          {alerts.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-700 mb-1">
                Nothing right now. Check back later!
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Get updates from your recent searches
              </p>
              <Link
                to="/jobs"
                className="text-blue-600 text-sm font-medium hover:underline"
              >
                Find jobs →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Search className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        <span className="font-semibold">{alert.count}</span> new
                        jobs for "{alert.query}" near {alert.location}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        You'll receive email updates when new jobs become
                        available.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className="shrink-0"
                    title={alert.enabled ? "Disable alert" : "Enable alert"}
                  >
                    {alert.enabled ? (
                      <ToggleRight className="w-8 h-8 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-400" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            All Notifications
          </h2>

          {/* Filter & Search */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === "all"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === "unread"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Unread {unreadCount > 0 && `(${unreadCount})`}
              </button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          {!isAuthenticated ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-500 mb-3">
                Sign in to see your notifications
              </p>
              <Link
                to="/login"
                className="text-blue-600 text-sm font-medium hover:underline"
              >
                Sign in
              </Link>
            </div>
          ) : displayed.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No notifications to show</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map((notif) => {
                const cfg = typeConfig[notif.type];
                const Icon = cfg.icon;
                return (
                  <div
                    key={notif.id}
                    className={`rounded-xl border p-4 transition-all hover:shadow-sm cursor-pointer ${
                      notif.isRead
                        ? "bg-white border-gray-100"
                        : "bg-blue-50/40 border-blue-100"
                    }`}
                    onClick={() => markRead(notif.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg ${isStreakNotif(notif) ? "bg-gradient-to-br from-amber-500 to-orange-600" : cfg.bg} flex items-center justify-center shrink-0`}
                      >
                        {isStreakNotif(notif) ? (
                          <Flame className="w-4.5 h-4.5 text-white" />
                        ) : (
                          <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p
                              className={`text-sm ${notif.isRead ? "font-medium text-gray-700" : "font-semibold text-gray-900"}`}
                            >
                              {notif.title}
                            </p>
                            <p
                              className={`text-sm mt-0.5 ${notif.isRead ? "text-gray-500" : "text-gray-700"}`}
                            >
                              {notif.content}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!notif.isRead && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotif(notif.id);
                              }}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">
                          {notif.time}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              By creating a job alert, you agree to our{" "}
              <Link to="/about" className="text-blue-600 hover:underline">
                Terms
              </Link>
              . You can change your consent settings at any time by
              unsubscribing.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
