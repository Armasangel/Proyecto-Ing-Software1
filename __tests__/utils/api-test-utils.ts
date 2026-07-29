import { NextRequest } from "next/server";
import { AuthUsuario } from "@/lib/auth";
import { signAuthToken } from "@/lib/auth";
import { mockUsuarios } from "@/__tests__/mocks/data";

export const testUserDueno = mockUsuarios[0];
export const testUserEmpleado = mockUsuarios[1];

export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    cookies?: Record<string, string>;
    user?: AuthUsuario;
  } = {}
): NextRequest {
  const { method = "GET", body, cookies = {} } = options;
  const cookieEntries = { ...cookies };

  if (options.user) {
    const token = signAuthToken(options.user);
    cookieEntries["auth_token"] = token;
  }

  const cookieStr = Object.entries(cookieEntries)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookieStr ? { cookie: cookieStr } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export { createAuthToken } from "@/lib/auth";

export type MockQueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };

export function mockQueryResult(rows: Record<string, unknown>[]): MockQueryResult {
  return { rows, rowCount: rows.length };
}

export function mockQueryEmpty(): MockQueryResult {
  return { rows: [], rowCount: 0 };
}
