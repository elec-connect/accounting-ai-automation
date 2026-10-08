/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'onnxruntime-node',
    'sharp',
    'pdfjs-dist',   // ← Ajoutez cette ligne
    'unpdf',        // ← Et cette ligne
  ],
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;