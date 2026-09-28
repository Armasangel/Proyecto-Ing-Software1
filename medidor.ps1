# Medidor de tiempo y peso de respuesta por endpoint.
# Reemplaza (o complementa) la medicion manual con DevTools: mismo par de
# numeros (time total, tamano del body) pero repetible y promediado.
#
#   .\medidor.ps1 -N 5
param(
  [int]$N = 5,
  [string]$Base = "http://localhost:3001",
  [string]$CookieFile = "C:\Users\Angel\AppData\Local\Temp\opencode\vol\cookies.txt"
)

# Etiqueta legible -> ruta. Las 5 pantallas del Dueño (VOL-03/VOL-04).
$rutas = [ordered]@{
  "Dashboard  /api/stats"                 = "/api/stats"
  "Ventas     /api/ventas"                = "/api/ventas"
  "Deudas     /api/deudas"                = "/api/deudas"
  "Historial  /api/historial-ventas"      = "/api/historial-ventas"
  "Reportes   /api/estadisticas"          = "/api/estadisticas"
}

"{0,-34} {1,8} {2,12} {3,12} {4,10} {5,10}" -f "ENDPOINT","STATUS","p50 ms","p95 ms","max ms","bytes"
"-" * 92

foreach ($kv in $rutas.GetEnumerator()) {
  $label = $kv.Key
  $path  = $kv.Value

  $times = @()
  $size  = 0
  $status = 0

  for ($i = 0; $i -lt $N; $i++) {
    $out = & curl.exe -s -o NUL -b $CookieFile `
      -w "%{http_code}|%{time_total}|%{size_download}" "$Base$path"
    $parts = $out -split "\|"
    $status = [int]$parts[0]
    $times += ([double]$parts[1] * 1000)
    $size  = [int64][double]$parts[2]
  }

  $s = $times | Sort-Object
  $p50 = $s[[int][math]::Floor(($N - 1) * 0.50)]
  $p95 = $s[[int][math]::Floor(($N - 1) * 0.95)]
  $max = $s[-1]
  $kb  = [math]::Round($size / 1KB, 1)

  "{0,-34} {1,8} {2,12:N0} {3,12:N0} {4,10:N0} {5,7} KB" -f $label, $status, $p50, $p95, $max, $kb
}
