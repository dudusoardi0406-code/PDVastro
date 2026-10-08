import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { db, must } from "@/lib/supabase/service";
import type { TotemRow } from "@/lib/types";

// O totem é identificado por um token aleatório guardado num cookie httpOnly.
// No banco fica só o hash (sha256).

export const TOTEM_COOKIE = "pdv_totem";
export const TOTEM_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;

export function newTotemToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function totemByToken(token: string | undefined | null): Promise<TotemRow | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  return must(
    await db().from("totems").select("*").eq("token_hash", hashToken(token)).maybeSingle(),
    "totem por token",
  ) as TotemRow | null;
}

export function totemFromRequest(req: NextRequest): Promise<TotemRow | null> {
  return totemByToken(req.cookies.get(TOTEM_COOKIE)?.value);
}

export function totemUnauthorized(): Response {
  return Response.json({ error: "TOTEM_NAO_PAREADO" }, { status: 401 });
}
