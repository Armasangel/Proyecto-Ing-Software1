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

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) |
| Base de datos | PostgreSQL 16 |
| Autenticación | JWT (jsonwebtoken + bcryptjs) + 2FA por correo |
| ORM / Queries | pg (node-postgres) |
| Tests | Jest 29 + React Testing Library + MSW |
| Contenedores | Docker + Docker Compose |
| Admin BD | pgAdmin 4 |

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
│   └── page.tsx              → Redirige a /login
├── components/               → StaffShell, Icon, VentaToastListener
├── hooks/                    → useDuenoSession, useStaffSession
├── lib/                      → auth, db, roles, mailer, verificacion, api-error, ...
├── init/
│   └── 01_schema.sql         → Schema + índices + datos de prueba (corre automático)
├── __tests__/                → Tests (unit, API, integración, páginas, hooks)
├── scripts/
│   ├── backup-db.sh          → Respaldo manual puntual de la BD
│   ├── restore-db.sh         → Restaurar la BD desde un respaldo
│   └── dev-reset.sh          → Reiniciar todo el entorno (down -v + rebuild) en un paso
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

## ⚠️ Notas de desarrollo

- Las contraseñas en `init/01_schema.sql` son hashes bcrypt solo para desarrollo
- El `JWT_SECRET` en `.env` debe cambiarse en producción
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