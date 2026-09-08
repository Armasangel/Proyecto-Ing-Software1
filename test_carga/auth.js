// k6-tests/auth.js
// Helper de autenticación reutilizado por los scripts de carga y estrés.
// Inicia sesión una sola vez por rol (en setup()) y reutiliza la cookie
// auth_token en todas las peticiones, tal como haría un usuario real que
// ya inició sesión en el navegador.

import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const USUARIOS = {
  dueno: { username: 'dueno@tienda.com', password: 'password123' },
  empleado: { username: 'sin2fa@tienda.com', password: 'password123' },
  bodeguero: { username: 'bodega@tienda.com', password: 'password123' },
};

export function loginTodos() {
  const cookies = {};
  for (const [rol, creds] of Object.entries(USUARIOS)) {
    const res = http.post(`${BASE_URL}/api/login`, JSON.stringify(creds), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login_setup' },
    });
    check(res, {
      [`login ${rol} devuelve 200`]: (r) => r.status === 200,
    });
    const body = res.json();
    if (!body || !body.token) {
      throw new Error(`No se pudo autenticar el usuario de prueba "${rol}": HTTP ${res.status} - ${res.body}`);
    }
    cookies[rol] = `auth_token=${body.token}`;
  }
  return cookies;
}
