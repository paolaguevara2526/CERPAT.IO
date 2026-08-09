// El título vive aquí porque la página es un componente de cliente y
// Next.js no permite exportar metadata desde uno.
export const metadata = { title: 'Cambiar contraseña' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
