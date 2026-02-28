import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16.2 — no webpack config needed
  transpilePackages: ['@pantryai/shared'],
};

export default nextConfig;
