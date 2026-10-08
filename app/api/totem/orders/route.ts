import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, json, readJson } from "@/lib/http";
import { createOrder, startCharge } from "@/lib/orders";
import { totemFromRequest, totemUnauthorized } from "@/lib/totem-auth";

const Body = z.object({
  items: z
    .array(
      z.object({
        product_id: z.uuid(),
        quantity: z.int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
});

// Cria o pedido (total recalculado no banco) e já abre a cobrança Pix.
export async function POST(req: NextRequest) {
  const totem = await totemFromRequest(req);
  if (!totem) return totemUnauthorized();

  const body = await readJson(req, Body);
  if (body instanceof Response) return body;

  let orderId: string;
  try {
    orderId = await createOrder(totem.id, body.items);
  } catch (err) {
    return errorResponse(err);
  }

  try {
    return json(await startCharge(totem.id, orderId), 201);
  } catch (err) {
    // pedido criado, Pix falhou: o totem pode tentar de novo com /orders/:id/pix
    return errorResponse(err, { orderId });
  }
}
