// app/page.tsx  — Página de inicio (placeholder)
export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ color: "#1a6b3a" }}>🛒 Tienda San Miguel</h1>
      <p>Sistema de Gestión de Inventario y Ventas</p>

      <hr style={{ margin: "1.5rem 0" }} />

      <h2>Verificar conexión a la base de datos</h2>
      <p>
        Visita{" "}
        <a href="/api/health" style={{ color: "#1a6b3a" }}>
          /api/health
        </a>{" "}
        para confirmar que la app está conectada a PostgreSQL.
      </p>

      <h2>Módulos del sistema</h2>
      <ul>
        <li>📦 Inventario por bodega</li>
        <li>🧾 Ventas y facturación</li>
        <li>📋 Catálogo en línea</li>
        <li>💳 Gestión de pagos</li>
        <li>📊 Reportes</li>
      </ul>
    </main>
  );
}