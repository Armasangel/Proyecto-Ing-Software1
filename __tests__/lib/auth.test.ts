import bcrypt from "bcryptjs";
import {
  AUTH_COOKIE,
  getJwtSecret,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
} from "@/lib/auth";

const TEST_SECRET = "test-jwt-secret-for-unit-tests-0123456789";

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

describe("AUTH_COOKIE", () => {
  it('is "auth_token"', () => {
    expect(AUTH_COOKIE).toBe("auth_token");
  });
});

describe("getJwtSecret", () => {
  it("returns JWT_SECRET from env when set", () => {
    expect(getJwtSecret()).toBe(TEST_SECRET);
  });

  it("throws when JWT_SECRET is too short", () => {
    process.env.JWT_SECRET = "short-secret";
    expect(() => getJwtSecret()).toThrow("JWT_SECRET must be at least 32 characters");
    process.env.JWT_SECRET = TEST_SECRET;
  });

  it("throws when no JWT_SECRET is set", () => {
    const prev = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow("JWT_SECRET is required");
    process.env.JWT_SECRET = prev;
  });
});

describe("signAuthToken / verifyAuthToken", () => {
  const usuario = {
    id_usuario: 1,
    nombre: "Juan Pérez",
    correo: "juan@tienda.com",
    tipo_usuario: "DUENO",
  };

  it("produces a signed token", () => {
    const token = signAuthToken(usuario);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("roundtrips the full user payload", () => {
    const token = signAuthToken(usuario);
    const decoded = verifyAuthToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded).toMatchObject({
      id_usuario: 1,
      nombre: "Juan Pérez",
      correo: "juan@tienda.com",
      tipo_usuario: "DUENO",
    });
  });

  it("returns null for an invalid token", () => {
    expect(verifyAuthToken("this.is.not.a.valid.jwt")).toBeNull();
  });

  it("returns null for a token signed with a different secret", () => {
    const token = signAuthToken(usuario);
    process.env.JWT_SECRET = "different-secret-that-is-long-enough-for-tests";
    expect(verifyAuthToken(token)).toBeNull();
    process.env.JWT_SECRET = TEST_SECRET;
  });

  it("preserves the user id through subject field", () => {
    const ids = [42, 7, 999];
    for (const id of ids) {
      const token = signAuthToken({ ...usuario, id_usuario: id });
      const decoded = verifyAuthToken(token);
      expect(decoded?.id_usuario).toBe(id);
    }
  });

  it("handles different role types", () => {
    const empleado = { ...usuario, tipo_usuario: "EMPLEADO" };
    const token = signAuthToken(empleado);
    const decoded = verifyAuthToken(token);
    expect(decoded?.tipo_usuario).toBe("EMPLEADO");
  });

  it("returns null when token has no sub claim", () => {
    const token = signAuthToken(usuario);
    const parts = token.split(".");
    const payload = JSON.parse(atob(parts[1]));
    delete payload.sub;
    parts[1] = btoa(JSON.stringify(payload));
    const tampered = parts.join(".");
    expect(verifyAuthToken(tampered)).toBeNull();
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", () => {
    const hash = bcrypt.hashSync("password123", 10);
    expect(verifyPassword("password123", hash)).toBe(true);
  });

  it("returns false for incorrect password", () => {
    const hash = bcrypt.hashSync("password123", 10);
    expect(verifyPassword("wrongpass", hash)).toBe(false);
  });

  it("returns false for an invalid hash string", () => {
    expect(verifyPassword("password123", "not-a-hash")).toBe(false);
  });

  it("returns false for empty password against a hash", () => {
    const hash = bcrypt.hashSync("password123", 10);
    expect(verifyPassword("", hash)).toBe(false);
  });
});
