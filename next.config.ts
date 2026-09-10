import type { NextConfig } from "next";

/**
 * Two projects were renamed after their URLs had been published: "Coding quiz
 * platform" became CodeLingo and "This site" became "Personal portfolio". The
 * slugs moved with the titles, which is the right end state and also breaks
 * every link that already exists — a portfolio's whole job is to survive being
 * linked to, so the old paths are kept alive rather than left to 404.
 *
 * Permanent, because they are: nothing is coming back to these paths. Each
 * project has two of them, since a project is a document at `/work/[slug]` and
 * a node at `/nebula/[slug]`, and both were reachable.
 */
const nextConfig: NextConfig = {
  async redirects() {
    const renamed = [
      { from: "coding-quiz-platform", to: "codelingo" },
      { from: "this-site", to: "personal-portfolio" },
    ];
    return renamed.flatMap(({ from, to }) =>
      ["/work", "/nebula"].map((base) => ({
        source: `${base}/${from}`,
        destination: `${base}/${to}`,
        permanent: true,
      })),
    );
  },
};

export default nextConfig;
