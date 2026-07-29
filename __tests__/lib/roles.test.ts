import {
  TIPOS_USUARIO,
  isStaffTipo,
  isDuenoTipo,
  isColaboradorTipo,
  labelRol,
  postLoginPath,
  staffVariantFromTipo,
} from "@/lib/roles";

describe("TIPOS_USUARIO", () => {
  it("has the expected role constants", () => {
    expect(TIPOS_USUARIO.DUENO).toBe("DUENO");
    expect(TIPOS_USUARIO.EMPLEADO).toBe("EMPLEADO");
  });
});

describe("isStaffTipo", () => {
  it("returns true for DUENO", () => {
    expect(isStaffTipo(TIPOS_USUARIO.DUENO)).toBe(true);
  });

  it("returns true for EMPLEADO", () => {
    expect(isStaffTipo(TIPOS_USUARIO.EMPLEADO)).toBe(true);
  });

  it("returns false for unknown roles", () => {
    expect(isStaffTipo("ADMIN")).toBe(false);
    expect(isStaffTipo("ADMINISTRADOR")).toBe(false);
    expect(isStaffTipo("CLIENTE")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isStaffTipo("")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isStaffTipo("dueno")).toBe(false);
    expect(isStaffTipo("empleado")).toBe(false);
  });
});

describe("isDuenoTipo", () => {
  it("returns true for DUENO", () => {
    expect(isDuenoTipo(TIPOS_USUARIO.DUENO)).toBe(true);
  });

  it("returns false for EMPLEADO", () => {
    expect(isDuenoTipo(TIPOS_USUARIO.EMPLEADO)).toBe(false);
  });

  it("returns false for unknown roles", () => {
    expect(isDuenoTipo("")).toBe(false);
    expect(isDuenoTipo("ADMIN")).toBe(false);
  });
});

describe("isColaboradorTipo", () => {
  it("returns true for EMPLEADO", () => {
    expect(isColaboradorTipo(TIPOS_USUARIO.EMPLEADO)).toBe(true);
  });

  it("returns false for DUENO", () => {
    expect(isColaboradorTipo(TIPOS_USUARIO.DUENO)).toBe(false);
  });

  it("returns false for unknown roles", () => {
    expect(isColaboradorTipo("ADMIN")).toBe(false);
    expect(isColaboradorTipo("")).toBe(false);
  });
});

describe("labelRol", () => {
  it('returns "Dueño" for DUENO', () => {
    expect(labelRol(TIPOS_USUARIO.DUENO)).toBe("Dueño");
  });

  it('returns "Colaborador" for EMPLEADO', () => {
    expect(labelRol(TIPOS_USUARIO.EMPLEADO)).toBe("Colaborador");
  });

  it("returns the input string for unknown roles", () => {
    expect(labelRol("ADMIN")).toBe("ADMIN");
    expect(labelRol("")).toBe("");
    expect(labelRol("CLIENTE")).toBe("CLIENTE");
  });
});

describe("postLoginPath", () => {
  it('returns "/dashboard" for DUENO', () => {
    expect(postLoginPath(TIPOS_USUARIO.DUENO)).toBe("/dashboard");
  });

  it('returns "/ventas" for EMPLEADO', () => {
    expect(postLoginPath(TIPOS_USUARIO.EMPLEADO)).toBe("/ventas");
  });

  it('returns "/dashboard" as default for unknown roles', () => {
    expect(postLoginPath("ADMIN")).toBe("/dashboard");
    expect(postLoginPath("")).toBe("/dashboard");
    expect(postLoginPath("CLIENTE")).toBe("/dashboard");
  });
});

describe("staffVariantFromTipo", () => {
  it('returns "dueno" for DUENO', () => {
    expect(staffVariantFromTipo(TIPOS_USUARIO.DUENO)).toBe("dueno");
  });

  it('returns "colaborador" for EMPLEADO', () => {
    expect(staffVariantFromTipo(TIPOS_USUARIO.EMPLEADO)).toBe("colaborador");
  });

  it('returns "colaborador" as default for unknown roles', () => {
    expect(staffVariantFromTipo("ADMIN")).toBe("colaborador");
    expect(staffVariantFromTipo("")).toBe("colaborador");
  });
});
