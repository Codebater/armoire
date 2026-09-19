import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App data lives client-side (IndexedDB); images are blob URLs, no optimizer needed.
  turbopack: {
    // Parent folder holds many sibling projects with their own lockfiles.
    root: process.cwd(),
  },
};

export default nextConfig;
