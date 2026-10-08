# Informe de Verificación de Requisitos No Funcionales

**Stack:** Next.js 15.5.26 · React 19 · PostgreSQL 16 · Tailwind 3.4 · Docker
**Commit auditado:** `3b2325f`
**Fecha del análisis:** 07/10/2026
**Alcance:** 38 requisitos no funcionales (secciones 1–11, 13 y 14)

---

## 1. Metodología

### 1.1 Alcance del análisis

Se auditaron los 38 requisitos declarados. La lista **no contiene sección 12**
(salta de 11.3 a 13.1); se conserva esa numeración tal como fue entregada.

### 1.2 Tipo de verificación

Verificación **estática sobre el código fuente y los artefactos de evidencia
depositados en el repositorio**. No se ejecutó la suite de pruebas.

> **Limitación declarada:** el entorno de análisis **no tiene Node.js
> instalado** (`node: command not found`), por lo que `npm test`, `npm run lint`
> y `tsc --noEmit` **no pudieron ejecutarse**. Los resultados de `npm test`
> citados como evidencia en este informe provienen de la suite existente en
> `__tests__/` (29 archivos de API, 4 de integración, 8 de páginas) y del
> informe de volumen ya depositado, **no de una ejecución de esta auditoría**.

### 1.3 Escala de veredictos

| Símbolo | Veredicto | Significado |
|:---:|---|---|
| ✅ | **CUMPLE** | El requisito se satisface con evidencia verificable en el repositorio |
| ⚠️ | **PARCIAL** | Se cumple en parte; hay incumplimientos medibles o huecos concretos |
| ❌ | **NO CUMPLE** | El requisito no se satisface; la evidencia lo contradice de forma clara |
| ⚪ | **NO VERIFICABLE** | No existe evidencia en el repositorio que permita concluir; requiere medición o entorno externo |

---

## 2. Resumen ejecutivo

### 2.1 Semáforo general

| Veredicto | Cantidad | Porcentaje | Requisitos |
|:---:|---:|---:|---|
| ✅ CUMPLE | **3** | 7.9 % | 7.1, 10.2, 14.1 |
| ⚠️ PARCIAL | **12** | 31.6 % | 4.1, 4.3, 5.1, 5.2, 6.1, 6.3, 7.3, 8.2, 9.2, 10.3, 11.3, 13.3 |
| ❌ NO CUMPLE | **14** | 36.8 % | 1.1, 1.2, 1.3, 2.3, 3.1, 4.2, 6.2, 7.2, 8.1, 8.3, 10.1, 11.1, 11.2, 14.2 |
| ⚪ NO VERIFICABLE | **9** | 23.7 % | 2.1, 2.2, 3.2, 3.3, 5.3, 9.1, 9.3, 13.1, 13.2 |
| **Total** | **38** | 100 % | — |

**Distribución por capítulo:**

| Sección | ✅ | ⚠️ | ❌ | ⚪ | Total |
|---|:---:|:---:|:---:|:---:|:---:|
| 1. Usabilidad de la interfaz | 0 | 0 | **3** | 0 | 3 |
| 2. Eficiencia | 0 | 0 | **1** | **2** | 3 |
| 3. Rendimiento | 0 | 0 | **1** | **2** | 3 |
| 4. Documentación y configuración | 0 | **2** | **1** | 0 | 3 |
| 5. Portabilidad | 0 | **2** | 0 | **1** | 3 |
| 6. Seguridad | 0 | **2** | **1** | 0 | 3 |
| 7. Idioma | **1** | **1** | **1** | 0 | 3 |
| 8. Legal y financiero | 0 | **1** | **2** | 0 | 3 |
| 9. Disponibilidad y respaldo | 0 | **1** | 0 | **2** | 3 |
| 10. Interoperabilidad y modularidad | **1** | **1** | **1** | 0 | 3 |
| 11. Ayuda al usuario | 0 | **1** | **2** | 0 | 3 |
| 13. Entorno e infraestructura | 0 | **1** | 0 | **2** | 3 |
| 14. Datos y móvil | **1** | 0 | **1** | 0 | 2 |

### 2.2 Conclusión

El proyecto **no cumple** el conjunto de requisitos no funcionales. Resumen del 
estado:

1. **La ingeniería de software del producto es sólida.** Autenticación con
   bcrypt + JWT + 2FA por correo + rate limiting persistente, modelado relacional
   de 27 tablas con 36 claves foráneas, capa `lib/` compartida, separación de
   API por 24 dominios, 33 archivos de pruebas, observabilidad con pino y rotación
   de logs, y un informe de volumen de carga que esraramente bueno: **identifica
   sus propios incumplimientos** en lugar de ocultarlos.

2. **La evidencia de cumplimiento no existe para 9 requisitos** (23.7 %). No hay
   encuesta de usabilidad, ni estudio de tiempos de tarea, ni medición de carga
   de vistas, ni prueba de 10 usuarios simultáneos, ni medición de búsqueda, ni
   verificación de navegadores, ni cifra de disponibilidad, ni prueba de
   restauración, ni medición de arranque. Varios de estos requisitos **ni
   siquiera son medibles con la instrumentación actual**: la búsqueda de
   inventario ocurre íntegramente en el navegador y el respaldo automático solo
   corre cuando alguien levanta Docker.

3. **Existe un defecto de autorización crítico (8.3) que invalida el control
   de acceso financiero**, y tres incumplimientos de diseño (logo inexistente,
   módulo de ayuda inexistente, sin manual de usuario) que son estructurales,
   no de pulido.

> **Punto más importante del informe:** el requisito 8.3 no solo no se cumple —
> su incumplimiento es más grave de lo que el requisito pide. La UI oculta los
> enlaces financieros a los empleados, lo que transmite la impresión de que el
> control existe, pero **la API los acepta con un token de `EMPLEADO` o incluso de
> `BODEGUERO`**. Un empleado puede marcar deudas como pagadas sin recibir dinero,
   registrar abonos, modificar precios de venta y emitir facturas fiscales. Detalle
   en §9.

---

## 3. Detalle por requisito

---

### 1.1 — Interfaz limpia, tipografía ≥ 14 px ❌ **NO CUMPLE**

**Criterio:** 100 % de las pantallas cumplen el tamaño mínimo de fuente.
**Resultado medido: 304 de 478 declaraciones de tamaño de fuente (63.6 %) están por debajo de 14 px.**

#### Método

`app/globals.css:46` fija `body { font-size: 15px }`, por lo que **1 rem = 16 px**
y el umbral de 14 px equivale a `0.875rem`. La aplicación usa tres mecanismos
de tamaño de fuente; los dos más volumetricos están casi íntegramente bajo el umbral.

| Mecanismo | Total | < 14 px | ≥ 14 px |
|---|---:|---:|---:|
| `fontSize: "Xrem"` (estilos inline) | 300 | **219** | 81 |
| `text-[Xrem]` (Tailwind arbitrario) | 133 | **78** | 55 |
| `text-xs/sm/base/lg/xl` (Tailwind nombrado) | 45 | **7** (`text-xs`) | 38 |
| **Total** | **478** | **304 (63.6 %)** | 174 |

19 de 24 archivos de interfaz están afectados.

#### Distribución de las violaciones (px equivalentes)

| Tamaño | px | Ocurrencias |
|---|---:|---:|
| `0.65rem` | **10.4** | 2 |
| `0.68rem` | **10.9** | 3 |
| `0.7rem` | **11.2** | 8 |
| `0.72rem` | **11.5** | 29 |
| `0.75rem` | 12.0 | 18 |
| `0.78rem` | 12.5 | 38 |
| `0.8rem` | 12.8 | 16 |
| `0.82rem` | 13.1 | 38 |
| `0.85rem` | 13.6 | **66** |

#### Casos más graves

| Archivo:línea | Tamaño | Contenido |
|---|---:|---|
| `app/historial-ventas/page.tsx:870` | 10.4 px | chip de código de producto |
| `components/inventario-catalogo/CatalogoView.tsx:900` | 10.4 px | badges «Caduca» / «Exento IVA» |
| `app/reportes/page.tsx:941` | 10.9 px | sub-etiqueta de tarjeta |
| `app/reportes/page.tsx:946` | 10.9 px | **encabezados de tabla** |
| `app/usuarios/page.tsx:456` | 10.9 px | badge de rol |
| `components/StaffShell.tsx:163` | 11.2 px | rol del usuario en el sidebar |
| `components/StaffShell.tsx:117,125` | 11.5 px | **«San Miguel» del logo** y etiqueta de rol |

`lib/ui-table.tsx:49-111` fija las 10 declaraciones de estilo de tabla en `0.82rem`
(13.1 px), es decir **todo el texto de tabla del sistema está bajo el umbral**
en las 3 pantallas que reutilizan el componente (Deudas, Inventario, Catálogo).

#### Observación sobre el criterio de medición

El requisito dice «100 % pantallas cumplen tamaño fuente», que se puede leer como
«ninguna pantalla tiene un elemento bajo 14 px». Bajo esa lectura el resultado es
0 % de cumplimiento. Bajo la lectura más benévola («la mayoría de pantallas
cumple»), el resultado es igualmente incumplido: ningún archivo de los 24 cumple
íntegramente.

---

### 1.2 — Paleta consistente: máximo 3 colores ❌ **NO CUMPLE**

**Criterio:** 100 % de vistas usan colores definidos; máximo 3 colores.
**Resultado: 6 familias de paleta en uso, más 27 colores hexadecimales y 17 colores RGB fuera de la paleta definida.**

#### Familias definidas y en uso

`tailwind.config.ts:12-58` define **6** familias: `cream`, `market`, `mango`,
`achiote`, `ink`, `sidebar`. **Las 6 están en uso** — el requisito limita a 3.

| Familia | Ocurrencias |
|---|---:|
| `ink` | 122 |
| `market` | 95 |
| `cream` | 36 |
| `achiote` | 31 |
| `mango` | 17 |
| `sidebar` | 9 |

Existe además un **segundo sistema de color en CSS variables**
(`app/globals.css:14-39`) con `--green`, `--red`, `--blue: #2563EB`, `--warm`,
que **duplica** la paleta Tailwind sin coincidir con ella. La interfaz usa ambos
indistintamente.

#### Colores fuera de la paleta

- **68 utilidades Tailwind crudas:** `bg-white` (21), `text-white` (47).
  Ningún `bg-gray-*`, `bg-red-*` ni `*-slate-*` — este punto es correcto.
- **27 hexadecimales distintos (142 ocurrencias):** `#1a1a1a` (25), `#fff` (20),
  `#52b788` (19), `#e4e4e7` (12), `#e63946` (11), `#f4f4f5` (10), `#666` (6), etc.
- **145 `rgba()` literales con 17 colores base distintos**, incluidos
  `34,197,94` (verde Tailwind), `248,81,73` y `63,185,80` (rojo/verde de GitHub),
  `88,166,255` (azul), `180,83,189` (magenta).

#### Paletas ajenas a la marca

| Ubicación | Hallazgo |
|---|---|
| `app/ordenes/page.tsx:77` | `const ACCENT = "#1D24CA"` — azul índigo como acento principal, contradiciendo el comentario de `components/StaffShell.tsx:56` («nada de azules ajenos a la marca») |
| `app/ordenes/page.tsx:88-95` | 6 colores de estado (`#e67700`, `#1D24CA`, `#7b2cbf`, `#0077b6`, `#2d6a4f`, `#c1121f`), ninguno de la paleta |
| `app/historial-ventas/page.tsx:67` | `const ACCENT = "#2d6a4f"` — verde distinto del verde de marca |
| `app/deudas/page.tsx:103-113` | Verde `#52b788`, rojo `#e63946`, ámbar `#e08e0b` (fuera de `achiote #E1592A`) |

---

### 1.3 — Logo visible en pantalla principal ❌ **NO CUMPLE**

**Criterio:** 100 % de revisiones muestran logo.
**Resultado: no existe ningún archivo de logo en el repositorio. Lo que se renderiza es un título de texto.**

#### Hallazgos

- `app/page.tsx:1-5` — la raíz **solo redirige** (`redirect("/login")`). Cero interfaz.
- `public/` contiene **únicamente** `public/icons/light/seller.png` (512×512 RGBA),
  que **no se referencia en ningún archivo** (`grep -rn 'seller.png'` → 0 resultados).
  No existe `logo.svg`, `favicon`, `icon.png` ni `app/icon.*`.
- `app/layout.tsx:12-19` — el `<head>` solo precarga fuentes. No hay `<link rel="icon">`.

#### Lo que realmente se renderiza en el dashboard

`components/StaffShell.tsx:112-122` — un **bloque de texto puro de dos líneas**:

```
116:  <div className="font-head font-extrabold text-base text-cream">Tienda</div>
117:  <div className="... text-[0.72rem] ...">San Miguel</div>
```

Es un *wordmark* en texto HTML a **11.52 px** (que además viola 1.1), no un logo.
No hay isotipo, ni símbolo, ni identidad gráfica. El dashboard no renderiza marca
propia: depende al 100 % del `StaffShell`.

---

### 2.1 — Usuarios nuevos completan tareas en ≤ 120 % del tiempo de expertos ⚪ **NO VERIFICABLE**

**Criterio:** comparar tiempos entre grupos.
**Resultado: no existe ningún estudio de tiempos, niAprendizaje/expertos, en el repositorio.**

Búsqueda sobre `README.md`, `CONTRIBUTING.md` y `documentos/` de los términos
`aprendiz|experto|novato|primer uso|tiempo de tarea|120%|línea base|antes y después`
→ **0 coincidencias**. No hay protocolo, muestra, ni registro de tiempos.

Para poder evaluarse se necesitaría: definición de tareas, grupo de usuarios
nuevos y grupo experto, instrumentación de tiempos y protocolo de registro.
Ninguno de los tres existe.

---

### 2.2 — Reduce tiempo de tarea principal ≥ 30 % vs. proceso manual ⚪ **NO VERIFICABLE**

**Criterio:** comparación de tiempos.
**Resultado: no existe línea base medida del proceso manual ni del proceso digital.**

No hay ningún documento que registre el tiempo del proceso manual (registros en
papel y hojas de cálculo, según el planteamiento de `PrimerCorte_software.pdf`)
ni una medición del tiempo con el sistema. Sin ambos lados de la comparación, la
reducción porcentual es incalculable.

---

### 2.3 — Manual digital cubre 100 % de funcionalidades principales ❌ **NO CUMPLE**

**Criterio:** revisión de cobertura.
**Resultado: 0 de 40 funcionalidades tienen manual de uso. Cobertura 0 %.**

#### Funcionalidades principales implementadas (N = 40)

Derivadas de las 47 rutas API y 16 páginas: autenticación/JWT, 2FA por correo,
sesión/logout, recuperación de contraseña, rate-limit de login, ventas,
ventas recientes, anulación de ventas, productos, categorías, marcas,
presentaciones, precios, inventario, entradas de inventario, salidas de
inventario, kardex, ajuste de stock, transferencia entre bodegas, stock mínimo,
bodegas, pedidos de bodega, historial de bodega, catálogo, órdenes de compra,
proveedores, clientes, deudas, pagos de deuda, límites y bloqueo por deuda,
facturación, historial de ventas, dashboard, reportes, exportación XLSX de
reportes, usuarios, promoción a dueño, notificaciones de deuda, logs,
backups/restore y health check.

#### Cobertura documental

| Artefacto | Funcionalidades que cubre | Tipo |
|---|---|---|
| `README.md:299-316` (tabla roles/módulos) | 12 | Inventario, **no guía de uso** |
| `README.md:320-348` (checklist) | 16 (una línea cada una) | Inventario |
| `README.md:112-129` (2FA) | 1 (parcial) | Procedimiento parcial |
| `README.md:133-160` (recuperación) | 1 | Procedimiento parcial |
| `README.md:97-108` (usuarios de prueba) | 1 (credenciales) | Credenciales |

**Cálculo:**
- Con guía de uso: **0 / 40 = 0.0 %**
- Bajo criterio laxo («aparece mencionada en algún documento»): **19 / 40 = 47.5 %**,
  y aun así se trata de una línea de un checklist, no de instrucciones usables.

> **Declaración explícita:** el README cubre **exclusivamente el setup técnico**
> (instalar Docker, configurar `.env`, leer logs, respaldar la BD, conectar
> pgAdmin, abrir un PR). **No contiene ni un solo párrafo de cómo usar las
> funciones de negocio.** No hay ejemplo de cómo registrar una venta, emitir una
> factura, crear una deuda, registrar una entrada de bodega, transferir stock
> entre bodegas ni cambiar precios. Las únicas pistas de uso son 3 textos
> explicativos dentro de modales (`InventarioView.tsx:551,611,649`).

---

### 3.1 — Carga de vistas ≤ 3 segundos ❌ **NO CUMPLE**

**Criterio:** 90 % de las pruebas ≤ 3 s.
**Resultado: con volumen real de datos, p(95) = 20.11 s y p(99) = 22.95 s. Además nunca se midió la carga de vistas.**

#### Mediciones disponibles

Única fuente: `documentos/Pruebas de volumen (VOL-01 a VOL-04).md`.

| Métrica | VOL-01 (180 ventas) | VOL-02 (20,180 ventas) |
|---|---:|---:|
| p(95) `http_req_duration` | 1.12 s | **20.11 s** |
| p(99) | 1.75 s | **22.95 s** |
| p(95) `/api/ventas` | 1.50 s | **22.61 s** |
| p(95) `/api/stats` | 930 ms | 9.14 s |
| p(95) `/api/deudas` | 898 ms | 8.44 s |
| Iteraciones completadas | 1,464 | **175** |
| Throughput | 12.1 iter/s | **1.3 iter/s** |

VOL-03 (1 usuario, producción, p50 por pantalla):

| Pantalla | Endpoint | p50 | p95 |
|---|---|---:|---:|
| Dashboard | `/api/stats` | 43 ms | 43 ms |
| Ventas | `/api/ventas` | 817 ms | 912 ms |
| Historial | `/api/historial-ventas` | 1,146 ms | 1,264 ms |
| Reportes | `/api/estadisticas` | 216 ms | 263 ms |
| Deudas | `/api/deudas` | 31 ms | 34 ms |

#### Dos observaciones independientes de incumplimiento

1. **El proyecto incumple su propio umbral.** El informe de volumen se fijó
   objetivos de **800 ms** y declara textualmente (líneas 111-114) que
   «*El umbral de 800 ms se incumple en ambos casos… El sistema nunca cumple el
   objetivo de 800 ms bajo 50 VUs, y con volumen real se aleja 25x del objetivo*».
   El requisito de 3 s es más permisivo que el objetivo propio, y aun así se incumple.

2. **No se midió carga de vistas.** `carga.js:90-94` solo itera sobre
   `/api/stats`, `/api/ventas`, `/api/deudas`. **Ninguna ruta de página**
   (`/dashboard`, `/ventas`, `/deudas`, `/inventario`) fue medida. No hay Core Web
   Vitals, ni LCP/TTFB/FCP, ni Lighthouse. Como 15 de 16 páginas son *client
   components* (`"use client"`), la «carga de vista» es navegación + fetch XHR, y
   solo se midió la segunda mitad.

#### Limitación del informe de volumen

El hardware de prueba **no está documentado** (ni CPU, ni RAM, ni modelo), lo que
hace los números irreproducibles. Esto no invalida los resultados —los deltas
18x son concluyentes— pero impide extrapolar.

#### Causa raíz ya identificada y no corregida

El propio informe de volumen localiza el problema y recomienda la corrección
(líneas 269-276). **El patrón sigue en el código actual:**

- `app/api/ventas/route.ts:78-92` — aplica `LIMIT` **después** del
  `GROUP BY`/`json_agg`, por lo que PostgreSQL agrega todas las filas antes de paginar.
  Plan de ejecución registrado: `GroupAggregate (actual rows=20180)` +
  `Incremental Sort (actual rows=50445)`.
- `app/api/deudas/route.ts:27-84` — **sin paginación**, devuelve el conjunto completo.
  En la corrida con 5,000 deudas, `/api/deudas` por sí solo alcanzó **p(95) = 29.33 s**.

---

### 3.2 — Soporta ≥ 10 usuarios simultáneos sin degradación ⚪ **NO VERIFICABLE**

**Criterio:** 95 % de pruebas con 5 sesiones sin errores.
**Resultado: se probaron 50 clientes concurrentes pero con una sola sesión compartida. No es una prueba de concurrencia multiusuario.**

#### Lo que sí se midió

- Rampa k6: 30 s a 20 VUs → 1 min a 50 VUs → 30 s a 0 (`carga.js:44-48`).
- **`carga.js:60-88` hace login una única vez en `setup()` y reutiliza la misma
  cookie en las 50 iteraciones** (`carga.js:96-97`). Son 50 clientes HTTP con
  **un mismo JWT**, no 50 usuarios.
- VOL-03 y VOL-04 se ejecutaron con **1 usuario**.
- Errores: `http_req_failed` = 0.00 % (0 de 538), checks 4,392/4,392 OK.
  **Este criterio sí se cumple: 0 % de error bajo carga sintética.**
- CPU y memoria: **no medidos** (no hay `docker stats` ni reporte de recursos).

#### Por qué no es evidencia de 10 usuarios simultáneos

| Factor | Configuración actual | Implicación |
|---|---|---|
| Pool de conexiones | `lib/db.ts:12-16` — `new Pool({ connectionString })` **sin `max`, sin `idleTimeoutMillis`, sin `connectionTimeoutMillis`** | Usa el default de `pg`: **10 conexiones** |
| Concurrencia probada | 50 VUs contra 10 conexiones | Cola de conexiones, no concurrencia real |
| pgBouncer | Inexistente (0 resultados en todo el repositorio) | Sin multiplexación |
| `max_connections` de Postgres | No configurado | Default 100 |
| `DATABASE_URL` | `docker-compose.yml:11,35`, `docker-compose.prod.yml:19` — sin `?pool_max=` ni `statement_timeout` | Sin ajuste fino |

El propio informe de volumen anticipa esto (líneas 241-243): «*el pool usa los
valores por defecto de `pg` (lib/db.ts:12-16)*», y concluye que «*la saturación
viene del tiempo de respuesta, no de agotar conexiones*» (línea 243).

**Además, la evidencia apunta a degradación, no a estabilidad:** con volumen real
el throughput cayó de **12.1 iter/s a 1.3 iter/s** (9x) y las iteraciones
completadas de **1,464 a 175** (8.4x menos). El criterio «sin degradación» no se
puede afirmar.

---

### 3.3 — Búsqueda de inventario ≤ 2 segundos ⚪ **NO VERIFICABLE**

**Criterio:** 90 % de búsquedas ≤ 2 s.
**Resultado: nunca se midió. Y la implementación hace el filtrado íntegramente en el navegador, sin límite en el servidor.**

#### La búsqueda no toca la base de datos

| Capa | Comportamiento |
|---|---|
| Descarga | `InventarioView.tsx:188-196` → `fetch('/api/gestion-inventario' + stockQuery)`; `stockQuery` (`154-161`) solo lleva `id_bodega`, `id_producto`, `solo_bajo_minimo`, `incluir_inactivos` — **ningún parámetro de texto** |
| Servidor | `app/api/gestion-inventario/route.ts:39-68` — SQL sin `LIKE`, sin `ILIKE`, sin `tsvector`, y **sin `LIMIT`**: devuelve el set completo |
| Cliente | `InventarioView.tsx:246-259` (`stock`), `:262-275` (`kardex`), `:276-279` (`bodegas`), `:240-243` (`presProductos`) filtran el array en memoria |
| Motor | `lib/ui-table.tsx:8-12` — `String(c).toLowerCase().includes(q)`. Un `includes()` de JavaScript, O(n·m), **con `toLowerCase()` reasignado en cada invocación y sin memoizar** |
| Catálogo | `CatalogoView.tsx:138` → `fetch("/api/productos")` descarga el catálogo entero (`app/api/productos/route.ts:13-30`, sin `WHERE` ni `LIMIT`); filtro en `CatalogoView.tsx:392-401` |

Los únicos `ILIKE` del proyecto están en `lib/historial-ventas.ts:276-292` (8
ocurrencias) y `app/api/usuarios/route.ts:37` — ninguno en inventario.

#### Índices

Existen 13 índices (`init/01_schema.sql:143,162,180,338,366,453,457,461,465,470,474,478,479,480`)
y **ninguno sirve a la búsqueda de inventario**: son de fecha, estado y clave foránea.
**Cero índices GIN, cero `pg_trgm`, cero `tsvector`** en todo el esquema.
El comentario en `init/01_schema.sql:445-449` confirma que se diseñaron «según los
patrones de WHERE/JOIN/ORDER BY reales del código», sin preocupación por búsqueda textual.

#### Instrumentación de medición

`carga.js:90-94` y `medidor.ps1:13-19` miden **5 endpoints**:
`/api/stats`, `/api/ventas`, `/api/deudas`, `/api/historial-ventas`, `/api/estadisticas`.
**Ninguno de inventario.** El criterio de 90 % nunca pudo evaluarse.

**Riesgo estructural:** con 20,000 productos, cada pulsación de tecla recorre
20,000 objetos × 4 campos con `toLowerCase()` asignado por llamada. El objetivo
de 2 s es plausible con catálogos pequeños, pero **no está medido y no hay base
para afirmarlo a escala**.

---

### 4.1 — Documentación técnica y de usuario ⚠️ **PARCIAL**

**Criterio:** revisión de manuales disponibles.

#### Inventario documental

| # | Artefacto | Tamaño | Cubre |
|---|---|---|---|
| 1 | `README.md` | 23,254 B (554 líneas) | Instalación Docker, `.env`, credenciales, 2FA, recuperación, stack, **sistema de logs (119 líneas)**, roles/rutas, funcionalidades, estructura, URLs, backup/restore, pgAdmin, política de API privada |
| 2 | `CONTRIBUTING.md` | 7,631 B (241 líneas) | Ramas, commits, PR, API privada, comandos de test, convenciones, logging, ambiente de desarrollo |
| 3 | `.github/pull_request_template.md` | 1,426 B | Formulario de PR |
| 4 | `.github/workflows/ci.yml` | 1,247 B | Lint + typecheck + tests + build con Postgres 16 |
| 5 | `.github/workflows/validate-pr.yml` | 3,398 B | Valida secciones obligatorias del PR |
| 6 | `init/01_schema.sql` | 39,258 B | DDL de 27 tablas + vista + secuencia + datos semilla |
| 7 | `migrations/*.sql` | 2 archivos | Migraciones (con instrucción de ejecución) |
| 8 | `documentos/Pruebas de volumen (VOL-01 a VOL-04).md` | 16,036 B | Informe de performance con metodología y reproducibilidad |
| 9 | `documentos/Corte1/*`, `Avances1/*` | 6 archivos | Material académico de Design Thinking (entrevistas, perfiles, bitácora) |
| 10 | `security/zap-reports/*.html` | 2 archivos | Reportes OWASP ZAP |

#### Lo que falta

- **Manual de usuario: NO EXISTE.** Cero archivos. Búsqueda de `manual de usuario|guía de uso|instructivo` en todo el repositorio → **0 resultados**.
- **Documento de arquitectura: NO EXISTE.** Cero diagramas (`mermaid|plantuml|graph TD` → 0 resultados).
- **Documento de esquema de BD: NO EXISTE.** No hay data dictionary ni diagrama ER.
- **Guía de despliegue a producción: NO EXISTE.** `docker-compose.prod.yml` existe
  (y su propio encabezado dice cómo usarlo, líneas 1-8) pero **ningún documento lo
  referencia**: ni dominio, ni reverse proxy, ni TLS, ni procedimiento de release.
- **`docs/` no existe.** No está vacío: no está creado.

#### Documentación de API

- **OpenAPI/Swagger: ausente y explícitamente prohibido.** `README.md:504` lo declara;
  `README.md:527` prohíbe agregarlo («*No agregues documentación pública
  (Swagger/OpenAPI) para estas rutas mientras sigan siendo privadas*»);
  `CONTRIBUTING.md:139` repite la prohibición. Es una decisión defendible para una
  API privada, pero el efecto es que **no existe contrato de API documentado**.
- **Endpoints documentados: 5 de 47 (10.6 %).** Solo `/api/health` y los tres de
  recuperación de contraseña aparecen en el README.
- **JSDoc: 13 bloques en 11 de 47 archivos de ruta (23 %).** 36 archivos sin ningún JSDoc.
- La sección más completa del repositorio es la de **logging** (`README.md:179-296`).

#### Desviaciones entre documentación y código

| Hallazgo | Evidencia |
|---|---|
| README dice **«Next.js 14»**; el proyecto usa **15.5.26** | `README.md:168` vs `package.json:20` |
| README dice **«Middleware Edge con Web Crypto API»**; el código usa **runtime Node.js + `jsonwebtoken`** | `README.md:326` vs `middleware.ts:110` |
| README lista `dueno@tienda.com` como DUEÑO; el seed inserta `cumatzemilio6@gmail.com` | `README.md:103` vs `init/01_schema.sql:492` |
| README omite 2 de los 4 usuarios semilla | `init/01_schema.sql:495-508` vs `README.md:101-104` |
| README omite la página `/bodega` y el rol BODEGUERO | `README.md:303-316` vs `app/bodega/page.tsx` (674 líneas) |
| README omite `promover-dueno` y las notificaciones de deuda | 0 menciones vs 2 rutas + 2 pantallas |

---

### 4.2 — Configuración sin modificar código ❌ **NO CUMPLE**

**Criterio:** pruebas de configuración.
**Resultado: de 12 operaciones de configuración comunes evaluadas, 6 requieren modificar código fuente.**

#### Variables de entorno (`.env.example`, 34 líneas)

| Variable | Controla |
|---|---|
| `JWT_SECRET` (≥ 32 chars) | Firma de todos los JWT (`lib/auth.ts:18-23`) |
| `DATABASE_URL` | Conexión a Postgres (solo fuera de Docker) |
| `GMAIL_USER` | Remitente + usuario SMTP |
| `GMAIL_APP_PASSWORD` | Contraseña SMTP |
| `LOG_LEVEL` | Nivel mínimo de pino |
| `LOG_FILE_DIR` | Directorio del log rotado |
| `LOG_FILE_MAX_SIZE` (50M) | Tamaño por archivo |
| `LOG_FILE_KEEP` (5) | Archivos retenidos |

**Solo 8 variables**, y de ellas **3 son de logging** — el parámetro mejor
externalizado del proyecto.

#### Operaciones que exigen editar código

| Operación | ¿Editable sin tocar código? | Bloqueante |
|---|---|---|
| Cambiar servidor de correo | 🔴 **NO** | `lib/mailer.ts:34` fija `service: "gmail"`. **No existe `SMTP_HOST`/`SMTP_PORT`.** Migrar a Mailgun/SES/corporativo requiere editar código. `README.md:119` dice «el envío usa Gmail SMTP» sin advertir esta limitación |
| Cambiar rate limits | 🔴 **NO** | 11 constantes en 6 archivos, ninguna leída de env |
| Cambiar expiraciones de sesión/códigos | 🔴 **NO** | 7 constantes; la vida del JWT está **duplicada** en dos archivos (`lib/auth.ts:37` como `"8h"` y `app/api/login/route.ts:105` como `60*60*8`) |
| Cambiar base de datos o credenciales | 🔴 **NO** | Fijas en `docker-compose.yml:11,19,35` + `scripts/backup-db.sh:32-33` + `scripts/restore-db.sh:41-42` + `ci.yml`. **Repetidas en 7+ lugares.** `README.md:93` lo admite explícitamente |
| Cambiar nº máximo de dueños | 🔴 **NO** | `lib/roles.ts:16` → `MAX_DUENOS = 2`, regla de negocio crítica en un literal |
| Cambiar timeouts/límites de UI | 🔴 **NO** | ~10 literales dispersos (debounce 350 ms, polling 6000 ms, top-N de autocompletado, page sizes) |
| Cambiar retención de logs | 🟢 **SÍ** | Correcto: `LOG_FILE_MAX_SIZE`, `LOG_FILE_KEEP` |
| Cambiar nivel de log | 🟢 **SÍ** | Correcto |
| Cambiar retención de backups | 🟡 Editar YAML | `SCHEDULE`, `BACKUP_KEEP_*` en `docker-compose.yml:90-94`, no en `.env` |
| Cambiar puertos | 🟡 Editar YAML | Sin `${APP_PORT:-3001}` |
| Cambiar IVA | ⚪ N/A | **El IVA no se calcula en el sistema** (solo el flag booleano `exento_iva`, `init/01_schema.sql:62`) |
| Monopolio de proveedor | ⚪ N/A | **El concepto no existe en el código**; `producto_proveedor` es N:M (`init/01_schema.sql:71`) |

#### Defecto de configuración con impacto operativo

`BACKUP_ENCRYPTION_KEY` se lee en `scripts/backup-db.sh:68-77`, y tanto
`README.md:454` como `scripts/backup-db.sh:80` instruyen al usuario a
configurarla «*mirando `.env.example`*» — **pero `.env.example` no la contiene.**
El usuario sigue la instrucción, edita `.env`, y el respaldo queda cifrado con el
valor placeholder. Existe un guard (`backup-db.sh:68`) que detecta el placeholder,
lo que evita el peor caso, pero la referencia cruzada de la documentación es incorrecta.

---

### 4.3 — Procedimiento de instalación documentado ⚠️ **PARCIAL**

**Criterio:** prueba siguiendo el manual.

#### Lo que sí está documentado

`README.md:21-78` cubre el camino Docker de extremo a extremo:
clonar → `cp .env.example .env` → completar variables → `docker compose up --build`
→ `docker compose down`. Secciones de soporte: `.env` (`82-94`), 2FA y
*app password* de Google (`112-129`), usuarios de prueba (`97-108`), pgAdmin
(`482-494`), tests (`59-69`), reset total (`71-78`), logs (`179-296`), notas de
desarrollo (`538-554`).

La creación de la base es automática: `docker-compose.yml:54` monta `./init` en
`/docker-entrypoint-initdb.d` y `init/01_schema.sql` corre solo la primera vez
(`init/01_schema.sql:16-20`, explicado en `README.md:544-552`).

#### Tres huecos críticos

1. **Credenciales iniciales contradictorias — un instalador nuevo no puede iniciar sesión.**
   `README.md:99-104` indica que la contraseña para todos es `password123` y lista
   2 usuarios, incluyendo `dueno@tienda.com` como DUEÑO. Pero el seed real inserta
   `cumatzemilio6@gmail.com` (`init/01_schema.sql:492`) e inserta **4 usuarios, no 2**:
   los dos no documentados son `bodega@tienda.com` (BODEGUERO) y
   `sin2fa@tienda.com`, este último con `requiere_2fa = FALSE` explícito
   (`init/01_schema.sql:503-508`). **Quien siga el README al pie de la letra falla al iniciar sesión.**

2. **Migraciones no documentadas.** Solo se documenta una migración
   (`05_recuperacion_contrasena.sql`, `README.md:154-158`).
   **`05_promocion_dueno_y_notificaciones_deuda.sql` (4,273 B) no se menciona en
   ningún documento.** No hay versión de esquema ni tabla de migraciones aplicadas,
   así que un usuario nuevo no puede saber si su base está al día. El propio
   `init/01_schema.sql:18-20` indica «seguir aplicando manualmente los scripts nuevos
   en `migrations/`» sin decir cuáles ni en qué orden.

3. **No existe sección de resolución de problemas.** Búsqueda de
   `troubleshoot|problema|error común|si falla|solución de problemas` en README y
   CONTRIBUTING → **0 resultados**. No hay entrada para ninguno de los tres fallos
   de arranque previsibles: `JWT_SECRET` con menos de 32 caracteres
   (`lib/auth.ts:21`), variables `GMAIL_*` faltantes (`lib/mailer.ts:28`), o el
   volumen ya existente que impide que corra `init/` (`README.md:547-552`).
   Lo más cercano es `README.md:242-265` «Flujo para descubrir la causa de un
   error», enfocado **solo en logs**.

#### Otros huecos

| Hueco | Detalle |
|---|---|
| Prerrequisitos sin versiones | Solo «Docker Desktop instalado» (`README.md:24`). Faltan Node (el código requiere ≥15.5 por `middleware.ts:110`), Docker Engine v20+ (por `!override` en `docker-compose.prod.yml:30`) y Compose v2.7+ |
| Instalación manual ausente | `.env.example:9-11` instruye definir `DATABASE_URL` «*si corres `npm run dev` fuera de Docker*» — remite a un flujo que no está documentado (falta `createdb`, `psql -f init/01_schema.sql`, `npm ci`) |
| Seed no documentado | El seed existe (`init/01_schema.sql:483-508`) pero no se documenta qué datos entra ni que son de prueba. Un despliegue en producción hereda usuarios con `password123` sin saberlo |
| Sin procedimiento de primer dueño | No hay forma documentada de cambiar la contraseña inicial ni de crear el primer dueño en un entorno limpio |

---

### 5.1 — Ejecutable en Windows 10+ ⚠️ **PARCIAL**

**Criterio:** pruebas en Windows.

El producto es una aplicación web Next.js contenida en Docker
(`Dockerfile:11` base `node:22-alpine` con stages `dev`/`deps`/`builder`/`production`),
lo que la hace portable a Windows 10+ mediante Docker Desktop **por diseño**.

**Lo verificado:** ninguna ruta del camino de ejecución depende del sistema
operativo del host. `LOG_FILE_DIR=/app/logs` (`docker-compose.yml:15`),
`WORKDIR /app` (`Dockerfile:12`) y `/var/lib/postgresql/data`
(`docker-compose.yml:55`) son rutas **dentro del contenedor**, no del host.

**Lo no verificado:**
- **Ningún job de CI corre en Windows.** Ambos workflows usan
  `runs-on: ubuntu-latest` (`.github/workflows/ci.yml:12`, `validate-pr.yml:10,55`).
  No hay `windows-latest` en ningún sitio.
- **No se documentan versiones mínimas** para Windows 10 ni para Docker Desktop.

**Observación sobre las herramientas de medición:** `medidor.ps1:8` y
`medidor-prod.ps1:7` tienen rutas fijas a un usuario específico
(`C:\Users\Angel\AppData\Local\Temp\opencode\vol\...`). Son entregables del
informe de volumen, no parte del producto, pero confirman que la medición se
ejecutó en Windows sin que exista un procedimiento reproducible para terceros.

---

### 5.2 — Ejecutable en Linux Ubuntu 20.04+ ⚠️ **PARCIAL**

**Criterio:** pruebas en Linux.

**Lo verificado:** CI corre en `ubuntu-latest` (`.github/workflows/ci.yml:12`)
con PostgreSQL 16, ejecutando lint + typecheck + tests + build
(`ci.yml:52,55,58`). Es evidencia real de ejecución en Linux.

**Limitaciones:**
- **`ubuntu-latest` es Ubuntu 24.04, no 20.04.** La versión mínima declarada no se probó.
- La CI ejecuta `npm` directamente, **no Docker**: no valida que la orquestación
  de `docker-compose.yml` funcione en un Ubuntu limpio.
- `README.md:23-24` declara Docker Desktop como único prerrequisito, sin mencionar
  Docker Engine ni su versión mínima, que es lo que un usuario de Ubuntu necesita.

**Nota positiva:** el uso de `--network=host` (no soportado en Docker Desktop)
fue identificado y corregido en favor de `host.docker.internal`
(`carga.js:11-13,31` y `documentos/Pruebas de volumen:34-40`). Es un supuesto de
portabilidad correctamente manejado.

---

### 5.3 — Compatible con Chrome, Firefox y Edge ⚪ **NO VERIFICABLE**

**Criterio:** pruebas funcionales en navegadores.

#### No existe ninguna prueba en navegador real

| Artefacto | Estado |
|---|---|
| `playwright.config.*` | No existe |
| `cypress.config.*` / `cypress/` | No existe |
| `.browserslistrc` | No existe |
| `browserslist` en `package.json` | **Ausente** (ni en dependencies ni en devDependencies) |
| `@playwright/test` / `cypress` en `package.json` | Ausentes |
| Matriz de CI por navegador | No existe (sin `strategy.matrix`) |
| Tests manuales documentados por navegador | Ninguno |

Las apariciones de `@playwright/test` y `browserslist` en `package-lock.json`
son **dependencias transitivas** (opcional peer de `next`, y dependencia de
`autoprefixer`), no tooling del proyecto.

**La suite existente no es de navegador:** `jest.config.ts:9` fija
`testEnvironment: "jsdom"`, que **no es un navegador** — no renderiza CSS, no
ejecuta layout, no soporta `@media print`, no resuelve Tailwind.

#### Evaluación de riesgo

A favor: `app/globals.css` (83 líneas) es conservador — solo variables CSS,
`box-sizing`, scrollbar y un bloque `@media print`. **Cero `:has()`, cero `oklch()`,
cero container queries, cero `@layer`.** Tailwind 3.4.19 y las APIs usadas
(`URL.createObjectURL`, `window.print`, Web Crypto) están disponibles en los tres
navegadores desde 2020+.

En contra: `::-webkit-scrollbar` (`app/globals.css:59-61`) no está soportado en
Firefox, que simplemente lo ignora (degradación cosmética aceptable).

**Conclusión:** la compatibilidad es **probable pero no verificada**. Sin
política de navegadores declarada ni una sola prueba en navegador real, no puede
declararse cumplida.

---

### 6.1 — Autenticación usuario/contraseña ⚠️ **PARCIAL**

**Criterio:** pruebas de acceso autorizado/bloqueado.

#### Controles implementados correctamente

| Control | Implementación | Evidencia |
|---|---|---|
| Hash de contraseñas | **bcrypt, cost 10** | `lib/auth.ts:66`, `app/api/usuarios/route.ts:267-268`, `app/api/recuperar/cambiar/route.ts:62`, `init/01_schema.sql:111` |
| Firma JWT | HS256, expiración 8 h, claim `subject = id_usuario` | `lib/auth.ts:26-40` |
| Validación del secreto | Lanza si falta o tiene < 32 chars — **falla cerrado, sin fallback hardcodeado** | `lib/auth.ts:6,17-24` |
| Verificación del token | Valida firma + expiración, devuelve `null` ante cualquier error | `lib/auth.ts:42-62` |
| Bandera de cookie | `httpOnly: true`, `sameSite: "lax"`, `secure` en producción, `maxAge` 8 h | `app/api/login/route.ts:102-108` |
| 2FA por correo | Solo para `EMPLEADO`; código de 6 dígitos con **`crypto.randomInt`** (CSPRNG), **almacenado hasheado** con bcrypt, ventana de 5 min, máx. 5 intentos con contador persistido, un solo uso | `lib/verificacion.ts:14,19,23,27-29,43-45`, `app/api/login/verificar-codigo/route.ts:64-79`, `init/01_schema.sql:135` |
| Rate limit de login | **Persistente en BD**, 5 intentos/60 s por IP; sobrevive reinicios y es compartido entre instancias | `lib/login-rate-limit.ts:7-8,25-29`, `init/01_schema.sql:428-433` |
| Rate limit de API | Persistente sobre `api_rate_limit`, en usuarios y recuperación (por IP **y** por correo) | `lib/api-rate-limit.ts:23-62`, `app/api/usuarios/route.ts:18,76,192`, `init/01_schema.sql:438-442` |
| Recuperación de contraseña | 3 pasos; respuesta idéntica exista o no el correo (anti-enumeración de cuentas); token de 10 min; al cambiar limpia códigos pendientes y el bloqueo de IP | `app/api/recuperar/*/route.ts`, `lib/verificacion.ts:77-82` |
| Escalada de privilegios | `DUENO` no se puede crear ni asignar por la vía normal; solo vía flujo de 2 pasos con código por correo, tope `MAX_DUENOS = 2` | `app/api/usuarios/route.ts:122-126,223-227`, `lib/roles.ts:16` |

Estos controles son **sólidos y están bien implementados**.

#### Debilidades

| # | Debilidad | Severidad | Evidencia |
|---|---|---|---|
| **D1** | **Política de contraseña trivial: solo ≥ 6 caracteres, sin complejidad.** Sin mayúscula/minúscula, dígitos, símbolos, ni lista de contraseñas comunes. Además el dueño puede **eximir de 2FA** (`requiere_2fa`), es decir, la segunda línea de defensa se puede apagar por decisión del administrador | Media | `app/api/usuarios/route.ts:216-218`; `app/api/recuperar/cambiar/route.ts:21,40-42`; `app/api/usuarios/route.ts:274` |
| **D2** | **Secretos por defecto versionados en el repositorio.** `JWT_SECRET` de desarrollo está fijado en el compose; `POSTGRES_PASSWORD: dsm_password`; pgAdmin `admin@dsm.com`/`admin123`; puerto de BD publicado (`5433:5432`). El compose de producción sí exige `${JWT_SECRET:?}`, lo cual es correcto | Media | `docker-compose.yml:10-11,44,48-50,66-67`; `docker-compose.prod.yml:18` |
| **D3** | **Cuentas semilla con contraseña conocida por el repositorio.** `init/01_schema.sql:490` comenta literalmente «Contraseña de prueba (los usuarios): password123», y los 4 usuarios comparten **el mismo hash**. El más peligroso es `sin2fa@tienda.com` con `requiere_2fa = FALSE`. Como `docker-entrypoint-initdb.d` corre esto en cada base nueva, **cualquier despliegue desde cero nace con estas credenciales** | **Alta** | `init/01_schema.sql:490-508` |
| **D4** | **JWT no revocable.** El logout solo borra la cookie del cliente; no hay lista de revocación ni `jti`. El token sigue siendo criptográficamente válido por sus 8 h aunque el usuario haga logout. Tampoco se invalidan sesiones al cambiar la contraseña | Media | `app/api/logout/route.ts:7`; `lib/auth.ts:37`; `app/api/recuperar/cambiar/route.ts:64-67` |
| **D5** | **Rol confiado al claim del JWT sin revalidar en BD.** `lib/server-auth.ts:4-8` extrae el rol del token sin consultar la base. Un usuario degradado de `DUENO` a `EMPLEADO` o desactivado **conserva sus permisos hasta 8 h** | Media | `lib/server-auth.ts:4-8`; solo `/api/login` y `/api/recuperar/*` releen `estado_usuario` |
| **D6** | **Sin bloqueo por cuenta, solo por IP.** `login_intento` tiene `ip VARCHAR(45) PRIMARY KEY` (`init/01_schema.sql:429`): no existe columna de usuario, así que el bloqueo por cuenta no es implementable sin cambio de esquema. Un atacante distribuido puede probar muchas contraseñas contra una misma cuenta | Media | `lib/login-rate-limit.ts:30-38` |
| **D7** | **Enumeración de usuarios por diferencia de tiempo.** `/api/login` retorna 401 sin ejecutar `bcrypt.compare` si el usuario no existe (`app/api/login/route.ts:62-66`), y sí lo ejecuta si existe (`:70-74`). El mensaje es idéntico, el tiempo no | Baja | `app/api/login/route.ts:62-74` |
| **D8** | **El limitador de facturación es en memoria** (`const store = new Map(...)`), no compartido entre réplicas. El propio archivo lo documenta | Baja | `lib/rateLimit.ts:1-8` |
| **D9** | **pgAdmin conserva `admin@dsm.com`/`admin123` en producción**, porque `docker-compose.prod.yml` solo overridea el servicio `app`, nunca `pgadmin` | Media | `docker-compose.yml:66-67`; `docker-compose.prod.yml` |
| **D10** | Condición de carrera en el rate limit de login: `INSERT ... ON CONFLICT DO UPDATE` sin `FOR UPDATE`; 5 requests simultáneos pueden pasar el chequeo antes de que cualquiera registre su fallo | Baja | `lib/login-rate-limit.ts:47-64` |

---

### 6.2 — Datos sensibles cifrados en BD ❌ **NO CUMPLE**

**Criterio:** inspección del algoritmo de cifrado.
**Resultado: no existe ningún cifrado de datos en la base de datos. Solo hashing de contraseñas.**

#### Búsqueda de primitivas de cifrado

Búsqueda sobre `app/`, `lib/`, `init/`, `migrations/`, `middleware.ts` de:
`pgcrypto`, `encrypt(`, `decrypt(`, `AES`, `crypt(`, `ENCRYPTION_KEY`, `sslmode`, `ssl=`, `tls`
→ **cero resultados en código de aplicación**. Los únicos hits del repositorio
son `README.md:454,456,474` mencionando `BACKUP_ENCRYPTION_KEY`, que corresponde
al cifrado de **respaldos manuales**, opcional y fuera de la base.

No hay extensión `pgcrypto` instalada, no hay columnas `BYTEA`, no hay clave de
cifrado en la aplicación, y `lib/db.ts:12-16` es un `Pool` pelado:

```ts
export const pool: Pool =
  globalThis._pgPool ??
  (globalThis._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  }));
```

#### Lo que sí está protegido (por hashing, no por cifrado)

| Dato | Mecanismo |
|---|---|
| Contraseñas de usuario | bcrypt cost 10 — `init/01_schema.sql:111` |
| Código de verificación 2FA | bcrypt cost 10 — `init/01_schema.sql:135` |
| Código de recuperación | bcrypt cost 10 — `init/01_schema.sql:154` |
| Código de promoción a dueño | bcrypt cost 10 — `init/01_schema.sql:173` |

Este punto está **correctamente implementado**: los códigos se almacenan
**hasheados**, nunca en texto plano.

#### Lo que está en texto plano en la base

| Dato | Columna |
|---|---|
| **NIT de proveedor** | `proveedor.nit_proveedor VARCHAR(20) NOT NULL` — `init/01_schema.sql:40` |
| **NIT de cliente** | `cliente.nit_cliente VARCHAR(20)` — `init/01_schema.sql:100` |
| **NIT en factura** | `factura.nit_cliente VARCHAR(20)` — `init/01_schema.sql:289` |
| Correos (usuario, cliente) | `init/01_schema.sql:108,95` |
| **Teléfonos** | `usuario`, `cliente`, `proveedor`, `deuda.telefono_deudor` — `init/01_schema.sql:110,96,42,301` |
| **Montos financieros** | `deuda.monto_total`, `venta.total`, `pago_deuda.monto`, `factura.total_factura` — `init/01_schema.sql:303,242,329,290` |
| Direcciones de entrega | `venta.direccion_entrega` — `init/01_schema.sql:240` |

Los identificificadores fiscales (NIT/RUC) son **datos de identificación
tributaria**: un dump de la base, o los respaldos en `./backups/`, los expone íntegros.

#### TLS ausente

- `lib/db.ts:15` — `connectionString` sin `ssl: true` ni `sslmode=require`.
- `docker-compose.yml:15`, `docker-compose.prod.yml:21` — `DATABASE_URL` sin parámetros de SSL.

Dentro de la red de Docker el tráfico no sale del host, así que el riesgo es
acotado **solo si la base permanece local**. Si se replica a un proveedor
gestionado, la conexión irá en claro.

#### Agravante

Los respaldos automáticos **están explícitamente sin cifrar** (`README.md:435-442`
lo admite) y se guardan **en el mismo disco que la base** (`./backups`).
Combinado con el punto anterior, un fallo de hardware pierde datos y respaldos a
la vez, y un dump no cifrado expone NITs, correos, teléfonos y montos financieros.

---

### 6.3 — Logs de accesos y cambios ⚠️ **PARCIAL**

**Criterio:** revisión de auditoría.

#### Logs de accesos: CUMPLE ✅

| Evento | Nivel | Evidencia |
|---|---|---|
| Login exitoso (sin 2FA) | `info` | `app/api/login/route.ts:112` |
| Login exitoso (2FA) | `info` | `app/api/login/verificar-codigo/route.ts:110` |
| Usuario no encontrado | `warn` | `app/api/login/route.ts:64` |
| Contraseña incorrecta | `warn` | `app/api/login/route.ts:72` |
| Bloqueado por rate limit | `warn` | `app/api/login/route.ts:29` |
| Código 2FA incorrecto | `warn` | `app/api/login/verificar-codigo/route.ts:75` |
| Pre-token inválido/vencido | `warn` | `app/api/login/verificar-codigo/route.ts:26` |
| Acceso a ruta protegida sin sesión | `warn` | `middleware.ts:87` |
| Token inválido o expirado | `warn` | `middleware.ts:95` |

Además, `middleware.ts:69-76` registra **cada request** (método, ruta, IP) sobre
los prefijos protegidos y `/api/:path*`, filtrando los parámetros sensibles del
search string (solo `page` y `sort`, `middleware.ts:62-67`).

La infraestructura es sólida: pino (`lib/logger.ts:131-178`), rotación por
`rotating-file-stream` a 50 MB × 5 archivos con gzip (`lib/logger.ts:24,43-45,66-74`),
volumen Docker `logs_data`, y **redacción de secretos** bien implementada
(`REDACT_PATHS` cubre `password`, `contrasena`, `authorization`, `cookie`,
`token`, `jwt`, `GMAIL_APP_PASSWORD`, `JWT_SECRET` — `lib/logger.ts:48-59`).

#### Logs de cambios: NO CUMPLE ❌

**No existe tabla de auditoría.** Búsqueda de `CREATE TABLE` para
`auditoria`/`audit`/`bitacora` en `init/01_schema.sql` y `migrations/` →
**cero coincidencias** entre las 27 tablas. No hay ningún registro genérico de
*quién cambió qué y cuándo*.

**8 de 39 rutas con mutación de datos sí registran el evento de negocio:**

| Operación | Evidencia |
|---|---|
| Venta registrada | `app/api/ventas/route.ts:306-308` |
| Venta anulada | `app/api/ventas/[id]/anular/route.ts:106` |
| Deuda registrada / estado cambiado / pago | `app/api/deudas/route.ts:232-235`, `deudas/[id]/route.ts:58-61`, `deudas/[id]/pagos/route.ts:99-102` |
| Órdenes creadas/actualizadas/canceladas | `app/api/ordenes/route.ts:265`, `ordenes/[id]/route.ts:143,201` |
| Contraseña restablecida / promoción a dueño | `app/api/recuperar/cambiar/route.ts:81`, `promover-dueno/*` |

**31 rutas que mutan datos NO registran nada.** Los huecos más graves:

| Ruta | Operación sin rastro |
|---|---|
| `app/api/precios/route.ts:45-49` | **Cambio de precios de venta** (impacto financiero directo) |
| `app/api/facturacion/route.ts:77-82` | **Emisión de factura** (comprobante fiscal) |
| `app/api/usuarios/route.ts:173-179` | **Alta y modificación de cuentas** (cambio de rol, de estado, de 2FA) |
| `app/api/productos/[id]/route.ts:165` | **`DELETE FROM producto`** |
| `app/api/clientes/[id]/route.ts` | **Cambio del límite de deuda de un cliente** |
| `app/api/gestion-inventario/ajuste/route.ts` | **Ajuste manual de inventario** |
| `app/api/bodegas/[id]/route.ts:126-129` | **`DELETE` de bodega y sus existencias** |
| `app/api/gestion-inventario/transferencia/route.ts` | Transferencia entre bodegas |

**Consecuencia:** si un dueño malicioso modifica un precio o borra un producto,
no hay forma de probarlo después de que el archivo rotado haya expirado
(5 × 50 MB, `lib/logger.ts:44-45`). Los logs son mutables, borrables y no
consultables por SQL; cualquiera con acceso al volumen `logs_data` puede editarlos.

#### Dos defectos adicionales

| Defecto | Detalle |
|---|---|
| El actor no queda registrado en producción | `middleware.ts:76` registra `{method, path, ip, query}` **sin `id_usuario`**. La identidad solo aparece en `middleware.ts:101-104`, que es `log.debug` — **no se emite en producción** (`lib/logger.ts:104`, nivel `info`). En producción, los accesos a la API quedan registrados sin actor |
| El logout no se registra | `app/api/logout/route.ts` no loguea nada. No hay registro de «sesión cerrada», lo que impide detectar reutilización de tokens tras un logout |

---

### 7.1 — 100 % de la interfaz en español ✅ **CUMPLE**

**Criterio:** verificar todas pantallas/mensajes.
**Resultado: 1 cadena en inglés detectada en 38 requisitos auditados.**

#### Evidencia positiva

- `app/layout.tsx:11` → `<html lang="es">`. **Único atributo `lang=` en todo el repositorio.**
- **34 de 34 llamadas a `toLocale*()` pasan locale explícito `"es-GT"`.**
  Cero llamadas sin locale (verificado en `bodega/page.tsx:328,339,496,510`,
  `deudas/page.tsx:1394,1398,1544`, `reportes/page.tsx:170,272,590-608`).
- Cero `lang="en"`, cero `placeholder="Login"`, cero `Loading`, `Save`,
  `Cancel`, `Search`, `Submit`. Los 22 `"Error de conexión"` están en español.
- Los candidatos a inglés restantes son **cognados del español**
  (`Total`, `Stock`, `OK`, `P. unit.`, `Nombre`, `Activo/Inactivo`, `Sin datos`).

#### La única excepción

| Archivo:línea | String | Contexto |
|---|---|---|
| `app/reportes/page.tsx:256` | `total` | **Etiqueta dibujada en el centro del gráfico de dona**, visible al usuario en el reporte de ventas |

Es un caso aislado y de impacto menor, pero incumple literalmente el «100 %».

#### Dos observaciones de riesgo residual

1. **Posible fuga de cadena inglesa en runtime.**
   `app/historial-ventas/page.tsx:192` lanza `new Error(data.error || "...")` y
   `:261-262` hace `.catch((e: Error) => setError(e.message || "Error"))`.
   Si el `fetch` falla por red, `e.message` es literalmente **`"Failed to fetch"`**
   (texto del navegador, en inglés) y se renderiza al usuario. Es el único punto
   donde una cadena del runtime puede mostrarse sin transformar.

2. **Mezcla dialectal que afecta a la claridad (7.2).** Se alternan voseo
   rioplatense y español neutro para el **mismo mensaje**:
   - `app/proveedores/page.tsx:84` → «*No tenés permiso para ver esta página.*»
   - `app/deudas/page.tsx:677` → «*No tienes permiso para ver esta página.*»
   - `app/login/page.tsx:179` → «*Verificá tu identidad*»;
     `app/proveedores/page.tsx:134` → «*Administrá los proveedores*»
   - `lib/mailer.ts:109,137` → «*Tenés*» / «*ignorá*»

No es un incumplimiento de 7.1 (todo está en español), pero síIncumple 7.2.

---

### 7.2 — Lenguaje claro y comprensible ⚪ **NO VERIFICABLE**

**Criterio:** ≥ 90 % de usuarios entienden (encuesta).
**Resultado: no existe ningún artefacto de encuesta ni de prueba de usabilidad.**

#### Inventario completo de `documentos/`

| Archivo | Tamaño | Tipo | Texto extraíble |
|---|---:|---|---|
| `Corte1/PrimerCorte_software.pdf` | 596 KB | Académico (Design Thinking, Corte 1) | **Sí**, 12 páginas, 11,165 caracteres |
| `Avances1/annotated-Perfiles.pdf` | 3.9 MB | Académico (mapas de empatía anotados) | **No** — PDF basado en imagen, 0 fuentes embebidas |
| `Corte1/Bitacora1.xlsx` | 9 KB | Académico (bitácora de avance) | Sí, 44 cadenas |
| `Corte1/Entrevistas codificadas/*.docx` | 4 archivos | Académico (entrevistas de descubrimiento) | Sí (660–2,058 chars c/u) |
| `Avances2/` | — | **VACÍA** (solo `.gitkeep`) | — |
| `Corte2/` | — | **VACÍA** (solo `.gitkeep`) | — |
| `Pruebas de volumen (VOL-01 a VOL-04).md` | 16 KB | Técnico/QA | — |

#### Búsqueda de evidencia de usabilidad

Búsqueda sobre el texto extraído de los 2 PDF, 4 DOCX y 1 XLSX de los términos
`encuesta`, `usabilidad`, `satisfacción`, `evaluación`, `diseño`, `ayuda`,
`lenguaje`, `idioma`, `tipografía`, `contraste`, `prototipo`, `prueba`, `SUS`,
`accesibilidad`, `paleta` → **0 coincidencias** en todos ellos.

Búsqueda sobre todo el repositorio de `encuesta|usabilidad|SUS|satisfacción`
→ **0 resultados reales** (solo comentarios de código que contienen la subcadena
«sus», p. ej. `app/api/deudas/route.ts:225` «según su límite individual»).

#### Lo que sí existe

Cuatro entrevistas cualitativas de **descubrimiento** (`documentos/Corte1/Entrevistas codificadas/`),
que responden a preguntas sobre el problema, no sobre el producto. Ejemplo de
`Entrevistas - Dueño del Negocio.docx`: «*¿Qué tipo de errores o confusión se
presentan con más frecuencia al administrar precios o la cantidad disponible de productos?*»

**Faltan por completo:** encuesta de satisfacción, prueba de usabilidad (SUS,
SEQ, ESAT), escala de Likert, número de participantes, ni resultados tabulados.
`Corte2/` y `Avances2/` están **vacíos**: no hay segundo corte con evaluación.

**No puede demostrarse que ≥ 90 % de los usuarios entienda el lenguaje.**

---

### 7.3 — Colores e iconos neutros ⚠️ **PARCIAL**

**Criterio:** 100 % de elementos cumplen lineamientos.

#### El sistema de iconos es ejemplar — 23/23 ✅

| Verificación | Resultado |
|---|---|
| Componentes de icono | 23 `.tsx` + 23 `.svg` fuente, exportados en `components/icons/index.tsx:29-54` |
| Color | **Cada `.tsx` tiene exactamente 1 atributo `fill="currentColor"` y 0 `stroke`** |
| Multicolor | **0 iconos** con más de un `fill`, con `#hex`, `rgb()` o `rgba()` |
| Tematización | `components/Icon.tsx:50` resuelve el color desde `currentColor` del contenedor |

Ejemplos verificados: `components/icons/close.tsx:19`, `components/icons/inventory.tsx:19`.

#### La inconsistencia está en el uso de emojis como iconos

**7 emojis multicolor** renderizados en lugar de iconos del sistema:

| Archivo:línea | Emoji | Contexto |
|---|---|---|
| `app/usuarios/page.tsx:551,618,646,943` | 👑 | Badge y banner de rol dueño |
| `app/dashboard/page.tsx:153` | 🔒 | Tarjeta «clientes bloqueados por deuda» |
| `components/inventario-catalogo/InventarioView.tsx:768` | 🗑️ | Botón eliminar bodega — mientras en otros sitios se usa `Icon name="trash"` |
| `components/VentaToastListener.tsx:77` | 🛎️ | Icono del toast de venta |

Los emojis rompen la neutralidad de color y la consistencia de peso visual,
que es exactamente lo que el conjunto de iconos monolayer achieves bien.

#### La paleta no es neutral (ver 1.2)

El criterio dice «colores **e iconos** neutros». Los iconos cumplen; los colores
no: 27 hexadecimales y 17 colores RGB fuera de la paleta definida, incluidas
paletas de estado ajenas a la marca en `app/ordenes/page.tsx:88-95`.

---

### 8.1 — Facturas con datos legales requeridos ❌ **NO CUMPLE**

**Criterio:** 100 % de facturas incluyen campos obligatorios.

#### Lo que sí está presente

| Campo | Evidencia |
|---|---|
| Número de comprobante correlativo | `factura.numero_factura` con `nextval('factura_numero_seq')` — `app/api/facturacion/route.ts:79`; `init/01_schema.sql:279-281,291` |
| Unicidad atómica | Generado por `nextval()` **dentro del mismo INSERT** (comentario en `route.ts:72-76` documenta que se movió desde JS para evitar colisiones) + `UNIQUE` en la BD |
| NIT del cliente | `init/01_schema.sql:289`; render en `app/facturacion/page.tsx:287` |
| Nombre y correo del cliente | `init/01_schema.sql:288`; `app/facturacion/page.tsx:285,288` |
| Fecha | Derivada de `venta.fecha_venta` — `app/api/facturacion/[id]/route.ts:28` |
| Total y detalle de líneas | `app/api/facturacion/[id]/route.ts:38-51`; tabla en `app/facturacion/page.tsx:291-318` |

**Esta parte está bien resuelta**, en particular la numeración correlativa atómica.

#### Lo que falta

| Campo legal ausente | Impacto |
|---|---|
| **Datos del emisor: RUC/NIT, razón social, dirección fiscal, teléfono** | **Bloqueante.** La tabla `factura` tiene 6 columnas (`init/01_schema.sql:284-294`): `id_factura`, `id_venta`, `numero_factura`, `nombre_cliente`, `nit_cliente`, `total_factura`. **No existe ninguna tabla ni configuración de emisor en todo el repositorio.** La factura se emite desde el navegador sin identificación alguna de la tienda (`app/facturacion/page.tsx:267-343`) |
| **IVA / IGV** | **Alta.** Cero columnas de impuesto, cero desglose en ninguna respuesta de API. El total es un número plano. Curiosamente `producto.exento_iva BOOLEAN` (`init/01_schema.sql:62`) indica que **el modelo contempla exenciones pero nunca calcula ni desglosa el impuesto** |
| **Moneda declarada** | Media. Sin columna de moneda; la UI muestra `Q{number.toFixed(2)}` hardcodeado (`app/facturacion/page.tsx:221,312,313,322`) |
| **Dirección fiscal del cliente** | Media. `cliente` no tiene columna de dirección ni municipio (`init/01_schema.sql:92-103`). La única dirección del sistema es `venta.direccion_entrega` (`init/01_schema.sql:240`), que es de entrega a domicilio, no fiscal |
| **Serie configurable por punto de emisión** | Media. El prefijo `FACT-` es fijo (`app/api/facturacion/route.ts:79`) |
| **Código de barras / firma digital / graphene** | Media. Sin hash de integridad del comprobante, sin firma |
| **Fecha de emisión propia** | Baja. La factura hereda `fecha_venta`, no la fecha de emisión. Una venta de hace una semana facturada hoy queda fechada una semana atrás |

#### Defecto adicional de validación

`app/api/facturacion/route.ts:55` toma `nombre_cliente` y `nit_cliente` **del body**
y los inserta directamente (`:81`), sin validar el formato del NIT ni verificar
que coincida con el `cliente.nit_cliente` real de la venta — que **sí existe en la
base** (`init/01_schema.sql:100`) pero no se usa. Si llegan vacíos, caen al default
`"Consumidor Final"` / `"CF"` (`:81`).

---

### 8.2 — Historial de ventas: 5 años ⚠️ **PARCIAL**

**Criterio:** 100 % de registros almacenados.

#### En la base operativa: se cumple por diseño ✅

Búsqueda de mecanismos de purga (`DELETE FROM venta`, `TRUNCATE venta`, `retenc`,
`purge`, `archiv`, «5 años», `1825`) en `app/`, `lib/`, `init/`, `migrations/`,
`scripts/`, `middleware.ts` → **cero resultados**.

Los únicos `DELETE FROM` del proyecto son de `login_intento`,
`codigo_recuperacion`/`codigo_verificacion`, `producto` y `bodega_producto`/`bodega`.
**Ninguno afecta a `venta`.** No hay cron, job ni script de purga
(`scripts/` solo contiene backup, restore, logs y dev-reset).

Protección adicional: `factura.id_venta` **no** tiene `ON DELETE CASCADE`
(`init/01_schema.sql:293`), así que un `DELETE FROM venta` de una venta facturada
fallaría por clave foránea. Estructura de soporte: `fecha_venta TIMESTAMP NOT NULL`
(`:235`) sin particionado ni expiración, e índices `idx_venta_fecha`, `idx_venta_cliente`
(`:461-466`).

#### En los respaldos: NO se cumple ❌ — y este es el punto crítico

| Configuración | Valor | Evidencia |
|---|---|---|
| Retención de respaldos | **7 días / 4 semanas / 6 meses** | `docker-compose.yml:92-94`; `README.md:424-428` |

**Seis meses de retención contra cinco años exigidos.** Los respaldos más antiguos
se borran automáticamente (`README.md:429-432`). Si la base se corrompe o el
servidor se pierde, **todo lo anterior a 6 meses es irrecuperable**, aunque la
base operativa sí lo tuviera.

#### Otras observaciones

| Observación | Detalle |
|---|---|
| **La preservación no es una decisión documentada** | Es un efecto secundario de que nadie escribió el `DELETE`. No hay test, `CHECK`, ni comentario en el esquema que diga «las ventas no se borren». Cualquiera que añada un endpoint de limpieza no tiene ninguna señal de que rompa el requisito |
| **Riesgo de capacidad, no de retención** | El repo ya documentó 20,180 ventas con 256 MB. `/api/estadisticas` agrega sin filtro temporal en varios puntos (`app/api/estadisticas/route.ts:476-478`), y son 24 consultas secuenciales. A 5 años el crecimiento sería notable |
| **Los respaldos automáticos no están cifrados** | `README.md:435-442` lo admite explícitamente |

---

### 8.3 — Acceso financiero solo administradores ❌ **NO CUMPLE — CRÍTICO**

**Criterio:** 100 % de intentos sin permisos bloqueados.
**Resultado: las rutas financieras no son solo de administrador. Un `EMPLEADO` —e incluso un `BODEGUERO`— puede ejecutar operaciones financieras.**

> **Este es el hallazgo más grave del informe.** La interfaz oculta los enlaces
> financieros a los empleados, lo que transmite la impresión de que el control
> existe. Pero **la API los acepta**. La comprobación es *client-side*, no *server-side*.

#### Modelo de roles

`lib/roles.ts:2-6` define **tres** roles: `DUENO`, `EMPLEADO`, `BODEGUERO`.
**No existe un rol «administrador»**: en este proyecto, «administrador» se
implementa como `DUENO`. Restricción en BD: `init/01_schema.sql:112`.

#### Autorización: sí es server-side, pero el predicado es el equivocado

Cada ruta revalida la cookie en el servidor vía `getUsuarioFromRequest`
(`lib/server-auth.ts:4-8`) — **nadie confía solo en el cliente**, lo cual es un
punto fuerte del diseño. El problema es **qué predicado se aplica**:

| `isStaffTipo` = `DUENO \|\| EMPLEADO` | `isDuenoTipo` = `DUENO` |
|---|---|
| Permitido a empleados | Solo dueño |

#### Auditoría exhaustiva de las rutas financieras

| # | Ruta | Auth middleware | Rol (server-side) | ¿Empleado puede? |
|---|---|:---:|---|:---:|
| 1 | `GET /api/facturacion` | ✅ | `isStaffTipo` `route.ts:11` | 🔴 **SÍ** |
| 2 | **`POST /api/facturacion`** (emitir factura) | ✅ | 🔴 **NINGUNO** — solo `if (!usuario)` `route.ts:38-42` | 🔴 **SÍ — y también BODEGUERO** |
| 3 | `GET /api/facturacion/[id]` | ✅ | `isStaffTipo` `:13` | 🔴 **SÍ** |
| 4 | `GET /api/deudas` | ✅ | `isStaffTipo` `route.ts:23` | 🔴 **SÍ** |
| 5 | `POST /api/deudas` (crear) | ✅ | ✅ `esDueno()` `:94` | ✅ No — correcto |
| 6 | **`PATCH /api/deudas/[id]`** (PENDIENTE↔PAGADA) | ✅ | `isStaffTipo` `:18` | 🔴 **SÍ** |
| 7 | **`POST /api/deudas/[id]/pagos`** (abono) | ✅ | `isStaffTipo` `:21` | 🔴 **SÍ** |
| 8 | `GET /api/estadisticas` | ✅ | ✅ `isDuenoTipo` `:50` | ✅ No — correcto |
| 9 | `GET /api/stats` | ✅ | `isStaffTipo` `route.ts:9` | 🔴 **SÍ** |
| 10 | `GET /api/historial-ventas` | ✅ | ✅ `isDuenoTipo` `:19` | ✅ No — correcto |
| 11 | `GET /api/ventas` | ✅ | `isStaffTipo` `route.ts:35` | 🔴 **SÍ** |
| 12 | `POST /api/ventas` | ✅ | `isStaffTipo` `route.ts:122` | 🔴 **SÍ** (es su trabajo) |
| 13 | `POST /api/ventas/[id]/anular` | ✅ | `isStaffTipo` `:23` | 🟡 **SÍ**, mitigado: solo su propia venta y ventana de 10 min |
| 14 | `GET /api/ventas/recientes` | ✅ | ✅ `isDuenoTipo` `:19` | ✅ No |
| 15 | **`PATCH /api/precios`** (cambiar precios) | ✅ | `isStaffTipo` `route.ts:35` | 🔴 **SÍ** |
| 16 | `PATCH /api/clientes/[id]` (`limite_deuda`) | ✅ | ✅ `!== DUENO` `:16` | ✅ No — correcto |
| 17 | **`POST /api/clientes`** (acepta `limite_deuda`) | ✅ | `isStaffTipo` `route.ts:45` | 🔴 **SÍ** |
| 18 | `GET/POST/PATCH /api/usuarios` | ✅ | ✅ `isDuenoTipo` `:22,80,196` | ✅ No — correcto |
| 19 | `/api/usuarios/promover-dueno/*` | ✅ | ✅ `isDuenoTipo` `:32,25` | ✅ No — correcto |

#### Los 5 hallazgos concretos

**F-1 — `POST /api/facturacion` no verifica ningún rol. CRÍTICO.**

`app/api/facturacion/route.ts:38-42` (verificado directamente):

```ts
export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario) {
    return unauthorizedError();
  }
```

Solo comprueba que haya *algún* usuario. **Un `BODEGUERO` puede emitir facturas
fiscales**, porque puede:
- Insertar una fila en `factura` (`route.ts:77-82`) — crear un comprobante sin autorización.
- **Cambiar el estado de una venta a `CONFIRMADO`** (`route.ts:84-87`).
- Elegir arbitrariamente `nombre_cliente` y `nit_cliente` (`route.ts:81`).

El `BODEGUERO` es el rol con menos permisos del sistema: sus únicas rutas
autorizadas son `/api/bodega/historial` y `/api/bodega/pedidos`, ambas con
`isBodegueroTipo`. Hay además una incoherencia interna: **no puede crear una
venta** (`isStaffTipo` en `app/api/ventas/route.ts:122`) **pero sí facturar una
venta existente**. El rate limit de 10/min (`route.ts:44-48`) no mitiga un
problema de autorización.

**F-2 — `EMPLEADO` puede marcar deudas como pagadas y registrar abonos. CRÍTICO.**

`app/api/deudas/[id]/route.ts:18` y `app/api/deudas/[id]/pagos/route.ts:21` usan
`isStaffTipo`. El comentario en `pagos/route.ts:13-15` justifica la decisión:
«*Cualquier miembro del staff puede registrar un pago … ya que en la práctica es
el empleado o el dueño quien recibe el dinero en caja*». Es un razonamiento de
**proceso de negocio, no de control de acceso**. Con un token de `EMPLEADO`:

- Registrar abonos contra cualquier deuda, reduciendo `saldo_pendiente`.
- **Marcar deudas enteras como `PAGADA` sin recibir dinero**, lo que
  **desbloquea automáticamente al cliente moroso** vía `recalcularBloqueoCliente`
  (`deudas/[id]/route.ts:53-55`) — es decir, puede **rehabilitar a un cliente con
  deuda para que vuelva a comprar a crédito**.
- Alterar los KPIs financieros del dueño: `deuda_pendiente_total`,
  `tasa_recuperacion`, `pct_cartera_vencida` (`app/api/estadisticas/route.ts:539-547,755-759`).

El módulo es **inconsistente consigo mismo**: crear deuda es admin-only
(`deudas/route.ts:94`), cobrarla no.

**F-3 — `EMPLEADO` puede modificar precios de venta. ALTA.**

`app/api/precios/route.ts:35` usa `isStaffTipo`, y el `UPDATE` es sin restricción
(`:45-49`):

```ts
await client.query(
  `UPDATE producto SET precio_unitario = $1, precio_mayoreo = $2 WHERE id_producto = $3`,
  [precio_unitario, precio_mayoreo, id_producto]
);
```

**No valida que los precios sean positivos ni no negativos** — un empleado puede
poner `precio_unitario = 0`. Y **esta ruta no loguea nada** (ver 6.3), así que el
cambio no deja rastro.

**F-4 — `EMPLEADO` lee toda la información financiera y personal. ALTA.**

- `GET /api/deudas` devuelve `nombre_deudor`, **`telefono_deudor`**, `monto_total`,
  `saldo_pendiente`, `limite_deuda` e historial de pagos con `registrado_por`
  (`app/api/deudas/route.ts:30-42,68-77`).
- `GET /api/facturacion` devuelve nombre, correo y total facturado por cliente
  (`app/api/facturacion/route.ts:22-23`).

La **intención** de diseño es admin-only — la UI lo refleja
(`components/StaffShell.tsx:90` incluye `/deudas` en la lista de dueño), pero la
**aplicación** es staff.

**F-5 — `EMPLEADO` puede crear clientes con límite de deuda arbitrario. MEDIA.**

`app/api/clientes/route.ts:45` usa `isStaffTipo`, y el body incluye `limite_deuda`
(`:47`) que se usa directamente (`:49-53`). Un empleado puede crear un cliente con
`limite_deuda: 999999`, otorgándole crédito ilimitado. El `PATCH` del límite **sí**
es admin-only (`clientes/[id]/route.ts:16`), así que **crear es la puerta trasera**.

#### Dos defectos estructurales asociados

| Defecto | Detalle |
|---|---|
| **La documentación contradice a la API** | `README.md:307-317` marca Deudas como admin-only (`✅` / `—`), pero `GET /api/deudas` es staff-only. La tabla refleja la *intención*; la API la incumple. La misma tabla marca Reportes como permitido para colaborador, pero `/api/estadisticas` es `isDuenoTipo`. **Ningún lado coincide con el otro** |
| **No hay tests de autorización por rol** | Existe `__tests__/lib/roles.test.ts` (helpers puros), pero **no hay ningún test de integración que compruebe que un token de `EMPLEADO` reciba 403 en rutas de dueño**. `__tests__/integration/login-2fa.test.ts` cubre 2FA, no autorización |

**Conclusión de 8.3:** 0 % de las tentativas sin permisos están bloqueadas en las
operaciones financieras de escritura. El requisito se incumple de forma crítica.

---

### 9.1 — Disponibilidad ≥ 95 % del tiempo laboral ⚪ **NO VERIFICABLE**

**Criterio:** disponibilidad mensual ≥ 95 %.

#### Lo que existe (configurado, no medido)

| Elemento | Evidencia |
|---|---|
| Endpoint de salud | `app/api/health/route.ts:5-34` — `SELECT NOW(), current_database()`; 200 + `status:"ok"` o 500 + `status:"error"` |
| Healthcheck de Docker | **Solo para `db`**: `pg_isready`, interval 5 s, retries 5 — `docker-compose.yml:56-60` |
| Restart policy | `db_backup` (`docker-compose.yml:80`) y `app` en producción (`docker-compose.prod.yml:32`) |

#### Lo que falta

| Hueco | Detalle |
|---|---|
| **Cero monitoreo externo** | Sin Sentry, Prometheus, Uptime Kuma, Nagios ni healthchecks externos. Búsqueda de `uptime|disponibilidad|95%|monitoreo|Sentry|alert` en toda la documentación → **solo 2 falsos positivos** sobre alertas de stock y de deudas (de negocio) |
| **Cero cifra de disponibilidad medida** | No hay uptime, ni porcentaje, ni registro de incidentes, ni periodo de medición |
| **`restart` ausente en servicios críticos** | `docker-compose.yml:2-26` (servicio `app` en desarrollo) **no tiene `restart`**, y `docker-compose.yml:45-60` (servicio `db`) **tampoco**. Solo `db_backup` y el `app` de producción lo tienen |
| **`app` no tiene healthcheck** | Solo `db` lo tiene. Un cuelgue del proceso Node no lo detecta nadie |
| **El health check puede colgarse** | `app/api/health/route.ts` no aplica timeout a la consulta; si Postgres se cuelga, el health check se cuelga con él, y un health check sin timeout no puede reportar «caído» |

El único dato cuantitativo implícito es `http_req_failed = 0.00 %` en las cuatro
carreras de k6, pero eso mide errores de aplicación bajo carga sintética durante
~2 minutos, **no disponibilidad en tiempo laboral**.

---

### 9.2 — Copias de seguridad diarias ⚠️ **PARCIAL**

**Criterio:** 100 % de días con ≥ 1 respaldo.

#### Configuración: correcta y probada en ejecución

Servicio `db_backup` en `docker-compose.yml:78-97`:

```yaml
  db_backup:                                          # línea 78 — ACTIVO (sin #)
    image: prodrigestivill/postgres-backup-local:16
    restart: unless-stopped
    environment:
      - SCHEDULE=@daily                               # línea 90
      - BACKUP_ON_START=TRUE                          # línea 91
      - BACKUP_KEEP_DAYS=7                            # línea 92
      - BACKUP_KEEP_WEEKS=4                           # línea 93
      - BACKUP_KEEP_MONTHS=6                          # línea 94
    volumes:
      - ./backups:/backups
```

**Corrección a una premisa común:** el servicio `db_backup` **no está comentado**
— las líneas 74-77 son comentarios *descriptivos* del bloque, y la línea 78 es
la clave activa (verificado). Arranca con `docker compose up` normal, sin
`profiles` (a diferencia del servicio `test`, que sí usa `profiles: ["test"]`).

También existe un camino manual: `scripts/backup-db.sh` (82 líneas) hace
`pg_dump --clean --if-exists | gzip` a `./backups/manual` y opcionalmente cifra
con `openssl enc -aes-256-cbc -salt -pbkdf2` (`:68-77`).

#### Evidencia de ejecución real en disco

```
backups/daily/    deposito_san_miguel-20260923.sql.gz   22,141 B
                 deposito_san_miguel-20260924.sql.gz   22,537 B
                 deposito_san_miguel-20260929.sql.gz   23,553 B
                 deposito_san_miguel-latest.sql.gz → 20260929.sql.gz
backups/weekly/  202637, 202639, 202640
backups/monthly/ deposito_san_miguel-202609.sql.gz
backups/last/    deposito_san_miguel-20260929-222332.sql.gz
```

7 artefactos con rotación por tiers funcional (confirmado por los enlaces duros).

#### El incumplimiento: la cadencia no es diaria

**`backups/daily/` contiene 3 archivos en un rango de 22 días.**
- 2026-09-23 → 2026-09-24: 1 día ✅
- 2026-09-24 → 2026-09-29: **5 días sin respaldo** ❌

El bucket `daily/` debería tener 7 entradas (por `BACKUP_KEEP_DAYS=7`) y tiene 3.

**Causa raíz:** `SCHEDULE=@daily` solo dispara **si el contenedor está vivo**, y
`backups/manual/` **no existe**, lo que indica que el proceso solo se levanta
cuando alguien ejecuta `docker compose up` — es decir, en sesiones de
desarrollo, no en una máquina continua. No hay crontab, ni unidad systemd, ni
workflow que dispare respaldos: la única «programación» es la interna del contenedor.

**Consecuencia sobre el criterio «100 % de días con ≥ 1 respaldo»:** con la
evidencia en disco, la cobertura es **3 de 22 días = 13.6 %**.

#### Agravantes

| Agravante | Detalle |
|---|---|
| **Los respaldos automáticos no están cifrados** | `README.md:435-442` lo admite. Contienen NITs, correos, teléfonos y montos financieros en texto plano |
| **Se guardan en el mismo disco que la base** | `./backups` está fuera del volumen Docker (correcto, sobrevive a `down -v`), pero **un fallo de hardware pierde datos y respaldos simultáneamente** |
| **La retención contradice 8.2** | 6 meses contra los 5 años exigidos |

---

### 9.3 — Recuperación ante falla ≤ 30 minutos ⚪ **NO VERIFICABLE**

**Criterio:** 95 % de pruebas ≤ 30 min.

#### Procedimiento existente: sólido

`scripts/restore-db.sh` (138 líneas) está bien construido:

| Control | Evidencia |
|---|---|
| Validación de **extensión y magic bytes** antes de tocar la base | `restore-db.sh:80-100` — `.sql.gz.enc` exige header `Salted__` (`:83-87`); `.sql.gz` exige bytes `1f8b` de gzip (`:90-94`). **Rechaza un archivo renombrado** |
| Verificación de que el servicio `db` corre | `:102-105` |
| Confirmación interactiva | `:107-113` |
| Descifrado a temporal con limpieza en `trap` | `:117-133`; trap en `:26-38` |
| Restauración | `gunzip -c \| docker compose exec -T db psql` — `:136` |

Documentado en `README.md:459-479` con ejemplos para ambas variantes, y con la
advertencia correcta para Windows (`README.md:477`: «*En Windows, corré estos
scripts desde Git Bash o WSL*»).

#### Por qué no es verificable

| Hueco | Detalle |
|---|---|
| **El restore nunca se ha probado** | No existe registro de ninguna prueba de restauración, ni script de verificación. **`backups/manual/` no existe en disco**, lo que significa que `backup-db.sh` nunca se ejecutó con éxito en esta máquina |
| **No hay RTO/RPO documentados** | Búsqueda de `RTO|RPO` en toda la documentación → **0 resultados**. El umbral de 30 min nunca se impuso al proyecto |
| **La recuperación total tiene un paso no documentado** | Tras un `docker compose down -v`, el volumen de Postgres se destruye. `init/` solo corre la primera vez que se crea el volumen (`README.md:545-551` lo dice), así que el operador debe **reconstruir el esquema y reaplicar migraciones** antes de restaurar. Ese tiempo no está estimado en ningún sitio |
| **El criterio es probabilístico** | «95 % de pruebas ≤ 30 min» implica múltiples ensayos. **No se realizó ninguno.** Con cero datos, la tasa de cumplimiento no puede calcularse |

---

### 10.1 — Importar/exportar .xlsx de inventario ❌ **NO CUMPLE**

**Criterio:** ≥ 80 % de pruebas sin pérdida de datos.

#### Exportación: existe, pero de **reportes**, no de inventario

`exceljs` está en dependencias de producción (`package.json:18`) y se usa en
**un solo lugar**:

| Archivo:línea | Operación |
|---|---|
| `app/reportes/page.tsx:480` | `const ExcelJS = await import("exceljs")` |
| `app/reportes/page.tsx:481-482` | `new ExcelJS.Workbook()` + `addWorksheet("Reporte")` |
| `app/reportes/page.tsx:483` | `worksheet.addRows(rows.filter(r => r.length > 0))` |
| `app/reportes/page.tsx:485-488` | `writeBuffer()` + `Blob` |
| `app/reportes/page.tsx:493` | `a.download = \`reporte-{completo\|periodo}-{fecha}.xlsx\`` |

Las filas provienen de `/api/estadisticas` (`reportes/page.tsx:408`): ventas
totales, ticket promedio, ventas por día, top productos, top clientes, ingresos
por categoría, KPIs y deudores.

**Es un reporte analítico de negocio, no un volcado de inventario.** No hay
exportación de stock, kardex ni catálogo a `.xlsx`.

#### Importación: NO EXISTE

Búsqueda de `formData`, `multipart`, `type="file"`, `File`, `accept=".xlsx"`,
`readFile`, `workbook.xlsx.load` sobre `app/` y `components/` → **cero resultados**.
No existe:
- ningún `<input type="file">` en todo el repositorio
- ninguna ruta API que parsee `.xlsx`
- ninguna llamada de lectura de workbook
- ninguna mención de «importar» en las páginas de inventario, catálogo o productos
- ninguna mención de Excel en el README

#### Prueba del 80 %: inexistente

`__tests__/` no contiene ningún test de `exceljs` o `.xlsx`. El informe de volumen
no menciona importación.

**Conclusión:** de las dos mitades del requisito (importar **y** exportar) del
inventario, **no está implementada ninguna**. La exportación existente es de
reportes, que es un requisito distinto. No hay base para ninguna tasa de éxito.

---

### 10.2 — Conexión a base de datos relacional ✅ **CUMPLE**

**Criterio:** CRUD exitoso en pruebas.

#### Conexión

| Elemento | Evidencia |
|---|---|
| Driver | `pg` — `lib/db.ts:3` |
| Pool singleton | `lib/db.ts:12-16`, con `declare global` (`:6-10`) para sobrevivir al hot-reload de Next en desarrollo |
| Manejo de errores de pool | Listener `error` para evitar pools zombis — `lib/db.ts:20-25` |
| Transacciones | `pool.connect()` → `BEGIN` → inserts → `COMMIT` / `ROLLBACK` en `catch` → `client.release()` en `finally` — `app/api/productos/route.ts:113-164` |

#### Modelo relacional

`init/01_schema.sql` (780 líneas) define:

| Objeto | Cantidad |
|---|---:|
| Tablas (`CREATE TABLE`) | **27** |
| Claves primarias | **27** (una por tabla) |
| Claves foráneas (`REFERENCES`) | **36** |
| Secuencias | 1 (`factura_numero_seq`, `:279`) |
| Vistas | 1 (`v_deudores`, `:410`) |
| Índices | 13 |
| Restricciones `CHECK` | 4 (`kardex.tipo_movimiento` `:209`, `factor_conversion > 0` `:85`, `venta.estado_venta` `:235`, `direccion_entrega` condicional `:246`) |
| Claves foráneas compuestas | `kardex` → `bodega_producto(id_bodega, id_producto)` con PK compuesta (`:199,225-226`) |

#### CRUD verificado por pruebas

- **29 archivos de prueba de API** en `__tests__/api/` (`productos`, `ventas`,
  `ventas-post`, `ventas-anular`, `deudas`, `deudas-pagos`, `facturacion`,
  `facturacion-detalle`, `clientes`, `bodegas`, `categorias`, `marcas`,
  `usuarios`, `login`, `login-verificar-codigo`, `logout`, `sesion`, `health`,
  `historial-ventas`, `stats`, `recuperar-*`, `promover-dueno-*`).
- **4 pruebas de integración contra la base real:** `ventas-stock-race.test.ts`
  (carrera de stock), `facturacion-secuencia.test.ts` (secuencia atómica),
  `detalle-venta-cascade.test.ts` (`ON DELETE CASCADE`), `login-2fa.test.ts`.
- **8 pruebas de página** y **2 de componentes**.
- **CI ejecuta el esquema real + tests + build:** `.github/workflows/ci.yml:52,55,58`.
- Umbral de cobertura global de 60 % en las 4 métricas (`jest.config.ts:26-33`).

**Este requisito se cumple con evidencia sólida.**

---

### 10.3 — Arquitectura modular ⚠️ **PARCIAL**

**Criterio:** APIs/módulos desacoplados documentados.

#### Lo que está bien hecho

| Aspecto | Evidencia |
|---|---|
| **Separación por dominio** | 47 route handlers organizados en **24 dominios** de API |
| **Capa `lib/` compartida** | 16 módulos: `db`, `auth`, `roles`, `server-auth`, `api-error`, `api-rate-limit`, `login-rate-limit`, `rateLimit`, `logger`, `mailer`, `verificacion`, `deuda-alertas`, `historial-ventas`, `ui-table` |
| **Componente reutilizable real** | `lib/ui-table.tsx` (184 líneas) exporta `matchesQuery`, `paginar`, `PaginationBar`, `PAGE_SIZES`; consumido por `app/deudas/page.tsx:6`, `InventarioView.tsx:4`, `CatalogoView.tsx:4` |
| **Extracción de lógica a `lib/`** | `lib/historial-ventas.ts` (304 líneas) extrae la query más compleja fuera del route handler |
| **Hooks de sesión separados** | `useBodegueroSession`, `useDuenoSession`, `useStaffSession` |
| **Middleware centralizado** | Verificación de token y logging en un punto; health checks exentos (`:55`) |
| **Código muerto marcado** | `app/api/inventario/route.ts:8-10` tiene `@deprecated` con razón explícita |

#### Lo que falta

**1. Capa de UI monolítica.** Ocho archivos superan las 850 líneas, todos *client
components* con estilos inline y lógica de negocio mezclada:

| Archivo | Líneas |
|---|---:|
| `app/deudas/page.tsx` | **1,896** |
| `app/usuarios/page.tsx` | 1,416 |
| `components/inventario-catalogo/InventarioView.tsx` | 1,070 |
| `app/historial-ventas/page.tsx` | 1,043 |
| `app/reportes/page.tsx` | 947 |
| `components/inventario-catalogo/CatalogoView.tsx` | 924 |
| `app/ordenes/page.tsx` | 876 |
| `app/api/estadisticas/route.ts` | 766 |

`app/deudas/page.tsx` a 1,896 líneas contiene 6 pestañas de estado, tres listas
paginadas independientes, componentes de modales, toasts y confirmaciones.
**Ninguno de estos 8 archivos supera ~1,900 líneas por una razón estructural:**
falta el patrón de extraer subcomponentes o hooks de dominio que sí se aplica en
`inventario-catalogo/` (donde `InventarioCatalogo.tsx` con 68 líneas orquesta
dos vistas separadas).

**2. Un endpoint concentra 24 consultas secuenciales.**
`app/api/estadisticas/route.ts` ejecuta **24 `pool.query` secuenciales** (líneas
98, 115, 135, 153, 170, …) por request, en lugar de uno con CTEs. No sigue el
patrón de extracción a `lib/` que ya se aplicó en `historial-ventas.ts`.

**3. APIs/módulos no documentados.** Este es el punto exacto que exige el criterio.
- **OpenAPI/Swagger: ausente y explícitamente prohibido** (`README.md:504,527`,
  `CONTRIBUTING.md:139`).
- **5 de 47 endpoints documentados (10.6 %).**
- **JSDoc en 11 de 47 archivos de ruta (23 %).**
- **Cero diagramas de arquitectura** en todo el repositorio.

La decisión de no exponer la API es defendible para una API privada, pero el
resultado es que **la única especificación de los módulos es el código**.

**4. Uso reducido de Server Components.** 15 de 16 `page.tsx` usan `"use client"`,
por lo que no hay separación de renderizado servidor/cliente.

---

### 11.1 — Módulo de ayuda en línea ❌ **NO CUMPLE**

**Criterio:** ≥ 80 % de vistas principales con botón de ayuda.
**Resultado: 0 % (0 de 13 vistas existentes).**

#### No existe módulo de ayuda en absoluto

| Búsqueda | Resultado |
|---|---|
| Ruta `/ayuda`, `/help`, `/docs` en `app/` | **No existe** (17 entradas en `app/`, ninguna de ayuda) |
| `href` que apunte a ayuda/manual | **0 en todo el repositorio** |
| Botones con glifo `?`, `¿` o `title="Ayuda"` | **0** |
| `ayuda\|help\|manual de usuario\|tooltip\|tutorial\|faq` sobre `app/`, `components/`, `lib/`, `public/` | **5 hits, ninguno un control de ayuda** |

Los 5 hits son: `<p style={s.help}>` con texto explicativo estático dentro de
modales (`InventarioView.tsx:551,611,649`: «Registra el ingreso de mercancía.
Queda trazado en kardex.»), la definición del estilo `help:` (`:1057`), y
referencias en `README.md:225` / `CONTRIBUTING.md` sobre guía de contribución —
no ayuda al usuario final.

#### Cobertura por vista principal

| # | Vista | Ruta | ¿Botón de ayuda? |
|---|---|---|:---:|
| 1 | Dashboard | `/dashboard` | ❌ |
| 2 | Ventas | `/ventas` | ❌ |
| 3 | Inventario | `/inventario` | ❌ |
| 4 | Órdenes | `/ordenes` | ❌ |
| 5 | Productos | `/productos` | ❌ |
| 6 | Proveedores | `/proveedores` | ❌ |
| 7 | Clientes | — | ⚪ **La vista no existe** (solo `app/api/clientes/`); se gestiona embebida en Deudas y Ventas |
| 8 | Bodega | `/bodega` | ❌ |
| 9 | Catálogo | `/catalogo` | ❌ |
| 10 | Deudas | `/deudas` | ❌ |
| 11 | Facturación | `/facturacion` | ❌ |
| 12 | Historial de ventas | `/historial-ventas` | ❌ |
| 13 | Reportes | `/reportes` | ❌ |
| 14 | Usuarios | `/usuarios` | ❌ |

**Cálculo:**
- Vistas que existen: **13** (de 14; `clientes` no tiene vista).
- Con botón de ayuda: **0**.
- **Cobertura: 0 / 13 = 0.0 %** (o 0 / 14 = 0 % contando la vista inexistente).
- Requisito: ≥ 80 % → **falta 80 puntos porcentuales**.

---

### 11.2 — Manual PDF descargable ❌ **NO CUMPLE**

**Criterio:** verificar existencia y disponibilidad.

#### No existe ningún manual PDF descargable

**En la aplicación:**
- Búsqueda de `*.pdf` en el repositorio → exactamente **2 archivos**, ambos bajo
  `documentos/`, es decir **fuera de `public/`** y por tanto **no servibles por la app**.
- `grep -rn "Content-Disposition|readFile|createReadStream|new Response("` sobre
  `app/api` → **0 resultados**. **No existe ninguna ruta que sirva archivos.**
- `public/` contiene **únicamente** `icons/light/seller.png`.
- El único botón de descarga de la app genera un `.xlsx` de reportes
  (`app/reportes/page.tsx:493`), no un PDF.

**Los 2 PDF del repositorio no son manuales de usuario** (contenido verificado
extrayendo el texto):

| Archivo | Contenido real |
|---|---|
| `documentos/Corte1/PrimerCorte_software.pdf` | **Entregable académico de Design Thinking del Primer Corte** (autor: *CUMATZ QUINA, ESTEBAN EMILIO*). Contiene: problematización, perfiles, framework AEIOU, mapa de Actores/Actividades/Environments/Interactions/Objects/Users, guiones de entrevista, insights, necesidades y oportunidades. **Cero contenido de uso del software** |
| `documentos/Avances1/annotated-Perfiles.pdf` | **Mapas de empatía anotados** (3.9 MB). PDF basado en imagen: **0 fuentes embebidas, 0 objetos de página detectables**, texto no extraíble. Corresponde a los perfiles de las entrevistas del PDF anterior |

---

### 11.3 — Mensajes de error descriptivos ⚠️ **PARCIAL**

**Criterio:** 90 % de errores críticos sin códigos técnicos.
**Resultado: 41 de 47 rutas (87.2 %) están limpias — por debajo del 90 % exigido. Hay 6 fugas técnicas confirmadas.**

#### El mecanismo central existe y es correcto

`lib/api-error.ts` implementa la política de forma explícita y consistente:

| Helper | Comportamiento |
|---|---|
| `apiError(context, error, status)` `:12-24` | Loguea al servidor (`:18`) y devuelve **`{ error: "Error interno del servidor" }`** (`:21`) |
| `validationError(message)` `:28-30` | 400 |
| `unauthorizedError()` `:33-35` | 403 «No autorizado» |
| `tooManyRequestsError(retryAfter)` `:37-46` | 429 |

El comentario de cabecera (`:1-2`) lo declara: «*manejo de errores consistente…
**NUNCA exponer stack traces o mensajes internos al cliente***».

**Cobertura:** 52 llamadas a `apiError()` en rutas que importan el helper. Las
rutas que no lo usan también loguean y devuelven mensajes genéricos en español
(p. ej. `app/api/ventas/route.ts:104-109` → `{ error: "Error al consultar ventas" }`).

**Los códigos técnicos de BD se traducen correctamente a lenguaje de negocio**
en 5 rutas, que interceptan `error?.code === "23505"` (violación de unicidad de
PostgreSQL): `clientes/route.ts:73`, `marcas/route.ts:38`, `categorias/route.ts:38`,
`productos/[id]/route.ts:108`, `productos/route.ts:166`. **Cero `err.stack`
expuestos y cero `message: error.message` en `app/api/**`.**

#### Las 6 fugas confirmadas

| # | Archivo:línea | Fuga | Alcance |
|---|---|---|---|
| 1 | `app/api/bodegas/route.ts:68-72` | `{ error: "Error al crear bodega", **detalle: String(error)** }` | Incondicional. **Sin loguear en servidor** |
| 2 | `app/api/gestion-inventario/ajuste/route.ts:141-145` | `{ error: "Error al ajustar inventario", **detalle: String(error)** }` | Incondicional. Sin `apiError`, sin log |
| 3 | `app/api/gestion-inventario/kardex/route.ts:77-81` | `{ error: "Error al consultar kardex", **detalle: String(error)** }` | Incondicional. Sin `apiError`, sin log |
| 4 | `app/api/gestion-inventario/route.ts:80-84` | `{ error: "Error al consultar gestión...", **detalle: String(error)** }` | Incondicional. Sin `apiError`, sin log |
| 5 | `app/api/gestion-inventario/transferencia/route.ts:196-200` | `{ error: "Error al transferir inventario", **detalle: String(error)** }` | Incondicional. Sin `apiError`, sin log |
| 6 | `app/api/health/route.ts:21-32` | `process.env.NODE_ENV !== "production" ? String(error) : "..."` | **Condicional**: en dev/staging filtra el error crudo de Postgres. Además `:13,16,29` exponen el nombre del motor y el nombre de la base de datos |

`String(error)` puede producir `ECONNREFUSED`, `duplicate key value violates
unique constraint "..."`, o mensajes de `pg` con nombres de tabla y columna.
Además, **5 de las 6 rutas con fuga no loguean el error en servidor**, lo que
impide después reconstruir qué ocurrió.

#### Un segundo vector de fuga en la interfaz

**42 sitios** en la UI hacen `setError(data.error || "...")` o
`showToast(d.error || ...)`, propagando **sin transformar** lo que devuelve la API
(p. ej. `app/login/page.tsx:43,78,105`; `app/deudas/page.tsx:406,429,519,578,744,793`;
`app/ventas/page.tsx:328,346`; `app/bodega/page.tsx:140,251`; `app/usuarios/page.tsx:126,180,207,250,292,317`).
Aunque hoy la mayoría de rutas usa `apiError` y devuelve texto genérico en español,
**estas 42 líneas son el punto de paso por donde las 6 fugas anteriores llegarían a
la pantalla si se corrigieran solo los `route.ts`.**

#### Tension del requisito: «descriptivos» vs. «genéricos»

22 sitios usan el placeholder `"Error de conexión"` (`app/deudas/page.tsx:415,440`;
`app/bodega/page.tsx:145,258`; `app/productos/page.tsx:269,298,327,400`;
`app/usuarios/page.tsx:128,187,216,258,299,325`; `CatalogoView.tsx:248,270,292,350,370`;
`InventarioView.tsx:394,429,439`). Esto es **correcto** para el criterio «sin códigos
técnicos», pero **no satisface «mensajes de error descriptivos»**: no dice qué falló
ni qué hacer.

Contraste con los buenos casos: `app/api/ventas/[id]/anular/route.ts:111`
«No se pudo deshacer la venta» y `app/api/ordenes/[id]/route.ts:76`
«No se puede modificar una orden ${estado}», que sí indican causa.

**Balance: 41/47 = 87.2 % → no alcanza el 90 % exigido.**

---

### 13.1 — Desktop: arranque ≤ 40 s ⚪ **NO VERIFICABLE**

**Criterio:** computadora presente en el negocio.

**No existe ninguna medición de tiempo de arranque en el repositorio.**

| Evidencia disponible | Detalle |
|---|---|
| `README.md:37` | «Levanta todo con Docker (primera vez tarda ~2 min)» — es el arranque **en frío con `--build`**, que incluye `npm ci` + `COPY . .` + `next build`. **No es el criterio de 40 s** |
| `documentos/Pruebas de volumen` | `carga.js:60-88` mide login y endpoints **una vez que el servidor ya está arriba**. Sin medición de arranque |
| `documentos/Pruebas de volumen:65` | `/api/stats` primer request = 3,436 ms en dev / 139 ms en prod — es **compilación bajo demanda**, no arranque del contenedor |

Para evaluar el requisito haría falta medir el tiempo desde que se enciende el
equipo hasta que la app responde, en el hardware del negocio. **Ni el hardware ni
la medición existen.**

---

### 13.2 — Smartphones: Android ≥ 13 ⚪ **NO VERIFICABLE**

**Criterio:** todos los empleados con dispositivo.

Dos impedimentos independientes:

1. **No existe aplicación móvil** (ver 14.2). No hay APK, ni Capacitor, ni React Native.
2. **No existe dato del parque de dispositivos** del negocio. El repositorio no
   contiene información sobre los teléfonos de los empleados.

La interfaz es **responsive** con Tailwind (p. ej. `components/StaffShell.tsx` usa
clases flex con sidebar colapsable), lo que hace la web usable en un teléfono. Pero
**no hay evidencia de prueba en Android ≥ 13**, ni de que todos los empleados
tengan un dispositivo compatible. El requisito depende de una decisión de
adquisición de hardware que no pertenece al sistema.

---

### 13.3 — Impresora con conexión de red/Bluetooth ⚠️ **PARCIAL**

**Criterio:** impresora disponible.

#### Lo que existe: impresión vía diálogo del sistema

| Elemento | Evidencia |
|---|---|
| Única invocación de impresión | `app/facturacion/page.tsx:335` → `onClick={() => window.print()}` |
| Hoja de estilos de impresión | `app/globals.css:66-83` — bloque `@media print` con `visibility: hidden` en `body *`, revelando solo `#factura-print-area`, y `.no-print { display: none !important }` |
| Referencia de diseño | `app/globals.css:63-65` menciona «DEV-118» — es una decisión deliberada |

#### Lo que falta: toda integración específica

Búsqueda de `impresora|bluetooth` en `app/`, `components/`, `lib/`, `public/` →
**0 resultados**. No existe:
- detección o enumeración de impresoras
- impresión en red (socket, ESC/POS, IP:9100, IPP)
- módulo Bluetooth (Web Bluetooth API)
- configuración de impresora en config ni en variables de entorno

**Interpretación honesta:** `window.print()` delega al sistema operativo, que
**técnicamente permite** imprimir en una impresora de red ya configurada en el
SO, y también en una Bluetooth por la misma vía. Pero eso es el comportamiento
por defecto del navegador, **no una integración**. El requisito no pide
integración, sino disponibilidad de hardware, que no es verificable desde el
repositorio; lo verificable —la capacidad de imprimir— está presente pero de
forma genérica.

---

### 14.1 — BD actualizada con productos vigentes ✅ **CUMPLE**

**Criterio:** todos los productos al día.

Existe un mecanismo completo de gestión de catálogo:

| Elemento | Evidencia |
|---|---|
| Listado con relaciones | `app/api/productos/route.ts:7-35` — `SELECT` con joins a `categoria` y `marca`, `ORDER BY p.nombre_producto` |
| Creación validada | `app/api/productos/route.ts:51-171` — validación de campos obligatorios (`:88`), **validación server-side** de unidad líquida (`:99-107`, con comentario en `:37-41` de que se valida también en servidor «*para que no se pueda saltar con una llamada directa a la API*`) |
| Transacción | `:113-164` — `pool.connect()`, `BEGIN`, inserts de `producto` + `producto_proveedor` + `presentacion_producto`, `COMMIT`, `ROLLBACK` en `catch`, `release()` en `finally` |
| Unicidad de código | `uq_producto_codigo` (`init/01_schema.sql:64`) con traducción de conflicto 23505 → HTTP 409 (`app/api/productos/route.ts:166-168`) |
| Actualización | `app/api/productos/[id]/route.ts` (PUT) |
| Precios | `app/api/precios/route.ts` (consumido en `CatalogoView.tsx:363`) |
| Presentaciones | `app/api/presentaciones/route.ts` + `[id]/route.ts` (con factor de conversión) |
| Baja lógica | `producto.estado_producto` con filtros de activos/inactivos |
| Interfaz de catálogo | `components/inventario-catalogo/CatalogoView.tsx:392-401` — filtros por activos, categoría, marca, exento IVA, caducidad |
| Pruebas | `__tests__/api/productos.test.ts`, `__tests__/pages/inventario.test.tsx` |

**El sistema permite mantener el catálogo al día.** Lo que no existe es
sincronización con un proveedor externo o un feed de catálogo: la actualización
es **manual, mediante la interfaz**. Que el catálogo esté *efectivamente* al día
es un dato del negocio (datos de carga), no del sistema.

---

### 14.2 — App móvil para empleados ❌ **NO CUMPLE**

**Criterio:** accesible en Android.

**No existe aplicación móvil de ninguna forma.** Verificado por múltiples ángulos:

| Ángulo | Resultado |
|---|---|
| Dependencias nativas | `capacitor`, `react-native`, `expo`, `apk` → **0 resultados** en `package.json` y `README.md` |
| Configuración nativa | Sin `capacitor.config.*` |
| Directorios nativos | Sin `android/`, sin `ios/` |
| **PWA** | `ls public/` → **solo** `icons/light/seller.png`. **Sin `manifest.json`, sin `app/manifest.ts`, sin service worker, sin `next-pwa`** (tampoco en `package.json`) |
| Empaquetado | Sin APK ni artefacto de distribución |
| Documentación | `README.md:519` reconoce explícitamente que exponer la API «*a una app móvil separada*» requeriría trabajo adicional (auth token, contrato versionado, rate limiting para tráfico no confiable) |

Lo más cercano a «móvil» es el **diseño responsive** con Tailwind, que hace la
web usable en un teléfono. **Pero eso es una web, no una app móvil**, y el
requisito es explícito.

---

## 4. Acciones recomendadas

Ordenadas por relación entre severidad y esfuerzo. Los hallazgos marcados con
🔴 deben resolverse antes de cualquier despliegue en producción con datos reales.

### 4.1 Crítico — Seguridad y autorización

| # | Acción | Ubicación |
|---|---|---|
| 1 | 🔴 **Añadir `isDuenoTipo` al POST de facturación.** Un `BODEGUERO` hoy puede emitir facturas y cambiar el estado de una venta a `CONFIRMADO` | `app/api/facturacion/route.ts:40` |
| 2 | 🔴 **Cambiar `isStaffTipo` → `isDuenoTipo`** en debts: marcar deudas como pagadas y registrar abonos es acción financiera. Esto también cierra el hueco de «desbloquear a un cliente moroso sin cobrar» | `app/api/deudas/[id]/route.ts:18`, `app/api/deudas/[id]/pagos/route.ts:21` |
| 3 | 🔴 **`isDuenoTipo` + validar `precio >= 0`** en precios, y **añadir logging** | `app/api/precios/route.ts:35` |
| 4 | 🔴 **Ignorar `limite_deuda` en `POST /api/clientes` para no-`DUENO`** (el `PATCH` ya es admin-only; la creación es la puerta trasera) | `app/api/clientes/route.ts:45-53` |
| 5 | 🔴 **Restringir a `isDuenoTipo` la lectura** de `GET /api/facturacion`, `GET /api/deudas`, `GET /api/stats` | `app/api/facturacion/route.ts:11`, `deudas/route.ts:23`, `stats/route.ts:9` |
| 6 | 🔴 **Rotar secretos y eliminar contraseñas semilla conocidas.** En especial `sin2fa@tienda.com` con `requiere_2fa = FALSE`, que hoy es acceso directo sin 2FA | `init/01_schema.sql:490-508`, `docker-compose.yml:10-11,66-67` |
| 7 | 🟠 **Añadir tests de autorización por rol** que comprueben que un token de `EMPLEADO` recibe 403 en cada ruta financiera | `__tests__/` |

### 4.2 Crítico — Datos y cumplimiento legal

| # | Acción | Ubicación |
|---|---|---|
| 8 | 🔴 **Añadir datos del emisor a la factura** (RUC/NIT, razón social, dirección fiscal, teléfono) + `fecha_emision` propia + desglose de IVA/IGV + moneda. La tabla `factura` tiene hoy 6 columnas y ninguna de identidad del emisor | `init/01_schema.sql:284-294`, `app/api/facturacion/route.ts` |
| 9 | 🔴 **Implementar cifrado en reposo para datos sensibles** (NIT/RUC, teléfonos) y **añadir TLS** a la conexión de la base | `lib/db.ts:15`, `docker-compose.yml:15` |
| 10 | 🔴 **Subir la retención de respaldos** de 6 meses a 60+ para cubrir los 5 años de 8.2, y **cifrar los respaldos automáticos** (hoy explícitamente sin cifrar) | `docker-compose.yml:92-94`, `README.md:435-442` |
| 11 | 🟠 **Eliminar las 6 fugas `String(error)`** y añadir `apiError` + logging a las 5 rutas de gestión de inventario que no lo tienen | `bodegas/route.ts:70`, `gestion-inventario/*` |
| 12 | 🟠 **Crear una tabla `auditoria`** genérica (`actor`, `acción`, `entidad`, `id_entidad`, `datos_antes`, `datos_despues`, `ip`, `en`) y registrar en ella los cambios de las 31 rutas hoy sin logging | `init/01_schema.sql`, y las 31 rutas |
| 13 | 🟠 **Corregir la contradicción de credenciales del README** y documentar las 4 cuentas semilla (o mejor: eliminarlas del seed) | `README.md:99-104` vs `init/01_schema.sql:490-508` |

### 4.3 Alto — Rendimiento y disponibilidad

| # | Acción | Ubicación |
|---|---|---|
| 14 | 🔴 **Corregir los antipatrones ya identificados por el propio informe de volumen y que siguen sin corregir**: `LIMIT` después del `GROUP BY` en `/api/ventas`, y ausencia total de paginación en `/api/deudas` (queinhua 5,000 deudas → p95 29.33 s) | `app/api/ventas/route.ts:78-92`, `app/api/deudas/route.ts:27-84` |
| 15 | 🔴 **Añadir `restart: unless-stopped` al servicio `db`** y un `healthcheck` al servicio `app`. Sin reinicio automático de la base de datos no hay camino a 95 % de disponibilidad | `docker-compose.yml:45-60` |
| 16 | 🟠 **Externalizar el pool de conexiones** (`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`) y considerar pgBouncer para el objetivo de 10 usuarios simultáneos | `lib/db.ts:12-16` |
| 17 | 🟠 **Convertir la búsqueda de inventario a consulta en SQL con paginación**, o al menos memoizar `matchesQuery` y filtrar en el servidor. Hoy escala linealmente con el tamaño del catálogo | `lib/ui-table.tsx:8-12`, `app/api/gestion-inventario/route.ts:39-68` |
| 18 | 🟠 **Reagrupar las 24 consultas secuenciales de `/api/estadisticas` en una con CTEs**, y moverla a `lib/` siguiendo el patrón existente | `app/api/estadisticas/route.ts` |
| 19 | 🟠 **Asegurar la ejecución continua del respaldo**: crontab o unidad systemd en el host, o un servicio que no dependa de que alguien levante Docker. Hay 5 días consecutivos sin respaldo en la evidencia | `docker-compose.yml:90` |
| 20 | 🟡 **Ejecutar y documentar una prueba de restauración real** con RTO/RPO medidos | `scripts/restore-db.sh` |

### 4.4 Alto — Usabilidad y documentación

| # | Acción | Ubicación |
|---|---|---|
| 21 | 🔴 **Elevar todo el texto por debajo de 14 px.** El caso de mayor impacto es `lib/ui-table.tsx` (10 declaraciones en 13.1 px), porque afecta a **todas** las tablas de 3 pantallas. Un cambio de `0.82rem` → `0.875rem` resuelve de una vez el mayor bloque | `lib/ui-table.tsx:49-111`, y 294 declaraciones más |
| 22 | 🔴 **Crear un logo real** (archivo de imagen + favicon + `app/icon.*`) y renderizarlo en pantalla principal. Hoy no existe ningún archivo de logo en el repositorio | `public/`, `app/layout.tsx`, `components/StaffShell.tsx:112-122` |
| 23 | 🔴 **Implementar el módulo de ayuda en línea.** 0 % de cobertura contra 80 % exigido; el trabajo más grande es contextual (13 vistas), el menor es un botón `?` con enlace a un destino real | 13 páginas de `app/` |
| 24 | 🔴 **Escribir el manual de usuario** (0 % contra 100 % exigido en 2.3) y **publicarlo como PDF descargable** (11.2). Ambos requisitos se resuelven con un solo entregable | — |
| 25 | 🟠 **Corregir la paleta**: sustituir los 27 hexadecimales y 145 `rgba()` fuera de la paleta por tokens de Tailwind, empezando por las paletas de estado de `app/ordenes/page.tsx:88-95` y `app/deudas/page.tsx:103-113`. Evaluar si 6 familias pueden reducirse a 3 | 8 archivos |
| 26 | 🟠 **Sustituir los 7 emojis** por iconos del sistema, que ya son 100 % monocromáticos | `usuarios/page.tsx:551,618,646,943`, `dashboard/page.tsx:153`, `InventarioView.tsx:768`, `VentaToastListener.tsx:77` |
| 27 | 🟠 **Añadir sección de troubleshooting** al README (3 fallos de arranque previsibles sin documentar) y **documentar la migración faltante** | `README.md` |
| 28 | 🟠 **Externalizar las constantes de configuración**: `SMTP_HOST`/`SMTP_PORT` (hoy `gmail` está fijo en código), los 11 rate limits, las 7 expiraciones y `MAX_DUENOS` | `lib/mailer.ts:34`, `lib/roles.ts:16`, etc. |

### 4.5 Medio — Cobertura funcional y evidencia

| # | Acción | Ubicación |
|---|---|---|
| 29 | 🔴 **Implementar importación y exportación de inventario en `.xlsx`.** Ninguna de las dos mitades existe; la exportación actual es de reportes | — |
| 30 | 🟠 **Implementar o retirar el requisito 14.2.** Hoy no hay app móvil ni PWA, pero el requisito lo pide | — |
| 31 | 🟠 **Realizar las mediciones faltantes**: carga de vistas (Core Web Vitals), 10 usuarios concurrentes con sesiones distintas, tiempo de búsqueda, y disponibilidad mensual. Varios requisitos no son verificables por falta de instrumentación, no por fallo del producto | `carga.js`, `medidor.ps1` |
| 32 | 🟠 **Añadir soporte de navegadores verificable**: `browserslist` en `package.json` y una prueba e2e con Playwright sobre Chrome, Firefox y Edge | `package.json`, CI |
| 33 | 🟡 **Realizar la encuesta de usabilidad** que hoy no existe (7.2 y 2.1 dependen de ella) | — |
| 34 | 🟡 **Extraer subcomponentes** de los 8 archivos de UI que superan las 850 líneas | `app/deudas/page.tsx` (1,896) |
| 35 | 🟡 **Corregir la cadena en inglés** de `app/reportes/page.tsx:256` y unificar el dialecto (hoy conviven voseo y tuteo para el mismo mensaje) | `app/reportes/page.tsx:256`, `proveedores/page.tsx:84` vs `deudas/page.tsx:677` |
| 36 | 🟡 **Actualizar el README desactualizado**: «Next.js 14» → 15.5, «Middleware Edge/Web Crypto» → runtime Node.js, y añadir la página `/bodega` y el rol BODEGUERO | `README.md:168,326,303-316` |

---

## 5. Anexo — Resumen tabular

| # | Requisito | Criterio de medición | Resultado medido | Veredicto |
|---|---|---|---|:---:|
| 1.1 | Tipografía ≥ 14 px | 100 % pantallas | 304/478 declaraciones (63.6 %) bajo 14 px; mínimo 10.4 px | ❌ |
| 1.2 | Paleta máx. 3 colores | 100 % vistas | 6 familias + 27 hex + 145 `rgba()` fuera de paleta | ❌ |
| 1.3 | Logo en pantalla principal | 100 % revisiones | No existe ningún archivo de logo; solo texto a 11.5 px | ❌ |
| 2.1 | Novatos ≤ 120 % del tiempo de expertos | Comparar tiempos | Sin estudio de tiempos | ⚪ |
| 2.2 | Reduce ≥ 30 % vs. proceso manual | Comparación de tiempos | Sin línea base manual ni digital | ⚪ |
| 2.3 | Manual cubre 100 % de funcionalidades | Revisión de cobertura | 0/40 = 0 % con guía de uso (19/40 = 47.5 % mencionadas) | ❌ |
| 3.1 | Carga de vistas ≤ 3 s | 90 % pruebas ≤ 3 s | p95 20.11 s con volumen real; sin medición de vistas | ❌ |
| 3.2 | ≥ 10 usuarios simultáneos | 95 % con 5 sesiones sin errores | 50 clientes con 1 sola sesión; pool `max`=10 sin configurar | ⚪ |
| 3.3 | Búsqueda inventario ≤ 2 s | 90 % búsquedas ≤ 2 s | Nunca medida; filtrado íntegro en el navegador | ⚪ |
| 4.1 | Documentación técnica y de usuario | Revisión de manuales | Manual de usuario inexistente; técnica de desarrollo excelente | ⚠️ |
| 4.2 | Configuración sin modificar código | Pruebas de configuración | 6 de 12 operaciones comunes requieren editar código | ❌ |
| 4.3 | Procedimiento de instalación documentado | Prueba siguiendo manual | Docker completo; credenciales contradictorias, sin migraciones, sin troubleshooting | ⚠️ |
| 5.1 | Windows 10+ | Pruebas en Windows | Docker lo permite; sin job de CI en Windows | ⚠️ |
| 5.2 | Linux Ubuntu 20.04+ | Pruebas en Linux | CI en `ubuntu-latest` (24.04); 20.04 sin probar | ⚠️ |
| 5.3 | Chrome, Firefox, Edge | Pruebas funcionales | Sin `browserslist`, sin e2e, solo jsdom | ⚪ |
| 6.1 | Autenticación usuario/contraseña | Acceso autorizado/bloqueado | bcrypt+JWT+2FA+rate limit sólidos; contraseña ≥ 6 chars, JWT no revocable | ⚠️ |
| 6.2 | Datos sensibles cifrados en BD | Inspección del algoritmo | Cero cifrado; solo hashing de contraseñas; NIT y teléfonos en texto plano | ❌ |
| 6.3 | Logs de accesos y cambios | Revisión de auditoría | Accesos: completo ✅. Cambios: 31 rutas sin logging; sin tabla de auditoría | ⚠️ |
| 7.1 | 100 % en español | Todas pantallas/mensajes | 1 cadena en inglés (`reportes/page.tsx:256`); 34/34 `toLocale` con `es-GT` | ✅ |
| 7.2 | Lenguaje claro y comprensible | ≥ 90 % entienden (encuesta) | 0 artefactos de encuesta o test de usabilidad | ⚪ |
| 7.3 | Colores e iconos neutros | 100 % elementos | 23/23 iconos monocromáticos ✅; 7 emojis multicolor; paleta fuera de norma | ⚠️ |
| 8.1 | Facturas con datos legales | 100 % con campos obligatorios | Sin emisor, sin IVA/IGV, sin moneda, sin serie configurable | ❌ |
| 8.2 | Historial ventas: 5 años | 100 % registros almacenados | BD: sin purga ✅. Respaldos: **6 meses**, no 5 años | ⚠️ |
| 8.3 | Acceso financiero solo administradores | 100 % intentos bloqueados | **CRÍTICO**: `POST /api/facturacion` sin rol; deudas, pagos y precios abiertos a `EMPLEADO` | ❌ |
| 9.1 | Disponibilidad ≥ 95 % | Mensual ≥ 95 % | Health check existe; sin `restart` en `db`; sin monitoreo; sin cifra | ⚪ |
| 9.2 | Copias de seguridad diarias | 100 % días con ≥ 1 respaldo | `SCHEDULE=@daily` activo; **3 de 22 días** con respaldo en la evidencia | ⚠️ |
| 9.3 | Recuperación ≤ 30 min | 95 % pruebas ≤ 30 min | Procedimiento sólido; **nunca probado**; sin RTO/RPO | ⚪ |
| 10.1 | Importar/exportar .xlsx inventario | ≥ 80 % sin pérdida | Importación: inexistente. Exportación: de reportes, no inventario | ❌ |
| 10.2 | Conexión BD relacional | CRUD exitoso | `pg` Pool; 27 tablas, 27 PK, 36 FK; 33 archivos de pruebas | ✅ |
| 10.3 | Arquitectura modular | APIs/módulos desacoplados documentados | 24 dominios + 16 módulos `lib/`; UI monolítica; sin doc de API ni diagrama | ⚠️ |
| 11.1 | Módulo de ayuda en línea | ≥ 80 % vistas con botón | **0 de 13 = 0 %**; no existe el módulo | ❌ |
| 11.2 | Manual PDF descargable | Verificar existencia | Inexistente; los 2 PDF del repo sonmaterial académico | ❌ |
| 11.3 | Mensajes de error descriptivos | 90 % sin códigos técnicos | 41/47 = **87.2 %** (< 90 %); 6 fugas `String(error)` | ⚠️ |
| 13.1 | Desktop: arranque ≤ 40 s | Computadora en el negocio | Sin medición de arranque; único dato: «~2 min» en frío | ⚪ |
| 13.2 | Android ≥ 13 | Todos con dispositivo | Sin app móvil; sin dato del parque de dispositivos | ⚪ |
| 13.3 | Impresora de red/Bluetooth | Impresora disponible | `window.print()` + `@media print`; sin integración de red ni BT | ⚠️ |
| 14.1 | BD actualizada con productos vigentes | Todos productos al día | CRUD completo con transacción y unicidad de código | ✅ |
| 14.2 | App móvil para empleados | Accesible en Android | Sin app móvil, sin PWA, sin `manifest.json` | ❌ |

**Totales:** ✅ 3 · ⚠️ 12 · ❌ 14 · ⚪ 9 = **38 requisitos**
