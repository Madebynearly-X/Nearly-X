export function buildUtmUrl(
  destination: string,
  platform: string,
  campaign: string,
  contentId: string,
): string {
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    throw new Error("Destination must be an absolute URL.");
  }
  if (url.protocol !== "https:") throw new Error("Destination URL must use HTTPS.");
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", contentId);
  return url.toString();
}
