import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

// Configuración para Next.js
export const dynamic = 'force-dynamic';
export const revalidate = 0; // No cachear

// Configuración de logs
const LOG_FILE = path.join(process.cwd(), 'revalidate-logs.txt');

/**
 * Función para escribir logs en un archivo
 * @param message Mensaje a loguear
 */
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Escribir en el archivo de logs
  try {
    fs.appendFileSync(LOG_FILE, logMessage);
    console.log(message);
  } catch (error) {
    console.error(`Error al escribir en el archivo de logs: ${error}`);
  }
}

/**
 * Verifica el token secreto para la revalidación
 * @param request Solicitud de revalidación
 */
function isValidRequest(request: NextRequest): boolean {
  // Obtener el token de la URL
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  // Verificar que el token coincida con el configurado
  const expectedSecret = process.env.REVALIDATION_SECRET;
  
  if (!expectedSecret) {
    log('⚠️ No se ha configurado REVALIDATION_SECRET en las variables de entorno');
    return false;
  }
  
  if (!secret) {
    log('🚫 No se proporcionó el parámetro secret en la solicitud');
    return false;
  }
  
  if (secret !== expectedSecret) {
    log('🚫 El token secreto proporcionado no es válido');
    return false;
  }
  
  return true;
}

/**
 * Manejador para solicitudes GET al endpoint de revalidación
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  log('📥 Solicitud de revalidación recibida');
  
  try {
    // Validar la solicitud
    if (!isValidRequest(request)) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    
    // Obtener la ruta a revalidar
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '/';
    
    log(`🔄 Revalidando ruta: ${path}`);
    
    // Revalidar la ruta especificada
    revalidatePath(path);
    
    log(`✅ Ruta revalidada exitosamente: ${path}`);
    
    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      path
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`❌ Error durante la revalidación: ${errorMessage}`);
    
    return NextResponse.json({
      revalidated: false,
      now: Date.now(),
      error: errorMessage
    }, { status: 500 });
  }
}
