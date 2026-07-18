import { describe, expect, it } from "vitest";
import { buildUpcomingPayments } from "./upcomingPayments";

describe("buildUpcomingPayments", () => {
  const now = new Date("2026-07-01T12:00:00Z");

  it("includes Stripe renewal sorted by currentPeriodEnd", () => {
    const rows = buildUpcomingPayments(
      [
        {
          id: 1,
          name: "Alpha",
          subscriptionPlan: "pro",
          stripeSubscriptionId: "sub_1",
          billingStatus: "active",
          currentPeriodEnd: new Date("2026-08-01T12:00:00Z"),
        },
        {
          id: 2,
          name: "Beta",
          subscriptionPlan: "starter",
          stripeSubscriptionId: "sub_2",
          billingStatus: "active",
          currentPeriodEnd: new Date("2026-07-15T12:00:00Z"),
        },
      ],
      now
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.companyName).toBe("Beta");
    expect(rows[0]?.kind).toBe("renewal");
    expect(rows[1]?.companyName).toBe("Alpha");
  });

  it("includes free trial end when no Stripe subscription", () => {
    const rows = buildUpcomingPayments(
      [
        {
          id: 3,
          name: "Gamma",
          subscriptionPlan: "trial",
          trialEndsAt: new Date("2026-07-10T12:00:00Z"),
        },
      ],
      now
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("trial_end");
    expect(rows[0]?.dueAt.toISOString()).toBe("2026-07-10T12:00:00.000Z");
  });

  it("marks past_due subscriptions as payment_overdue", () => {
    const rows = buildUpcomingPayments(
      [
        {
          id: 4,
          name: "Delta",
          subscriptionPlan: "pro",
          stripeSubscriptionId: "sub_4",
          billingStatus: "past_due",
          currentPeriodEnd: new Date("2026-06-20T12:00:00Z"),
        },
      ],
      now
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("payment_overdue");
  });
});
