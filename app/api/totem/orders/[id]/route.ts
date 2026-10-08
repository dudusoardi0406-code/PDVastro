import type { NextRequest } from "next/server";
import { errorResponse, isUuid, json, jsonError } from "@/lib/http";
import { orderStatusForTotem } from "@/lib/orders";
import { totemFromRequest, totemUnauthorized } from "@/lib/totem-auth";

// Consultado pelo totem a cada 2 s enquanto o QR está na tela.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/totem/orders/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError("PEDIDO_NAO_ENCONTRADO", "Pedido não encontrado.", 404);

  try {
    const totem = await totemFromRequest(req);
    if (!totem) return totemUnauthorized();

    const view = await orderStatusForTotem(totem.id, id);
    if (!view) return jsonError("PEDIDO_NAO_ENCONTRADO", "Pedido não encontrado.", 404);
    return json(view);
  } catch (err) {
    return errorResponse(err);
  }
}
