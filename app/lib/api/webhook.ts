import { NextApiRequest, NextApiResponse } from 'next';
import { uploadStaticPageToS3 } from '@/app/lib/aws/s3';
import { verifyWebhookSignature } from '@/app/lib/utils/security';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo aceptar POST desde Strapi
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verificar que la solicitud viene de Strapi
    const isValid = verifyWebhookSignature(req);
    if (!isValid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { model, entry } = req.body; // Eliminada variable 'event' que no se usa

    // Solo procesar eventos de artículos
    if (model !== 'article') {
      return res.status(200).json({ message: 'Ignored non-article event' });
    }

    // Determinar qué páginas deben regenerarse
    const pagesToRegenerate = [];

    // Siempre regenerar la página de inicio
    pagesToRegenerate.push('/');

    // Para artículos, regenerar la página específica
    if (entry && entry.slug) {
      pagesToRegenerate.push(`/news/${entry.slug}`);
      
      // También regenerar páginas de categoría relacionadas
      if (entry.category) {
        pagesToRegenerate.push(`/category/${entry.category.slug}`);
      }
    }

    // Regenerar todas las páginas necesarias
    const regenerationResults = await Promise.all(
      pagesToRegenerate.map(async (path) => {
        // 1. Revalidar la página en Next.js
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/revalidate?path=${path}&secret=${process.env.REVALIDATION_SECRET}`);
        
        // 2. Generar versión estática y subir a S3
        const success = await uploadStaticPageToS3(path);
        
        return {
          path,
          success,
        };
      })
    );

    return res.status(200).json({ 
      message: 'Pages regenerated and uploaded to S3', 
      results: regenerationResults 
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ message: 'Error processing webhook', error: String(error) });
  }
}

