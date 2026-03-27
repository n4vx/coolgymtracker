import { NextRequest, NextResponse } from "next/server";
import { validatePin, createToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { pin } = await request.json();

  if (!validatePin(pin)) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const token = createToken(pin);
  const response = NextResponse.json({ ok: true });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  return response;
}
