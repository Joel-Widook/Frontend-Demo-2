/**
 * Script para subir archivos estáticos a S3
 * Este script toma los archivos generados por Next.js en la carpeta 'out'
 * y los sube a un bucket de S3
 */

// Cargar variables de entorno desde el archivo .env
require('dotenv').config();

const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Configuración de AWS
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Bucket de S3 donde se subirán los archivos
const BUCKET_NAME = process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME || '';
// Directorio de salida de Next.js o directorio personalizado
const OUT_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'out');
// Prefijo para los archivos en S3 (opcional)
const S3_PREFIX = process.env.AWS_S3_PREFIX || '';

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
 * Sube un archivo a S3
 * @param {string} filePath Ruta local del archivo
 * @param {string} s3Key Clave en S3 donde se subirá el archivo
 * @param {Object} metadata Metadatos adicionales para el archivo
 */
async function uploadFileToS3(filePath, s3Key, metadata = {}) {
  const fileContent = fs.readFileSync(filePath);
  const contentType = metadata.ContentType || mime.lookup(filePath) || 'application/octet-stream';
  
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
      // Configurar el caché para archivos estáticos
      CacheControl: metadata.CacheControl || (
        contentType.includes('image/') 
          ? 'public, max-age=31536000, immutable' // 1 año para imágenes
          : contentType.includes('text/html')
            ? 'public, max-age=0, must-revalidate' // Sin caché para HTML
            : 'public, max-age=604800' // 1 semana para otros archivos
      ),
    };
    
    // Si es un archivo HTML, configurar para que se pueda visualizar directamente
    if (contentType === 'text/html') {
      params.ContentDisposition = 'inline';
    }
    
    const upload = new Upload({
      client: s3Client,
      params: params,
    });

    await upload.done();
    log(`✅ Archivo subido: ${s3Key} (${contentType})`);
  } catch (error) {
    log(`❌ Error al subir ${s3Key}: ${error.message}`);
    throw error;
  }
}

/**
 * Recorre recursivamente un directorio y sube todos los archivos a S3
 * @param {string} directory Directorio a recorrer
 * @param {string} baseS3Path Ruta base en S3
 * @param {boolean} onlyNews Si es true, solo sube archivos relacionados con noticias
 */
async function uploadDirectoryToS3(directory, baseS3Path = '', onlyNews = true) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    const relativePath = path.relative(OUT_DIR, filePath);
    
    // Determinar si el archivo está relacionado con noticias
    const isNewsArticle = relativePath.startsWith('news/') && !relativePath.startsWith('news/_');
    const isStaticAsset = relativePath.startsWith('_next/') || 
                         relativePath.startsWith('static/') || 
                         relativePath.endsWith('.css') || 
                         relativePath.endsWith('.js') || 
                         relativePath.endsWith('.jpg') || 
                         relativePath.endsWith('.png') || 
                         relativePath.endsWith('.svg');
    
    // Solo procesar si es un artículo de noticias o un recurso estático necesario
    const shouldProcess = !onlyNews || isNewsArticle || isStaticAsset;
    
    if (stats.isDirectory()) {
      // Si es un directorio, recursivamente subir su contenido
      // Verificamos si es un directorio de noticia (news/[slug])
      const dirName = path.basename(filePath);
      const parentDir = path.basename(path.dirname(filePath));
      
      if (parentDir === 'news' && !dirName.startsWith('_') && !dirName.startsWith('.')) {
        log(`📁 Detectada noticia: ${dirName}`);
      }
      
      // Solo procesar directorios relevantes
      if (shouldProcess || dirName === 'news' || dirName === '_next' || dirName === 'static') {
        await uploadDirectoryToS3(filePath, path.join(baseS3Path, file), onlyNews);
      }
    } else if (shouldProcess) {
      // Si es un archivo relevante, subirlo a S3
      const s3Key = path.join(S3_PREFIX, relativePath).replace(/\\/g, '/');
      
      // Establecer los metadatos adecuados para que el archivo se sirva correctamente desde S3
      const contentType = mime.lookup(filePath) || 'application/octet-stream';
      const metadata = {
        ContentType: contentType
      };
      
      // Configurar la disposición del contenido para archivos HTML
      if (contentType === 'text/html') {
        metadata.ContentDisposition = 'inline';
      }
      
      // Si es un archivo HTML, establecer el header Cache-Control
      if (contentType === 'text/html') {
        metadata.CacheControl = 'max-age=300'; // 5 minutos de caché para HTML
      } else if (contentType.startsWith('image/')) {
        metadata.CacheControl = 'max-age=86400'; // 1 día para imágenes
      } else {
        metadata.CacheControl = 'max-age=31536000'; // 1 año para recursos estáticos (JS, CSS)
      }
      
      await uploadFileToS3(filePath, s3Key, metadata);
    }
  }
}

/**
 * Función principal que inicia el proceso de subida a S3
 */
async function main() {
  log('🚀 Iniciando subida de archivos a S3...');
  
  if (!BUCKET_NAME) {
    log('❌ Error: AWS_S3_BUCKET no está definido');
    process.exit(1);
  }
  
  if (!fs.existsSync(OUT_DIR)) {
    log(`❌ Error: El directorio de salida ${OUT_DIR} no existe`);
    process.exit(1);
  }
  
  // Determinar si solo se deben subir noticias o todos los archivos
  const onlyNews = process.env.ONLY_NEWS === 'true' || true; // Por defecto, solo noticias
  
  if (onlyNews) {
    log('📝 Modo: Solo subir noticias y archivos necesarios');
  } else {
    log('📝 Modo: Subir todos los archivos');
  }
  
  try {
    await uploadDirectoryToS3(OUT_DIR, '', onlyNews);
    log('✅ Todos los archivos han sido subidos a S3 exitosamente');
  } catch (error) {
    log(`❌ Error durante la subida a S3: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();
