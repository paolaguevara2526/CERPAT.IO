// Mapa del sitio para buscadores. Incluye solo las páginas públicas del sitio
// institucional (el planeador y el portal quedan fuera: exigen sesión).
import type { MetadataRoute } from 'next';

const BASE = 'https://cerpat.io';

export default function sitemap(): MetadataRoute.Sitemap {
  const hoy = new Date();
  return [
    { url: `${BASE}/`, lastModified: hoy, changeFrequency: 'monthly', priority: 1 },
    { url: `${BASE}/servicios`, lastModified: hoy, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/nosotros`, lastModified: hoy, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/contacto`, lastModified: hoy, changeFrequency: 'yearly', priority: 0.7 },
    { url: `${BASE}/trabaja-con-nosotros`, lastModified: hoy, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
