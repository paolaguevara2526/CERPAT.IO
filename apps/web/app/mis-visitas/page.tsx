// /mis-visitas quedó como dirección heredada: era el portal de visitas cuando
// todavía no existía el Portal del Cliente, y traía su propio marco escrito a
// mano —el mismo contenido, dos veces—. Ahora redirige al portal, que tiene el
// marco compartido y el resto de secciones del cliente.

import { redirect } from 'next/navigation';

export default function MisVisitasPage() {
  redirect('/portal/visitas');
}
