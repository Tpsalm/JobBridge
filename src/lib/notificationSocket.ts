export type NotificationAudience =
  | "broadcast"
  | "recruiters"
  | "providers"
  | "job_seekers"
  | "user";

export type NotificationPriority = "low" | "normal" | "high";

export interface JobBridgeNotificationPayload {
  id: string;
  title: string;
  content: string;
  audience: NotificationAudience | string;
  userId?: string;
  role?: string;
  type?: "announcement" | "urgent" | "promo" | "success" | "maintenance" | string;
  actionUrl?: string;
  actionLabel?: string;
  sentAt: string;
  priority?: NotificationPriority;
  payload?: Record<string, unknown>;
}

export type SocketMessage =
  | { type: "connection"; status: "connected"; socketId: string }
  | { type: "pong"; receivedAt: string }
  | { type: "notification"; event: string; payload: JobBridgeNotificationPayload }
  | { type: "admin_broadcast"; payload: JobBridgeNotificationPayload };

export interface NotificationSocketOptions {
  url?: string;
  userId?: string;
  role?: string;
  audience?: NotificationAudience | string;
  authToken?: string;
}

export function getNotificationRooms(options: {
  userId?: string;
  role?: string;
  audience?: string;
}): string[] {
  const rooms = new Set<string>();
  const { audience, userId, role } = options;

  if (!audience && !userId && !role) {
    rooms.add("broadcast");
  }

  if (audience === "broadcast" || audience === undefined) {
    rooms.add("broadcast");
  }

  if (role) {
    rooms.add(`role:${role}`);
  }

  if (audience && audience !== "broadcast") {
    rooms.add(`audience:${audience}`);
  }

  if (userId) {
    rooms.add(`user:${userId}`);
  }

  return Array.from(rooms).sort();
}

export function normalizeNotificationPayload(
  payload: Partial<JobBridgeNotificationPayload> | null | undefined,
): JobBridgeNotificationPayload | null {
  if (!payload || !payload.title || !payload.content) {
    return null;
  }

  return {
    id: payload.id || `notification-${Date.now()}`,
    title: payload.title,
    content: payload.content,
    audience: payload.audience || "broadcast",
    userId: payload.userId,
    role: payload.role,
    type: payload.type || "announcement",
    actionUrl: payload.actionUrl,
    actionLabel: payload.actionLabel,
    sentAt: payload.sentAt || new Date().toISOString(),
    priority: payload.priority || "normal",
    payload: payload.payload || {},
  };
}

export class JobBridgeNotificationSocket {
  private socket: WebSocket | null = null;
  private readonly url: string;
  private readonly config: NotificationSocketOptions;
  private reconnectTimeoutId: number | null = null;
  private readonly listeners = new Map<string, Set<(event: SocketMessage) => void>>();

  constructor(options: NotificationSocketOptions = {}) {
    this.config = options;
    const fallbackUrl =
      typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss" : "ws"}://localhost:3001/ws/notifications`
        : "ws://localhost:3001/ws/notifications";
    this.url = options.url || import.meta.env.VITE_WS_URL || fallbackUrl;
  }

  public on(eventName: string, callback: (event: SocketMessage) => void): () => void {
    const existing = this.listeners.get(eventName) || new Set();
    existing.add(callback);
    this.listeners.set(eventName, existing);

    return () => {
      const set = this.listeners.get(eventName);
      if (!set) return;
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  public connect(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    const url = new URL(this.url);
    if (this.config.userId) url.searchParams.set("userId", this.config.userId);
    if (this.config.role) url.searchParams.set("role", this.config.role);
    if (this.config.audience) url.searchParams.set("audience", String(this.config.audience));
    if (this.config.authToken) url.searchParams.set("token", this.config.authToken);

    this.socket = new WebSocket(url.toString());

    this.socket.addEventListener("open", () => {
      this.emit("connection", {
        type: "connection",
        status: "connected",
        socketId: this.socket?.url || "unknown",
      });
    });

    this.socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as SocketMessage;
        const listeners = this.listeners.get(message.type) || this.listeners.get("*");
        if (!listeners) return;
        listeners.forEach((callback) => callback(message));
      } catch (error) {
        console.warn("Failed to parse notification socket message", error);
      }
    });

    this.socket.addEventListener("close", () => {
      this.socket = null;
      if (this.reconnectTimeoutId) return;
      this.reconnectTimeoutId = window.setTimeout(() => {
        this.reconnectTimeoutId = null;
        this.connect();
      }, 1500);
    });
  }

  public disconnect(): void {
    if (this.reconnectTimeoutId) {
      window.clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  public sendAdminBroadcast(payload: Partial<JobBridgeNotificationPayload>): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const normalized = normalizeNotificationPayload(payload);
    if (!normalized) {
      return false;
    }

    this.socket.send(
      JSON.stringify({
        type: "admin_broadcast",
        payload: normalized,
      }),
    );

    return true;
  }

  private emit(eventName: string, event: SocketMessage): void {
    const listeners = this.listeners.get(eventName) || this.listeners.get("*");
    listeners?.forEach((callback) => callback(event));
  }
}

export function createJobBridgeNotificationSocket(
  options: NotificationSocketOptions = {},
): JobBridgeNotificationSocket {
  return new JobBridgeNotificationSocket(options);
}
