export function Footer() {
    return (
        <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
                <p className="font-sans text-sm text-gray-500">
                    <a
                        href="https://www.adhoc.inc"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-adhoc-violet hover:text-adhoc-coral transition-colors font-medium"
                    >
                        Conocé más sobre la tecnología de Adhoc →
                    </a>
                </p>
                <p className="font-sans text-sm text-gray-400">
                    © {new Date().getFullYear()} Adhoc S.A. - Soluciones Tecnológicas. Todos los derechos reservados.
                </p>
            </div>
        </footer>
    )
}
