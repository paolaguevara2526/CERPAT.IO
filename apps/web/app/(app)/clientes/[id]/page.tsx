// Hoja de vida del cliente. Reúne en un solo lugar lo que hoy vive repartido en
// carpetas y correos: identificación, datos de notificación ante la DIAN y la
// cámara de comercio, actividades económicas, representantes legales y registros
// de cámara.
//
// El acceso lo controla el guarda de ruta (/clientes) y, además, el backend:
// consultar es de Administración, Coordinación y Asesores; editar, solo de
// Administración y Coordinación.

import { exigirRuta } from '@/lib/acceso-server';
import FichaCliente from './FichaCliente';

export const metadata = { title: 'Hoja de vida del cliente' };
export const dynamic = 'force-dynamic';

export default async function FichaPage({ params }: { params: { id: string } }) {
  await exigirRuta('/clientes');
  return <FichaCliente empresaId={params.id} />;
}
