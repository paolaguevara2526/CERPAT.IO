// Íconos de la navegación. Antes eran emoji: cada uno con su propio color, peso
// y tamaño, dos secciones distintas compartían el mismo 📊 y en la barra recogida
// costaba distinguirlos de un vistazo. Este juego es de trazo, hereda el color de
// la barra y usa la misma rejilla de 24, así la columna se lee pareja.

type Props = { name: string; size?: number };

// Cada entrada es el contenido del <svg>: se dibuja con trazo, no con relleno.
const D: Record<string, React.ReactNode> = {
  inicio: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M9.75 20v-5.5h4.5V20" /></>,
  dia: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" /></>,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  visitas: <><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>,
  plan: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 2.6h6v2.8H9z" /><path d="M8.5 11h2M8.5 15h2M13 11h2.5M13 15h2.5" /></>,
  tablero: <><rect x="3" y="4" width="5" height="16" rx="1.4" /><rect x="9.5" y="4" width="5" height="10" rx="1.4" /><rect x="16" y="4" width="5" height="13" rx="1.4" /></>,
  flujo: <><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="12" r="2.4" /><path d="M8.4 6h3.1a2 2 0 0 1 2 2v2M8.4 18h3.1a2 2 0 0 0 2-2v-2" /></>,
  lista: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
  asignaciones: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17.5" cy="9.5" r="2.3" /><path d="M15 19a4.6 4.6 0 0 1 5.9-4.4" /></>,
  pagos: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 10v4M18 10v4" /></>,
  vencimientos: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M12 13v3l2 1.2" /></>,
  auditoria: <><path d="M12 2.8 4.8 5.6v5.9c0 4.4 3 8.2 7.2 9.7 4.2-1.5 7.2-5.3 7.2-9.7V5.6L12 2.8Z" /><path d="M9 12.2l2.1 2.1 4-4.2" /></>,
  clientes: <><path d="M3.5 21V6.2L11 3.4V21" /><path d="M11 9.5h9.5V21" /><path d="M6.4 8.6h1.6M6.4 12h1.6M6.4 15.4h1.6M14.2 13h3.2M14.2 16.6h3.2" /></>,
  coordinacion: <><path d="M3.5 3.5v17h17" /><path d="M7.5 16.5v-4M11.8 16.5V8M16 16.5v-6.5M20 16.5V6" /></>,
  usuarios: <><rect x="2.5" y="4.5" width="19" height="15" rx="2.2" /><circle cx="8.7" cy="10.6" r="2.2" /><path d="M5.2 16.2a3.7 3.7 0 0 1 7 0" /><path d="M14.6 9.8h4.2M14.6 13.4h4.2" /></>,
  administracion: <><circle cx="12" cy="12" r="3" /><path d="M19.2 14.4a1.6 1.6 0 0 0 .32 1.76l.06.06a2 2 0 1 1-2.82 2.82l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-.98 1.47V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.76.32l-.06.06a2 2 0 1 1-2.82-2.82l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.47-.98H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.76l-.06-.06a2 2 0 1 1 2.82-2.82l.06.06a1.6 1.6 0 0 0 1.76.32H9a1.6 1.6 0 0 0 .98-1.47V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 .98 1.47 1.6 1.6 0 0 0 1.76-.32l.06-.06a2 2 0 1 1 2.82 2.82l-.06.06a1.6 1.6 0 0 0-.32 1.76V9a1.6 1.6 0 0 0 1.47.98H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.47.98Z" /></>,
  calculadora: <><rect x="5" y="2.5" width="14" height="19" rx="2" /><rect x="7.8" y="5.2" width="8.4" height="3.2" rx="0.8" /><path d="M8.6 12h.01M12 12h.01M15.4 12h.01M8.6 15.2h.01M12 15.2h.01M15.4 15.2h.01M8.6 18.4h.01M12 18.4h.01M15.4 18.4h.01" /></>,
  equilibrio: <><path d="M3.5 3.5v17h17" /><path d="M6.5 17.5 19 7" /><path d="M6.5 8.5 19 17" /></>,
  hallazgos: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="M15.4 15.4 21 21" /></>,
  herramientas: <><rect x="3" y="7.5" width="18" height="12.5" rx="2" /><path d="M8.6 7.5V5.8a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v1.7" /><path d="M3 12.4h18" /><path d="M10.4 12.4v1.8h3.2v-1.8" /></>,
};

export default function Ico({ name, size = 18 }: Props) {
  const d = D[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}>
      {d}
    </svg>
  );
}
