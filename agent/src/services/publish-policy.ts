import type { OperatingMode, Settings } from "../db/settings";

export type PublishAction = "generate" | "approve" | "export" | "publish" | "run-job";

export function requiresApproval(
  settings: Pick<Settings, "operatingMode" | "platformApprovalOverrides" | "categoryApprovalOverrides">,
  platform: string,
  category: string,
  sensitive = false,
): boolean {
  if (sensitive || settings.operatingMode === "SAFE") return true;
  const platformRule = settings.platformApprovalOverrides[platform];
  const categoryRule = settings.categoryApprovalOverrides[category];
  if (settings.operatingMode === "SUPERVISED") {
    return platformRule ?? categoryRule ?? true;
  }
  return platformRule !== false || categoryRule !== false;
}

export function isActionAllowed(
  settings: Pick<Settings, "operatingMode" | "paused">,
  action: PublishAction,
  alreadyApproved = false,
): boolean {
  if (settings.paused && (action === "export" || action === "publish" || action === "run-job")) {
    return false;
  }
  if (action === "generate") return true;
  if (action === "approve") return true;
  if (action === "export" || action === "publish") return alreadyApproved;
  return !settings.paused;
}

export function isOperatingMode(value: unknown): value is OperatingMode {
  return value === "SAFE" || value === "SUPERVISED" || value === "AUTONOMOUS";
}
