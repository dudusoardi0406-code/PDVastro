import "server-only";
import { db, must } from "@/lib/supabase/service";
import type {
  CategoryRow,
  EventRow,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  PaymentRow,
  PrintJobRow,
  ProductRow,
  SalesReport,
  TotemRow,
} from "@/lib/types";

// Consultas do painel. Sempre chamar depois de requireAdmin().

export async function listEvents(): Promise<EventRow[]> {
  return must(
    await db().from("events").select("*").order("active", { ascending: false }).order("starts_at", { ascending: false }),
    "eventos",
  ) as EventRow[];
}

export async function getEvent(id: string): Promise<EventRow | null> {
  return must(await db().from("events").select("*").eq("id", id).maybeSingle(), "evento") as EventRow | null;
}

export interface AdminMenu {
  categories: (CategoryRow & { products: ProductRow[] })[];
}

export async function getMenuForAdmin(eventId: string): Promise<AdminMenu> {
  const [cats, prods] = await Promise.all([
    db().from("categories").select("*").eq("event_id", eventId).order("position").order("created_at"),
    db().from("products").select("*").eq("event_id", eventId).order("position").order("created_at"),
  ]);
  const categories = must(cats, "categorias") as CategoryRow[];
  const products = must(prods, "produtos") as ProductRow[];
  return {
    categories: categories.map((c) => ({ ...c, products: products.filter((p) => p.category_id === c.id) })),
  };
}

export type TotemWithEvent = TotemRow & { event: { id: string; name: string } | null };

export async function listTotems(): Promise<TotemWithEvent[]> {
  return must(
    await db().from("totems").select("*, event:events(id, name)").order("created_at"),
    "totens",
  ) as TotemWithEvent[];
}

export const ONLINE_WINDOW_MS = 20_000;

export function isOnline(lastSeen: string | null): boolean {
  return !!lastSeen && Date.now() - Date.parse(lastSeen) < ONLINE_WINDOW_MS;
}

export interface OrderFilters {
  eventId: string;
  date: string;
  status?: OrderStatus | null;
  ticket?: string | null;
  page: number;
}

export const ORDERS_PAGE_SIZE = 50;

export type OrderListRow = OrderRow & { totem: { name: string } | null; items: { quantity: number }[] };

export async function listOrders(f: OrderFilters): Promise<{ rows: OrderListRow[]; total: number }> {
  let q = db()
    .from("orders")
    .select("*, totem:totems(name), items:order_items(quantity)", { count: "exact" })
    .eq("event_id", f.eventId)
    .eq("business_date", f.date)
    .order("created_at", { ascending: false })
    .range((f.page - 1) * ORDERS_PAGE_SIZE, f.page * ORDERS_PAGE_SIZE - 1);
  if (f.status) q = q.eq("status", f.status);
  if (f.ticket) q = q.ilike("ticket_code", `%${f.ticket.replace(/[%_]/g, "")}%`);
  const res = await q;
  return { rows: must(res, "pedidos") as OrderListRow[], total: res.count ?? 0 };
}

export interface OrderDetail {
  order: OrderRow;
  event: Pick<EventRow, "id" | "name">;
  totem: Pick<TotemRow, "id" | "name"> | null;
  items: OrderItemRow[];
  payments: PaymentRow[];
  printJobs: (PrintJobRow & { totem: { name: string } | null })[];
}

export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  const order = must(await db().from("orders").select("*").eq("id", id).maybeSingle(), "pedido") as OrderRow | null;
  if (!order) return null;
  const [event, totem, items, payments, jobs] = await Promise.all([
    db().from("events").select("id, name").eq("id", order.event_id).single(),
    order.totem_id ? db().from("totems").select("id, name").eq("id", order.totem_id).maybeSingle() : Promise.resolve(null),
    db().from("order_items").select("*").eq("order_id", id),
    db().from("payments").select("*").eq("order_id", id).order("created_at"),
    db().from("print_jobs").select("*, totem:totems(name)").eq("order_id", id).order("created_at"),
  ]);
  return {
    order,
    event: must(event, "evento do pedido") as OrderDetail["event"],
    totem: totem ? (must(totem, "totem do pedido") as OrderDetail["totem"]) : null,
    items: must(items, "itens") as OrderItemRow[],
    payments: must(payments, "pagamentos") as PaymentRow[],
    printJobs: must(jobs, "fichas") as OrderDetail["printJobs"],
  };
}

export async function salesReport(eventId: string, date: string): Promise<SalesReport> {
  return must(await db().rpc("sales_report", { p_event_id: eventId, p_date: date }), "relatório") as SalesReport;
}

export type CsvOrderRow = OrderRow & {
  items: Pick<OrderItemRow, "name_snapshot" | "quantity" | "unit_price_cents">[];
  payments: Pick<PaymentRow, "status" | "txid" | "e2e_id" | "paid_amount_cents">[];
};

/** Todos os pedidos do dia (paginando, o Supabase limita 1000 linhas por consulta). */
export async function ordersForExport(eventId: string, date: string): Promise<CsvOrderRow[]> {
  const pageSize = 500;
  const all: CsvOrderRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const rows = must(
      await db()
        .from("orders")
        .select("*, items:order_items(name_snapshot, quantity, unit_price_cents), payments(status, txid, e2e_id, paid_amount_cents)")
        .eq("event_id", eventId)
        .eq("business_date", date)
        .order("created_at")
        .range(from, from + pageSize - 1),
      "exportar pedidos",
    ) as CsvOrderRow[];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}
