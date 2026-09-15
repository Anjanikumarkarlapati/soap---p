import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stops Next from picking up a stray lockfile in the home directory as the workspace root.
  turbopack: { root: __dirname },
};

export default nextConfig;
