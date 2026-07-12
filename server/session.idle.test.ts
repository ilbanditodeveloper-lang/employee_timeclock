import { describe, expect, it } from "vitest";
import {
  isSessionIdleExpired,
  sessionToJwtPayload,
  signSession,
  touchSession,
  verifySession,
} from "./_core/session";
import { SESSION_IDLE_TIMEOUT_MS } from "../shared/const";

describe("session idle timeout", () => {
  it("rejects JWT when lastActivity is older than idle timeout", async () => {
    const stale = Date.now() - SESSION_IDLE_TIMEOUT_MS - 1_000;
    const token = await signSession({
      type: "admin",
      companyId: 1,
      companySlug: "demo",
      userId: 1,
      lastActivity: stale,
    });

    const session = await verifySession(token);
    expect(session).toBeNull();
  });

  it("accepts JWT when lastActivity is within idle timeout", async () => {
    const recent = Date.now() - 30 * 60 * 1000;
    const token = await signSession({
      type: "employee",
      companyId: 1,
      companySlug: "demo",
      employeeId: 2,
      lastActivity: recent,
    });

    const session = await verifySession(token);
    expect(session?.type).toBe("employee");
    expect(session?.employeeId).toBe(2);
  });

  it("touchSession updates lastActivity", () => {
    const before = sessionToJwtPayload({
      type: "superadmin",
      lastActivity: 1,
    });
    const touched = touchSession(before);
    expect(touched.lastActivity).toBeGreaterThan(1_000_000_000_000);
  });

  it("isSessionIdleExpired returns true only past threshold", () => {
    const now = 1_000_000_000_000;
    expect(isSessionIdleExpired(now - SESSION_IDLE_TIMEOUT_MS - 1, now)).toBe(true);
    expect(isSessionIdleExpired(now - SESSION_IDLE_TIMEOUT_MS + 1, now)).toBe(false);
  });
});
