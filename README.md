# 🏪 Tienda San Miguel
### Sistema de Gestión de Inventario y Ventas

Proyecto desarrollado para la clase de Ingeniería de Software 1.  
Sistema web para apoyar la gestión de inventario, ventas, deudas y pedidos de un negocio mayorista.

---

## 👥 Equipo

| Nombre | Carné |
|---|---|
| Angel Antonio Armas Hernández | 24714 |
| Esteban Alejandro Montenegro Berganza | 241262 |
| Esteban Emilio Cumatz Quiná | 2449 |
| Héctor Javier Dardón Sandoval | 241587 |
| Jose Carlos Ovando Asencio | 24701 |

---

## 🚀 Cómo ejecutar el proyecto

### Requisitos previos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo

### Pasos

```bash
# 1. Clona el repositorio
git clone <url-del-repo>
cd <nombre-del-repo>

# 2. Configura las variables de entorno
cp .env.example .env
# ...completa JWT_SECRET, GMAIL_USER y GMAIL_APP_PASSWORD

# 3. Levanta todo con Docker (primera vez tarda ~2 min)
docker compose up --build

# 4. Para detenerlo
docker compose down
```

> ⚠️ Si cambias `.env`, reinicia la app para que tome las variables:
> ```bash
> docker compose up -d --force-recreate app
> ```

Eso es todo. Docker levanta automáticamente:
- La app Next.js en **http://localhost:3001**
- PostgreSQL con la base de datos ya inicializada
- pgAdmin en **http://localhost:5050**

> Si ya corriste el proyecto antes y solo quieres reiniciarlo sin reconstruir:
> ```bash
> docker compose up
> ```

Para correr la suite de tests (Jest 29 + React Testing Library + MSW v1) dentro de Docker:

```bash
# Una vez (levanta la BD si hace falta)
docker compose run --rm test

# Si la app ya está corriendo
docker compose exec app npm test
```

Si cambiaste dependencias, reconstruye la imagen: `docker compose build --no-cache app`.

> Si necesitás resetear todo desde cero (borrar la base de datos, las
> imágenes locales, y reconstruir), en vez de hacer `down -v` + borrar
> imágenes a mano + `up --build` por separado, hay un solo comando:
> ```bash
> ./scripts/dev-reset.sh
> ```
> Pide confirmación antes de borrar nada. `./backups` no se toca — los
> respaldos sobreviven al reset.

---

## 🔐 Configuración (`.env`)

Copia `.env.example` a `.env` y completa estos valores:

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Secreto para firmar los tokens (mínimo 32 caracteres). Cámbialo en producción. |
| `GMAIL_USER` | Correo Gmail que envía los códigos de verificación 2FA. |
| `GMAIL_APP_PASSWORD` | Contraseña de aplicación de Gmail (16 caracteres en grupos de 4). |
| `LOG_LEVEL` | Nivel mínimo de logs de pino. Vacío = automático (`development`→`debug`, `production`→`info`, `test`→silent). Si se define, tiene prioridad. |

`DATABASE_URL` **no** va en `.env`: está fija en `docker-compose.yml`.

---

## 🔑 Usuarios de prueba

La base de datos se inicializa con estos usuarios. Contraseña para todos: **`password123`**

| Correo | Rol | Login |
|---|---|---|
| `dueno@tienda.com` | DUEÑO | Entra directo (sin código) |
| `armasangel193@gmail.com` | EMPLEADO | **2FA:** pide un código que llega a ese correo |

> Cambia `armasangel193@gmail.com` por el correo real al que quieras que lleguen
> los códigos en `init/01_schema.sql` (y también actualiza el correo en la BD si
> ya la tenías corriendo).

---

## 📧 Verificación en 2 pasos (2FA por correo)

Solo los **colaboradores (EMPLEADO)** pasan por el segundo paso: después de usuario
y contraseña, el sistema genera un código de 6 dígitos (vigente 5 min, máx. 5 intentos),
lo manda por correo, y el login solo se completa con el código correcto. El **dueño
(DUEÑO)** entra directo.

El envío usa **Gmail SMTP** (gratis, con contraseña de aplicación). Para configurarlo:

1. Copia `.env.example` a `.env` y completa `GMAIL_USER` y `GMAIL_APP_PASSWORD`.
2. `GMAIL_APP_PASSWORD` NO es la contraseña de tu cuenta. Se genera así:
   - Activa la verificación en 2 pasos de Google en tu cuenta.
   - Entra a https://myaccount.google.com/apppasswords
   - Crea una contraseña de aplicación para "Correo" y pégala en `.env`.
3. Reinicia la app para que tome las variables: `docker compose up -d --force-recreate app`

> En desarrollo los códigos se ven en la consola del contenedor (`docker logs -f <app>`)
> si Gmail aún no está configurado.

---

## 🔑 Recuperación de contraseña ("olvidé mi contraseña")

Válida para **todos** los tipos de usuario (DUEÑO, EMPLEADO y BODEGUERO).
Desde el login hay un enlace "¿Olvidaste tu contraseña?" que lleva a `/recuperar`,
una página pública en 3 pasos:

1. **Correo** → `POST /api/recuperar/solicitar`. Genera un código de 6 dígitos
   (también hasheado en la BD, vigente 5 min, máx. 5 intentos) y lo manda por
   Gmail. La respuesta es **siempre la misma** para no revelar qué correos están
   registrados; el detalle de si la cuenta existe queda solo en los logs.
2. **Código** → `POST /api/recuperar/verificar`. Si es correcto devuelve un
   `reset_token` (JWT de propósito propio, expira en 10 min) y marca el código
   como usado.
3. **Contraseña nueva** → `POST /api/recuperar/cambiar`. Actualiza el hash de la
   contraseña, invalida los códigos de recuperación y de 2FA pendientes del
   usuario y limpia el bloqueo por intentos fallidos para que entre de inmediato.

Protecciones: rate limiting por IP **y** por correo en la solicitud (evita spam de
correos y enumerar cuentas) y reutiliza el mismo transporte de Gmail del 2FA
(requiere `GMAIL_USER` / `GMAIL_APP_PASSWORD`).

Si tu base ya estaba inicializada, corré la migración una vez:

```bash
psql -U dsm_user -d deposito_san_miguel -f migrations/05_recuperacion_contrasena.sql
```

En bases nuevas la tabla `codigo_recuperacion` ya viene en `init/01_schema.sql`.

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) |
| Base de datos | PostgreSQL 16 |
| Autenticación | JWT (jsonwebtoken + bcryptjs) + 2FA por correo |
| ORM / Queries | pg (node-postgres) |
| Logs | pino (NDJSON) + pino-pretty en desarrollo |
| Tests | Jest 29 + React Testing Library + MSW |
| Contenedores | Docker + Docker Compose |
| Admin BD | pgAdmin 4 |

---

## 📊 Logs

La app usa **pino** para loguear eventos de negocio, errores y la entrada de cada
request HTTP. Los logs salen a **stdout** en formato **NDJSON** (una línea JSON por
evento), por lo que son fáciles de consumir con herramientas como `jq`, Loki o
CloudWatch.

**Niveles usados en el proyecto**:

| Nivel  | Para qué se usa                                               |
|--------|---------------------------------------------------------------|
| `error`| Errores de servidor (`apiError`, fallos de DB, SMTP, …)       |
| `warn` | Rate limits, logins fallidos, stock insuficiente, tokens vencidos |
| `info` | Eventos de negocio: ventas, órdenes, pagos, logins exitosos, requests |
| `debug`| Detalle de operaciones (p. ej. envío de código 2FA, requests autenticados) |

**Ver logs en vivo** (todas las apps):

```bash
docker compose logs -f app
docker compose logs -f --no-log-prefix app | npm run logs      # con colores y formato legible
```

### Persistencia: archivo rotado en un volumen Docker

Además del stdout, la app puede escribir **NDJSON a un archivo rotado por
tamaño** para tener histórico (grep, respaldos, forense). En Docker se monta
un volumen (`logs_data`) sobre `/app/logs`:

| Variable | Default | Descripción |
|---|---|---|
| `LOG_FILE_DIR` | *(vacío = off)* | Directorio del archivo rotado. `app` en compose lo fija a `/app/logs` (volumen `logs_data`) |
| `LOG_FILE_MAX_SIZE` | `50M` | Tamaño máximo por archivo antes de rotar |
| `LOG_FILE_KEEP` | `5` | Archivos rotados a conservar (sin contar el activo); los viejos se comprimen con gzip |

El logger escribe a stdout **y** al archivo (multistream): `docker compose
logs` y `pm2 logs` siguen funcionando igual. El volumen sobrevive a
`docker compose up --build` (solo se pierde con `docker compose down -v`).

Los archivos dentro del contenedor:

```bash
docker compose exec app sh -c 'ls -lh /app/logs/'                    # ver archivos
docker compose exec app sh -c 'tail -n 100 /app/logs/server.log | ./node_modules/.bin/pino-pretty'
```

### Ayudante de mantenimiento (`scripts/logs.sh`)

Envuelve los comandos más usados sin depender de node en la máquina host:

```bash
scripts/logs.sh                # seguir logs en vivo (formateados)
scripts/logs.sh file           # últimas 200 líneas del archivo vigente
scripts/logs.sh file -f        # seguir el archivo vigente en vivo
scripts/logs.sh all            # archivo vigente + rotados (descomprime .gz)
scripts/logs.sh errors         # solo errores (level 50)
scripts/logs.sh warnings       # warns y errores (level 40/50)
scripts/logs.sh grep "api/ventas"   # filtrar por módulo / palabra
scripts/logs.sh list           # listar archivos rotados
```

Con `docker compose -f docker-compose.yml -f docker-compose.prod.yml` los mismos comandos funcionan contra la imagen de producción (pino-pretty es dependencia de runtime).

### Flujo para descubrir la causa de un error

1. **Dónde mirar primero** (en vivo):
   ```bash
   scripts/logs.sh live
   ```
2. **Si pasó hace un rato** (histórico): buscá por ruta/módulo y nivel:
   ```bash
   scripts/logs.sh errors
   scripts/logs.sh grep '"msg":"Error al consultar ventas'
   ```
3. **Correlacionar la petición con su error**: por `time` y `module`. El editor
   de logs es NDJSON, así que cualquier patrón se puede grepear, p. ej. el ID de
   una orden fallida: `scripts/logs.sh grep '"id_orden": 12'`.
4. **Los errores de servidor siempre vienen con stack real** (nunca se manda al
   cliente): el `{ err }` serializa `type`, `message` y `stack` en la misma línea
   (`log.error({ err }, "…")` del `apiError`).
5. Si no alcanza el histórico del contenedor: resto de nivel y buscás —
   `LOG_LEVEL=debug` suma detalle (p. ej. el request autenticado con `id_usuario`).
6. **En el servidor (PM2, sin Docker)**: `pm2 logs tienda-san-miguel --lines 50 --nostream`
   y `pm2 install pm2-logrotate` para retención/rotación equivalentes.

> Los secretos (`password`, `token`, cookies, JWT, Gmail) se **redactan** antes
> de escribirse; no van a aparecer ni en el archivo ni en stdout.

### Nivel mínimo (`LOG_LEVEL`)

- Vacío (recomendado): automático por entorno (`development`→`debug`, `production`→`info`, `test`→silent).
- Definido: siempre tiene prioridad. Valores válidos: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.

### Redacción de datos sensibles

Por defecto pino **redacta** (oculta) campos como `password`, `token`,
`authorization`, cookies y secretos antes de escribirlos en consola, así que no se
cuelan en los logs. Ver `REDACT_PATHS` en `lib/logger.ts`.

### Cómo loguear en el código

Todas las rutas/librerías usan el logger central de `lib/logger.ts`:

```ts
import { getLogger } from "@/lib/logger";

const log = getLogger("api/ventas");

// Siempre: objeto de contexto PRIMERO, mensaje después.
log.info({ id_venta: 5, total: 120.5 }, "Venta registrada");
log.warn({ id_producto: 3, disponible: 0 }, "Stock insuficiente");
log.error({ err }, "Error al consultar ventas [GET]");
```

**Cobertura**: el `middleware` (runtime Node.js) loggea la entrada de cada request
HTTP de páginas protegidas y rutas `/api/*`; los handlers loguean el desenlace
(errores y eventos de negocio).

---

## 👥 Roles y módulos

El sistema diferencia dos roles con permisos distintos:

| Módulo | Ruta | Dueño | Colaborador |
|---|---|---|---|
| Dashboard (KPIs) | `/dashboard` | ✅ | ✅ |
| Ventas | `/ventas` | — | ✅ |
| Inventario / bodegas / kardex | `/inventario` | ✅ | — |
| Catálogo de productos | `/catalogo` | ✅ | — |
| Productos (maestro) | `/productos` | ✅ | — |
| Facturación | `/facturacion` | ✅ | ✅ |
| Reportes / Estadísticas | `/reportes` | ✅ | ✅ |
| Órdenes de compra | `/ordenes` | ✅ | ✅ |
| Historial de ventas | `/historial-ventas` | ✅ | — |
| Deudas | `/deudas` | ✅ | — |
| Proveedores | `/proveedores` | ✅ | — |
| Usuarios | `/usuarios` | ✅ | — |

---

## 📋 Funcionalidades implementadas

### Autenticación y seguridad
- [x] Login con JWT y sesión persistente en cookie HttpOnly
- [x] **2FA** por código de correo para colaboradores
- [x] Rate-limit de intentos de login (tabla compartida en Postgres)
- [x] Middleware Edge con verificación de firma del token (Web Crypto API)

### Inventario y catálogo
- [x] Productos: alta, edición, baja y precios (unitario / mayoreo)
- [x] Categorías, marcas, bodegas y proveedores
- [x] Entradas de inventario (Kardex), ajustes y transferencias entre bodegas
- [x] Control de stock mínimo con alertas

### Ventas y clientes
- [x] Registro de ventas con descuento transaccional de stock (concurrencia segura)
- [x] Facturación con número correlativo atómico (secuencia de Postgres)
- [x] Historial de ventas con filtros y paginación
- [x] Gestión de clientes (minorista / mayorista) con límite de deuda y bloqueo automático

### Deudas y órdenes
- [x] Deudas por productos o monto libre, con alertas y bloqueo por límite
- [x] Órdenes de compra con estados y detalle

### Reportes
- [x] Dashboard con KPIs (productos, ventas, pendientes, proveedores, clientes bloqueados)
- [x] Reportes analíticos por periodo: ingresos, ticket promedio, top productos/clientes,
      actividad por hora, ingresos por categoría y top deudores

---

## 📁 Estructura del proyecto

```
├── app/
│   ├── api/                  → Rutas del backend (REST)
│   │   ├── login/            → Autenticación + 2FA (paso 1)
│   │   ├── login/verificar-codigo → 2FA (paso 2)
│   │   ├── productos/        → Productos
│   │   ├── ventas/           → Ventas (+ recientes)
│   │   ├── facturacion/      → Facturas
│   │   ├── deudas/           → Deudas
│   │   ├── ordenes/          → Órdenes de compra
│   │   ├── gestion-inventario/ → Kardex, ajustes, transferencias, stock mínimo
│   │   ├── estadisticas/     → Reportes analíticos
│   │   ├── clientes/ bodegas/ categorias/ marcas/ proveedores/ precios/
│   │   ├── usuarios/ stats/ sesion/ historial-ventas/ health/ logout/
│   ├── dashboard/            → Panel principal con KPIs
│   ├── inventario/           → Stock, entradas, transferencias, ajustes y bodegas
│   ├── catalogo/             → Catálogo de productos (solo dueño)
│   ├── productos/            → Catálogo maestro (precios y estados)
│   ├── ventas/               → Registro de ventas (colaborador)
│   ├── facturacion/          → Emisión de facturas por venta
│   ├── historial-ventas/     → Consulta y filtros de ventas
│   ├── deudas/               → Control de deudas y deudores
│   ├── ordenes/              → Órdenes de compra
│   ├── proveedores/          → Gestión de proveedores
│   ├── reportes/             → Estadísticas y reportes del negocio
│   ├── usuarios/             → Gestión de usuarios y roles
│   ├── login/                → Página de inicio de sesión
│   ├── error.tsx             → Pantalla de error de render (sección)
│   ├── global-error.tsx      → Pantalla de error del layout raíz
│   ├── not-found.tsx         → 404
│   └── page.tsx              → Redirige a /login
├── components/               → StaffShell, Icon, ErrorScreen, VentaToastListener
├── hooks/                    → useDuenoSession, useStaffSession
├── lib/                      → auth, db, roles, mailer, verificacion, api-error, logger, client-logger, ...
├── init/
│   └── 01_schema.sql         → Schema + índices + datos de prueba (corre automático)
├── __tests__/                → Tests (unit, API, integración, páginas, hooks, components)
├── scripts/
│   ├── backup-db.sh          → Respaldo manual puntual de la BD
│   ├── restore-db.sh         → Restaurar la BD desde un respaldo
│   ├── logs.sh               → Ayudante de consulta de logs
│   └── dev-reset.sh          → Reiniciar todo el entorno (down -v + rebuild) en un paso
├── .github/workflows/
│   ├── ci.yml                → Lint, typecheck, tests y build en cada PR
│   ├── validate-pr.yml       → Revisión del template de PR
│   └── health-check.yml      → Monitoreo de disponibilidad (cada 5 min)
├── docker-compose.yml
└── Dockerfile
```

---

## 🔗 URLs disponibles

| URL | Descripción |
|---|---|
| http://localhost:3001 | Aplicación principal (redirige a /login) |
| http://localhost:3001/login | Inicio de sesión |
| http://localhost:3001/dashboard | Dashboard con KPIs |
| http://localhost:3001/api/health | Verificar conexión a PostgreSQL |
| http://localhost:5050 | pgAdmin (admin@dsm.com / admin123) |

---

## 💾 Respaldo y recuperación de la base de datos

El proyecto incluye un sistema de respaldo automático para PostgreSQL, además
de scripts para respaldos y restauraciones manuales.

### Respaldos automáticos

El servicio `db_backup` (imagen [`prodrigestivill/postgres-backup-local`](https://github.com/prodrigestivill/docker-postgres-backup-local))
corre junto a los demás con `docker compose up` y genera un dump comprimido
(`.sql.gz`) de la base de datos todos los días, sin que tengas que hacer nada.

Los respaldos se guardan en `./backups/` (fuera de los volúmenes de Docker,
así que sobreviven a un `docker compose down -v`), organizados en:

```
backups/
├── daily/     → últimos 7 días
├── weekly/    → últimas 4 semanas
└── monthly/   → últimos 6 meses
```

Los más viejos se van rotando (borrando) automáticamente según esa
retención. Podés ajustar la frecuencia (`SCHEDULE`) o cuánto se guarda
(`BACKUP_KEEP_DAYS/WEEKS/MONTHS`) en el servicio `db_backup` de
`docker-compose.yml`.

> ⚠️ Estos respaldos automáticos **no están cifrados** — quedan en texto
> plano (comprimido) dentro de `./backups/`. Es una decisión consciente:
> cifrarlos ahí adentro requeriría meterle mano a la rotación interna de la
> imagen `db_backup` y es fácil terminar rompiéndola. Mientras esa carpeta
> se quede en tu máquina (está en `.gitignore`, no se sube al repo) el
> riesgo es bajo. Si necesitás sacar uno de esos respaldos de la máquina
> (mandarlo a otro lado, subirlo a algún servicio externo), primero pasalo
> por un respaldo manual cifrado — ver abajo.

### Respaldo manual (cifrado)

Para tomar un respaldo puntual (por ejemplo, antes de una migración o un
cambio riesgoso al schema, o antes de sacar un respaldo de tu máquina):

```bash
./scripts/backup-db.sh
```

Esto crea un archivo en `./backups/manual/`. Si configuraste
`BACKUP_ENCRYPTION_KEY` en tu `.env` (ver `.env.example` — generá una buena
con `openssl rand -base64 32`), el archivo queda **cifrado con OpenSSL
(AES-256)** como `deposito_san_miguel_<fecha>.sql.gz.enc`. Si no la
configuraste, el script te avisa y lo deja sin cifrar (`.sql.gz`).

### Restaurar un respaldo

⚠️ Esto sobrescribe la base de datos actual — pide confirmación antes de
continuar.

```bash
./scripts/restore-db.sh ./backups/manual/deposito_san_miguel_20260830_120000.sql.gz.enc
# también funciona con los automáticos (sin cifrar), p. ej.:
./scripts/restore-db.sh ./backups/daily/deposito_san_miguel-YYYY-MM-DD.sql.gz
```

Antes de tocar la base de datos, el script valida que el archivo sea
realmente un respaldo — por su extensión **y** revisando los primeros
bytes del archivo (la firma de gzip o de OpenSSL, según corresponda). No
alcanza con renombrar cualquier archivo a `.sql.gz` para que lo acepte. Si
el respaldo está cifrado, necesita la misma `BACKUP_ENCRYPTION_KEY` que se
usó para generarlo — sin eso no hay forma de descifrarlo.

> En Windows, corré estos scripts desde Git Bash o WSL (no PowerShell/CMD).
> Si un script no tiene permiso de ejecución, corré antes `chmod +x scripts/*.sh`.

---

## 🗄️ Conectar pgAdmin a la base de datos

1. Entra a http://localhost:5050
2. Login: `admin@dsm.com` / `admin123`
3. Click derecho en "Servers" → Register → Server
4. En la pestaña **General**: nombre `DSM`
5. En la pestaña **Connection**:
   - Host: `db`
   - Port: `5432`
   - Database: `deposito_san_miguel`
   - Username: `dsm_user`
   - Password: `dsm_password`

---
## 🔒 API privada

Toda la API bajo `/api/*` es de uso **interno**: la consume únicamente el
frontend de este mismo proyecto, corriendo en el mismo dominio. No está
pensada para que otros sistemas o terceros la consuman directamente.

### ¿Qué significa "privada" en la práctica?

- No hay documentación pública tipo OpenAPI/Swagger, ni un portal de desarrolladores.
- No se emiten API keys ni tokens de acceso para consumidores externos.
- Las respuestas dependen de la sesión del navegador (cookie httpOnly con
  JWT), no de un esquema de autenticación pensado para servidor-a-servidor.
- Desde DEV-127, todas las rutas de la app llevan headers de seguridad
  estándar (ver `🔐 Headers de seguridad`): `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y
  `Strict-Transport-Security`, además de `poweredByHeader: false` para no
  anunciar la tecnología del backend.

### Consecuencias de mantenerla privada

- ✅ Superficie de ataque más chica: nadie fuera del propio frontend necesita
  credenciales ni conoce los endpoints.
- ✅ Se puede cambiar la forma de las respuestas (renombrar campos, cambiar
  códigos de error) sin avisarle a "consumidores externos", porque no existen.
- ⚠️ Si en algún momento se necesita exponerla a terceros (una app móvil
  separada, un socio, un webhook saliente), **no basta con quitar un flag**:
  hay que diseñar autenticación por token (API key u OAuth), definir un
  contrato estable (versión de API, esquema documentado) y endurecer el
  rate limiting pensando en tráfico no confiable, no solo en usuarios logueados.

### Cómo se maneja

- No agregues documentación pública (Swagger/OpenAPI) para estas rutas
  mientras sigan siendo privadas — generarla manda la señal equivocada de
  que son consumibles externamente.
- Cualquier endpoint nuevo bajo `/api/` hereda los headers de seguridad
  automáticamente (aplican por patrón `/:path*` en `next.config.mjs`),
  no hace falta repetirlos ruta por ruta.
- Si tu tarea implica exponer una ruta a un tercero real, coordínalo
  primero con el equipo — ver la sección correspondiente en `CONTRIBUTING.md`.

---

## 🔐 Headers de seguridad

Se configuran una sola vez en `next.config.mjs` y se aplican a **todas** las
rutas con el patrón `/:path*` (páginas y API):

| Header | Valor | Para qué |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Evita que el navegador interprete una respuesta con otro tipo de contenido |
| `X-Frame-Options` | `DENY` | Impide que la app se incruste en un `<iframe>` (clickjacking) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | No filtra URLs internas a terceros |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | La app no usa esas capacidades: se niegan por defecto |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | **Solo en producción** (ver abajo) |

Además `poweredByHeader: false` elimina el `X-Powered-By: Next.js`, que de
otro modo anuncia la tecnología del backend.

**Por qué cubren también las páginas y no solo la API:** el clickjacking se
ejerce contra el HTML que renderiza el navegador, que es justamente donde hay
sesión iniciada (ventas, deudas, usuarios). Proteger solo `/api/*` dejaba sin
cubrir la superficie que más importa.

**HSTS es condicional a producción.** Los navegadores ignoran este header si
llega por HTTP simple (RFC 6797), así que mandarlo en desarrollo no rompe
nada, pero sí dejaría el `max-age` cacheado si alguien expone la app por HTTPS
desde local. En producción lo sirven Nginx + Certbot.

> `includeSubDomains` obliga a **todos** los subdominios de
> `tienda-san-miguel.xyz` a servir HTTPS. Es correcto si el dominio es
> exclusivo de la app. Si algún día hay un subdominio sin TLS, el navegador lo
> bloquea y revertirlo es difícil: sacalo de la constante `HSTS` en
> `next.config.mjs`.

**Para verificar que efectivamente se sirven** (el test unitario prueba que
están configurados, esto prueba que llegan al navegador):

```bash
curl -sI https://tienda-san-miguel.xyz/login | grep -iE "x-frame|x-content|referrer|permissions|strict-transport"
```

---

## 🛡️ Errores en el navegador

Cuando una página revienta durante el render, el usuario ve una pantalla de
error con opción de reintentar en vez de una pantalla en blanco. Hay tres
fronteras de App Router:

| Archivo | Cuándo se activa |
|---|---|
| `app/error.tsx` | Crash de render en cualquier página o ruta. No cubre el root layout. |
| `app/global-error.tsx` | Crash en el **root layout**. Reemplaza el layout, así que re-declara `<html>`, `<head>` y las fuentes. |
| `app/not-found.tsx` | 404. |

Las tres comparten la UI de `components/ErrorScreen.tsx`.

### Correlacionar un error del navegador con el log del servidor

Este es el punto clave: Next.js genera un `digest` para cada error de servidor
y lo muestra en la pantalla. Ese código es el puente entre lo que ve el usuario
y la línea que **sí** quedó registrada con stack real.

1. El usuario (o vos) lee el **Código de seguimiento** en la pantalla.
2. Lo buscás en el log del servidor:

   ```bash
   # producción (PM2)
   pm2 logs tienda-san-miguel --lines 100 --nostream | grep <código>

   # desarrollo (Docker)
   scripts/logs.sh grep '<código>'
   ```

Sin este paso, un error de cliente es un código que nadie puede investigar. Con
él, es una búsqueda.

> En **producción** los logs no están en archivo: el servidor corre con PM2, sin
> `LOG_FILE_DIR`, así que se leen con `pm2 logs`. Los archivos rotados con
> `scripts/logs.sh` son del entorno de desarrollo con Docker.

### Agregar una página no requiere nada

`app/error.tsx` vive en el segmento raíz, así que **toda** página nueva queda
cubierta automáticamente. No hay que registrar nada al crearla.

---

## 📡 Monitoreo de disponibilidad

`.github/workflows/health-check.yml` corre cada 5 minutos contra el sitio en
producción y falla si algo no está como debería. Cuando falla, GitHub manda un
email de alerta: nadie tiene que estar mirando.

Verifica tres cosas:

| Check | Qué detecta |
|---|---|
| `/api/health` + `"status":"ok"` en el body | App caída **o** PostgreSQL inalcanzable (el endpoint devuelve 500 si la base falla) |
| `/login` responde 200 | Build roto, assets 404, errores de render en el server |
| Headers de seguridad en `/login` y `/api/health` | Que los headers de `next.config.mjs` lleguen de verdad a la respuesta real |

### Configuración (una sola vez)

En GitHub: **Settings → Secrets and variables → Actions → Variables → New variable**

| Nombre | Valor |
|---|---|
| `APP_URL` | `https://tienda-san-miguel.xyz` |

Se puede correr a mano desde la pestaña **Actions → Monitoreo de Disponibilidad
→ Run workflow**, que es la forma rápida de probar la configuración.

### Limitaciones que hay que conocer

- **Solo corre desde `main`.** Los workflows con `schedule` no se ejecutan desde
  ramas de feature ni desde `develop`: GitHub los corre únicamente desde la
  rama por defecto. El monitoreo arranca cuando el workflow se mergea a `main`.
- **La latencia real no es de 5 minutos.** GitHub encola los cron y en hora
  pico puede demorar entre 5 y 30 minutos. No es un pager: es una red de
  seguridad contra caídas largas.
- **Se desactiva solo** si el repo pasa 60 días sin actividad.
- Detecta la caída **total** del servidor, porque el check viene de internet.
  Un cron corriendo en el mismo servidor no podría avisar que el host se apagó.

---

## ⚠️ Notas de desarrollo

- Las contraseñas en `init/01_schema.sql` son hashes bcrypt solo para desarrollo
- El `JWT_SECRET` en `.env` debe cambiarse en producción
- El `middleware` corre en **Node.js runtime** (Next.js ≥ 15.5). Si algún día se
  baja de versión, habría que volver a Web Crypto / Edge.
- El schema está consolidado en un **solo archivo** (`init/01_schema.sql`): tablas,
  secuencias, vista, índices y datos de prueba. Para desplegar a un servidor nuevo
  basta con ejecutarlo una sola vez sobre una base vacía.
- La carpeta `init/` corre **solo la primera vez** que se crea el volumen de Postgres.
  Si tu base de datos ya existe (volumen `postgres_data`), para aplicar el schema
  desde cero tienes que recrear el volumen:
  ```bash
  docker compose down -v && docker compose up --build   # ⚠️ borra todos los datos
  ```
- Los tests de integración (`__tests__/integration/`) requieren la base de datos;
  se ejecutan con el servicio `test` de Docker (`docker compose run --rm test`).