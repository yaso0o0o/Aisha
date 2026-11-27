import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/", destination: "/ar", permanent: false }];
  },
  // The browser calls /api/... on this site and Next forwards it to the backend,
  // so the admin cookie is first-party wherever the two are hosted.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.API_URL ?? "http://localhost:4000"}/:path*` }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
