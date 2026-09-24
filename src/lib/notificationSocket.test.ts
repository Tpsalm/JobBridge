import { describe, expect, it } from "vitest";
import { getNotificationRooms, normalizeNotificationPayload } from "./notificationSocket";

describe("notification socket routing", () => {
  it("groups global role and user rooms for a broadcast target", () => {
    expect(
      getNotificationRooms({
        audience: "broadcast",
        role: "recruiter",
        userId: "user-123",
      }),
    ).toEqual(["broadcast", "role:recruiter", "user:user-123"]);
  });

  it("normalizes payloads for mobile delivery", () => {
    const payload = normalizeNotificationPayload({
      id: "n-1",
      title: "Maintenance update",
      content: "The platform will be upgraded at 2 AM.",
      audience: "broadcast",
      type: "maintenance",
      priority: "high",
    });

    expect(payload).not.toBeNull();
    expect(payload?.priority).toBe("high");
    expect(payload?.sentAt).toBeTruthy();
    expect(payload?.type).toBe("maintenance");
  });
});
