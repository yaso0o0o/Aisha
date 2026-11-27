import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/", destination: "/ar", permanent: false }];
  },
  // The browser calls /api/... on this site and Next forwards it to the backend,
  // so the admin cookie is first-party wherever the two are hosted.
  async rewrites() {
    const api = process.env.API_URL ?? "http://localhost:4000";
    return [
      { source: "/api/:path*", destination: `${api}/:path*` },
      // Photos uploaded from the dashboard.
      { source: "/uploads/:path*", destination: `${api}/uploads/:path*` },
    ];
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
