import { Article } from '@/app/types';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

/**
 * Obtiene todos los artículos de Strapi
 */
export async function fetchArticles(): Promise<Article[]> {
  try {
    const response = await fetch(`${STRAPI_URL}/api/articles?populate=*`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching articles: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transformar la respuesta de Strapi al formato que necesitamos
    return data.data.map((article: Article) => ({
      id: article.id,
      title: article.title,
      description: article.description,
      slug: article.slug,
      content: article.content,
      publishedAt: new Date(article.publishedAt),
      cover: {
        url: article.cover?.url || '/placeholder.jpg',
      },
      category: article.category ? {
        id: article.category.id,
        name: article.category.name,
        slug: article.category.slug,
      } : null,
    }));
  } catch (error) {
    console.error('Error fetching articles:', error);
    return [];
  }
}

/**
 * Obtiene un artículo específico por su slug
 */
export async function fetchArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const response = await fetch(
      `${STRAPI_URL}/api/articles?filters[slug][$eq]=${slug}&populate=*`,
      {
        cache: 'no-store',
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error fetching article: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return null;
    }
    
    const article = data.data[0];
    
    return {
      id: article.id,
      title: article.title,
      description: article.description,
      content: article.content,
      slug: article.slug,
      publishedAt: new Date(article.publishedAt),
      cover: {
        url: article.cover?.url || article.cover?.data?.attributes?.url || '/placeholder.jpg',
      },
      category: article.category?.data ? {
        id: article.category.id,
        name: article.category.name,
        slug: article.category.slug,
      } : null,
    };
  } catch (error) {
    console.error('Error fetching article by slug:', error);
    return null;
  }
}

/**
 * Obtiene todos los slugs de artículos para generar rutas estáticas
 */
export async function fetchAllArticleSlugs(): Promise<string[]> {
  try {
    console.log('Obteniendo todos los slugs de artículos...');
    const response = await fetch(`${STRAPI_URL}/api/articles?fields[0]=slug`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching article slugs: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Respuesta de API para slugs:', JSON.stringify(data, null, 2));
    
    if (!data.data || !Array.isArray(data.data)) {
      console.error('Formato de datos inesperado:', data);
      return [];
    }
    
    // Extraer los slugs de la estructura de datos de Strapi
    return data.data.map((article: Article) => article.slug);
  } catch (error) {
    console.error('Error fetching article slugs:', error);
    return [];
  }
}

/**
 * Obtiene artículos relacionados por categoría
 */
export async function fetchRelatedArticles(articleId: string, categoryId?: string): Promise<Article[]> {
  try {
    // Si no hay categoría, devolver artículos recientes
    if (!categoryId) {
      return fetchRecentArticles(articleId);
    }
    
    const response = await fetch(
      `${STRAPI_URL}/api/articles?filters[id][$ne]=${articleId}&filters[category][id][$eq]=${categoryId}&populate=*&pagination[limit]=3`,
      {
        cache: 'no-store',
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error fetching related articles: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return fetchRecentArticles(articleId);
    }
    
    return data.data.map((article: Article) => ({
      id: article.id,
      title: article.title,
      description: article.description,
      slug: article.slug,
      publishedAt: new Date(article.publishedAt),
      cover: {
        url: article.cover?.url || '/placeholder.jpg',
      },
    }));
  } catch (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
}

/**
 * Obtiene artículos recientes excluyendo el artículo actual
 */
async function fetchRecentArticles(excludeId: string): Promise<Article[]> {
  try {
    const response = await fetch(
      `${STRAPI_URL}/api/articles?filters[id][$ne]=${excludeId}&populate=*&sort[0]=publishedAt:desc&pagination[limit]=3`,
      {
        cache: 'no-store',
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error fetching recent articles: ${response.status}`);
    }
    
    const data = await response.json();
    
    return data.data.map((article: Article) => ({
      id: article.id,
      title: article.title,
      description: article.description,
      slug: article.slug,
      publishedAt: new Date(article.publishedAt),
      cover: {
        url: article.cover?.url || '/placeholder.jpg',
      },
    }));
  } catch (error) {
    console.error('Error fetching recent articles:', error);
    return [];
  }
}
