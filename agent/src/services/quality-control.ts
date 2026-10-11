import type { Draft, Platform } from "./content";

const platformCaptionLimits: Record<Platform, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
};

export type QualityOptions = {
  authorizedPromotionalClaims: string[];
  destinationUrl: string;
  recentOpenings: string[];
};

export function qualityFlags(draft: Draft, options: QualityOptions): string[] {
  const flags: string[] = [];
  const text = `${draft.hook}\n${draft.message}\n${draft.caption}`.toLowerCase();
  const authorized = options.authorizedPromotionalClaims.map((claim) => claim.trim().toLowerCase()).filter(Boolean);
  const unapprovedText = authorized.reduce(
    (remaining, claim) => remaining.replace(new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " "),
    text,
  );
  if (/\b(?:free(?:\s+\w+){0,2}\s+audit|guarantee[ds]?|discount|limited[- ]time|from r\s?\d[\d,.]*|(?:r|zar|[$£€])\s?\d[\d,.]*(?:\/month)?)\b/i.test(unapprovedText)) {
    flags.push("Unauthorised promotional claim, guarantee, discount or price.");
  }
  if (/\btestimonial\b|\bclients? said\b|\bcustomers? said\b|\bincreased (?:sales|leads|revenue) by\b/i.test(text)) {
    flags.push("Potential testimonial or results claim needs evidence.");
  }
  if (draft.sourceReferences.length === 0 && /\b(research shows|according to|in \d{4}|percent|%|survey|study found|industry data)\b/i.test(text)) {
    flags.push("Factual or trend-based claim has no source reference.");
  }
  if (!draft.callToAction.trim() || !/\b(contact|enquir|visit|learn|read|see|explore|book|reply|save|share|follow|try)\b/i.test(draft.callToAction)) {
    flags.push("A clear call to action is missing.");
  }
  if (draft.caption.length > platformCaptionLimits[draft.platform]) {
    flags.push(`Caption exceeds the ${draft.platform} length limit.`);
  }
  if (!options.destinationUrl || !/^https:\/\//i.test(options.destinationUrl)) {
    flags.push("A valid HTTPS destination URL is missing.");
  }
  const opening = draft.hook.trim().toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").slice(0, 50);
  if (opening && options.recentOpenings.some((recent) => {
    const normalized = recent.trim().toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").slice(0, 50);
    return normalized === opening;
  })) {
    flags.push("Opening repeats a recent draft.");
  }
  return flags;
}
