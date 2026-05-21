import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Самодостаточный bundle в .next/standalone/server.js — нужен для PM2-деплоя.
  output: "standalone",
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
