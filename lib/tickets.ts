import "server-only";
import { db, must } from "@/lib/supabase/service";
import type { TicketData } from "@/lib/types";

interface PendingJobRow {
  id: string;
  kind: "original" | "reprint";
  order: {
    id: string;
    ticket_code: string | null;
    total_cents: number;
    paid_at: string | null;
    status: string;
    event: { name: string; venue: string | null } | null;
    items: { name_snapshot: string; quantity: number; unit_price_cents: number }[];
    payments: { status: string; e2e_id: string | null; txid: string }[];
  } | null;
}

/** Fichas pendentes de impressão para um totem (originais e reimpressões). */
export async function pendingTickets(totemId: string): Promise<TicketData[]> {
  const rows = must(
    await db()
      .from("print_jobs")
      .select(
        `id, kind,
         order:orders (
           id, ticket_code, total_cents, paid_at, status,
           event:events ( name, venue ),
           items:order_items ( name_snapshot, quantity, unit_price_cents ),
           payments ( status, e2e_id, txid )
         )`,
      )
      .eq("totem_id", totemId)
      .eq("status", "pendente")
      .order("created_at", { ascending: true })
      .limit(5),
    "fichas pendentes",
  ) as unknown as PendingJobRow[];

  return rows
    .filter((r) => r.order && r.order.status === "pago" && r.order.ticket_code)
    .map((r) => {
      const order = r.order!;
      const paid = order.payments.find((p) => p.status === "pago");
      const ref = paid?.e2e_id ?? paid?.txid ?? null;
      return {
        jobId: r.id,
        kind: r.kind,
        orderId: order.id,
        ticketCode: order.ticket_code!,
        eventName: order.event?.name ?? "",
        venue: order.event?.venue ?? null,
        paidAt: order.paid_at ?? new Date().toISOString(),
        totalCents: order.total_cents,
        items: order.items.map((i) => ({
          name: i.name_snapshot,
          quantity: i.quantity,
          unitPriceCents: i.unit_price_cents,
        })),
        pixRef: ref ? ref.slice(-8).toUpperCase() : null,
      };
    });
}
