import type { Metadata } from "next";
import { Suspense } from "react";
import { isOnline, listEvents, listTotems, type TotemWithEvent } from "@/lib/admin-data";
import { formatDateTime } from "@/lib/business-day";
import { requireAdmin } from "@/lib/supabase/auth";
import type { EventRow } from "@/lib/types";
import { createTotem, deleteTotem, regenerateTotemLink, updateTotem } from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { Badge, Card, EmptyState, Field, inputClass, Notice, PageHeader, PageSkeleton } from "../../_components/ui";

export const metadata: Metadata = { title: "Totens" };

export default function TotemsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Totems />
    </Suspense>
  );
}

async function Totems() {
  await requireAdmin();
  const [totems, events] = await Promise.all([listTotems(), listEvents()]);

  return (
    <>
      <PageHeader
        title="Totens"
        description="Cada totem é pareado por um link secreto. Abra o link no navegador do totem uma vez; ele fica salvo."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {totems.length === 0 ? (
            <EmptyState title="Nenhum totem">Crie o primeiro ao lado.</EmptyState>
          ) : (
            totems.map((t) => <TotemCard key={t.id} totem={t} events={events} />)
          )}

          <Notice tone="blue">
            <b>No Windows do totem:</b> abra o Chrome em modo quiosque com impressão silenciosa (atalho no README):{" "}
            <code className="break-all">chrome.exe --kiosk --kiosk-printing https://SEU-DOMINIO/totem</code>. A impressora
            térmica precisa ser a padrão do Windows.
          </Notice>
        </div>

        <Card title="Novo totem">
          <ActionForm action={createTotem} className="space-y-3">
            <Field label="Nome">
              <input name="name" required maxLength={60} placeholder="Totem 1" className={inputClass} />
            </Field>
            <EventSelect events={events} />
            <PaperSelect />
            <SubmitButton className="w-full">Criar e gerar link</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}

function TotemCard({ totem, events }: { totem: TotemWithEvent; events: EventRow[] }) {
  const online = isOnline(totem.last_seen_at);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {totem.name}
          {online ? <Badge tone="green">online</Badge> : <Badge tone="red">offline</Badge>}
        </span>
      }
      description={`Último sinal: ${formatDateTime(totem.last_seen_at)}`}
    >
      <ActionForm action={updateTotem.bind(null, totem.id)} className="grid gap-3 sm:grid-cols-3">
        <Field label="Nome">
          <input name="name" defaultValue={totem.name} required maxLength={60} className={inputClass} />
        </Field>
        <EventSelect events={events} defaultValue={totem.event_id} />
        <PaperSelect defaultValue={totem.paper_width_mm} />
        <div className="sm:col-span-3">
          <SubmitButton variant="secondary">Salvar</SubmitButton>
        </div>
      </ActionForm>

      <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-line pt-4">
        <ActionForm
          action={regenerateTotemLink.bind(null, totem.id)}
          confirm="Gerar novo link? O aparelho pareado hoje vai parar de funcionar até abrir o novo link."
          className="flex-1"
        >
          <SubmitButton variant="secondary">Gerar link de pareamento</SubmitButton>
        </ActionForm>
        <ActionForm action={deleteTotem.bind(null, totem.id)} confirm={`Excluir o totem "${totem.name}"?`}>
          <SubmitButton variant="danger">Excluir</SubmitButton>
        </ActionForm>
      </div>
    </Card>
  );
}

function EventSelect({ events, defaultValue }: { events: EventRow[]; defaultValue?: string | null }) {
  return (
    <Field label="Evento atual">
      <select name="event_id" defaultValue={defaultValue ?? ""} className={inputClass}>
        <option value="">Nenhum (totem fechado)</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
            {e.active ? "" : " (inativo)"}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PaperSelect({ defaultValue = 80 }: { defaultValue?: number }) {
  return (
    <Field label="Papel da impressora">
      <select name="paper_width_mm" defaultValue={String(defaultValue)} className={inputClass}>
        <option value="80">80 mm</option>
        <option value="58">58 mm</option>
      </select>
    </Field>
  );
}
