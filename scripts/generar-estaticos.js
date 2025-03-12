/**
 * Script para generar archivos HTML estáticos para S3
 * Este script crea archivos HTML para todas las rutas estáticas
 * incluyendo la página principal y las páginas de artículos
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const LOG_FILE = path.join(process.cwd(), 'estaticos-logs.txt');
const OUT_DIR = path.join(process.cwd(), 'out');

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
function crearDirectorio(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`📁 Creado directorio: ${dir}`);
  }
}

/**
 * Crea un archivo HTML para una ruta específica
 * @param {string} ruta Ruta para la que crear el archivo HTML
 * @param {string} titulo Título de la página
 */
function crearArchivoHTML(ruta, titulo) {
  const rutaCompleta = path.join(OUT_DIR, ruta);
  const directorioRuta = path.dirname(rutaCompleta);
  
  // Crear el directorio si no existe
  crearDirectorio(directorioRuta);
  
  // Contenido HTML básico
  const contenidoHTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <link rel="stylesheet" href="/_next/static/css/app.css">
  <script src="/_next/static/chunks/webpack.js" defer></script>
  <script src="/_next/static/chunks/main.js" defer></script>
</head>
<body>
  <div id="__next">
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h1>${titulo}</h1>
      <p>Esta página se cargará con JavaScript cuando se abra en el navegador.</p>
      <div id="contenido-dinamico">Cargando contenido...</div>
    </div>
  </div>
</body>
</html>`;
  
  // Escribir el archivo HTML
  const nombreArchivo = ruta.endsWith('/') ? `${rutaCompleta}index.html` : `${rutaCompleta}.html`;
  fs.writeFileSync(nombreArchivo, contenidoHTML);
  log(`📄 Creado archivo HTML: ${nombreArchivo}`);
}

/**
 * Copia un directorio recursivamente
 * @param {string} origen Directorio de origen
 * @param {string} destino Directorio de destino
 */
function copiarDirectorio(origen, destino) {
  crearDirectorio(destino);
  
  const archivos = fs.readdirSync(origen);
  
  for (const archivo of archivos) {
    const rutaOrigen = path.join(origen, archivo);
    const rutaDestino = path.join(destino, archivo);
    
    const stats = fs.statSync(rutaOrigen);
    
    if (stats.isDirectory()) {
      copiarDirectorio(rutaOrigen, rutaDestino);
    } else {
      fs.copyFileSync(rutaOrigen, rutaDestino);
      log(`📄 Copiado: ${rutaOrigen} -> ${rutaDestino}`);
    }
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    log('🚀 Iniciando generación de archivos estáticos para S3...');
    
    // Limpiar el directorio de salida si existe
    if (fs.existsSync(OUT_DIR)) {
      log('🗑️ Limpiando directorio de salida existente...');
      fs.rmSync(OUT_DIR, { recursive: true, force: true });
    }
    
    // Crear el directorio de salida
    crearDirectorio(OUT_DIR);
    
    // Primero, compilar la aplicación para asegurarnos de tener los archivos estáticos más recientes
    log('🏗️ Compilando la aplicación...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Copiar archivos estáticos de .next/static a out/_next/static
    log('📦 Copiando archivos estáticos...');
    copiarDirectorio(path.join(process.cwd(), '.next', 'static'), path.join(OUT_DIR, '_next', 'static'));
    
    // Crear archivos HTML para las rutas estáticas
    log('📝 Creando archivos HTML para las rutas estáticas...');
    
    // Página principal
    crearArchivoHTML('/', 'Página Principal - Frontend Demo');
    
    // Obtener lista de artículos desde el archivo de rutas
    try {
      // Ejecutar un comando para obtener los slugs de los artículos
      log('🔍 Buscando artículos generados...');
      
      // Crear directorio para noticias
      crearDirectorio(path.join(OUT_DIR, 'news'));
      
      // Lista de artículos (hardcodeada para demostración)
      const articulos = [
        'a-bug-is-becoming-a-meme-on-the-internet',
        'beautiful-picture',
        'the-internet-s-own-boy',
        'what-s-inside-a-black-hole',
        'why-the-web-is-turning-purple',
        'this-shrimp-is-awesome',
        'my-first-article',
        'say-hello-to-html-elements',
        'my-biggest-adventure',
        'exploring-the-sahara',
        'japan-travel-guide',
        'the-rise-of-blockchain-technology',
        'how-to-use-apis-with-javascript',
        'the-future-of-artificial-intelligence',
        'understanding-seo-for-beginners',
        'the-best-frameworks-for-frontend-development',
        'getting-started-with-react'
      ];
      
      // Crear un archivo HTML para cada artículo
      for (const slug of articulos) {
        const rutaArticulo = `news/${slug}`;
        crearArchivoHTML(rutaArticulo, `Artículo: ${slug.replace(/-/g, ' ')}`);
      }
      
      log(`✅ Creados ${articulos.length} archivos HTML para artículos`);
    } catch (error) {
      log(`⚠️ No se pudieron obtener los artículos: ${error.message}`);
    }
    
    log('✅ Archivos estáticos generados exitosamente en la carpeta out');
    log(`📊 Total de archivos HTML generados: ${fs.readdirSync(OUT_DIR, { recursive: true }).filter(f => f.endsWith('.html')).length}`);
    log('📊 Puedes usar el script upload-to-s3.js para subir estos archivos a S3');
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();
