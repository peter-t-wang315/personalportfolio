import type { MetadataRoute } from "next";
import { projects } from "@/content";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/about", "/resume", "/work", "/nebula"].map(
    (path) => ({
      url: `${SITE_URL}${path}`,
    }),
  );

  const projectRoutes = projects.map((project) => ({
    url: `${SITE_URL}/work/${project.slug}`,
  }));

  return [...staticRoutes, ...projectRoutes];
}
