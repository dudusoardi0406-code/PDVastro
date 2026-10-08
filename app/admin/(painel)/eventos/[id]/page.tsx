import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getEvent } from "@/lib/admin-data";
import { isUuid } from "@/lib/http";
import { requireAdmin } from "@/lib/supabase/auth";
import { deleteEvent, updateEvent, updateEventTheme } from "../../../actions";
import { ActionForm, SubmitButton } from "../../../_components/action-form";
import { ThemeEditor } from "../../../_components/theme-editor";
import { buttonClass, Card, Checkbox, Field, inputClass, PageHeader, PageSkeleton } from "../../../_components/ui";
import { EventTabs } from "./event-tabs";

export const metadata: Metadata = { title: "Evento" };

export default function EventPage(props: PageProps<"/admin/eventos/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EventEditor params={props.params} />
    </Suspense>
  );
}

async function EventEditor({ params }: { params: PageProps<"/admin/eventos/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <>
      <PageHeader
        title={event.name}
        description={event.venue ?? undefined}
        actions={
          <Link href="/admin/eventos" className={buttonClass.secondary}>
            Voltar
          </Link>
        }
      />
      <EventTabs eventId={event.id} current="dados" />

      <div className="space-y-6">
        <Card title="Dados do evento">
          <ActionForm action={updateEvent.bind(null, event.id)} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <input name="name" defaultValue={event.name} required maxLength={120} className={inputClass} />
            </Field>
            <Field label="Endereço (slug)" hint="Identificador interno, sem espaços.">
              <input name="slug" defaultValue={event.slug} required maxLength={60} className={inputClass} />
            </Field>
            <Field label="Local">
              <input name="venue" defaultValue={event.venue ?? ""} maxLength={160} className={inputClass} />
            </Field>
            <Field label="Data">
              <input name="starts_at" type="date" defaultValue={event.starts_at} required className={inputClass} />
            </Field>
            <Field label="Prefixo da senha" hint="A senha sai como A-001, A-002… e reinicia a cada dia às 06:00.">
              <input
                name="ticket_prefix"
                defaultValue={event.ticket_prefix}
                required
                maxLength={2}
                pattern="[A-Za-z]{1,2}"
                className={`${inputClass} uppercase`}
              />
            </Field>
            <Field label="Validade do QR Pix (segundos)" hint="Entre 30 e 1800. Padrão: 300 (5 minutos).">
              <input
                name="pix_expiration_seconds"
                type="number"
                min={30}
                max={1800}
                defaultValue={event.pix_expiration_seconds}
                required
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox name="active" label="Evento ativo (aparece no totem)" defaultChecked={event.active} />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Salvar dados</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Visual do totem" description="Escolha o estilo, envie o logo e ajuste as cores. A prévia atualiza na hora.">
          <ThemeEditor eventName={event.name} theme={event.theme} action={updateEventTheme.bind(null, event.id)} />
        </Card>

        <Card title="Excluir evento" description="Só é possível excluir eventos sem pedidos. Com pedidos, desative.">
          <ActionForm action={deleteEvent.bind(null, event.id)} confirm={`Excluir o evento "${event.name}" e todo o cardápio?`}>
            <SubmitButton variant="danger">Excluir evento</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
