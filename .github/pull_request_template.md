## 📋 Descripción del cambio

> Explica brevemente qué hiciste y por qué.

<!-- Ej: Se agregó validación de stock negativo al registrar entradas de inventario -->

## 🔧 Tipo de cambio

Marca con una `x` lo que aplique:

- [x] 🐛 Corrección de bug
- [ ] ✨ Nueva funcionalidad
- [ ] ♻️  Refactor (sin cambios funcionales)
- [ ] 📄 Documentación
- [ ] 🎨 Estilos / UI
- [ ] 🗄️  Base de datos / migraciones
- [x] 🔒 Seguridad
- [x] 🧪 Tests
- [x] ⚙️  Configuración / DevOps

## 🧪 ¿Cómo probaste los cambios?

> Describe los pasos para reproducir o verificar que tu cambio funciona.

1. Hacer login como colaborador
2. ingresar a ventas y hacer una venta al azar
3. ir a facturacion y emitir una factura

## 📸 Capturas de pantalla (si aplica)

> Si el cambio afecta la UI, agrega capturas antes/después.

| Antes | Después |
|-------|---------|
|       |         |

## ✅ Checklist antes de pedir review

- [x] Probé el flujo completo localmente con `docker compose up`
- [ ] No dejé `console.log` de depuración
- [ ] Los cambios en BD tienen su respectivo `ALTER` o migración documentada
- [x] Si cambié una API, actualicé o revisé el comportamiento esperado
- [x] El código no rompe los flujos existentes (login, inventario, ventas)

## 🔗 Issue relacionado (si aplica)

Cierra #<!-- número del issue -->

## 👥 Reviewer sugerido

@<!-- usuario de GitHub -->

## 📝 Notas adicionales para el reviewer

> Cualquier contexto extra, decisiones de diseño, o cosas a tener ojo.