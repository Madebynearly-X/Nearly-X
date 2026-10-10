import { describe, expect, it } from "vitest";
import type { Settings } from "../src/db/settings";
import { isActionAllowed, requiresApproval } from "../src/services/publish-policy";

const settings = (operatingMode: Settings["operatingMode"], paused = false): Settings => ({
  operatingMode,
  paused,
  platformApprovalOverrides: {},
  categoryApprovalOverrides: {},
  authorizedPromotionalClaims: [],
  dailySpendCapUsd: 1,
  monthlySpendCapUsd: 10,
});

describe("publish policy", () => {
  it("keeps safe mode approval-gated", () => {
    expect(requiresApproval(settings("SAFE"), "instagram", "education")).toBe(true);
  });

  it("honours owner-configured approval overrides only outside sensitive content", () => {
    const supervised = settings("SUPERVISED");
    supervised.platformApprovalOverrides.instagram = false;
    expect(requiresApproval(supervised, "instagram", "education")).toBe(false);
    expect(requiresApproval(supervised, "instagram", "education", true)).toBe(true);
  });

  it("blocks job execution, export, and publish while paused", () => {
    const paused = settings("AUTONOMOUS", true);
    expect(isActionAllowed(paused, "run-job")).toBe(false);
    expect(isActionAllowed(paused, "export", true)).toBe(false);
    expect(isActionAllowed(paused, "publish", true)).toBe(false);
  });

  it("never permits an unapproved item to export in any operating mode", () => {
    for (const mode of ["SAFE", "SUPERVISED", "AUTONOMOUS"] as const) {
      expect(isActionAllowed(settings(mode), "export", false)).toBe(false);
      expect(isActionAllowed(settings(mode), "export", true)).toBe(true);
    }
  });
});
