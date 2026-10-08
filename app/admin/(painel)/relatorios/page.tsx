import type { Metadata } from "next";
import { Suspense } from "react";
import { listEvents, salesReport } from "@/lib/admin-data";
import { formatDateTime, formatIsoDate } from "@/lib/business-day";
import { formatBRL } from "@/lib/money";
import { requireAdmin } from "@/lib/supabase/auth";
import type { SalesReport } from "@/lib/types";
import { eventAndDate } from "../_lib/filters";
import { EventDayFilter } from "../_components/event-day-filter";
import { PaymentStatusBadge } from "../_components/status-badges";
import { buttonClass, Card, EmptyState, Notice, PageHeader, PageSkeleton, Stat, Table, TextLink } from "../../_components/ui";

export const metadata: Metadata = { title: "Relatórios" };

export default function ReportsPage(props: PageProps<"/admin/relatorios">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Reports searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Reports({ searchParams }: { searchParams: PageProps<"/admin/relatorios">["searchParams"] }) {
  await requireAdmin();
  const search = await searchParams;
  const events = await listEvents();
  const { event, date } = eventAndDate(search, events);
  if (!event) {
    return (
      <>
        <PageHeader title="Relatórios" />
        <EmptyState title="Nenhum evento cadastrado" />
      </>
    );
  }
  const r = await salesReport(event.id, date);
  const csvHref = `/admin/relatorios/csv?evento=${event.id}&dia=${date}`;

  return (
    <>
      <PageHeader
        title="Relatórios"
        description={`${event.name} · dia operacional ${formatIsoDate(date)}`}
        actions={
          <a href={csvHref} className={buttonClass.secondary}>
            Exportar CSV
          </a>
        }
      />
      <EventDayFilter action="/admin/relatorios" events={events} eventId={event.id} date={date} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total vendido" value={formatBRL(r.total_cents)} />
        <Stat label="Pedidos pagos" value={r.orders_paid} hint={`${r.orders_expired} expirados · ${r.orders_cancelled} cancelados`} />
        <Stat label="Ticket médio" value={r.orders_paid ? formatBRL(Math.round(r.total_cents / r.orders_paid)) : "—"} />
        <Stat label="Itens vendidos" value={r.items_sold} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reconciliation report={r} />
        <Card title="Vendas por hora" description="Hora do pagamento (horário de Porto Velho).">
          <HourBars rows={r.by_hour} />
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Por produto">
          {r.by_product.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma venda neste dia.</p>
          ) : (
            <Table head={["Produto", "Quantidade", "Total", "% do dia"]}>
              {r.by_product.map((p) => {
                const share = r.total_cents ? p.total_cents / r.total_cents : 0;
                return (
                  <tr key={p.name}>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 tabular-nums">{p.quantity}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatBRL(p.total_cents)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 rounded-full bg-canvas">
                          <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(2, share * 100)}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted">{(share * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

function Reconciliation({ report: r }: { report: SalesReport }) {
  const diff = r.pix_received_cents - r.total_cents;
  return (
    <Card title="Conciliação Pix" description="Soma dos Pix confirmados no provedor contra os pedidos pagos.">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Pix confirmados ({r.pix_received_count})</dt>
          <dd className="font-semibold tabular-nums">{formatBRL(r.pix_received_cents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Pedidos pagos ({r.orders_paid})</dt>
          <dd className="font-semibold tabular-nums">{formatBRL(r.total_cents)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2">
          <dt className="font-medium">Diferença</dt>
          <dd className={`font-bold tabular-nums ${diff === 0 ? "text-brand" : "text-danger"}`}>
            {diff === 0 ? "✓ conciliado" : formatBRL(diff)}
          </dd>
        </div>
      </dl>

      {r.not_printed > 0 && (
        <div className="mt-4">
          <Notice>{r.not_printed} pedido(s) pago(s) sem ficha impressa.</Notice>
        </div>
      )}

      {r.pix_problems.length > 0 && (
        <div className="mt-4 space-y-2">
          <Notice tone="red">
            Pix com problema: confira no extrato do banco e faça o estorno ou a entrega manual, se for o caso.
          </Notice>
          <ul className="divide-y divide-line text-sm">
            {r.pix_problems.map((p) => (
              <li key={p.payment_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2">
                  <PaymentStatusBadge status={p.status} />
                  <TextLink href={`/admin/pedidos/${p.order_id}`}>ver pedido</TextLink>
                </span>
                <span className="text-xs text-muted tabular-nums">
                  cobrado {formatBRL(p.amount_cents)} · pago {p.paid_amount_cents !== null ? formatBRL(p.paid_amount_cents) : "—"} ·{" "}
                  {formatDateTime(p.paid_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Barras horizontais (uma série): rótulo da hora, barra e valor. */
function HourBars({ rows }: { rows: SalesReport["by_hour"] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Nenhuma venda neste dia.</p>;
  const max = Math.max(...rows.map((h) => h.total_cents));
  return (
    <ul className="space-y-1.5">
      {rows.map((h) => (
        <li
          key={h.hour}
          className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-md px-1 py-0.5 text-sm hover:bg-canvas"
          title={`${String(h.hour).padStart(2, "0")}h: ${h.orders} pedido(s), ${formatBRL(h.total_cents)}`}
        >
          <span className="tabular-nums text-muted">{String(h.hour).padStart(2, "0")}h</span>
          <div className="h-3 rounded-r bg-canvas">
            <div className="h-3 rounded-r bg-brand" style={{ width: `${Math.max(1.5, (h.total_cents / max) * 100)}%` }} />
          </div>
          <span className="w-36 text-right tabular-nums">
            {formatBRL(h.total_cents)} <span className="text-xs text-muted">· {h.orders}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
