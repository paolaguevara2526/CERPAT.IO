# Visión de plataforma — CERPAT

Documento **vivo** de hacia dónde va CERPAT como plataforma: de un planeador a el
sistema operativo de la firma **y** un producto que se le vende a los clientes.
Se alimenta a medida que co-creamos la visión. Para el estado en producción y el
roadmap operativo, ver [`estado-y-plan.md`](./estado-y-plan.md); para la
arquitectura y las decisiones, [`arquitectura.md`](./arquitectura.md).

> **Mapa visual interactivo** (borrador para co-crear):
> https://claude.ai/code/artifact/19333c61-ac1f-4875-9eb4-147ec021b559
> _(privado; se comparte desde el menú del artifact)._

_Última actualización: 2026-08-08._

## 1. Propósito dual

Una misma plataforma con dos propósitos:

1. **Operar CERPAT por dentro** — el equipo corre su operación (outsourcing,
   auditoría/RF y, a futuro, talento y SARLAFT).
2. **Vender esas mismas herramientas a los clientes** — algunas o todas, según lo
   que necesite su operación contable, de SARLAFT, etc.

La meta: **toda la operación en un solo sitio**, con un norte claro — seguimiento
a la operación, mayor control y mayor automatización.

## 2. Tres modalidades de uso

La misma plataforma se usa de tres maneras; lo que cambia es **quién opera** y
**qué contrató**:

| Modalidad | Quién opera | Estado |
|---|---|---|
| **Interno** | El equipo de CERPAT corre su propia firma | ✅ funciona |
| **Portal · hecho-por-ti** | CERPAT opera; el cliente observa y colabora (aislado por NIT/grupo) | ✅ existe |
| **Producto (SaaS) · hazlo-tú** | El cliente compra módulos y su propio equipo los opera, en su espacio, con su marca | 🎯 visión |

**Decisión estructural:** cada cliente que compra pasa a ser **su propio espacio
aislado** (una `Organizacion` = tenant), con sus usuarios y solo los módulos que
contrató. Ver [ADR-0002](./arquitectura.md#adr-0002).

## 3. Los cinco frentes (módulos)

Cada área de negocio es un **módulo**; cada uno es también un **producto vendible
por separado**.

| Módulo | Estado | Notas |
|---|---|---|
| **Outsourcing y asesoría** | ✅ Construido | El planeador que ya opera con 90 clientes |
| **Auditoría y Revisoría Fiscal** | 🟡 En progreso | Hoy: Portal de Hallazgos |
| **SARLAFT** | 🔴 Por construir | Regulado (LAFT). Datos sensibles |
| **Talento Humano** | ⬜ Por construir | Autoservicio del empleado + datos personales |
| **Cómo trabajamos** | ⬜ Por construir | Sistema de gestión: procesos, manuales, políticas (documental transversal) |

> El **cumplimiento normativo** va **embebido** en la operación (Mi Ruta) y en
> Revisoría Fiscal; **SARLAFT** es el único módulo aparte, por ser regulado.

## 4. Áreas separadas en el menú, trabajo transversal en la práctica

Separar las áreas es para **vender, dar permisos y ordenar el menú** — no para
aislar el trabajo:

- **Cada persona tiene una sola "Mi Ruta".** Mi Día, Calendario, Tablero y Lista
  juntan **todas sus tareas, del área que sea**. Un asesor de impuestos que revisa
  los impuestos de un cliente de Revisoría lo ve ahí, con todo lo demás — sin
  "cambiar de área". (Las vistas ya agregan por **persona**, no por módulo.)
- **El cliente es uno solo (vista 360):** todas las áreas miran la misma ficha.
- **Las áreas colaboran:** una tarea o un hallazgo de un área puede **disparar
  trabajo en otra**, sin duplicarse.
- **La única frontera dura** es **entre clientes-tenant distintos** (aislamiento
  SaaS). Dentro de un tenant, todo se cruza libremente.

## 5. Fundaciones compartidas

Piezas transversales que sostienen los cinco módulos. Resolverlas temprano abarata
cada módulo nuevo y hace la plataforma **segura por diseño**.

| # | Fundación | Qué es |
|---|---|---|
| F1 | **Permisos en 3 niveles** | Plataforma (CERPAT) · organización (cliente) · módulo × acción. Ver [ADR-0003](./arquitectura.md#adr-0003) |
| F2 | **Motor de solicitudes y aprobaciones** | Solicitar → aprobar/devolver → seguimiento. Reutilizable en permisos, vacaciones, préstamos, hallazgos y alertas |
| F3 | **Bitácora / auditoría transversal** | "Quién hizo qué y cuándo" en toda la plataforma. Semilla: `EventoTarea`. Obligatoria para SARLAFT |
| F4 | **Gestión documental** | Repositorio con versiones y **acuse de lectura**. Sirve a "Cómo trabajamos", SARLAFT y Talento |
| F5 | **Notificaciones y alertas** | Recordatorios de vencimientos, tareas atrasadas, aprobaciones pendientes |
| F6 | **Protección de datos** | Ley 1581 / Habeas Data: acceso restringido, cifrado de campos sensibles, retención. Ver [ADR-0005](./arquitectura.md#adr-0005) |
| F7 | **Automatización** | Tareas programadas: generación recurrente, cierres, reportes, disparadores de alertas |
| F8 | **Design system** | Formalizar las piezas ya usadas (tiles, tablas, embudos, temas) como kit compartido |
| F9 | **Dashboard ejecutivo** | Home con KPIs por área — donde "toda la operación en un sitio" se vuelve tangible |
| F10 | **Aislamiento por tenant** | Cada cliente-comprador, su espacio aislado. Base ya existe (`Organizacion`) |
| F11 | **Licenciamiento por módulo** | Qué contrató cada cliente; encender/apagar módulos por tenant (entitlements). Ver [ADR-0002](./arquitectura.md#adr-0002) |
| F12 | **Marca y onboarding por tenant** | White-label (logo/colores) y autoconfiguración (áreas, catálogos, calendario) |

## 6. Navegación y nomenclatura

- **Barra lateral en acordeón por área:** cada área se despliega y muestra sus
  funciones solo cuando se abre. Más amigable y descubrible; recuerda la última
  abierta; los permisos filtran qué áreas ve cada quien; búsqueda y notificaciones
  globales arriba. A futuro, si las áreas crecen, se le puede sumar un selector de
  módulo encima. Ver [ADR-0004](./arquitectura.md#adr-0004).
- **Nombres (hilo sherpa, alineados al lema "guiamos a nuestros clientes a la
  cima"):**
  - **Mi Ruta** — el área del día a día (Mi Día, Calendario, Tablero, Lista,
    clientes/planes, visitas, tributario). Personal y transversal; viaja bien en
    white-label (no lleva la marca CERPAT).
  - **Cómo trabajamos** — el sistema de gestión (procesos, manuales, políticas).
  - **SARLAFT**, **Talento Humano**, **Auditoría y R. Fiscal** — nombre funcional.
  - **Ruta CERPAT** se reserva para nombrar la **metodología / promesa de valor**
    (no un ítem del menú).

## 7. Por dónde arrancar

1. Dibujar y afinar el mapa visual (en curso).
2. **Alimentar este documento vivo** y registrar los ADR (hecho: 0002–0005).
3. Elegir el primer módulo estrenando 1–2 fundaciones. **Recomendación:** *Talento
   Humano con el motor de aprobaciones (F2)* — entrega valor visible rápido y
   obliga a resolver bien permisos (F1), protección de datos (F6) y autoservicio,
   que sirven para todo lo demás.
