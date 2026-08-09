'use client';
// Marco del personal: el marco compartido con la navegación del planeador y el
// buscador global. Vive aparte del layout porque el buscador es de cliente.

import MarcoApp from '@/app/_components/MarcoApp';
import BuscadorGlobal from '@/app/_components/BuscadorGlobal';
import { INICIO, SECCIONES, DESTINOS } from './planeador/navegacion';

export default function BarraApp({ roles, esRoot, children }: {
  roles: string[]; esRoot: boolean; children: React.ReactNode;
}) {
  return (
    <MarcoApp
      titulo="Planeador"
      secciones={SECCIONES}
      inicio={INICIO}
      roles={roles}
      esRoot={esRoot}
      claveMenu="cerpat.sidebar.areas"
      buscador={<BuscadorGlobal destinos={DESTINOS} roles={roles} esRoot={esRoot} />}
    >
      {children}
    </MarcoApp>
  );
}
