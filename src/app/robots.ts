import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/privacy", "/terms"],
      disallow: ["/api/", "/documents/", "/verify", "/reset-password"],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
