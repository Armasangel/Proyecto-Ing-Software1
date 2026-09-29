# Medidor para el build de produccion (next start).
# En prod el login marca la cookie como Secure, asi que curl sobre http:// no
# la reenvia; se manda el token JWT en el header Cookie a mano.
param(
  [int]$N = 5,
  [string]$Base = "http://localhost:3001",
  [string]$TokFile = "C:\Users\Angel\AppData\Local\Temp\opencode\vol\prod-token.txt"
)

$tok = (Get-Content $TokFile -Raw).Trim()

$rutas = [ordered]@{
  "Dashboard  /api/stats"            = "/api/stats"
  "Ventas     /api/ventas"           = "/api/ventas"
  "Deudas     /api/deudas"           = "/api/deudas"
  "Historial  /api/historial-ventas" = "/api/historial-ventas"
  "Reportes   /api/estadisticas"     = "/api/estadisticas"
}

"{0,-34} {1,8} {2,12} {3,12} {4,10} {5,10}" -f "ENDPOINT","STATUS","p50 ms","p95 ms","max ms","bytes"
"-" * 92

foreach ($kv in $rutas.GetEnumerator()) {
  $times = @(); $size = 0; $status = 0
  for ($i = 0; $i -lt $N; $i++) {
    $out = & curl.exe -s -o NUL -H "Cookie: auth_token=$tok" `
      -w "%{http_code}|%{time_total}|%{size_download}" "$Base$($kv.Value)"
    $parts = $out -split "\|"
    $status = [int]$parts[0]
    $times += ([double]$parts[1] * 1000)
    $size  = [int64][double]$parts[2]
  }
  $s = $times | Sort-Object
  "{0,-34} {1,8} {2,12:N0} {3,12:N0} {4,10:N0} {5,7} KB" -f $kv.Key, $status,
    $s[[int][math]::Floor(($N-1)*0.50)], $s[[int][math]::Floor(($N-1)*0.95)],
    $s[-1], [math]::Round($size/1KB,1)
}
