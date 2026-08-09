// apps/web/app/portal/visitas/page.tsx — Visitas del cliente (reutiliza el portal
// de visitas). El acceso lo controla el layout del portal; los datos van aislados
// por NIT/grupo desde el backend (GET /visitas/portal).

import PortalVisitas from '@/app/mis-visitas/PortalVisitas';


export const metadata = { title: 'Visitas' };
export const dynamic = 'force-dynamic';

export default function PortalVisitasPage() {
  return <PortalVisitas />;
}
