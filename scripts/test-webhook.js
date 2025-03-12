/**
 * Script para probar el webhook de revalidación
 * Este script envía una solicitud POST al webhook simulando una notificación de Strapi
 */

// Usar import() dinámico para node-fetch
require('dotenv').config();

// Convertir a un script tipo módulo
(async () => {

// URL del webhook (usando ngrok)
const WEBHOOK_URL = 'https://f3e2-186-29-180-30.ngrok-free.app/api/webhook';
// Secreto de revalidación (debe coincidir con el configurado en el webhook)
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET || 'your-secret-here';

// Datos de prueba para simular un artículo creado
const testArticle = {
  id: 999,
  title: 'Artículo de prueba para revalidación',
  slug: 'articulo-prueba-revalidacion',
  content: 'Este es un artículo de prueba para verificar la revalidación',
  publishedAt: new Date().toISOString(),
};

// Función para enviar la solicitud al webhook
async function testWebhook() {
  console.log(`🚀 Enviando solicitud de prueba al webhook: ${WEBHOOK_URL}`);
  
  try {
    // Crear el cuerpo de la solicitud simulando una notificación de Strapi
    const body = {
      event: 'entry.create',
      model: 'article',
      entry: testArticle,
      secret: REVALIDATION_SECRET
    };
    
    // Enviar la solicitud POST al webhook
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    // Verificar la respuesta
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Solicitud enviada exitosamente');
      console.log('Respuesta:', data);
    } else {
      console.error('❌ Error al enviar la solicitud');
      console.error('Código de estado:', response.status);
      console.error('Respuesta:', data);
    }
  } catch (error) {
    console.error('❌ Error al enviar la solicitud:', error.message);
  }
}

// Importar fetch dinámicamente
const { default: fetch } = await import('node-fetch');

// Ejecutar la función de prueba
await testWebhook();
})();
