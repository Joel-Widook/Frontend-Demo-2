import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

// Configuración de AWS
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Bucket de S3 donde se subirán los archivos
const BUCKET_NAME = process.env.AWS_S3_BUCKET || '';
// Directorio de salida de Next.js
const OUT_DIR = path.join(process.cwd(), 'out');
// Prefijo para los archivos en S3 (opcional)
const S3_PREFIX = process.env.AWS_S3_PREFIX || '';

/**
 * Sube un archivo a S3
 * @param filePath Ruta local del archivo
 * @param s3Key Clave en S3 donde se subirá el archivo
 */
async function uploadFileToS3(filePath: string, s3Key: string): Promise<void> {
  const fileContent = fs.readFileSync(filePath);
  const contentType = mime.lookup(filePath) || 'application/octet-stream';
  
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
        // Configurar el caché para archivos estáticos
        CacheControl: contentType.includes('image/') 
          ? 'public, max-age=31536000, immutable' // 1 año para imágenes
          : contentType.includes('text/html')
            ? 'public, max-age=0, must-revalidate' // Sin caché para HTML
            : 'public, max-age=604800', // 1 semana para otros archivos
      },
    });

    await upload.done();
    console.log(`✅ Archivo subido: ${s3Key}`);
  } catch (error) {
    console.error(`❌ Error al subir ${s3Key}:`, error);
    throw error;
  }
}

/**
 * Recorre recursivamente un directorio y sube todos los archivos a S3
 * @param directory Directorio a recorrer
 * @param baseS3Path Ruta base en S3
 */
async function uploadDirectoryToS3(directory: string, baseS3Path: string = ''): Promise<void> {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      // Si es un directorio, recursivamente subir su contenido
      await uploadDirectoryToS3(filePath, path.join(baseS3Path, file));
    } else {
      // Si es un archivo, subirlo a S3
      const relativePath = path.relative(OUT_DIR, filePath);
      const s3Key = path.join(S3_PREFIX, relativePath).replace(/\\/g, '/');
      await uploadFileToS3(filePath, s3Key);
    }
  }
}

/**
 * Función principal que inicia el proceso de subida a S3
 */
async function main() {
  console.log('🚀 Iniciando subida de archivos a S3...');
  
  if (!BUCKET_NAME) {
    console.error('❌ Error: AWS_S3_BUCKET no está definido');
    process.exit(1);
  }
  
  if (!fs.existsSync(OUT_DIR)) {
    console.error(`❌ Error: El directorio de salida ${OUT_DIR} no existe`);
    process.exit(1);
  }
  
  try {
    await uploadDirectoryToS3(OUT_DIR);
    console.log('✅ Todos los archivos han sido subidos a S3 exitosamente');
  } catch (error) {
    console.error('❌ Error durante la subida a S3:', error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();
