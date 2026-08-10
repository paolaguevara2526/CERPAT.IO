"""Extrae la estructura detallada de la CIIU Rev. 4 A.C. (2020) del PDF del DANE.

Herramienta de un solo uso, guardada para cuando el DANE publique una revisión
nueva: sin ella habría que volver a descubrir cómo está armado el PDF. Produce
`ciiu-rev4-ac.csv`, de donde se genera `apps/api/src/fiscal/ciiu-rev4-ac.ts`.

    pip install pypdf
    curl -o CIIU_Rev_4_AC.pdf \\
      https://www.dane.gov.co/files/acerca/Normatividad/resoluciones/2020/CIIU_Rev_4_AC.pdf
    python3 ciiu-desde-pdf-dane.py

Ajusta RUTA y PAG_INI/PAG_FIN al documento nuevo, y **vuelve a correr las
pruebas de `ciiu-rev4-ac.test.ts`**: un PDF se parsea mal en silencio, y lo que
se rompe no es el build sino la clasificación de los clientes.


El PDF trae la estructura como tabla: División | Grupo | Clase | Descripción.
Dos formas conviven, y confundirlas cuesta clases enteras:

    '  4721 Comercio al por menor de productos agrícolas para el consumo en '
    'establecimientos especializados '          <- continuación

    '  4711 '                                    <- código solo
    'Comercio al por menor en establecimientos no especializados con surtido '
    'compuesto principalmente por alimentos, ... '

Además los encabezados de grupo y de división también parten su texto en varias
líneas, y esas continuaciones NO son de la clase anterior. Por eso el parser
lleva un estado explícito de "a quién pertenece la línea que sigue".
"""
import pickle, re, json, sys

RUTA = '/tmp/claude-0/-home-user-CERPAT-IO/e2694d9f-f97e-56dd-b581-034a3d98c1b8/scratchpad'
PAG_INI, PAG_FIN = 84, 124  # sección "10. Estructura detallada"

# El número de página SIEMPRE trae la barra ('|104'). Aceptar también dígitos
# sueltos descartaba las clases que van solas en su línea, como 4711 y 4719.
RUIDO = re.compile(
    r'^\s*(\|\s*\d+\s*|Clasificaci[óo]n Industrial.*|Revisi[óo]n 4 Adaptada.*'
    r'|Divisi[óo]n\s+Grupo\s+Clase\s+Descripci[óo]n\s*|10\.\s*Estructura detallada\s*)$'
)

paginas = pickle.load(open(f'{RUTA}/paginas.pkl', 'rb'))

clases = {}
seccion = seccion_nombre = division = grupo = None
destino = None          # 'clase' | 'seccion' | 'otro' — dueño de las continuaciones
actual = None           # [codigo, [partes...], division, grupo]


def cerrar():
    global actual
    if actual:
        cod, partes, div, gr = actual
        desc = re.sub(r'\s+', ' ', ' '.join(partes)).strip()
        if cod not in clases:
            clases[cod] = {'codigo': cod, 'descripcion': desc, 'seccion': seccion,
                           'seccionNombre': seccion_nombre, 'division': div, 'grupo': gr}
        actual = None


def norm(s):
    return re.sub(r'\s+', ' ', s or '').strip().lower()


for i in range(PAG_INI, PAG_FIN):
    lineas = paginas[i].split('\n')
    j = -1
    while j + 1 < len(lineas):
        j += 1
        ln = lineas[j].rstrip()
        if not ln.strip() or RUIDO.match(ln):
            continue

        m = re.match(r'^\s*Secci[óo]n\s+([A-U])\s*$', ln.strip())
        if m:
            # Cada página repite "Sección X" + su título como encabezado. Si es la
            # sección que ya venía, NO es una sección nueva: tratarla como tal
            # cerraba la clase en curso y le comía la continuación cuando la
            # descripción cruzaba el salto de página (así se perdió «transmisión»
            # de la clase 2814).
            if m.group(1) == seccion and seccion_nombre:
                visto = ''
                while j + 1 < len(lineas):
                    cand = lineas[j + 1].strip()
                    if not cand or RUIDO.match(lineas[j + 1]):
                        j += 1; continue
                    posible = norm(visto + ' ' + cand)
                    if norm(seccion_nombre).startswith(posible):
                        visto = visto + ' ' + cand
                        j += 1
                        if posible == norm(seccion_nombre):
                            break
                    else:
                        break
                continue  # sigue abierta la clase que venía
            cerrar(); seccion = m.group(1); seccion_nombre = None
            destino = 'seccion'; continue

        m = re.match(r'^\s*Divisi[óo]n\s+(\d{2})\b\s*(.*)$', ln)
        if m:
            cerrar(); division = m.group(1); grupo = None
            destino = 'otro'; continue

        # Clase: 4 dígitos, con o sin el grupo delante, con o sin descripción.
        m = re.match(r'^\s*(\d{3})?\s*(\d{4})\s*(.*)$', ln)
        if m:
            cerrar()
            if m.group(1):
                grupo = m.group(1)
            resto = m.group(3).strip()
            actual = [m.group(2), [resto] if resto else [], division, grupo]
            destino = 'clase'; continue

        # Encabezado de grupo (3 dígitos + texto).
        m = re.match(r'^\s*(\d{3})\s+(\D.*)$', ln)
        if m:
            cerrar(); grupo = m.group(1)
            destino = 'otro'; continue

        # Continuación: pertenece a lo último que la abrió.
        if destino == 'clase' and actual is not None:
            actual[1].append(ln.strip())
        elif destino == 'seccion' and seccion_nombre is None:
            seccion_nombre = re.sub(r'\s+', ' ', ln.strip())
        elif destino == 'seccion':
            seccion_nombre += ' ' + re.sub(r'\s+', ' ', ln.strip())

cerrar()

filas = sorted(clases.values(), key=lambda c: c['codigo'])
sin_desc = [c['codigo'] for c in filas if not c['descripcion']]
print('clases:', len(filas))
print('secciones:', ''.join(sorted({c['seccion'] for c in filas if c['seccion']})))
print('sin descripción:', sin_desc or 'ninguna')
json.dump(filas, open(f'{RUTA}/ciiu.json', 'w'), ensure_ascii=False, indent=1)

for cod in ('0111', '4711', '4719', '6920', '4645', '8621', '9900', '0322', '5611', '4111'):
    c = clases.get(cod)
    print(f'  {cod} -> {c["descripcion"][:88] if c else "NO ENCONTRADA"}')
