const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const fetch = require('node-fetch');

const execPromise = util.promisify(exec);

// Configuración de logs
const LOG_FILE = path.join(process.cwd(), 'webhook-deploy-logs.txt');

/**
 * Función para escribir logs en un archivo
 * @param message Mensaje a loguear
 */
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Escribir en el archivo de logs
  fs.appendFileSync(LOG_FILE, logMessage);
  
  // También mostrar en consola
  console.log(message);
}

/**
 * Ejecuta un comando y loguea su salida
 * @param command Comando a ejecutar
 * @param name Nombre descriptivo del comando
 */
async function runCommand(command: string, name: string): Promise<void> {
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
    const execError = error as { message: string; stdout?: string; stderr?: string };
    log(`❌ Error en ${name}: ${execError.message}`);
    if (execError.stdout) log(`📝 Salida: ${execError.stdout}`);
    if (execError.stderr) log(`⚠️ Error detallado: ${execError.stderr}`);
    throw error;
  }
}

/**
 * Regenera las páginas estáticas utilizando la API de revalidación de Next.js
 */
async function regenerateStaticPages(): Promise<void> {
  log('🔄 Iniciando regeneración de páginas estáticas');
  
  try {
    // Obtener todos los slugs de artículos
    const { fetchAllArticleSlugs } = await import('../app/lib/api/articles');
    const slugs = await fetchAllArticleSlugs();
    
    log(`📋 Obtenidos ${slugs.length} slugs de artículos para regenerar`);
    
    // Páginas a regenerar
    const pagesToRegenerate = [
      '/', // Página principal
      '/news', // Página de listado de noticias (si existe)
    ];
    
    // Añadir páginas de detalle de artículos
    slugs.forEach(slug => {
      pagesToRegenerate.push(`/news/${slug}`);
    });
    
    log(`🔍 Se regenerarán ${pagesToRegenerate.length} páginas estáticas`);
    
    // Regenerar cada página
    for (const path of pagesToRegenerate) {
      try {
        log(`🔄 Regenerando página: ${path}`);
        
        // Llamar al endpoint de revalidación
        const revalidationSecret = process.env.REVALIDATION_SECRET;
        if (!revalidationSecret) {
          log('⚠️ No se ha configurado REVALIDATION_SECRET en las variables de entorno');
          continue;
        }
        
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const revalidateUrl = `${baseUrl}/api/revalidate?path=${encodeURIComponent(path)}&secret=${revalidationSecret}`;
        
        log(`💬 Llamando al endpoint de revalidación: ${revalidateUrl}`);
        
        const response = await fetch(revalidateUrl);
        const data = await response.json();
        
        if (response.ok && data.revalidated) {
          log(`✅ Página revalidada exitosamente: ${path}`);
        } else {
          log(`⚠️ Error al revalidar página ${path}: ${JSON.stringify(data)}`);
        }
      } catch (error) {
        log(`⚠️ Error regenerando página ${path}: ${error}`);
        // Continuar con las demás páginas aunque haya un error
      }
    }
    
    log('✅ Regeneración de páginas estáticas completada');
    return;
  } catch (error) {
    log(`❌ Error durante la regeneración de páginas: ${error}`);
    throw error;
  }
}

/**
 * Función principal que ejecuta el proceso de despliegue
 */
async function deploy(): Promise<void> {
  log('🔄 Iniciando proceso de despliegue');
  
  try {
    // 1. Regenerar páginas estáticas
    await regenerateStaticPages();
    
    // 2. Instalar dependencias (si es necesario)
    // await runCommand('npm install', 'Instalación de dependencias');
    
    // 3. Construir la aplicación (si es necesario)
    await runCommand('npm run build', 'Construcción de la aplicación');
    
    // 4. Subir archivos a S3 (si es necesario)
    // await runCommand('ts-node scripts/upload-to-s3.ts', 'Subida a S3');
    
    log('✅ Despliegue completado exitosamente');
  } catch (error) {
    log(`❌ El proceso de despliegue falló: ${error}`);
    process.exit(1);
  }
}

// Iniciar el despliegue
deploy();
