import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isOnline, listEvents, listTotems, salesReport } from "@/lib/admin-data";
import { businessDate, formatDateTime, formatIsoDate } from "@/lib/business-day";
import { formatBRL } from "@/lib/money";
import { requireAdmin } from "@/lib/supabase/auth";
import { PRESETS } from "@/lib/themes";
import { AutoRefresh } from "../_components/auto-refresh";
import { Badge, buttonClass, Card, EmptyState, Notice, PageHeader, PageSkeleton, Stat, TextLink } from "../_components/ui";

export const metadata: Metadata = { title: "Visão geral" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await requireAdmin();
  const today = businessDate();
  const [events, totems] = await Promise.all([listEvents(), listTotems()]);
  const active = events.filter((e) => e.active);
  const reports = await Promise.all(active.map((e) => salesReport(e.id, today)));

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`Dia operacional ${formatIsoDate(today)} (vira às 06:00).`}
        actions={
          <div className="flex items-center gap-3">
            <AutoRefresh seconds={20} />
            <Link href="/totem" target="_blank" className={buttonClass.secondary}>
              Abrir totem
            </Link>
          </div>
        }
      />

      {events.length === 0 && (
        <EmptyState title="Nenhum evento cadastrado">
          Crie o primeiro em <TextLink href="/admin/eventos">Eventos</TextLink> ou rode o <code>supabase/seed.sql</code> para dados de exemplo.
        </EmptyState>
      )}

      <div className="space-y-6">
        {active.map((event, i) => {
          const r = reports[i];
          const problems = r.pix_problems.length;
          return (
            <Card
              key={event.id}
              title={
                <span className="flex items-center gap-2">
                  {event.name} <Badge tone="blue">{PRESETS[event.theme?.preset ?? "pagode"]?.label ?? "Tema"}</Badge>
                </span>
              }
              description={event.venue ?? undefined}
              actions={
                <div className="flex gap-2">
                  <Link href={`/admin/pedidos?evento=${event.id}`} className={buttonClass.secondary}>
                    Pedidos
                  </Link>
                  <Link href={`/admin/relatorios?evento=${event.id}`} className={buttonClass.secondary}>
                    Relatório
                  </Link>
                </div>
              }
            >
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Vendido hoje" value={formatBRL(r.total_cents)} />
                <Stat label="Pedidos pagos" value={r.orders_paid} hint={`${r.items_sold} itens`} />
                <Stat
                  label="Ticket médio"
                  value={r.orders_paid ? formatBRL(Math.round(r.total_cents / r.orders_paid)) : "—"}
                />
                <Stat
                  label="Aguardando Pix"
                  value={r.orders_pending}
                  hint={`${r.orders_expired} expirados · ${r.orders_cancelled} cancelados`}
                />
              </div>
              {(problems > 0 || r.not_printed > 0) && (
                <div className="mt-4 space-y-2">
                  {problems > 0 && (
                    <Notice tone="red">
                      {problems} Pix com problema (valor divergente ou pago em duplicidade). Veja o{" "}
                      <TextLink href={`/admin/relatorios?evento=${event.id}`}>relatório</TextLink>.
                    </Notice>
                  )}
                  {r.not_printed > 0 && (
                    <Notice>
                      {r.not_printed} pedido(s) pago(s) ainda sem ficha impressa. Verifique o totem ou reimprima em{" "}
                      <TextLink href={`/admin/pedidos?evento=${event.id}&status=pago`}>Pedidos</TextLink>.
                    </Notice>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        <Card title="Totens" actions={<TextLink href="/admin/totens">Gerenciar</TextLink>}>
          {totems.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhum totem. Crie em <TextLink href="/admin/totens">Totens</TextLink> e abra o link de pareamento no aparelho.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {totems.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="font-medium">{t.name}</span>
                  <span className="flex items-center gap-2 text-muted">
                    {t.event?.name ?? "sem evento"}
                    {isOnline(t.last_seen_at) ? (
                      <Badge tone="green">online</Badge>
                    ) : (
                      <Badge tone="red">offline · {formatDateTime(t.last_seen_at)}</Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
