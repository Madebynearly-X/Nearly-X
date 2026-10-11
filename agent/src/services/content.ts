import { z } from "zod";

export const platforms = ["instagram", "facebook", "linkedin", "tiktok"] as const;
export type Platform = (typeof platforms)[number];
export const contentStatuses = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "scheduled",
  "exported",
  "published",
  "cancelled",
] as const;
export type ContentStatus = (typeof contentStatuses)[number];

export const draftSchema = z.object({
  platform: z.enum(platforms),
  format: z.string().min(1).max(80),
  hook: z.string().min(1).max(500),
  message: z.string().min(1).max(4000),
  caption: z.string().min(1).max(5000),
  callToAction: z.string().min(1).max(500),
  keywords: z.array(z.string().max(80)).max(30),
  visualDirection: z.string().max(2000),
  altText: z.string().max(1000),
  sourceReferences: z.array(z.string().url()).max(20),
});
export type Draft = z.infer<typeof draftSchema>;

const transitions: Record<ContentStatus, readonly ContentStatus[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "rejected", "cancelled"],
  approved: ["scheduled", "exported", "cancelled"],
  rejected: ["draft", "cancelled"],
  scheduled: ["approved", "exported", "cancelled"],
  exported: ["published", "approved", "cancelled"],
  published: [],
  cancelled: [],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return transitions[from].includes(to);
}

export function transitionContent(from: ContentStatus, to: ContentStatus): ContentStatus {
  if (!canTransition(from, to)) throw new Error(`Invalid content transition: ${from} -> ${to}.`);
  return to;
}

export function makeIdempotencyKey(brief: string, platform: Platform, campaignId: string): string {
  return `${platform}:${campaignId}:${brief.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 180)}`;
}
