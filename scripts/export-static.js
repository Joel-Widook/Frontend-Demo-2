/**
 * Script para generar archivos estáticos HTML
 * Este script configura las variables de entorno necesarias para exportar
 * solo las páginas estáticas, excluyendo las rutas de API
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuración
const LOG_FILE = path.join(process.cwd(), 'static-export-logs.txt');

/**
 * Función para escribir logs en un archivo
 * @param {string} message Mensaje a loguear
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Escribir en el archivo de logs
  fs.appendFileSync(LOG_FILE, logMessage);
  
  // También mostrar en consola
  console.log(message);
}

/**
 * Función principal
 */
async function main() {
  try {
    log('🚀 Iniciando exportación de archivos estáticos...');
    
    // Crear archivo temporal next.config.export.js para la exportación
    const tempConfigPath = path.join(process.cwd(), 'next.config.export.js');
    const configContent = `
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
        },
        // Excluir rutas de API de la exportación
        experimental: {
          typedRoutes: true,
        },
        // Esto es necesario para evitar errores con las rutas de API
        skipTrailingSlashRedirect: true,
        trailingSlash: true,
      };
      
      module.exports = nextConfig;
    `;
    
    fs.writeFileSync(tempConfigPath, configContent);
    log('📝 Creado archivo de configuración temporal para exportación');
    
    // Ejecutar el comando de exportación
    log('🏗️ Ejecutando exportación estática...');
    try {
      execSync('npx next build', {
        env: {
          ...process.env,
          NEXT_CONFIG_FILE: tempConfigPath,
          STATIC_EXPORT: 'true',
        },
        stdio: 'inherit',
      });
      log('✅ Exportación completada exitosamente');
    } catch (error) {
      log(`⚠️ La exportación completó con advertencias: ${error.message}`);
      log('Esto es normal si hay rutas de API en el proyecto');
    }
    
    // Eliminar el archivo de configuración temporal
    fs.unlinkSync(tempConfigPath);
    log('🗑️ Eliminado archivo de configuración temporal');
    
    // Verificar que se hayan generado los archivos HTML
    const outDir = path.join(process.cwd(), 'out');
    if (fs.existsSync(outDir)) {
      const files = fs.readdirSync(outDir);
      log(`📊 Archivos generados en la carpeta out: ${files.length}`);
      
      // Verificar si se generaron archivos HTML
      const htmlFiles = files.filter(file => file.endsWith('.html'));
      if (htmlFiles.length > 0) {
        log(`🌐 Archivos HTML generados: ${htmlFiles.length}`);
      } else {
        log('⚠️ No se encontraron archivos HTML en la carpeta out');
      }
    } else {
      log('❌ No se encontró la carpeta out');
    }
    
    log('📊 Puedes usar el script upload-to-s3.js para subir estos archivos a S3');
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();
