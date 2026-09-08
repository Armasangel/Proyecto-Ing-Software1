import jwt from "jsonwebtoken";
import {
  compararCodigo,
  enmascararCorreo,
  fechaExpiracion,
  generarCodigo,
  getMaxIntentos,
  hashCodigo,
  minutosDeExpiracion,
  signPreToken,
  verifyPreToken,
} from "@/lib/verificacion";
import { getJwtSecret } from "@/lib/auth";

describe("lib/verificacion (refactor 2FA)", () => {
  describe("generarCodigo", () => {
    it("generates a 6-digit code, zero-padded", () => {
      for (let i = 0; i < 20; i++) {
        expect(generarCodigo()).toMatch(/^\d{6}$/);
      }
      expect(generarCodigo()).not.toEqual(generarCodigo());
    });
  });

  describe("hashCodigo / compararCodigo", () => {
    it("hashes and validates a correct code", () => {
      const hash = hashCodigo("004821");
      expect(hash).not.toBe("004821");
      expect(compararCodigo("004821", hash)).toBe(true);
    });

    it("rejects a wrong code", () => {
      const hash = hashCodigo("004821");
      expect(compararCodigo("999999", hash)).toBe(false);
    });

    it("returns false when the stored hash is invalid", () => {
      expect(compararCodigo("123456", "no-es-un-hash")).toBe(false);
    });
  });

  describe("vencimiento e intentos", () => {
    it("exposes a 5 minute expiration window", () => {
      expect(minutosDeExpiracion()).toBe(5);
      const exp = fechaExpiracion().getTime();
      const ahora = Date.now();
      expect(exp).toBeGreaterThan(ahora + 4 * 60 * 1000);
      expect(exp).toBeLessThanOrEqual(ahora + 5 * 60 * 1000);
    });

    it("allows 5 failed attempts before locking", () => {
      expect(getMaxIntentos()).toBe(5);
    });
  });

  describe("signPreToken / verifyPreToken", () => {
    it("returns the id_usuario for a valid pre-token", () => {
      const token = signPreToken(42);
      expect(verifyPreToken(token)).toBe(42);
    });

    it("returns null for a malformed/garbage token", () => {
      expect(verifyPreToken("no-es-un-jwt")).toBeNull();
    });

    it("returns null when the token was tampered with", () => {
      const token = signPreToken(42);
      const tampered = token.slice(0, -2) + "xx";
      expect(verifyPreToken(tampered)).toBeNull();
    });

    it("returns null when the token has a different purpose", () => {
      const token = jwt.sign({ purpose: "otra_cosa" }, getJwtSecret(), { subject: "7" });
      expect(verifyPreToken(token)).toBeNull();
    });

    it("returns null for an expired token", () => {
      const expired = jwt.sign({ purpose: "2fa_pendiente" }, getJwtSecret(), {
        subject: "7",
        expiresIn: -10,
      });
      expect(verifyPreToken(expired)).toBeNull();
    });

    it("returns null for a token signed with a different secret", () => {
      const token = jwt.sign({ purpose: "2fa_pendiente" }, "una-secreta-totalmente-distinta-123456", {
        subject: "7",
      });
      expect(verifyPreToken(token)).toBeNull();
    });
  });

  describe("enmascararCorreo", () => {
    it("masks the middle of the local part", () => {
      expect(enmascararCorreo("maria@tienda.com")).toBe("ma***@tienda.com");
    });

    it("keeps at least one asterisk for very short local parts", () => {
      expect(enmascararCorreo("a@b.c")).toBe("a*@b.c");
    });

    it("returns the input unchanged when there is no domain", () => {
      expect(enmascararCorreo("sin-dominio")).toBe("sin-dominio");
    });
  });
});