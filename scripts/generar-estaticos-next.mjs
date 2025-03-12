/**
 * Script para generar archivos estáticos HTML usando Next.js
 * Este script utiliza la función de construcción de Next.js y luego copia los archivos HTML generados
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
const OUT_DIR = path.join(rootDir, 'out');
const NEXT_DIR = path.join(rootDir, '.next');

/**
 * Función para escribir logs en un archivo y consola
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
 * Función para crear directorios recursivamente
 * @param {string} dirPath Ruta del directorio a crear
 */
function createDirIfNotExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`📁 Creado directorio: ${dirPath}`);
  }
}

/**
 * Función para copiar archivos
 * @param {string} source Ruta del archivo fuente
 * @param {string} destination Ruta de destino
 */
function copyFile(source, destination) {
  // Crear el directorio de destino si no existe
  const destDir = path.dirname(destination);
  createDirIfNotExists(destDir);
  
  // Copiar el archivo
  fs.copyFileSync(source, destination);
  log(`📄 Copiado: ${source} -> ${destination}`);
}

/**
 * Función para copiar un directorio recursivamente
 * @param {string} sourceDir Directorio fuente
 * @param {string} destDir Directorio destino
 */
function copyDirectory(sourceDir, destDir) {
  // Crear el directorio destino si no existe
  createDirIfNotExists(destDir);
  
  // Leer los archivos del directorio fuente
  const files = fs.readdirSync(sourceDir);
  
  // Copiar cada archivo
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);
    
    // Si es un directorio, copiar recursivamente
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      // Si es un archivo, copiarlo
      copyFile(sourcePath, destPath);
    }
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    log('🚀 Iniciando generación de archivos estáticos...');
    
    // Paso 1: Construir la aplicación Next.js
    log('🏗️ Construyendo la aplicación Next.js...');
    execSync('npx next build', {
      cwd: rootDir,
      stdio: 'inherit',
    });
    log('✅ Construcción completada exitosamente');
    
    // Paso 2: Crear directorio de salida
    createDirIfNotExists(OUT_DIR);
    
    // Paso 3: Copiar archivos estáticos
    log('📦 Copiando archivos estáticos...');
    
    // Copiar archivos estáticos de Next.js
    const nextStaticDir = path.join(NEXT_DIR, 'static');
    const outStaticDir = path.join(OUT_DIR, '_next/static');
    copyDirectory(nextStaticDir, outStaticDir);
    
    // Paso 4: Copiar archivos HTML generados por Next.js
    log('📄 Copiando archivos HTML generados...');
    
    // Copiar archivos HTML de páginas estáticas (SSG)
    const serverDir = path.join(NEXT_DIR, 'server/app');
    
    // Función para buscar archivos HTML recursivamente
    function findHtmlFiles(dir, basePath = '') {
      const htmlFiles = [];
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const relativePath = path.join(basePath, file);
        
        if (fs.statSync(filePath).isDirectory()) {
          // Si es un directorio, buscar recursivamente
          htmlFiles.push(...findHtmlFiles(filePath, relativePath));
        } else if (file === 'index.html') {
          // Si es un archivo index.html, agregarlo a la lista
          htmlFiles.push({
            source: filePath,
            destination: path.join(OUT_DIR, basePath, file),
            relativePath: basePath,
          });
        } else if (file.endsWith('.html')) {
          // Si es otro archivo HTML, agregarlo a la lista
          htmlFiles.push({
            source: filePath,
            destination: path.join(OUT_DIR, basePath, file),
            relativePath: basePath,
          });
        }
      }
      
      return htmlFiles;
    }
    
    // Buscar y copiar archivos HTML de páginas estáticas
    const htmlFiles = findHtmlFiles(serverDir);
    
    // Copiar cada archivo HTML encontrado
    for (const htmlFile of htmlFiles) {
      copyFile(htmlFile.source, htmlFile.destination);
    }
    
    // Paso 5: Generar archivos HTML para rutas dinámicas (como /news/[slug])
    log('🔍 Generando archivos HTML para rutas dinámicas...');
    
    // Obtener información del prerender-manifest.json
    const prerenderManifestPath = path.join(NEXT_DIR, 'prerender-manifest.json');
    if (fs.existsSync(prerenderManifestPath)) {
      const prerenderManifest = JSON.parse(fs.readFileSync(prerenderManifestPath, 'utf8'));
      
      // Procesar cada ruta dinámica
      for (const [route, data] of Object.entries(prerenderManifest.routes)) {
        if (route.includes('/news/')) {
          const slug = route.replace('/news/', '').replace(/\/$/, '');
          log(`🔍 Procesando artículo con slug: ${slug}`);
          
          // Crear directorio para el artículo
          const articleDir = path.join(OUT_DIR, 'news', slug);
          createDirIfNotExists(articleDir);
          
          // Copiar el HTML de la página de artículo
          const sourceHtml = path.join(NEXT_DIR, 'server/app/news', '[slug]', 'index.html');
          const destHtml = path.join(articleDir, 'index.html');
          
          if (fs.existsSync(sourceHtml)) {
            copyFile(sourceHtml, destHtml);
          } else {
            log(`⚠️ No se encontró el archivo HTML para el artículo: ${slug}`);
          }
        }
      }
    } else {
      log('⚠️ No se encontró el archivo prerender-manifest.json');
    }
    
    // Paso 6: Copiar archivos CSS globales
    const cssFiles = fs.readdirSync(path.join(NEXT_DIR, 'static/css'));
    for (const cssFile of cssFiles) {
      const sourceCss = path.join(NEXT_DIR, 'static/css', cssFile);
      const destCss = path.join(OUT_DIR, '_next/static/css', cssFile);
      copyFile(sourceCss, destCss);
    }
    
    // Crear un archivo CSS global para facilitar la referencia
    const globalCssPath = path.join(OUT_DIR, 'app.css');
    if (cssFiles.length > 0) {
      const cssContent = `@import url('/_next/static/css/${cssFiles[0]}');`;
      fs.writeFileSync(globalCssPath, cssContent);
      log('📄 Creado archivo CSS global: app.css');
    }
    
    // Contar archivos HTML generados
    const countHtmlFiles = (dir) => {
      let count = 0;
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        
        if (fs.statSync(filePath).isDirectory()) {
          count += countHtmlFiles(filePath);
        } else if (file.endsWith('.html')) {
          count++;
        }
      }
      
      return count;
    };
    
    const totalHtmlFiles = countHtmlFiles(OUT_DIR);
    log(`✅ Archivos estáticos generados exitosamente en la carpeta out`);
    log(`📊 Total de archivos HTML generados: ${totalHtmlFiles}`);
    log(`📊 Puedes usar el script upload-to-s3.js para subir estos archivos a S3`);
    
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();
