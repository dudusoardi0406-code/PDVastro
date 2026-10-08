import type { NextRequest } from "next/server";
import { errorResponse, json, jsonError } from "@/lib/http";
import { activeMenu } from "@/lib/menu";
import { totemFromRequest, totemUnauthorized } from "@/lib/totem-auth";

export async function GET(req: NextRequest) {
  try {
    const totem = await totemFromRequest(req);
    if (!totem) return totemUnauthorized();
    if (!totem.event_id) {
      return jsonError("TOTEM_SEM_EVENTO", "Este totem não está ligado a nenhum evento.", 409);
    }
    return json({ categories: await activeMenu(totem.event_id) });
  } catch (err) {
    return errorResponse(err);
  }
}
