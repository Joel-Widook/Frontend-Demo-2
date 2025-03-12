import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Configuración para Next.js
// Nota: En modo export, las rutas de API no funcionan en producción
// Este endpoint solo funcionará en desarrollo
export const dynamic = 'force-dynamic';
export const revalidate = 0; // No cachear

// Configuración de logs
const LOG_FILE = path.join(process.cwd(), 'webhook-logs.txt');

/**
 * Función para escribir logs en un archivo
 * @param message Mensaje a loguear
 */
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Escribir en el archivo de logs
  fs.appendFileSync(LOG_FILE, logMessage);
}

// La función runDeployScript ha sido eliminada ya que ahora usamos revalidación nativa de Next.js

/**
 * Verifica si el webhook proviene de Strapi y tiene el token correcto
 * @param request Solicitud del webhook
 */
async function validateWebhook(request: NextRequest): Promise<boolean> {
  // Registrar todos los headers para depuración
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  log(`💬 Headers recibidos: ${JSON.stringify(headers, null, 2)}`);
  
  // Obtener el token del header (probar diferentes nombres de header)
  const token = request.headers.get('x-webhook-token') || 
                request.headers.get('webhook-token') ||
                request.headers.get('x-strapi-webhook-token') ||
                new URL(request.url).searchParams.get('token');
  
  log(`🔑 Token recibido: ${token || 'ninguno'}`);
  
  // Verificar que el token coincida con el configurado
  const expectedToken = process.env.WEBHOOK_TOKEN;
  
  if (!expectedToken) {
    log('⚠️ No se ha configurado WEBHOOK_TOKEN en las variables de entorno');
    return false;
  }
  
  // Para desarrollo, permitir omitir la validación del token
  if (process.env.NODE_ENV === 'development' && !token) {
    log('⚠️ Modo desarrollo: permitiendo solicitud sin token');
    return true;
  }
  
  if (token !== expectedToken) {
    log(`❌ Token inválido recibido: ${token}`);
    log(`❌ Token esperado: ${expectedToken}`);
    return false;
  }
  
  return true;
}

import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Manejador para solicitudes POST al webhook
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  log('📥 Webhook recibido');
  log(`💬 URL: ${request.url}`);
  log(`💬 Método: ${request.method}`);
  
  try {
    // Intentar obtener y loguear el cuerpo de la solicitud antes de la validación
    // para tener más información de depuración
    interface WebhookBody {
      event?: string;
      model?: string;
      entry?: {
        id?: number | string;
        slug?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }
    
    let body: WebhookBody = {};
    try {
      // Clonar la solicitud para poder leer el cuerpo múltiples veces
      const clonedRequest = request.clone();
      const jsonData = await clonedRequest.json();
      body = jsonData as WebhookBody;
      log(`📦 Datos recibidos: ${JSON.stringify(body, null, 2)}`);
    } catch (bodyError) {
      log(`⚠️ No se pudo leer el cuerpo de la solicitud: ${bodyError}`);
    }
    
    // Validar el webhook
    const isValid = await validateWebhook(request);
    
    if (!isValid) {
      log('🚫 Webhook rechazado: token inválido');
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    
    // Si no pudimos leer el cuerpo antes, intentarlo de nuevo
    if (Object.keys(body).length === 0) {
      try {
        const jsonData = await request.json();
        body = jsonData as WebhookBody;
        log(`📦 Datos recibidos (segundo intento): ${JSON.stringify(body, null, 2)}`);
      } catch (bodyError) {
        log(`⚠️ No se pudo leer el cuerpo de la solicitud (segundo intento): ${bodyError}`);
        // Continuar de todos modos, para desarrollo
        if (process.env.NODE_ENV === 'development') {
          log('⚠️ Modo desarrollo: revalidando todas las páginas');
          
          // Revalidar páginas principales
          revalidatePath('/');
          revalidatePath('/news');
          revalidateTag('articles');
          revalidateTag('home');
          
          return NextResponse.json({ 
            success: true, 
            revalidated: true,
            message: 'Páginas revalidadas (modo desarrollo, sin cuerpo)' 
          });
        } else {
          return NextResponse.json({ 
            error: 'No se pudo leer el cuerpo de la solicitud', 
            details: String(bodyError) 
          }, { status: 400 });
        }
      }
    }
    
    // Verificar el tipo de evento (creación o actualización de artículo)
    const event = body.event;
    const model = body.model;
    let articleSlug = '';
    
    // Intentar obtener el slug del artículo si está disponible
    if (body.entry && body.entry.slug) {
      articleSlug = body.entry.slug;
      log(`📄 Slug del artículo: ${articleSlug}`);
    }
    
    // En modo desarrollo, ser más permisivo con los eventos
    if (process.env.NODE_ENV === 'development') {
      log('✅ Modo desarrollo: revalidando todas las páginas');
      
      // Revalidar páginas principales
      revalidatePath('/');
      revalidatePath('/news');
      revalidateTag('articles');
      revalidateTag('home');
      
      // Si tenemos un slug específico, revalidar esa página también
      if (articleSlug) {
        revalidatePath(`/news/${articleSlug}`);
        revalidateTag(`article-${articleSlug}`);
      }
      
      return NextResponse.json({ 
        success: true, 
        revalidated: true,
        message: 'Páginas revalidadas (modo desarrollo)' 
      });
    }
    
    // En producción, verificar el tipo de evento
    if (
      (event === 'entry.create' || event === 'entry.update' || 
       event === 'entry.publish' || event === 'entry.unpublish') && 
      (model === 'article' || model === 'articles')
    ) {
      log('✅ Evento válido para revalidación');
      
      // Revalidar páginas principales que muestran listas de artículos
      revalidatePath('/');
      revalidatePath('/news');
      revalidateTag('articles');
      revalidateTag('home');
      
      // Si tenemos un slug específico, revalidar esa página también
      if (articleSlug) {
        revalidatePath(`/news/${articleSlug}`);
        revalidateTag(`article-${articleSlug}`);
        log(`✅ Revalidada página específica: /news/${articleSlug}`);
      }
      
      return NextResponse.json({ 
        success: true, 
        revalidated: true,
        message: 'Páginas revalidadas exitosamente',
        paths: articleSlug ? ['/', '/news', `/news/${articleSlug}`] : ['/', '/news']
      });
    } else {
      log(`ℹ️ Evento ignorado: ${event} para modelo ${model}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Evento recibido pero no requiere revalidación' 
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`❌ Error en el webhook: ${errorMessage}`);
    
    return NextResponse.json({ 
      error: 'Error interno del servidor', 
      details: errorMessage 
    }, { status: 500 });
  }
}

/**
 * Manejador para solicitudes GET al webhook (para pruebas)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  log('📥 Solicitud GET al webhook (prueba)');
  
  // Validar el webhook
  const isValid = await validateWebhook(request);
  
  if (!isValid) {
    log('🚫 Prueba de webhook rechazada: token inválido');
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }
  
  return NextResponse.json({ 
    success: true, 
    message: 'Webhook configurado correctamente',
    timestamp: new Date().toISOString()
  });
}
