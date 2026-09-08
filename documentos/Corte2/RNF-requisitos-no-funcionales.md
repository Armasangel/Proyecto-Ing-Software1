# Requisitos No Funcionales (RNF)
### Tienda San Miguel — Sistema de Gestión de Inventario y Ventas

Los requisitos no funcionales describen **cualidades** del sistema (cómo debe comportarse) en vez de funciones específicas (qué debe hacer). Se agrupan por categoría; cada uno tiene un ID (RNF-XX), descripción, y cómo se cumple actualmente en el sistema.

---

## 1. Seguridad

| ID | Requisito | Cómo se cumple actualmente |
|---|---|---|
| RNF-01 | El sistema debe autenticar a los usuarios antes de permitir acceso a cualquier panel interno. | JWT firmado con `JWT_SECRET`, validado en `middleware.ts` y `lib/server-auth.ts`. |
| RNF-02 | El acceso a funciones administrativas (reportes, estadísticas, usuarios) debe estar restringido al rol dueño. | Validación de rol server-side con `isDuenoTipo()` en cada endpoint de `app/api/*`, no solo en el cliente. |
| RNF-03 | El login debe protegerse contra ataques de fuerza bruta. | Rate limiting de intentos de login (`lib/login-rate-limit.ts`). |
| RNF-04 | El sistema debe verificar la identidad del usuario en un segundo factor. | 2FA por correo electrónico (código enviado vía `lib/mailer.ts`). |
| RNF-05 | Las contraseñas nunca deben almacenarse en texto plano. | Hasheo con `bcryptjs` antes de guardar en la tabla `usuario`. |

## 2. Rendimiento y escalabilidad

| ID | Requisito | Cómo se cumple actualmente |
|---|---|---|
| RNF-06 | Las consultas de historial/listados grandes no deben cargar todos los registros de una vez. | Paginación por `limit`/`offset` en historial de ventas, con tope máximo (`HISTORIAL_VENTAS_MAX_LIMIT = 200`). |
| RNF-07 | El sistema debe manejar correctamente condiciones de carrera al descontar stock en ventas concurrentes. | Cubierto explícitamente por prueba de integración `ventas-stock-race.test.ts`. |

## 3. Disponibilidad y confiabilidad

| ID | Requisito | Cómo se cumple actualmente |
|---|---|---|
| RNF-08 | Debe existir un mecanismo de respaldo periódico de la base de datos. | Servicio `postgres-backup-local` en `docker-compose.yml` + `scripts/backup-db.sh` / `restore-db.sh`. |
| RNF-09 | El entorno de desarrollo debe poder recrearse desde cero de forma confiable. | `scripts/dev-reset.sh` (con confirmación antes de borrar datos). |
| RNF-10 | El sistema debe exponer un endpoint de verificación de salud (health check). | `app/api/health` — usado por Docker/monitoreo para saber si la app está viva. |

## 4. Usabilidad

| ID | Requisito | Cómo se cumple actualmente |
|---|---|---|
| RNF-11 | La interfaz debe distinguir claramente entre el panel del dueño y el del staff. | Layout compartido `StaffShell.tsx` con navegación condicionada por rol. |
| RNF-12 | El usuario debe recibir alertas visuales inmediatas ante eventos importantes (ej. stock bajo). | Feature DEV-115: badge + toast de stock bajo, visible solo para el rol dueño. |
| RNF-13 | La interfaz debe mantener consistencia visual (colores, tipografía) entre todas las pantallas. | *(En revisión — ver DEV-84: actualmente cada página define sus propios colores en vez de reutilizar las variables de `globals.css`, lo que rompe la consistencia).* |

## 5. Mantenibilidad

| ID | Requisito | Cómo se cumple actualmente |
|---|---|---|
| RNF-14 | El código debe contar con pruebas automatizadas para los flujos críticos. | Suite Jest + RTL + MSW (`__tests__/`), incluyendo pruebas unitarias, de API y de integración. |
| RNF-15 | Las reglas de estilo de código deben aplicarse de forma automática. | `.eslintrc.json` + workflow de CI (`.github/workflows/ci.yml`, `validate-pr.yml`). |
| RNF-16 | Los cambios deben pasar por revisión antes de integrarse a `develop`/`main`. | Plantilla de PR (`.github/pull_request_template.md`) + workflow `validate-pr.yml`. |

## 6. Portabilidad

| ID | Requisito | Cómo se cumple actualmente |
|---|---|---|
| RNF-17 | El sistema debe poder ejecutarse igual en cualquier máquina del equipo, sin configuración manual de dependencias. | Todo el stack (app + BD + pgAdmin) se levanta con `docker compose up --build`. |

---

### Notas para completar el documento
- Ajustar/agregar RNF si el curso pide una plantilla específica (algunos cursos piden clasificación ISO 25010: eficiencia, compatibilidad, usabilidad, fiabilidad, seguridad, mantenibilidad, portabilidad — la tabla de arriba ya sigue esa lógica).
- RNF-13 queda marcado como "en revisión" a propósito: una vez resuelto DEV-84, actualizar esa fila para reflejar la solución final.
