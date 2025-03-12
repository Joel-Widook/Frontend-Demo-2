import Image from "next/image";
import Link from "next/link";
import { fetchArticles } from "./lib/api/articles";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";

export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidar cada hora si hay tráfico

// Usar tags para revalidación selectiva
export const generateMetadata = async () => {
  return {
    other: {
      tags: ['articles', 'home'],
    },
  };
};

export default async function Home() {
  // Obtener los artículos de Strapi
  const articles = await fetchArticles();

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">Últimas Noticias</h1>
        
        {/* Grid de 3 columnas para las noticias */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link href={{ pathname: `/news/${article.slug}` }} key={article.id}>
              <div className="bg-white shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div className="relative h-48 w-full">
                  <Image
                    src={`${process.env.STRAPI_URL}${article.cover.url}`}
                    alt={article.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-bold mb-2">{article.title}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-3">{article.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      {new Date(article.publishedAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {article.category?.name || 'General'}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Mensaje si no hay artículos */}
        {articles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No hay noticias disponibles en este momento.</p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
