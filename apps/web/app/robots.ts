// Reglas para buscadores: se indexa el sitio institucional; el planeador, el
// portal del cliente y la API quedan fuera del índice.
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/planeador', '/portal', '/administracion', '/clientes', '/usuarios', '/coordinacion', '/vencimientos', '/hallazgos', '/login', '/mis-visitas', '/cambiar-clave'],
    }],
    sitemap: 'https://cerpat.io/sitemap.xml',
  };
}
