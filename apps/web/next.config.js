/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'onnxruntime-node',
    'sharp',
    '@xenova/transformers',
  ],
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;