import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://brollysolutions.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated / user-specific areas shouldn't be indexed.
      disallow: ["/history", "/library", "/analytics", "/share/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
