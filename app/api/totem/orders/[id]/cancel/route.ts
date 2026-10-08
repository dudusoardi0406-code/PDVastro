import type { NextRequest } from "next/server";
import { errorResponse, isUuid, json, jsonError } from "@/lib/http";
import { cancelOrderForTotem } from "@/lib/orders";
import { totemFromRequest, totemUnauthorized } from "@/lib/totem-auth";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/totem/orders/[id]/cancel">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError("PEDIDO_NAO_ENCONTRADO", "Pedido não encontrado.", 404);

  try {
    const totem = await totemFromRequest(req);
    if (!totem) return totemUnauthorized();
    return json({ cancelled: await cancelOrderForTotem(totem.id, id) });
  } catch (err) {
    return errorResponse(err);
  }
}
