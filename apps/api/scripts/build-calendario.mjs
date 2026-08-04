// apps/api/scripts/build-calendario.mjs
// Genera apps/api/src/vencimientos/calendario-2026.ts a partir de los CSV
// fuente en docs/data/. Los CSV son la fuente editable por humanos; este
// módulo .ts es lo que la API empaqueta y usa en runtime (el generador de
// vencimientos). Ejecutar desde la raíz del repo tras editar los CSV:
//   node apps/api/scripts/build-calendario.mjs
import fs from 'node:fs';
function parseCSV(text){const rows=[];let row=[];let field='';let q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else q=false;}else field+=c;}else if(c==='"')q=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}else if(c==='\r'){}else field+=c;}if(field.length||row.length){row.push(field);rows.push(row);}return rows;}
const objs=(file)=>{const filas=parseCSV(fs.readFileSync(file,'utf8')).filter(r=>r.some(c=>c.trim()!==''));const head=filas[0].map(h=>h.trim());return filas.slice(1).map(r=>Object.fromEntries(head.map((h,i)=>[h,(r[i]??'').trim()])));};
const tributario=objs('docs/data/calendario-tributario-2026.csv').map(r=>({obligacion:r.obligacion,periodicidad:r.periodicidad,periodo:r.periodo,ultimo_digito:r.ultimo_digito,fecha_vencimiento:r.fecha_vencimiento}));
const renta=objs('docs/data/calendario-renta-consolidadas-2026.csv').map(r=>({obligacion:r.obligacion,subtipo:r.subtipo,digito_o_rango:r.digito_o_rango,fecha_vencimiento:r.fecha_vencimiento}));

// ---- ICA municipal ----
// El CSV tiene DOS secciones: (A) filas por municipio con fecha fija o marcadas
// "por dígito NIT" (fecha vacía), y (B) tras la línea "# Tablas por dígito del
// NIT", tablas municipio × dígito → 3 fechas bimestrales. Se aplanan a filas
// con ultimo_digito ('' = aplica a todos; un dígito = solo ese NIT).
function buildIca(){
  const filas=parseCSV(fs.readFileSync('docs/data/calendario-ica-municipal-2026.csv','utf8')).filter(r=>r.some(c=>c.trim()!==''));
  const marca=filas.findIndex(r=>(r[0]||'').trim().startsWith('#'));
  const finA=marca===-1?filas.length:marca;
  const headA=filas[0].map(h=>h.trim());
  const secA=filas.slice(1,finA).map(r=>Object.fromEntries(headA.map((h,i)=>[h,(r[i]??'').trim()])));
  // Sección B: dígito → fecha por (municipio, periodo bimestral).
  const porDig=new Map(); // `${muni}|${periodo}|${dig}` -> fecha
  if(marca!==-1){
    const headB=filas[marca+1].map(h=>h.trim());
    const secB=filas.slice(marca+2).map(r=>Object.fromEntries(headB.map((h,i)=>[h,(r[i]??'').trim()])));
    const cols=[['fecha_jul_ago','jul-ago'],['fecha_sep_oct','sep-oct'],['fecha_nov_dic','nov-dic']];
    for(const r of secB){
      const digs=(r.ultimo_digito_nit||'').match(/\d/g)||[];
      for(const [col,per] of cols){ const f=(r[col]||'').trim(); if(!f) continue; for(const d of digs) porDig.set(`${r.municipio}|${per}|${d}`,f); }
    }
  }
  const out=[];
  for(const r of secA){
    const base={municipio:r.municipio,departamento:r.departamento,obligacion:r.obligacion,periodicidad:r.periodicidad,periodo:r.periodo};
    if(r.fecha_vencimiento){ out.push({...base,ultimo_digito:'',fecha_vencimiento:r.fecha_vencimiento}); continue; }
    // Fecha vacía → resolver por dígito (solo si hay tabla para ese municipio/periodo).
    for(let d=0;d<=9;d++){ const f=porDig.get(`${r.municipio}|${r.periodo}|${d}`); if(f) out.push({...base,ultimo_digito:String(d),fecha_vencimiento:f}); }
  }
  return out;
}
const ica=buildIca();

const header=`// apps/api/src/vencimientos/calendario-2026.ts\n// AUTO-GENERADO desde docs/data/calendario-tributario-2026.csv,\n// docs/data/calendario-renta-consolidadas-2026.csv y\n// docs/data/calendario-ica-municipal-2026.csv. No editar a mano: si cambian\n// los CSV, vuelve a generarlo con scripts/build-calendario.mjs.\n\nexport type FilaTributario = { obligacion: string; periodicidad: string; periodo: string; ultimo_digito: string; fecha_vencimiento: string };\nexport type FilaRenta = { obligacion: string; subtipo: string; digito_o_rango: string; fecha_vencimiento: string };\nexport type FilaIca = { municipio: string; departamento: string; obligacion: string; periodicidad: string; periodo: string; ultimo_digito: string; fecha_vencimiento: string };\n\nexport const CALENDARIO_2026: { anio: number; tributario: FilaTributario[]; renta: FilaRenta[]; ica: FilaIca[] } = `;
const body=JSON.stringify({anio:2026,tributario,renta,ica},null,2);
fs.writeFileSync('apps/api/src/vencimientos/calendario-2026.ts',header+body+';\n');
console.log('calendario-2026.ts generado — tributario:',tributario.length,'renta:',renta.length,'ica:',ica.length);
