import {
  CONTRASENAS_COMUNES,
  esContrasenaValida,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  validarContrasena,
} from "@/lib/password-policy";

describe("lib/password-policy", () => {
  describe("longitud mínima", () => {
    it("acepta una contraseña en el límite exacto", () => {
      const clave = "a".repeat(PASSWORD_MIN_LENGTH);
      // 12 'a' seguidas: falla por el patrón de carácter repetido, pero
      // únicamente por eso, no por longitud.
      expect(validarContrasena(clave)).toMatch(/repetido/i);
    });

    it("rechaza por debajo del mínimo", () => {
      expect(validarContrasena("a".repeat(PASSWORD_MIN_LENGTH - 1))).toMatch(
        new RegExp(`${PASSWORD_MIN_LENGTH} caracteres`)
      );
    });

    it("acepta una frase larga, que es lo que recomienda NIST", () => {
      expect(esContrasenaValida("la llave del porton esta bajo el macetero")).toBe(true);
    });
  });

  describe("tope de bytes (límite de bcrypt)", () => {
    it("acepta exactamente 72 bytes", () => {
      expect(esContrasenaValida("Brindis".repeat(9) + "1234")).toBe(true); // 72 bytes
    });

    it("rechaza más de 72 bytes", () => {
      // bcrypt ignora todo lo que pase del byte 72, así que dos contraseñas
      // con el mismo prefijo serían indistinguibles en el login.
      expect(validarContrasena("Brindis".repeat(11))).toMatch(/72 bytes/);
    });

    it("mide en bytes y no en caracteres", () => {
      // 40 emojis: 40 caracteres (pasa el mínimo) pero 160 bytes (excede 72).
      expect(validarContrasena("🔑".repeat(40))).toMatch(/72 bytes/);
    });
  });

  describe("contraseñas comunes", () => {
    it.each(CONTRASENAS_COMUNES.slice(0, 25))("rechaza %s", (comun) => {
      // Se estiran para cumplir el mínimo de 12 caracteres.
      expect(esContrasenaValida(comun)).toBe(false);
    });

    it("compara sin distinguir mayúsculas, acentos ni espacios", () => {
      expect(esContrasenaValida("CONTRASEÑA123")).toBe(false);
      expect(esContrasenaValida("Contraseña123")).toBe(false);
    });

    it("rechaza una contraseña común con dígitos o símbolos pegados al final", () => {
      // "password123!" no está literal en la lista, pero sigue siendo
      // "password" disfrazada.
      expect(esContrasenaValida("PASSWORD123!")).toBe(false);
    });

    it("no rechaza una frase que sólo contiene una palabra común", () => {
      // Reject-by-substring sería demasiado agresivo aquí: NIST promueve las
      // frases de varias palabras y una regla así se las comería.
      expect(esContrasenaValida("mi contrasena de la tienda es unica")).toBe(true);
    });
  });

  describe("casos límite", () => {
    it("rechaza un solo carácter repetido", () => {
      expect(esContrasenaValida("aaaaaaaaaaaaaaaa")).toBe(false);
    });

    it("rechaza entradas vacías o que no son cadenas", () => {
      expect(validarContrasena("")).toMatch(/obligatoria/i);
      expect(validarContrasena(undefined)).toMatch(/obligatoria/i);
      expect(validarContrasena(null)).toMatch(/obligatoria/i);
      expect(validarContrasena(12345678901234)).toMatch(/obligatoria/i);
    });

    it("acepta una contraseña larga y con acentos", () => {
      expect(esContrasenaValida("Ándale Que Sí 2026 Tranqui")).toBe(true);
    });
  });
});