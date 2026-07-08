import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import { Notification, supabase } from "../lib/supabase";
import {
  deleteNotification as deleteNotificationRecord,
  fetchJobAlertsWithCounts,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type JobAlertSeed,
  type JobAlertWithCount,
  updateJobAlertEnabled,
} from "../lib/supabaseQueries";
import {
  Bell,
  Briefcase,
  MessageSquare,
  Calendar,
  Star,
  Shield,
  CreditCard,
  CheckCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Settings,
  Search,
  X,
} from "lucide-react";
import PageHero from "../components/PageHero";
import { HERO_CAROUSELS } from "../lib/media";

type NotifType = Notification["type"];

const DEFAULT_JOB_ALERTS: JobAlertSeed[] = [
  {
    query: "Frontend Developer",
    location: "Lagos",
    enabled: true,
  },
  {
    query: "Product Manager",
    location: "Remote",
    enabled: false,
  },
  {
    query: "Software Engineer",
    location: "Abuja",
    enabled: true,
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

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60)
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}

export default function Notifications() {
  const { user, isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState<JobAlertWithCount[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [alertsError, setAlertsError] = useState("");

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      setPageError("");
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      setPageError("");
      try {
        const items = await fetchNotifications(user.id);
        if (active) setNotifications(items as Notification[]);
      } catch (error) {
        console.error("[Notifications] Failed to load notifications:", error);
        if (active) setPageError("Could not load notifications right now.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    const channel = supabase
      .channel(`notifications-page:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as Notification;
          setNotifications((prev) => {
            if (prev.some((item) => item.id === next.id)) return prev;
            return [next, ...prev];
          });
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
        (payload) => {
          const next = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((item) => (item.id === next.id ? next : item)),
          );
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
        (payload) => {
          const removed = payload.old as Notification;
          setNotifications((prev) =>
            prev.filter((item) => item.id !== removed.id),
          );
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setAlerts([]);
      setAlertsLoading(false);
      setAlertsError("");
      return;
    }

    let active = true;

    const loadAlerts = async () => {
      setAlertsLoading(true);
      setAlertsError("");
      try {
        const items = await fetchJobAlertsWithCounts(
          user.id,
          DEFAULT_JOB_ALERTS,
        );
        if (active) setAlerts(items);
      } catch (error) {
        console.error("[Notifications] Failed to load job alerts:", error);
        if (active) setAlertsError("Could not load job alerts right now.");
      } finally {
        if (active) setAlertsLoading(false);
      }
    };

    loadAlerts();

    const channel = supabase
      .channel(`job-alerts:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_alerts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadAlerts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_alerts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadAlerts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "job_alerts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadAlerts();
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  const displayed = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return notifications
      .filter((n) => filter === "all" || !n.is_read)
      .filter((n) => {
        if (!normalizedSearch) return true;
        return (
          n.title.toLowerCase().includes(normalizedSearch) ||
          (n.content || "").toLowerCase().includes(normalizedSearch)
        );
      });
  }, [notifications, filter, searchTerm]);

  const toggleAlert = async (id: string) => {
    const current = alerts.find((item) => item.id === id);
    if (!current) return;

    const nextEnabled = !current.enabled;

    setAlerts((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, enabled: nextEnabled } : item,
      ),
    );

    try {
      await updateJobAlertEnabled(id, nextEnabled);
    } catch (error) {
      console.error("[Notifications] Failed to update job alert:", error);
      setAlerts((prev) =>
        prev.map((item) => (item.id === id ? current : item)),
      );
      setAlertsError("We could not update that alert. Please try again.");
    }
  };

  const handleMarkRead = async (id: string) => {
    const current = notifications.find((item) => item.id === id);
    if (!current || current.is_read) return;

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, is_read: true, read_at: new Date().toISOString() }
          : item,
      ),
    );

    try {
      await markNotificationRead(id);
    } catch (error) {
      console.error(
        "[Notifications] Failed to mark notification as read:",
        error,
      );
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? current : item)),
      );
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id || unreadCount === 0) return;

    const previous = notifications;
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at || readAt,
      })),
    );

    try {
      await markAllNotificationsRead(user.id);
    } catch (error) {
      console.error("[Notifications] Failed to mark all as read:", error);
      setNotifications(previous);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    try {
      await deleteNotificationRecord(id);
    } catch (error) {
      console.error("[Notifications] Failed to delete notification:", error);
      setNotifications(previous);
    }
  };

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
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          </div>
        )}

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

          {!isAuthenticated ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-700 mb-1">
                Sign in to manage job alerts
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Save searches and get notified when matching jobs are posted.
              </p>
              <Link
                to="/login"
                className="text-blue-600 text-sm font-medium hover:underline"
              >
                Sign in
              </Link>
            </div>
          ) : alertsLoading ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-500">Loading job alerts...</p>
            </div>
          ) : alertsError ? (
            <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center text-sm text-red-700">
              {alertsError}
            </div>
          ) : alerts.length === 0 ? (
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
                        job{alert.count === 1 ? "" : "s"} for "{alert.query}"
                        {alert.location ? ` near ${alert.location}` : ""}
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

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            All Notifications
          </h2>

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
          ) : loading ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-500">Loading notifications...</p>
            </div>
          ) : pageError ? (
            <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center text-sm text-red-700">
              {pageError}
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
                      notif.is_read
                        ? "bg-white border-gray-100"
                        : "bg-blue-50/40 border-blue-100"
                    }`}
                    onClick={() => handleMarkRead(notif.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}
                      >
                        <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p
                              className={`text-sm ${notif.is_read ? "font-medium text-gray-700" : "font-semibold text-gray-900"}`}
                            >
                              {notif.title}
                            </p>
                            <p
                              className={`text-sm mt-0.5 ${notif.is_read ? "text-gray-500" : "text-gray-700"}`}
                            >
                              {notif.content || "No additional details"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!notif.is_read && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(notif.id);
                              }}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">
                          {formatRelativeTime(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
