# 🏪 Tienda San Miguel
### Sistema de Gestión de Inventario y Ventas

Proyecto desarrollado para la clase de Ingeniería de Software 1.  
Sistema web para apoyar la gestión de inventario, ventas y pedidos de un negocio mayorista.

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

# 2. Configura las variables de entorno (ver sección "Configuración")
cp .env.example .env
# ...completa .env

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

## 🔐 Usuarios de prueba

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

1. Copia `.env.example` a `.env` y completa:
   ```
   GMAIL_USER=tu_correo@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ```
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
| Autenticación | JWT (jsonwebtoken + bcryptjs) |
| ORM / Queries | pg (node-postgres) |
| Contenedores | Docker + Docker Compose |
| Admin BD | pgAdmin 4 |

---

## 📁 Estructura del proyecto

```
├── app/
│   ├── api/
│   │   ├── health/        → Verificar conexión a BD
│   │   ├── login/         → Autenticación + 2FA (paso 1)
│   │   ├── login/verificar-codigo → 2FA (paso 2)
│   │   ├── productos/     → Listado de productos
│   │   └── sesion/        → Sesión activa del usuario
│   ├── dashboard/         → Panel principal (post-login)
│   ├── inventario/        → Vista de inventario por rol
│   ├── login/             → Página de inicio de sesión
│   └── page.tsx           → Página de inicio
├── lib/
│   ├── auth.ts            → Utilidades JWT y hashing
│   ├── mailer.ts          → Envío de códigos por Gmail SMTP
│   └── verificacion.ts    → Códigos 2FA (generar, hashear, pre-token)
├── init/
│   ├── 01_schema.sql      → Schema base + datos de prueba (corre automático en Docker)
│   └── 02_..–05_..sql     → Migraciones de sprints (ordenas, deudas, factura, 2FA)
├── docker-compose.yml
└── Dockerfile
```

---

## 🔗 URLs disponibles

| URL | Descripción |
|---|---|
| http://localhost:3001 | Aplicación principal |
| http://localhost:3001/login | Inicio de sesión |
| http://localhost:3001/gestion-inventario | Gestión de inventario / bodegas (solo dueño) |
| http://localhost:3001/inventario | Alta/edición de productos (solo dueño) |
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

## 📋 Funcionalidades implementadas (Sprint 1)

- [x] **RF1** — Autenticación de usuarios con JWT
- [x] **RF3** — Consulta de inventario diferenciada por rol
- [x] Conexión a PostgreSQL desde Next.js
- [x] Schema completo de base de datos con datos de prueba
- [x] Sesión persistente con cookies HttpOnly
- [x] **2FA** — Verificación por código de correo para colaboradores

## 🚧 En desarrollo (próximos sprints)

- [x] **RF2** — Registro de nuevos productos
- [x] **RF4** — Registro de entrada de inventario (Kardex)
- [x] **RF6** — Gestión de precios (supervisor)
- [x] **RF7** — Registro y gestión de clientes
- [x] **RF9** — Generación de facturas

---

## ⚠️ Notas de desarrollo

- Las contraseñas en `init/01_schema.sql` son hashes bcrypt solo para desarrollo
- El `JWT_SECRET` en `.env` debe cambiarse en producción
- La carpeta `init/` corre **solo la primera vez** que se crea el volumen de Postgres.
  Si agregas una migración nueva y ya tienes la BD corriendo, aplícala manualmente:
  ```bash
  docker exec -i proyecto-ing-software1-db-1 psql -U dsm_user -d deposito_san_miguel \
    < init/05_codigo_verficacion.sql
  ```
  (o reinicia todo de cero con `docker compose down -v && docker compose up --build` — **borra todos los datos**)  