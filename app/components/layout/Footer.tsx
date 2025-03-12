import Link from 'next/link';

const Footer = () => {
    const currentYear = new Date().getFullYear();
    
    return (
        <footer className="bg-gray-800 text-white py-8">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Columna 1: Acerca de */}
                    <div>
                        <h3 className="text-xl font-bold mb-4">Noticiero Regional</h3>
                        <p className="text-gray-300 mb-4">
                            Noticias actualizadas y confiables de nuestra región.
                            Mantente informado con las últimas noticias sobre política,
                            economía, deportes y cultura.
                        </p>
                    </div>
                    
                    {/* Columna 2: Enlaces rápidos */}
                    <div>
                        <h3 className="text-xl font-bold mb-4">Enlaces rápidos</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/" className="text-gray-300 hover:text-white transition-colors">
                                    Inicio
                                </Link>
                            </li>
                            <li>
                                <Link href={{pathname: '/category/politica'}} className="text-gray-300 hover:text-white transition-colors">
                                    Política
                                </Link>
                            </li>
                            <li>
                                <Link href={{pathname: '/category/economia'}} className="text-gray-300 hover:text-white transition-colors">
                                    Economía
                                </Link>
                            </li>
                            <li>
                                <Link href={{pathname: '/category/deportes'}} className="text-gray-300 hover:text-white transition-colors">
                                    Deportes
                                </Link>
                            </li>
                            <li>
                                <Link href={{pathname: '/category/cultura'}} className="text-gray-300 hover:text-white transition-colors">
                                    Cultura
                                </Link>
                            </li>
                        </ul>
                    </div>
                    
                    {/* Columna 3: Contacto */}
                    <div>
                        <h3 className="text-xl font-bold mb-4">Contacto</h3>
                        <p className="text-gray-300 mb-2">
                            <span className="font-semibold">Dirección:</span> Av. Principal #123, Ciudad
                        </p>
                        <p className="text-gray-300 mb-2">
                            <span className="font-semibold">Teléfono:</span> (123) 456-7890
                        </p>
                        <p className="text-gray-300 mb-2">
                            <span className="font-semibold">Email:</span> contacto@noticieroregional.com
                        </p>
                    </div>
                </div>
                
                {/* Derechos de autor */}
                <div className="border-t border-gray-700 mt-8 pt-6 text-center text-gray-400">
                    <p>&copy; {currentYear} Noticiero Regional. Todos los derechos reservados.</p>
                </div>
            </div>
        </footer>
    );
}
 
export default Footer;