import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react', 'motion'],
  },
};

export default nextConfig;
