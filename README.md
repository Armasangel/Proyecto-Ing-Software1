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