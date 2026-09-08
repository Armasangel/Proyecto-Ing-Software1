# Registro de Decisiones Arquitectónicas (RDA/ADR)
### Tienda San Miguel — Sistema de Gestión de Inventario y Ventas

Este documento registra las decisiones de arquitectura tomadas durante el desarrollo del proyecto, siguiendo el formato estándar de ADR (Architecture Decision Record): **Contexto → Decisión → Alternativas consideradas → Consecuencias**.

Cada decisión se numera de forma secuencial (ADR-001, ADR-002, ...) y no se borra aunque quede obsoleta; si una decisión reemplaza a otra, se marca como tal.

---

## ADR-001: Uso de Next.js (App Router) con TypeScript como framework principal

**Estado:** Aceptado

**Contexto:**
El equipo necesitaba un framework que permitiera construir tanto el frontend (paneles de dueño y staff) como el backend (API REST) dentro de un mismo proyecto, reduciendo la complejidad de mantener dos repositorios/despliegues separados, dado el tamaño del equipo (5 personas) y el tiempo del curso.

**Decisión:**
Se adoptó **Next.js 14 con App Router** y **TypeScript** para todo el proyecto: las páginas (`app/*/page.tsx`) y las rutas de API (`app/api/*/route.ts`) viven en el mismo codebase.

**Alternativas consideradas:**
- Frontend en React (Vite) + backend separado en Express/Node.
- Backend en un framework distinto (Django/Flask) con frontend desacoplado.

**Consecuencias:**
- (+) Un solo repositorio, un solo despliegue (un contenedor Docker).
- (+) Tipado compartido entre cliente y servidor gracias a TypeScript.
- (−) Menor flexibilidad si en el futuro se quisiera escalar frontend y backend por separado.

---

## ADR-002: PostgreSQL como base de datos, con SQL directo (sin ORM)

**Estado:** Aceptado

**Contexto:**
Se necesitaba una base de datos relacional robusta para modelar entidades con relaciones claras (ventas, detalle de venta, inventario, clientes, proveedores, deudas, usuarios).

**Decisión:**
Se usó **PostgreSQL 16** con el esquema definido explícitamente en `init/01_schema.sql`, y acceso mediante el driver `pg` con consultas SQL escritas a mano (ver `lib/db.ts` y las rutas en `app/api/*`), en vez de un ORM (Prisma, TypeORM, etc.).

**Alternativas consideradas:**
- Usar un ORM como Prisma para generar el cliente de acceso a datos.
- Usar una base de datos NoSQL (MongoDB).

**Consecuencias:**
- (+) Control total sobre las consultas (importante para reportes y agregaciones como `historial-ventas` con `json_agg`).
- (+) Sin dependencia de una capa de abstracción adicional que aprender como equipo.
- (−) Más código repetitivo (queries manuales) y mayor riesgo de errores de SQL si no se revisa con cuidado.

---

## ADR-003: Autenticación propia con JWT + verificación en dos pasos (2FA por correo)

**Estado:** Aceptado

**Contexto:**
El sistema maneja información sensible (ventas, deudas, datos de clientes) y distingue entre roles (dueño vs. staff), por lo que se requería un mecanismo de autenticación seguro sin depender de un proveedor externo de identidad.

**Decisión:**
Se implementó autenticación basada en **JWT** (`jsonwebtoken`, `lib/server-auth.ts`) firmada con `JWT_SECRET`, combinada con **2FA por correo** usando `nodemailer` sobre SMTP de Gmail (`lib/mailer.ts`) y contraseñas hasheadas con `bcryptjs`. Además existe rate limiting sobre los intentos de login (`lib/login-rate-limit.ts`).

**Alternativas consideradas:**
- Delegar autenticación a un proveedor externo (Auth0, Firebase Auth, NextAuth).
- Autenticación simple con sesión en cookie sin 2FA.

**Consecuencias:**
- (+) No hay dependencia de servicios de terceros de pago.
- (+) Capa extra de seguridad (2FA) para el rol dueño/staff.
- (−) El equipo es responsable de mantener la lógica de seguridad (expiración de tokens, rate limiting, manejo de secretos) en vez de delegarla.

---

## ADR-004: Separación de roles (dueño / staff) mediante middleware y hooks dedicados

**Estado:** Aceptado

**Contexto:**
No todos los usuarios deben ver ni modificar la misma información: el dueño necesita reportes y estadísticas, mientras que el staff opera el día a día (ventas, inventario).

**Decisión:**
Se definieron roles en `lib/roles.ts`, protegidos en `middleware.ts` y consumidos mediante hooks separados (`useDuenoSession`, `useStaffSession`) y un shell de layout común (`components/StaffShell.tsx`). Cada endpoint valida el rol server-side (ver `isDuenoTipo` en las rutas de API) además de la restricción en el cliente.

**Alternativas consideradas:**
- Un solo tipo de usuario con permisos a nivel de "feature flags".
- Roles definidos solo en el frontend, sin validación en el backend.

**Consecuencias:**
- (+) Seguridad reforzada: la restricción de rol se valida en servidor, no solo se oculta en la UI.
- (+) Reutilización de un layout común (`StaffShell`) para todas las pantallas internas.
- (−) Requiere mantener la validación de rol duplicada (cliente + servidor) sincronizada.

---

## ADR-005: Despliegue mediante Docker Compose (app + PostgreSQL + pgAdmin + backups)

**Estado:** Aceptado

**Contexto:**
El equipo necesitaba que cualquier integrante pudiera levantar el proyecto completo (app + base de datos) sin configurar manualmente PostgreSQL en su máquina, y de forma reproducible para el curso.

**Decisión:**
Se definió `docker-compose.yml` con servicios: `app` (Next.js), `postgres:16-alpine`, `pgadmin4` (administración visual de la BD) y `postgres-backup-local` (respaldos automáticos), además de scripts auxiliares (`scripts/backup-db.sh`, `scripts/restore-db.sh`, `scripts/dev-reset.sh`).

**Alternativas consideradas:**
- Pedir a cada integrante instalar PostgreSQL localmente.
- Usar una base de datos en la nube compartida (Supabase/Neon) desde el día uno.

**Consecuencias:**
- (+) Entorno idéntico para todo el equipo (`docker compose up --build`).
- (+) Respaldos automáticos de la base de datos sin esfuerzo manual.
- (−) Requiere Docker Desktop instalado; onboarding un poco más pesado para quien no lo tenga.

---

## ADR-006: Suite de pruebas con Jest + React Testing Library + MSW

**Estado:** Aceptado

**Contexto:**
Con varios integrantes trabajando en paralelo sobre el mismo repositorio, se necesitaba una forma de evitar regresiones al fusionar ramas (`develop`, `feature/*`, `fix/*`).

**Decisión:**
Se adoptó **Jest 29** como test runner, **React Testing Library** para componentes/páginas, y **MSW v1** para mockear llamadas HTTP en pruebas de hooks y componentes (ver `__tests__/mocks/handlers.ts`). Existen pruebas unitarias (`lib`, `api`) y de integración (`__tests__/integration`, p. ej. `ventas-stock-race.test.ts`, `login-2fa.test.ts`).

**Alternativas consideradas:**
- Vitest en vez de Jest.
- Solo pruebas manuales, sin suite automatizada.

**Consecuencias:**
- (+) Los flujos críticos (login con 2FA, condiciones de carrera en ventas/stock, facturación) están cubiertos por pruebas.
- (+) CI (`.github/workflows/ci.yml`) puede correr la suite automáticamente en cada PR.
- (−) Mantener mocks (MSW) actualizados cuando cambian los endpoints es trabajo adicional.

---

### Cómo agregar una nueva decisión
1. Copiar el formato de una entrada existente.
2. Numerar consecutivamente (ADR-00X).
3. Si la decisión reemplaza una anterior, marcar la anterior como **"Reemplazada por ADR-00X"** en su campo Estado, en vez de borrarla.
