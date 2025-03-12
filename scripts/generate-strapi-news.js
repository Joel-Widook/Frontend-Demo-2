/**
 * Script para generar archivos estáticos de noticias reales de Strapi y subirlos a S3
 */

// Cargar variables de entorno desde el archivo .env
require('dotenv').config();

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const http = require('http');
const https = require('https');

// Promisificar exec con opciones personalizadas
const execPromise = (cmd, options = {}) => {
  return util.promisify(exec)(cmd, options);
};

// Configuración de logs
const LOG_FILE = path.join(process.cwd(), 'strapi-news-logs.txt');

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
    // Aumentar el tamaño del buffer para evitar errores de maxBuffer
    const { stdout, stderr } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
    
    if (stdout) {
      // Limitar la salida mostrada para evitar logs excesivos
      const maxOutputLength = 2000;
      const truncatedOutput = stdout.length > maxOutputLength 
        ? stdout.substring(0, maxOutputLength) + '\n... (salida truncada, demasiado larga)'
        : stdout;
      
      log(`📝 Salida de ${name}:\n${truncatedOutput}`);
    }
    
    if (stderr) {
      // Limitar la salida de errores mostrada
      const maxErrorLength = 1000;
      const truncatedError = stderr.length > maxErrorLength
        ? stderr.substring(0, maxErrorLength) + '\n... (errores truncados, demasiado largos)'
        : stderr;
      
      log(`⚠️ Errores de ${name}:\n${truncatedError}`);
    }
    
    log(`✅ Completado: ${name}`);
    return { stdout, stderr };
  } catch (error) {
    log(`❌ Error en ${name}: ${error.message}`);
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
    
    client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (e) {
          reject(new Error(`Error al parsear la respuesta: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Crea un archivo HTML para un artículo
 * @param {Object} article Artículo de Strapi
 * @param {string} outputDir Directorio de salida
 */
function createArticleHtml(article, outputDir) {
  // Imprimir información detallada del artículo para depuración
  log(`📋 Procesando artículo: ${JSON.stringify(article).substring(0, 200)}...`);
  log(`🔑 Propiedades del artículo: ${Object.keys(article).join(', ')}`);
  
  if (!article.slug) {
    log(`⚠️ Artículo sin slug, ignorando: ${JSON.stringify(article.id)}`);
    return;
  }
  
  log(`🔍 Procesando artículo con slug: ${article.slug}`);
  
  const slug = article.slug;
  const title = article.title || 'Artículo sin título';
  const content = article.content || '<p>Sin contenido</p>';
  const publishedAt = article.publishedAt 
    ? new Date(article.publishedAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    : 'Fecha desconocida';
  
  // Crear directorio para el artículo
  const articleDir = path.join(outputDir, 'news', slug);
  fs.mkdirSync(articleDir, { recursive: true });
  
  // Crear archivo HTML
  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Noticias</title>
  <link rel="stylesheet" href="/_next/static/css/styles.css">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${article.description || 'Artículo de noticias'}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${process.env.NEXT_PUBLIC_SITE_URL || ''}/news/${slug}">
  <meta name="twitter:card" content="summary_large_image">
</head>
<body>
  <header>
    <nav>
      <a href="/">Inicio</a>
      <a href="/news">Noticias</a>
    </nav>
    <h1>${title}</h1>
    <p>Fecha de publicación: ${publishedAt}</p>
  </header>
  <main>
    <article>
      ${content}
    </article>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} - Widook</p>
  </footer>
  <script src="/_next/static/js/main.js"></script>
</body>
</html>
  `;
  
  fs.writeFileSync(path.join(articleDir, 'index.html'), htmlContent);
  log(`✅ Generado HTML para artículo: ${slug}`);
}

/**
 * Crea los archivos estáticos necesarios (CSS, JS)
 * @param {string} outputDir Directorio de salida
 */
function createStaticFiles(outputDir) {
  // Crear directorios para archivos estáticos
  const staticDir = path.join(outputDir, '_next', 'static');
  const cssDir = path.join(staticDir, 'css');
  const jsDir = path.join(staticDir, 'js');
  
  fs.mkdirSync(cssDir, { recursive: true });
  fs.mkdirSync(jsDir, { recursive: true });
  
  // Crear archivo CSS
  const cssContent = `
/* Estilos básicos para las noticias */
body {
  font-family: 'Arial', sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

header {
  border-bottom: 1px solid #eee;
  padding-bottom: 20px;
  margin-bottom: 20px;
}

nav {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

nav a {
  color: #0066cc;
  text-decoration: none;
}

nav a:hover {
  text-decoration: underline;
}

h1 {
  color: #0066cc;
  margin-bottom: 10px;
}

article {
  margin-bottom: 30px;
}

article img {
  max-width: 100%;
  height: auto;
  margin: 20px 0;
  border-radius: 5px;
}

footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  font-size: 0.9em;
  color: #666;
}
  `;
  
  fs.writeFileSync(path.join(cssDir, 'styles.css'), cssContent);
  
  // Crear archivo JS
  const jsContent = `
// Script principal para las noticias
document.addEventListener('DOMContentLoaded', function() {
  console.log('Página de noticias cargada correctamente');
  
  // Agregar interactividad a las imágenes
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('click', function() {
      this.classList.toggle('expanded');
    });
  });
});
  `;
  
  fs.writeFileSync(path.join(jsDir, 'main.js'), jsContent);
  
  log('✅ Archivos estáticos creados correctamente');
}

/**
 * Función principal que ejecuta el proceso de generación y subida
 */
async function main() {
  log('🚀 Iniciando proceso de generación y subida de noticias de Strapi a S3');
  
  try {
    // 1. Crear directorio de salida
    const outDir = path.join(process.cwd(), 'out');
    fs.mkdirSync(outDir, { recursive: true });
    
    // 2. Obtener artículos de Strapi
    log('📰 Obteniendo artículos de Strapi...');
    const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';
    const articlesUrl = `${strapiUrl}/api/articles?populate=*`;
    
    log(`🔗 URL de Strapi: ${articlesUrl}`);
    
    try {
      const articlesData = await fetchUrl(articlesUrl);
      
      // Imprimir la estructura de datos para depuración
      log('📝 Estructura de datos recibida de Strapi:');
      log(JSON.stringify(articlesData, null, 2).substring(0, 1000) + '...');
      
      // Imprimir información sobre el primer artículo para depuración
      if (articlesData && articlesData.data && articlesData.data.length > 0) {
        const firstArticle = articlesData.data[0];
        log('🔍 Estructura del primer artículo:');
        log(JSON.stringify(firstArticle, null, 2));
        log(`🔑 Propiedades del primer artículo: ${Object.keys(firstArticle).join(', ')}`);
      }
      
      if (articlesData && articlesData.data && Array.isArray(articlesData.data)) {
        const articles = articlesData.data;
        log(`📊 Se encontraron ${articles.length} artículos en Strapi`);
        
        // 3. Crear archivos estáticos necesarios
        log('🎨 Creando archivos estáticos necesarios...');
        createStaticFiles(outDir);
        
        // 4. Generar HTML para cada artículo
        for (const article of articles) {
          createArticleHtml(article, outDir);
        }
        
        // 5. Subir archivos a S3
        log('📤 Iniciando subida de archivos estáticos a S3...');
        await runCommand('UPLOAD_DIR="./out" node scripts/upload-to-s3.js', 'Subida a S3');
        
        log('✅ Proceso de generación y subida completado con éxito');
      } else {
        log('⚠️ No se encontraron artículos en la respuesta de Strapi');
      }
    } catch (error) {
      log(`❌ Error al obtener artículos de Strapi: ${error.message}`);
      throw error;
    }
  } catch (error) {
    log(`❌ Error en el proceso de generación y subida: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();
