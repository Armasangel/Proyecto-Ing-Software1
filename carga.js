// Prueba de volumen VOL-01 / VOL-02 — ramp 20 -> 50 VUs contra las tres
// pantallas del Dueño: Dashboard (/api/stats), Ventas (/api/ventas) y
// Deudas (/api/deudas).
//
// Hace login UNA sola vez en setup() y reusa la cookie, para no chocar con el
// rate limiter de /api/login (5 intentos/minuto por IP en lib/login-rate-limit).
//
// Uso (desde Docker, en Linux/Mac):
//   docker run --rm -i --network=host grafana/k6 run - < carga.js
//
// Uso en Windows / Docker Desktop (host networking no aplica):
//   docker run --rm -i -v "${PWD}:/work" -w /work grafana/k6 run /work/carga.js
// (el script apunta a host.docker.internal, ver BASE_URL abajo)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Métricas por endpoint: el agregado http_req_duration mezcla las tres
// pantallas y esconde cuál se degrada.
const durStats = new Trend('dur_stats', true);
const durVentas = new Trend('dur_ventas', true);
const durDeudas = new Trend('dur_deudas', true);
const bytesStats = new Counter('bytes_stats');
const bytesVentas = new Counter('bytes_ventas');
const bytesDeudas = new Counter('bytes_deudas');

// docker-compose.yml mapea "3001:3000" (ver líneas 8-9), así que desde el
// host la app está en 3001, NO en 3000. Desde un contenedor hay que usar
// host.docker.internal para alcanzar el host de Windows/Mac.
const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3001';

const USUARIOS = {
  DUENO: { correo: 'dueno@tienda.com', password: 'password123' },
};

// Rampa por defecto del informe. Se puede achicar para un smoke test:
//   -e SMOKE=1   -> 3 VUs / 10s, verifica que el setup y el login funcionan.
const SMOKE = __ENV.SMOKE === '1' || __ENV.SMOKE === 'true';

export const options = {
  stages: SMOKE
    ? [{ duration: '5s', target: 3 }, { duration: '5s', target: 0 }]
    : [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    dur_stats: ['p(95)<500'],
    dur_ventas: ['p(95)<800'],
    dur_deudas: ['p(95)<800'],
  },
  // Ignora el login de setup() en las métricas de la carga sostenida.
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/login`,
    JSON.stringify({
      username: USUARIOS.DUENO.correo,
      password: USUARIOS.DUENO.password,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status !== 200) {
    throw new Error(
      `Login falló (${res.status}): ${res.body.slice(0, 200)}. ` +
      `¿BASE_URL correcto? Probá -e BASE_URL=http://host.docker.internal:3001`
    );
  }

  // El Dueño no pasa por 2FA (ver app/api/login/route.ts:93), así que la
  // cookie de sesión viene en la respuesta del login.
  const cookie = Object.entries(res.cookies)
    .map(([name, c]) => `${name}=${c[0].value}`)
    .join('; ');

  if (!cookie) {
    throw new Error('Login OK pero sin cookie de sesión — no se puede cargar.');
  }

  return { cookie };
}

const RUTAS = [
  { path: '/api/stats', dur: durStats, bytes: bytesStats },
  { path: '/api/ventas', dur: durVentas, bytes: bytesVentas },
  { path: '/api/deudas', dur: durDeudas, bytes: bytesDeudas },
];

export default function main(data) {
  const params = { headers: { Cookie: data.cookie } };

  for (const ruta of RUTAS) {
    const r = http.get(`${BASE_URL}${ruta.path}`, params);
    ruta.dur.add(r.timings.duration);
    ruta.bytes.add(r.body.length);
    check(r, { [`${ruta.path} responde 200`]: (x) => x.status === 200 });
  }

  sleep(1);
}
