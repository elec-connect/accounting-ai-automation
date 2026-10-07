/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse'],
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;