# Backlog de Sprint — Implementación de Requisitos No Funcionales

**Proyecto:** Tienda San Miguel — Sistema de Gestión de Inventario y Ventas
**Origen:** [Informe de Verificación de RNF](./Informe%20de%20Verificacion%20de%20Requisitos%20No%20Funcionales.md)
**Fecha:** 07/10/2026 · **Alcance:** 38 RNF · **Total:** 58 tareas en 6 sprints

---

## Cómo usar este backlog

### Convenciones

| Elemento | Convención |
|---|---|
| **ID de tarea** | `S< sprint>-<NN>` (p. ej. `S0-03`). El prefijo indica el sprint |
| **Bloqueante** | 🔴 Debe resolverse antes de producción con datos reales |
| **Alta** | 🟠 Alta prioridad dentro de su sprint |
| **Media** | 🟡 Importante pero no urgente |
| **Esfuerzo** | Puntos de historia: **XS**=1 · **S**=2-3 · **M**=5 · **L**=8 · **XL**=13 (Fibonacci) |
| **Tipo** | `SEG` seguridad · `DAT` datos · `PERF` rendimiento · `DIS` disponibilidad · `UX` interfaz · `DOC` documentación · `INT` interoperabilidad · `CFG` configuración · `EVD` evidencia |

### Definición de Hecho (aplica a toda tarea)

Una tarea no se cierra hasta que cumple **los seis** puntos:

1. ✅ **Implementado** el cambio en código, no solo documentado.
2. ✅ **Prueba automatizada** que falle antes del cambio y pase después (salvo tareas puramente documentales, que requieren revisión de al menos 2 personas).
3. ✅ **Criterios de aceptación** de la tarea verificados, con el número medido registrado.
4. ✅ **`npm run lint` y `tsc --noEmit` sin errores.**
5. ✅ Sin **regresión**: `npm test` con al menos el mismo número de pruebas verdes.
6. ✅ **Evidencia adjunta** al cierre: captura, salida de consola, o cifra medida.

### Regla de dependencia entre sprints

> **Ningún sprint puede cerrarse si tiene una tarea 🔴 o 🟠 abierta.**
> Los sprints S3 y S5 son independientes entre sí y pueden ejecutarse en paralelo.

---

## Panorama de los 6 sprints

| Sprint | Foco | Tareas | Puntos | 🔴 | RNF que cierra |
|---|---|:---:|---:|:---:|---|
| **S0** | Autorización financiera | 6 | 17 | 6 | **8.3** |
| **S1** | Datos, auditoría y fugas | 12 | 54 | 6 | 6.1, 6.2, 6.3, 8.1, 11.3 |
| **S2** | Rendimiento y disponibilidad | 11 | 47 | 3 | 3.1, 3.2, 3.3, 8.2, 9.1, 9.2, 9.3, 13.1 |
| **S3** | Identidad visual | 8 | 27 | 3 | 1.1, 1.2, 1.3, 7.1, 7.3 |
| **S4** | Ayuda y documentación | 8 | 33 | 5 | 11.1, 11.2, 2.3, 4.1, 4.3, 13.3 |
| **S5** | Configuración e interoperabilidad | 9 | 54 | 3 | 4.2, 5.1, 5.2, 5.3, 10.1, 10.3, 13.2, 14.2 |
| **S6** | Evidencia y mediciones | 4 | 18 | 1 | 2.1, 2.2, 7.2 |
| | | **58** | **250** | **27** | **35 de 38 RNF** |

> Los 3 RNF restantes (**13.1**, **13.2**, **13.3**) no generan tareas de código:
> dependen de hardware del negocio (ver [RNF no cubiertos por tareas](#rnf-que-no-generan-tareas)).

---

## Mapa de trazabilidad RNF → tarea

| RNF | Veredicto | Tareas |
|---|:---:|---|
| 1.1 Tipografía ≥ 14 px | ❌ | S3-01, S3-02 |
| 1.2 Paleta máx. 3 colores | ❌ | S3-03, S3-04 |
| 1.3 Logo | ❌ | S3-05, S3-06 |
| 2.1 Novatos vs. expertos | ⚪ | S6-01 |
| 2.2 Reducción ≥ 30 % | ⚪ | S6-02 |
| 2.3 Manual 100 % | ❌ | S4-01, S4-02, S4-06 |
| 3.1 Carga de vistas ≤ 3 s | ❌ | S2-01, S2-02, S2-03 |
| 3.2 ≥ 10 usuarios | ⚪ | S2-04, S2-05 |
| 3.3 Búsqueda ≤ 2 s | ⚪ | S2-06, S2-07 |
| 4.1 Documentación | ⚠️ | S4-03, S4-06, S4-07 |
| 4.2 Configuración sin código | ❌ | S5-01, S5-02 |
| 4.3 Procedimiento de instalación | ⚠️ | S4-07, S4-08 |
| 5.1 Windows 10+ | ⚠️ | S5-03 |
| 5.2 Ubuntu 20.04+ | ⚠️ | S5-03 |
| 5.3 Chrome/Firefox/Edge | ⚪ | S5-04 |
| 6.1 Autenticación | ⚠️ | S1-09, S1-10, S1-11, S1-12 |
| 6.2 Cifrado en BD | ❌ | S1-01, S1-02, S1-03 |
| 6.3 Logs de cambios | ⚠️ | S1-04, S1-05, S1-06 |
| 7.1 100 % español | ✅ | S3-07 *(higiene)* |
| 7.2 Lenguaje claro | ⚪ | S6-03 |
| 7.3 Colores e iconos neutros | ⚠️ | S3-04, S3-08 |
| 8.1 Facturas legales | ❌ | S1-07, S1-08 |
| 8.2 Historial 5 años | ⚠️ | S2-09, S2-10 |
| 8.3 Acceso financiero | ❌ | **S0-01 … S0-06** |
| 9.1 Disponibilidad ≥ 95 % | ⚪ | S2-08 |
| 9.2 Copias diarias | ⚠️ | S2-06, S2-07 |
| 9.3 Recuperación ≤ 30 min | ⚪ | S2-11 |
| 10.1 Importar/exportar .xlsx | ❌ | S5-05, S5-06 |
| 10.2 BD relacional | ✅ | — *(ya cumple)* |
| 10.3 Arquitectura modular | ⚠️ | S5-07, S5-08 |
| 11.1 Ayuda en línea | ❌ | S4-03, S4-04 |
| 11.2 Manual PDF | ❌ | S4-05 |
| 11.3 Mensajes de error | ⚠️ | S1-09, S1-10, S1-11 |
| 13.1 Arranque ≤ 40 s | ⚪ | S6-04 |
| 13.2 Android ≥ 13 | ⚪ | — *(hardware)* |
| 13.3 Impresora | ⚠️ | S4-04 |
| 14.1 BD de productos | ✅ | — *(ya cumple)* |
| 14.2 App móvil | ❌ | S5-09 |

---

## Sprint 0 — Autorización financiera 🔴

**Objetivo:** cerrar la vulnerabilidad de control de acceso más grave del sistema.
**Bloquea:** cualquier despliegue con datos reales. **Partes independientes:** no requiere insumo previo.

### S0-01 🔴 `POST /api/facturacion` no verifica ningún rol

**RNF:** 8.3 · **Tipo:** SEG · **Esfuerzo:** XS (2) · **Depende de:** —
**Hallazgo:** `app/api/facturacion/route.ts:38-42` solo comprueba `if (!usuario)`.
Un `BODEGUERO` puede insertar en `factura` (`:77-82`), **cambiar el estado de una
venta a `CONFIRMADO`** (`:84-87`) y elegir `nombre_cliente`/`nit_cliente` arbitrarios (`:81`).

**Tarea:** añadir `isDuenoTipo(usuario.tipo_usuario)` al predicado del POST.

**Criterios de aceptación:**
- [ ] Un token con `tipo_usuario = "BODEGUERO"` recibe **HTTP 403** en `POST /api/facturacion`
- [ ] Un token con `tipo_usuario = "EMPLEADO"` recibe **HTTP 403**
- [ ] Un token con `tipo_usuario = "DUENO"` recibe **HTTP 200/201**
- [ ] Sin token → **HTTP 401**
- [ ] `estado_venta` **no** cambia a `CONFIRMADO` cuando la petición es rechazada
- [ ] Prueba automatizada que cubra los 4 casos (añadir a `__tests__/api/facturacion.test.ts`)

**Archivo:** `app/api/facturacion/route.ts`

---

### S0-02 🔴 Empleados pueden cobrar y marcar deudas como pagadas

**RNF:** 8.3 · **Tipo:** SEG · **Esfuerzo:** S (3) · **Depende de:** —
**Hallazgo:** `app/api/deudas/[id]/route.ts:18` y `app/api/deudas/[id]/pagos/route.ts:21`
usan `isStaffTipo`. Un `EMPLEADO` puede registrar abonos y **marcar deudas enteras
como `PAGADA` sin recibir dinero**, lo que además **desbloquea automáticamente al
cliente moroso** vía `recalcularBloqueoCliente` (`deudas/[id]/route.ts:53-55`).
El módulo es inconsistente: crear deuda **sí** exige `esDueno()` (`deudas/route.ts:94`).

**Tarea:** cambiar `isStaffTipo` → `isDuenoTipo` en ambas rutas.

**Criterios de aceptación:**
- [ ] `EMPLEADO` recibe **403** en `PATCH /api/deudas/[id]`
- [ ] `EMPLEADO` recibe **403** en `POST /api/deudas/[id]/pagos`
- [ ] `estado_deuda` **no** cambia a `PAGADA` con token de `EMPLEADO`
- [ ] `cliente.bloqueado_por_deuda` **no** cambia a `FALSE` como efecto secundario de un intento rechazado
- [ ] `saldo_pendiente` no se modifica con token de `EMPLEADO`
- [ ] `DUENO` mantiene el comportamiento actual completo
- [ ] **Coherencia interna verificada:** crear deuda, cobrar deuda y marcar pagada exigen el **mismo** rol
- [ ] Pruebas automatizadas para ambos endpoints y ambos roles

**Nota:** el comentario de `pagos/route.ts:13-15` justifica la decisión por
proceso de negocio («*es el empleado o el dueño quien recibe el dinero en caja*»).
**Actualizar ese comentario** para reflejar el cambio: el control de acceso es
una decisión de seguridad, no de proceso.

**Archivos:** `app/api/deudas/[id]/route.ts`, `app/api/deudas/[id]/pagos/route.ts`

---

### S0-03 🔴 Empleados pueden modificar precios de venta

**RNF:** 8.3 · **Tipo:** SEG · **Esfuerzo:** S (2) · **Depende de:** —
**Hallazgo:** `app/api/precios/route.ts:35` usa `isStaffTipo`. El `UPDATE` de
`:45-49` **no valida que los precios sean no negativos**, así que un empleado puede
fijar `precio_unitario = 0`. Además **la ruta no loguea nada** (ver S1-05).

**Tarea:** restringir a `isDuenoTipo`, validar rango y registrar el cambio.

**Criterios de aceptación:**
- [ ] `EMPLEADO` recibe **403** en `PATCH /api/precios`
- [ ] `precio_unitario < 0` → **400** con mensaje en español
- [ ] `precio_mayoreo < 0` → **400** con mensaje en español
- [ ] `precio_mayoreo > precio_unitario` → **400** (validación de coherencia comercial)
- [ ] El cambio se registra en el log de auditoría (dependencia: **S1-05**)
- [ ] Prueba automatizada para cada caso

**Dependencias:** la parte de logging requiere S1-05; la de autorización es independiente.

**Archivo:** `app/api/precios/route.ts`

---

### S0-04 🔴 Crear clientes es la puerta trasera al límite de deuda

**RNF:** 8.3 · **Tipo:** SEG · **Esfuerzo:** XS (2) · **Depende de:** —
**Hallazgo:** `PATCH /api/clientes/[id]:16` **sí** exige `!== DUENO`, pero
`POST /api/clientes:45` usa `isStaffTipo` y toma `limite_deuda` del body (`:47`),
usándolo directo (`:49-53`). Un empleado puede crear un cliente con crédito ilimitado.

**Tarea:** ignorar `limite_deuda` del body cuando quien llama no es `DUENO`.

**Criterios de aceptación:**
- [ ] `EMPLEADO` recibe **403** en `POST /api/clientes`
- [ ] Si quien llama es `EMPLEADO`, el `limite_deuda` enviado se descarta (valor por defecto del schema), **nunca se persiste el del body**
- [ ] `DUENO` puede seguir creando clientes con `limite_deuda` arbitrario
- [ ] Prueba automatizada que verifique que un `limite_deuda: 999999` enviado por `EMPLEADO` **no** queda en la base

**Archivo:** `app/api/clientes/route.ts`

---

### S0-05 🔴 Lectura de datos financieros abierta a empleados

**RNF:** 8.3 · **Tipo:** SEG · **Esfuerzo:** S (3) · **Depende de:** —
**Hallazgo:** cuatro rutas usan `isStaffTipo` para **lectura de información
financiera y personal**:
- `GET /api/facturacion:11` → nombre, correo y total facturado por cliente
- `GET /api/deudas:23` → **`telefono_deudor`**, montos, saldos, historial de pagos con `registrado_por`
- `GET /api/stats:9` → agregados de ventas y clientes bloqueados
- `GET /api/ventas:35` → listado de ventas

La UI ya las oculta al empleado (`StaffShell.tsx:90` incluye `/deudas` en la lista
de dueño), lo que confirma que la **intención** es admin-only pero la
**aplicación** es staff.

**Criterios de aceptación:**
- [ ] `EMPLEADO` recibe **403** en `GET /api/facturacion`, `GET /api/deudas`, `GET /api/stats`, `GET /api/ventas`
- [ ] `BODEGUERO` recibe **403` en las cuatro**
- [ ] `DUENO` mantiene acceso completo
- [ ] La UI y la API **coinciden**: todo enlace oculto en `StaffShell.tsx` tiene su equivalente 403 en la API
- [ ] Prueba automatizada por ruta y por rol (matriz de 12 casos mínimos)
- [ ] **`README.md:307-317` actualizado** para que la tabla de permisos refleje la API real

> **Nota de diseño:** `GET /api/ventas` es la vista operativa del empleado (registrar
> ventas es su trabajo). Si el negocio requiere que el empleado consulte sus propias
> ventas, **acotar la respuesta a `id_usuario = usuario.id_usuario`** en lugar de
> bloquear la ruta. Confirmar el alcance con el dueño antes de implementar.

**Archivos:** `app/api/facturacion/route.ts`, `app/api/deudas/route.ts`, `app/api/stats/route.ts`, `app/api/ventas/route.ts`

---

### S0-06 🔴 Cobertura de pruebas de autorización por rol

**RNF:** 8.3 · **Tipo:** SEG · **Esfuerzo:** M (5) · **Depende de:** S0-01…S0-05
**Hallazgo:** existe `__tests__/lib/roles.test.ts` (helpers puros) pero **ningún
test de integración comprueba que un token de `EMPLEADO` reciba 403 en rutas de
dueño**. `login-2fa.test.ts` cubre 2FA, no autorización. Esto permitió que los 5
defectos de S0-01…S0-05 llegaran a producción sin ser detectados.

**Tarea:** suite de autorización que cubra **toda** ruta sensible.

**Criterios de aceptación:**
- [ ] Matriz de pruebas que itere **cada ruta de `app/api/`** × **los 3 roles** + sin token
- [ ] La matriz declara explícitamente el rol esperado por ruta (fuente única de verdad)
- [ ] **100 % de las rutas financieras** verificadas con `EMPLEADO` y `BODEGUERO`
- [ ] La prueba falla si alguien **relaja** un predicado de rol en el futuro
- [ ] Integrada en CI (`.github/workflows/ci.yml`)

**Archivo nuevo:** `__tests__/integration/autorizacion-roles.test.ts`

---

## Sprint 1 — Datos, auditoría y fugas de información

**Objetivo:** proteger los datos sensibles y hacer auditable toda mutación.
**Bloquea:** salida a producción. **Depende de:** Sprint 0.

### S1-01 🔴 Cifrado en reposo para datos sensibles en la BD

**RNF:** 6.2 · **Tipo:** DAT · **Esfuerzo:** L (8) · **Depende de:** —
**Hallazgo:** cero cifrado en la base. Búsqueda de `pgcrypto|encrypt(|AES|ENCRYPTION_KEY`
→ 0 resultados. `lib/db.ts:12-16` es un `Pool` pelado, sin `ssl`.
Texto plano: **NIT proveedor/cliente/factura** (`01_schema.sql:40,100,289`),
**teléfonos** (`:110,96,42,301`), correos, **montos** (`:303,242,329,290`), direcciones.

**Tarea:** cifrar columnas sensibles con `pgcrypto`, con clave en variable de entorno.

**Criterios de aceptación:**
- [ ] Extensión `pgcrypto` habilitada por migración versionada
- [ ] NIT de **proveedor, cliente y factura** cifrados (AES, `pgp_sym_encrypt`)
- [ ] **Teléfonos** cifrados
- [ ] Nueva variable `DATA_ENCRYPTION_KEY` en `.env.example` **con valor de ejemplo, no real**
- [ ] La aplicación arranca y falla **cerrada** si la clave falta o es débil (patrón ya existente en `lib/auth.ts:17-24`)
- [ ] **Cifrado transparente en la capa de acceso a datos**: los `SELECT`/`INSERT` de la aplicación no requieren cambios (encapsular en `lib/`, no repetir la lógica en 47 rutas)
- [ ] Búsqueda por NIT sigue funcionando (usa una columna `*_hash` derivada, con `UNIQUE`)
- [ ] Script de **migración de datos existentes** que cifre lo ya almacenado
- [ ] Los 4 endpoints de recuperación de contraseña y verificación **no** se ven afectados
- [ ] Prueba: el texto plano **no** aparece en un `pg_dump` de prueba

**Consideración de diseño:** el RNF dice «datos sensibles». La frontera
recomendada es **identificadores fiscales + teléfonos** (datos de
identificación personal y tributaria). Cifrar montos financieros agrega complejidad de
agregación (no se pueden indexar ni sumar en BD) con beneficio de seguridad
marginal; para esos basta el cifrado del respaldo (ver S1-03). **Documentar la
decisión.**

**Archivos:** nueva migración en `migrations/`, `lib/` (nuevo módulo de cifrado), `lib/db.ts`

---

### S1-02 🔴 TLS en la conexión a PostgreSQL

**RNF:** 6.2 · **Tipo:** DAT · **Esfuerzo:** S (3) · **Depende de:** S1-01
**Hallazgo:** `lib/db.ts:15` usa `connectionString` sin `ssl`. `DATABASE_URL` en
`docker-compose.yml:11,35` y `docker-compose.prod.yml:19` no lleva parámetros de SSL.

**Criterios de aceptación:**
- [ ] `DATABASE_URL` acepta parámetros `?sslmode=require` sin cambios en código
- [ ] Si la base es externa, la conexión **falla cerrada** si el TLS no se negocia
- [ ] `docker-compose.prod.yml` documenta cuándo aplica `sslmode` (dentro de la red Docker no aplica)
- [ ] Verificado que las migraciones y los tests siguen funcionando con TLS activo

---

### S1-03 🔴 Cifrar los respaldos automáticos y sub retention a 5 años

**RNF:** 6.2, 8.2 · **Tipo:** DAT · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo (dos problemas en una tarea):**
- `README.md:435-442` admite que los respaldos automáticos **no están cifrados**
- `docker-compose.yml:93` fija `BACKUP_KEEP_MONTHS=6`, **contra los 5 años de RNF 8.2**

**Criterios de aceptación:**
- [ ] `BACKUP_KEEP_MONTHS` = **60** (o más) en `docker-compose.yml`
- [ ] Respaldos automáticos **cifrados** en reposo
- [ ] `BACKUP_ENCRYPTION_KEY` **añadida a `.env.example`** (hoy falta, aunque `README.md:454` y `backup-db.sh:80` remiten a ella)
- [ ] Un respaldo generado es **descifrable** con la clave del `.env` (prueba real de ciclo completo)
- [ ] Procedimiento de rotación de claves documentado
- [ ] **Considerado:** respaldos fuera del disco de la base (S2-06 cubre la програмación; aquí la copia externa)

---

### S1-04 🔴 Tabla de auditoría persistente

**RNF:** 6.3 · **Tipo:** SEG · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** **no existe tabla de auditoría** (0 resultados para
`auditoria|audit|bitacora` entre las 27 tablas). Los logs en archivo son mutables,
borrables y no consultables por SQL: con rotación de 5 × 50 MB, un cambio malicioso
queda sin prueba tras su expiración.

**Tarea:** tabla `auditoria` genérica + helper de escritura.

**Criterios de aceptación:**
- [ ] Tabla `auditoria` con: `actor_id`, `rol_actor`, `accion`, `entidad`, `id_entidad`, `datos_antes JSONB`, `datos_despues JSONB`, `ip`, `en timestamptz`
- [ ] Índices sobre `(entidad, id_entidad)` y `(actor_id, en)` y `(en DESC)`
- [ ] Helper en `lib/` que registre la mutación **dentro de la misma transacción** que el cambio (para que no puedan divergir)
- [ ] **Retención indefinida** (la tabla de auditoría no se rota)
- [ ] El actor se obtiene del token **releyendo la BD**, para que una degradación de rol posterior no falsifique el registro

**Archivo:** nueva migración + `lib/auditoria.ts` (nuevo)

---

### S1-05 🔴 Auditar las 31 rutas mutantes sin registro

**RNF:** 6.3 · **Tipo:** SEG · **Esfuerzo:** M (5) · **Depende de:** S1-04
**Hallazgo:** 8 de 39 rutas registran el evento de negocio; **31 no registran nada**.
Huecos graves: `precios:45-49` (precio), `facturacion:77-82` (emisión fiscal),
`usuarios:173-179` (alta y cambio de rol), `productos/[id]:165` (**DELETE**),
`clientes/[id]` (límite de deuda), `gestion-inventario/ajuste`,
`gestion-inventario/transferencia`, `bodegas/[id]:126-129` (**DELETE**).

**Prioridad de esta tarea — las 8 rutas con impacto financiero o de seguridad:**

| # | Ruta | Operación |
|---|---|---|
| 1 | `app/api/precios/route.ts` | Cambio de precio de venta |
| 2 | `app/api/facturacion/route.ts` | Emisión de factura + cambio de estado de venta |
| 3 | `app/api/usuarios/route.ts` | Alta de usuario, cambio de rol, desactivación, exención de 2FA |
| 4 | `app/api/clientes/[id]/route.ts` | Cambio del límite de deuda |
| 5 | `app/api/productos/[id]/route.ts` | Actualización y **DELETE** de producto |
| 6 | `app/api/gestion-inventario/ajuste/route.ts` | Ajuste manual de stock |
| 7 | `app/api/gestion-inventario/transferencia/route.ts` | Transferencia entre bodegas |
| 8 | `app/api/bodegas/[id]/route.ts` | **DELETE** de bodega y existencias |

**Criterios de aceptación:**
- [ ] Las 8 rutas prioritarias escriben en `auditoria` (actor, acción, entidad, datos antes/después)
- [ ] Las 23 restantes también quedan cubiertas (pueden ser en un sprint siguiente)
- [ ] Los **`DELETE`** registran el estado previo del registro eliminado
- [ ] Los cambios de precio y factura registran los valores **anteriores y nuevos**
- [ ] Ningún dato sensible (contraseña, token) se escribe en `auditoria`
- [ ] Prueba: una operación deja rastro consultable por `actor_id` y `entidad`

---

### S1-06 🟠 Registrar el actor en producción y el evento de logout

**RNF:** 6.3 · **Tipo:** SEG · **Esfuerzo:** S (2) · **Depende de:** —
**Hallazgo:** `middleware.ts:76` registra `{method, path, ip, query}` **sin
`id_usuario`**. La identidad solo aparece en `middleware.ts:101-104`, que es
`log.debug` — **no se emite en producción** (`lib/logger.ts:104`, nivel `info`).
Resultado: en producción los accesos a la API quedan **sin actor**.
Además `app/api/logout/route.ts` **no loguea nada**, impidiendo detectar
reutilización de tokens tras un logout.

**Criterios de aceptación:**
- [ ] El `id_usuario` aparece en el log de acceso a nivel **`info`** (visible en producción)
- [ ] El **logout** registra `{id_usuario, ip, en}`
- [ ] El middleware sigue **sin** filtrar parámetros sensibles del search string (mantener el comportamiento de `middleware.ts:62-67`)
- [ ] Prueba: un ciclo login → accessing API → logout deja **3 líneas** con el mismo `id_usuario` en nivel `info`

---

### S1-07 🔴 Datos del emisor y de emisión en la factura

**RNF:** 8.1 · **Tipo:** DAT · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** la tabla `factura` tiene **6 columnas** (`01_schema.sql:284-294`).
**No existe ninguna tabla ni configuración de emisor en todo el repositorio**, y
la factura se emite desde el navegador sin identificar a la tienda
(`facturacion/page.tsx:267-343`). Sin emisor, la factura **no cumple requisitos
legales**.

**Tarea:** tabla de datos del emisor (configurable) + campos legales en `factura`.

**Criterios de aceptación:**
- [ ] Tabla `configuracion_emisor` (1 fila) con: **RUC/NIT**, **razón social**, **dirección fiscal**, **teléfono**, **correo**
- [ ] Configurable desde la interfaz (ver S5-02, que externaliza el resto)
- [ ] `factura` gana: `fecha_emision` propia, **`subtotal_gravado`**, **`subtotal_exento`**, **`iva_igv`**, `moneda`, `serie`
- [ ] **100 % de facturas emitidas incluyen todos los campos obligatorios**
- [ ] El número correlativo sigue siendo **atómico** (no debe perderse la garantía actual de `nextval()` dentro del `INSERT`)
- [ ] Los datos del emisor aparecen en el comprobante impreso (`facturacion/page.tsx:267-343`)
- [ ] `fecha_emision` es la **fecha real de emisión**, no `fecha_venta` heredada
- [ ] Prueba: factura emitida hoy sobre una venta de hace una semana queda fechada hoy

---

### S1-08 🟠 Desglose de IVA/IGV y validación del NIT del cliente

**RNF:** 8.1 · **Tipo:** DAT · **Esfuerzo:** M (5) · **Depende de:** S1-07
**Hallazgo:** **cero columnas de impuesto** en el sistema. Irónicamente
`producto.exento_iva BOOLEAN` (`01_schema.sql:62`) indica que el modelo contempla
exenciones **pero nunca calcula ni desglosa el impuesto**. Además
`POST /api/facturacion:55` toma `nombre_cliente` y `nit_cliente` **del body** sin
validar el formato ni verificarlo contra `cliente.nit_cliente`, que **sí existe en
la BD** (`01_schema.sql:100`) pero no se usa.

**Criterios de aceptación:**
- [ ] IVA calculado **por línea** según `producto.exento_iva`
- [ ] La factura desglosa: gravado, exento, IVA, total
- [ ] `exento_iva = TRUE` → la línea va a `subtotal_exento` y no genera IVA
- [ ] La **tasa de IVA es configurable** (no hardcodeada) — ver S5-02
- [ ] El NIT se **toma del `cliente` de la venta**, no del body (o se valida contra él)
- [ ] NIT con formato inválido → **400** con mensaje en español
- [ ] Redondeos verificados: la suma de líneas **coincide exactamente** con el total (sin residuos de centavos)
- [ ] Prueba de una venta mixta (gravada + exenta)

---

### S1-09 🟠 Eliminar las 6 fugas de error técnico al cliente

**RNF:** 11.3 · **Tipo:** SEG · **Esfuerzo:** S (3) · **Depende de:** —
**Hallazgo:** 6 rutas devuelven `String(error)` crudo en el cuerpo JSON:

| Archivo:línea | Alcance |
|---|---|
| `app/api/bodegas/route.ts:68-72` | Incondicional · **sin loguear en servidor** |
| `app/api/gestion-inventario/ajuste/route.ts:141-145` | Incondicional · sin `apiError`, sin log |
| `app/api/gestion-inventario/kardex/route.ts:77-81` | Incondicional · sin `apiError`, sin log |
| `app/api/gestion-inventario/route.ts:80-84` | Incondicional · sin `apiError`, sin log |
| `app/api/gestion-inventario/transferencia/route.ts:196-200` | Incondicional · sin `apiError`, sin log |
| `app/api/health/route.ts:21-32` | Condicional: filtra en dev/staging |

**Criterios de aceptación:**
- [ ] **0 ocurrencias de `String(error)`** en el cuerpo de respuesta de `app/api/**`
- [ ] Las 5 rutas incondicionales usan `apiError()` (el patrón ya existente en `lib/api-error.ts`)
- [ ] **5 de las 6 no logueaban el error en servidor** → ahora sí, lo que permite reconstruir el fallo
- [ ] `app/api/health/route.ts` **no expone** el nombre del motor ni el de la base de datos
- [ ] Un error de BD simulado devuelve `{error: "Error interno del servidor"}` y **nada más**
- [ ] Prueba: `ECONNREFUSED` y `duplicate key value violates...` **nunca** llegan al cliente

---

### S1-10 🟠 Transformar los 42 puntos de paso de error en la UI

**RNF:** 11.3 · **Tipo:** UX · **Esfuerzo:** M (5) · **Depende de:** S1-09
**Hallazgo:** **42 sitios** hacen `setError(data.error || "...")` o
`showToast(d.error || ...)`, propagando **sin transformar** lo que devuelve la API
(p. ej. `app/login/page.tsx:43,78,105`; `app/deudas/page.tsx:406,429,519,578,744,793`;
`app/usuarios/page.tsx:126,180,207,250,292,317`). Son el punto de paso por donde
las 6 fugas de S1-09 llegarían a pantalla si se corrigieran solo los `route.ts`.

**Criterios de aceptación:**
- [ ] Helper único de Cliente (`lib/` o `components/`) que normaliza la respuesta de error
- [ ] Los **42 sitios** usan el helper
- [ ] `app/historial-ventas/page.tsx:192,261-262` deja de renderizar `e.message` crudo (riesgo residual de `"Failed to fetch"` en inglés, ver 7.1)
- [ ] Un error de red se muestra en español, nunca como texto del runtime
- [ ] Los 22 placeholders genéricos `"Error de conexión"` se reemplazan por mensajes que **digan qué falló y qué hacer** (el RNF pide «descriptivos», no solo «sin códigos técnicos»)

---

### S1-11 🟠 Sustituir errores genéricos por mensajes descriptivos

**RNF:** 11.3 · **Tipo:** UX · **Esfuerzo:** S (3) · **Depende de:** S1-10
**Hallazgo:** el patrón dominante es genérico — `«Error al consultar ventas»`,
`«Error al crear bodega»` — sin causa ni acción sugerida. Los 22 sites con
`"Error de conexión"` tampoco indican qué hacer. Contrasta con los buenos casos
que ya existen: `ventas/[id]/anular/route.ts:111` («*No se pudo deshacer la venta*»)
y `ordenes/[id]/route.ts:76` («*No se puede modificar una orden ${estado}*»).

**Criterios de aceptación:**
- [ ] Cada error de negocio dice **qué pasó** y **qué puede hacer el usuario**
- [ ] Mantener el patrón ya establecido en `lib/api-error.ts:1-2`
- [ ] Los mensajes **no** incluyen identificadores técnicos (nombres de tabla, columnas, códigos)

---

### S1-12 🟠 Política de contraseña y revocación de sesión

**RNF:** 6.1 · **Tipo:** SEG · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo (cuatro debilidades):**
- **Contraseña ≥ 6 chars sin complejidad** (`usuarios/route.ts:216-218`, `recuperar/cambiar:21,40-42`) — sin mayúscula/minúscula, dígitos, símbolos, ni lista de contraseñas comunes. Y el dueño puede **eximir de 2FA** (`requiere_2fa`, `usuarios/route.ts:274`)
- **JWT no revocable** (`logout/route.ts:7` solo borra la cookie del cliente; el token sigue siendo válido 8 h). Cambiar la contraseña **no** invalida sesiones activas
- **Rol confiado al claim del JWT** (`lib/server-auth.ts:4-8` no relee la BD): un usuario degradado o desactivado conserva permisos hasta 8 h
- **Sin bloqueo por cuenta, solo por IP** — `login_intento` tiene `ip` como PK (`01_schema.sql:429`), así que no es implementable sin cambio de esquema

**Criterios de aceptación:**
- [ ] Contraseña mínima **≥ 8** caracteres, con al menos 2 de 3 clases de caracteres
- [ ] Rechazo de contraseñas comunes y de las que contienen el correo o nombre del usuario
- [ ] Mensaje de validación en español, **sin revelar qué regla exacta falló**
- [ ] **Blacklist de revocación de JWT** (`jti` + `sub` + expiración), consultado al verificar el token
- [ ] Logout y cambio de contraseña **invalidan** las sesiones activas
- [ ] Un usuario desactivado o degradado de rol pierde permisos en **≤ 5 min** (no 8 h)
- [ ] **Bloqueo por cuenta** añadido a `login_intento` (columna de usuario), además del límite por IP
- [ ] Cierre de la fuga de enumeración de usuarios por tiempo (`login/route.ts:62-74`): un `bcrypt.compare` contra hash constante en la ruta de «no encontrado»

**Nota de esfuerzo:** el ítem de *blacklist de revocación* puede diferirse a un
sprint posterior si el tiempo aprieta; **los ítems de contraseña y de
desactivación de usuario no deben diferirse**.

---

## Sprint 2 — Rendimiento y disponibilidad

**Objetivo:** cumplir los umbrales de 3 s / 10 usuarios / 2 s y garantizar respaldos y disponibilidad.
**Depende de:** Sprint 1 (para poder medir sin ruido de fugas de datos).

### S2-01 🔴 Corregir paginación de `/api/ventas`

**RNF:** 3.1 · **Tipo:** PERF · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** `app/api/ventas/route.ts:78-92` aplica `LIMIT` **después** del
`GROUP BY`/`json_agg`, por lo que PostgreSQL **agrega todas las filas antes de
paginar**. Plan registrado en el informe de volumen: `GroupAggregate (actual rows=20180)`
+ `Incremental Sort (actual rows=50445)`. **El propio equipo ya identificó la causa
y la recomendación (informe de volumen, líneas 269-276); el patrón sigue sin corregirse.**

**Criterios de aceptación:**
- [ ] La paginación se aplica **antes** de la agregación (subconsulta o CTE paginado)
- [ ] El plan de ejecución ya **no** muestra `GroupAggregate` sobre el conjunto completo
- [ ] `/api/ventas` con 20,180 ventas: **p95 < 3 s** (base actual: 22.61 s)
- [ ] El número de filas agregadas por consulta es **≤ el tamaño de página**, no 20,180
- [ ] Prueba de integración que verifique que página 1 y página 2 devuelven ventas distintas y correctas

---

### S2-02 🔴 Paginar `/api/deudas`

**RNF:** 3.1 · **Tipo:** PERF · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** `app/api/deudas/route.ts:27-84` **no tiene paginación** — devuelve el
conjunto completo. Con 5,000 deudas alcanzó **p95 = 29.33 s** (informe de volumen,
línea 213). El propio informe lo marca como bug crítico (líneas 15-16, 201, 269-276).

**Criterios de aceptación:**
- [ ] La respuesta se pagina (los valores actuales de página inicial `[10,25,50]` en `deudas/page.tsx:350` se mantienen)
- [ ] `/api/deudas` con 5,000 deudas: **p95 < 3 s** (base actual: 29.33 s)
- [ ] La UI consume la nueva forma paginada **sin perder** filtros, orden ni búsqueda
- [ ] Los KPIs de la cabecera se calculan **sin** recorrer el conjunto completo en el cliente

---

### S2-03 🔴 Instrumentar la carga de vistas

**RNF:** 3.1 · **Tipo:** PERF · **Esfuerzo:** M (5) · **Depende de:** S2-01, S2-02
**Hallazgo:** **la carga de vistas nunca se midió.** `carga.js:90-94` solo itera
`/api/stats`, `/api/ventas`, `/api/deudas`. Ninguna ruta de página. Sin Core Web
Vitals, sin Lighthouse. Como 15 de 16 páginas son *client components*, la «carga
de vista» es navegación + fetch XHR, y **solo se midió la segunda mitad**.

**Criterios de aceptación:**
- [ ] Se mide **cada vista principal** (13 vistas) en build de producción
- [ ] Se reportan **Core Web Vitals**: LCP, INP, CLS, TTFB
- [ ] **90 % de las cargas de vista ≤ 3 s** con el conjunto de datos de volumen
- [ ] El **hardware de prueba queda documentado** (el informe de volumen actual no lo documenta, lo que hace sus números irreproducibles)
- [ ] Los resultados se añaden a `documentos/Pruebas de volumen` como VOL-05

---

### S2-04 🟠 Probar 10 usuarios simultáneos con sesiones distintas

**RNF:** 3.2 · **Tipo:** PERF · **Esfuerzo:** M (5) · **Depende de:** S2-05
**Hallazgo:** los «50 VUs» de `carga.js:60-88` son **50 clientes con una sola
cookie** (login único en `setup()`, reutilizada en `:96-97`). **No es una prueba de
concurrencia multiusuario.** VOL-03 y VOL-04 usaron **1 usuario**. CPU y memoria
**no se midieron**.

**Criterios de aceptación:**
- [ ] **≥ 10 sesiones distintas** autenticadas de forma independiente
- [ ] **95 % de las operaciones sin error** (el criterio del propio RNF)
- [ ] **Sin degradación**: el tiempo de respuesta con 10 usuarios es **≤ 1.2×** el de un usuario solo
- [ ] CPU, memoria y número de conexiones **medidos y reportados**
- [ ] Sin errores de pool de conexiones ni timeouts
- [ ] Hardware documentado

---

### S2-05 🟠 Configurar el pool de conexiones

**RNF:** 3.2 · **Tipo:** PERF · **Esfuerzo:** S (3) · **Depende de:** —
**Hallazgo:** `lib/db.ts:12-16` crea `new Pool({ connectionString })` **sin `max`,
sin `idleTimeoutMillis`, sin `connectionTimeoutMillis`** → usa el **default de `pg`
(`max=10`)**. Con 50 VUs concurrentes eso significa **cola de conexiones**.
No hay pgBouncer. `max_connections` de Postgres no configurado (default 100).
`DATABASE_URL` sin `?pool_max=` ni `statement_timeout`.

**Criterios de aceptación:**
- [ ] `max`, `idleTimeoutMillis` y `connectionTimeoutMillis` configurables por variable de entorno
- [ ] El valor por defecto permite **sostener ≥ 10 usuarios concurrentes** sin agotar el pool
- [ ] `statement_timeout` configurado (evita consultas colgadas tipo `/api/deudas`)
- [ ] Valores coherentes con `max_connections` de Postgres
- [ ] `DATABASE_URL` acepta `?pool_max=` sin cambios de código
- [ ] **S1-02 (TLS) no se rompe** al modificar `lib/db.ts`

---

### S2-06 🟠 Garantizar la ejecución continua del respaldo diario

**RNF:** 9.2, 8.2 · **Tipo:** DIS · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** el servicio `db_backup` **está activo** (`docker-compose.yml:78`, con
`SCHEDULE=@daily`) y hay 7 artefactos que prueban ejecución real. **Pero
`backups/daily/` tiene 3 archivos en 22 días** — entre `20260924` y `20260929` hay
**5 días consecutivos sin respaldo** (el bucket debería tener 7).
Causa raíz: `@daily` solo dispara si el contenedor está vivo, y no hay crontab, ni
unidad systemd, ni workflow. `backups/manual/` **no existe**.

**Criterios de aceptación:**
- [ ] El respaldo se ejecuta **sin intervención humana** (crontab del host, unidad systemd, o servicio que no dependa de que alguien levante Docker)
- [ ] **100 % de los días con al menos 1 respaldo**, verificable con un script de verificación
- [ ] Verificación automática que **alerte** si un día pasa sin respaldo
- [ ] Un respaldo **fuera del disco de la base** (nube o disco externo), por S1-03

---

### S2-07 🟠 Probar y documentar la restauración

**RNF:** 9.3 · **Tipo:** DIS · **Esfuerzo:** M (5) · **Depende de:** S2-06
**Hallazgo:** el procedimiento es sólido — `restore-db.sh:80-100` valida **extensión
y magic bytes** antes de tocar la base (`.sql.gz.enc` exige header `Salted__`,
`.sql.gz` exige bytes `1f8b`), lo que impide restaurar un archivo renombrado.
**Pero nunca se ha probado:** no hay registro, ni script de verificación, y
`backups/manual/` **no existe** (el backup manual nunca corrió con éxito).
**Sin RTO/RPO documentados.**

**Criterios de aceptación:**
- [ ] **Al menos 2 restauraciones reales** ejecutadas y registradas (el RNF pide 95 % de pruebas)
- [ ] **Cada restauración ≤ 30 min**, medido con reloj
- [ ] **RTO y RPO documentados** en `README.md`
- [ ] La prueba cubre el escenario real: `down -v` → reconstruir esquema → restaurar
- [ ] Integridad verificada tras restaurar (conteo de ventas, deudas y facturas idéntico al original)
- [ ] Runbook escrito para que un operador sin conocimiento previo pueda ejecutarlo

---

### S2-08 🟠 Health checks, reinicio y monitoreo

**RNF:** 9.1 · **Tipo:** DIS · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** el health check existe (`api/health/route.ts:5-34`) pero **el servicio
`db` no tiene `restart: unless-stopped`** (`docker-compose.yml:45-60`) ni `app`
en desarrollo (`:2-26`). **Solo `db` tiene healthcheck; `app` no.** Sin monitoreo
externo. Y el propio health check **puede colgarse**: no aplica timeout a la
consulta, así que si Postgres se cuelga, el health check se cuelga con él.

**Criterios de aceptación:**
- [ ] `restart: unless-stopped` en **`db`** y en **`app`** (ambos entornos)
- [ ] Healthcheck en el servicio **`app`**, no solo en `db`
- [ ] El health check aplica **timeout** a la consulta: si Postgres no responde, devuelve **«caído»** en vez de colgarse
- [ ] Monitoreo externo o verificación periódica configurada (alertar si no hay respuesta)
- [ ] **Disponibilidad mensual ≥ 95 % medida** en el periodo de observación
- [ ] El servicio `db_backup` también se monitoriza (que esté arriba no significa que esté respaldando)

---

### S2-09 🟠 Documentar la garantía de retención de ventas

**RNF:** 8.2 · **Tipo:** DAT · **Esfuerzo:** S (2) · **Depende de:** S1-03
**Hallazgo:** hoy el historial **se preserva**, pero **por omisión**: no existe
ningún `DELETE FROM venta`, ni cron, ni script de purga. Eso es un efecto
secundario de que nadie escribió el `DELETE`, **no una decisión documentada**.
No hay test, ni `CHECK`, ni comentario que diga «las ventas no se borren».
Cualquiera que añada un endpoint de limpieza no tiene ninguna señal de que rompa el requisito.

**Criterios de aceptación:**
- [ ] Comentario explícito en `init/01_schema.sql` que declare la política de retención
- [ ] La retención de respaldos cubre **5 años** (coordinar con S1-03)
- [ ] Prueba que verifique que el historial de ventas **no** se altera al operar otras funcionalidades
- [ ] `README.md` documenta la política

---

### S2-10 🟡 Vigilar el crecimiento de agregaciones

**RNF:** 8.2, 3.1 · **Tipo:** PERF · **Esfuerzo:** M (5) · **Depende de:** S2-05
**Hallazgo:** `/api/estadisticas` agrega sin filtro temporal en varios puntos
(`route.ts:476-478`) y ejecuta **24 consultas secuenciales** por request. El repo ya
documentó 20,180 ventas con 256 MB; a 5 años el crecimiento sería notable.

**Criterios de aceptación:**
- [ ] Las 24 consultas secuenciales se **reagrupan** (CTEs o consultas paralelas)
- [ ] `/api/estadisticas` mantiene **p95 < 3 s** con el dataset de volumen
- [ ] Las agregacionesperiodicass **no dependen de leer el conjunto completo**
- [ ] Prueba con 20,000 ventas que el tiempo se mantiene dentro del umbral

---

### S2-11 🟡 Prueba de arranque en frío

**RNF:** 13.1 · **Tipo:** EVD · **Esfuerzo:** S (2) · **Depende de:** —
**Hallazgo:** sin medición. `README.md:37` dice «~2 min» en frío con `--build`,
que **no es el criterio de 40 s**. `carga.js:60-88` mide con el servidor ya arriba.

**Criterios de aceptación:**
- [ ] Tiempo de arranque medido en el hardware del negocio
- [ ] Arranque **≤ 40 s** (o la cifra real, si el hardware no lo permite, documentada como tal)
- [ ] El resultado se incorpora al informe de volumen

> **Nota:** este RNF depende de hardware que el repositorio no describe. Si el
> equipo del negocio no cumple el mínimo, la tarea produce **evidencia para
> reportar la brecha**, no una corrección de software.

---

## Sprint 3 — Identidad visual

**Objetivo:** cumplir los RNF de interfaz limpia. **Depende de:** nada — puede ir en paralelo desde el inicio.

### S3-01 🔴 Elevar el texto por debajo de 14 px (bloque central)

**RNF:** 1.1 · **Tipo:** UX · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** de **478 declaraciones de tamaño de fuente, 304 (63.6 %) están bajo
14 px**, en 19 de 24 archivos. `app/globals.css:46` fija `body { font-size: 15px }`,
así que el umbral es `0.875rem`. Mínimo absoluto **10.4 px**.

**Criterios de aceptación:**
- [ ] **0 declaraciones** de tamaño de fuente por debajo de 14 px
- [ ] El mecanismo más rentable se ataca primero: **`lib/ui-table.tsx:49-111`**
      tiene 10 declaraciones en `0.82rem` (13.1 px) → afecta a **todas las tablas
      de 3 pantallas**. Un solo cambio cubre el mayor bloque
- [ ] Mínimo absoluto de **13 px** mientras la transición, y **14 px** al cierre
- [ ] Los 7 `text-xs` eliminated: `facturacion/page.tsx:140,224,278`,
      `dashboard/page.tsx:103`, `ventas/page.tsx:573`,
      `productos/page.tsx:667,668`
- [ ] Los 10.4 px eliminados: `historial-ventas/page.tsx:870`, `CatalogoView.tsx:900`
- [ ] Verificación automatizada que falle el CI si aparece cualquier tamaño < 14 px
- [ ] Contraste AA verificado en los textos aumentados sobre fondo `cream`

**Archivos:** 19 archivos de UI; **núcleo:** `lib/ui-table.tsx`

---

### S3-02 🟠 Reemplazar los estilos inline por clases de Tailwind

**RNF:** 1.1, 1.2 · **Tipo:** UX · **Esfuerzo:** M (5) · **Depende de:** S3-01
**Hallazgo:** **300 declaraciones** usan `fontSize: "Xrem"` en estilos inline
object (`const s = { title: { fontSize: "0.82rem" } }`) en lugar de clases de
Tailwind. Esto hace imposible centralizar los tamaños y favorece la inconsistencia.

**Criterios de aceptación:**
- [ ] Los tamaños de fuente se declaran como **clases de Tailwind**, no como estilos inline
- [ ] Un token compartido define los tamaños permitidos (p. ej. `text-label`, `text-body`)
- [ ] Cambiar el tamaño mínimo en **un** archivo afecta a toda la aplicación

---

### S3-03 🔴 Reducir la paleta a 3 colores

**RNF:** 1.2 · **Tipo:** UX · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** se definen **6 familias** (`tailwind.config.ts:12-58`) y el requisito
limita a **3**; las 6 están en uso (`ink` 122, `market` 95, `cream` 36, `achiote` 31,
`mango` 17, `sidebar` 9). Además hay un **segundo sistema de color en CSS variables**
(`globals.css:14-39`, con `--blue: #2563EB`) que duplica la paleta **sin coincidir
con ella**, y la UI usa ambos indistintamente.

**Criterios de aceptación:**
- [ ] **≤ 3 familias de color** en uso tras el cambio (justificar cualquier excepción)
- [ ] **Un único sistema de color** — los tokens de `globals.css:14-39` y los de Tailwind **coinciden**
- [ ] Paletas de estado de `app/ordenes/page.tsx:88-95` migradas a tokens (hoy 6 colores ajenos a la marca: naranja, índigo, morado, cian…)
- [ ] Paleta de `app/deudas/page.tsx:103-113` migrada
- [ ] `app/ordenes/page.tsx:77` (`ACCENT = "#1D24CA"`, azul índigo) migrada — contradice el propio comentario de marca en `StaffShell.tsx:56`

---

### S3-04 🟠 Eliminar los colores fuera de paleta

**RNF:** 1.2, 7.3 · **Tipo:** UX · **Esfuerzo:** M (5) · **Depende de:** S3-03
**Hallazgo:** **27 hexadecimales distintos (142 ocurrencias)** y **145 `rgba()` con
17 colores base** fuera de la paleta, incluidas paletas de GitHub
(`248,81,73`, `63,185,80`) y magentas (`180,83,189`). También 68 utilidades Tailwind
crudas (`bg-white` 21, `text-white` 47).

**Criterios de aceptación:**
- [ ] **0 hexadecimales** literales en `app/`, `components/`, `lib/`
- [ ] **0 `rgba()` literales** fuera de los tokens definidos
- [ ] Las 68 utilidades `bg-white`/`text-white` migradas a tokens
- [ ] Verificación automatizada que falle el CI ante colores literales
- [ ] Las sombras de `tailwind.config.ts:68-71` se mantienen (son parte del sistema)

---

### S3-05 🔴 Crear el logo

**RNF:** 1.3 · **Tipo:** UX · **Esfuerzo:** S (3) · **Depende de:** —
**Hallazgo:** **no existe ningún archivo de logo en el repositorio.** `public/`
contiene solo `icons/light/seller.png`, que **no se referencia en ningún archivo**
(`grep -rn 'seller.png'` → 0). No hay `logo.svg`, favicon ni `app/icon.*`.
Lo que se renderiza es un **título de texto de dos líneas** a 11.5 px
(`StaffShell.tsx:112-122`) — que además viola 1.1.

**Criterios de aceptación:**
- [ ] Existe un **logo** (archivo de imagen, vectorial) con variantes para fondo claro y oscuro
- [ ] Renderizado en la **pantalla principal** (`app/dashboard/page.tsx` vía `StaffShell`)
- [ ] `favicon` configurado (`app/icon.*` o `app/favicon.ico`)
- [ ] **100 % de revisiones muestran logo** (el criterio del RNF)
- [ ] El texto del logo **no** cuenta como logo: se reemplaza por la imagen
- [ ] `public/icons/light/seller.png` huérfano: **usar o eliminar**

---

### S3-06 🟠 Logo en el título y metadatos

**RNF:** 1.3 · **Tipo:** UX · **Esfuerzo:** XS (1) · **Depende de:** S3-05
**Hallazgo:** `app/layout.tsx:12-19` solo precarga fuentes; sin `<link rel="icon">`
ni Open Graph. El wordmark en texto también aparece en `login/page.tsx:138-140,174`
y `recuperar/page.tsx:309-311,338`.

**Criterios de aceptación:**
- [ ] `<title>` y Open Graph con el nombre del negocio
- [ ] Favicon presente en **todas** las pestañas
- [ ] El logo es consistente en dashboard, login y recuperación

---

### S3-07 🟡 Corregir la cadena en inglés y unificar el dialecto

**RNF:** 7.1, 7.2 · **Tipo:** UX · **Esfuerzo:** XS (1) · **Depende de:** —
**Hallazgo:** el RNF 7.1 está prácticamente cumplido, con **una** excepción:
`app/reportes/page.tsx:256` dibuja la palabra **`total`** en el centro de un gráfico
de dona, **visible al usuario**. Además se mezclan **voseo rioplatense y tuteo
para el mismo mensaje**: `proveedores/page.tsx:84` «*No tenés permiso*» vs
`deudas/page.tsx:677` «*No tienes permiso*»; `login/page.tsx:179` «*Verificá*»;
`lib/mailer.ts:109,137` «*Tenés*», «*ignorá*».

**Criterios de aceptación:**
- [ ] `total` → `Total` (o el equivalente que corresponda al gráfico)
- [ ] **100 % de la interfaz en español**, verificado
- [ ] Un **único dialecto** en toda la aplicación
- [ ] Verificación automatizada que rechace `toLocale*()` sin locale explícito (hoy ya se cumple 34/34, se protege el invariante)

---

### S3-08 🟡 Sustituir los 7 emojis por iconos del sistema

**RNF:** 7.3 · **Tipo:** UX · **Esfuerzo:** XS (2) · **Depende de:** S3-04
**Hallazgo:** el set de iconos es **ejemplar** — **23/23 monocromáticos**, un único
`fill="currentColor"` cada uno, 0 multicolor (`components/icons/*.tsx`).
La inconsistencia son **7 emojis multicolor** usados como iconos: 👑 ×4
(`usuarios/page.tsx:551,618,646,943`), 🔒 (`dashboard/page.tsx:153`),
🗑️ (`InventarioView.tsx:768`, mientras en otros sitios se usa `Icon name="trash"`),
🛎️ (`VentaToastListener.tsx:77`).

**Criterios de aceptación:**
- [ ] **0 emojis** como iconos en la interfaz
- [ ] Los 7 sitios usan iconos de `components/icons/`, que ya son neutros
- [ ] **100 % de los iconos monocromáticos** (el sistema actual ya lo cumple; se protege el invariante)

---

## Sprint 4 — Ayuda y documentación

**Objetivo:** los RNF de documentación se resuelven con **un solo entregable** grande
(manual de usuario) que cubre 2.3, 11.2 y parte de 4.1.

### S4-01 🔴 Escribir el manual de usuario

**RNF:** 2.3, 4.1 · **Tipo:** DOC · **Esfuerzo:** L (8) · **Depende de:** —
**Hallazgo:** **no existe manual de usuario** (búsqueda de `manual de usuario|guía de uso|instructivo`
→ 0 resultados en todo el repositorio). El README cubre **exclusivamente setup
técnico** y **no contiene ni un solo párrafo de cómo usar las funciones de negocio**.
**Cobertura: 0 de 40 funcionalidades = 0 %** contra el 100 % exigido.

**Criterios de aceptación:**
- [ ] El manual cubre las **40 funcionalidades principales** (autenticación, 2FA, recuperación, ventas, productos, categorías, marcas, presentaciones, precios, inventario, entradas/salidas, kardex, ajuste, transferencia, stock mínimo, bodegas, pedidos, historial de bodega, catálogo, órdenes, proveedores, clientes, deudas, pagos, límites y bloqueo, facturación, historial de ventas, dashboard, reportes, exportación, usuarios, promoción a dueño, notificaciones, logs, backups, health check)
- [ ] Cada funcionalidad tiene: **qué hace**, **cómo se accede**, **pasos numerados**, y un **captura**
- [ ] **100 % de las funcionalidades principales cubiertas** (el criterio del RNF)
- [ ]Escrito para un dueño/empleado **sin conocimiento técnico** (verificar contra el criterio de 7.2)
- [ ] Includes una sección de **preguntas frecuentes** y **solución de problemas**

---

### S4-02 🟠 Índice de cobertura functionalities ↔ manual

**RNF:** 2.3 · **Tipo:** DOC · **Esfuerzo:** S (2) · **Depende de:** S4-01
**Criterios de aceptación:**
- [ ] Una **tabla** que enumere las 40 funcionalidades con: **sí/no** documentada y **enlace a su sección**
- [ ] La tabla permite **verificar la cobertura** sin leer el manual
- [ ] Se actualiza al agregar funcionalidades nuevas

---

### S4-03 🔴 Implementar el módulo de ayuda en línea

**RNF:** 11.1 · **Tipo:** UX · **Esfuerzo:** M (5) · **Depende de:** S4-01
**Hallazgo:** **no existe módulo de ayuda en absoluto.** Sin ruta `/ayuda`,
0 `href` a ayuda/manual, 0 botones con glifo `?`, 0 `title="Ayuda"`. Los únicos
5 hits de «ayuda» son textos estáticos dentro de modales
(`InventarioView.tsx:551,611,649`). **Cobertura: 0 de 13 = 0 %** contra el 80 % exigido.

**Criterios de aceptación:**
- [ ] Botón de ayuda visible en **≥ 80 % de las vistas principales** (11 de 13)
- [ ] **100 % de las 13 vistas** (superar el criterio, no solo alcanzarlo)
- [ ] La ayuda es **contextual**: lleva a la sección del manual de **esa** vista, no a la portada
- [ ] Accessible por teclado y con `aria-label` en español
- [ ] No estorba en móvil ni en el layout de las tablas
- [ ] Verificación automatizada: un test recorre las 13 rutas y comprueba la presencia del botón

---

### S4-04 🟠 Tooltips contextuales y vista imprimible de factura

**RNF:** 11.1, 13.3 · **Tipo:** UX · **Esfuerzo:** M (5) · **Depende de:** S3-05
**Hallazgo:** solo 3 `title=` de tooltip en toda la app, y son de acciones, no de
ayuda (`ventas/page.tsx:395,527`, `usuarios/page.tsx:532`). Sobre impresión: existe
`window.print()` (`facturacion/page.tsx:335`) y una hoja `@media print`
(`globals.css:66-83`), pero **no hay integración de impresora**: 0 resultados para
`impresora|bluetooth`. No hay detección de dispositivos, impresión en red
(socket, ESC/POS, IP:9100, IPP), ni Web Bluetooth.

**Criterios de aceptación:**
- [ ] Tooltips de ayuda en los 3 campos más densos de cada vista
- [ ] La vista de factura imprimible incluye **todos** los datos del emisor (dependencia: **S1-07**)
- [ ] La impresión documenta que funciona con **impresoras de red y Bluetooth ya configuradas en el sistema operativo** (el RNF pide disponibilidad de hardware, no integración)
- [ ] Si el negocio requiere impresión directa en red, se documenta como **trabajo adicional** (fuera del alcance actual del RNF)

---

### S4-05 🔴 Publicar el manual como PDF descargable

**RNF:** 11.2 · **Tipo:** DOC · **Esfuerzo:** S (3) · **Depende de:** S4-01
**Hallazgo:** **no existe ningún PDF descargable.** En la app: 0 rutas que sirvan
archivos (`Content-Disposition|readFile|createReadStream|new Response(` → 0
resultados en `app/api`), `public/` solo tiene `icons/light/seller.png`, y el único
download genera un `.xlsx` (`reportes/page.tsx:493`).
Los **2 PDF del repositorio son material académico de Design Thinking**
(verificado extrayendo su texto: `PrimerCorte_software.pdf` contiene problematización,
perfiles, AEIOU y guiones de entrevista; `annotated-Perfiles.pdf` son mapas de
empatía sin capa de texto).

**Criterios de aceptación:**
- [ ] El manual (S4-01) existe como **PDF descargable**
- [ ] Accesible **desde la aplicación** (botón de descarga), no solo en el repositorio
- [ ] Servido desde `public/` o una ruta API con `Content-Disposition` correcto
- [ ] El PDF incluye índice navegable y las capturas
- [ ] Botón de descarga presente en el **módulo de ayuda** (S4-03)
- [ ] **Verificar existencia y disponibilidad** (el criterio del RNF)

---

### S4-06 🟠 Documentación de arquitectura y base de datos

**RNF:** 4.1, 10.3 · **Tipo:** DOC · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** **cero diagramas** (`mermaid|plantuml|graph TD` → 0 resultados).
**Cero documento de esquema de BD** (el DDL existe pero no hay data dictionary).
`docs/` **no existe**. La sección más completa del repo es la de logging
(`README.md:179-296`), lo que muestra que el equipo sabe documentar cuando se lo propone.

**Criterios de aceptación:**
- [ ] Diagrama de arquitectura del sistema (mermaid o equivalente) en `docs/`
- [ ] Diagrama ER de las 27 tablas y sus 36 relaciones
- [ ] Data dictionary con descripción de cada tabla y columna relevante
- [ ] Documento que explique los **24 dominios de API** (puede aprovechar `README.md:355-392`, que ya mapea la estructura)

---

### S4-07 🔴 Corregir credenciales y documentar migraciones

**RNF:** 4.1, 4.3 · **Tipo:** DOC · **Esfuerzo:** S (3) · **Depende de:** —
**Hallazgo (3 problemas):**
1. **Credenciales contradictorias:** `README.md:99-104` indica `password123` para
   todos y lista `dueno@tienda.com` como DUEÑO, pero el seed inserta
   `cumatzemilio6@gmail.com` (`01_schema.sql:492`) y **4 usuarios, no 2**.
   **Quien siga el README al pie de la letra no puede iniciar sesión.**
2. **Migraciones no documentadas:** solo se menciona `05_recuperacion_contrasena.sql`
   (`README.md:154-158`). **`05_promocion_dueno_y_notificaciones_deuda.sql` no se
   menciona en ningún documento.** No hay versión de esquema ni tabla de migraciones
   aplicadas, así que nadie puede saber si su base está al día.
3. **README desactualizado:** dice «Next.js 14» (`:168`) vs 15.5.26 real; «Middleware
   Edge con Web Crypto» (`:326`) vs runtime Node.js real; omite la página `/bodega`
   y el rol BODEGUERO.

**Criterios de aceptación:**
- [ ] Las credenciales del README **coinciden con el seed**, o el seed **deja de incluir contraseñas conocidas** (preferible; ver Sprint 1)
- [ ] **Las 2 migraciones** están documentadas, con orden y propósito
- [ ] Existe un **mecanismo de versionado de esquema** (tabla de migraciones aplicadas)
- [ ] `README.md` refleja la versión real de Next.js y el runtime real del middleware
- [ ] La página `/bodega` y el rol BODEGUERO aparecen en la tabla de módulos
- [ ] La tabla de permisos por rol **coincide con la API real** (coordinar con S0-05)

---

### S4-08 🔴 Sección de resolución de problemas

**RNF:** 4.3 · **Tipo:** DOC · **Esfuerzo:** S (2) · **Depende de:** S4-07
**Hallazgo:** **no existe sección de troubleshooting** (búsqueda de
`troubleshoot|problema|error común|si falla|solución de problemas` → **0 resultados**).
Lo más cercano es `README.md:242-265`, enfocado **solo en logs**. Faltan los tres
fallos de arranque previsibles.

**Criterios de aceptación:**
- [ ] Sección de troubleshooting en `README.md`
- [ ] Cubre al menos: `JWT_SECRET` con menos de 32 caracteres (`lib/auth.ts:21`), variables `GMAIL_*` faltantes (`lib/mailer.ts:28`), volumen existente que impide que corra `init/` (`README.md:547-552`), puerto 3001 ocupado, `ECONNREFUSED` a Postgres, `docker compose run` pidiendo `--profile test`
- [ ] Cada entrada: **síntoma** → **causa** → **solución**
- [ ] **Prueba siguiendo el manual** de instalación completo, de principio a fin, por una persona que no conoce el proyecto (el criterio del RNF)
- [ ] Se documentan también los **prerrequisitos con versión**: Node ≥ 15.5, Docker Engine v20+, Compose v2.7+ (hoy solo dice «Docker Desktop instalado»)

---

## Sprint 5 — Configuración, interoperabilidad y portabilidad

**Objetivo:** los RNF más pesados. **Puede dividirse en dos sprints (S5a, S5b).**
**Depende de:** nada — paralelizable desde el inicio.

### S5-01 🟠 Externalizar el servidor de correo

**RNF:** 4.2 · **Tipo:** CFG · **Esfuerzo:** S (3) · **Depende de:** —
**Hallazgo:** `lib/mailer.ts:34` fija `service: "gmail"`. **No existe `SMTP_HOST` ni
`SMTP_PORT`.** Migrar a Mailgun, SES o un servidor corporativo **exige editar
código**, y `README.md:119` dice «el envío usa Gmail SMTP» sin advertir esta limitación.

**Criterios de aceptación:**
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` en `.env.example`
- [ ] Cambiar de servidor de correo **no requiere modificar código**
- [ ] Gmail sigue funcionando como valor por defecto documentado
- [ ] La app **falla con mensaje claro** si faltan las variables (hoy revienta en runtime, `lib/mailer.ts:28-31`)
- [ ] Prueba: envío exitoso con un servidor SMTP de prueba

---

### S5-02 🟠 Externalizar las constantes de negocio y seguridad

**RNF:** 4.2 · **Tipo:** CFG · **Esfuerzo:** M (5) · **Depende de:** S5-01
**Hallazgo:** **6 de 12 operaciones comunes de configuración requieren editar código.**
Constantes hardcodeadas: **11 rate limits** en 6 archivos; **7 expiraciones**
(la vida del JWT está **duplicada** en dos archivos con sintaxis distinta:
`lib/auth.ts:37` como `"8h"` y `login/route.ts:105` como `60*60*8`);
**`MAX_DUENOS = 2`** (`lib/roles.ts:16`, regla de negocio crítica); ~10 timeouts
y límites de UI; puertos y credenciales de base **repetidas en 7+ lugares**.

**Criterios de aceptación:**
- [ ] Los 11 rate limits se leen de variables de entorno, **con los valores actuales como default**
- [ ] Las 7 expiraciones se externalizan y **se elimina la duplicación** de la vida del JWT
- [ ] `MAX_DUENOS` configurable
- [ ] **Tasa de IVA configurable** (coordinar con S1-08)
- [ ] Puertos parametrizables (`${APP_PORT:-3001}`)
- [ ] Credenciales de base **centralizadas** en `.env`, no repetidas en 7+ lugares
- [ ] Los valores por defecto **conservan el comportamiento actual** (cambio sin regresión)
- [ ] `.env.example` documenta **todas** las variables, incluida `BACKUP_ENCRYPTION_KEY` que hoy falta (coordinar con S1-03)
- [ ] **Prueba de configuración**: un script demuestra que cambiar cada variable surte efecto **sin tocar código**

> **Nota de diseño:** un esquema de configuración único y centralizado es mejor
> que 11 constantes dispersas. La tarea debe evitar crear un archivo de
> configuración con 40 campos.

---

### S5-03 🟠 Verificar ejecución en Windows y Ubuntu 20.04

**RNF:** 5.1, 5.2 · **Tipo:** EVD · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** el producto es portable por diseño (Docker abstrae el SO; ninguna
ruta del camino de ejecución depende del host). Pero **ningún job de CI corre en
Windows** (ambos workflows usan `ubuntu-latest`) y **`ubuntu-latest` es 24.04, no
20.04**. No se documentan versiones mínimas.

**Criterios de aceptación:**
- [ ] CI con matriz que incluya **`windows-latest`** (RNF 5.1) y **`ubuntu-22.04`** o **`ubuntu-20.04`** (RNF 5.2)
- [ ] La suite completa pasa en ambos SO
- [ ] Prerrequisitos con **versión mínima** documentados para Windows y Ubuntu (Docker Engine v20+, Compose v2.7+, Node ≥ 15.5)
- [ ] `README.md` documenta el camino **sin Docker** (`npm run dev`), que `.env.example:9-11` referencia pero nunca explica
- [ ] Verificado que Docker **sin `override`** (`--network=host`) no se usa en ningún script

---

### S5-04 🟡 Soporte de navegadores verificable

**RNF:** 5.3 · **Tipo:** EVD · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** **cero pruebas en navegador real.** Sin `playwright.config.*`, sin
`cypress`, **sin `browserslist` en `package.json`**, sin matriz de CI por navegador.
La suite actual usa **jsdom** (`jest.config.ts:9`), que **no es un navegador**: no
renderiza CSS, no ejecuta layout, no soporta `@media print`.

**Criterios de aceptación:**
- [ ] `browserslist` declarado en `package.json` (Chrome, Firefox, Edge en versiones de escritorio)
- [ ] Pruebas e2e con **Playwright** sobre **Chrome, Firefox y Edge** en CI
- [ ] Las **13 vistas principales** se renderizan correctamente en los 3 navegadores
- [ ] Verificado el comportamiento de `::-webkit-scrollbar` (`globals.css:59-61`), no soportado en Firefox
- [ ] La factura imprimible (`@media print`) verificada en los 3 navegadores
- [ ] **Pruebas funcionales en los 3 navegadores** (el criterio del RNF)

---

### S5-05 🔴 Exportar inventario a .xlsx

**RNF:** 10.1 · **Tipo:** INT · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** `exceljs` está como **dependencia de producción** pero se usa en **un
solo lugar**: `app/reportes/page.tsx:480-493`, que exporta un **reporte analítico**
(ventas, ticket promedio, top productos, KPIs), **no el inventario**. No hay
exportación de stock, kardex ni catálogo.

**Criterios de aceptación:**
- [ ] Exportación de **inventario** a `.xlsx`: productos con existencias por bodega
- [ ] Incluye las columnas de `lib/ui-table.tsx` (las de la vista de inventario)
- [ ] Respeta los **filtros activos** de la vista (producto, bodega, bajo stock mínimo)
- [ ] El archivo generado **abre correctamente** en Excel y LibreOffice
- [ ] Prueba de generación y lectura del archivo

---

### S5-06 🔴 Importar inventario desde .xlsx

**RNF:** 10.1 · **Tipo:** INT · **Esfuerzo:** L (8) · **Depende de:** S5-05
**Hallazgo:** **la importación no existe en absoluto.** 0 `<input type="file">` en
todo el repositorio; 0 rutas API que parseen `.xlsx`; 0 llamadas de lectura de
workbook; 0 menciones de «importar» en las páginas de inventario, catálogo o productos.

**Criterios de aceptación:**
- [ ] Botón de importación en la vista de inventario
- [ ] Plantilla `.xlsx` descargable con las columnas esperadas
- [ ] **Validación por fila**: columnas obligatorias, formato, tipos, duplicados
- [ ] **Vista previa de errores** antes de confirmar la importación
- [ ] **Importación por lotes dentro de una transacción**: si una fila falla, no se aplica parcialmente
- [ ] Reporte del resultado: filas importadas, actualizadas, omitidas y motivo de cada omisión
- [ ] **≥ 80 % de las pruebas sin pérdida de datos** (el criterio del RNF), verificado con un conjunto de archivos de prueba
- [ ] Prueba: archivo con errores parciales no corrompe los datos existentes

---

### S5-07 🟠 Extraer subcomponentes de los archivos monolíticos

**RNF:** 10.3 · **Tipo:** INT · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** **8 archivos superan las 850 líneas**, todos *client components*:

| Archivo | Líneas |
|---|---:|
| `app/deudas/page.tsx` | **1,896** |
| `app/usuarios/page.tsx` | 1,416 |
| `InventarioView.tsx` | 1,070 |
| `app/historial-ventas/page.tsx` | 1,043 |
| `app/reportes/page.tsx` | 947 |
| `CatalogoView.tsx` | 924 |
| `app/ordenes/page.tsx` | 876 |
| `app/api/estadisticas/route.ts` | 766 |

Existe un **patrón correcto ya probado** en `inventario-catalogo/`, donde
`InventarioCatalogo.tsx` (68 líneas) orquesta dos vistas separadas.

**Criterios de aceptación:**
- [ ] Ningún archivo de UI supera **500 líneas**
- [ ] `app/deudas/page.tsx` (1,896) se divide en subcomponentes y un hook de dominio
- [ ] Se sigue el patrón de `InventarioCatalogo.tsx` para orquestar
- [ ] **Sin cambio de comportamiento**: la suite de pruebas existente sigue verde
- [ ] Los estilos no se duplican en el proceso

---

### S5-08 🟠 Reagrupar y extraer las consultas de `/api/estadisticas`

**RNF:** 10.3 · **Tipo:** INT · **Esfuerzo:** M (5) · **Depende de:** —
**Hallazgo:** `app/api/estadisticas/route.ts` ejecuta **24 `pool.query` secuenciales**
por request (líneas 98, 115, 135, 153, 170, …) y **no sigue el patrón de extracción
a `lib/`** que ya se aplicó en `lib/historial-ventas.ts` (304 líneas extraídas de su
route handler).

**Criterios de aceptación:**
- [ ] Las 24 consultas se **reagrupan** en CTEs o se ejecutan en paralelo
- [ ] La lógica se extrae a `lib/`, siguiendo el patrón de `lib/historial-ventas.ts`
- [ ] `/api/estadisticas` mantiene **p95 < 3 s** (base actual: 216 ms con 1 usuario)
- [ ] **Sin regresión** en las cifras devueltas (comparar contra la salida actual)
- [ ] Pruebas de los agregados existentes siguen verdes

---

### S5-09 🔴 Decidir e implementar la app móvil

**RNF:** 14.2, 13.2 · **Tipo:** INT · **Esfuerzo:** XL (13) · **Depende de:** —
**Hallazgo:** **no existe app móvil de ninguna forma.** 0 resultados para
`capacitor|react-native|expo|apk` en `package.json` y `README.md`; sin
`capacitor.config.*`; sin `android/` ni `ios/`; **sin PWA** (sin `manifest.json`,
sin `app/manifest.ts`, sin service worker, sin `next-pwa`); `public/` solo tiene un
icono. `README.md:519` reconoce que exponer la API «a una app móvil separada»
requeriría trabajo adicional. Lo más cercano es el **diseño responsive** con Tailwind.

**Tarea:** decidir la vía y ejecutarla. **El RNF dice «app móvil para empleados»;
una PWA instalable es la interpretación de menor coste y cumple «accesible en Android».**

**Criterios de aceptación:**
- [ ] **La decisión está documentada** (PWA vs app nativa vs web responsive), con su justificación
- [ ] Si es PWA: `manifest.json` + service worker + instalable en Android
- [ ] Funciona **offline** en lectura de las vistas más usadas (si es PWA)
- [ ] **Accesible en Android ≥ 13**, verificado en un dispositivo o emulador real
- [ ] La API admite tráfico no confiable: **rate limiting por token**, no solo por IP (hoy `lib/rateLimit.ts:27` confía en el primer valor de `x-forwarded-for`, *spoofeable* sin proxy que lo reescriba)
- [ ] Contrato de API versionado (hoy `README.md:519` lo señala como requisito)
- [ ] Alternativa: si el negocio confirma que **web responsive es suficiente**, **retirar el RNF 14.2 formalmente** y documentar la decisión

> **Nota de alcance:** si se opta por app nativa, esta tarea es un proyecto
> propio, no un sprint. **La decisión debe tomarse antes de estimar.**

---

## Sprint 6 — Evidencia y mediciones faltantes

**Objetivo:** convertir los 9 requisitos ⚪ *no verificables* en verificables.
**Depende de:** S2 y S3 implementados (si no, se mide un producto que va a cambiar).

> **Principio de este sprint:** 9 de 38 requisitos no son verificables, pero la
> causa es **doble**: faltan mediciones, pero también **falta instrumentación**.
> Sin esta última, los requisitos **no son medibles ni después de implementar el
> producto**. Por eso este sprint tiene tareas de *instrumentación* además de
> tareas de *medición*.

### S6-01 🟡 Diseñar y aplicar el estudio de tiempos novatos vs. expertos

**RNF:** 2.1 · **Tipo:** EVD · **Esfuerzo:** M (5) · **Depende de:** S4-01, S6-03
**Hallazgo:** sin estudio de tiempos (búsqueda de
`aprendiz|experto|novato|primer uso|tiempo de tarea|120%|línea base` → **0 resultados**).
**Lo que sí existe** son 4 entrevistas cualitativas de **descubrimiento**
(`documentos/Corte1/Entrevistas codificadas/`), que responden a preguntas sobre el
problema, no sobre el producto.

**Criterios de aceptación:**
- [ ] **Protocolo definido**: lista de tareas, grupo de usuarios nuevos y grupo experto, instrumentación de tiempos
- [ ] Muestra mínima: **≥ 5 usuarios nuevos** y **≥ 3 expertos**
- [ ] Tiempos medidos por tarea
- [ ] **Los usuarios nuevos completan las tareas en ≤ 120 % del tiempo de los expertos** (el criterio del RNF)
- [ ] Resultados tabulados y publicados en `documentos/`
- [ ] Si no se alcanza el 120 %, **plan de mejora derivado de los datos**

---

### S6-02 🟡 Medir la reducción de tiempo frente al proceso manual

**RNF:** 2.2 · **Tipo:** EVD · **Esfuerzo:** M (5) · **Depende de:** S6-01
**Hallazgo:** no existe línea base **ni del proceso manual ni del proceso digital**,
por lo que la reducción porcentual es incalculable. El proceso manual está descrito
cualitativamente en `PrimerCorte_software.pdf` («*registros en papel y hojas de cálculo*»)
pero **nunca se cronometró**.

**Criterios de aceptación:**
- [ ] Tiempo del **proceso manual** medido para la tarea principal (con evidencia: video, observación, registros del negocio)
- [ ] Tiempo del **proceso digital** medido con el mismo protocolo y las mismas tareas
- [ ] **Reducción ≥ 30 %** (el criterio del RNF)
- [ ] Si el proceso manual no es medible (ya no existe), documentar la limitación y usar las **estimaciones del dueño** como referencia, marcándolo como tal

---

### S6-03 🔴 Realizar la encuesta de usabilidad

**RNF:** 7.2 · **Tipo:** EVD · **Esfuerzo:** M (5) · **Depende de:** S4-01
**Hallazgo:** **0 artefactos** de encuesta o prueba de usabilidad. Búsqueda sobre
el texto extraído de los 2 PDF, 4 DOCX y 1 XLSX de los términos `encuesta`,
`usabilidad`, `satisfacción`, `accesibilidad`, `SUS` → **0 coincidencias**.
`Corte2/` y `Avances2/` están **vacíos**.

**Criterios de aceptación:**
- [ ] Encuesta o test de usabilidad (SUS / SEQ / ESAT) aplicado a **usuarios reales**
- [ ] Muestra mínima: **≥ 5 usuarios**
- [ ] Cubre comprensión del **lenguaje** de la interfaz (el criterio del RNF)
- [ ] **≥ 90 % de los usuarios entienden** el lenguaje (el criterio del RNF)
- [ ] Resultados tabulados y publicados en `documentos/`
- [ ] Si no se alcanza el 90 %, **los mensajes problemáticos se corrigen y se vuelve a medir** (esta tarea se realimenta con S1-11)

---

### S6-04 🟡 Consolidar el informe de volumen

**RNF:** 3.1, 3.2, 3.3, 13.1, 9.1 · **Tipo:** EVD · **Esfuerzo:** S (3) · **Depende de:** S2
**Hallazgo:** el informe de volumen existente es **notable por su honestidad** (reporta
p95 = 20.11 s y declara incumplido su propio objetivo de 800 ms), pero tiene dos
carencias que impiden usarlo como evidencia de auditoría:

| Carencia | Corrección |
|---|---|
| **El hardware de prueba no está documentado** (ni CPU, ni RAM, ni modelo) → **los números son irreproducibles** | Registrar hardware, SO y versiones en cada corrida |
| Solo cubre `/api/stats`, `/api/ventas`, `/api/deudas` | Incluir las 13 vistas, búsqueda de inventario y las rutas corregidas en S2 |

**Criterios de aceptación:**
- [ ] Hardware, SO y versiones documentados en **cada** corrida
- [ ] Cubre **13 vistas** + búsqueda de inventario + las rutas corregidas
- [ ] Reporta p50/p95/p99 con **hardware documentado**
- [ ] Publica el resultado de las 4 tareas de medición del backlog
- [ ] **Ejecutar las pruebas contra el build de producción**, nunca contra `next dev` (el informe actual lo advierte: `next dev` añade ~380 ms fijos que superan por sí solos el presupuesto)

---

## RNF que no generan tareas

| RNF | Por qué |
|---|---|
| **13.2** Android ≥ 13 | No hay app móvil (→ S5-09) ni dato del parque de dispositivos del negocio. El componente de hardware es una **decisión de adquisición**, no de software. Verificar la compatibilidad técnica una vez que S5-09 decida la vía |
| **10.2** BD relacional | **Ya cumple.** No requiere acción. 27 tablas, 36 FK, transacciones, 33 archivos de pruebas |
| **14.1** BD de productos al día | **Ya cumple en cuanto a sistema.** El CRUD completo existe. Que el catálogo esté *efectivamente* al día es un **dato del negocio**, no verificable desde el código |

---

## Camino crítico

```
S0 (autorización)  ──┬──►  S1 (datos y auditoría)  ──►  S2 (rendimiento y
                     │                                  disponibilidad)
                     │                                        │
                     └──►  S4 (ayuda y documentación) ──┐     ▼
                                                      │   S6 (evidencia y
S3 (identidad visual) ──── independiente ──────────────┤   mediciones)
                                                      │     ▲
S5 (configuración) ───── independiente ───────────────┘     │
        ▲                                                 │
        └─────────────────────────────────────────────────┘
                          (S6 requiere S2 y S3)
```

**Secuencias que no deben romperse:**

1. **S0 → S1**: la auditoría (S1-04/S1-05) registra el actor de las operaciones; conviene que el modelo de autorización ya sea correcto para no auditar eventos que van a cambiar.
2. **S1 → S2**: el rendimiento debe medirse sin ruido de fugas de datos ni de auditoría per se.
3. **S2, S3 → S6**: **medir un producto que va a cambiar no produce evidencia válida.**
4. **S4-01 → S4-03, S4-05, S6-01, S6-03**: el manual de usuario es la entrada de la ayuda en línea, del PDF y de las dos pruebas con usuarios. **Es la dependencia más reordenada del backlog.**

**Paralelizables desde el inicio:** S3 (identidad visual) y S5 (configuración e
interoperabilidad) no dependen de nada. Si hay capacidad, deben empezar en
paralelo con S0.

---

## Métricas de cierre del backlog

| Métrica | Valor actual | Valor objetivo |
|---|:---:|:---:|
| Requisitos ✅ CUMPLE | 3 / 38 | **≥ 26 / 38** |
| Requisitos ⚪ no verificables | 9 / 38 | **≤ 3 / 38** |
| Rutas financieras con autorización incorrecta | 7 | **0** |
| Rutas mutantes sin auditoría | 31 / 39 | **0** |
| Declaraciones de fuente < 14 px | 304 | **0** |
| Hexadecimales fuera de paleta | 27 | **0** |
| Vistas con botón de ayuda | 0 / 13 | **13 / 13** |
| Funcionalidades con guía de uso | 0 / 40 | **40 / 40** |
| p(95) `/api/ventas` con 20,180 ventas | 22.61 s | **< 3 s** |
| p(95) `/api/deudas` con 5,000 deudas | 29.33 s | **< 3 s** |
| Días consecutivos sin respaldo | 5 | **0** |
| Retención de respaldos | 6 meses | **≥ 60 meses** |
| Retención de logs de auditoría | volátil (5 × 50 MB) | **indefinida** |
| Fugas `String(error)` al cliente | 6 | **0** |
| Puntos de paso de error sin transformar (UI) | 42 | **0** |
| Operaciones de config que exigen editar código | 6 / 12 | **0 / 12** |

---

## Registro de avance

| Sprint | Tareas | Completadas | Puntos | Fecha de cierre | Estado |
|---|:---:|:---:|:---:|---|:---:|
| S0 | 6 | 0 / 6 | 0 / 17 | — | 🔴 No iniciado |
| S1 | 12 | 0 / 12 | 0 / 54 | — | 🔴 No iniciado |
| S2 | 11 | 0 / 11 | 0 / 47 | — | 🔴 No iniciado |
| S3 | 8 | 0 / 8 | 0 / 27 | — | 🔴 No iniciado |
| S4 | 8 | 0 / 8 | 0 / 33 | — | 🔴 No iniciado |
| S5 | 9 | 0 / 9 | 0 / 54 | — | 🔴 No iniciado |
| S6 | 4 | 0 / 4 | 0 / 18 | — | 🔴 No iniciado |
| **Total** | **58** | **0** | **0 / 250** | — | — |

> Las tareas cuya **estimación no está cerrada** están marcadas con ⚠️ en su
> ficha: `S0-05` (alcance a confirmar con el dueño), `S1-01` (frontera de datos a
> cifrar), `S5-09` (depende de la decisión PWA vs. nativa). Re-estimar tras la
> primera reunión de refinamiento.