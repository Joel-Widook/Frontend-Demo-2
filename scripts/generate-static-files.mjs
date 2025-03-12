/**
 * Script para generar archivos estáticos para S3
 * Este script copia los archivos necesarios de la carpeta .next a la carpeta out
 * para poder subirlos a S3 sin necesidad de usar 'output: export'
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuración de logs
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
 * Crea un directorio si no existe
 * @param {string} dir Directorio a crear
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`📁 Creado directorio: ${dir}`);
  }
}

/**
 * Copia un archivo de origen a destino
 * @param {string} source Archivo de origen
 * @param {string} destination Archivo de destino
 */
function copyFile(source, destination) {
  ensureDirectoryExists(path.dirname(destination));
  fs.copyFileSync(source, destination);
  log(`📄 Copiado: ${source} -> ${destination}`);
}

/**
 * Copia un directorio recursivamente
 * @param {string} source Directorio de origen
 * @param {string} destination Directorio de destino
 */
function copyDirectory(source, destination) {
  ensureDirectoryExists(destination);
  
  const files = fs.readdirSync(source);
  
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const destPath = path.join(destination, file);
    
    const stats = fs.statSync(sourcePath);
    
    if (stats.isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      copyFile(sourcePath, destPath);
    }
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    log('🚀 Iniciando generación de archivos estáticos para S3...');
    
    // Directorios de origen y destino
    const nextDir = path.join(process.cwd(), '.next');
    const serverDir = path.join(nextDir, 'server');
    const outDir = path.join(process.cwd(), 'out');
    
    // Verificar que exista el directorio .next
    if (!fs.existsSync(nextDir)) {
      log('❌ Error: El directorio .next no existe. Ejecuta npm run build primero.');
      process.exit(1);
    }
    
    // Limpiar el directorio de salida si existe
    if (fs.existsSync(outDir)) {
      log('🗑️ Limpiando directorio de salida existente...');
      fs.rmSync(outDir, { recursive: true, force: true });
    }
    
    // Crear el directorio de salida
    ensureDirectoryExists(outDir);
    
    // Copiar archivos estáticos
    log('📦 Copiando archivos estáticos...');
    copyDirectory(path.join(nextDir, 'static'), path.join(outDir, '_next/static'));
    
    // Extraer y generar archivos HTML para las rutas estáticas
    log('📄 Generando archivos HTML para las rutas estáticas...');
    
    // Crear index.html en la raíz
    const indexHtmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Frontend Demo</title>
  <link rel="stylesheet" href="/_next/static/css/app.css">
</head>
<body>
  <div id="__next">
    <!-- El contenido se cargará desde los archivos JavaScript -->
    <div>Cargando...</div>
  </div>
  <script src="/_next/static/chunks/main.js"></script>
</body>
</html>`;
    
    fs.writeFileSync(path.join(outDir, 'index.html'), indexHtmlContent);
    log('📝 Creado archivo index.html');
    
    // Crear directorio para noticias
    ensureDirectoryExists(path.join(outDir, 'news'));
    
    // Obtener lista de artículos generados estáticamente
    const articlesDir = path.join(serverDir, 'app', 'news', '[slug]');
    if (fs.existsSync(articlesDir)) {
      // Crear un archivo HTML para cada artículo
      const articlePaths = fs.readdirSync(articlesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const slug of articlePaths) {
        const articleDir = path.join(outDir, 'news', slug);
        ensureDirectoryExists(articleDir);
        
        const articleHtmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Artículo: ${slug}</title>
  <link rel="stylesheet" href="/_next/static/css/app.css">
</head>
<body>
  <div id="__next">
    <!-- El contenido se cargará desde los archivos JavaScript -->
    <div>Cargando artículo: ${slug}...</div>
  </div>
  <script src="/_next/static/chunks/main.js"></script>
</body>
</html>`;
        
        fs.writeFileSync(path.join(articleDir, 'index.html'), articleHtmlContent);
        log(`📝 Creado archivo HTML para artículo: ${slug}`);
      }
    }
    
    log('✅ Archivos estáticos generados exitosamente en la carpeta out');
    log('📊 Puedes usar el script upload-to-s3.js para subir estos archivos a S3');
  } catch (err) {
    log(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();
