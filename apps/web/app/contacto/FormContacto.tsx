'use client';
// Formulario de contacto. Sin plugins ni servicios externos: compone el correo con
// los datos y lo abre en el gestor de correo del visitante. Cuando se conecte el
// envío por Microsoft 365 (ver docs/arquitectura.md) se cambia el submit por una
// llamada a la API, sin tocar el resto de la página.

import { useState } from 'react';
import { CONTACTO, INDIGO, btnPrimario } from '../_sitio/Sitio';

const SERVICIOS = [
  'Asesoría Contable y Financiera', 'Asesoría Tributaria', 'Revisoría Fiscal', 'Auditoría Forense',
  'Auditoría Externa', 'Servicios Administrativos', 'Oficial de Cumplimiento', 'Asesoría Jurídica',
];

const campo: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #d0d5dd',
  fontSize: 15, fontFamily: 'inherit', color: '#101828', background: '#fff',
};
const etiqueta: React.CSSProperties = { display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 6, color: '#344054' };

export default function FormContacto() {
  const [f, setF] = useState({ nombre: '', email: '', telefono: '', servicio: SERVICIOS[0], mensaje: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim() || !f.email.trim()) { setError('Por favor indícanos tu nombre y tu correo.'); return; }
    setError(null);
    const cuerpo = [
      `Nombre: ${f.nombre}`, `Email: ${f.email}`, `Teléfono: ${f.telefono || '—'}`,
      `Servicio de interés: ${f.servicio}`, '', 'Mensaje:', f.mensaje || '—',
    ].join('\n');
    window.location.href = `mailto:${CONTACTO.email}?subject=${encodeURIComponent(`Solicitud de asesoría — ${f.nombre}`)}&body=${encodeURIComponent(cuerpo)}`;
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && <div style={{ background: '#FBE4E1', color: '#B42318', borderRadius: 8, padding: '10px 13px', fontSize: 14, fontWeight: 600 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <label><span style={etiqueta}>Nombre *</span><input style={campo} value={f.nombre} onChange={(e) => set('nombre', e.target.value)} required /></label>
        <label><span style={etiqueta}>Email *</span><input type="email" style={campo} value={f.email} onChange={(e) => set('email', e.target.value)} required /></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <label><span style={etiqueta}>Teléfono</span><input style={campo} value={f.telefono} onChange={(e) => set('telefono', e.target.value)} /></label>
        <label><span style={etiqueta}>Servicio</span>
          <select style={campo} value={f.servicio} onChange={(e) => set('servicio', e.target.value)}>
            {SERVICIOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label><span style={etiqueta}>Mensaje</span><textarea style={{ ...campo, minHeight: 120, resize: 'vertical' }} value={f.mensaje} onChange={(e) => set('mensaje', e.target.value)} /></label>
      <button type="submit" style={{ ...btnPrimario, alignSelf: 'flex-start', fontFamily: 'inherit' }}>Enviar solicitud</button>
      <p style={{ fontSize: 12.5, color: '#667085', margin: 0 }}>
        Al enviar se abrirá tu gestor de correo con la solicitud lista. También puedes escribirnos directo a{' '}
        <a href={`mailto:${CONTACTO.email}`} style={{ color: INDIGO, fontWeight: 700 }}>{CONTACTO.email}</a>.
      </p>
    </form>
  );
}
