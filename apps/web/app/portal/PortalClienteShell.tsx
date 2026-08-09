'use client';
// Marco del Portal del Cliente. Usa EXACTAMENTE el mismo marco que el personal
// —barra única, menú en acordeón que se recoge y se asoma, íconos propios, temas,
// buscador— con su propia navegación. Antes tenía un marco aparte, escrito a
// mano, que se fue quedando atrás: mientras el planeador mejoraba, el cliente
// seguía viendo la versión vieja.
//
// Todo lo del cliente es SOLO LECTURA y está aislado a su NIT/grupo (lo valida
// el backend). Los Servicios son herramientas públicas.

import MarcoApp from '@/app/_components/MarcoApp';
import BuscadorGlobal from '@/app/_components/BuscadorGlobal';
import { INICIO_PORTAL, SECCIONES_PORTAL, DESTINOS_PORTAL } from './navegacion';

export default function PortalClienteShell({ esPreview, children }: { esPreview: boolean; children: React.ReactNode }) {
  return (
    <MarcoApp
      titulo="Portal del Cliente"
      secciones={SECCIONES_PORTAL}
      inicio={INICIO_PORTAL}
      claveMenu="cerpat.portal.areas"
      aviso={esPreview ? 'Vista de la firma · previsualización' : 'Solo consulta'}
      buscador={<BuscadorGlobal destinos={DESTINOS_PORTAL} />}
    >
      {children}
    </MarcoApp>
  );
}
