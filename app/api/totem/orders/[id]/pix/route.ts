import type { NextRequest } from "next/server";
import { errorResponse, isUuid, json, jsonError } from "@/lib/http";
import { startCharge } from "@/lib/orders";
import { totemFromRequest, totemUnauthorized } from "@/lib/totem-auth";

// "Tentar de novo": nova cobrança para o mesmo pedido (depois de expirar ou de falha do provedor).
export async function POST(req: NextRequest, ctx: RouteContext<"/api/totem/orders/[id]/pix">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError("PEDIDO_NAO_ENCONTRADO", "Pedido não encontrado.", 404);

  const totem = await totemFromRequest(req);
  if (!totem) return totemUnauthorized();

  try {
    return json(await startCharge(totem.id, id), 201);
  } catch (err) {
    return errorResponse(err, { orderId: id });
  }
}
