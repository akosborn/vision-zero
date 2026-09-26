import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  async rewrites() {
    // Only apply in local development — production uses nginx to route
    // /api/v1/* to the appropriate backend.
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      {
        source: "/api/v1/streets",
        destination: "http://localhost:4000/api/v1/streets",
      },
      {
        source: "/api/v1/streets/centerline",
        destination: "http://localhost:4000/api/v1/streets/centerline",
      },
      {
        source: "/api/v1/streets/buffered",
        destination: "http://localhost:4000/api/v1/streets/buffered",
      },
    ];
  },
};

export default nextConfig;
