// lib/password-policy.ts
//
// Política de contraseñas según NIST SP 800-63B y OWASP ASVS 1.1.2.
//
// Dos decisiones que conviene tener presentes:
//
// 1. Sin reglas de composición. NIST SP 800-63B recomienda explícitamente NO
//    exigir "una mayúscula, un símbolo, un número": empujan a la gente a
//   abcd123! en vez de a una frase larga, y la NIST medió que eso REDUCE la
//    seguridad real. Lo que se exige es longitud + una lista de contraseñas
//    muy comunes.
//
// 2. Tope de 72 BYTES, no de 72 caracteres. bcrypt no considera más de los
//    primeros 72 bytes de la contraseña: todo lo que pase de ahí se descarta
//    en silencio. Sin este tope, "MiClaveMuyLargaDeVerdad..." y
//    "MiClaveMuyLargaDeVerdad...otroCosa" serían la MISMA contraseña. 

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

export const CONTRASENAS_COMUNES = [
  "password",
  "password1",
  "password123",
  "contrasena",
  "contrasena1",
  "contraseña",
  "contraseña1",
  "contrasena123",
  "contraseña123",
  "123456789",
  "1234567890",
  "12345678",
  "123456789012",
  "11111111",
  "00000000",
  "qwertyui",
  "qwerty123",
  "qwerty1234",
  "abc12345",
  "abc123456",
  "abcd1234",
  "admin123",
  "administrador",
  "usuario123",
  "usuario1234",
  "usuario12345",
  "letras123",
  "letras1234",
  "nombre123",
  "apellido123",
  "sanmiguel",
  "sanmiguel123",
  "tiendasanmiguel",
  "tiendasanmiguel123",
  "deposito123",
  "bodega123",
  "carniceria123",
  "tienda123",
  "tienda1234",
  "pASSWORD",
  "PASSWORD1",
  "PASSWORD123",
  "PASSWORD1234",
  "Password1",
  "Password123",
  "Passw0rd",
  "Passw0rd!",
  "P@ssw0rd",
  "P@ssw0rd1",
  "P@ssword1",
  "P@ssword123",
  "Qwerty123",
  "Qwerty1234",
  "Welcome1",
  "Welcome123",
  "Bienvenido1",
  "Bienvenido123",
  "Cambiar123",
  "Temporal1",
  "Temporal123",
  "Temporal2024",
  "Temporal2025",
  "Temporal2026",
  "Verano2024",
  "Verano2025",
  "Verano2026",
  "Primavera2025",
  "Otono2025",
  "Invierno2025",
  "Guatemala1",
  "guatemala123",
  "Guatemala2025",
  "Guatemala2026",
  "Antigua1",
  "Chimaltenango1",
];

/**
 * Quita acentos y baja a minúsculas para comparar contra la lista.
 */
function normalizar(contrasena: string): string {
  return contrasena
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Valida una contraseña contra la política.
 * @returns `null` si es válida, o el mensaje de error si no lo es.
 */
export function validarContrasena(contrasena: unknown): string | null {
  if (typeof contrasena !== "string" || contrasena.length === 0) {
    return "La contraseña es obligatoria";
  }

  // El byte count va primero: una contraseña de 30 emojis pasa el filtro de
  // "12 caracteres" pero es solo ~120 bytes… y una de 40 emojis son 160 bytes,
  // que es justo el caso que bcrypt trunca.
  const bytes = Buffer.byteLength(contrasena, "utf8");
  if (bytes > PASSWORD_MAX_BYTES) {
    return `La contraseña no puede superar los ${PASSWORD_MAX_BYTES} bytes`;
  }

  // Longitud mínima en caracteres, que es lo que la persona puede contar.
  if ([...contrasena].length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }

  const normalizada = normalizar(contrasena);

  if (CONTRASENAS_COMUNES.includes(normalizada)) {
    return "Esa contraseña es demasiado común. Elegí otra.";
  }

  // NO se usa un "contiene" general. NIST SP 800-63B recomienda frases de
  // varias palabras, y una regla de substring haría falta una que se traga
  // frases perfectamente buenas como "mi contraseña de la tienda es única".
  const sinAdornos = normalizada.replace(/[^a-zñ]+$/, "");
  if (
    sinAdornos.length >= 6 &&
    CONTRASENAS_COMUNES.includes(sinAdornos)
  ) {
    return "Esa contraseña es demasiado común. Elegí otra.";
  }

  if (/^(.)\1+$/.test(contrasena)) {
    return "La contraseña no puede ser un solo carácter repetido";
  }

  return null;
}

/** Version booleana para los sitios donde solo hace falta saber si pasa. */
export function esContrasenaValida(contrasena: unknown): boolean {
  return validarContrasena(contrasena) === null;
}
