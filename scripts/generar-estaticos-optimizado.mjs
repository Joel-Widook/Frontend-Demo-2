/**
 * Script optimizado para generar archivos HTML estáticos para S3
 * Este script utiliza la estructura generada por Next.js para crear
 * archivos HTML estáticos que pueden ser desplegados en S3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import { createServer } from 'http';
import { createReadStream } from 'fs';
import { parse as parseUrl } from 'url';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const nextDir = path.join(rootDir, '.next');
const outDir = path.join(rootDir, 'out');
const LOG_FILE = path.join(rootDir, 'estaticos-logs.txt');

// Configuración del servidor temporal
const TEMP_SERVER_PORT = 3123;
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

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
 * Obtiene las rutas de los artículos generados por Next.js
 * @returns {Promise<Array<string>>} Lista de slugs de artículos
 */
async function obtenerRutasArticulos() {
  // Lista predefinida de artículos como respaldo
  const articulosPredefinidos = [
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
    'getting-started-with-react',
    'prueba-estaticos' // Añadimos el nuevo artículo manualmente
  ];
  
  // Primero intentamos obtener los artículos directamente desde Strapi
  try {
    const headers = {};
    if (STRAPI_API_TOKEN) {
      headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
    }
    
    const strapiUrl = `${STRAPI_URL}/api/articles?pagination[limit]=100`;
    log(`💾 Obteniendo lista de artículos desde Strapi: ${strapiUrl}`);
    
    const strapiRes = await fetch(strapiUrl, { headers });
    log(`📊 Respuesta de Strapi: ${strapiRes.status} ${strapiRes.statusText}`);
    
    if (strapiRes.ok) {
      const data = await strapiRes.json();
      log(`📊 Datos recibidos de Strapi: ${JSON.stringify(data.meta)}`);
      
      if (data.data && data.data.length > 0) {
        const slugs = data.data.map(articulo => articulo.attributes.slug);
        log(`📊 Obtenidos ${slugs.length} artículos desde Strapi`);
        log(`📊 Slugs obtenidos: ${JSON.stringify(slugs)}`);
        return slugs;
      } else {
        log(`⚠️ No se encontraron artículos en Strapi`);
      }
    } else {
      log(`⚠️ Error al obtener artículos desde Strapi: ${strapiRes.status} ${strapiRes.statusText}`);
    }
  } catch (error) {
    log(`⚠️ Error al obtener artículos desde Strapi: ${error.message}`);
  }
  
  // Si no podemos obtener los artículos desde Strapi, intentamos con el manifiesto de Next.js
  try {
    // Intentar leer el archivo de manifiesto de rutas de Next.js
    const rutasManifesto = path.join(nextDir, 'app-path-routes-manifest.json');
    if (fs.existsSync(rutasManifesto)) {
      const manifesto = JSON.parse(fs.readFileSync(rutasManifesto, 'utf8'));
      log(`📊 Rutas encontradas en el manifiesto: ${Object.keys(manifesto).length}`);
      
      // Filtrar las rutas de artículos
      const rutasArticulos = Object.values(manifesto)
        .filter(ruta => ruta.startsWith('/news/') && ruta !== '/news/[slug]')
        .map(ruta => ruta.replace('/news/', ''));
      
      if (rutasArticulos.length > 0) {
        log(`📊 Rutas de artículos encontradas en el manifiesto: ${rutasArticulos.length}`);
        return rutasArticulos;
      }
    }
    
    // Si no encontramos rutas en el manifiesto, intentar leer del servidor
    const serverDir = path.join(nextDir, 'server', 'app', 'news', '[slug]');
    if (fs.existsSync(serverDir)) {
      log(`📊 Buscando artículos en el directorio del servidor...`);
      
      // Intentar leer el archivo page.js para extraer los slugs
      const pageFile = path.join(serverDir, 'page.js');
      if (fs.existsSync(pageFile)) {
        const pageContent = fs.readFileSync(pageFile, 'utf8');
        
        // Buscar los slugs en el contenido del archivo
        const slugMatches = pageContent.match(/"slug":"([^"]+)"/g) || [];
        const slugs = slugMatches
          .map(match => match.replace('"slug":"', '').replace('"', ''))
          .filter(slug => slug && slug !== '[slug]');
        
        if (slugs.length > 0) {
          log(`📊 Rutas de artículos encontradas en el código: ${slugs.length}`);
          return slugs;
        }
      }
    }
  } catch (error) {
    log(`⚠️ Error al obtener rutas de artículos: ${error.message}`);
  }
  
  // Usar la lista predefinida de artículos como último recurso
  log(`📊 Usando lista predefinida de artículos: ${articulosPredefinidos.length} artículos`);
  return articulosPredefinidos;
}

/**
 * Inicia un servidor HTTP temporal para renderizar las páginas
 * @returns {Promise<Object>} Servidor HTTP
 */
async function iniciarServidorTemporal() {
  return new Promise((resolve) => {
    const servidor = createServer((req, res) => {
      const { pathname } = parseUrl(req.url, true);
      
      // Servir archivos estáticos de .next
      if (pathname.startsWith('/_next/')) {
        const filePath = path.join(nextDir, pathname.replace('/_next/', '/static/'));
        if (fs.existsSync(filePath)) {
          const stream = createReadStream(filePath);
          stream.pipe(res);
          return;
        }
      }
      
      // Servir archivos de páginas desde .next/server/app
      const appPath = path.join(nextDir, 'server/app', pathname === '/' ? 'page.js' : `${pathname}/page.js`);
      if (fs.existsSync(appPath)) {
        res.setHeader('Content-Type', 'text/html');
        res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Rendering ${pathname}</title>
</head>
<body>
  <div id="__next">${pathname}</div>
</body>
</html>`);
        return;
      }
      
      res.statusCode = 404;
      res.end('Not found');
    });
    
    servidor.listen(TEMP_SERVER_PORT, () => {
      log(`🚀 Servidor temporal iniciado en puerto ${TEMP_SERVER_PORT}`);
      resolve(servidor);
    });
  });
}

/**
 * Obtiene el contenido HTML de una página
 * @param {string} ruta Ruta de la página
 * @returns {Promise<string>} Contenido HTML
 */
async function obtenerContenidoHTML(ruta) {
  try {
    // Si es una ruta de artículo, obtenemos el contenido directamente desde Strapi
    if (ruta.startsWith('/news/')) {
      const slug = ruta.replace('/news/', '');
      log(`🔍 Obteniendo artículo con slug: ${slug}`);
      
      // Configurar headers para la API de Strapi
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (STRAPI_API_TOKEN) {
        headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
      }
      
      const strapiUrl = `${STRAPI_URL}/api/articles?filters[slug][$eq]=${slug}&populate=*`;
      log(`💾 Consultando API de Strapi: ${strapiUrl}`);
      
      const strapiRes = await fetch(strapiUrl, { headers });
      
      if (!strapiRes.ok) {
        log(`⚠️ Error en la respuesta de Strapi: ${strapiRes.status} ${strapiRes.statusText}`);
        return generarHTMLBasico(ruta);
      }
      
      const data = await strapiRes.json();
      log(`📊 Datos recibidos de Strapi: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
      
      if (data.data && data.data.length > 0) {
        const articulo = data.data[0].attributes;
        log(`✅ Artículo encontrado: ${articulo.title}`);
        return generarHTMLArticulo(articulo);
      } else {
        log(`⚠️ No se encontró el artículo con slug: ${slug}`);
        // Generar contenido de ejemplo basado en el slug
        const tituloGenerado = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const articuloGenerado = {
          title: tituloGenerado,
          content: `<h2>Acerca de ${tituloGenerado}</h2>
<p>Este es un contenido de ejemplo generado automáticamente para el artículo "${tituloGenerado}". Este contenido se muestra porque el artículo no se encontró en la base de datos de Strapi.</p>
<p>En un entorno de producción, este contenido sería reemplazado por el contenido real del artículo obtenido desde Strapi CMS.</p>
<h3>Características principales</h3>
<ul>
  <li>Contenido dinámico desde Strapi CMS</li>
  <li>Generación automática de archivos HTML estáticos</li>
  <li>Despliegue automático mediante webhooks</li>
  <li>Optimización para SEO</li>
</ul>
<p>Este sistema permite mantener un sitio web estático que se actualiza automáticamente cuando se publican nuevos contenidos en el CMS.</p>`,
          publishedAt: new Date().toISOString(),
          image: null
        };
        return generarHTMLArticulo(articuloGenerado);
      }
    } else if (ruta === '/') {
      // Para la página principal, generamos un HTML con la lista de artículos
      try {
        const headers = {};
        if (STRAPI_API_TOKEN) {
          headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
        }
        
        const strapiUrl = `${STRAPI_URL}/api/articles?sort=publishedAt:desc&pagination[limit]=10&populate=*`;
        log(`💾 Obteniendo lista de artículos desde Strapi: ${strapiUrl}`);
        
        const strapiRes = await fetch(strapiUrl, { headers });
        if (strapiRes.ok) {
          const data = await strapiRes.json();
          if (data.data && data.data.length > 0) {
            return generarHTMLPaginaPrincipal(data.data);
          }
        }
      } catch (error) {
        log(`⚠️ Error al obtener artículos para la página principal: ${error.message}`);
      }
    }
    
    // Si todo falla, intentamos obtener el HTML desde el servidor temporal
    const url = `http://localhost:${TEMP_SERVER_PORT}${ruta}`;
    log(`💾 Intentando obtener contenido desde servidor temporal: ${url}`);
    
    try {
      const respuesta = await fetch(url);
      if (respuesta.ok) {
        return await respuesta.text();
      }
    } catch (error) {
      log(`⚠️ Error al obtener contenido del servidor temporal: ${error.message}`);
    }
    
    // Si todo falla, devolvemos un HTML básico
    return generarHTMLBasico(ruta);
  } catch (error) {
    log(`⚠️ Error al obtener contenido HTML: ${error.message}`);
    return generarHTMLBasico(ruta);
  }
}

/**
 * Genera HTML para un artículo desde Strapi
 * @param {Object} articulo Datos del artículo
 * @returns {string} HTML generado
 */
function generarHTMLArticulo(articulo) {
  // Verificar que el artículo tenga las propiedades necesarias
  if (!articulo) {
    log(`⚠️ Error: Artículo no definido`);
    articulo = {
      title: 'Artículo no encontrado',
      content: 'Este artículo no existe o no está disponible.',
      publishedAt: new Date().toISOString()
    };
  }
  
  // Obtener datos del artículo con valores por defecto
  const titulo = articulo.title || 'Artículo sin título';
  
  // Intentar obtener el contenido del artículo de diferentes propiedades posibles
  let contenido = '';
  try {
    // Verificar diferentes propiedades donde podría estar el contenido
    if (articulo.content) {
      contenido = articulo.content;
      log(`✅ Contenido encontrado en propiedad 'content'`);
    } else if (articulo.blocks && Array.isArray(articulo.blocks) && articulo.blocks.length > 0) {
      // Procesar bloques de contenido si existen
      log(`✅ Contenido encontrado en propiedad 'blocks' (${articulo.blocks.length} bloques)`);
      contenido = articulo.blocks.map(bloque => {
        if (bloque.type === 'paragraph') {
          return `<p>${bloque.text || bloque.content || ''}</p>`;
        } else if (bloque.type === 'heading') {
          const nivel = bloque.level || 2;
          return `<h${nivel}>${bloque.text || bloque.content || ''}</h${nivel}>`;
        } else if (bloque.type === 'image' && bloque.url) {
          return `<img src="${bloque.url}" alt="${bloque.alt || ''}" class="imagen-contenido">`;
        } else if (bloque.type === 'list' && Array.isArray(bloque.items)) {
          const items = bloque.items.map(item => `<li>${item}</li>`).join('');
          return bloque.format === 'ordered' ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
        } else {
          // Para otros tipos de bloques, intentar extraer texto o contenido
          return bloque.text || bloque.content || bloque.html || '';
        }
      }).join('\n');
    } else if (articulo.description) {
      // Si no hay contenido ni bloques, usar la descripción como contenido
      contenido = `<p>${articulo.description}</p>`;
      log(`✅ Usando descripción como contenido`);
    } else {
      contenido = 'Este artículo no tiene contenido.';
      log(`⚠️ No se encontró contenido en el artículo`);
    }
  } catch (error) {
    log(`⚠️ Error al procesar el contenido del artículo: ${error.message}`);
    contenido = `<p>Error al cargar el contenido: ${error.message}</p>`;
  }
  
  // Intentar obtener la imagen del artículo de diferentes propiedades posibles
  let imagen = '';
  try {
    // Verificar si hay imagen en la propiedad 'image'
    if (articulo.image && articulo.image.data && articulo.image.data.attributes) {
      imagen = articulo.image.data.attributes.url;
      log(`✅ Imagen encontrada en propiedad 'image'`);
    } 
    // Verificar si hay imagen en la propiedad 'cover'
    else if (articulo.cover && articulo.cover.url) {
      imagen = articulo.cover.url;
      log(`✅ Imagen encontrada en propiedad 'cover'`);
    }
    // Verificar si hay imagen en la propiedad 'cover' con estructura anidada
    else if (articulo.cover && articulo.cover.data && articulo.cover.data.attributes) {
      imagen = articulo.cover.data.attributes.url;
      log(`✅ Imagen encontrada en propiedad 'cover.data.attributes'`);
    }
    
    // Si la URL no comienza con http, añadimos la URL base de Strapi
    if (imagen && !imagen.startsWith('http')) {
      imagen = `${STRAPI_URL}${imagen}`;
      log(`✅ URL de imagen completa: ${imagen}`);
    }
  } catch (error) {
    log(`⚠️ Error al procesar la imagen del artículo: ${error.message}`);
    imagen = '';
  }
  
  // Formatear la fecha de publicación si existe
  let fechaPublicacion = '';
  try {
    if (articulo.publishedAt) {
      const fecha = new Date(articulo.publishedAt);
      fechaPublicacion = fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      log(`✅ Fecha de publicación formateada: ${fechaPublicacion}`);
    }
  } catch (error) {
    log(`⚠️ Error al procesar la fecha de publicación: ${error.message}`);
    fechaPublicacion = '';
  }
  
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <link rel="stylesheet" href="/_next/static/css/app.css">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9f9f9;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      border-radius: 5px;
    }
    h1 {
      color: #2c3e50;
      margin-top: 0;
    }
    .fecha {
      color: #7f8c8d;
      font-style: italic;
      margin-bottom: 20px;
    }
    .imagen {
      max-width: 100%;
      height: auto;
      margin-bottom: 20px;
      border-radius: 5px;
    }
    .contenido {
      margin-bottom: 30px;
    }
    .volver {
      display: inline-block;
      background-color: #3498db;
      color: white;
      padding: 10px 15px;
      text-decoration: none;
      border-radius: 4px;
      transition: background-color 0.3s;
    }
    .volver:hover {
      background-color: #2980b9;
    }
  </style>
</head>
<body>
  <div id="__next">
    <div class="container">
      <h1>${titulo}</h1>
      ${fechaPublicacion ? `<div class="fecha">Publicado el ${fechaPublicacion}</div>` : ''}
      ${imagen ? `<img class="imagen" src="${imagen}" alt="${titulo}">` : ''}
      <div class="contenido">${contenido}</div>
      <a class="volver" href="/">Volver a la página principal</a>
    </div>
  </div>
  <script src="/_next/static/chunks/webpack.js" defer></script>
  <script src="/_next/static/chunks/main.js" defer></script>
</body>
</html>`;
}

/**
 * Genera HTML básico para una ruta
 * @param {string} ruta Ruta de la página
 * @returns {string} HTML generado
 */
function generarHTMLBasico(ruta) {
  const titulo = ruta === '/' ? 'Página Principal' : `Página: ${ruta.replace(/\//g, ' ').replace(/-/g, ' ')}`;
  
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <link rel="stylesheet" href="/_next/static/css/app.css">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9f9f9;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      border-radius: 5px;
    }
    h1 {
      color: #2c3e50;
      margin-top: 0;
    }
    .volver {
      display: inline-block;
      background-color: #3498db;
      color: white;
      padding: 10px 15px;
      text-decoration: none;
      border-radius: 4px;
      margin-top: 20px;
      transition: background-color 0.3s;
    }
    .volver:hover {
      background-color: #2980b9;
    }
  </style>
</head>
<body>
  <div id="__next">
    <div class="container">
      <h1>${titulo}</h1>
      <p>Esta página se cargará con JavaScript cuando se abra en el navegador.</p>
      <div id="contenido-dinamico">Cargando contenido...</div>
      ${ruta !== '/' ? '<a class="volver" href="/">Volver a la página principal</a>' : ''}
    </div>
  </div>
  <script src="/_next/static/chunks/webpack.js" defer></script>
  <script src="/_next/static/chunks/main.js" defer></script>
</body>
</html>`;
}

/**
 * Genera HTML para la página principal con lista de artículos
 * @param {Array} articulos Lista de artículos desde Strapi
 * @returns {string} HTML generado
 */
function generarHTMLPaginaPrincipal(articulos) {
  // Verificar que articulos sea un array válido
  if (!Array.isArray(articulos) || articulos.length === 0) {
    return generarHTMLBasico('/', 'Frontend Demo - Sin Artículos');
  }
  
  const articulosHTML = articulos.map(articulo => {
    // Verificar que el artículo tenga la estructura esperada
    if (!articulo || !articulo.attributes) {
      console.error('Artículo con formato incorrecto:', articulo);
      return '';
    }
    
    const attr = articulo.attributes;
    const titulo = attr.title || 'Artículo sin título';
    const descripcion = attr.description || '';
    const slug = attr.slug || '';
    let imagen = '';
    
    if (attr.image && attr.image.data && attr.image.data.attributes) {
      imagen = attr.image.data.attributes.url;
      if (imagen && !imagen.startsWith('http')) {
        imagen = `${STRAPI_URL}${imagen}`;
      }
    }
    
    // Formatear la fecha de publicación
    let fechaPublicacion = '';
    if (attr.publishedAt) {
      const fecha = new Date(attr.publishedAt);
      fechaPublicacion = fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    return `
    <div class="articulo">
      ${imagen ? `<img class="articulo-imagen" src="${imagen}" alt="${titulo}">` : ''}
      <div class="articulo-contenido">
        <h2 class="articulo-titulo"><a href="/news/${slug}">${titulo}</a></h2>
        ${fechaPublicacion ? `<div class="articulo-fecha">Publicado el ${fechaPublicacion}</div>` : ''}
        <p class="articulo-descripcion">${descripcion}</p>
        <a class="articulo-leer-mas" href="/news/${slug}">Leer más</a>
      </div>
    </div>`;
  }).join('');
  
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Frontend Demo - Noticias</title>
  <link rel="stylesheet" href="/_next/static/css/app.css">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9f9f9;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background-color: #2c3e50;
      color: white;
      padding: 20px;
      text-align: center;
      margin-bottom: 30px;
      border-radius: 5px;
    }
    h1 {
      margin: 0;
    }
    .articulos {
      display: grid;
      grid-template-columns: 1fr;
      gap: 30px;
    }
    .articulo {
      background-color: white;
      border-radius: 5px;
      overflow: hidden;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      display: flex;
      flex-direction: column;
    }
    @media (min-width: 768px) {
      .articulo {
        flex-direction: row;
      }
    }
    .articulo-imagen {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }
    @media (min-width: 768px) {
      .articulo-imagen {
        width: 300px;
        height: 100%;
      }
    }
    .articulo-contenido {
      padding: 20px;
      flex: 1;
    }
    .articulo-titulo {
      margin-top: 0;
      margin-bottom: 10px;
      color: #2c3e50;
    }
    .articulo-titulo a {
      color: #2c3e50;
      text-decoration: none;
    }
    .articulo-titulo a:hover {
      text-decoration: underline;
    }
    .articulo-fecha {
      color: #7f8c8d;
      font-style: italic;
      margin-bottom: 10px;
      font-size: 0.9em;
    }
    .articulo-descripcion {
      margin-bottom: 15px;
    }
    .articulo-leer-mas {
      display: inline-block;
      background-color: #3498db;
      color: white;
      padding: 8px 15px;
      text-decoration: none;
      border-radius: 4px;
      transition: background-color 0.3s;
    }
    .articulo-leer-mas:hover {
      background-color: #2980b9;
    }
  </style>
</head>
<body>
  <div id="__next">
    <div class="container">
      <header>
        <h1>Frontend Demo - Noticias</h1>
      </header>
      <div class="articulos">
        ${articulosHTML || '<p>No hay artículos disponibles.</p>'}
      </div>
    </div>
  </div>
  <script src="/_next/static/chunks/webpack.js" defer></script>
  <script src="/_next/static/chunks/main.js" defer></script>
</body>
</html>`;
}

/**
 * Crea un archivo HTML para una ruta específica
 * @param {string} ruta Ruta para la que crear el archivo HTML
 * @param {string} titulo Título de la página
 * @returns {Promise<void>}
 */
async function crearArchivoHTML(ruta) {
  const rutaCompleta = path.join(outDir, ruta);
  const directorioRuta = path.dirname(rutaCompleta);
  
  // Crear el directorio si no existe
  crearDirectorio(directorioRuta);
  
  // Verificar si es una ruta de artículo
  const rutaNormalizada = ruta.endsWith('/') ? ruta : `/${ruta}`;
  if (rutaNormalizada.startsWith('/news/')) {
    const slug = rutaNormalizada.replace('/news/', '');
    log(`🔍 Generando HTML para artículo con slug: ${slug}`);
    
    // Configurar headers para la API de Strapi
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (STRAPI_API_TOKEN) {
      headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
    }
    
    const strapiUrl = `${STRAPI_URL}/api/articles?filters[slug][$eq]=${slug}&populate=*`;
    log(`💾 Consultando API de Strapi: ${strapiUrl}`);
    
    try {
      const strapiRes = await fetch(strapiUrl, { headers });
      
      if (strapiRes.ok) {
        const data = await strapiRes.json();
        log(`📊 Datos recibidos de Strapi: ${JSON.stringify(data.meta)}`);
        
        if (data.data && data.data.length > 0) {
          const articuloData = data.data[0];
          log(`✅ Artículo encontrado con ID: ${articuloData.id}`);
          
          // Verificar si el artículo tiene la estructura esperada
          if (articuloData.attributes) {
            // Mostrar la estructura completa del artículo para depuración
            log(`📊 Estructura del artículo: ${JSON.stringify(articuloData.attributes, null, 2)}`);
            
            const articulo = articuloData.attributes;
            log(`✅ Título del artículo: ${articulo.title || 'Sin título'}`);
            
            const contenidoHTML = generarHTMLArticulo(articulo);
            
            // Escribir el archivo HTML
            const nombreArchivo = ruta.endsWith('/') ? `${rutaCompleta}index.html` : `${rutaCompleta}.html`;
            fs.writeFileSync(nombreArchivo, contenidoHTML);
            log(`📝 Creado archivo HTML: ${nombreArchivo}`);
            return;
          } else if (articuloData.title) {
            // Si los datos están en la raíz del objeto (no en attributes)
            log(`📊 Estructura alternativa del artículo: ${JSON.stringify(articuloData, null, 2)}`);
            
            // Usar directamente el objeto articuloData como el artículo
            log(`✅ Título del artículo (estructura alternativa): ${articuloData.title || 'Sin título'}`);
            
            const contenidoHTML = generarHTMLArticulo(articuloData);
            
            // Escribir el archivo HTML
            const nombreArchivo = ruta.endsWith('/') ? `${rutaCompleta}index.html` : `${rutaCompleta}.html`;
            fs.writeFileSync(nombreArchivo, contenidoHTML);
            log(`📝 Creado archivo HTML: ${nombreArchivo}`);
            return;
          } else {
            log(`⚠️ Estructura de artículo no reconocida: ${JSON.stringify(articuloData, null, 2)}`);
          }
        } else {
          log(`⚠️ No se encontró el artículo con slug: ${slug}`);
          
          // Intentar obtener el artículo nuevamente con una consulta diferente
          log(`🔍 Obteniendo artículo con slug: ${slug}`);
          const strapiUrlAlt = `${STRAPI_URL}/api/articles?filters[slug][$eq]=${slug}&populate=*`;
          log(`💾 Consultando API de Strapi: ${strapiUrlAlt}`);
          
          const strapiResAlt = await fetch(strapiUrlAlt, { headers });
          if (strapiResAlt.ok) {
            const dataAlt = await strapiResAlt.json();
            log(`📊 Datos recibidos de Strapi (segunda consulta): ${JSON.stringify(dataAlt.meta)}`);
            
            if (dataAlt.data && dataAlt.data.length > 0) {
              // Mostrar los datos completos para depuración
              log(`📊 Datos completos del artículo: ${JSON.stringify(dataAlt.data[0], null, 2)}`);
            }
          }
          
          // Generar contenido de ejemplo basado en el slug
          const tituloGenerado = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const articuloGenerado = {
            title: tituloGenerado,
            content: `<h2>Acerca de ${tituloGenerado}</h2>
<p>Este es un contenido de ejemplo generado automáticamente para el artículo "${tituloGenerado}". Este contenido se muestra porque el artículo no se encontró en la base de datos de Strapi.</p>
<p>En un entorno de producción, este contenido sería reemplazado por el contenido real del artículo obtenido desde Strapi CMS.</p>
<h3>Características principales</h3>
<ul>
  <li>Contenido dinámico desde Strapi CMS</li>
  <li>Generación automática de archivos HTML estáticos</li>
  <li>Despliegue automático mediante webhooks</li>
  <li>Optimización para SEO</li>
</ul>
<p>Este sistema permite mantener un sitio web estático que se actualiza automáticamente cuando se publican nuevos contenidos en el CMS.</p>`,
            publishedAt: new Date().toISOString(),
            image: null
          };
          const contenidoHTML = generarHTMLArticulo(articuloGenerado);
          
          // Escribir el archivo HTML
          const nombreArchivo = ruta.endsWith('/') ? `${rutaCompleta}index.html` : `${rutaCompleta}.html`;
          fs.writeFileSync(nombreArchivo, contenidoHTML);
          log(`📝 Creado archivo HTML: ${nombreArchivo}`);
          return;
        }
      } else {
        log(`⚠️ Error en la respuesta de Strapi: ${strapiRes.status} ${strapiRes.statusText}`);
      }
    } catch (error) {
      log(`⚠️ Error al obtener artículo desde Strapi: ${error.message}`);
    }
  }
  
  // Si no es un artículo o hubo un error, obtener el contenido HTML genérico
  const contenidoHTML = await obtenerContenidoHTML(rutaNormalizada);
  
  // Escribir el archivo HTML
  const nombreArchivo = ruta.endsWith('/') ? `${rutaCompleta}index.html` : `${rutaCompleta}.html`;
  fs.writeFileSync(nombreArchivo, contenidoHTML);
  log(`📄 Creado archivo HTML: ${nombreArchivo}`);
}

/**
 * Función principal
 */
async function main() {
  let servidor = null;
  
  try {
    log('🚀 Iniciando generación de archivos estáticos para S3...');
    
    // Limpiar el directorio de salida si existe
    if (fs.existsSync(outDir)) {
      log('🗑️ Limpiando directorio de salida existente...');
      fs.rmSync(outDir, { recursive: true, force: true });
    }
    
    // Crear el directorio de salida
    crearDirectorio(outDir);
    
    // Primero, compilar la aplicación para asegurarnos de tener los archivos estáticos más recientes
    log('🚧️ Compilando la aplicación...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Copiar archivos estáticos de .next/static a out/_next/static
    log('📦 Copiando archivos estáticos...');
    copiarDirectorio(path.join(nextDir, 'static'), path.join(outDir, '_next', 'static'));
    
    // Iniciar servidor temporal para renderizar páginas
    servidor = await iniciarServidorTemporal();
    
    // Crear archivos HTML para las rutas estáticas
    log('📝 Creando archivos HTML para las rutas estáticas...');
    
    // Página principal
    // Primero obtenemos los artículos para la página principal
    let articulosParaPrincipal = [];
    try {
      const headers = {};
      if (STRAPI_API_TOKEN) {
        headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
      }
      
      const strapiUrl = `${STRAPI_URL}/api/articles?sort=publishedAt:desc&pagination[limit]=10&populate=*`;
      log(`💾 Obteniendo lista de artículos para la página principal desde Strapi: ${strapiUrl}`);
      
      const strapiRes = await fetch(strapiUrl, { headers });
      if (strapiRes.ok) {
        const data = await strapiRes.json();
        if (data.data && data.data.length > 0) {
          articulosParaPrincipal = data.data;
          log(`✅ Obtenidos ${articulosParaPrincipal.length} artículos para la página principal`);
        } else {
          log('⚠️ No se encontraron artículos en Strapi para la página principal');
        }
      }
    } catch (error) {
      log(`⚠️ Error al obtener artículos para la página principal: ${error.message}`);
    }
    
    // Si no hay artículos en Strapi, usamos los slugs de las rutas para generar una lista de artículos
    if (articulosParaPrincipal.length === 0) {
      const articulos = await obtenerRutasArticulos();
      articulosParaPrincipal = articulos.map(slug => ({
        attributes: {
          title: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug: slug,
          description: `Descripción del artículo ${slug.replace(/-/g, ' ')}`,
          publishedAt: new Date().toISOString()
        }
      }));
      log(`✅ Generados ${articulosParaPrincipal.length} artículos de muestra para la página principal`);
    }
    
    // Crear el HTML de la página principal con los artículos
    const htmlPaginaPrincipal = generarHTMLPaginaPrincipal(articulosParaPrincipal);
    const rutaCompletaPrincipal = path.join(outDir, 'index.html');
    fs.writeFileSync(rutaCompletaPrincipal, htmlPaginaPrincipal);
    log(`📄 Creado archivo HTML para la página principal: ${rutaCompletaPrincipal}`);
    
    
    // Obtener lista de artículos desde Next.js
    const articulos = await obtenerRutasArticulos();
    
    // Crear un archivo HTML para cada artículo
    if (articulos.length > 0) {
      // Crear directorio para noticias
      crearDirectorio(path.join(outDir, 'news'));
      
      // Crear un archivo HTML para cada artículo
      for (const slug of articulos) {
        const rutaArticulo = `news/${slug}`;
        await crearArchivoHTML(rutaArticulo);
      }
      
      log(`✅ Creados ${articulos.length} archivos HTML para artículos`);
    } else {
      log('⚠️ No se encontraron artículos para generar HTML');
    }
    
    // Buscar archivos CSS generados por Next.js
    const cssFiles = fs.readdirSync(path.join(outDir, '_next', 'static', 'css'));
    if (cssFiles.length > 0) {
      // Crear un archivo CSS global para la aplicación
      const appCssPath = path.join(outDir, '_next', 'static', 'css', 'app.css');
      if (!fs.existsSync(appCssPath)) {
        // Concatenar todos los archivos CSS en uno solo
        const cssContent = cssFiles
          .map(file => fs.readFileSync(path.join(outDir, '_next', 'static', 'css', file), 'utf8'))
          .join('\n');
        
        fs.writeFileSync(appCssPath, cssContent);
        log('📄 Creado archivo CSS global: app.css');
      }
    }
    
    log('✅ Archivos estáticos generados exitosamente en la carpeta out');
    log(`📊 Total de archivos HTML generados: ${fs.readdirSync(outDir, { recursive: true }).filter(f => f.endsWith('.html')).length}`);
    log('📊 Puedes usar el script upload-to-s3.js para subir estos archivos a S3');
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    // Cerrar el servidor temporal si existe
    if (servidor) {
      servidor.close();
      log('🔴 Servidor temporal detenido');
    }
  }
}

// Ejecutar la función principal
main();
