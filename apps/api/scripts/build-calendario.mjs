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
const header=`// apps/api/src/vencimientos/calendario-2026.ts\n// AUTO-GENERADO desde docs/data/calendario-tributario-2026.csv y\n// docs/data/calendario-renta-consolidadas-2026.csv. No editar a mano: si cambian\n// los CSV, vuelve a generarlo con scripts/build-calendario.mjs.\n\nexport type FilaTributario = { obligacion: string; periodicidad: string; periodo: string; ultimo_digito: string; fecha_vencimiento: string };\nexport type FilaRenta = { obligacion: string; subtipo: string; digito_o_rango: string; fecha_vencimiento: string };\n\nexport const CALENDARIO_2026: { anio: number; tributario: FilaTributario[]; renta: FilaRenta[] } = `;
const body=JSON.stringify({anio:2026,tributario,renta},null,2);
fs.writeFileSync('apps/api/src/vencimientos/calendario-2026.ts',header+body+';\n');
console.log('calendario-2026.ts generado — tributario:',tributario.length,'renta:',renta.length);
