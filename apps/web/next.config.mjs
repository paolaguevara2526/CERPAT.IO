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
      ],
    };
  },
};

export default nextConfig;
