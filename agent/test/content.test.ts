import { describe, expect, it } from "vitest";
import { canTransition, transitionContent } from "../src/services/content";
import { qualityFlags } from "../src/services/quality-control";
import { buildUtmUrl } from "../src/services/utm";
import { MockProvider } from "../src/providers/llm";

describe("content rules", () => {
  it("rejects invalid state changes", () => {
    expect(canTransition("draft", "exported")).toBe(false);
    expect(() => transitionContent("draft", "published")).toThrow(/Invalid content transition/);
    expect(canTransition("approved", "exported")).toBe(true);
  });

  it("builds a tagged HTTPS link without losing existing query values", () => {
    const result = new URL(buildUtmUrl("https://nearly-x.pages.dev/?source=site", "linkedin", "phase-one", "item-1"));
    expect(result.searchParams.get("source")).toBe("site");
    expect(result.searchParams.get("utm_source")).toBe("linkedin");
    expect(result.searchParams.get("utm_medium")).toBe("social");
    expect(result.searchParams.get("utm_campaign")).toBe("phase-one");
    expect(result.searchParams.get("utm_content")).toBe("item-1");
    expect(() => buildUtmUrl("http://example.com", "x", "c", "i")).toThrow(/HTTPS/);
  });

  it("flags unauthorised offers, result claims, missing CTA, and repeated openings", () => {
    const flags = qualityFlags({
      platform: "instagram",
      format: "text",
      hook: "A new website guarantees more sales",
      message: "Get a free website audit and 20% discount. Customers said this doubled enquiries.",
      caption: "Our results are guaranteed. Contact us today.",
      callToAction: "Contact us today.",
      keywords: [],
      visualDirection: "",
      altText: "",
      sourceReferences: [],
    }, {
      authorizedPromotionalClaims: [],
      destinationUrl: "https://nearly-x.pages.dev/",
      recentOpenings: ["A new website guarantees more sales"],
    });
    expect(flags.length).toBeGreaterThanOrEqual(3);
    expect(flags.join(" ")).toMatch(/promotional claim/);
    expect(flags.join(" ")).toMatch(/testimonial or results/);
    expect(flags.join(" ")).toMatch(/repeats a recent draft/);
  });

  it("creates distinct mock drafts for every requested platform", async () => {
    const result = await new MockProvider().generate({
      brief: "Explain why a clear enquiry path matters.",
      pillar: "Website education",
      objective: "Create awareness",
      platforms: ["instagram", "linkedin"],
    });
    expect(result.drafts.map((draft) => draft.platform)).toEqual(["instagram", "linkedin"]);
    expect(result.drafts[0].caption).not.toBe(result.drafts[1].caption);
  });
});
