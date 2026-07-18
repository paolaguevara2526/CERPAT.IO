/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // Se evalúa antes del sistema de archivos y de las rutas de la app:
      // la raíz "/" sirve el prototipo funcional del planeador
      // (public/planeador-cerpat.html) mientras reconstruimos las vistas en
      // React. Fuente: prototipo-referencia/planeador-cerpat.html.
      beforeFiles: [
        { source: '/', destination: '/planeador-cerpat.html' },
      ],
    };
  },
};

export default nextConfig;
