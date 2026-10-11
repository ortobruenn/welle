import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.178.22',
    '192.168.178.22:3000',
    'localhost:3000',
  ],
};

export default nextConfig;
