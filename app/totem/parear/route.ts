import { NextResponse, type NextRequest } from "next/server";
import { TOTEM_COOKIE, TOTEM_COOKIE_MAX_AGE, totemByToken } from "@/lib/totem-auth";

// Link de pareamento gerado no admin (/admin/totens): /totem/parear?t=TOKEN
// Guarda o token num cookie httpOnly e abre o totem.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const totem = await totemByToken(token);

  if (!totem || !token) {
    return NextResponse.redirect(new URL("/totem?erro=pareamento", req.url));
  }

  const res = NextResponse.redirect(new URL("/totem", req.url));
  res.cookies.set(TOTEM_COOKIE, token, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: TOTEM_COOKIE_MAX_AGE,
  });
  return res;
}
