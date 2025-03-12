/**
 * Script de despliegue para el webhook
 * Este script se ejecuta cuando se recibe una notificación de Strapi
 * y se encarga de regenerar las páginas estáticas
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const http = require('http');
const https = require('https');

const execPromise = util.promisify(exec);

// Configuración de logs
const LOG_FILE = path.join(process.cwd(), 'webhook-deploy-logs.txt');

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
 * Ejecuta un comando y loguea su salida
 * @param {string} command Comando a ejecutar
 * @param {string} name Nombre descriptivo del comando
 */
async function runCommand(command, name) {
  log(`🚀 Iniciando: ${name}`);
  
  try {
    const { stdout, stderr } = await execPromise(command);
    
    if (stdout) {
      log(`📝 Salida de ${name}:\n${stdout}`);
    }
    
    if (stderr) {
      log(`⚠️ Errores de ${name}:\n${stderr}`);
    }
    
    log(`✅ Completado: ${name}`);
  } catch (error) {
    log(`❌ Error en ${name}: ${error.message}`);
    if (error.stdout) log(`📝 Salida: ${error.stdout}`);
    if (error.stderr) log(`⚠️ Error detallado: ${error.stderr}`);
    throw error;
  }
}

/**
 * Función para hacer peticiones HTTP/HTTPS
 * @param {string} url URL a la que hacer la petición
 * @returns {Promise<Object>} Respuesta de la petición
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: jsonData });
        } catch (error) {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

/**
 * Regenera las páginas estáticas utilizando la API de revalidación de Next.js
 */
async function regenerateStaticPages() {
  log('🔄 Iniciando regeneración de páginas estáticas');
  
  try {
    // Páginas a regenerar (hardcoded para simplificar)
    const pagesToRegenerate = [
      '/', // Página principal
      '/news', // Página de listado de noticias (si existe)
      '/news/articulo-de-prueba', // Ejemplo de artículo
    ];
    
    log(`🔍 Se regenerarán ${pagesToRegenerate.length} páginas estáticas`);
    
    // Regenerar cada página
    for (const path of pagesToRegenerate) {
      try {
        log(`🔄 Regenerando página: ${path}`);
        
        // Llamar al endpoint de revalidación
        const revalidationSecret = process.env.REVALIDATION_SECRET || 'test-secret';
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const revalidateUrl = `${baseUrl}/api/revalidate?path=${encodeURIComponent(path)}&secret=${revalidationSecret}`;
        
        log(`💬 Llamando al endpoint de revalidación: ${revalidateUrl}`);
        
        const response = await fetchUrl(revalidateUrl);
        
        if (response.ok && response.data.revalidated) {
          log(`✅ Página regenerada correctamente: ${path}`);
        } else {
          log(`⚠️ Error al regenerar página ${path}: ${JSON.stringify(response.data)}`);
        }
      } catch (error) {
        log(`❌ Error al regenerar página ${path}: ${error.message}`);
      }
    }
    
    log('✅ Proceso de regeneración de páginas completado');
  } catch (error) {
    log(`❌ Error en la regeneración de páginas: ${error.message}`);
  }
}

/**
 * Función principal que ejecuta el proceso de despliegue
 */
async function deploy() {
  log('🚀 Iniciando proceso de despliegue');
  
  try {
    // 1. Regenerar páginas estáticas
    await regenerateStaticPages();
    
    // 2. Construir la aplicación para generar archivos HTML estáticos
    log('🔨 Iniciando construcción de archivos estáticos...');
    // Asegurarnos de que NODE_ENV sea production para generar archivos estáticos
    await runCommand('NODE_ENV=production npm run build', 'Construcción de la aplicación');
    
    // Verificar que se hayan generado los archivos HTML estáticos
    const outDir = path.join(process.cwd(), 'out');
    if (!fs.existsSync(outDir)) {
      throw new Error('No se encontró el directorio "out" con los archivos estáticos');
    }
    
    // Verificar que existan archivos HTML en el directorio de salida
    const htmlFiles = findHtmlFiles(outDir);
    log(`📄 Se encontraron ${htmlFiles.length} archivos HTML estáticos generados`);
    
    // 3. Subir archivos a S3
    log('📤 Iniciando subida de archivos estáticos a S3...');
    await runCommand('node scripts/upload-to-s3.js', 'Subida a S3');
    
    log('✅ Proceso de despliegue completado con éxito');
  } catch (error) {
    log(`❌ Error en el proceso de despliegue: ${error.message}`);
  }
}

/**
 * Encuentra todos los archivos HTML en un directorio y sus subdirectorios
 * @param {string} directory Directorio a buscar
 * @returns {Array<string>} Lista de rutas de archivos HTML
 */
function findHtmlFiles(directory) {
  const htmlFiles = [];
  
  function searchDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        searchDirectory(filePath);
      } else if (file.endsWith('.html')) {
        htmlFiles.push(filePath);
      }
    }
  }
  
  searchDirectory(directory);
  return htmlFiles;
}

// Iniciar el despliegue
deploy();
