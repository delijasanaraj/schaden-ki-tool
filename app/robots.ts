import type { MetadataRoute } from "next";
import { TOOL_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${TOOL_URL}/sitemap.xml`,
    host: TOOL_URL,
  };
}
