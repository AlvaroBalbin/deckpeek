import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't get confused by other lockfiles
  // higher up the tree.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
