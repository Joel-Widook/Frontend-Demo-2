/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
    domains: [
      'localhost',
      process.env.STRAPI_URL?.replace(/^https?:\/\//, '') || 'localhost',
      process.env.AWS_S3_DOMAIN?.replace(/^https?:\/\//, '') || 's3.amazonaws.com'
    ],
    formats: ['image/avif', 'image/webp'],
  },
  // Esto es necesario para evitar errores con las rutas de API
  skipTrailingSlashRedirect: true,
  trailingSlash: true,
  // Optimizaciones para generación estática
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Soporte para SVG como componentes
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
};

module.exports = nextConfig;
