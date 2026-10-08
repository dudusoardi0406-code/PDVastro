import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getOrderDetail, listTotems } from "@/lib/admin-data";
import { formatDateTime, formatIsoDate } from "@/lib/business-day";
import { isUuid } from "@/lib/http";
import { formatBRL } from "@/lib/money";
import { requireAdmin } from "@/lib/supabase/auth";
import { reprintOrder } from "../../../actions";
import { ActionForm, SubmitButton } from "../../../_components/action-form";
import { Badge, buttonClass, Card, Field, inputClass, PageHeader, PageSkeleton, Table } from "../../../_components/ui";
import { OrderStatusBadge, PaymentStatusBadge } from "../../_components/status-badges";

export const metadata: Metadata = { title: "Pedido" };

export default function OrderPage(props: PageProps<"/admin/pedidos/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Order params={props.params} />
    </Suspense>
  );
}

async function Order({ params }: { params: PageProps<"/admin/pedidos/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [detail, totems] = await Promise.all([getOrderDetail(id), listTotems()]);
  if (!detail) notFound();
  const { order, event, totem, items, payments, printJobs } = detail;

  return (
    <>
      <PageHeader
        title={order.ticket_code ? `Senha ${order.ticket_code}` : "Pedido sem senha"}
        description={`${event.name} · dia ${formatIsoDate(order.business_date)} · criado ${formatDateTime(order.created_at)}`}
        actions={
          <Link href={`/admin/pedidos?evento=${event.id}&dia=${order.business_date}`} className={buttonClass.secondary}>
            Voltar
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Itens" actions={<OrderStatusBadge status={order.status} />}>
            <ul className="divide-y divide-line text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2">
                  <span>
                    <b>{i.quantity}x</b> {i.name_snapshot} <span className="text-muted">({formatBRL(i.unit_price_cents)})</span>
                  </span>
                  <span className="tabular-nums">{formatBRL(i.quantity * i.unit_price_cents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatBRL(order.total_cents)}</span>
            </div>
          </Card>

          <Card title="Cobranças Pix">
            <Table head={["Status", "Valor", "Pago", "txid / E2E", "Criada", "Pago em"]}>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5">
                    <PaymentStatusBadge status={p.status} />
                    <div className="mt-1 text-xs text-muted">{p.provider}</div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{formatBRL(p.amount_cents)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{p.paid_amount_cents !== null ? formatBRL(p.paid_amount_cents) : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs break-all">
                    {p.txid}
                    {p.e2e_id && <div className="text-muted">{p.e2e_id}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{formatDateTime(p.created_at)}</td>
                  <td className="px-4 py-2.5 text-xs">{formatDateTime(p.paid_at)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Ficha">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Totem</dt>
                <dd>{totem?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Primeira impressão</dt>
                <dd>{formatDateTime(order.printed_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Vezes impressa</dt>
                <dd>{order.print_count}</dd>
              </div>
            </dl>
            {printJobs.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
                {printJobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2">
                    <span>
                      {j.kind === "original" ? "Original" : "Reimpressão"} · {j.totem?.name ?? "—"}
                    </span>
                    {j.status === "impresso" ? (
                      <Badge tone="green">{formatDateTime(j.printed_at)}</Badge>
                    ) : (
                      <Badge tone="yellow">{j.status}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {order.status === "pago" && (
            <Card title="Reimprimir ficha" description="O totem escolhido imprime em até 5 segundos (precisa estar online).">
              <ActionForm action={reprintOrder.bind(null, order.id)} className="space-y-3">
                <Field label="Imprimir no totem">
                  <select name="totem_id" defaultValue={order.totem_id ?? ""} className={inputClass}>
                    {totems.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <SubmitButton className="w-full">Reimprimir</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
