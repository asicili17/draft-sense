import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@draft-sense/providers"],
};
export default nextConfig;
