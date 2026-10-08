import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getEvent, getMenuForAdmin, listEvents } from "@/lib/admin-data";
import { isUuid } from "@/lib/http";
import { centsToInput, formatBRL } from "@/lib/money";
import { requireAdmin } from "@/lib/supabase/auth";
import type { CategoryRow, ProductRow } from "@/lib/types";
import {
  copyMenu,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  toggleProduct,
  updateCategory,
  updateProduct,
} from "../../../../actions";
import { ActionForm, SubmitButton } from "../../../../_components/action-form";
import { ImageInput } from "../../../../_components/image-input";
import { Badge, buttonClass, Card, Checkbox, EmptyState, Field, inputClass, PageHeader, PageSkeleton } from "../../../../_components/ui";
import { EventTabs } from "../event-tabs";

export const metadata: Metadata = { title: "Cardápio" };

export default function MenuPage(props: PageProps<"/admin/eventos/[id]/cardapio">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MenuEditor params={props.params} />
    </Suspense>
  );
}

async function MenuEditor({ params }: { params: PageProps<"/admin/eventos/[id]/cardapio">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [event, menu, events] = await Promise.all([getEvent(id), getMenuForAdmin(id), listEvents()]);
  if (!event) notFound();
  const others = events.filter((e) => e.id !== event.id);
  const categories = menu.categories;

  return (
    <>
      <PageHeader
        title={event.name}
        description="Categorias e produtos que aparecem no totem deste evento."
        actions={
          <Link href="/admin/eventos" className={buttonClass.secondary}>
            Voltar
          </Link>
        }
      />
      <EventTabs eventId={event.id} current="cardapio" />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card title="Nova categoria">
          <ActionForm action={createCategory.bind(null, event.id)} className="flex gap-2">
            <input name="name" required maxLength={60} placeholder="Ex.: Cervejas" className={inputClass} />
            <SubmitButton>Adicionar</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="Copiar cardápio" description="Adiciona as categorias e produtos de outro evento a este.">
          {others.length === 0 ? (
            <p className="text-sm text-muted">Não há outros eventos.</p>
          ) : (
            <ActionForm
              action={copyMenu.bind(null, event.id)}
              className="flex gap-2"
              confirm="Copiar todas as categorias e produtos do evento escolhido para este?"
            >
              <select name="from_event" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Escolha o evento…
                </option>
                {others.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <SubmitButton variant="secondary">Copiar</SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>

      {categories.length === 0 ? (
        <EmptyState title="Cardápio vazio">Crie uma categoria acima ou copie de outro evento.</EmptyState>
      ) : (
        <div className="space-y-6">
          {categories.map((c) => (
            <CategoryCard key={c.id} eventId={event.id} category={c} categories={categories} />
          ))}
        </div>
      )}
    </>
  );
}

function CategoryCard({
  eventId,
  category,
  categories,
}: {
  eventId: string;
  category: CategoryRow & { products: ProductRow[] };
  categories: CategoryRow[];
}) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end gap-3 border-b border-line pb-4">
        <ActionForm action={updateCategory.bind(null, category.id)} className="flex flex-1 flex-wrap items-end gap-3">
          <Field label="Categoria" className="min-w-48 flex-1">
            <input name="name" defaultValue={category.name} required maxLength={60} className={`${inputClass} font-semibold`} />
          </Field>
          <Field label="Ordem" className="w-20">
            <input name="position" type="number" min={0} max={999} defaultValue={category.position} className={inputClass} />
          </Field>
          <div className="pb-2">
            <Checkbox name="active" label="Ativa" defaultChecked={category.active} />
          </div>
          <SubmitButton variant="secondary">Salvar</SubmitButton>
        </ActionForm>
        <ActionForm
          action={deleteCategory.bind(null, category.id)}
          confirm={`Excluir a categoria "${category.name}" e os ${category.products.length} produto(s) dela?`}
        >
          <SubmitButton variant="danger">Excluir</SubmitButton>
        </ActionForm>
      </div>

      {category.products.length === 0 && <p className="mb-3 text-sm text-muted">Nenhum produto nesta categoria.</p>}

      <ul className="divide-y divide-line">
        {category.products.map((p) => (
          <li key={p.id} className="py-2">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <div className="size-12 flex-none overflow-hidden rounded-lg border border-line bg-canvas">
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  {p.description && <div className="truncate text-xs text-muted">{p.description}</div>}
                </div>
                <span className="font-semibold tabular-nums">{formatBRL(p.price_cents)}</span>
                {p.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}
                <span className="text-xs text-brand group-open:hidden">Editar</span>
                <span className="hidden text-xs text-muted group-open:inline">Fechar</span>
              </summary>
              <div className="mt-3 rounded-lg bg-canvas/60 p-4">
                <ProductForm
                  action={updateProduct.bind(null, p.id)}
                  categories={categories}
                  product={p}
                  submitLabel="Salvar produto"
                />
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <ActionForm action={toggleProduct.bind(null, p.id, !p.active)}>
                    <SubmitButton variant="secondary">{p.active ? "Desativar" : "Ativar"}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteProduct.bind(null, p.id)} confirm={`Excluir "${p.name}"?`}>
                    <SubmitButton variant="danger">Excluir produto</SubmitButton>
                  </ActionForm>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>

      <details className="mt-3 rounded-lg border border-dashed border-line p-3">
        <summary className="cursor-pointer text-sm font-semibold text-brand">+ Novo produto em {category.name}</summary>
        <div className="mt-3">
          <ProductForm
            action={createProduct.bind(null, eventId)}
            categories={categories}
            defaultCategoryId={category.id}
            submitLabel="Criar produto"
          />
        </div>
      </details>
    </Card>
  );
}

function ProductForm({
  action,
  categories,
  product,
  defaultCategoryId,
  submitLabel,
}: {
  action: Parameters<typeof ActionForm>[0]["action"];
  categories: CategoryRow[];
  product?: ProductRow;
  defaultCategoryId?: string;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 md:grid-cols-[auto_1fr]">
      <Field label="Foto">
        <ImageInput name="image" currentUrl={product?.image_url} removeName={product ? "remove_image" : undefined} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome">
          <input name="name" defaultValue={product?.name} required maxLength={80} className={inputClass} />
        </Field>
        <Field label="Preço (R$)" hint="Ex.: 12,50">
          <input
            name="price"
            defaultValue={product ? centsToInput(product.price_cents) : ""}
            required
            inputMode="decimal"
            placeholder="0,00"
            className={inputClass}
          />
        </Field>
        <Field label="Descrição (opcional)" className="sm:col-span-2">
          <input name="description" defaultValue={product?.description ?? ""} maxLength={200} className={inputClass} />
        </Field>
        <Field label="Categoria">
          <select name="category_id" defaultValue={product?.category_id ?? defaultCategoryId} className={inputClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ordem">
          <input name="position" type="number" min={0} max={999} defaultValue={product?.position ?? 0} className={inputClass} />
        </Field>
        {product && (
          <div className="sm:col-span-2">
            <Checkbox name="active" label="Ativo (aparece no totem)" defaultChecked={product.active} />
          </div>
        )}
        <div className="sm:col-span-2">
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
