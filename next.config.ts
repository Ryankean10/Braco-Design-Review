import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['xlsx', 'pdf-parse', 'mammoth'],
};

export default nextConfig;
