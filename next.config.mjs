/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis'],
  },
};

export default nextConfig;
