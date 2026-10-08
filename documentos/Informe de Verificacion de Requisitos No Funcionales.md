# Informe de Verificación de Requisitos No Funcionales

**Proyecto:** Tienda San Miguel — Sistema de Gestión de Inventario y Ventas
**Stack:** Next.js 15.5.26 · React 19 · PostgreSQL 16 · Tailwind 3.4 · Docker
**Commit:** `3b2325f` · **Fecha:** 07/10/2026 · **Alcance:** 38 RNF (secciones 1–11, 13, 14)

> **Informe resumido.** La evidencia extendida por requisito está en el
> [Backlog de Sprint](./Backlog%20de%20Sprint%20-%20RNF.md), donde cada tarea
> incluye el hallazgo que la justifica y sus criterios de aceptación.

---

## 1. Metodología y limitaciones

**Tipo de verificación:** estática sobre el código fuente y los artefactos
depositados en el repositorio (47 rutas API, 16 páginas, `init/01_schema.sql`,
documentación, `security/zap-reports/`, `documentos/Pruebas de volumen`).

**Limitación declarada:** el entorno de análisis **no tiene Node.js instalado**
(`node: command not found`), por lo que `npm test`, `npm run lint` y
`tsc --noEmit` **no pudieron ejecutarse**. Las referencias a la suite de
pruebas provienen de los 33 archivos de `__tests__/` y del informe de volumen
ya depositado, **no de una ejecución de esta auditoría**.

**Escala de veredictos:**

| Símbolo | Veredicto | Significado |
|:---:|---|---|
| ✅ | **CUMPLE** | Satisfecho con evidencia verificable |
| ⚠️ | **PARCIAL** | Se cumple en parte; hay incumplimientos medibles |
| ❌ | **NO CUMPLE** | La evidencia lo contradice de forma clara |
| ⚪ | **NO VERIFICABLE** | No existe evidencia que permita concluir |

> «No verificable» **no** significa «no se cumple». Significa que la afirmación
> no está respaldada y por tanto tampoco puede declararse cumplida ante una auditoría.

---

## 2. Resumen ejecutivo

| Veredicto | Cantidad | % | Requisitos |
|:---:|---:|---:|---|
| ✅ CUMPLE | **3** | 7.9 % | 7.1, 10.2, 14.1 |
| ⚠️ PARCIAL | **12** | 31.6 % | 4.1, 4.3, 5.1, 5.2, 6.1, 6.3, 7.3, 8.2, 9.2, 10.3, 11.3, 13.3 |
| ❌ NO CUMPLE | **14** | 36.8 % | 1.1, 1.2, 1.3, 2.3, 3.1, 4.2, 6.2, 7.2, 8.1, 8.3, 10.1, 11.1, 11.2, 14.2 |
| ⚪ NO VERIFICABLE | **9** | 23.7 % | 2.1, 2.2, 3.2, 3.3, 5.3, 9.1, 9.3, 13.1, 13.2 |
| **Total** | **38** | 100 % | — |

### 2.1 Por capítulo

| Sección | ✅ | ⚠️ | ❌ | ⚪ | Total |
|---|:---:|:---:|:---:|:---:|:---:|
| 1. Usabilidad de la interfaz | 0 | 0 | **3** | 0 | 3 |
| 2. Eficiencia | 0 | 0 | 1 | **2** | 3 |
| 3. Rendimiento | 0 | 0 | 1 | **2** | 3 |
| 4. Documentación y configuración | 0 | 2 | 1 | 0 | 3 |
| 5. Portabilidad | 0 | 2 | 0 | 1 | 3 |
| 6. Seguridad | 0 | 2 | 1 | 0 | 3 |
| 7. Idioma | **1** | 1 | 1 | 0 | 3 |
| 8. Legal y financiero | 0 | 1 | **2** | 0 | 3 |
| 9. Disponibilidad y respaldo | 0 | 1 | 0 | 2 | 3 |
| 10. Interoperabilidad y modularidad | **1** | 1 | 1 | 0 | 3 |
| 11. Ayuda al usuario | 0 | 1 | **2** | 0 | 3 |
| 13. Entorno e infraestructura | 0 | 1 | 0 | 2 | 3 |
| 14. Datos y móvil | **1** | 0 | 1 | 0 | 2 |

### 2.2 Conclusión

**El proyecto no cumple el conjunto de requisitos no funcionales.** Tres lecturas:

**1. La ingeniería del producto es sólida.** bcrypt + JWT + 2FA por correo + rate
limiting persistente; 27 tablas con 36 claves foráneas; capa `lib/` compartida;
24 dominios de API; 33 archivos de pruebas; observabilidad con pino y rotación.
Notablemente, el informe de volumen **identifica sus propios incumplimientos**
en lugar de ocultarlos.

**2. Falta evidencia para 9 requisitos (23.7 %).** No hay encuesta de usabilidad,
estudio de tiempos, medición de carga de vistas, prueba de 10 usuarios
simultáneos, medición de búsqueda, verificación de navegadores, cifra de
disponibilidad, ni prueba de restauración. Varios **ni siquiera son medibles con
la instrumentación actual**: la búsqueda de inventario ocurre íntegramente en el
navegador y el respaldo automático solo corre cuando alguien levanta Docker.

**3. Existe un defecto de autorización crítico (8.3) que invalida el control de
acceso financiero**, y tres incumplimientos estructurales (logo inexistente,
módulo de ayuda inexistente, sin manual de usuario).

---

## 3. Hallazgos críticos (detalle)

### 3.1 🔴 8.3 — Acceso financiero abierto a empleados y bodegueros

> **El hallazgo más grave.** La UI oculta los enlaces financieros a los empleados,
> lo que transmite la impresión de que el control existe. **La API los acepta.**

`lib/roles.ts:2-6` define tres roles: `DUENO`, `EMPLEADO`, `BODEGUERO`.
**No existe un rol «administrador»** — en este proyecto se implementa como `DUENO`.
La autorización **sí es server-side** (cada ruta revalida la cookie vía
`getUsuarioFromRequest`, `lib/server-auth.ts:4-8`), pero **aplica el predicado equivocado**:
`isStaffTipo` (= `DUENO \|\| EMPLEADO`) donde debería aplicar `isDuenoTipo`.

| Ruta | Rol aplicado | ¿Empleado? | ¿Bodeguero? |
|---|---|:---:|:---:|
| **`POST /api/facturacion`** (emitir factura) | 🔴 **ninguno** — solo `if (!usuario)` (`route.ts:38-42`) | **SÍ** | **SÍ** |
| `PATCH /api/deudas/[id]` (PENDIENTE↔PAGADA) | `isStaffTipo` (`:18`) | **SÍ** | no |
| `POST /api/deudas/[id]/pagos` (abono) | `isStaffTipo` (`:21`) | **SÍ** | no |
| `PATCH /api/precios` (precio venta) | `isStaffTipo` (`:35`) | **SÍ** | no |
| `POST /api/clientes` (acepta `limite_deuda`) | `isStaffTipo` (`:45`) | **SÍ** | no |
| `GET /api/facturacion` \| `GET /api/deudas` \| `GET /api/stats` | `isStaffTipo` | **SÍ** (leen montos, teléfonos) | no |
| `POST /api/deudas` (crear) | ✅ `esDueno()` (`:94`) | no | no |
| `GET /api/estadisticas` \| `GET /api/historial-ventas` \| `/api/usuarios/*` | ✅ `isDuenoTipo` | no | no |

**Consecuencias concretas:**

1. **Un `BODEGUERO` emite facturas fiscales.** Puede insertar en `factura`
   (`route.ts:77-82`), **cambiar el estado de una venta a `CONFIRMADO`**
   (`:84-87`) y elegir arbitrariamente `nombre_cliente` y `nit_cliente` (`:81`).
   Hay incoherencia interna: **no puede crear una venta** (`ventas/route.ts:122`
   exige `isStaffTipo`) **pero sí facturar una existente**.
2. **Un `EMPLEADO` marca deudas como pagadas sin recibir dinero.** Esto además
   **desbloquea automáticamente al cliente moroso** vía `recalcularBloqueoCliente`
   (`deudas/[id]/route.ts:53-55`) — le devuelve el crédito a un cliente con deuda.
   El módulo es inconsistente consigo mismo: crear deuda es admin-only, cobrarla no.
3. **Un `EMPLEADO` cambia precios sin validación.** `precios/route.ts:45-49` no
   comprueba `precio >= 0`, así que puede fijar `precio_unitario = 0`. Y **esta
   ruta no loguea nada** (ver 6.3), así que el cambio no deja rastro.
4. **Un `EMPLEADO` crea clientes con crédito ilimitado.** `POST /api/clientes:49-53`
   usa `limite_deuda` del body sin restricción. El `PATCH` **sí** es admin-only
   (`:16`) — **crear es la puerta trasera**.
5. **La documentación contradice a la API.** `README.md:307-317` marca Deudas como
   admin-only y Reportes como permitido para colaborador; la API es exactamente
   contraria en ambos casos.
6. **No hay tests de autorización por rol.** `__tests__/lib/roles.test.ts` cubre
   helpers puros, pero ningún test de integración comprueba que un token de
   `EMPLEADO` reciba 403 en rutas de dueño.

### 3.2 🔴 6.2 — Ningún cifrado de datos en la base

Búsqueda de `pgcrypto|encrypt(|decrypt(|AES|crypt(|ENCRYPTION_KEY|sslmode` en
`app/`, `lib/`, `init/`, `migrations/`, `middleware.ts` → **cero resultados**.
`lib/db.ts:12-16` es un `Pool` pelado, sin `ssl`.

| Protegido (hash, no cifrado) | En texto plano |
|---|---|
| Contraseñas (bcrypt 10) · códigos 2FA, recuperación, promoción (bcrypt 10) | **NIT proveedor / cliente / factura** (`01_schema.sql:40,100,289`) · **teléfonos** (`:110,96,42,301`) · correos · **montos de deuda, venta, pago, factura** (`:303,242,329,290`) · direcciones |

**Agravante:** los respaldos automáticos **están explícitamente sin cifrado**
(`README.md:435-442`) y se guardan en el **mismo disco que la base** (`./backups`).

### 3.3 🔴 3.1 y 3.2 — Rendimiento: el proyecto incumple su propio objetivo

`documentos/Pruebas de volumen` (única fuente de medición) declara textualmente
que el sistema «*nunca cumple el objetivo de 800 ms bajo 50 VUs, y con volumen
real se aleja 25x del objetivo*» (líneas 111-114). El requisito de 3 s es más
permisivo y **también se incumple**.

| Métrica (producción) | 180 ventas | 20,180 ventas |
|---|---:|---:|
| p(95) `http_req_duration` | 1.12 s | **20.11 s** |
| p(99) | 1.75 s | **22.95 s** |
| Throughput | 12.1 iter/s | **1.3 iter/s** (9x menos) |
| `http_req_failed` | 0.00 % | 0.00 % |

**Dos problemas independientes:**

- **La carga de vistas nunca se midió.** `carga.js:90-94` solo itera
  `/api/stats`, `/api/ventas`, `/api/deudas`. Ninguna ruta de página. Sin Core
  Web Vitals ni Lighthouse.
- **Los «50 VUs» son 50 clientes con una sola sesión.** `carga.js:60-88` hace
  login una vez en `setup()` y reutiliza la misma cookie en las 50 iteraciones
  (`:96-97`). **No es una prueba de concurrencia multiusuario.** El pool de
  conexiones usa el **default de `pg` (`max=10`)**, sin configurar, y no hay
  pgBouncer.

**Causa raíz identificada por el propio equipo y aún no corregida:** `LIMIT`
después del `GROUP BY` en `ventas/route.ts:78-92`, y **ausencia total de
paginación** en `deudas/route.ts:27-84` (p95 = **29.33 s** con 5,000 deudas).

### 3.4 🔴 3.3 — La búsqueda de inventario no existe en el servidor

| Capa | Comportamiento |
|---|---|
| Descarga | `InventarioView.tsx:188-196` → `stockQuery` (`154-161`) solo lleva `id_bodega`, `id_producto` — **ningún parámetro de texto** |
| Servidor | `gestion-inventario/route.ts:39-68` — sin `LIKE`/`ILIKE`/`tsvector`, y **sin `LIMIT`**: devuelve el set completo |
| Cliente | `InventarioView.tsx:246-275` filtra en memoria |
| Motor | `ui-table.tsx:8-12` — `String(c).toLowerCase().includes(q)`, con `toLowerCase()` reasignado por llamada y **sin memoizar** |

**Cero `ILIKE`/`tsvector`/`pg_trgm`/índices GIN en rutas de inventario.** Los 13
índices del esquema son de fecha, estado y clave foránea. Con 20,000 productos
cada pulsación recorre 20,000 objetos × 4 campos. **Nunca se midió.**

### 3.5 🔴 8.1 — La factura no cumple requisitos legales

**Lo que sí está bien:** numeración correlativa **atómica** (`nextval()` dentro del
mismo INSERT, `facturacion/route.ts:79`, con `UNIQUE` en BD), NIT y nombre del
cliente, fecha, total y detalle de líneas.

**Lo que falta (la tabla `factura` tiene 6 columnas, `01_schema.sql:284-294`):**

| Campo ausente | Impacto |
|---|---|
| **Emisor: RUC, razón social, dirección fiscal, teléfono** | **Bloqueante.** No existe tabla ni configuración de emisor en todo el repositorio. La factura se emite sin identificar a la tienda (`facturacion/page.tsx:267-343`) |
| **IVA / IGV** | **Alta.** Cero columnas de impuesto. Irónicamente `producto.exento_iva` (`01_schema.sql:62`) indica que el modelo contempla exenciones **pero nunca calcula el impuesto** |
| Moneda declarada | Media. `Q{number.toFixed(2)}` hardcodeado (`facturacion/page.tsx:221,312-322`) |
| Dirección fiscal del cliente | Media. `cliente` no tiene columna de dirección (`01_schema.sql:92-103`) |
| Serie por punto de emisión | Media. Prefijo `FACT-` fijo (`route.ts:79`) |
| Fecha de emisión propia | Baja. Hereda `fecha_venta` (`[id]/route.ts:28`) |

Además `POST /api/facturacion:55` toma `nombre_cliente` y `nit_cliente` **del body**
sin validar el formato del NIT ni verificarlo contra `cliente.nit_cliente`, que
**sí existe en la BD** (`01_schema.sql:100`) pero no se usa.

### 3.6 🔴 1.1 / 1.2 / 1.3 — Incumplimientos de diseño visual

**1.1 — Tipografía.** `app/globals.css:46` fija `body { font-size: 15px }`, luego
**1 rem = 16 px** y el umbral es `0.875rem`. De **478 declaraciones de tamaño de
fuente, 304 (63.6 %) están bajo 14 px**, en 19 de 24 archivos. El caso de mayor
alcance: **`lib/ui-table.tsx:49-111` fija las 10 declaraciones de estilo de tabla
en `0.82rem` (13.1 px)** → **todo el texto de tabla del sistema** está bajo el
umbral en las 3 pantallas que reutilizan el componente. Mínimo absoluto: 10.4 px
(`historial-ventas/page.tsx:870`, `CatalogoView.tsx:900`).

**1.2 — Paleta.** Se definen **6 familias** (`tailwind.config.ts:12-58`) y el
requisito limita a **3**; las 6 están en uso. Además hay un **segundo sistema de
color en CSS variables** (`globals.css:14-39`, con `--blue: #2563EB`) que duplica
la paleta sin coincidir con ella, y fuera de la paleta: **27 hexadecimales
distintos (142 ocurrencias)** y **145 `rgba()` con 17 colores base**, incluidas
paletas de estado ajenas a la marca en `ordenes/page.tsx:88-95` (incluye morado
`#7b2cbf` y cian `#0077b6`) y un azul índigo `#1D24CA` como acento principal
(`ordenes/page.tsx:77`), que contradice el propio comentario de marca en
`StaffShell.tsx:56`.

**1.3 — Logo.** **No existe ningún archivo de logo en el repositorio.**
`public/` contiene solo `icons/light/seller.png`, que **no se referencia en ningún
archivo** (`grep -rn 'seller.png'` → 0). No hay `logo.svg`, favicon ni `app/icon.*`.
Lo que se renderiza es un **título de texto de dos líneas** a 11.5 px
(`StaffShell.tsx:112-122`).

### 3.7 🔴 6.3 — Auditoría: los cambios no dejan rastro

Los **accesos** sí se registran correctamente (login exitoso y fallido, 2FA,
rate limit, ruta protegida sin sesión) sobre una infraestructura sólida (pino,
rotación 50 MB × 5, **redacción de secretos** bien implementada en
`lib/logger.ts:48-59`).

**Los cambios, no.** **No existe tabla de auditoría** (0 resultados para
`auditoria|audit|bitacora` entre las 27 tablas). **8 de 39 rutas con mutación
registran el evento**; **31 no registran nada**, incluidos todos los huecos graves:
`precios:45-49` (precio), `facturacion:77-82` (emisión), `usuarios:173-179`
(alta y cambio de rol), `productos/[id]:165` (**DELETE**),
`clientes/[id]` (límite de deuda), `gestion-inventario/ajuste`,
`bodegas/[id]:126-129` (**DELETE**).

**Dos defectos estructurales:** el actor no queda registrado en producción
(`middleware.ts:76` no incluye `id_usuario`; la identidad solo aparece en un
`log.debug` que **no se emite en producción**, `lib/logger.ts:104`), y el logout
no se registra.

### 3.8 ⚠️ 9.2 — Respaldos configurados pero no garantizados

El servicio `db_backup` **está activo** (`docker-compose.yml:78`, verificado) con
`SCHEDULE=@daily` y rotación por tiers funcional —7 artefactos en disco confirman
ejecución real. **Pero:**

**`backups/daily/` contiene 3 archivos en 22 días.** Entre `20260924` y
`20260929` hay **5 días consecutivos sin respaldo**. El bucket debería tener 7.

**Causa raíz:** `@daily` solo dispara si el contenedor está vivo, y no hay crontab,
ni unidad systemd, ni workflow. `backups/manual/` **no existe**, lo que confirma
que el proceso solo se levanta en sesiones de desarrollo. Con la evidencia en
disco, la cobertura es **3/22 = 13.6 %** contra el criterio de 100 %.

**Además la retención de 6 meses contradice el RNF 8.2** (5 años).

---

## 4. Resultados por requisito

| # | Requisito | Criterio | Resultado medido | Veredicto |
|---|---|---|---|:---:|
| 1.1 | Tipografía ≥ 14 px | 100 % pantallas | 304/478 (63.6 %) bajo 14 px; mínimo 10.4 px; `ui-table.tsx` a 13.1 px | ❌ |
| 1.2 | Paleta máx. 3 colores | 100 % vistas | 6 familias + 27 hex + 145 `rgba()` fuera de paleta | ❌ |
| 1.3 | Logo en pantalla principal | 100 % revisiones | No existe archivo de logo; solo texto a 11.5 px | ❌ |
| 2.1 | Novatos ≤ 120 % del experto | Comparar tiempos | Sin estudio de tiempos | ⚪ |
| 2.2 | Reduce ≥ 30 % vs. manual | Comparación de tiempos | Sin línea base manual ni digital | ⚪ |
| 2.3 | Manual cubre 100 % | Revisión de cobertura | 0/40 = 0 % con guía de uso (47.5 % solo mencionados) | ❌ |
| 3.1 | Carga de vistas ≤ 3 s | 90 % pruebas ≤ 3 s | p95 20.11 s con volumen real; **vistas nunca medidas** | ❌ |
| 3.2 | ≥ 10 usuarios simultáneos | 95 % con 5 sesiones sin errores | 50 clientes con **1 sola sesión**; pool `max=10` sin configurar | ⚪ |
| 3.3 | Búsqueda inventario ≤ 2 s | 90 % búsquedas ≤ 2 s | **Nunca medida**; filtrado 100 % en el navegador | ⚪ |
| 4.1 | Documentación técnica y de usuario | Revisión de manuales | Manual de usuario inexistente; doc técnica de desarrollo excelente | ⚠️ |
| 4.2 | Configuración sin modificar código | Pruebas de configuración | **6 de 12** operaciones comunes requieren editar código | ❌ |
| 4.3 | Procedimiento de instalación | Prueba siguiendo manual | Docker completo; **credenciales contradictorias**, sin migraciones, sin troubleshooting | ⚠️ |
| 5.1 | Windows 10+ | Pruebas en Windows | Docker lo permite; **sin job de CI en Windows** | ⚠️ |
| 5.2 | Linux Ubuntu 20.04+ | Pruebas en Linux | CI en `ubuntu-latest` (**24.04**); 20.04 sin probar | ⚠️ |
| 5.3 | Chrome, Firefox, Edge | Pruebas funcionales | Sin `browserslist`, sin e2e, solo jsdom | ⚪ |
| 6.1 | Autenticación usuario/contraseña | Acceso autorizado/bloqueado | bcrypt+JWT+2FA+rate limit sólidos; contraseña ≥ 6 chars; **JWT no revocable** | ⚠️ |
| 6.2 | Datos sensibles cifrados en BD | Inspección del algoritmo | **Cero cifrado**; solo hashing; NIT y teléfonos en texto plano | ❌ |
| 6.3 | Logs de accesos y cambios | Revisión de auditoría | Accesos: completo. Cambios: **31 rutas sin logging**; sin tabla de auditoría | ⚠️ |
| 7.1 | 100 % en español | Todas pantallas/mensajes | **1 cadena en inglés** (`reportes/page.tsx:256`); 34/34 `toLocale` con `es-GT` | ✅ |
| 7.2 | Lenguaje claro | ≥ 90 % entienden (encuesta) | **0 artefactos** de encuesta o test de usabilidad | ⚪ |
| 7.3 | Colores e iconos neutros | 100 % elementos | **23/23 iconos monocromáticos** ✅; 7 emojis multicolor; paleta fuera de norma | ⚠️ |
| 8.1 | Facturas con datos legales | 100 % con campos obligatorios | **Sin emisor, sin IVA/IGV**, sin moneda, sin serie configurable | ❌ |
| 8.2 | Historial ventas: 5 años | 100 % registros almacenados | BD: sin purga ✅ · Respaldos: **6 meses**, no 5 años | ⚠️ |
| 8.3 | Acceso financiero solo admins | 100 % intentos bloqueados | **CRÍTICO**: POST facturación sin rol; deudas, pagos y precios abiertos | ❌ |
| 9.1 | Disponibilidad ≥ 95 % | Mensual ≥ 95 % | Health check existe; **sin `restart` en `db`**; sin monitoreo; sin cifra | ⚪ |
| 9.2 | Copias de seguridad diarias | 100 % días con ≥ 1 respaldo | `@daily` activo; **3 de 22 días** con respaldo | ⚠️ |
| 9.3 | Recuperación ≤ 30 min | 95 % pruebas ≤ 30 min | Procedimiento sólido; **nunca probado**; sin RTO/RPO | ⚪ |
| 10.1 | Importar/exportar .xlsx inv. | ≥ 80 % sin pérdida | **Importación inexistente**; exportación es de reportes, no inventario | ❌ |
| 10.2 | Conexión BD relacional | CRUD exitoso | `pg` Pool; 27 tablas, 27 PK, 36 FK; 33 archivos de pruebas | ✅ |
| 10.3 | Arquitectura modular | APIs/módulos desacoplados documentados | 24 dominios + 16 módulos `lib/`; **UI monolítica**; sin doc de API ni diagrama | ⚠️ |
| 11.1 | Módulo de ayuda en línea | ≥ 80 % vistas con botón | **0 de 13 = 0 %**; el módulo no existe | ❌ |
| 11.2 | Manual PDF descargable | Verificar existencia | Inexistente; los 2 PDF del repo son material académico | ❌ |
| 11.3 | Mensajes de error descriptivos | 90 % sin códigos técnicos | 41/47 = **87.2 %** (< 90 %); **6 fugas `String(error)`** | ⚠️ |
| 13.1 | Desktop: arranque ≤ 40 s | Computadora en el negocio | **Sin medición**; único dato: «~2 min» en frío | ⚪ |
| 13.2 | Android ≥ 13 | Todos con dispositivo | Sin app móvil; sin dato del parque de dispositivos | ⚪ |
| 13.3 | Impresora de red/Bluetooth | Impresora disponible | `window.print()` + `@media print`; sin integración de red ni BT | ⚠️ |
| 14.1 | BD actualizada con productos | Todos productos al día | CRUD completo con transacción y unicidad de código | ✅ |
| 14.2 | App móvil para empleados | Accesible en Android | **Sin app móvil, sin PWA, sin `manifest.json`** | ❌ |

**Totales:** ✅ 3 · ⚠️ 12 · ❌ 14 · ⚪ 9 = **38**

---

## 5. Cumplimientos reconhecibles

Para equilibrio del informe, estos requisitos **sí se cumplen con evidencia sólida**:

| RNF | Evidencia |
|---|---|
| **7.1 — 100 % español** | `<html lang="es">` (`layout.tsx:11`, único en el repo); **34/34** `toLocale*()` con locale explícito `"es-GT"`; cero `lang="en"`; cero `Loading`/`Save`/`Cancel` en inglés. Una única excepción: `reportes/page.tsx:256` dibuja la palabra `total` en el centro de un gráfico de dona |
| **10.2 — BD relacional** | `pg` Pool singleton (`lib/db.ts:12-16`); **27 tablas, 27 PK, 36 FK**, 1 secuencia, 1 vista, 13 índices, 4 `CHECK`, FK compuesta; transacciones con `BEGIN`/`COMMIT`/`ROLLBACK` (`productos/route.ts:113-164`); 29 tests de API + 4 de integración contra BD real; CI ejecuta esquema real + tests + build |
| **14.1 — BD de productos al día** | CRUD completo con validación server-side (incluida unidad líquida, `productos/route.ts:99-107`), transacción multi-tabla, `uq_producto_codigo` con traducción de conflicto 23505 → 409, gestión de precios y presentaciones, filtros de catálogo |

**Además, controles de seguridad bien implementados** (aunque el RNF 6.1 en
conjunto queda en parcial por las debilidades de §4): bcrypt cost 10, validación de
`JWT_SECRET` con **fallo cerrado sin fallback**, cookie `httpOnly` + `sameSite`
+ `secure` en producción, **2FA con `crypto.randomInt` (CSPRNG) y código
almacenado hasheado**, rate limiting **persistente en BD** (sobrevive reinicios),
respuesta anti-enumeración en recuperación de contraseña, y **redacción de
secretos en logs** bien implementada (`lib/logger.ts:48-59`).

---

## 6. Correcciones a premisas frecuentes

Dos puntos donde la intuición inicial es engañosa y conviene registrar:

| Premisa | Realidad |
|---|---|
| «El servicio `db_backup` está comentado y no arranca» | **Falso.** Las líneas 74-77 de `docker-compose.yml` son comentarios *descritivos*; la clave `db_backup:` de la línea 78 está **activa** (sin `#`) y no usa `profiles`. Arranca con `docker compose up` normal. **El problema real es otro:** solo corre cuando alguien levanta Docker → 5 días seguidos sin respaldo |
| «La suite de pruebas pasa porque `test-evidence.txt` existe» | Ese archivo pesa 134 B en UTF-16 y **no contiene resultados**. La cobertura de pruebas es real (33 archivos), pero no pudo ejecutarse en esta auditoría por ausencia de Node.js |

---

## 7. Próximos pasos

La implementación está planificada en
**[`Backlog de Sprint - RNF.md`](./Backlog%20de%20Sprint%20-%20RNF.md)**, que
contiene **58 tareas** en 6 sprints, con:

- Trazabilidad completa RNF → tarea
- Criterios de aceptación **medibles** (con el número objetivo del propio RNF)
- Esfuerzo estimado, dependencias y camino crítico
- Secuenciación que evita que un sprint dependa de evidencia de otro

**Orden recomendado de ejecución:**

| Sprint | Foco | Por qué en ese orden |
|---|---|---|
| **S0** | Autorización financiera (8.3) | Vulnerabilidad abierta en datos reales |
| **S1** | Datos, auditoría y fugas (6.2, 6.3, 11.3, 8.1) | Bloquea cualquier salida a producción |
| **S2** | Rendimiento y disponibilidad (3.1, 3.2, 9.x) | Depende de S1 para poder medir |
| **S3** | Identidad visual (1.1, 1.2, 1.3, 7.3) | Independiente; paralelizable |
| **S4** | Ayuda y documentación (11.1, 2.3, 11.2, 4.1, 4.3) | Un solo entregable cubre 2 RNF |
| **S5** | Configuración, interoperabilidad, portabilidad (4.2, 10.1, 5.3, 14.2, 10.3) | El más grande; puede dividirse en dos sprints |
| **S6** | Evidencia y mediciones faltantes (2.1, 2.2, 3.2, 3.3, 9.1, 7.2) | Depende de que S2-S3 estén implementados |

> **Nota sobre S6:** 9 de los 38 requisitos son hoy ⚪ *no verificables*. La
> causa es doble: faltan mediciones (arranque, carga de vistas, búsqueda,
> disponibilidad, encuesta), pero también **falta instrumentación** — sin ella
> los requisitos no son medibles ni siquiera tras implementar el producto.