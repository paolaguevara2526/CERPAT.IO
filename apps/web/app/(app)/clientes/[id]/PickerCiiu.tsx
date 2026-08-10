'use client';
// Buscador de códigos CIIU (Rev. 4 A.C. del DANE, 499 clases).
//
// Antes el código y la descripción se escribían a mano. Con 499 clases de
// nombres largos y parecidos —«Comercio al por menor en establecimientos no
// especializados con surtido compuesto principalmente por alimentos…»— eso
// garantiza descripciones que no coinciden entre clientes y códigos tecleados
// mal, y el CIIU es lo que la DIAN y la cámara usan para clasificar al cliente.
//
// Se busca por código o por texto, con o sin tildes, y al elegir se llenan los
// dos campos. La descripción sigue siendo editable: a veces el RUT trae una
// redacción propia y no queremos pelear con el documento del cliente.

import { useEffect, useMemo, useRef, useState } from 'react';

type Clase = { codigo: string; descripcion: string; seccion: string };

let cache: { clases: Clase[]; secciones: Record<string, string> } | null = null;

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function PickerCiiu({ valor, descripcion, onElegir, estilo }: {
  valor: string;
  descripcion: string;
  onElegir: (codigo: string, descripcion: string) => void;
  estilo: React.CSSProperties;
}) {
  const [datos, setDatos] = useState(cache);
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cache) return;
    fetch('/api/ficha/ciiu', { cache: 'force-cache' }).then((r) => r.json())
      .then((d) => { cache = { clases: d.clases ?? [], secciones: d.secciones ?? {} }; setDatos(cache); })
      .catch(() => {});
  }, []);

  // Cerrar al hacer clic fuera: sin esto el desplegable tapa el resto del
  // formulario y no hay forma obvia de quitarlo de en medio.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const resultados = useMemo(() => {
    const clases = datos?.clases ?? [];
    const t = sinTildes(q.trim());
    if (!t) return clases.slice(0, 60);
    // El código pesa más que el texto: quien escribe "6920" busca ese código,
    // no las descripciones donde aparezcan esos dígitos.
    const porCodigo = clases.filter((c) => c.codigo.startsWith(t));
    const porTexto = clases.filter((c) => !c.codigo.startsWith(t) && sinTildes(c.descripcion).includes(t));
    return [...porCodigo, ...porTexto].slice(0, 60);
  }, [datos, q]);

  const elegida = datos?.clases.find((c) => c.codigo === valor);

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <input
        style={estilo}
        value={abierto ? q : valor}
        placeholder="Código o actividad…"
        onFocus={() => { setQ(''); setAbierto(true); }}
        onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
      />
      {!abierto && elegida && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>
          {datos?.secciones[elegida.seccion] ? `Sección ${elegida.seccion} · ${datos.secciones[elegida.seccion]}` : null}
        </div>
      )}
      {!abierto && !elegida && valor.trim() !== '' && (
        <div style={{ fontSize: 11, color: 'var(--alerta-fuerte)', marginTop: 3 }}>
          «{valor}» no es una clase CIIU vigente.
        </div>
      )}

      {abierto && (
        <div className="panel" style={{
          position: 'absolute', zIndex: 60, top: 'calc(100% + 3px)', left: 0, right: 0, minWidth: 340,
          maxHeight: 300, overflow: 'auto', padding: 4, boxShadow: '0 8px 24px rgba(10,18,34,.18)',
        }}>
          {!datos ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: '7px 8px' }}>Cargando la lista del DANE…</div>
          ) : resultados.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: '7px 8px' }}>Ninguna clase coincide con «{q.trim()}».</div>
          ) : resultados.map((c) => (
            <button key={c.codigo} type="button"
              onClick={() => { onElegir(c.codigo, c.descripcion); setAbierto(false); setQ(''); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
                borderRadius: 4, padding: '6px 8px', cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--ui)',
                color: 'var(--ink)', lineHeight: 1.45,
              }}>
              <strong style={{ fontFamily: 'var(--mono)' }}>{c.codigo}</strong>{' '}
              <span style={{ color: 'var(--muted)' }}>{c.descripcion}</span>
            </button>
          ))}
        </div>
      )}
      {/* La descripción se muestra debajo por el campo de al lado; aquí solo se
          usa para saber si el código elegido ya trajo texto. */}
      <span hidden>{descripcion}</span>
    </div>
  );
}
