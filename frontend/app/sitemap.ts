import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://brollysolutions.in";

export default function sitemap(): MetadataRoute.Sitemap {
  // Public, indexable routes only.
  const routes = ["", "/generator", "/templates", "/community", "/login", "/signup"];
  return routes.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
