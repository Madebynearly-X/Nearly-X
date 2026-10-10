export type Capability = {
  platform: string;
  category: "Social publishing" | "Video creation";
  connection: "Not connected" | "Connected" | "Ready to launch" | "Awaiting approval" | "Setup required";
  verification: "unverified" | "official-docs-checked";
  sourceUrl: string | null;
};

const linkedInPostsDocs = "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09";
const socialPublishingCapabilities: Capability[] = [
  "Instagram", "Facebook", "LinkedIn", "TikTok", "YouTube", "Pinterest", "X", "Threads",
].map((platform) => platform === "LinkedIn" ? ({
  platform,
  category: "Social publishing" as const,
  connection: "Not connected" as const,
  verification: "official-docs-checked" as const,
  sourceUrl: linkedInPostsDocs,
}) : ({
  platform,
  category: "Social publishing" as const,
  connection: "Not connected" as const,
  verification: "unverified" as const,
  sourceUrl: null,
}));

export const capabilityRegistry: Capability[] = [
  ...socialPublishingCapabilities,
  ...["Canva", "Adobe Express"].map((platform) => ({
    platform,
    category: "Video creation" as const,
    connection: "Not connected" as const,
    verification: "unverified" as const,
    sourceUrl: null,
  })),
];
