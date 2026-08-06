// apps/web/app/portal/plan/page.tsx — Plan de Trabajo del cliente (solo lectura).
// Acceso vía el layout del portal; datos aislados por NIT/grupo (GET /plan/portal).

import PortalPlan from './PortalPlan';

export const dynamic = 'force-dynamic';

export default function PortalPlanPage() {
  return <PortalPlan />;
}
