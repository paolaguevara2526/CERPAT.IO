// apps/web/app/portal/page.tsx — Inicio del Portal del Cliente. Presenta las
// secciones disponibles. Contenido aislado por NIT/grupo (validado en el backend).

export const dynamic = 'force-dynamic';

type Acceso = { titulo: string; desc: string; href: string | null; icon: string; externo?: boolean };
const ACCESOS: Acceso[] = [
  { titulo: 'Visitas', desc: 'Las actas de las visitas de tu equipo asesor y los compromisos acordados.', href: '/portal/visitas', icon: '🤝' },
  { titulo: 'Hallazgos', desc: 'Los hallazgos de tu Revisoría Fiscal y su estado de resolución.', href: '/portal/hallazgos', icon: '🔎' },
  { titulo: 'Calendario', desc: 'Tus visitas y las fechas de tus obligaciones tributarias.', href: null, icon: '📅' },
  { titulo: 'Plan de Trabajo', desc: 'El cumplimiento de las actividades contables de tu empresa.', href: null, icon: '📊' },
  { titulo: 'Pagos', desc: 'Tus obligaciones por pagar, con fechas y valores.', href: null, icon: '💲' },
  { titulo: 'Calculadora de retenciones', desc: 'Retención en la fuente por concepto, con tarifas al día.', href: '/servicios/retenciones', icon: '🧮', externo: true },
];

export default function PortalInicio() {
  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Bienvenido a tu portal 👋</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px', maxWidth: 620 }}>Aquí puedes consultar, en modo lectura, la información de tu empresa: tus visitas, hallazgos, el plan de trabajo, tus vencimientos y pagos. Usa el menú de la izquierda.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 14 }}>
        {ACCESOS.map((a) => {
          const contenido = (
            <div className="panel" style={{ padding: '16px 18px', height: '100%', display: 'flex', flexDirection: 'column', gap: 6, opacity: a.href ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <b style={{ fontSize: 14.5 }}>{a.titulo}</b>
                {!a.href && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--panel-2)', borderRadius: 20, padding: '2px 8px' }}>Pronto</span>}
                {a.externo && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>↗</span>}
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{a.desc}</span>
            </div>
          );
          if (!a.href) return <div key={a.titulo}>{contenido}</div>;
          if (a.externo) return <a key={a.titulo} href={a.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>{contenido}</a>;
          return <a key={a.titulo} href={a.href} style={{ textDecoration: 'none', color: 'inherit' }}>{contenido}</a>;
        })}
      </div>
    </>
  );
}
