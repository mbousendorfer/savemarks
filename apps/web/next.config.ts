import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@savemarks/shared",
    "@savemarks/database",
  ],
  poweredByHeader: false,
};

export default nextConfig;
