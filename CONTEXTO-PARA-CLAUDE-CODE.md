# CONTEXTO PARA CLAUDE CODE — Planeador CERPAT
### Léeme primero, antes de escribir cualquier línea de código

Este documento resume todo lo que ya se diseñó y validó con el equipo de CERPAT (firma contable) a través de un prototipo funcional (HTML/JS de un solo archivo, incluido en `prototipo-referencia/`). El prototipo usa `localStorage` y no tiene seguridad real — **no es el objetivo final, es la especificación viva**. Tu trabajo es reconstruir esto con arquitectura de producción, conservando el modelo de datos y las reglas de negocio exactamente como se describen aquí.

---

## 1. Qué es el producto

Un sistema de gestión y planificación de tareas para una firma de contadores. Permite:
- Llevar seguimiento de obligaciones tributarias/contables de empresas clientes (hoy 60, proyectado a 200).
- Que los líderes de área midan y hagan seguimiento a sus equipos (35 usuarios internos: asesores, auditores, auxiliares, administradores).
- Eventualmente, dar acceso de solo lectura a los propios equipos contables de los clientes (portal de cliente, fase futura — **no construir permisos de cliente de forma improvisada; diseñar el aislamiento por empresa desde el modelo de datos**).

---

## 2. Arquitectura decidida

- **Frontend:** Next.js (React), desplegado en **Vercel**. Subdominio: `app.cerpat.io`.
- **Backend:** API en Node.js/Express, desplegado en **Railway**. Subdominio: `api.cerpat.io`. Toda regla de negocio vive aquí — el frontend nunca debe poder saltarse una validación.
- **Base de datos:** PostgreSQL en Railway.
- **Autenticación:** Auth.js (NextAuth) o Clerk — **nunca contraseñas en texto plano ni lógica de auth hecha a mano.**
- **Automatización/notificaciones:** n8n (plantilla de Railway). Se conecta a Postgres solo con un usuario de **solo lectura** para consultas; para crear/modificar datos, **debe llamar a la API**, nunca escribir directo a la base de datos (así respeta las mismas reglas de negocio que un usuario humano).
- **Correo:** buzón corporativo de Microsoft 365 (`notificaciones@cerpat.io`), vía Microsoft Graph API (OAuth2 — no SMTP con contraseña, Microsoft lo deshabilitó por seguridad).
- **Archivos de soporte documental:** por ahora solo un link (campo de texto); si más adelante se sube el archivo real, usar Cloudflare R2 o AWS S3.
- **Monitoreo de errores:** Sentry.
- **Dominio:** `cerpat.io` — raíz para correo (Microsoft 365), subdominios para cada servicio de la app.

Diagrama completo disponible en `docs/arquitectura.mermaid` (cópialo del prototipo si no está aún en el repo).

---

## 3. Modelo de datos (basado en el prototipo — usar como referencia de columnas y relaciones, no como esquema literal de `localStorage`)

### Tabla `empresas` (clientes)
```
id, nombre, nit, tipo (FK catálogo tipos_empresa), sector (FK catálogo sectores),
regimen (FK catálogo regimenes), periodicidad_iva (FK catálogo periodicidades_iva),
municipio (FK catálogo municipios), created_at
```

### Tabla `usuarios`
```
id, nombre, email (único), password_hash, activo (bool), created_at
```

### Tabla `roles` y `usuario_roles` (relación muchos-a-muchos)
Roles: Administrador, Asesor, Auditor, Auxiliar. **Los permisos de cada rol deben aplicarse en el backend, verificados en cada endpoint — no solo ocultar botones en el frontend.**

### Tabla `asesores`
Si un asesor es distinto de un usuario del sistema (puede haber asesores que no tengan login), mantenerlos como tabla separada vinculable a `usuarios.id` cuando aplique.

### Tabla `tareas`
```
id, titulo, empresa_id (FK, permite múltiples empresas → tabla intermedia tarea_empresas si aplica),
estado (enum: por_iniciar | en_curso | en_revision | terminado | auditado | no_realizado),
prioridad (enum: alta | media | baja),
fecha_inicio, fecha_vencimiento,
tipo_tarea (FK catálogo), tipo_obligacion (FK catálogo), periodicidad (FK catálogo),
auditoria (enum: pendiente | aprobada | rechazada),
requiere_revision_tecnica (bool), genera_pago (bool), genera_ineficacia (bool),
requiere_soporte (bool), soporte_link (texto, requerido si requiere_soporte=true),
interno (bool) — si es true, se excluye de cualquier vista/exportación de cara al cliente,
observaciones (texto), creado_por (FK usuarios), created_at, updated_at
```

### Tabla `tarea_asignados` (muchos-a-muchos entre tareas y usuarios/asesores)

### Tabla `tarea_etiquetas` (muchos-a-muchos entre tareas y catálogo de etiquetas)

### Tabla `subtareas`
```
id, tarea_id (FK), texto, estado (enum: pendiente | realizada | no_aplica | no_realizada), orden
```

### Tabla `pagos` (obligaciones de pago)
```
id, empresa_id (FK), obligacion (texto o FK catálogo tipo_obligacion), periodicidad,
fecha_vencimiento, valor (numérico), estado_tarea (enum: por_iniciar | en_curso | terminado),
estado_pago (enum: pendiente | presentado_sin_pago | presentado_pagado | no_presentado)
```

### Tabla `vencimientos` (calendario tributario general, no ligado a una tarea específica)
```
id, obligacion, municipio, periodo, fecha_vencimiento, nit_rango
```

### Catálogos (tablas simples de referencia, todas con `id, nombre, orden`)
`tipos_empresa`, `sectores`, `regimenes_tributarios`, `periodicidades_iva`, `tipos_servicio`,
`municipios` (con columna adicional `departamento`), `tipos_tarea`, `tipos_obligacion`,
`periodicidades`, `etiquetas`

### Tabla `parametros_liquidacion` (fila única de configuración, editable por Administrador)
```
tasa_mora_mensual (decimal), valor_uvt, smmlv, sancion_minima_uvt, pct_sancion_extemporaneidad
```

### Tabla `apariencia` (fila única de configuración de marca)
```
nombre_app, subtitulo, color_primario
```

---

## 4. Reglas de negocio — YA VALIDADAS, no reinterpretar

Estas reglas se probaron con el equipo en el prototipo. Impleméntalas tal cual, **del lado del servidor**:

1. **No se puede marcar una tarea como "Terminado" o "Auditado" si tiene alguna subtarea en estado "Pendiente".**
2. **Si `requiere_soporte = true`, no se puede guardar la tarea sin un `soporte_link` no vacío.**
3. **Si `tarea.auditoria = 'aprobada'`, la tarea queda bloqueada para edición.** Solo se desbloquea explícitamente desde la vista de Auditoría (acción "Desbloquear"), que además debe quedar registrada en un log de auditoría (quién desbloqueó y cuándo — esto el prototipo no lo registra, pero en producción sí debe hacerse).
4. **Si no se asigna ningún responsable a una tarea nueva, se asigna automáticamente al usuario que la crea** (nunca queda sin asignar).
5. **"Mi Día" muestra únicamente tareas con `fecha_vencimiento = hoy` Y donde el usuario actual está en `tarea_asignados`** — no incluye vencidas de días anteriores (esas se revisan en Tablero/Lista).
6. **Cálculo de intereses y sanción** (tabla `pagos`), solo si `estado_pago != 'presentado_pagado'` y `fecha_vencimiento < hoy`:
   - `dias_mora = hoy - fecha_vencimiento` (en días)
   - `tasa_diaria = tasa_mora_mensual / 30`
   - `interes = valor * tasa_diaria * dias_mora`
   - Si `dias_mora > 60`: `sancion = max(valor * pct_sancion_extemporaneidad, sancion_minima_uvt * valor_uvt)`, si no, `sancion = 0`
   - `total = valor + interes + sancion`
   - Este cálculo debería recalcularse automáticamente cada día (job programado en n8n o en el backend), no solo al consultar la pantalla.
7. **Vista de Pagos: no mostrar obligaciones futuras** (`fecha_vencimiento > hoy`) **a menos que** `estado_tarea = 'terminado'` **o ya estén vencidas o ya estén pagadas.**
8. **Impresión de calendario en modo "Cliente":** excluir siempre las tareas con `interno = true`.
9. **Catálogo de etiquetas es dinámico** — un usuario puede crear una etiqueta nueva al vuelo desde el formulario de tarea, y debe quedar disponible en el catálogo para reutilizarse después.

## 5. Reglas de seguridad — no negociables

- Contraseñas **siempre** con hash (bcrypt/argon2), nunca en texto plano, ni siquiera en variables de entorno de desarrollo compartidas.
- Todas las reglas de la sección 4 se validan **en el backend**, sin excepción — el frontend puede duplicarlas para dar feedback inmediato al usuario, pero la fuente de verdad es el servidor.
- Los permisos por rol se verifican en cada endpoint de la API, no solo ocultando elementos de la interfaz.
- Nunca debe haber un estado en el que **ningún usuario Administrador esté activo** — considerar una salvaguarda equivalente a la que tenía el prototipo (un mecanismo de recuperación de acceso), pero implementada de forma segura (por ejemplo, un proceso de recuperación por correo, no una contraseña hardcodeada).
- Variables de entorno para todas las credenciales (base de datos, OAuth, API keys) desde el primer commit — nunca en el código fuente.

## 6. Vistas de la aplicación (ya diseñadas visualmente en el prototipo)

Inicio (dashboard con métricas), Calendario (mensual, con arrastrar-y-soltar para cambiar fecha), Tablero (kanban por estado, con arrastrar-y-soltar para cambiar estado), Lista (tabla completa filtrable, exportable a Excel), Mi Día, Pagos (con liquidador de intereses), Auditoría (aprobar/rechazar/desbloquear), Administración (Usuarios, Empresas, Asesores, Catálogos, Cat. Tareas, Vencimientos, Parámetros, Apariencia), Importación masiva de tareas y usuarios vía CSV, Impresión de calendario filtrada (por asesor, etiqueta, empresa o todas).

Antes de construir cualquiera de estas pantallas, **ábrela en `prototipo-referencia/planeador-cerpat.html`** para ver exactamente cómo se comporta.

## 7. Qué preguntar antes de asumir

Si algo en este documento no es suficientemente claro para tomar una decisión de esquema o de código, **pregunta antes de asumir** — es más barato aclarar una duda ahora que reconstruir una tabla después de que ya haya datos reales en producción.
