import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ usuario: null });
  }

  const usuario = verifyAuthToken(token);
  if (!usuario) {
    const res = NextResponse.json({ usuario: null });
    res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.json({ usuario });
}
