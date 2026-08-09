'use client';
// Repaso del RUB sobre todos los clientes: en cuáles hay que actuar.
//
// El estado de UN cliente se ve en su hoja de vida (Clientes → el cliente →
// Situación tributaria), que es donde se revisa a alguien en concreto. Esta
// pantalla responde la otra pregunta, la que no cabe en una ficha: «¿a cuáles de
// mis clientes les falta?». Recorrer 90 fichas de una en una no es viable, y así
// fue como se encontró el problema. Cada fila lleva a su hoja de vida.
//
// La obligación se deriva del TIPO DE EMPRESA (naturaleza jurídica). Cuando no
// aparece siempre es una de dos cosas —el cliente no tiene tipo asignado, o su
// tipo no se reconoce como obligado— y sin verlo no queda más que adivinar.

import { useCallback, useEffect, useState } from 'react';
import TablaDatos, { type Columna } from '@/app/_components/TablaDatos';

type Fila = {
  empresaId: string; empresa: string; tipo: string | null;
  aplica: boolean; vencimientosRub: number;
  estado: 'sin_tipo' | 'tipo_no_obligado' | 'falta_regenerar' | 'ok';
};

const EST: Record<Fila['estado'], { texto: string; color: string; queHacer: string }> = {
  ok: { texto: 'Con RUB', color: 'var(--exito)', queHacer: 'Todo en orden.' },
  falta_regenerar: {
    texto: 'Falta regenerar', color: 'var(--info)',
    queHacer: 'Le aplica el RUB pero no lo tiene cargado. Regenera sus vencimientos desde Config. tributaria.',
  },
  sin_tipo: {
    texto: 'Sin tipo de empresa', color: 'var(--peligro)',
    queHacer: 'El cliente no tiene tipo asignado, así que no se puede saber si le aplica. Asígnaselo en Empresas.',
  },
  tipo_no_obligado: {
    texto: 'No obligado', color: 'var(--muted)',
    queHacer: 'Su tipo de empresa no está obligado al RUB (p. ej. persona natural).',
  },
};

export default function DiagnosticoRub() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const d = await fetch('/api/vencimientos/rub/diagnostico', { cache: 'no-store' }).then((r) => r.json());
      if (d.error) setError(d.error); else { setFilas(d.filas ?? []); setError(null); }
    } catch { setError('Error de red.'); }
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const sinTipo = filas.filter((f) => f.estado === 'sin_tipo').length;
  const faltan = filas.filter((f) => f.estado === 'falta_regenerar').length;

  const columnas: Columna<Fila>[] = [
    {
      clave: 'empresa', label: 'Cliente', valor: (f) => f.empresa, buscar: true, estiloCelda: { fontWeight: 600 },
      // El detalle de cada cliente vive en su hoja de vida; desde aquí se llega
      // en un clic en vez de volver a buscarlo en el listado de Clientes.
      render: (f) => <a href={`/clientes/${f.empresaId}`} style={{ color: 'var(--navy)', textDecoration: 'none', fontWeight: 700 }}>{f.empresa}</a>,
    },
    { clave: 'tipo', label: 'Tipo de empresa', valor: (f) => f.tipo ?? '(sin tipo)', estiloCelda: { color: 'var(--muted)' } },
    { clave: 'aplica', label: '¿Le aplica?', valor: (f) => (f.aplica ? 'Sí' : 'No') },
    { clave: 'rub', label: 'RUB cargados', valor: (f) => String(f.vencimientosRub), orden: (f) => f.vencimientosRub, estilo: { textAlign: 'right' }, estiloCelda: { textAlign: 'right', color: 'var(--muted)' } },
    {
      clave: 'estado', label: 'Estado', valor: (f) => EST[f.estado].texto,
      render: (f) => <span className="chip" style={{ color: EST[f.estado].color, borderColor: EST[f.estado].color }} title={EST[f.estado].queHacer}>{EST[f.estado].texto}</span>,
    },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Diagnóstico del RUB</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px', maxWidth: 780, lineHeight: 1.6 }}>
        El RUB se genera según la <strong>naturaleza jurídica</strong> del cliente, o sea su <strong>tipo de empresa</strong>:
        personas jurídicas, consorcios y uniones temporales sí; personas naturales no. Esta pantalla es el
        repaso <strong>sobre todos los clientes a la vez</strong>, para ver en cuáles hay que actuar. El estado de
        uno solo está en su <strong>hoja de vida</strong> — pincha su nombre para abrirla.
      </p>

      {error && <div className="panel" style={{ padding: '10px 14px', color: 'var(--peligro-fuerte)', background: 'var(--peligro-suave)', borderColor: 'var(--peligro-borde)', fontWeight: 600, marginBottom: 14 }}>{error}</div>}

      {!cargando && (sinTipo > 0 || faltan > 0) && (
        <div className="panel" style={{ padding: '12px 15px', marginBottom: 14, fontSize: 13, lineHeight: 1.7 }}>
          {sinTipo > 0 && (
            <div>
              <strong style={{ color: 'var(--peligro)' }}>{sinTipo} cliente(s) sin tipo de empresa.</strong>{' '}
              Sin ese dato no se puede saber si les aplica el RUB — y tampoco otras reglas que dependan de la
              naturaleza jurídica. Asígnaselo en <em>Empresas</em> y luego regenera sus vencimientos.
            </div>
          )}
          {faltan > 0 && (
            <div style={{ marginTop: sinTipo ? 6 : 0 }}>
              <strong style={{ color: 'var(--info)' }}>{faltan} cliente(s) con RUB pendiente de generar.</strong>{' '}
              Les aplica pero no lo tienen. Regenéralos desde <em>Config. tributaria</em>.
            </div>
          )}
        </div>
      )}

      {cargando ? (
        <div className="panel" style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>
      ) : (
        <TablaDatos filas={filas} columnas={columnas} idDe={(f) => f.empresaId}
          vacio="No hay clientes activos." sinCoincidencias="Ningún cliente cumple los filtros." />
      )}
    </div>
  );
}
