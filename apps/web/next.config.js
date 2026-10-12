import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⭐ Pas de 'standalone' : le monorepo pnpm ne le supporte pas correctement
  //    On utilise la methode classique (build complet + next start)

  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(nextConfig);