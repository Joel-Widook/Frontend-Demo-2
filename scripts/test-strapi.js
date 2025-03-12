/**
 * Script para probar la conexión con Strapi y entender la estructura de datos
 */
require('dotenv').config();
const http = require('http');
const https = require('https');
const fs = require('fs');

// URL de Strapi
const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';
const articlesUrl = `${strapiUrl}/api/articles?populate=*`;

console.log(`Conectando a Strapi en: ${articlesUrl}`);

/**
 * Función para hacer peticiones HTTP/HTTPS
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (e) {
          reject(new Error(`Error al parsear la respuesta: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Función principal
async function main() {
  try {
    console.log('Obteniendo datos de Strapi...');
    const data = await fetchUrl(articlesUrl);
    
    console.log('Datos recibidos de Strapi:');
    
    // Guardar los datos completos en un archivo para análisis
    fs.writeFileSync('strapi-data.json', JSON.stringify(data, null, 2));
    console.log('Datos guardados en strapi-data.json');
    
    // Verificar si hay datos
    if (data && data.data && Array.isArray(data.data)) {
      console.log(`Se encontraron ${data.data.length} artículos`);
      
      // Analizar el primer artículo
      if (data.data.length > 0) {
        const firstArticle = data.data[0];
        console.log('\nPrimer artículo:');
        console.log(`ID: ${firstArticle.id}`);
        console.log(`Propiedades: ${Object.keys(firstArticle).join(', ')}`);
        
        // Verificar si tiene atributos
        if (firstArticle.attributes) {
          console.log('\nAtributos del primer artículo:');
          console.log(`Propiedades de attributes: ${Object.keys(firstArticle.attributes).join(', ')}`);
          
          // Verificar slug
          if (firstArticle.attributes.slug) {
            console.log(`Slug: ${firstArticle.attributes.slug}`);
          } else {
            console.log('El artículo no tiene slug definido');
          }
          
          // Imprimir todos los atributos
          console.log('\nTodos los atributos:');
          for (const [key, value] of Object.entries(firstArticle.attributes)) {
            console.log(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
          }
        } else {
          console.log('El artículo no tiene atributos');
        }
      }
    } else {
      console.log('No se encontraron artículos o formato inesperado');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

// Ejecutar la función principal
main();
