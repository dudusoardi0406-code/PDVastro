import type { NextRequest } from "next/server";
import { json, jsonError } from "@/lib/http";
import { syncPayment } from "@/lib/pix/confirm";
import { db, must } from "@/lib/supabase/service";
import type { PaymentRow } from "@/lib/types";

// Cron da Vercel (vercel.json, a cada minuto). Confere no provedor as cobranças
// em aberto e as expiradas/canceladas recentes: cobre totem offline e webhook
// que não chegou. A Vercel envia "Authorization: Bearer $CRON_SECRET".
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError("NAO_AUTORIZADO", "Não autorizado.", 401);
  }

  const payments = must(await db().rpc("payments_to_reconcile"), "payments_to_reconcile") as PaymentRow[];

  const summary: Record<string, number> = {};
  for (const payment of payments) {
    const status = await syncPayment(payment, { minIntervalMs: 10_000 });
    summary[status] = (summary[status] ?? 0) + 1;
  }

  const closed = must(await db().rpc("close_stale_orders"), "close_stale_orders") as number;

  return json({ checked: payments.length, summary, closedStaleOrders: closed });
}
