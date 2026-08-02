// apps/web/app/planeador/calendario/page.tsx — Calendario unificado del planeador.
// Fusiona tareas del plan y vencimientos tributarios en un solo mes, con filtro
// por etiqueta e interacción (arrastrar para reprogramar, imprimir, detalle).

import CalendarioUnificado from './CalendarioUnificado';

export const dynamic = 'force-dynamic';

export default function CalendarioPage({ searchParams }: { searchParams?: Record<string, string> }) {
  return <CalendarioUnificado mesInicial={searchParams?.mes} />;
}
