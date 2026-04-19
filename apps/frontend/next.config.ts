import type { NextConfig } from "next";

const backendOrigin = process.env.BACKEND_ORIGIN;

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    if (!backendOrigin) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: "/docs",
        destination: `${backendOrigin}/docs`,
      },
      {
        source: "/health",
        destination: `${backendOrigin}/health`,
      },
      {
        source: "/openapi.json",
        destination: `${backendOrigin}/openapi.json`,
      },
    ];
  },
};

export default nextConfig;
