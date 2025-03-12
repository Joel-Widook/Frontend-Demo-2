// Script principal para las noticias
document.addEventListener('DOMContentLoaded', function() {
  console.log('Página de noticias cargada correctamente');
  
  // Agregar interactividad a las imágenes (si existen)
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('click', function() {
      this.classList.toggle('expanded');
    });
  });
  
  // Formatear fechas
  const fechas = document.querySelectorAll('p:contains("Fecha:")');
  fechas.forEach(fecha => {
    const fechaTexto = fecha.textContent;
    fecha.innerHTML = `<strong>${fechaTexto}</strong>`;
  });
});
