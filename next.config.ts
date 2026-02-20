import type { NextConfig } from "next";

const nextConfig: NextConfig = {
images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.atlasacademy.io",
      },
    ],
  },};

export default nextConfig;
