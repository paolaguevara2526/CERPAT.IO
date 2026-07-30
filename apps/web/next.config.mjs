/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // La raíz "/" ahora sirve el home institucional (app/page.tsx).
      // El planeador (prototipo funcional, public/planeador-cerpat.html) se
      // sirve en "/app" mientras reconstruimos las vistas en React.
      // Fuente del prototipo: prototipo-referencia/planeador-cerpat.html.
      beforeFiles: [
        { source: '/app', destination: '/planeador-cerpat.html' },
        // Calculadoras de la sección Servicios (HTML estáticos autónomos).
        { source: '/servicios/retenciones', destination: '/servicios/retenciones.html' },
        { source: '/servicios/punto-equilibrio', destination: '/servicios/punto-equilibrio.html' },
      ],
    };
  },
};

export default nextConfig;
