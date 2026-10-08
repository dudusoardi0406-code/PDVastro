import type { NextRequest } from "next/server";
import { listEvents, ordersForExport } from "@/lib/admin-data";
import { formatDateTime, isIsoDate } from "@/lib/business-day";
import { isUuid } from "@/lib/http";
import { centsToInput } from "@/lib/money";
import { checkAdmin } from "@/lib/supabase/auth";
import { ORDER_STATUS_LABEL } from "@/lib/types";

// CSV do dia (uma linha por item). Separador ";" e vírgula decimal, como o Excel pt-BR espera.
export async function GET(req: NextRequest) {
  const check = await checkAdmin();
  if (check.status !== "ok") return new Response("Não autorizado", { status: 401 });

  const eventId = req.nextUrl.searchParams.get("evento");
  const date = req.nextUrl.searchParams.get("dia");
  if (!isUuid(eventId) || !isIsoDate(date)) return new Response("Parâmetros inválidos", { status: 400 });

  const event = (await listEvents()).find((e) => e.id === eventId);
  if (!event) return new Response("Evento não encontrado", { status: 404 });

  const orders = await ordersForExport(eventId, date);
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    ["dia_operacional", "senha", "status", "criado_em", "pago_em", "produto", "quantidade", "preco_unitario", "total_item", "total_pedido", "txid", "e2e_id", "pedido_id"],
  ];
  for (const o of orders) {
    const paid = o.payments.find((p) => p.status === "pago");
    for (const i of o.items) {
      lines.push([
        o.business_date,
        o.ticket_code ?? "",
        ORDER_STATUS_LABEL[o.status],
        formatDateTime(o.created_at),
        o.paid_at ? formatDateTime(o.paid_at) : "",
        i.name_snapshot,
        String(i.quantity),
        centsToInput(i.unit_price_cents),
        centsToInput(i.unit_price_cents * i.quantity),
        centsToInput(o.total_cents),
        paid?.txid ?? "",
        paid?.e2e_id ?? "",
        o.id,
      ]);
    }
  }

  const csv = "﻿" + lines.map((l) => l.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-${event.slug}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
