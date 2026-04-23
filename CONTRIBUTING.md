# 🤝 Guía de contribución — Tienda San Miguel

## Estrategia de ramas

Este repo usa un flujo de **dos ramas permanentes**:

| Rama | Propósito | Acceso |
|------|-----------|--------|
| `main` | **Producción** — código estable, deployado | Solo merge desde `develop` (por el responsable del repo) |
| `develop` | **Integración** — staging y QA antes de subir a prod | PRs abiertos por cualquier colaborador |

### Flujo de trabajo

```
main (producción)
  ↑
  │  merge controlado (solo líder / dueño del repo)
  │
develop (staging / QA)
  ↑
  │  Pull Request con formulario completo
  │
feature/tu-cambio   fix/bug-descripcion   chore/tarea
```

---

## Cómo trabajar en este proyecto

### 1. Clonar y configurar

```bash
git clone <url-del-repo>
cd <nombre-del-repo>
git checkout develop          # siempre parte desde develop
```

### 2. Crear tu rama

Usa los prefijos establecidos para que sea claro qué hace cada rama:

| Prefijo | Cuándo usarlo | Ejemplo |
|---------|--------------|---------|
| `feature/` | Nueva funcionalidad | `feature/registro-proveedores` |
| `fix/` | Corrección de bug | `fix/stock-negativo-entrada` |
| `chore/` | Mantenimiento, configs | `chore/actualizar-dependencias` |
| `docs/` | Solo documentación | `docs/api-endpoints` |
| `refactor/` | Refactor sin cambios funcionales | `refactor/auth-middleware` |

```bash
git checkout -b feature/mi-nueva-funcionalidad develop
```

### 3. Desarrollar y commitear

Escribe commits descriptivos:

```bash
# ✅ Bien
git commit -m "feat: agregar validación de stock mínimo en entrada de inventario"
git commit -m "fix: corregir cálculo de subtotal cuando precio es 0"

# ❌ Mal
git commit -m "cambios"
git commit -m "fix"
git commit -m "asdsad"
```

**Prefijos de commit recomendados** (Conventional Commits):
- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `refactor:` refactor
- `docs:` documentación
- `chore:` mantenimiento
- `style:` estilos / formato
- `test:` tests

### 4. Abrir Pull Request

1. Sube tu rama: `git push origin feature/mi-nueva-funcionalidad`
2. Ve a GitHub → **New Pull Request**
3. **Base**: `develop` | **Compare**: tu rama ← importante
4. Llena **completamente** el formulario que aparece automáticamente
5. Asigna al menos un reviewer

> ⚠️ Los PRs con el template incompleto serán bloqueados automáticamente por el CI.
> ⚠️ Los PRs apuntando a `main` directamente también serán rechazados por el CI.

### 5. Review y merge

- El reviewer deja comentarios o aprueba
- Se requiere **al menos 1 aprobación** para hacer merge a `develop`
- Una vez en `develop`, el responsable del proyecto decide cuándo hacer release a `main`

---

## Branch Protection (configurar en GitHub)

El responsable del repo debe activar estas reglas en **Settings → Branches**:

### Para `main`:
- ✅ Require a pull request before merging
- ✅ Require approvals: **2**
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass (seleccionar: `Proteger rama main`)
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings
- ✅ Restrict who can push to matching branches (solo el responsable)

### Para `develop`:
- ✅ Require a pull request before merging
- ✅ Require approvals: **1**
- ✅ Require status checks to pass (seleccionar: `Validar PR Template`)
- ✅ Require branches to be up to date before merging

---

## Reglas generales

- ❌ No hacer push directo a `main` ni a `develop`
- ❌ No hacer merge de tu propio PR sin review
- ❌ No dejar ramas huérfanas — elimínalas después del merge
- ✅ Si tu rama lleva más de 3 días sin actividad, sincronízala con `develop`:
  ```bash
  git fetch origin
  git rebase origin/develop
  ```

---

## Ambiente de desarrollo

```bash
# Levantar todo
docker compose up --build

# Reiniciar sin reconstruir
docker compose up

# Ver logs
docker compose logs -f app

# Bajar contenedores
docker compose down
```

URLs locales:
- App: http://localhost:3001
- pgAdmin: http://localhost:5050

---

## Contacto

¿Dudas sobre el flujo? Habla con el líder del equipo antes de abrir el PR.