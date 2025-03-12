export interface Cover {
    url: string;
}

export interface NewsParams {
    slug: string;
}

// Definimos PageProps para el context de NextJs
export interface PageProps {
  params: NewsParams;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
}

export interface Article {
    id: string;
    title: string;
    description?: string;
    content?: string;
    slug: string;
    cover: Cover;
    publishedAt: Date;
    category?: Category | null;
};