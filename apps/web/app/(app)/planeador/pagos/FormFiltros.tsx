'use client';
// Formulario de filtros de Pagos. La vista se arma en el servidor y el filtro
// viaja en la URL; esta cáscara de cliente solo aporta una cosa: enviar al
// CAMBIAR el desplegable, para que se sienta igual que el embudo de las demás
// tablas (antes había que pulsar "Filtrar").
//
// El botón de envío sigue ahí para quien navegue sin JavaScript.

export default function FormFiltros({ children }: { children: React.ReactNode }) {
  return (
    <form
      method="get"
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: 0 }}
    >
      {children}
    </form>
  );
}
