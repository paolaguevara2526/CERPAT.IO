// apps/web/app/portal/hallazgos/page.tsx — Hallazgos del cliente (reutiliza el
// portal de hallazgos en modo solo lectura). Acceso vía el layout del portal;
// datos aislados por NIT/grupo desde el backend.

import PortalHallazgos from '@/app/hallazgos/PortalHallazgos';

export const dynamic = 'force-dynamic';

export default function PortalHallazgosPage() {
  return <PortalHallazgos esGestor={false} />;
}
