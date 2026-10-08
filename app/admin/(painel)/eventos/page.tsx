import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listEvents } from "@/lib/admin-data";
import { formatIsoDate } from "@/lib/business-day";
import { requireAdmin } from "@/lib/supabase/auth";
import { PRESETS } from "@/lib/themes";
import { createEvent } from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { Badge, Card, EmptyState, Field, inputClass, PageHeader, PageSkeleton, Table } from "../../_components/ui";

export const metadata: Metadata = { title: "Eventos" };

export default function EventsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Events />
    </Suspense>
  );
}

async function Events() {
  await requireAdmin();
  const events = await listEvents();

  return (
    <>
      <PageHeader title="Eventos e cardápio" description="Cada evento tem tema (visual do totem) e cardápio próprios." />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          {events.length === 0 ? (
            <EmptyState title="Nenhum evento ainda">Crie o primeiro ao lado.</EmptyState>
          ) : (
            <Table head={["Evento", "Data", "Tema", "Status", ""]}>
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-canvas/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/eventos/${e.id}`} className="font-semibold hover:underline">
                      {e.name}
                    </Link>
                    {e.venue && <div className="text-xs text-muted">{e.venue}</div>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatIsoDate(e.starts_at)}</td>
                  <td className="px-4 py-3">
                    <Badge tone="blue">{PRESETS[e.theme?.preset ?? "pagode"]?.label ?? "—"}</Badge>
                  </td>
                  <td className="px-4 py-3">{e.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/admin/eventos/${e.id}/cardapio`} className="text-sm font-medium text-brand hover:underline">
                      Cardápio
                    </Link>
                    <span className="mx-2 text-line">|</span>
                    <Link href={`/admin/eventos/${e.id}`} className="text-sm font-medium text-brand hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <Card title="Novo evento">
          <ActionForm action={createEvent} className="space-y-3">
            <Field label="Nome">
              <input name="name" required maxLength={120} placeholder="Pagode do Zé" className={inputClass} />
            </Field>
            <Field label="Local">
              <input name="venue" maxLength={160} placeholder="Zé Beer · Av. Lauro Sodré, 2182" className={inputClass} />
            </Field>
            <Field label="Data">
              <input name="starts_at" type="date" className={inputClass} />
            </Field>
            <Field label="Estilo do totem">
              <select name="preset" className={inputClass} defaultValue="pagode">
                {Object.entries(PRESETS).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <SubmitButton className="w-full">Criar evento</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
