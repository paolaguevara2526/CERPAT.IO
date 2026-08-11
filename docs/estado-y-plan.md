# Estado y plan — Planeador CERPAT

Documento vivo del estado en producción y el roadmap. Actualizar en cada avance.
Para el **modelo de operación** (flujo, roles, entregas y medición) ver
[`metodologia-operacion.md`](./metodologia-operacion.md). Para la **visión de
plataforma** (de planeador a producto SaaS multi-módulo, modalidades, módulos,
fundaciones y nomenclatura) ver [`vision-plataforma.md`](./vision-plataforma.md).

_Última actualización: 2026-08-09._

## En producción hoy

| Capa | Servicio | Estado |
|---|---|---|
| Frontend | Vercel — `apps/web` (Next.js) | ✅ desplegado |
| Dominio | `cerpat.io` (+ `www`) en Hostinger → Vercel | ✅ activo (HTTPS) |
| Backend | Railway — `apps/api` (Express) | ✅ Online |
| Base de datos | Railway — PostgreSQL (Prisma) | ✅ conectada |
| Esquema | multi-tenant + rol root, **migraciones versionadas** (`migrate deploy` en cada despliegue) | ✅ |
| Datos | organización **CERPAT** + **90 clientes reales** cargados | ✅ |
| Autenticación | login propio (JWT + scrypt, cookie httpOnly) y guardas por rol | ✅ |
| Sitio institucional | `cerpat.io` público (reemplaza el WordPress de `cerpat.com`) | ✅ |
| PWA | instalable (Android/iOS) con actualización automática | ✅ |

### Vistas publicadas
- **`cerpat.io/`** — **sitio institucional** de la firma, migrado desde el
  WordPress de `cerpat.com` conservando su identidad visual (Poppins, índigo
  `#392B87`, verde `#48D597`, lavanda). Páginas: Inicio, **Nosotros**,
  **Servicios**, **Trabaja con nosotros** y **Contacto**, más `sitemap.xml` /
  `robots.txt`. Es un lenguaje visual **distinto** al del planeador, a propósito.
- **`cerpat.io/planeador`** — la aplicación de la firma, con el **tema escritorio**
  y la barra lateral en **acordeón por área** (ver ADR-0004).
- **`cerpat.io/herramientas`** — **Herramientas** para equipo y clientes.
  Disponibles: **Calculadora de retenciones** y **Punto de equilibrio** (sirven
  desde `/servicios/*.html`, estáticas). En construcción: liquidador de intereses,
  prestaciones sociales, calendario tributario, portal de documentos.
  *(La URL `/servicios` es ahora el portafolio público de la firma.)*
- **`cerpat.io/usuarios`** — vista cableada del personal desde la BD.
- **`cerpat.io/clientes`** — vista **cableada**: web → API `GET /empresas` → Postgres, 90 clientes reales (sin correos, por privacidad).
- **`cerpat.io/vencimientos`** — vista **cableada** de obligaciones tributarias por
  cliente (API `GET /vencimientos`). **ICA municipal 2026 cargado** (338 vencimientos:
  ReteICA/AutoICA, ICA Yopal y exógena de ICA) — ver
  [`vencimientos-tributarios.md`](./vencimientos-tributarios.md). El **Administrador**
  edita **estado y fecha** de cada vencimiento en línea; el resto solo consulta.
- **`cerpat.io/coordinacion`** — **Panel de Coordinación** (solo consulta): KPIs de
  cumplimiento del plan por área, asesor, auxiliar y clientes en riesgo
  (API `GET /plan/cumplimiento`). Los ejes asesor/auxiliar se llenan al cargar
  usuarios y asignaciones en la BD.

## Arquitectura decidida
- **Multi-tenant (SaaS multi-firma):** cada firma contable es una `Organizacion` aislada; todo el dominio lleva `organizacionId`. **Root de plataforma** (`Usuario.esRootPlataforma`) por encima. Ver [`arquitectura.md`](./arquitectura.md) → ADR-0001.
- **Plataforma multi-módulo (visión):** de planeador a sistema operativo de la firma **y** producto que se le vende a los clientes. Cinco frentes (Outsourcing/asesoría, Auditoría/RF, SARLAFT, Talento Humano, "Cómo trabajamos") sobre una base compartida; navegación en acordeón por área ("Mi Ruta" el día a día). Ver [`vision-plataforma.md`](./vision-plataforma.md) y ADR-0002 (cliente-como-tenant + licenciamiento), ADR-0003 (permisos en 3 niveles), ADR-0004 (navegación/nombres) y ADR-0005 (datos sensibles).
- **Regla de aislamiento:** el backend filtra por `organizacionId` de la sesión en cada consulta; nunca confiar en el cliente.
- Stack: Next.js (Vercel) · Express/TS (Railway) · PostgreSQL/Prisma · auth Auth.js/Clerk (pendiente) · n8n (pendiente) · Microsoft 365 correo (pendiente) · Sentry (pendiente).
- **Dos lenguajes visuales, a propósito.** El **planeador** usa el sistema
  "software de escritorio": **azul rey apagado** (`#2E5090` / `#16294A`) + **verde
  CERPAT oficial** (`#48D597`) como acento/positivo, marco de ventana con controles
  estilo Windows, botones rectos con relieve sutil y paneles biselados
  (`apps/web/app/desktop.css`). El **sitio institucional** conserva la identidad
  del sitio anterior: Poppins, índigo `#392B87`, lavanda `#F2F0FE` y el mismo verde
  (`apps/web/app/_sitio/Sitio.tsx`). Lema de marca: *"guiamos a nuestros clientes a
  la cima"* (motivo del sherpa y de las tendencias ▲ en los KPIs). Logos oficiales
  en SVG en `/public`.
- **Identidad de dominio: todo en `cerpat.io`.** La firma perdió el manejo de
  `cerpat.com`, así que se consolida la identidad (web **y correo**) en
  `cerpat.io`, dominio que el equipo sí controla (Hostinger → Vercel). El **sitio
  público ya vive en `cerpat.io`** (ago 2026); falta la redirección 301 y apagar el
  WordPress anterior, que además está comprometido. En el repo
  ya se cambiaron los correos `@cerpat.com` → `@cerpat.io` (usuarios/personal,
  seed y casillas de la firma usadas como contacto de clientes). **Pendiente
  operativo del equipo:** migrar las casillas reales (Microsoft 365) a
  `@cerpat.io`; hasta entonces esos buzones aún no reciben correo. Los correos de
  terceros (clientes) no se tocan.

## Construido en agosto 2026 (calendario · vencimientos · pagos · calidad)

**Vencimientos tributarios (ICA 2026) cargados** — 338 vencimientos por empresa
(ReteICA/AutoICA, ICA Yopal, exógena de ICA). Detalle y reglas por municipio en
[`vencimientos-tributarios.md`](./vencimientos-tributarios.md).

**Estados de un vencimiento** — enum `EstadoPago` con 6 valores: `pendiente`,
`presentado_sin_pago`, `presentado_pagado`, `presentado_cero` ("Presentado en
$0"), `no_presentado`, `no_obligado`. El Administrador los edita en línea.

**`cerpat.io/planeador/calendario` — Calendario.** Reúne en un solo mes las
**visitas** y los **vencimientos** (el **Plan de Trabajo NO va en el calendario**:
es operación interna y vive en Lista · Mi día · Tablero). Filtros (etiquetas
Vencimientos/Visitas, clientes, estado), interruptor para ocultar estados,
**arrastrar** para reprogramar, **imprimir** el mes, y **sábados/domingos/festivos**
de Colombia marcados (festivos calculados en código: fijos + Ley Emiliani +
Pascua). Clic en una **visita** abre su acta y clic en un **vencimiento** su
detalle (con **Soporte Documental**, link editable Drive/OneDrive).

**`cerpat.io/planeador/pagos` — Pagos.** Controla en **un solo listado "Por
pagar"** todo lo pendiente de pago: los **vencimientos tributarios** ya marcados
*Presentado (sin pago) / y pagado* **y** los **pagos pendientes cargados a mano**
(deudas de años anteriores). Por cada obligación muestra **semáforo de urgencia**,
**límite de pago** (INEFICAZ / exclusión RST) e **interés de mora DIAN a hoy**
(Art. 635 E.T.; ver regla 6). Arriba, **KPIs** que suman todo: Pagado, Por pagar,
Vencido sin pagar, Riesgo ineficacia/RST e Interés de mora. Filtros por cliente y
estado. El **valor y estado de pago** se editan en línea; los pagos pendientes se
**agregan** con el formulario "+ Agregar pago pendiente" (obligación, año, período
y municipio como desplegables/autocompletar) y se **eliminan** desde el mismo
listado. Se guardan como `VencimientoEmpresa` con `generado=false` (sin migración)
— API `GET /vencimientos/pagos`, `GET /vencimientos/pendientes`,
`POST /vencimientos` (acepta `municipioId`), `DELETE /vencimientos/:id`. La
**presentación** de los vencimientos se gestiona en `cerpat.io/vencimientos` y las
actividades operativas en el Plan de Trabajo; Pagos no las duplica.

**Regenerar vencimientos por cliente.** En **Administración → Config. tributaria**,
tras corregir un parámetro, el botón **"Regenerar vencimientos"** rehace los
vencimientos **nacionales e ICA municipal** del cliente según su config actual
(cruce con el calendario 2026 embebido en la API, `apps/api/src/vencimientos/`, y
el NIT). Es **seguro con los pagos**: crea los que faltan, ajusta fechas y borra
los sobrantes que quedaron **sin trabajar**, pero **conserva** los que ya tienen
valor/estado/nota/soporte, las entradas manuales (`generado=false`) y las
obligaciones que el generador no administra (p. ej. Exógena de ICA). API
`POST /vencimientos/regenerar/:empresaId` (solo Administrador). El calendario `.ts`
se regenera desde los CSV de `docs/data/` con
`node apps/api/scripts/build-calendario.mjs`.

**ICA municipal generado (ago 2026).** Al regenerar, por cada municipio marcado
se generan ICA / ReteICA / AutoICA cruzando con `calendario-ica-municipal-2026.csv`
y el dígito del NIT. Si una obligación marcada no tiene fecha en el calendario
(p. ej. San Martín/Meta, por dígito de NIT sin tabla), no la inventa: la reporta
como **sin calendario** para avisar. Nuevo campo **fecha de inscripción** por
municipio (`EmpresaMunicipioIca.fechaInscripcion`, migración
`add_ica_fecha_inscripcion`): si se fija, solo genera los vencimientos de ICA en/
después de esa fecha (acota "de aquí en adelante" sin afectar lo ya cargado).

**FOPAT (transporte).** Nueva responsabilidad nacional en Config. tributaria:
casilla **"Agente de retención FOPAT (transporte)"** (`ConfiguracionTributaria.fopat`,
migración `add_fopat_config`). Es una **retención mensual**; al regenerar, el
generador crea 12 vencimientos que vencen el **10º día hábil del mes siguiente**
al período (igual para todos, sin depender del NIT; se saltan fines de semana y
**festivos de Colombia**). Solo aplica a los clientes que el Administrador marque
como obligados.

**Obligaciones de solo presentación (no generan pago).** Dos casillas nuevas en
Config. tributaria (`ConfiguracionTributaria.nominaElectronica` /
`seguridadSocial`, migración `add_nomina_seguridad_social`), mensuales, que
vencen un día hábil del mes siguiente:
- **Nómina electrónica** — **10º día hábil** (igual que FOPAT).
- **Seguridad social (PILA)** — día hábil según los **2 últimos dígitos del NIT**
  (00-07 → 2º, 08-14 → 3º, … 94-99 → 16º).

No entran al ciclo de **Pagos** (`OBLIGACIONES_SIN_PAGO`): nunca causan interés ni
sanción; solo se les hace seguimiento de presentación en Vencimientos/Calendario.
Se generan al **Regenerar vencimientos** para los clientes marcados.

**RUB (Registro Único de Beneficiarios)** — se sumó a las de solo presentación,
pero **trimestral** y con **fechas fijas nacionales** (no dependen del NIT): en
2026 **2-feb, 4-may, 3-ago, 3-nov**. Aplica **automáticamente a personas
jurídicas** (`rentaTipo ∈ {persona_juridica, gran_contribuyente, rst_consolidada}`)
—sin casilla ni marcado por cliente— y se materializa al **Regenerar
vencimientos**. Fechas por año en `RUB_FECHAS` (API + sembrador, en sync).

**Unificación plan ↔ vencimientos.** Las **declaraciones** (Retención, IVA, Renta,
ICA, ReteICA, RST…) dejan de duplicarse: cada actividad del plan puede **vincularse
a un vencimiento** en Administración → Actividades (`ActividadPlan.obligacionVencimiento`,
clave estable de `vinculos.ts`). Con eso: (1) el vencimiento **hereda el checklist**
(subtareas → `SubtareaVencimiento`) y el **responsable** (asesor/auxiliar del área),
con **chulo** desde el Calendario; (2) el panel de **Coordinación** suma esos
vencimientos al **avance por área/persona** (presentado = ejecutado); (3) el
generador del plan **no crea tarea** para las actividades vinculadas, y
`prisma/plan-limpiar-duplicados.ts` borra las tareas-duplicado **vacías** ya
generadas (conserva las que tengan avance; dry-run por defecto, `--apply` para
borrar).

**Calidad / infraestructura** — se adoptaron **migraciones versionadas de
Prisma** (fin del SQL manual y del *drift*) y **CI en cada PR** (valida esquema +
compila API y web). Curaduría estructural completa en
[`revision-tecnica.md`](./revision-tecnica.md).

## Construido el 8–9 de agosto 2026

**Asignaciones y tablero por área.** Tras la carga masiva de asignaciones, las
tareas ya generadas conservaban el responsable viejo: se agregó
**Administración → Sincronizar responsables** (`POST /admin/asignaciones/sincronizar-tareas`,
con alcance *período actual / abiertas / todas* y **simulación** antes de aplicar).
Nueva vista **`/planeador/asignaciones`**: coordinación ve el tablero completo por
área con **métricas y filtros de embudo** (por área y por cliente); cada asesor y
auxiliar ve **sus** empresas (`GET /plan/asignaciones`).

**Rol Asesor, ajustes pedidos por el equipo.** En **Pagos** solo consulta e
impresión (no edita valores); **Mi Día** muestra únicamente lo suyo; **Lista**
muestra lo suyo **y** lo de sus auxiliares.

**Vencimientos — eliminar.** El Administrador puede **eliminar** un vencimiento
(con confirmación), no solo los cargados a mano. Nació de un caso real: el **RUB**
aparecía en clientes **persona natural**, a quienes no les aplica.

**Pagos — abonos y sanción por municipio.** Se pueden registrar **abonos
parciales** a un impuesto (`AbonoVencimiento`); el saldo, la mora y el semáforo se
recalculan sobre lo que falta, y al llegar a cero el vencimiento pasa a
*Presentado y pagado*. La **sanción mínima** deja de ser un valor único:
`Municipio.sancionMinimaUvt` permite fijarla por municipio (editable en
Administración).

**Documentos y almacenamiento por cliente.** Cada cliente tiene su **repositorio
de documentos** (actas, informes, soportes) en `DocumentoCliente`, y su ficha
muestra **cuánto almacenamiento consume** (MB y número de archivos). Máximo 20 MB
por archivo. → *Pendiente operativo: ampliar el volumen de la base y activar
respaldos en Railway.*

**Navegación en acordeón ("Mi Ruta").** La barra lateral se reorganizó por área,
desplegable, con tres secciones (**Mi Ruta** / Gestión / Servicios) y memoria de
la última abierta. Se colapsa **sola** a íconos en pantallas medianas y a cajón
lateral en móvil. Ver ADR-0004.

**Marca y PWA.** Logo oficial en SVG (verde `#48D597`, azul `#171C8F`) aplicado en
toda la plataforma y el color de marca unificado. La app es **instalable**
(Android e **iOS/Safari**: `apple-touch-icon` PNG, área segura, aviso de
instalación) y **se actualiza sola** en cada despliegue. Auditoría de CSS y
**responsive móvil** completa.

**Seguridad.** Una auditoría encontró **cuatro endpoints abiertos sin sesión** en
producción: `GET /usuarios` (datos personales del equipo), `GET /empresas`
(cartera con NIT), `GET`/**`PATCH`** `/tareas` (lectura **y modificación**) y
`GET /plan/cumplimiento`. Se cerraron todos y se agregó un **test de blindaje**
que recorre los routers y falla si alguna ruta queda sin `requireAuth` (hoy cubre
78 rutas). Se documentó cómo otorgar el rol **root** sin acceso a la base
(`PROMOVER_ROOT_EMAIL`, ver `arquitectura.md`).

**Corrección posterior (ADR-0006).** El auto-refresco de la PWA recargaba la
página al perder el foco de un campo, sin comprobar si había versión nueva: al
pulsar *Entrar* en el login, el envío se cancelaba y **no se podía iniciar
sesión**. Se corrigió (recarga solo con versión nueva y nunca con un formulario en
uso), el service worker **dejó de cachear HTML** (páginas personalizadas) y el
límite de intentos de login **ya no bloquea la cuenta**: la contraseña correcta
entra siempre; lo que crece ante fallos seguidos es el retraso de la respuesta.

**Importación masiva.** La carga de asignaciones por Excel fallaba con miles de
filas: el tope por defecto de Express (100 KB) devolvía 413. Ampliado a 30 MB,
que también cubre la subida de documentos.

## Auditoría de CSS y navegabilidad (ago 2026)

Revisión completa de la interfaz. El diagnóstico de partida: el sistema de diseño
existía pero **casi no se usaba** —1.778 estilos en línea contra 612 usos de
clase— y eso se notaba en cinco frentes. Resueltos, en orden:

1. **La pantalla se congelaba al navegar.** No había ni un `loading.tsx`: las
   vistas se arman en el servidor y entre el clic y el contenido no pasaba nada.
   Se agregó esqueleto de carga en las diez secciones, pantalla de error propia
   (con reintentar y código del incidente) y de página no encontrada. Además,
   **cada pantalla tiene su título** ("Pagos · CERPAT"): antes las 26 decían lo
   mismo.
2. **Buscador global `Ctrl+K`.** Con más de 30 destinos, bajar por el menú dejó
   de ser viable. Busca sin tildes, por partes ("plan trab") y por sinónimos
   ("impuestos" → Vencimientos), y solo muestra lo que el rol puede ver. El mapa
   de navegación vive en `navegacion.ts` y alimenta menú **y** buscador.
3. **Tablas.** Encabezado fijo en los nueve listados largos (`.dt-alta`) y orden
   por columna con el mismo ciclo en toda la plataforma. Pagos ordena en el
   servidor, con el orden en la URL (se puede compartir el enlace).
4. **Colores por significado** — ver ADR-0008. Con eso el **modo oscuro** quedó
   utilizable en toda la app, y el tema "Oscuro" de Apariencia ahora oscurece el
   contenido, no solo la barra.
5. **Filtros parejos.** El embudo por columna estaba copiado en seis vistas y
   otras dos no tenían filtro. Se extrajo a `_components/TablaDatos` (encabezado
   fijo + orden + embudo + contador) y lo estrenaron **Clientes** y la tabla de
   **tareas**. Pagos conserva su filtro en la URL, pero aplica al instante.

**Un marco para todos los roles.** El marco de la aplicación (barra única, menú
en acordeón que se recoge y se asoma al pasar el mouse, íconos propios de trazo,
temas, buscador) vive en `_components/MarcoApp` + `MenuLateral` y lo usan **el
personal y el Portal del Cliente** con su propia navegación — antes el portal
tenía un marco aparte que se fue quedando atrás. Ver ADR-0007.

Dos duplicaciones cerradas de paso: las siete pantallas que dibujaban su propio
marco sin barra lateral (ahora comparten el layout del grupo `(app)`), y
`/mis-visitas`, que era el portal de visitas anterior al portal (ahora redirige).

**Queda pendiente** migrar los estilos en línea a clases. No se hará como
proyecto aparte —sería un cambio enorme sin nada visible y con riesgo de romper
pantallas que funcionan—: se hace vista por vista, cuando haya que tocarlas.

## Hoja de vida del cliente (ago 2026)

Nació de un problema concreto: al **RUB** se llegaba por el campo *Renta*, así que
una persona jurídica con Renta en *"No aplica"* perdía la obligación al regenerar
—en silencio—. La regla pasó a derivarse del **tipo de empresa** (naturaleza
jurídica), que es lo que dice la norma, y la regeneración ahora **simula primero**
y muestra qué se va a crear y qué se va a eliminar antes de confirmar.

Arreglado el RUB quedaba la pregunta de fondo: los datos que deciden qué le aplica
a cada cliente vivían en carpetas y correos, no en el sistema. De ahí la **hoja de
vida** (`/clientes/[id]`), que reúne por cliente:

- **Identificación y notificación** — dirección, fecha de constitución, y los
  correos y teléfonos **registrados ante la DIAN y la cámara**, que rara vez
  coinciden con los del contacto diario.
- **Actividades económicas (CIIU)**, **representantes legales** y **cámaras de
  comercio**.
- **Situación tributaria** — responsabilidades configuradas, ICA por municipio,
  estado del RUB y los vencimientos que realmente se generaron.
- **Cifras y obligaciones derivadas** — activos e ingresos del año anterior, y las
  seis obligaciones que se calculan a partir de ellos (ver `reglas-de-negocio.md`).

**Sin credenciales, a propósito.** Guardar usuario y contraseña de los clientes
convertiría una filtración de la base en una filtración de **sus** cuentas, bajo
custodia de la firma (Ley 1581). Se registra **quién** tiene el acceso y **dónde**
está la clave; nunca la clave. La decisión quedó escrita en el modelo de datos
para que nadie agregue el campo por descuido.

**El tipo de empresa ya se puede editar.** `Empresa.tipoId` y `Empresa.regimenId`
existían en la base desde el principio, pero **ningún formulario los exponía**: los
clientes que llegaron sin tipo en la importación no se podían arreglar desde la
aplicación, y son justo los que se quedaban sin RUB. Ahora se editan en dos
sitios, a propósito: en *Administración → Empresas* (con sus catálogos en *Tipos
de empresa* y *Regímenes*) para el mantenimiento del maestro, y en la **hoja de
vida del cliente**, que es donde se ve el hueco cuando se está revisando a
alguien. Mandar a la persona a otra pantalla a arreglar lo que acaba de ver es
justo el patrón que la ficha vino a corregir. Ambos listados marcan **en rojo** a
quien no tiene tipo y explican qué reglas quedan sin evaluar mientras falte.

**Cifras en bloque.** Registrar activos e ingresos cliente por cliente son 90
fichas a mano, y las cifras ya viven en un Excel del equipo. *Administración →
Cifras fiscales* descarga una **plantilla con los clientes y sus NIT ya puestos**
—solo hay que llenar dos columnas—, la importa de vuelta y muestra quién sigue
sin cifras. **Siempre previsualiza antes de escribir**, como al regenerar
vencimientos: una cifra equivocada cambia en silencio qué obligaciones le salen
al cliente. El emparejamiento por NIT es la parte delicada y vive aparte, con
pruebas (`fiscal/importar-cifras.ts`): la coincidencia exacta gana siempre, la
variante sin dígito de verificación solo se acepta si es única, y ante cualquier
ambigüedad la fila se rechaza — que quede sin importar es recuperable, que entre
en el cliente equivocado no.

**Códigos CIIU con buscador.** Las actividades económicas se escribían a mano,
código y descripción. Con 499 clases de nombres largos y parecidos, eso garantiza
descripciones distintas para el mismo código entre un cliente y otro — y el CIIU
es lo que la DIAN y la cámara usan para clasificar. Ahora hay un buscador por
código o por texto que llena los dos campos. La nomenclatura (**CIIU Rev. 4 A.C.
2020** del DANE) va **embebida en el código**, no en la base: es nacional, igual
para todas las firmas, y no la edita nadie. Fuente en `docs/data/ciiu-rev4-ac.csv`,
extraída del PDF oficial con `docs/data/ciiu-desde-pdf-dane.py` y verificada por
tres vías —las notas explicativas del propio documento, el buscador en vivo del
DANE y las pruebas de `ciiu-rev4-ac.test.ts`—, porque un PDF de 700 páginas se
parsea mal sin que nada falle.

**El asesor del listado sale de Asignaciones.** `Empresa.asesorNombre` es un texto
suelto que vino de la importación: sirvió al principio, pero nadie lo mantiene, así
que un cliente podía figurar **sin asesor** en el listado y tener a alguien
trabajándolo en el tablero. Ahora la columna muestra el asesor de
`AsignacionClienteArea` —por área, porque un cliente puede tener asesores distintos
en áreas distintas—, el texto viejo queda como respaldo *en cursiva* y marcado como
tal, y quien no tiene ni lo uno ni lo otro sale como **«sin asignar»**. El filtro y
el orden usan el mismo valor que se ve: si el embudo ofreciera el texto viejo y la
celda mostrara el de Asignaciones, filtrar por un asesor dejaría fuera clientes que
sí son suyos.

**La ficha es la vista por cliente; Administración conserva las transversales.**
Revisar un cliente no debe obligar a abrir tres pantallas y recordar lo visto en
las otras dos — así se cuela un error. Pero la pregunta *"¿a cuáles de los 90 les
falta?"* no cabe en una ficha, y fue justo la que destapó el problema del RUB:
recorrer 90 fichas de una en una no es viable. Así que conviven, con papeles
distintos y enlazadas: cada fila del listado transversal abre la hoja de vida del
cliente. Editar la configuración tributaria sigue en Administración (es un editor
pesado, con ICA municipio por municipio); la ficha la muestra y enlaza.

## Pendiente de fondo — el desfase de un mes en la entrega del insumo

El ciclo real va corrido un mes: el auxiliar **captura julio**, libera el 2 de
agosto, y el asesor pasa **agosto** liquidando retenciones y revisando balance
**de julio**. En septiembre repite con agosto, y así.

El sistema, en cambio, habilita una tarea de procesamiento del período *M* con la
`EntregaInsumo` **del mismo período *M***. Consecuencia: al arrancar cualquier mes
todo el procesamiento aparece bloqueado esperando una captura que no terminará
hasta el mes siguiente.

**Hoy se resuelve a mano:** *Administración → Plan por cliente → Liberar el insumo
de todos los clientes*, que crea una entrega general `manual` para todos los
activos del período (con simulación y reversión). Es el desbloqueo del arranque,
no la corrección.

**Lo que corresponde** es que el procesamiento de *M* se habilite con la captura
de *M−1*.

### Decidido con la dirección (11 ago 2026)

Las tres definiciones que faltaban quedaron resueltas:

1. **La tarea es del mes en que se trabaja, y *corresponde* al mes anterior.** Son
   dos datos distintos y se guardan los dos. La tarea que el asesor hace en agosto
   sobre el cierre de julio **es de agosto** y *corresponde a julio*. Nada de lo que
   ya está andando se reetiqueta: se agrega el dato de a qué mes corresponde. Los
   plazos (día hábil) se siguen contando sobre el mes de trabajo; los indicadores y
   lo que ve el cliente usan el mes al que corresponde.
2. **El desfase aplica igual a todas las áreas**, así que **lo define la fase, no el
   área**: `captura` → mismo mes; `procesamiento` y `revision` → mes anterior. Sale
   de `ActividadPlan.fase`, que ya está cargada: no hay nada que configurar por área.
   En un mismo plan conviven la captura de agosto y el procesamiento de julio, que es
   lo que pasa en la operación real.
3. **Insumo del cliente:** ✅ **hecho** — lo destraba quien recibe (asesor o auxiliar
   del área), marcando "el cliente ya entregó" **con la fecha de entrega**. No depende
   de que el cliente entre al portal. El subproducto es el valor real: queda la
   **lista de clientes que no han entregado**, que antes no existía y es un problema
   de negocio, no de operación. Más adelante el cliente podrá marcarlo desde el portal
   como precarga, pero la marca que vale sigue siendo la de quien recibe. Detalle en
   [`reglas-de-negocio.md`](./reglas-de-negocio.md#recepción-del-insumo-del-cliente).

**Transición:** agosto 2026 queda como está (hay gente trabajando encima); el
criterio nuevo arranca en **septiembre**.

## Revisión de impuestos y rol Revisor ✅ (11 ago 2026)

El área de Impuestos no tenía dónde trabajar: los vencimientos viven en una pantalla
cerrada para el rol Asesor, y sus actividades no generan tarea a propósito. Ahora el
asesor trabaja desde **Mi Día → Mis impuestos**, sobre el vencimiento mismo — sin
copias, así que el calendario y Pagos se actualizan solos y el calendario sigue siendo
solo vencimientos.

Con él entra el rol **Revisor** (dos personas): cola **compartida**, por orden de
llegada, sin asignación fija. Aprueba o devuelve con observación obligatoria, y solo
después el asesor presenta. Nadie aprueba su propio trabajo. Todo el circuito y sus
reglas están en [`reglas-de-negocio.md`](./reglas-de-negocio.md#circuito-de-revisión-de-impuestos).

Cada paso queda en `EventoVencimiento` con fecha y responsable: es la materia prima
del tablero de indicadores que sigue — cuánto tarda un revisor, cuántas vueltas da un
impuesto, y cuántos días antes del vencimiento se presentó.

La coordinación puede repartir el rol sin depender del Administrador (*Usuarios* en
modo acotado). El rol entra **por migración**, no por el seed: en el despliegue solo
corren las migraciones.

## Roadmap

### Fase 1 — Infraestructura y datos ✅ (hecho)
- [x] Monorepo, esquema, seed, prototipo desplegado.
- [x] Vercel + dominio `cerpat.io`.
- [x] Railway (API + Postgres) conectado.
- [x] Multi-tenancy + root en el modelo de datos.
- [x] 90 clientes reales en Postgres.
- [x] Primer cableado real (`/clientes`).
- [x] Sistema de temas (Actual / Sereno / Enfoque) en Apariencia.
- [x] Matrices Excel para cargar clientes y usuarios (entregadas al equipo).

### Fase 2 — Autenticación y aislamiento 🟡 (casi completa)
- [x] Auth propia: login con **JWT (HS256)** y contraseñas con **scrypt**; sesión en
  cookie `cerpat_token` **httpOnly + secure + sameSite**, 12 h. Se descartó
  Auth.js/Clerk: el caso es un login por correo/contraseña dentro de un tenant, y
  una dependencia externa habría costado más de lo que aportaba.
- [x] Bootstrap de credenciales: el Administrador crea usuarios y el sistema genera
  contraseña temporal (`debeCambiarPassword`); rol **root** vía `PROMOVER_ROOT_EMAIL`
  o `prisma/set-root.ts` (ver `arquitectura.md`).
- [x] Permisos por rol en el backend (`requireAuth` / `requireRol`) y guardas de
  ruta en el frontend (`lib/acceso.ts` + `exigirRuta`).
- [x] Todos los endpoints exigen sesión, con **test de blindaje** que lo verifica.
- [x] Freno a la fuerza bruta en el login (retraso creciente, sin bloquear la cuenta).
- [x] **Tenant desde la sesión** (ago 2026): `orgDeSesion(req)` reemplaza el slug
  fijo en los 40 puntos donde estaba cableado; el login resuelve la cuenta por
  correo. Era lo bloqueante para vender la plataforma (ADR-0002 / ADR-0009).
- [ ] Servir correos de clientes solo autenticado.

### Fase 3 — App real por vistas (reemplazar prototipo)
- [ ] Administración → Empresas (CRUD real sobre los 90 clientes, con correos).
- [ ] Usuarios, Asesores, Catálogos, Parámetros, Apariencia (por organización).
- [ ] Tareas: Tablero (kanban), Calendario (drag&drop), Lista (export), Mi Día.
- [ ] Reglas de negocio §4 en el backend (subtareas, soporte, bloqueo por auditoría, auto-asignación, Mi Día, liquidador de intereses, filtro de Pagos, exclusión de internos, etiquetas dinámicas).
- [ ] Pagos + liquidador de intereses/sanción.
- [x] **Pagos — impresión y exportación (ago 2026):** botones en la vista de Pagos
  (`apps/web/app/planeador/PagosAcciones.tsx`): **Imprimir por cliente** (una hoja
  por cliente con sus impuestos pendientes de pago, para enviar) y **Exportar a
  Excel** (CSV con `;` y BOM que abre en Excel; respeta el filtro aplicado).
- [ ] Auditoría (aprobar/rechazar/desbloquear + log de desbloqueo).

### Fase 4 — Automatización y operación
- [ ] n8n: recordatorios, recálculo diario de mora, tareas recurrentes, alertas a líderes.
- [ ] Microsoft 365 (Graph API) para correo desde `notificaciones@cerpat.io`.
- [ ] Sentry (monitoreo de errores).
- [x] Migraciones versionadas de Prisma (baseline + `prisma migrate deploy`) y CI en cada PR (ago 2026).
- [x] `migrate deploy` automático en el deploy: `railway.json` antepone
  `npm run db:migrate:deploy` al arranque de la API, así cada despliegue aplica
  las migraciones pendientes antes de servir (ago 2026). Requiere que el *root
  directory* del servicio de la API en Railway sea la raíz del monorepo.
- [ ] `api.cerpat.io` (dominio propio de la API).

### Fase 5 — Portal de clientes (futuro)
- [ ] Aislamiento adicional por empresa cliente (cada cliente ve solo lo suyo) sobre el modelo multi-tenant.

### Módulo Revisoría Fiscal · Portal de Hallazgos 🚧 (en construcción)
Portal para clientes externos (asamblea/gerencia) + revisor fiscal. Ver
[`docs/revisoria-fiscal.md`](./revisoria-fiscal.md).
- [x] Fundación: esquema (`GrupoEmpresarial`, `Hallazgo`, `Usuario.empresaClienteId/grupoClienteId`, `Empresa.grupoId`, enums `RiesgoNivel`/`EstadoHallazgo`) + rol `Cliente` (`db:roles-sync`).
- [x] API de Hallazgos (CRUD revisor + lectura con aislamiento cliente/grupo).
- [x] Vistas React (revisor / empresa / grupo) en `/hallazgos`.
- [x] Administración: grupos (pestaña Grupos), asignar empresa→grupo y usuarios `Cliente` ligados a empresa/grupo.

### Módulo Visitas · Actas y seguimiento ✅ (en producción)
Visita del asesor/auditor al cliente con acta y seguimiento de compromisos. Mockup
en [`docs/mockups/visitas-acta-seguimiento.html`](./mockups/visitas-acta-seguimiento.html).
- [x] Fase 1 — Acta enriquecida: compromisos con dirección **firma/cliente**
  (responsable interno o externo) y área; actividades, recomendaciones y
  observaciones como **listas enumeradas** (`ItemActa`); `Visita.area`/`lugar`.
- [x] Fase 2 — Acta **imprimible** para firma (encabezado + bloque de firmas).
- [x] Fase 3 — **Matriz de seguimiento** de compromisos + **tablero** (cumplimiento
  por asesor/área/cliente), con filtros tipo Excel y exportación (`/planeador/visitas`).
- [x] Fase 4 — **Portal del cliente** (solo lectura) en `/mis-visitas`, aislado por
  empresa/grupo (reusa el patrón de Hallazgos).

### Módulo Portal del Cliente ✅ (en producción)
Portal propio del cliente en `cerpat.io/portal` (menú lateral, **solo lectura**,
aislado por **NIT/grupo**). El usuario Cliente aterriza aquí al iniciar sesión.
- [x] Fase 1 — Shell + navegación: Inicio, Visitas y Hallazgos (reutilizados) +
  Servicios (calculadoras públicas).
- [x] Fase 2 — **Pagos**: obligaciones por pagar con límite, mora y sanción
  (`GET /vencimientos/portal-pagos`).
- [x] Fase 3 — **Calendario**: sus visitas + sus vencimientos, con festivos
  (`GET /vencimientos/portal`).
- [x] Fase 4 — **Plan de Trabajo**: matriz de cumplimiento (áreas × meses) +
  listado de actividades de su empresa (`GET /plan/portal`).
- Login del cliente: un Administrador crea el usuario Cliente en *Usuarios* (con
  empresa o grupo); el sistema genera su contraseña temporal.

## En diseño — Plan de Trabajo Contable (cumplimiento) 🚧

Dirección nueva (idea del equipo): en vez de depender de que cada usuario cargue
tareas, el sistema **genera el plan de trabajo por cliente** a partir de una
plantilla de actividades contables recurrentes, y mide **cumplimiento / atraso**
por cliente y por asesor.

**Concepto en 3 capas:**
1. **Catálogo de actividades del plan** (definido una vez): p. ej. conciliación
   bancaria, cartera, caja, depreciación, amortización, anticipos, conciliación
   de impuestos, obligaciones financieras, parafiscales/seguridad social — cada
   una con grupo, periodicidad, evidencia esperada y si requiere auditoría.
2. **Generación automática de tareas** por *cliente × actividad × período*, con
   fecha límite según periodicidad, asignadas al asesor del cliente.
3. **Ejecución + reporte:** el asesor marca Ejecutada (con evidencia), el auditor
   marca Auditada; la cuadrícula semáforo y las métricas (atraso/adelanto) se
   calculan solas.

**Decisiones tomadas:**
- Asignación del plan **por plantilla de tipo de servicio** (Outsourcing /
  Asesoría Contable / Revisoría), ajustable por excepción.
- El catálogo base es una **lista maestra**; para **cada cliente** se puede
  **agregar o retirar** actividades y **ajustar la periodicidad** que corresponda.
- **Área** como dimensión organizacional: la firma trabaja por secciones —
  **Impuestos, Informes, Cumplimiento, Nómina, Tesorería**. Cada actividad
  pertenece a un área (distinta del "grupo contable" temático).
- Cada actividad/cliente distingue **Asesor (responsable)** de **Auxiliar
  (ejecutor)**. Lo práctico: asignar asesor+auxiliar **por cliente × área** y que
  las tareas hereden esos responsables.
- **Seguimiento en 3 ejes**: por **área**, por **asesor** y por **auxiliar**
  (además de por cliente). Ciclo mensual Programado → Ejecutado → Auditado; RAG
  derivado de fechas.

**Catálogo base (34 actividades, 4 grupos contables + área):**
[`data/plan-trabajo-actividades.csv`](./data/plan-trabajo-actividades.csv) —
columnas `grupo`, `area`, `codigo`, `actividad`, `documento_formato`,
`periodicidad_sugerida`. Grupos: Estados Financieros, Impuestos Nacionales (DIAN),
Impuestos Municipales, Obligaciones Mercantiles. El mapeo a **área** es una
propuesta (Impuestos 12 · Cumplimiento 10 · Tesorería 6 · Informes 4 · Nómina 2):
revisar/ajustar con el equipo. Transcrito del cronograma; borrador.

**Mockup:** [`mockups/plan-trabajo-cumplimiento.html`](./mockups/plan-trabajo-cumplimiento.html)
— cuadrícula semáforo por área + tarjetas de cumplimiento por área/asesor/auxiliar.

**Calendario (conexión):**
- **Base:** el plan alimenta el **Calendario** y **Mi Día** internos de la app,
  filtrables por área/asesor/auxiliar (una vista "Mi Día" por persona).
- **Opcional (fase 4):** sincronizar los vencimientos de cada persona a su
  **Outlook (M365)** o **Google Calendar** (one-way vía n8n/Graph), o un **feed
  `.ics` suscribible** por persona/área.

**Cambios de datos previstos (aún no implementados):**
- `Area` — catálogo de áreas de la firma (Impuestos, Informes, Cumplimiento,
  Nómina, Tesorería), por organización.
- `ActividadPlan` — catálogo base (grupo, **areaId**, código, actividad,
  descripción, documento/evidencia, periodicidad sugerida, requiereAuditoria).
- `PlanClienteActividad` — vínculo empresa↔actividad: `activa` (agregar/retirar) +
  `periodicidad` propia del cliente.
- `AsignacionClienteArea` — por empresa × área: **asesor** (responsable) y
  **auxiliar** (ejecutor); las tareas heredan de aquí.
- `SeguimientoMensual` (o `Tarea` con `actividadPlanId` + `periodo` + `areaId` +
  `asesorId`/`auxiliarId`): estado Programado/Ejecutado/Auditado por cliente ×
  actividad × mes — base de la cuadrícula y de las métricas por 3 ejes.

**Iteración 2 — mejoras del equipo (en el mockup, por implementar):**
- **Subtareas por actividad:** `SubtareaPlantilla` (por `ActividadPlan`, ordenada)
  → se copia a `Subtarea` de la tarea al generarla. Regla ya existente: no se
  marca Ejecutada/Auditada con subtareas pendientes.
- **Registro en software (comprobantes):** bandera `esRegistroSoftware` en
  `ActividadPlan`; en la ejecución se capturan `comprobanteDesde` /
  `comprobanteHasta` → `cantidadRegistros`. Métrica: **registros por auxiliar**
  (causación de compras/ventas/egresos, etc.).
- **Tamaño/complejidad de empresa:** `Empresa.tamano` (S/M/L/XL) — arranque
  manual por el coordinador; opcional afinar con drivers por área (Tesorería
  #bancos/#movimientos, Nómina #empleados, Impuestos #municipios…) → un
  `factorComplejidad` que **pondera la carga y el cumplimiento** para comparar
  justo entre asesores.
- **Panel de Coordinación (solo consulta):** los indicadores de cumplimiento/
  seguimiento viven en una vista aparte, restringida a un rol **Coordinador**;
  la ejecución (subtareas, comprobantes, evidencia) vive en la vista operativa de
  cada asesor/auxiliar.
- **Agregar/quitar actividades por área en cada cliente:** la gestión del plan de
  cada cliente se hace por área (activar/desactivar actividades vía
  `PlanClienteActividad.activa`). ✅ **UI en producción**: Administración →
  *Plan por cliente* (marcar actividades por área + periodicidad, y generar las
  tareas del período por cliente).
- **Tamaño por área con tallas:** la talla (S/M/L/XL) es **por empresa × área**
  (una empresa puede ser L en Tesorería y S en Nómina) → campo `talla` en
  `AsignacionClienteArea`.

**Estado de implementación:**
- ✅ **Fase 1 — modelo de datos (schema Prisma):** agregadas `Area`,
  `ActividadPlan`, `SubtareaPlantilla`, `PlanClienteActividad`,
  `AsignacionClienteArea` (asesor/auxiliar/talla), y campos de plan en `Tarea`
  (`actividadPlanId`, `areaId`, `periodo`, `asesorId`, `auxiliarId`,
  `comprobanteDesde/Hasta`, `cantidadRegistros`). El rol Coordinador es una fila
  de `Rol` (seed). Aplicado a la BD.
- ✅ Fase 2 — aplicado a la BD (`db push`) + catálogo sembrado (34 `ActividadPlan`
  desde el CSV) + 5 áreas + rol Coordinador.
- ✅ Fase 3 — asignación del plan a los 90 clientes (3060 `PlanClienteActividad`)
  y generación de tareas por período (2070 `Tarea` para 2026-07).
- 🟡 Fase 4 — en curso. Hecho: **Panel de Coordinación** con datos reales
  (`GET /plan/cumplimiento` + vista `/coordinacion`, solo consulta: KPIs,
  cumplimiento por área y clientes en riesgo); **ejecución con subtareas**
  (checklist + regla "no Ejecutada con subtareas pendientes"); y **registro en
  el software** (comprobante inicial/final → cantidad de registros calculada del
  rango y editable) en el modal de tarea, guardado por el ejecutor
  (asesor/auxiliar) o coordinación vía `PATCH /plan/tareas/:id/registro`.
  Pendiente: métrica **registros por auxiliar** en Coordinación (ya hay datos).
- 🟡 Usuarios / personal — cargado el catálogo de personal desde la base de la
  firma: 26 usuarios (Paola Guevara como root/administradora + 25 empleados
  activos) con su cargo, área y rol (Administrador, Asesor, Auxiliar, Auditor,
  Coordinador). Sólo se importan campos operativos (nombre, correo corporativo,
  cargo, área, rol); los datos sensibles de RR. HH. no entran al repo. Con esto
  se podrán poblar las asignaciones asesor/auxiliar por área y activar esos ejes
  en el Panel de Coordinación. Falta el bootstrap de autenticación (claves).
- 🟡 Asignaciones por área (asesor/auxiliar) — asignación automática "por área
  del empleado": `db:plan-asignaciones` reparte round-robin, por empresa×área,
  el asesor responsable y el auxiliar ejecutor entre las personas de esa área
  (`AsignacionClienteArea`), y rellena esos ejes en las tareas ya generadas.
  `plan-generar` hereda la asignación en meses futuros. El Panel de Coordinación
  ya muestra **seguimiento por asesor y por auxiliar**. Es un punto de partida
  aproximado; se ajusta por cliente cuando haga falta.
- ⬜ Fase 5 — calendario (interno + sync opcional Outlook/Google).

**Mockup de referencia:** [`mockups/plan-trabajo-cumplimiento.html`](./mockups/plan-trabajo-cumplimiento.html)
(cuadrícula semáforo + métricas por asesor y cliente). Próximo paso: afinar el
mockup con el equipo y luego el modelo de datos + generación.

## Deuda técnica / notas
- ~~`organizacionId` por slug fijo~~ — **resuelto (ago 2026, ADR-0009).** El
  tenant sale del token de la sesión, con un único resolutor
  (`apps/api/src/auth/tenant.ts`) y un test que impide la regresión. Queda por
  decidir el **descubrimiento de firma en el login** (subdominio, dominio del
  correo o selector); no hace falta hasta que entre el primer cliente con tenant
  propio.
- `prisma/data/clientes-cerpat.csv` contiene PII de clientes reales; vive en el repo privado por decisión del equipo.
- Los documentos de clientes se guardan **dentro de Postgres** (no en un
  almacenamiento de objetos). Sirve para el volumen actual; si crece, mover a
  Cloudflare R2 / S3 y dejar solo la referencia en la base.

### Pendientes operativos (fuera del código)
Cosas que **no** se resuelven con un despliegue; las hace el equipo en los paneles:
- [ ] Railway → API: **quitar `PROMOVER_ROOT_EMAIL`** (el root ya quedó otorgado).
- [ ] Railway → Postgres: **ampliar el volumen** y **activar respaldos** (ahora se
  guardan documentos de clientes en la base).
- [ ] Railway → API: verificar que **`CORS_ORIGIN`** esté definido; si falta, la API
  acepta peticiones desde cualquier origen.
- [ ] **Redirección 301** de `cerpat.com` → `cerpat.io` y **apagar el WordPress**
  (previo respaldo). ⚠️ El sitio anterior está **comprometido**: tenía publicaciones
  de spam de casinos y corría sobre PHP 7.4. Cambiar también las contraseñas de
  hosting/WordPress.
- [ ] Microsoft 365: migrar las casillas reales a `@cerpat.io`.
- [ ] `api.cerpat.io` como dominio propio de la API (hoy responde el host de Railway).
