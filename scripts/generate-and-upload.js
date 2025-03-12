/**
 * Script para generar archivos estáticos de noticias y subirlos a S3
 * Este script evita los problemas de linting durante la construcción
 */

// Cargar variables de entorno desde el archivo .env
require('dotenv').config();

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

// Configuración de logs
const LOG_FILE = path.join(process.cwd(), 'generate-upload-logs.txt');

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
    return { stdout, stderr };
  } catch (error) {
    log(`❌ Error en ${name}: ${error.message}`);
    throw error;
  }
}

/**
 * Encuentra todos los archivos HTML en un directorio y sus subdirectorios
 * @param {string} directory Directorio a buscar
 * @returns {Array<string>} Lista de rutas de archivos HTML
 */
function findHtmlFiles(directory) {
  const results = [];
  
  function traverse(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        traverse(filePath);
      } else if (file.endsWith('.html')) {
        results.push(filePath);
      }
    }
  }
  
  traverse(directory);
  return results;
}

/**
 * Función principal que ejecuta el proceso de generación y subida
 */
async function main() {
  log('🚀 Iniciando proceso de generación y subida de noticias a S3');
  
  try {
    // 1. Crear directorio de prueba para noticias
    const testDir = path.join(process.cwd(), 'out');
    const newsDir = path.join(testDir, 'news');
    
    // Asegurarnos de que el directorio existe
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    if (!fs.existsSync(newsDir)) {
      fs.mkdirSync(newsDir, { recursive: true });
    }
    
    // 2. Obtener noticias de Strapi
    log('📰 Obteniendo noticias de Strapi...');
    const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';
    
    try {
      // Intentar obtener las noticias de Strapi
      await runCommand(`curl -s "${strapiUrl}/api/articles?populate=*" > strapi-articles.json`, 'Obtener noticias de Strapi');
      
      // Verificar si se obtuvo correctamente la respuesta
      if (fs.existsSync('strapi-articles.json')) {
        const articlesData = JSON.parse(fs.readFileSync('strapi-articles.json', 'utf8'));
        
        if (articlesData && articlesData.data && Array.isArray(articlesData.data)) {
          log(`📊 Se encontraron ${articlesData.data.length} artículos en Strapi`);
          
          // Crear directorios y archivos HTML para cada artículo
          for (const article of articlesData.data) {
            const slug = article.attributes.slug;
            const title = article.attributes.title;
            const content = article.attributes.content;
            
            if (slug) {
              const articleDir = path.join(newsDir, slug);
              
              if (!fs.existsSync(articleDir)) {
                fs.mkdirSync(articleDir, { recursive: true });
              }
              
              // Crear archivo HTML básico para el artículo
              const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Artículo de noticias'}</title>
  <link rel="stylesheet" href="/_next/static/css/styles.css">
</head>
<body>
  <header>
    <h1>${title || 'Artículo de noticias'}</h1>
  </header>
  <main>
    <article>
      ${content || '<p>Contenido del artículo</p>'}
    </article>
  </main>
  <footer>
    <p>&copy; 2025 - Widook</p>
  </footer>
  <script src="/_next/static/js/main.js"></script>
</body>
</html>
              `;
              
              fs.writeFileSync(path.join(articleDir, 'index.html'), htmlContent);
              log(`✅ Generado HTML para artículo: ${slug}`);
            }
          }
        } else {
          log('⚠️ No se encontraron artículos en la respuesta de Strapi');
        }
      }
    } catch (error) {
      log(`⚠️ Error al obtener noticias de Strapi: ${error.message}`);
      log('⚠️ Continuando con archivos de prueba...');
    }
    
    // 3. Crear archivos estáticos necesarios (CSS, JS)
    log('🎨 Creando archivos estáticos necesarios...');
    
    // Crear directorios para archivos estáticos
    const staticDir = path.join(testDir, '_next', 'static');
    const cssDir = path.join(staticDir, 'css');
    const jsDir = path.join(staticDir, 'js');
    const imagesDir = path.join(staticDir, 'images');
    
    fs.mkdirSync(cssDir, { recursive: true });
    fs.mkdirSync(jsDir, { recursive: true });
    fs.mkdirSync(imagesDir, { recursive: true });
    
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

h1 {
  color: #0066cc;
  margin-bottom: 10px;
}

article {
  margin-bottom: 30px;
}

img {
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
  
  // Agregar interactividad a las imágenes (si existen)
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('click', function() {
      this.classList.toggle('expanded');
    });
  });
});
    `;
    
    fs.writeFileSync(path.join(jsDir, 'main.js'), jsContent);
    
    // Crear una imagen de prueba
    fs.writeFileSync(path.join(imagesDir, 'test-image.jpg'), '');
    
    // 4. Verificar los archivos HTML generados
    const htmlFiles = findHtmlFiles(testDir);
    log(`📄 Se encontraron ${htmlFiles.length} archivos HTML estáticos generados`);
    
    // 5. Subir archivos a S3
    log('📤 Iniciando subida de archivos estáticos a S3...');
    await runCommand('node scripts/upload-to-s3.js', 'Subida a S3');
    
    log('✅ Proceso de generación y subida completado con éxito');
  } catch (error) {
    log(`❌ Error en el proceso de generación y subida: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();
