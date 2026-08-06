// apps/web/app/portal/calendario/page.tsx — Calendario del cliente (solo lectura).
// Acceso vía el layout del portal; datos aislados por NIT/grupo.

import PortalCalendario from './PortalCalendario';

export const dynamic = 'force-dynamic';

export default function PortalCalendarioPage() {
  return <PortalCalendario />;
}
