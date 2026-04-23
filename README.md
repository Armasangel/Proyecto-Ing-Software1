# 🏪 Tienda San Miguel
### Sistema de Gestión de Inventario y Ventas

Proyecto desarrollado para la clase de Ingeniería de Software 1.  
Sistema web para apoyar la gestión de inventario, ventas y pedidos de un negocio mayorista.

---

## 👥 Eqlskdjldjflskfkldsjfuipo

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

# 2. Levanta todo con Docker (primera vez tarda ~2 min)
docker compose up --build

# 3. Para detenerlo
docker compose down
```

Eso es todo. Docker levanta automáticamente:
- La app Next.js en **http://localhost:3000**
- PostgreSQL con la base de datos ya inicializada
- pgAdmin en **http://localhost:5050**

> Si ya corriste el proyecto antes y solo quieres reiniciarlo sin reconstruir:
> ```bash
> docker compose up
> ```

---

## 🔐 Usuarios de prueba

La base de datos se inicializa con estos usuarios. Contraseña para todos: **`password123`**

| Correo | Rol | Acceso |
|---|---|---|
| `dueno@tienda.com` | DUEÑO | Vista completa (precios unitario y mayoreo, stock) |
| `empleado@tienda.com` | EMPLEADO | Vista de inventario y operaciones |
| `maria@gmail.com` | COMPRADOR | Vista limitada del catálogo |

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
│   │   ├── login/         → Autenticación
│   │   ├── productos/     → Listado de productos
│   │   └── sesion/        → Sesión activa del usuario
│   ├── dashboard/         → Panel principal (post-login)
│   ├── inventario/        → Vista de inventario por rol
│   ├── login/             → Página de inicio de sesión
│   └── page.tsx           → Página de inicio
├── lib/
│   └── auth.ts            → Utilidades JWT y hashing
├── init/
│   └── 01_schema.sql      → Schema + datos de prueba (corre automático en Docker)
├── docker-compose.yml
└── Dockerfile
```

---

## 🔗 URLs disponibles

| URL | Descripción |
|---|---|
| http://localhost:3000 | Aplicación principal |
| http://localhost:3000/login | Inicio de sesión |
| http://localhost:3000/inventario | Inventario (requiere login) |
| http://localhost:3000/api/health | Verificar conexión a PostgreSQL |
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

## 🚧 En desarrollo (próximos sprints)

- [ ] **RF2** — Registro de nuevos productos
- [ ] **RF4** — Registro de entrada de inventario (Kardex)
- [ ] **RF6** — Gestión de precios (supervisor)
- [ ] **RF7** — Registro y gestión de clientes
- [ ] **RF9** — Generación de facturas
- [ ] **RF11** — Registro de métodos de pago

---

## ⚠️ Notas de desarrollo

- Las contraseñas en `init/01_schema.sql` son hashes bcrypt solo para desarrollo
- El `JWT_SECRET` en `docker-compose.yml` debe cambiarse en producción
- La carpeta `init/` contiene el schema SQL que Docker ejecuta automáticamente al crear el contenedor por primera vez