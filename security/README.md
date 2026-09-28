# Pruebas de seguridad — ZAP (automática) + Burp Suite (manual)

Guía para correr las 2 pruebas automáticas (OWASP ZAP) y las 2 manuales
(Burp Suite) que pide el chore. Wireshark queda como extra opcional al
final, no es obligatorio.

## 0. Antes de empezar

- **Usá tu entorno local (Docker), nunca un servidor con datos reales.**
- En tu `.env` (o las variables que exporte docker-compose), dejá
  `GMAIL_USER` y `GMAIL_APP_PASSWORD` **vacías** o apuntando a una cuenta de
  prueba — la app manda correos reales (2FA de login, ascenso a dueño,
  recordatorios de deuda) y un escaneo puede disparar varios sin querer.
- El login tiene rate-limiting: **5 intentos por minuto** por IP
  (`lib/login-rate-limit.ts`). Si una prueba se bloquea con 429 a mitad de
  camino, no es un error tuyo — es el sistema funcionando. Documentalo como
  hallazgo positivo (control de fuerza bruta activo) y esperá el minuto, o
  apuntá el ataque a un endpoint sin ese límite.
- Usuario de prueba: `dueno@tienda.com` / `password123` (dueño, sin 2FA
  forzado según el seed) — usalo para las partes que requieren sesión.

## 1. Levantar todo

```bash
# La app y la base, como siempre
docker compose up -d

# ZAP, en la misma red que la app (queda "dormido" esperando comandos)
docker compose -f docker-compose.yml -f docker-compose.security.yml up -d zap
```

Confirmá que ZAP puede ver la app (debería responder algo, aunque sea un
error de Next.js, no un timeout):

```bash
docker compose exec zap wget -qO- http://app:3000
```

## 2. ZAP — Prueba 1: Baseline scan (pasivo)

Analiza cabeceras, cookies, información expuesta, etc. **sin** mandar
payloads de ataque — es seguro correrlo tantas veces como quieras.

```bash
docker compose exec zap zap-baseline.py \
  -t http://app:3000 \
  -r reports/baseline-report.html \
  -I
```

- `-r` guarda el reporte HTML en `security/zap-reports/baseline-report.html`
  (por el volumen montado).
- `-I` hace que no falle el comando aunque encuentre alertas (igual las
  reporta) — así no se corta a mitad de camino.

Qué revisar en el reporte: cabeceras de seguridad faltantes (`Content-
Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`), cookies
sin `Secure`/`HttpOnly`/`SameSite`, y que probablemente marque la falta de
HTTPS (esperable en local — es justo el ticket pendiente "Implementar
HTTPS en server" que ya tenían anotado).

## 3. ZAP — Prueba 2: Active scan autenticado, a un endpoint puntual

Este sí manda payloads (inyección SQL, XSS, etc.), así que lo apuntamos a
UN formulario en vez de a todo el sitio, para no gastar tiempo ni disparar
el rate-limit de login.

Primero conseguir una cookie de sesión válida — la forma más simple y que
funciona igual en Windows, Mac o Linux es sacarla directo del navegador
(evita pelear con el escapado de comillas de curl/wget entre tu shell y la
del contenedor, que varía según el sistema operativo):

1. Entrar a `http://localhost:3001` en tu navegador normal (no hace falta
   que sea el de Burp para este paso) y logueate con
   `dueno@tienda.com` / `password123`.
2. Abrí las herramientas de desarrollador (`F12`) → pestaña **Application**
   (Chrome/Edge) o **Storage** (Firefox) → **Cookies** →
   `http://localhost:3001`.
3. Copiá el valor de la cookie llamada **`auth_token`** (ese es el nombre
   exacto, definido en `lib/auth.ts` como `AUTH_COOKIE`).

<details>
<summary>Alternativa por línea de comandos (Mac/Linux/Git Bash, no PowerShell)</summary>

```bash
docker compose exec zap sh -c '
  wget -qO- --header="Content-Type: application/json" \
    --post-data="{\"correo\":\"dueno@tienda.com\",\"contrasena\":\"password123\"}" \
    --server-response \
    http://app:3000/api/login 2>&1 | grep -i set-cookie
'
```

Ojo: adentro de la red de Docker es `http://app:3000` (el puerto interno
del contenedor), **no** `3001` — ese `3001` es solo el puerto publicado
hacia tu máquina para que entres desde el navegador.

</details>

Con el valor de la cookie (algo como `auth_token=eyJhbGciOi...`), usalo en
el scan, apuntado por ejemplo a crear una deuda:

```bash
docker compose exec zap zap-full-scan.py \
  -t http://app:3000/api/deudas \
  -r reports/active-scan-deudas.html \
  -z "-config replacer.full_list(0).description=auth \
      -config replacer.full_list(0).enabled=true \
      -config replacer.full_list(0).matchtype=REQ_HEADER \
      -config replacer.full_list(0).matchstr=Cookie \
      -config replacer.full_list(0).regex=false \
      -config replacer.full_list(0).replacement=auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub21icmUiOiJBZG1pbiBEdWXDsW8iLCJjb3JyZW8iOiJjdW1hdHplbWlsaW82QGdtYWlsLmNvbSIsInRpcG9fdXN1YXJpbyI6IkRVRU5PIiwiaWRfYm9kZWdhIjpudWxsLCJpYXQiOjE3OTA1NDkyNDksImV4cCI6MTc5MDU3ODA0OSwic3ViIjoiMSJ9.F3F0c4KS0e3Qll7pZpS-OGRYksao280w-hC7TczNFtA" \
  -I
```

Qué revisar: si marca algo de "SQL Injection" o similar — no debería, ya
que casi todo el backend usa consultas parametrizadas (`$1`, `$2`...), así
que un resultado limpio ahí también es un hallazgo válido para el reporte
(evidencia de buena práctica, no todo tiene que ser una vulnerabilidad
encontrada).

## 4. Burp Suite — instalación y proxy (sin Docker, es una app de escritorio)

Community Edition (gratis) alcanza: https://portswigger.net/burp/communitydownload

1. Abrí Burp → pestaña **Proxy** → confirmá que el listener esté en
   `127.0.0.1:8080` (por defecto ya lo está).
2. Usá el navegador embebido de Burp ("Open Browser" en la pestaña Proxy) —
   así no tenés que tocar la configuración de proxy de tu navegador normal.
3. En ese navegador, entrá a `http://localhost:3001` (el puerto que
   publica `docker-compose.yml` hacia el host).
4. En Burp, activá **Intercept is on** cuando quieras capturar una
   petición antes de que salga.

### Burp — Prueba 1: forzar `tipo_venta` a mano

1. Logueate como cualquier colaborador (`armasangel193@gmail.com` o el que
   tengas) en el navegador de Burp.
2. Andá a "Registrar venta", elegí un cliente **minorista** (ej. Maria
   Comprador), agregá un producto y hacé clic en registrar la venta con
   Intercept activado.
3. En Burp, en la petición interceptada (`POST /api/ventas`), en el body
   JSON cambiá `"tipo_venta":"MINORISTA"` por `"tipo_venta":"MAYORISTA"`
   (sin agregar `forzar_tipo_venta`). Forward.
4. **Resultado esperado:** la venta queda registrada igual como MINORISTA
   — el backend ignora lo que mandaste y usa el `tipo_cliente` real de la
   base. Confirmalo revisando la venta creada. Documentá la petición
   modificada y la respuesta como evidencia.
5. (Opcional, para completar el caso) repetí el mismo cambio pero agregando
   `"forzar_tipo_venta": true` — ahí sí debería respetar `MAYORISTA`, porque
   es el override explícito que la app permite a propósito.

### Burp — Prueba 2: intentar escalar a Dueño saltándose la verificación

1. Logueate como un usuario **EMPLEADO** en el navegador de Burp. Copiá la
   cookie de sesión (pestaña Proxy → HTTP history, o el header `Cookie` de
   cualquier petición).
2. Andá a Repeater (clic derecho sobre cualquier petición → "Send to
   Repeater"), armá a mano:
   ```
   PATCH /api/usuarios
   Cookie: auth_token=<la del empleado>
   Content-Type: application/json

   {"id_usuario": 1, "tipo_usuario": "DUENO"}
   ```
3. **Resultado esperado:** `403` — un empleado no puede tocar ese endpoint.
4. Repetilo ahora con la cookie de un **dueño** real. Esperado: `400`,
   exigiendo el proceso de `/api/usuarios/promover-dueno/solicitar` en vez
   de aplicar el cambio directo — confirma que ni siquiera el dueño tiene
   un atajo para saltarse la verificación por correo.

Guardá capturas de cada petición/respuesta en Burp (clic derecho → "Save
item") para el reporte.

## 5. (Extra opcional) Wireshark

No es la herramienta manual del enunciado, pero si querés un tercer punto
de evidencia: capturá tráfico mientras hacés login en local (`http`, sin
TLS) y mostrá en Wireshark que la contraseña viaja en texto plano dentro
del body del POST — evidencia adicional de por qué hace falta HTTPS en
producción.

## 6. Apagar todo al terminar

```bash
docker compose -f docker-compose.yml -f docker-compose.security.yml down
```

Los reportes de ZAP quedan en `security/zap-reports/` aunque bajes los
contenedores.