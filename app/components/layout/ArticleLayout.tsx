// src/components/layout/ArticleLayout.tsx
import React from 'react';
import Header from './Header';
import Footer from './Footer';


interface ArticleLayoutProps {
  children: React.ReactNode;
}

export default function ArticleLayout({ children }: ArticleLayoutProps) {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <article className="prose lg:prose-xl mx-auto">
          {children}
        </article>
      </main>
      <Footer />
    </>
  );
}