import type { MetadataRoute } from "next";
import { TOOL_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${TOOL_URL}/`, changeFrequency: "monthly", priority: 1 }];
}
