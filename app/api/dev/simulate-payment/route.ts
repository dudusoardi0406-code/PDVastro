import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, jsonError, readJson } from "@/lib/http";
import { syncByTxid } from "@/lib/pix/confirm";
import { simulateMockPayment } from "@/lib/pix/mock";
import { db, must } from "@/lib/supabase/service";
import { totemFromRequest, totemUnauthorized } from "@/lib/totem-auth";

const Body = z.object({
  txid: z.string().regex(/^[a-zA-Z0-9]{26,35}$/),
  /** valor diferente do pedido serve para testar "valor divergente" */
  paidCents: z.int().positive().optional(),
});

// Só para cobranças do provedor "mock": simula o cliente pagando o QR e
// segue o mesmo caminho do webhook (reconsulta + confirmação).
export async function POST(req: NextRequest) {
  const totem = await totemFromRequest(req);
  if (!totem) return totemUnauthorized();

  const body = await readJson(req, Body);
  if (body instanceof Response) return body;

  const payment = must(
    await db().from("payments").select("provider, order:orders(totem_id)").eq("txid", body.txid).maybeSingle(),
    "pagamento",
  ) as { provider: string; order: { totem_id: string | null } | null } | null;

  if (!payment || payment.provider !== "mock" || payment.order?.totem_id !== totem.id) {
    return jsonError("NAO_PERMITIDO", "Simulação disponível só para Pix de teste deste totem.", 403);
  }

  const simulated = await simulateMockPayment(body.txid, body.paidCents);
  const status = await syncByTxid(body.txid);
  return json({ simulated, status });
}
