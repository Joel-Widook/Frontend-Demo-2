import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // Ignorar errores de TypeScript durante la compilación
    ignoreBuildErrors: true,
  },
  images: {
    domains: [
      'localhost',
      process.env.STRAPI_URL?.replace(/^https?:\/\//, '') || 'localhost',
      process.env.AWS_S3_DOMAIN?.replace(/^https?:\/\//, '') || 's3.amazonaws.com'
    ],
    formats: ['image/avif', 'image/webp'],
    unoptimized: true, // Deshabilitar la optimización de imágenes para compatibilidad con modo export
  },
  // Configurar para exportación estática
  output: 'export',
  
  // Directorio de salida para la compilación
  
  // Configuración para mejorar la generación de rutas estáticas
  skipTrailingSlashRedirect: true,
  trailingSlash: true,
  // Esto genera archivos HTML completos en producción que pueden ser visualizados directamente desde S3
  // Desactivar turbopack para evitar conflictos
  experimental: {
    typedRoutes: true,
  },
  // Ajustes para manejo de archivos estáticos
  distDir: 'out',
  // Evitar problemas con paths al generar estáticos
  assetPrefix: process.env.NODE_ENV === 'production' ? process.env.ASSET_PREFIX || '' : '',
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

export default nextConfig;
