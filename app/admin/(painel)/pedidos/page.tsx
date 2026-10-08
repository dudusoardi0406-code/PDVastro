import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listEvents, listOrders, ORDERS_PAGE_SIZE } from "@/lib/admin-data";
import { formatIsoDate, formatTime } from "@/lib/business-day";
import { formatBRL } from "@/lib/money";
import { requireAdmin } from "@/lib/supabase/auth";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { eventAndDate, param } from "../_lib/filters";
import { EventDayFilter } from "../_components/event-day-filter";
import { OrderStatusBadge } from "../_components/status-badges";
import { AutoRefresh } from "../../_components/auto-refresh";
import { buttonClass, EmptyState, Field, inputClass, PageHeader, PageSkeleton, Table } from "../../_components/ui";

export const metadata: Metadata = { title: "Pedidos" };

export default function OrdersPage(props: PageProps<"/admin/pedidos">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Orders searchParams={props.searchParams} />
    </Suspense>
  );
}

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

async function Orders({ searchParams }: { searchParams: PageProps<"/admin/pedidos">["searchParams"] }) {
  await requireAdmin();
  const search = await searchParams;
  const events = await listEvents();
  const { event, date } = eventAndDate(search, events);

  if (!event) {
    return (
      <>
        <PageHeader title="Pedidos" />
        <EmptyState title="Nenhum evento cadastrado" />
      </>
    );
  }

  const statusParam = param(search, "status");
  const status = STATUSES.includes(statusParam as OrderStatus) ? (statusParam as OrderStatus) : null;
  const ticket = param(search, "senha");
  const page = Math.max(1, Number(param(search, "pagina")) || 1);
  const { rows, total } = await listOrders({ eventId: event.id, date, status, ticket, page });
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));

  const pageHref = (p: number) => {
    const q = new URLSearchParams({ evento: event.id, dia: date, pagina: String(p) });
    if (status) q.set("status", status);
    if (ticket) q.set("senha", ticket);
    return `/admin/pedidos?${q}`;
  };

  return (
    <>
      <PageHeader
        title="Pedidos"
        description={`${event.name} · ${formatIsoDate(date)} · ${total} pedido(s)`}
        actions={<AutoRefresh seconds={15} />}
      />

      <EventDayFilter action="/admin/pedidos" events={events} eventId={event.id} date={date}>
        <Field label="Status">
          <select name="status" defaultValue={status ?? ""} className={inputClass}>
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Senha">
          <input name="senha" defaultValue={ticket ?? ""} placeholder="A-042" className={`${inputClass} w-28 uppercase`} />
        </Field>
      </EventDayFilter>

      {rows.length === 0 ? (
        <EmptyState title="Nenhum pedido encontrado">Ajuste os filtros ou escolha outro dia.</EmptyState>
      ) : (
        <Table head={["Senha", "Criado", "Pago", "Itens", "Total", "Status", "Ficha", "Totem"]}>
          {rows.map((o) => (
            <tr key={o.id} className="hover:bg-canvas/50">
              <td className="px-4 py-2.5">
                <Link href={`/admin/pedidos/${o.id}`} className="font-bold text-brand hover:underline">
                  {o.ticket_code ?? "ver"}
                </Link>
              </td>
              <td className="px-4 py-2.5 tabular-nums">{formatTime(o.created_at)}</td>
              <td className="px-4 py-2.5 tabular-nums">{formatTime(o.paid_at)}</td>
              <td className="px-4 py-2.5 tabular-nums">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
              <td className="px-4 py-2.5 font-semibold tabular-nums">{formatBRL(o.total_cents)}</td>
              <td className="px-4 py-2.5">
                <OrderStatusBadge status={o.status} />
              </td>
              <td className="px-4 py-2.5 text-xs text-muted">
                {o.status === "pago" ? (o.printed_at ? `impressa${o.print_count > 1 ? ` (${o.print_count}x)` : ""}` : "pendente") : "—"}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted">{o.totem?.name ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            Página {page} de {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className={buttonClass.secondary}>
                Anterior
              </Link>
            )}
            {page < pages && (
              <Link href={pageHref(page + 1)} className={buttonClass.secondary}>
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
