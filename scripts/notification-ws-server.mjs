import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.NOTIFICATION_WS_PORT || 3001);
const adminKey = process.env.JOBBRIDGE_WS_ADMIN_KEY || "jobbridge-local-dev";
const defaultAudience = process.env.DEFAULT_NOTIFICATION_AUDIENCE || "broadcast";
const verificationToken = process.env.JOBBRIDGE_WS_SHARED_SECRET || "";

const clients = new Map();
const rooms = new Map();

function addToRoom(roomName, socket) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(socket);
}

function removeFromRoom(roomName, socket) {
  const room = rooms.get(roomName);
  if (!room) return;
  room.delete(socket);
  if (room.size === 0) {
    rooms.delete(roomName);
  }
}

function targetRoomNames(target = {}) {
  const roomNames = new Set([defaultAudience]);
  const audience = target.audience || defaultAudience;
  const userId = target.userId;
  const role = target.role;

  if (audience) roomNames.add(String(audience));
  if (role) roomNames.add(`role:${role}`);
  if (userId) roomNames.add(`user:${userId}`);

  return Array.from(roomNames);
}

function buildPayload(payload = {}) {
  const normalized = {
    id: payload.id || randomUUID(),
    title: payload.title || "JobBridge update",
    content: payload.content || "You have a new update.",
    audience: payload.audience || defaultAudience,
    type: payload.type || "announcement",
    sentAt: payload.sentAt || new Date().toISOString(),
    priority: payload.priority || "normal",
    actionUrl: payload.actionUrl || null,
    actionLabel: payload.actionLabel || null,
    payload: payload.payload || {},
  };

  if (payload.userId) normalized.userId = payload.userId;
  if (payload.role) normalized.role = payload.role;

  return normalized;
}

function sendJson(socket, message) {
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify(message));
}

function dispatchToTarget(target, payload) {
  const roomNames = targetRoomNames(target);
  const notified = new Set();

  for (const roomName of roomNames) {
    const subscribers = rooms.get(roomName) || new Set();
    for (const socket of subscribers) {
      if (notified.has(socket)) continue;
      sendJson(socket, {
        type: "notification",
        event: "broadcast",
        payload: buildPayload(payload),
      });
      notified.add(socket);
    }
  }

  return notified.size;
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, clients: clients.size, rooms: rooms.size }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/notify") {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
    });

    req.on("end", () => {
      try {
        const incoming = JSON.parse(body || "{}");
        const headerKey = req.headers["x-admin-key"] || req.headers["x-jobbridge-key"];
        if (adminKey && headerKey !== adminKey) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
          return;
        }

        const payload = buildPayload(incoming.payload || incoming);
        const target = incoming.target || { audience: incoming.audience || defaultAudience };
        const delivered = dispatchToTarget(target, payload);

        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            delivered,
            audience: target.audience || defaultAudience,
            roomCount: targetRoomNames(target).length,
            payload,
          }),
        );
      } catch (error) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(error) }));
      }
    });

    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url, "http://localhost");
  const userId = url.searchParams.get("userId") || "";
  const role = url.searchParams.get("role") || "";
  const audience = url.searchParams.get("audience") || defaultAudience;
  const token = url.searchParams.get("token") || "";
  const socketId = randomUUID();

  if (verificationToken && token && token !== verificationToken) {
    socket.close(1008, "Invalid auth token");
    return;
  }

  const identity = { id: socketId, userId, role, audience, connectedAt: new Date().toISOString() };
  clients.set(socket, identity);

  const roomNames = targetRoomNames({ audience, userId, role });
  roomNames.forEach((roomName) => addToRoom(roomName, socket));

  sendJson(socket, {
    type: "connection",
    status: "connected",
    socketId,
    rooms: roomNames,
  });

  socket.on("message", (message) => {
    try {
      const parsed = JSON.parse(String(message));
      if (parsed?.type === "ping") {
        sendJson(socket, {
          type: "pong",
          receivedAt: new Date().toISOString(),
        });
        return;
      }

      if (parsed?.type === "admin_broadcast") {
        if (!adminKey || parsed.adminKey !== adminKey) {
          sendJson(socket, { type: "error", message: "Unauthorized admin broadcast" });
          return;
        }

        dispatchToTarget(parsed.target || { audience: parsed.audience || defaultAudience }, buildPayload(parsed.payload || {}));
      }
    } catch (error) {
      console.warn("WebSocket message parse error:", error);
    }
  });

  socket.on("close", () => {
    const current = clients.get(socket);
    if (current) {
      const roomNames = targetRoomNames({ audience: current.audience, userId: current.userId, role: current.role });
      roomNames.forEach((roomName) => removeFromRoom(roomName, socket));
      clients.delete(socket);
    }
  });
});

server.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url, "http://localhost");

  if (pathname !== "/ws/notifications") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

server.listen(PORT, () => {
  console.log(`JobBridge WebSocket notification server listening on ws://localhost:${PORT}/ws/notifications`);
});

export { dispatchToTarget, buildPayload, targetRoomNames };
