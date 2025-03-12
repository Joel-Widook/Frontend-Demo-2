/**
 * Script para generar archivos estáticos HTML exactamente como se ven en desarrollo
 * Este script modifica temporalmente los archivos de API para permitir la exportación estática
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener el directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Configuración
const LOG_FILE = path.join(rootDir, 'static-export-logs.txt');
const API_ROUTES = [
  path.join(rootDir, 'app/api/webhook/route.ts'),
  path.join(rootDir, 'app/api/revalidate/route.ts')
];

// Función para escribir logs
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMessage);
  console.log(message);
}

// Función para modificar temporalmente los archivos de API
function modifyApiRoutes() {
  const backups = {};
  
  for (const routePath of API_ROUTES) {
    if (fs.existsSync(routePath)) {
      // Crear backup del archivo original
      const content = fs.readFileSync(routePath, 'utf8');
      backups[routePath] = content;
      
      // Modificar el archivo para quitar dynamic = 'force-dynamic'
      const modifiedContent = content.replace(
        /export const dynamic = ['"]force-dynamic['"];?/g,
        '// export const dynamic = \'force-dynamic\'; // Comentado temporalmente para exportación estática'
      );
      
      fs.writeFileSync(routePath, modifiedContent);
      log(`✅ Modificado temporalmente: ${routePath}`);
    }
  }
  
  return backups;
}

// Función para restaurar los archivos originales
function restoreApiRoutes(backups) {
  for (const [routePath, content] of Object.entries(backups)) {
    fs.writeFileSync(routePath, content);
    log(`✅ Restaurado: ${routePath}`);
  }
}

// Función principal
async function main() {
  try {
    log('🚀 Iniciando generación de archivos estáticos exactos...');
    
    // Paso 1: Modificar temporalmente los archivos de API
    log('🔧 Modificando temporalmente archivos de API...');
    const backups = modifyApiRoutes();
    
    // Paso 2: Ejecutar la exportación estática
    log('🏗️ Ejecutando exportación estática...');
    try {
      // Configurar Next.js para exportación estática
      const nextConfigPath = path.join(rootDir, 'next.config.ts');
      const originalConfig = fs.readFileSync(nextConfigPath, 'utf8');
      
      // Modificar la configuración para exportación estática
      const modifiedConfig = originalConfig
        .replace(/output: undefined,/, 'output: "export",')
        .replace(/distDir: '.next',/, 'distDir: "out",');
      
      fs.writeFileSync(nextConfigPath, modifiedConfig);
      log('✅ Configuración de Next.js modificada para exportación estática');
      
      // Ejecutar el comando de construcción
      execSync('npx next build', {
        cwd: rootDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          NEXT_PUBLIC_STATIC_EXPORT: 'true'
        }
      });
      
      log('✅ Exportación estática completada exitosamente');
      
      // Restaurar la configuración original
      fs.writeFileSync(nextConfigPath, originalConfig);
      log('✅ Configuración de Next.js restaurada');
    } catch (error) {
      log(`⚠️ Error durante la exportación: ${error.message}`);
    }
    
    // Paso 3: Restaurar los archivos originales
    log('🔄 Restaurando archivos de API originales...');
    restoreApiRoutes(backups);
    
    // Paso 4: Verificar los archivos generados
    const outDir = path.join(rootDir, 'out');
    if (fs.existsSync(outDir)) {
      // Contar archivos HTML
      const countHtmlFiles = (dir) => {
        let count = 0;
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            count += countHtmlFiles(itemPath);
          } else if (item.endsWith('.html')) {
            count++;
          }
        }
        
        return count;
      };
      
      const htmlCount = countHtmlFiles(outDir);
      log(`📊 Total de archivos HTML generados: ${htmlCount}`);
      
      // Verificar si se generaron los archivos para el artículo "prueba-estaticos"
      const articlePath = path.join(outDir, 'news/prueba-estaticos');
      if (fs.existsSync(articlePath)) {
        const files = fs.readdirSync(articlePath);
        log(`✅ Artículo "prueba-estaticos" generado con ${files.length} archivos`);
        
        // Verificar si hay un archivo index.html
        if (files.includes('index.html')) {
          log('✅ Archivo index.html encontrado para el artículo "prueba-estaticos"');
        } else {
          log('⚠️ No se encontró el archivo index.html para el artículo "prueba-estaticos"');
        }
      } else {
        log('⚠️ No se encontró la carpeta para el artículo "prueba-estaticos"');
      }
      
      log('✅ Archivos estáticos generados exitosamente en la carpeta out');
      log('📊 Puedes usar el script upload-to-s3.js para subir estos archivos a S3');
    } else {
      log('❌ No se encontró la carpeta out');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    
    // Asegurarse de restaurar los archivos en caso de error
    try {
      restoreApiRoutes(backups);
    } catch (e) {
      log(`❌ Error al restaurar archivos: ${e.message}`);
    }
    
    process.exit(1);
  }
}

// Ejecutar la función principal
main();
