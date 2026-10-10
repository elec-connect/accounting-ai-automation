import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'onnxruntime-node',
    'sharp',
  ],
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default withNextIntl(nextConfig);