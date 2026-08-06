// apps/web/app/portal/pagos/page.tsx — Pagos del cliente (solo lectura). Acceso vía
// el layout del portal; datos aislados por NIT/grupo (GET /vencimientos/portal-pagos).

import PortalPagos from './PortalPagos';

export const dynamic = 'force-dynamic';

export default function PortalPagosPage() {
  return <PortalPagos />;
}
