# Pruebas de volumen (VOL-01 a VOL-04)

Proyecto Depósito San Miguel — Ingeniería de Software 2

Herramientas: **k6** (carga automática, rampa 20→50 VUs) y medición por
petición con `curl` (mismos dos números que se anotan en DevTools → Network:
tiempo total y tamaño del body, pero repetibles y promediados).

---

## 0. Resumen ejecutivo

| Hallazgo | Detalle |
|---|---|
| **1. `/api/deudas` no tiene paginación** | Con 5,000 deudas devuelve **3.94 MB en una sola respuesta**. El peso crece **exactamente lineal** (~784 bytes por deuda, 4x por cada duplicación). Confirmado. |
| **2. `/api/ventas` y `/api/historial-ventas` sí tienen paginación, pero es ineficaz** | El `LIMIT 50` existe, pero el `GROUP BY` + `json_agg` obliga a Postgres a agregar **las 20,180 ventas y sus 50,445 líneas de detalle antes de aplicar el límite**. El payload se mantiene plano (34 KB) pero el tiempo crece igual. |
| **3. El volumen de ventas por sí solo degrada el sistema de forma severa** | En producción, p(95) pasó de **1.12 s (180 ventas) a 20.11 s (20,180 ventas)** con la misma carga de 50 VUs. 18x peor, y el throughput cayó de 1,464 a 175 iteraciones. |
| **4. En desarrollo los números no sirven para medir** | `next dev` agrega ~380 ms fijos por petición. Con 180 ventas ya da p(95)=8.53 s, 10x el umbral de 800 ms, cuando la consulta real en Postgres toma **1.3 ms**. Todos los umbrales de este informe se verificaron además contra el build de producción. |

**Recomendación de prioridad:** paginar `/api/deudas` (es lo único que devuelve
todo el conjunto y ya produce 3.94 MB por request), y después corregir la
paginación de `/api/ventas` y `/api/historial-ventas` para que el `LIMIT` se
aplique **antes** de agregar.

---

## 1. Correcciones respecto al plan original

Tres cosas del plan no funcionaban tal cual y hubo que ajustarlas:

**a) El puerto es 3001, no 3000.** `docker-compose.yml:9` mapea `"3001:3000"`.
El script k6 apuntaba a `localhost:3000` y no habría conectado.

**b) `--network=host` no aplica en Docker Desktop (Windows).** El host
networking es una característica de Linux. El comando equivalente en Windows es
montar el script y usar `host.docker.internal`:

```bash
docker run --rm -i -v "${PWD}:/work" -w /work grafana/k6 run /work/carga.js
```

**c) Sembrar 20,000 ventas con el bloque `DO` de `init/01_schema.sql` es
inviable.** Ese bloque es un loop procedural PL/pgSQL que hace
`SELECT ... ORDER BY random() LIMIT 1` en cada iteración (~12 statements por
venta). A 20,000 ventas son ~240,000 statements, y como vive en
`docker-entrypoint-initdb.d` el arranque de Postgres se queda esperando
(`docker compose up` parece colgado varios minutos). Además modificaría un
archivo versionado del repo por un motivo que es solo de pruebas.

Se usó una versión **set-based** equivalente (`INSERT ... SELECT ...
generate_series`), que tarda **33 segundos**, no toca ningún archivo del repo,
no bloquea el arranque y es reversible. Script: `carga.js` (k6) y
`seed_20k_ventas.sql` (semilla, en la sección de entregables).

---

## 2. Metodología y su premisa

El plan original medía todo contra el Docker de desarrollo. **Eso no es
válido**, y no por poco:

| Medición | `next dev` | `next start` (prod) |
|---|---|---|
| `/api/health` (un `SELECT NOW()`, ~100 bytes de respuesta) | 340–660 ms | — |
| `/api/stats`, primer request (incluye compilación) | 3,436 ms | 139 ms |
| `/api/stats`, p50 en caliente | 398 ms | 43 ms |
| `/api/ventas`, p50 con 20,180 ventas | 2,283 ms | 817 ms |
| Consulta SQL de `/api/ventas` con 20,180 ventas (`EXPLAIN ANALYZE`) | 586 ms | 586 ms |

La fila más reveladora es la primera: `/api/health` solo ejecuta
`SELECT NOW(), current_database()` — una consulta que en Postgres es
sub-milisegundo — y aun así en `next dev` tarda 340–660 ms. **Ese es el piso
del servidor de desarrollo, y no baja de ~380 ms sin importar qué se pida.**

Con 20,180 ventas, la consulta de `/api/ventas` tarda 586 ms en Postgres y la
petición completa tarda 2,283 ms en desarrollo: incluso con el query caro, más
de la mitad del tiempo sigue siendo overhead del dev server. Medir con `next
dev` produce un p(95) de 8.53 s que no dice nada sobre el rendimiento real.

Por eso **todo el informe se reporta contra el build de producción**
(`docker-compose.prod.yml`), y los números de desarrollo se dejan solo como
referencia. Ambos se incluyen para que quede documentada la diferencia.

Se hizo una **pasada de calentamiento** antes de cada medición (punto 2 del
plan original): en `next dev` el primer request a una ruta la compila y costó
entre 1.7 s y 3.8 s. Sin ese calentamiento, el primer request falsea cualquier
medición.

---

## 3. VOL-01 / VOL-02 — Rampa 20 → 50 VUs (k6)

Login único en `setup()` reutilizando la cookie, para no chocar con el rate
limiter de `/api/login`. Rampa: 30 s a 20 VUs, 1 min a 50 VUs, 30 s a 0.

### Producción — comparación principal

| Métrica | VOL-01 (180 ventas) | VOL-02 (20,180 ventas) | Cambio |
|---|---|---|---|
| **p(95) `http_req_duration`** | **1.12 s** | **20.11 s** | **18x peor** |
| p(99) | 1.75 s | 22.95 s | 13x peor |
| p(95) `/api/ventas` | 1.50 s | 22.61 s | 15x peor |
| p(95) `/api/stats` | 930 ms | 9.14 s | 10x peor |
| p(95) `/api/deudas` | 898 ms | 8.44 s | 9x peor |
| Iteraciones completadas | 1,464 | 175 | **8.4x menos** |
| Throughput | 12.1 iter/s | 1.3 iter/s | 9x menos |
| Datos transferidos | 55 MB | 6.4 MB | — |
| `http_req_failed` | 0.00% | 0.00% | — |
| Checks OK | 4,392/4,392 | 537/537 | — |

> **El umbral de 800 ms se incumple en ambos casos**, y no por datos: con solo
> 180 ventas p(95) ya es 1.12 s. Con 20,180 ventas es 20.11 s. El sistema
> **nunca cumple el objetivo de 800 ms bajo 50 VUs**, y con volumen real se
> aleja 25x del objetivo.

### Desarrollo (`next dev`) — solo como referencia

| Métrica | VOL-01 (180) | VOL-02 (20,180) |
|---|---|---|
| p(95) `http_req_duration` | 8.53 s | 22.58 s |
| Iteraciones | 199 | 92 |
| `http_req_failed` | 0.00% | 0.00% |

Como se ve, en desarrollo la diferencia entre 180 y 20,180 ventas se ve
*menor* (2.6x) que en producción (18x), porque el ruido del dev server
(8.53 s de base) aplasta la señal. Medir solo en desarrollo habría dado una
conclusión equivocada.

---

## 4. VOL-03 — Tiempo y peso por pantalla con 20,000 ventas

Un usuario, build de producción, p50 de 5 peticiones tras calentamiento.

| Pantalla | Endpoint | p50 | p95 | Peso | Peso @180 ventas |
|---|---|---|---|---|---|
| Dashboard | `/api/stats` | 43 ms | 43 ms | 0.1 KB | 0.1 KB |
| Ventas | `/api/ventas` | 817 ms | 912 ms | **34.1 KB** | 35.5 KB |
| Historial | `/api/historial-ventas` | 1,146 ms | 1,264 ms | **39.1 KB** | 41.0 KB |
| Reportes | `/api/estadisticas` | 216 ms | 263 ms | 6.7 KB | 5.2 KB |
| Deudas | `/api/deudas` | 31 ms | 34 ms | 0 KB | 0 KB |

**El peso de las respuestas de Ventas e Historial no creció** (34 KB y 39 KB,
igual que con 180 ventas) porque ambas están paginadas. **Pero el tiempo sí
creció 5-6x** (379 ms → 817 ms, y 367 ms → 1,146 ms). Ese aumento no viene de
transferir más datos: viene de que la consulta procesa toda la tabla. Ver
sección 5.

---

## 5. Por qué `/api/ventas` es lenta aunque devuelva 50 registros

Este es el hallazgo técnico más importante. `app/api/ventas/route.ts:52-93`
aplica `LIMIT $1 OFFSET $2`, así que **la paginación existe**. Pero el plan de
ejecución real muestra que no sirve de nada:

```
 Limit                              (actual rows=50)
   -> Sort  (top-N heapsort)        (actual rows=50)
     -> GroupAggregate              (actual rows=20180)   <-- agrega TODO
       -> Incremental Sort          (actual rows=50445)   <-- 50,445 líneas
         -> Nested Loop Left Join   (actual rows=50445)
           -> Index Scan using venta_pkey  (actual rows=20180)  <-- escaneo completo
 Planning Time: 17.678 ms
 Execution Time: 585.669 ms
```

Como el `json_agg(...)` está en el `SELECT` y hay un `GROUP BY v.id_venta`,
Postgres **no puede aplicar el `LIMIT` hasta terminar de agrupar todas las
ventas**. El plan recorre las 20,180 ventas y las 50,445 líneas de detalle
completa, y recién al final recorta a 50 filas. Además elige
`venta_pkey` en vez de `idx_venta_fecha` precisamente porque el orden no le
sirve de nada.

`/api/historial-ventas` (`app/api/historial-ventas/route.ts:40-93`) tiene el
mismo patrón, por eso se comporta igual.

`/api/stats` y `/api/estadisticas` sí son eficientes: solo agregaciones, sin
`json_agg` por fila.

---

## 6. VOL-04 — 5,000 deudas con 15,000 abonos

Aquí la hipótesis **queda confirmada** tal como se sospechaba.

Un usuario, producción, p50 de 9 peticiones.

| Deudas | p50 | min | max | Peso de la respuesta | KB por deuda |
|---|---|---|---|---|---|
| 0 | 19 ms | 13 ms | 60 ms | 0.0 KB | — |
| 625 | 91 ms | 70 ms | 139 ms | 490.0 KB | 0.80 |
| 1,250 | 286 ms | 164 ms | 370 ms | 984.0 KB | 0.79 |
| 2,500 | 323 ms | 242 ms | 680 ms | 1,969.1 KB | 0.79 |
| 5,000 | 611 ms | 473 ms | 852 ms | **3,939.4 KB** | 0.79 |

**El peso es exactamente lineal**: 490 → 984 → 1,969 → 3,939 KB. Cada
duplicación de deudas duplica el payload, ~784 bytes por deuda. El tiempo también
crece de forma sostenida (19 ms → 611 ms, 32x).

`app/api/deudas/route.ts:28-85` no tiene ningún `LIMIT`: trae **todas** las
deudas, y cada una trae anidados sus productos y **todos** sus abonos en un
`jsonb_agg`. Con 3 abonos por deuda la respuesta es 3.94 MB.

### Impacto en la prueba de carga

En la corrida de k6 con 50 VUs y 5,000 deudas, `/api/deudas` por sí solo
transfirió **248 MB**:

| Corrida | p(95) total | p(95) `/api/deudas` | Datos transferidos |
|---|---|---|---|
| 20,180 ventas, 0 deudas | 20.11 s | 8.44 s | 6.4 MB |
| 20,180 ventas, 5,000 deudas | **36.39 s** | **29.33 s** | **256 MB** |

O sea: sumar 5,000 deudas (además de las ventas) lleva el p(95) de 20.11 s a
36.39 s y multiplican por 40 el tráfico de red, sin agregar una sola venta.

### Descomposición del costo de `/api/deudas`

| Etapa | Costo (5,000 deudas) |
|---|---|
| Consulta SQL en Postgres (`EXPLAIN ANALYZE`) | 124 ms |
| Serialización JSON + transferencia de 3.94 MB | ~490 ms |
| **Total medido** | **611 ms** |

La consulta en sí es barata (el índice `idx_pago_deuda_id_deuda` la resuelve
bien). **El costo es la serialización y el envío de 3.94 MB.** Por eso el
problema no se arregla optimizando el SQL: hay que dejar de enviar todo.

---

## 7. Qué se descarta como culprits

- **Índices faltantes:** no es la causa. Los índices existen y se usan
  (`idx_venta_fecha`, `idx_detalle_venta_venta_producto`,
  `idx_pago_deuda_id_deuda`). El plan es lento por la estructura de la
  consulta, no por falta de índices.
- **Errores o timeouts:** `http_req_failed` = 0.00% y 100% de checks
  correctos en las cuatro corridas. El sistema degrada en latencia, no se
  rompe.
- **Cuello de botella del pool de conexiones:** el pool usa los valores por
  defecto de `pg` (lib/db.ts:12-16) y no se reportan errores de pool. Con 50
  VUs la saturación viene del tiempo de respuesta, no de agotar conexiones.

---

## 8. Métricas agregadas de k6 (producción, 50 VUs)

VOL-02 con 20,180 ventas y 0 deudas:

```
dur_ventas    avg=13.82s  med=13.5s   p(90)=21.61s  p(95)=22.61s  p(99)=24.16s  max=26.31s
dur_stats     avg= 3.98s  med= 3.48s  p(90)= 8.11s  p(95)= 9.14s  p(99)= 9.89s  max=10.06s
dur_deudas    avg= 3.49s  med= 2.97s  p(90)= 7.31s  p(95)= 8.44s  p(99)= 9.85s  max= 9.88s
http_req_duration  avg=7.08s  med=5.04s  p(95)=20.11s  p(99)=22.95s
http_req_failed    0.00% (0 de 538)
iterations         175   (1.31/s)
```

> Nota: `dur_deudas` da 8.44 s de p(95) **con cero deudas en la base**. Es la
> cola del servidor, no el costo de esa consulta. Una métrica que devuelve 0 KB
> no puede tardar 8.44 s por sí misma: sirve para recordar que bajo carga todo
> se encola detrás de `/api/ventas`.

---

## 9. Siguientes tickets sugeridos

1. **Paginación en `/api/deudas`** — el más urgente. Es la única ruta que
   devuelve el conjunto completo y ya genera 3.94 MB por petición. El mismo
   patrón `?page`/`?limit` que ya usa `/api/ventas` (máximo 100) sirve, y el
   componente `app/deudas/page.tsx:345` ya recibe el array completo hoy.
2. **Corregir la paginación de `/api/ventas` y `/api/historial-ventas`** — no
   alcanza con agregar `LIMIT`: hay que resolver primero las 50 filas de venta
   en una subconsulta/CTE y recién después unir `detalle_venta` para esas 50,
   de modo que el `json_agg` no agregue las 20,180.
3. **Definir un presupuesto de respuesta** — fijar un límite de peso por
   endpoint (por ejemplo 500 KB) y fallar la CI si se supera, para que esto no
   vuelva a pasar sin que nadie lo note.
4. **Correr estas pruebas contra el build de producción en CI** — un umbral
   medido sobre `next dev` no es un umbral: el ruido del dev server (~380 ms
   fijos) supera el presupuesto de 800 ms por sí solo.

---

## 10. Cómo reproducir

### Estado del entorno al terminar

El contenedor `app` quedó corriendo el **build de producción**. Para volver a
desarrollo:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml down app
docker compose up -d app
```

La base quedó con **20,180 ventas y 5,000 deudas** sembradas.

### Sembrar los datos de volumen

```bash
# 20,000 ventas (33 s). No toca init/01_schema.sql.
docker cp seed_20k_ventas.sql <container_db>:/tmp/seed.sql
docker exec <container_db> psql -U dsm_user -d deposito_san_miguel -v ON_ERROR_STOP=1 -f /tmp/seed.sql

# 5,000 deudas + 15,000 abonos (2.5 s)
docker exec <container_db> psql -U dsm_user -d deposito_san_miguel -c \
  "INSERT INTO deuda (nombre_deudor,monto_total,id_usuario) SELECT 'Deudor '||g,500,1 FROM generate_series(1,5000) g"
docker exec <container_db> psql -U dsm_user -d deposito_san_miguel -c \
  "INSERT INTO pago_deuda (id_deuda,monto,id_usuario) SELECT d.id_deuda,50,1 FROM deuda d, generate_series(1,3) WHERE d.nombre_deudor LIKE 'Deudor %'"
```

### Cargar

```bash
# Producción (recomendado para medir)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build app

# Smoke test: verifica login y las 3 rutas en 10 s
docker run --rm -i -v "${PWD}:/work" -w /work -e SMOKE=1 grafana/k6 run /work/carga.js

# Prueba completa: rampa 20 -> 50 VUs
docker run --rm -i -v "${PWD}:/work" -w /work grafana/k6 run /work/carga.js
```

### Medición manual con DevTools (para los screenshots del informe)

1. Loguearse como **Dueño** (`dueno@tienda.com` / `password123`).
2. Abrir **DevTools → Network**, activar **Disable cache**.
3. **Recargar cada pantalla una vez** (descartar el request de compilación).
4. Entrar a la pantalla y capturar el request principal:

| Pantalla | Request a capturar | Campo en la columna "Size" |
|---|---|---|
| Dashboard | `/api/stats` | Size |
| Ventas | `/api/ventas` | Size |
| Deudas | `/api/deudas` | Size (esperado: ~3.9 MB) |
| Historial | `/api/historial-ventas` | Size |
| Reportes | `/api/estadisticas` | Size |

5. Anotar la columna **Time** y **Size**, y hacer un screenshot de cada uno.

Los mismos números en texto salen del script de medición por `curl` usado para
este informe; los valores de las secciones 4 y 6 son la referencia contra la
cual comparar los screenshots.

---

## 11. Entregables

| Archivo | Qué es |
|---|---|
| `carga.js` | Script k6. Rampa 20→50 VUs, login único reutilizando cookie, métricas por endpoint (`dur_ventas`, `dur_deudas`, `dur_stats`) y contadores de bytes por ruta. Soporta `SMOKE=1` para una prueba rápida. Puerto 3001 y `host.docker.internal` ya corregidos. |
| `seed_20k_ventas.sql` | Semilla set-based de 20,000 ventas con su detalle, kardex, pagos y facturas. 33 s, re-ejecutable, con sección comentada de rollback. |
| `medidor.ps1` / `medidor-prod.ps1` | Medición de tiempo y peso por endpoint (p50/p95 de N peticiones). Reemplaza la anotación manual de DevTools cuando se quieren números repetibles. |
