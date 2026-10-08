/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['onnxruntime-node', 'sharp'],
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;