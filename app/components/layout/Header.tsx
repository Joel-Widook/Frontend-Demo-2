import Link from 'next/link';

const Header = () => {
    return (
        <header className="bg-white shadow-md">
            <div className="container mx-auto px-4 py-4">
                <div className="flex justify-between items-center">
                    {/* Logo y nombre del noticiero */}
                    <Link href="/" className="flex items-center space-x-3">
                        <div className="font-bold text-2xl text-blue-800">Noticiero Regional</div>
                    </Link>

                    {/* Navegación principal */}
                    <nav className="hidden md:flex space-x-8">
                        <Link href="/" className="text-gray-700 hover:text-blue-800 font-medium">
                            Inicio
                        </Link>
                        <Link href={{pathname: '/category/politica'}} className="text-gray-700 hover:text-blue-800 font-medium">
                            Política
                        </Link>
                        <Link href={{pathname: '/category/economia'}} className="text-gray-700 hover:text-blue-800 font-medium">
                            Economía
                        </Link>
                        <Link href={{pathname: '/category/deportes'}} className="text-gray-700 hover:text-blue-800 font-medium">
                            Deportes
                        </Link>
                        <Link href={{pathname: '/category/cultura'}} className="text-gray-700 hover:text-blue-800 font-medium">
                            Cultura
                        </Link>
                    </nav>

                    {/* Botón de menú móvil */}
                    <button className="md:hidden text-gray-700 hover:text-blue-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    );
}
 
export default Header;