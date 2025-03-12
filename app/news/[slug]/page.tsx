import Image from 'next/image';
import Link from 'next/link';
import { fetchArticleBySlug, fetchRelatedArticles } from '@/app/lib/api/articles';
import Header from '@/app/components/layout/Header';
import Footer from '@/app/components/layout/Footer';

export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidar cada hora si hay tráfico

// Usar tags para revalidación selectiva
export const generateMetadata = async ({ params }: { params: { slug: string } }) => {
  return {
    other: {
      tags: ['articles', `article-${params.slug}`],
    },
  };
};

// Esta función es necesaria para generar rutas estáticas
export async function generateStaticParams() {
  try {
    // Importar la función para obtener todos los slugs
    const { fetchAllArticleSlugs } = await import('@/app/lib/api/articles');
    const slugs = await fetchAllArticleSlugs();
    
    console.log(`Generando rutas estáticas para ${slugs.length} artículos`);
    
    // Devolver un array de objetos con el parámetro slug
    return slugs.map((slug: string) => ({
      slug,
    }));
  } catch (error) {
    console.error('Error generando rutas estáticas:', error);
    return [];
  }
}

type PageParams = {
  slug: string;
};

export default async function ArticlePage({ params }: { params: PageParams }) {
  const { slug } = params;
  const article = await fetchArticleBySlug(slug);
  
  if (!article) {
    return (
      <>
        <Header />
        <main className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-3xl font-bold mb-4">Artículo no encontrado</h1>
          <p className="mb-8">Lo sentimos, el artículo que buscas no existe o ha sido eliminado.</p>
          <Link href="/" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
            Volver al inicio
          </Link>
        </main>
        <Footer />
      </>
    );
  }
  
  const relatedArticles = await fetchRelatedArticles(article.id, article.category?.id);
  
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <article className="bg-white shadow-md rounded-lg overflow-hidden">
          {/* Imagen de portada */}
          <div className="relative w-full h-64 md:h-96">
            <Image
              src={article.cover.url.startsWith('http') ? article.cover.url : `${process.env.STRAPI_URL}${article.cover.url}`}
              alt={article.title}
              fill
              className="object-cover"
              priority
            />
          </div>
          
          {/* Contenido del artículo */}
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
            
            {/* Fecha y categoría */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-500">
                {new Date(article.publishedAt).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
              {article.category && (
                <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                  {article.category.name}
                </span>
              )}
            </div>
            
            {/* Descripción */}
            <p className="text-xl text-gray-700 mb-6 font-medium">{article.description}</p>
            
            {/* Contenido principal */}
            {article.content && (
              <div className="prose max-w-none">
                {article.content}
              </div>
            )}
          </div>
        </article>
        
        {/* Artículos relacionados */}
        {relatedArticles && relatedArticles.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Artículos relacionados</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedArticles.map(relatedArticle => (
                <Link href={{ pathname: `/news/${relatedArticle.slug}` }} key={relatedArticle.id}>
                  <div className="bg-white shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300">
                    <div className="relative h-40 w-full">
                      <Image
                        src={`${process.env.STRAPI_URL}${relatedArticle.cover.url}`}
                        alt={relatedArticle.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-bold mb-2">{relatedArticle.title}</h3>
                      <p className="text-gray-600 mb-4 line-clamp-2">{relatedArticle.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
