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
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Utiliser une fonction pour ajouter les externals proprement
      const originalExternals = config.externals || [];
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : [originalExternals]),
        ({ request }, callback) => {
          if (
            request === 'onnxruntime-node' ||
            request === '@xenova/transformers'
          ) {
            return callback(null, 'commonjs ' + request);
          }
          callback();
        },
      ];
    }

    // Ignorer les fichiers binaires .node côté client
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
    };

    return config;
  },
};

export default nextConfig;