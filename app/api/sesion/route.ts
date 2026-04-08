import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = req.cookies.get("session");
  if (!session) return NextResponse.json({ usuario: null });
  try {
    const usuario = JSON.parse(session.value);
    return NextResponse.json({ usuario });
  } catch {
    return NextResponse.json({ usuario: null });
  }
}
