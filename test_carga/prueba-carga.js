// k6-tests/prueba-carga.js
//
// PRUEBA DE CARGA: simula el tráfico normal/esperado del sistema
// "Depósito San Miguel" con los 3 roles (dueño, colaborador, bodeguero)
// navegando y consultando sus pantallas habituales de forma concurrente
// y sostenida durante varios minutos.
//
// Ejecutar:
//   k6 run k6-tests/prueba-carga.js
//   k6 run -e BASE_URL=http://localhost:3000 k6-tests/prueba-carga.js
//   k6 run --out json=resultados-carga.json k6-tests/prueba-carga.js

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, loginTodos } from './auth.js';

// Métricas propias para diferenciar errores de negocio (403/404 esperados)
// de errores reales del sistema (5xx, timeouts).
const errorRate5xx = new Rate('errores_5xx');
const duracionPaginas = new Trend('duracion_paginas_html');
const duracionApi = new Trend('duracion_api_json');

export const options = {
  scenarios: {
    // 40% del tráfico: colaborador de tienda (rol más usado, registra ventas)
    colaborador: {
      executor: 'ramping-vus',
      exec: 'flujoColaborador',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 12 },
        { duration: '3m', target: 12 },
        { duration: '30s', target: 0 },
      ],
    },
    // 30% del tráfico: dueño revisando dashboard/reportes
    dueno: {
      executor: 'ramping-vus',
      exec: 'flujoDueno',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 9 },
        { duration: '3m', target: 9 },
        { duration: '30s', target: 0 },
      ],
    },
    // 30% del tráfico: bodeguero moviendo inventario
    bodeguero: {
      executor: 'ramping-vus',
      exec: 'flujoBodeguero',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 9 },
        { duration: '3m', target: 9 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    // Objetivo de la prueba de carga: bajo tráfico normal, el 95% de las
    // peticiones debe responder en menos de 800ms y casi no debe haber errores.
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
    errores_5xx: ['rate<0.01'],
  },
};

export function setup() {
  const cookies = loginTodos();
  return cookies;
}

function get(url, cookie, tagName) {
  const res = http.get(`${BASE_URL}${url}`, {
    headers: { Cookie: cookie },
    tags: { name: tagName },
  });
  const ok = check(res, {
    'status es 200 o 304': (r) => r.status === 200 || r.status === 304,
  });
  errorRate5xx.add(res.status >= 500);
  if (tagName.startsWith('page_')) duracionPaginas.add(res.timings.duration);
  else duracionApi.add(res.timings.duration);
  return { res, ok };
}

export function flujoColaborador(cookies) {
  const cookie = cookies.empleado;
  group('Colaborador: pantalla de ventas', () => {
    get('/ventas', cookie, 'page_ventas');
    sleep(0.3);
    get('/api/productos', cookie, 'api_productos');
    get('/api/categorias', cookie, 'api_categorias');
    get('/api/marcas', cookie, 'api_marcas');
    sleep(0.5);
    get('/api/clientes', cookie, 'api_clientes');
  });
  sleep(1 + Math.random() * 2);
}

export function flujoDueno(cookies) {
  const cookie = cookies.dueno;
  group('Dueño: dashboard y reportes', () => {
    get('/dashboard', cookie, 'page_dashboard');
    sleep(0.3);
    get('/api/estadisticas', cookie, 'api_estadisticas');
    get('/api/ventas/recientes', cookie, 'api_ventas_recientes');
    sleep(0.4);
    get('/api/usuarios', cookie, 'api_usuarios');
    get('/reportes', cookie, 'page_reportes');
  });
  sleep(1 + Math.random() * 2);
}

export function flujoBodeguero(cookies) {
  const cookie = cookies.bodeguero;
  group('Bodeguero: pantalla de bodega', () => {
    get('/bodega', cookie, 'page_bodega');
    sleep(0.3);
    get('/api/bodega/pedidos', cookie, 'api_bodega_pedidos');
    get('/api/productos', cookie, 'api_productos');
    sleep(0.4);
    get('/api/bodegas/simple', cookie, 'api_bodegas_simple');
  });
  sleep(1 + Math.random() * 2);
}
