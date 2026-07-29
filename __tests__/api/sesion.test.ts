import { GET } from "@/app/api/sesion/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

describe("GET /api/sesion", () => {
  it("returns usuario=null when no auth token", async () => {
    const req = createMockRequest("/api/sesion");
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ usuario: null });
  });

  it("returns the authenticated user when token is valid (dueno)", async () => {
    const req = createMockRequest("/api/sesion", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.usuario).toMatchObject({
      id_usuario: testUserDueno.id_usuario,
      nombre: testUserDueno.nombre,
      correo: testUserDueno.correo,
      tipo_usuario: testUserDueno.tipo_usuario,
    });
  });

  it("returns the authenticated user when token is valid (empleado)", async () => {
    const req = createMockRequest("/api/sesion", { user: testUserEmpleado });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.usuario).toMatchObject({
      id_usuario: testUserEmpleado.id_usuario,
      nombre: testUserEmpleado.nombre,
      tipo_usuario: testUserEmpleado.tipo_usuario,
    });
  });

  it("returns usuario=null for an invalid token", async () => {
    const req = createMockRequest("/api/sesion", { cookies: { auth_token: "invalid-token" } });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ usuario: null });
  });

  it("clears the cookie when an invalid token is present", async () => {
    const req = createMockRequest("/api/sesion", { cookies: { auth_token: "invalid-token" } });
    const res = await GET(req);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("auth_token=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
