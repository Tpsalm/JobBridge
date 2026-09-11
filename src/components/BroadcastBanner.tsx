import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Megaphone,
  AlertTriangle,
  Sparkles,
  CheckCircle,
  Wrench,
  X,
  ArrowRight,
  Radio,
} from "lucide-react";

export interface BroadcastData {
  id: string;
  title: string;
  content: string;
  broadcast_type?: "announcement" | "urgent" | "promo" | "success" | "maintenance";
  action_url?: string;
  action_label?: string;
  display_format?: "banner" | "modal";
  created_at?: string;
}

const STORAGE_KEY = "jb_dismissed_broadcasts";

export default function BroadcastBanner() {
  const [broadcast, setBroadcast] = useState<BroadcastData | null>(null);
  const [visible, setVisible] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  const isDismissed = useCallback((id: string): boolean => {
    try {
      const dismissed: string[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );
      return dismissed.includes(id);
    } catch {
      return false;
    }
  }, []);

  const markDismissed = (id: string) => {
    try {
      const dismissed: string[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );
      if (!dismissed.includes(id)) {
        dismissed.push(id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed.slice(-50)));
      }
    } catch (e) {
      console.warn("Could not save dismissed broadcast state:", e);
    }
    setVisible(false);
    setIsModalOpen(false);
  };

  const handleNewBroadcast = useCallback((data: BroadcastData) => {
    if (!data || !data.id || isDismissed(data.id)) return;
    setBroadcast(data);
    setVisible(true);
    if (data.display_format === "modal") {
      setIsModalOpen(true);
    }
  }, [isDismissed]);

  // 1) Fetch active broadcast on initial mount
  useEffect(() => {
    let isMounted = true;

    async function loadActiveBroadcast() {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("id, title, content, data, created_at")
          .order("created_at", { ascending: false })
          .limit(20);

        if (error || !data) return;

        // Find the most recent global broadcast
        const latestGlobal = data.find((n) => {
          const d = n.data as Record<string, unknown> | null;
          return (
            d?.is_global_broadcast === true ||
            d?.audience === "broadcast" ||
            d?.source === "admin_console"
          );
        });

        if (latestGlobal && isMounted) {
          const d = (latestGlobal.data || {}) as Record<string, unknown>;
          const broadcastItem: BroadcastData = {
            id: latestGlobal.id,
            title: latestGlobal.title || "Announcement",
            content: latestGlobal.content || "",
            broadcast_type: (d.broadcast_type as BroadcastData["broadcast_type"]) || "announcement",
            action_url: typeof d.action_url === "string" ? d.action_url : undefined,
            action_label: typeof d.action_label === "string" ? d.action_label : undefined,
            display_format: (d.display_format as "banner" | "modal") || "banner",
            created_at: latestGlobal.created_at,
          };

          handleNewBroadcast(broadcastItem);
        }
      } catch (err) {
        console.warn("Failed to check active broadcast:", err);
      }
    }

    loadActiveBroadcast();

    // 2) Subscribe to Supabase Realtime for INSTANT broadcast reflection
    const channel = supabase
      .channel("jobbridge_broadcasts")
      .on("broadcast", { event: "instant_announcement" }, (payload) => {
        if (payload?.payload && isMounted) {
          handleNewBroadcast(payload.payload as BroadcastData);
        }
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            title: string;
            content: string;
            data: Record<string, unknown>;
            created_at: string;
          };
          if (
            row?.data?.is_global_broadcast === true ||
            row?.data?.audience === "broadcast" ||
            row?.data?.source === "admin_console"
          ) {
            handleNewBroadcast({
              id: row.id,
              title: row.title,
              content: row.content,
              broadcast_type: (row.data.broadcast_type as BroadcastData["broadcast_type"]) || "announcement",
              action_url: row.data.action_url as string,
              action_label: row.data.action_label as string,
              display_format: (row.data.display_format as "banner" | "modal") || "banner",
              created_at: row.created_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [handleNewBroadcast]);

  if (!visible || !broadcast) return null;

  const type = broadcast.broadcast_type || "announcement";

  const typeStyles = {
    urgent: {
      bg: "bg-gradient-to-r from-red-600 via-rose-600 to-red-700",
      border: "border-red-500",
      text: "text-white",
      badge: "bg-white/20 text-white",
      icon: AlertTriangle,
    },
    announcement: {
      bg: "bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800",
      border: "border-blue-500",
      text: "text-white",
      badge: "bg-white/20 text-white",
      icon: Megaphone,
    },
    promo: {
      bg: "bg-gradient-to-r from-purple-700 via-fuchsia-600 to-pink-600",
      border: "border-purple-500",
      text: "text-white",
      badge: "bg-white/20 text-white",
      icon: Sparkles,
    },
    success: {
      bg: "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700",
      border: "border-emerald-500",
      text: "text-white",
      badge: "bg-white/20 text-white",
      icon: CheckCircle,
    },
    maintenance: {
      bg: "bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-600",
      border: "border-amber-500",
      text: "text-white",
      badge: "bg-white/20 text-white",
      icon: Wrench,
    },
  }[type] || {
    bg: "bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800",
    border: "border-blue-500",
    text: "text-white",
    badge: "bg-white/20 text-white",
    icon: Megaphone,
  };

  const Icon = typeStyles.icon;

  const handleActionClick = () => {
    if (!broadcast.action_url) return;
    if (broadcast.action_url.startsWith("http")) {
      window.open(broadcast.action_url, "_blank", "noopener,noreferrer");
    } else {
      navigate(broadcast.action_url);
    }
    markDismissed(broadcast.id);
  };

  // Modal view if requested by Super Admin
  if (isModalOpen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 overflow-hidden relative animate-scale-up">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                type === "urgent"
                  ? "bg-red-100 text-red-600"
                  : type === "promo"
                  ? "bg-purple-100 text-purple-600"
                  : type === "success"
                  ? "bg-emerald-100 text-emerald-600"
                  : type === "maintenance"
                  ? "bg-amber-100 text-amber-600"
                  : "bg-blue-100 text-blue-600"
              }`}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  {type}
                </span>
                <span className="text-[10px] text-gray-400">Live Broadcast</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{broadcast.title}</h3>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed whitespace-pre-line">
                {broadcast.content}
              </p>
            </div>
            <button
              onClick={() => markDismissed(broadcast.id)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={() => markDismissed(broadcast.id)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Dismiss
            </button>
            {broadcast.action_url && (
              <button
                onClick={handleActionClick}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition inline-flex items-center gap-1.5"
              >
                {broadcast.action_label || "Learn More"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Top Sticky Banner view
  return (
    <div
      className={`sticky top-0 z-40 w-full ${typeStyles.bg} ${typeStyles.text} shadow-md border-b ${typeStyles.border} transition-all duration-300 animate-slide-down`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <Icon className="w-4 h-4 shrink-0" />
            <span
              className={`hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeStyles.badge}`}
            >
              {type}
            </span>
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            <span className="font-bold truncate">{broadcast.title}:</span>
            <span className="opacity-95 truncate max-w-xl">{broadcast.content}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {broadcast.action_url && (
            <button
              onClick={handleActionClick}
              className="px-3 py-1 bg-white text-gray-900 hover:bg-gray-100 font-semibold rounded-lg text-xs transition shadow-sm inline-flex items-center gap-1 shrink-0"
            >
              <span>{broadcast.action_label || "View"}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => markDismissed(broadcast.id)}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
