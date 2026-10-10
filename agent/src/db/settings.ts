import type { Env } from "../env";

export type OperatingMode = "SAFE" | "SUPERVISED" | "AUTONOMOUS";
export type Settings = {
  operatingMode: OperatingMode;
  paused: boolean;
  platformApprovalOverrides: Record<string, boolean>;
  categoryApprovalOverrides: Record<string, boolean>;
  authorizedPromotionalClaims: string[];
  dailySpendCapUsd: number;
  monthlySpendCapUsd: number;
};

type SettingsRow = {
  operating_mode: OperatingMode;
  paused: number;
  platform_approval_overrides: string;
  category_approval_overrides: string;
  authorized_promotional_claims: string;
  daily_spend_cap_usd: number;
  monthly_spend_cap_usd: number;
};

function parseOverrides(value: string): Record<string, boolean> {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Stored approval overrides are invalid.");
  }
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
  );
}

function parseClaims(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((claim) => typeof claim === "string")) {
    throw new Error("Stored authorised promotional claims are invalid.");
  }
  return parsed;
}

export async function getSettings(env: Env): Promise<Settings> {
  const row = await env.DB.prepare(
    `SELECT operating_mode, paused, platform_approval_overrides, category_approval_overrides,
            authorized_promotional_claims, daily_spend_cap_usd, monthly_spend_cap_usd
     FROM settings WHERE id = 1`,
  ).first<SettingsRow>();

  if (!row) throw new Error("Default settings are missing. Apply the D1 migrations.");
  return {
    operatingMode: row.operating_mode,
    paused: row.paused === 1,
    platformApprovalOverrides: parseOverrides(row.platform_approval_overrides),
    categoryApprovalOverrides: parseOverrides(row.category_approval_overrides),
    authorizedPromotionalClaims: parseClaims(row.authorized_promotional_claims),
    dailySpendCapUsd: row.daily_spend_cap_usd,
    monthlySpendCapUsd: row.monthly_spend_cap_usd,
  };
}

export async function setPause(env: Env, paused: boolean): Promise<void> {
  const result = await env.DB.prepare(
    "UPDATE settings SET paused = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
  ).bind(paused ? 1 : 0).run();
  if (result.meta.changes !== 1) throw new Error("Could not update the emergency pause setting.");
}
