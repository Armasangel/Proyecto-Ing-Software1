// k6-tests/prueba-estres.js
//
// PRUEBA DE ESTRÉS: aumenta la carga muy por encima del tráfico normal
// para encontrar el punto de quiebre del sistema (dónde empiezan los
// errores y la latencia se dispara) y observar si se recupera al bajar
// la carga.
//
// Ataca los endpoints más "pesados" (consultas a Postgres con joins y
// agregaciones: catálogo de productos y estadísticas del dashboard),
// reutilizando una sesión ya autenticada para no confundir el resultado
// con el rate-limit de login (que se prueba aparte).
//
// Ejecutar:
//   k6 run k6-tests/prueba-estres.js
//   k6 run --out json=resultados-estres.json k6-tests/prueba-estres.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { BASE_URL, loginTodos } from './auth.js';

const errorRate = new Rate('errores_totales');
const errorRate5xx = new Rate('errores_5xx');

export const options = {
  scenarios: {
    estres: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // tráfico normal alto
        { duration: '30s', target: 150 },  // 3x lo normal
        { duration: '1m', target: 300 },   // 6x lo normal
        { duration: '1m', target: 450 },   // 9x lo normal
        { duration: '1m', target: 600 },   // 12x lo normal: buscamos el quiebre
        { duration: '30s', target: 0 },    // recuperación
      ],
      gracefulRampDown: '15s',
    },
  },
  // No usamos thresholds que aborten la corrida: en una prueba de estrés
  // queremos ver la curva completa, incluyendo la degradación.
  thresholds: {
    http_req_duration: ['p(95)<5000'], // solo informativo
  },
};

export function setup() {
  return loginTodos();
}

export default function (cookies) {
  const targets = [
    { url: '/api/productos', cookie: cookies.empleado, name: 'api_productos' },
    { url: '/api/estadisticas', cookie: cookies.dueno, name: 'api_estadisticas' },
    { url: '/dashboard', cookie: cookies.dueno, name: 'page_dashboard' },
    { url: '/api/ventas/recientes', cookie: cookies.dueno, name: 'api_ventas_recientes' },
  ];
  const t = targets[Math.floor(Math.random() * targets.length)];

  const res = http.get(`${BASE_URL}${t.url}`, {
    headers: { Cookie: t.cookie },
    tags: { name: t.name },
    timeout: '10s',
  });

  const ok = check(res, {
    'no es error de servidor (5xx)': (r) => r.status < 500,
    'respondió antes de 10s (no timeout)': (r) => r.status !== 0,
  });

  errorRate.add(!ok);
  errorRate5xx.add(res.status >= 500);

  sleep(0.1);
}
