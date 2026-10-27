import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo, TIPOS_USUARIO } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { leerCupo, respuestaSiLimiteAlcanzado } from "@/lib/limites-usuarios";
import { validarContrasena } from "@/lib/password-policy";
import { revocarSesiones } from "@/lib/sesion";
import { registrarAuditoria, TIPOS_EVENTO } from "@/lib/audit";
import { getLogger } from "@/lib/logger";

const log = getLogger("api/usuarios");

const TIPOS_VALIDOS = Object.values(TIPOS_USUARIO);

function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: `Demasiadas solicitudes. Intenta de nuevo en ${retryAfterSeconds}s.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(`usuarios:GET:${getClientIp(req)}`, 60, 60_000);
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const sp = req.nextUrl.searchParams;
  const busqueda = sp.get("q") ?? "";
  const tipoFiltro = sp.get("tipo") ?? "";

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (busqueda.trim()) {
      conditions.push(
        `(LOWER(u.nombre) LIKE $${idx} OR LOWER(u.correo) LIKE $${idx})`
      );
      params.push(`%${busqueda.trim().toLowerCase()}%`);
      idx++;
    }

    if (tipoFiltro && TIPOS_VALIDOS.includes(tipoFiltro as typeof TIPOS_VALIDOS[number])) {
      conditions.push(`u.tipo_usuario = $${idx}`);
      params.push(tipoFiltro);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Los totales del resumen no dependen de los filtros de la tabla.
    // El cupo se consulta aparte: usa el límite configurable y solo usuarios
    // activos, igual que la confirmación de promoción.
    const [result, totalesResult] = await Promise.all([
      pool.query(
        `SELECT
           u.id_usuario,
           u.nombre,
           u.correo,
           u.telefono,
           u.tipo_usuario,
           u.estado_usuario,
           u.id_bodega,
           u.requiere_2fa,
           b.nombre_bodega
         FROM usuario u
         LEFT JOIN bodega b ON b.id_bodega = u.id_bodega
         ${where}
         ORDER BY u.tipo_usuario, u.nombre`,
        params
      ),
      pool.query<{ tipo_usuario: string; total: number }>(
        `SELECT tipo_usuario, COUNT(*)::int AS total FROM usuario GROUP BY tipo_usuario`
      ),
    ]);

    const totales_por_tipo: Record<string, number> = Object.fromEntries(TIPOS_VALIDOS.map((tipo) => [tipo, 0]));
    for (const fila of totalesResult.rows) {
      if (fila.tipo_usuario in totales_por_tipo) totales_por_tipo[fila.tipo_usuario] = Number(fila.total) || 0;
    }
    const cupo = await leerCupo(pool, TIPOS_USUARIO.DUENO);
    const usados = cupo.activos;

    return NextResponse.json({
      usuarios: result.rows,
      totales_por_tipo,
      cupos_dueno: { usados, maximo: cupo.limite, disponibles: cupo.limite === null ? null : Math.max(0, cupo.limite - usados) },
    });
  } catch (error) {
    return apiError("USUARIOS GET", error);
  }
}

export async function PATCH(req: NextRequest) {
  const rl = await checkRateLimit(`usuarios:PATCH:${getClientIp(req)}`, 20, 60_000);
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const { id_usuario, tipo_usuario, estado_usuario, id_bodega, requiere_2fa } = body;

    const idNum = Number(id_usuario);
    if (!idNum || idNum < 1) {
      return validationError("id_usuario inválido");
    }

    // No puede editarse a sí mismo
    if (idNum === usuario.id_usuario) {
      return validationError("No puedes modificar tu propia cuenta desde este panel");
    }

    const actual = await pool.query(
      `SELECT tipo_usuario, id_bodega, estado_usuario, requiere_2fa
         FROM usuario
        WHERE id_usuario = $1`,
      [idNum]
    );
    if (actual.rowCount === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (tipo_usuario !== undefined) {
      if (!TIPOS_VALIDOS.includes(tipo_usuario)) {
        return validationError(
          `tipo_usuario inválido. Valores permitidos: ${TIPOS_VALIDOS.join(", ")}`
        );
      }

      // Volverse DUENO nunca pasa por esta edición "normal" de rol, ni
      // siquiera viniendo de otro dueño: tiene que pasar por el proceso de
      // /api/usuarios/promover-dueno, con código de verificación por correo
      // y respetando el límite configurado de dueños. Si ya es DUENO no es un
      // ascenso (es un no-op para este campo), así que lo dejamos pasar.
      if (tipo_usuario === TIPOS_USUARIO.DUENO && actual.rows[0].tipo_usuario !== TIPOS_USUARIO.DUENO) {
        return validationError(
          "Para dar el rol de Dueño hay que usar el proceso de promoción con verificación por correo (/api/usuarios/promover-dueno)."
        );
      }

      updates.push(`tipo_usuario = $${idx++}`);
      params.push(tipo_usuario);
    }

    const tipoFinal = tipo_usuario ?? actual.rows[0].tipo_usuario;

    if (id_bodega !== undefined) {
      const idBodegaNum = id_bodega === null ? null : Number(id_bodega);
      if (idBodegaNum !== null) {
        const bodega = await pool.query(`SELECT 1 FROM bodega WHERE id_bodega = $1`, [idBodegaNum]);
        if (bodega.rowCount === 0) {
          return validationError("Bodega no encontrada");
        }
      }
      updates.push(`id_bodega = $${idx++}`);
      params.push(idBodegaNum);
    }

    const idBodegaFinal = id_bodega !== undefined ? id_bodega : actual.rows[0].id_bodega;
    if (tipoFinal === TIPOS_USUARIO.BODEGUERO && !idBodegaFinal) {
      return validationError("Un usuario bodeguero necesita una bodega asignada");
    }

    if (estado_usuario !== undefined) {
      if (typeof estado_usuario !== "boolean") {
        return validationError("estado_usuario debe ser true o false");
      }
      updates.push(`estado_usuario = $${idx++}`);
      params.push(estado_usuario);
    }

    if (requiere_2fa !== undefined) {
      if (typeof requiere_2fa !== "boolean") {
        return validationError("requiere_2fa debe ser true o false");
      }
      updates.push(`requiere_2fa = $${idx++}`);
      params.push(requiere_2fa);
    }

    if (updates.length === 0) {
      return validationError("No se enviaron campos para actualizar");
    }

    params.push(idNum);

    const result = await pool.query(
      `UPDATE usuario
       SET ${updates.join(", ")}
       WHERE id_usuario = $${idx}
       RETURNING id_usuario, nombre, correo, tipo_usuario, estado_usuario, id_bodega, requiere_2fa`,
      params
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Rol, bodega, estado o exigencia de 2FA son parte de la identidad con la
    // que el usuario opera, y eso viaja dentro del JWT. Sin revocar la
    // sesión, el cambio no surte efecto real hasta que el token viejo expire
    // (8 h): un empleado degradado a Bodeguero seguiría viendo facturación.
    const cambiaPermisos =
      tipo_usuario !== undefined ||
      estado_usuario !== undefined ||
      requiere_2fa !== undefined ||
      id_bodega !== undefined;

    if (cambiaPermisos) {
      await revocarSesiones(idNum);

      // `detalle` guarda el antes y el después de cada campo tocado: sin eso,
      // "se cambió un permiso" no dice nada cuando se audite seis meses después.
      const antes = {
        tipo_usuario: actual.rows[0].tipo_usuario,
        id_bodega: actual.rows[0].id_bodega,
      };
      const despues = result.rows[0] as Record<string, unknown>;
      const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
      for (const campo of ["tipo_usuario", "id_bodega", "estado_usuario", "requiere_2fa"] as const) {
        if (despues[campo] !== undefined && despues[campo] !== antes[campo as keyof typeof antes]) {
          cambios[campo] = { antes: antes[campo as keyof typeof antes] ?? null, despues: despues[campo] };
        }
      }

      registrarAuditoria({
        id_usuario: idNum,
        correo: result.rows[0].correo,
        tipo_evento:
          estado_usuario === false
            ? TIPOS_EVENTO.USUARIO_DESHABILITADO
            : TIPOS_EVENTO.ROL_CAMBIADO,
        ip: getClientIp(req),
        user_agent: req.headers.get("user-agent"),
        detalle: { ...cambios, modificado_por: usuario.id_usuario, sesiones_revocadas: true },
      });

      log.info(
        { id_usuario: idNum, actor: usuario.id_usuario, tipo_usuario, estado_usuario, requiere_2fa, id_bodega },
        "Datos de acceso modificados; sesiones del usuario revocadas"
      );
    }

    return NextResponse.json({ usuario: result.rows[0] });
  } catch (error) {
    // El trigger de la BD rechaza reactivar o cambiar de tipo si se pasa del límite.
    return respuestaSiLimiteAlcanzado(error) ?? apiError("USUARIOS PATCH", error);
  }
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`usuarios:POST:${getClientIp(req)}`, 10, 60_000);
  if (rl.limited) return rateLimitedResponse(rl.retryAfterSeconds);

  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const { nombre, correo, contrasena, tipo_usuario, telefono, id_bodega, requiere_2fa } = body;

    if (!nombre || !correo || !contrasena) {
      return validationError("nombre, correo y contraseña son obligatorios");
    }

    // Validación de formato de correo (debe incluir @ y dominio)
    const correoRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correoRegex.test(String(correo).trim())) {
      return validationError(
        'El correo no es válido. Debe incluir "@" y un dominio (ej: nombre@empresa.com)'
      );
    }

    const errorContrasena = validarContrasena(contrasena);
    if (errorContrasena) {
      return validationError(errorContrasena);
    }

    // Un usuario nuevo nunca se crea directamente como DUENO: ese rol solo
    // se otorga a un usuario ya establecido, a través del proceso de
    // promoción con verificación por correo (/api/usuarios/promover-dueno).
    if (tipo_usuario === TIPOS_USUARIO.DUENO) {
      return validationError(
        "No se puede crear un usuario nuevo directamente como Dueño. Créalo con otro rol y después usa el proceso de promoción con verificación por correo."
      );
    }

    const tipoFinal =

      tipo_usuario && TIPOS_VALIDOS.includes(tipo_usuario)

        ? tipo_usuario

        : TIPOS_USUARIO.EMPLEADO;



    const correoFinal = String(correo).trim();

    let idBodegaFinal: number | null = null;
    if (tipoFinal === TIPOS_USUARIO.BODEGUERO) {
      idBodegaFinal = Number(id_bodega);
      if (!idBodegaFinal) {
        return validationError("Un usuario bodeguero necesita una bodega asignada");
      }
      const bodega = await pool.query(`SELECT 1 FROM bodega WHERE id_bodega = $1`, [idBodegaFinal]);
      if (bodega.rowCount === 0) {
        return validationError("Bodega no encontrada");
      }
    }


    // Verificar correo duplicado
    const existe = await pool.query(
      `SELECT id_usuario FROM usuario WHERE LOWER(correo) = LOWER($1)`,
      [correoFinal]
    );
    if (existe.rows.length > 0) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese correo" },
        { status: 409 }
      );
    }

    // Hash en el backend usando bcryptjs
    const bcrypt = await import("bcryptjs");
    const hash = bcrypt.hashSync(contrasena, 10);

    const telefonoFinal = typeof telefono === "string" ? telefono.trim() : null;

    // Solo tiene efecto real para EMPLEADO (ver /api/login); para DUENO y
    // BODEGUERO se guarda pero se ignora en el login. Por defecto TRUE.
    const requiere2faFinal = typeof requiere_2fa === "boolean" ? requiere_2fa : true;

    const result = await pool.query(
      `INSERT INTO usuario (nombre, correo, telefono, contrasena_hash, tipo_usuario, id_bodega, requiere_2fa)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_usuario, nombre, correo, tipo_usuario, estado_usuario, id_bodega, requiere_2fa`,
      [nombre.trim(), correoFinal, telefonoFinal, hash, tipoFinal, idBodegaFinal, requiere2faFinal]

    );

    registrarAuditoria({
      id_usuario: result.rows[0].id_usuario,
      correo: result.rows[0].correo,
      tipo_evento: TIPOS_EVENTO.USUARIO_CREADO,
      ip: getClientIp(req),
      user_agent: req.headers.get("user-agent"),
      detalle: {
        tipo_usuario: tipoFinal,
        creado_por: usuario.id_usuario,
        requiere_2fa: requiere2faFinal,
      },
    });

    log.info(
      { id_usuario: result.rows[0].id_usuario, tipo_usuario: tipoFinal, actor: usuario.id_usuario },
      "Usuario creado"
    );

    return NextResponse.json({ usuario: result.rows[0] }, { status: 201 });
  } catch (error) {
    // El trigger de la BD rechaza el alta si se pasa del límite del tipo.
    return respuestaSiLimiteAlcanzado(error) ?? apiError("USUARIOS POST", error);
  }
}