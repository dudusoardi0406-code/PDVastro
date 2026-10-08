"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { pixProviderName } from "@/lib/env";
import { bool, FormError, formErrorMessage, int, slugify, text } from "@/lib/forms";
import { parseBRLInput } from "@/lib/money";
import { syncByTxid } from "@/lib/pix/confirm";
import { registerItauWebhook } from "@/lib/pix/itau";
import { simulateMockPayment } from "@/lib/pix/mock";
import { hasFile, uploadImage } from "@/lib/storage";
import { authClient, checkAdmin, requireAdmin } from "@/lib/supabase/auth";
import { db, must } from "@/lib/supabase/service";
import { COLOR_FIELDS, isHexColor, isPreset, PRESETS, type EventTheme, type ThemeColors } from "@/lib/themes";
import { hashToken, newTotemToken } from "@/lib/totem-auth";
import type { EventRow, OrderRow } from "@/lib/types";

/** Executa a ação já autorizada; erros viram mensagem para o formulário. */
async function run(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    await requireAdmin();
    const result = (await fn()) ?? { ok: true, message: "Salvo." };
    refresh();
    return result;
  } catch (err) {
    unstable_rethrow(err);
    return { ok: false, error: formErrorMessage(err) };
  }
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
export async function signIn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = text(fd, "email", { max: 200 });
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  if (!email || !password) return { ok: false, error: "Informe e-mail e senha." };

  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "E-mail ou senha incorretos." };

  const check = await checkAdmin();
  if (check.status !== "ok") {
    await supabase.auth.signOut();
    return { ok: false, error: "Este usuário não tem acesso ao painel. Peça para incluí-lo na tabela admins." };
  }
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
export async function createEvent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | null = null;
  const state = await run(async () => {
    const name = text(fd, "name", { required: true, max: 120, label: "Nome" })!;
    const slug = slugify(text(fd, "slug", { max: 60 }) ?? name);
    if (slug.length < 2) throw new FormError("Endereço (slug) inválido.");
    const preset = fd.get("preset");
    const row = must(
      await db()
        .from("events")
        .insert({
          name,
          slug,
          venue: text(fd, "venue", { max: 160 }),
          starts_at: text(fd, "starts_at") ?? undefined,
          theme: { preset: isPreset(preset) ? preset : "pagode" },
        })
        .select("id")
        .single(),
      "criar evento",
    ) as { id: string };
    id = row.id;
  });
  if (id) redirect(`/admin/eventos/${id}`);
  return state;
}

export async function updateEvent(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const name = text(fd, "name", { required: true, max: 120, label: "Nome" })!;
    const slug = slugify(text(fd, "slug", { required: true, max: 60, label: "Endereço" })!);
    const prefix = (text(fd, "ticket_prefix", { required: true, max: 2, label: "Prefixo da senha" }) ?? "A").toUpperCase();
    if (!/^[A-Z]{1,2}$/.test(prefix)) throw new FormError("Prefixo da senha: use 1 ou 2 letras (ex.: A).");
    must(
      await db()
        .from("events")
        .update({
          name,
          slug,
          venue: text(fd, "venue", { max: 160 }),
          starts_at: text(fd, "starts_at", { required: true, label: "Data" }),
          ticket_prefix: prefix,
          pix_expiration_seconds: int(fd, "pix_expiration_seconds", { min: 30, max: 1800, label: "Validade do Pix" }),
          active: bool(fd, "active"),
        })
        .eq("id", eventId),
      "salvar evento",
    );
    return { ok: true, message: "Evento salvo." };
  });
}

export async function updateEventTheme(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const current = must(
      await db().from("events").select("theme").eq("id", eventId).single(),
      "tema atual",
    ) as Pick<EventRow, "theme">;

    const presetValue = fd.get("preset");
    const preset = isPreset(presetValue) ? presetValue : "pagode";
    const defaults = PRESETS[preset].colors;

    // guarda só as cores diferentes do preset
    const colors: Partial<ThemeColors> = {};
    for (const { key } of COLOR_FIELDS) {
      const value = fd.get(`color_${key}`);
      if (isHexColor(value) && value.toLowerCase() !== defaults[key].toLowerCase()) colors[key] = value;
    }

    const theme: EventTheme = {
      preset,
      colors,
      tagline: text(fd, "tagline", { max: 80 }),
      logoUrl: current.theme?.logoUrl ?? null,
      backgroundUrl: current.theme?.backgroundUrl ?? null,
    };

    if (bool(fd, "remove_logo")) theme.logoUrl = null;
    if (bool(fd, "remove_background")) theme.backgroundUrl = null;
    const logo = fd.get("logo");
    if (hasFile(logo)) theme.logoUrl = await uploadImage(logo, `events/${eventId}`);
    const background = fd.get("background");
    if (hasFile(background)) theme.backgroundUrl = await uploadImage(background, `events/${eventId}`);

    must(await db().from("events").update({ theme }).eq("id", eventId), "salvar tema");
    return { ok: true, message: "Tema salvo. O totem atualiza em até 5 segundos." };
  });
}

export async function deleteEvent(eventId: string, _prev: ActionState): Promise<ActionState> {
  let deleted = false;
  const state = await run(async () => {
    const { count } = await db().from("orders").select("id", { count: "exact", head: true }).eq("event_id", eventId);
    if ((count ?? 0) > 0) throw new FormError("Este evento já tem pedidos. Desative-o em vez de excluir.");
    must(await db().from("events").delete().eq("id", eventId), "excluir evento");
    deleted = true;
  });
  if (deleted) redirect("/admin/eventos");
  return state;
}

// ---------------------------------------------------------------------------
// Cardápio
// ---------------------------------------------------------------------------
export async function createCategory(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { data: last } = await db()
      .from("categories")
      .select("position")
      .eq("event_id", eventId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    must(
      await db()
        .from("categories")
        .insert({
          event_id: eventId,
          name: text(fd, "name", { required: true, max: 60, label: "Nome da categoria" }),
          position: ((last as { position: number } | null)?.position ?? 0) + 1,
        }),
      "criar categoria",
    );
    return { ok: true, message: "Categoria criada." };
  });
}

export async function updateCategory(categoryId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    must(
      await db()
        .from("categories")
        .update({
          name: text(fd, "name", { required: true, max: 60, label: "Nome da categoria" }),
          position: int(fd, "position", { min: 0, max: 999, fallback: 0, label: "Ordem" }),
          active: bool(fd, "active"),
        })
        .eq("id", categoryId),
      "salvar categoria",
    );
    return { ok: true, message: "Categoria salva." };
  });
}

export async function deleteCategory(categoryId: string, _prev: ActionState): Promise<ActionState> {
  return run(async () => {
    must(await db().from("categories").delete().eq("id", categoryId), "excluir categoria");
    return { ok: true, message: "Categoria excluída." };
  });
}

function productFields(fd: FormData) {
  const price = parseBRLInput(text(fd, "price", { required: true, label: "Preço" })!);
  if (price === null || price <= 0) throw new FormError("Preço inválido. Exemplo: 12,50");
  return {
    category_id: text(fd, "category_id", { required: true, label: "Categoria" }),
    name: text(fd, "name", { required: true, max: 80, label: "Nome" }),
    description: text(fd, "description", { max: 200, label: "Descrição" }),
    price_cents: price,
    position: int(fd, "position", { min: 0, max: 999, fallback: 0, label: "Ordem" }),
  };
}

export async function createProduct(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const fields = productFields(fd);
    const image = fd.get("image");
    const image_url = hasFile(image) ? await uploadImage(image, `events/${eventId}/products`) : null;
    must(await db().from("products").insert({ ...fields, event_id: eventId, image_url }), "criar produto");
    return { ok: true, message: "Produto criado." };
  });
}

export async function updateProduct(productId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const product = must(
      await db().from("products").select("event_id").eq("id", productId).single(),
      "produto",
    ) as { event_id: string };
    const update: Record<string, unknown> = { ...productFields(fd), active: bool(fd, "active") };
    if (bool(fd, "remove_image")) update.image_url = null;
    const image = fd.get("image");
    if (hasFile(image)) update.image_url = await uploadImage(image, `events/${product.event_id}/products`);
    must(await db().from("products").update(update).eq("id", productId), "salvar produto");
    return { ok: true, message: "Produto salvo." };
  });
}

export async function toggleProduct(productId: string, active: boolean, _prev: ActionState): Promise<ActionState> {
  return run(async () => {
    must(await db().from("products").update({ active }).eq("id", productId), "ativar/desativar produto");
    return { ok: true, message: active ? "Produto ativado." : "Produto desativado." };
  });
}

export async function deleteProduct(productId: string, _prev: ActionState): Promise<ActionState> {
  return run(async () => {
    must(await db().from("products").delete().eq("id", productId), "excluir produto");
    return { ok: true, message: "Produto excluído." };
  });
}

export async function copyMenu(toEventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const from = text(fd, "from_event", { required: true, label: "Evento de origem" });
    const copied = must(await db().rpc("copy_menu", { p_from: from, p_to: toEventId }), "copiar cardápio") as number;
    return { ok: true, message: `${copied} produto(s) copiado(s).` };
  });
}

// ---------------------------------------------------------------------------
// Totens
// ---------------------------------------------------------------------------
function paperWidth(fd: FormData): 58 | 80 {
  return fd.get("paper_width_mm") === "58" ? 58 : 80;
}

export async function createTotem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const token = newTotemToken();
    must(
      await db()
        .from("totems")
        .insert({
          name: text(fd, "name", { required: true, max: 60, label: "Nome do totem" }),
          event_id: text(fd, "event_id"),
          paper_width_mm: paperWidth(fd),
          token_hash: hashToken(token),
        }),
      "criar totem",
    );
    return {
      ok: true,
      message: "Totem criado. Abra o link abaixo no navegador do totem (ele só aparece agora).",
      link: `${await origin()}/totem/parear?t=${token}`,
    };
  });
}

export async function regenerateTotemLink(totemId: string, _prev: ActionState): Promise<ActionState> {
  return run(async () => {
    const token = newTotemToken();
    must(await db().from("totems").update({ token_hash: hashToken(token) }).eq("id", totemId), "novo link");
    return {
      ok: true,
      message: "Novo link gerado. O link antigo deixou de funcionar.",
      link: `${await origin()}/totem/parear?t=${token}`,
    };
  });
}

export async function updateTotem(totemId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    must(
      await db()
        .from("totems")
        .update({
          name: text(fd, "name", { required: true, max: 60, label: "Nome do totem" }),
          event_id: text(fd, "event_id"),
          paper_width_mm: paperWidth(fd),
        })
        .eq("id", totemId),
      "salvar totem",
    );
    return { ok: true, message: "Totem salvo." };
  });
}

export async function deleteTotem(totemId: string, _prev: ActionState): Promise<ActionState> {
  return run(async () => {
    must(await db().from("totems").delete().eq("id", totemId), "excluir totem");
    return { ok: true, message: "Totem excluído." };
  });
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------
export async function reprintOrder(orderId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const order = must(
      await db().from("orders").select("status, totem_id").eq("id", orderId).single(),
      "pedido",
    ) as Pick<OrderRow, "status" | "totem_id">;
    if (order.status !== "pago") throw new FormError("Só pedidos pagos podem ser reimpressos.");
    const totemId = text(fd, "totem_id") ?? order.totem_id;
    if (!totemId) throw new FormError("Escolha em qual totem imprimir.");
    must(
      await db().from("print_jobs").insert({ order_id: orderId, totem_id: totemId, kind: "reprint" }),
      "reimprimir",
    );
    return { ok: true, message: "Reimpressão enviada. O totem imprime em até 5 segundos." };
  });
}

// ---------------------------------------------------------------------------
// Pix
// ---------------------------------------------------------------------------
export async function registerWebhook(_prev: ActionState): Promise<ActionState> {
  return run(async () => {
    if (pixProviderName() !== "itau") throw new FormError("Disponível só com PIX_PROVIDER=itau.");
    const secret = process.env.PIX_WEBHOOK_SECRET;
    if (!secret || secret.length < 16) throw new FormError("Defina PIX_WEBHOOK_SECRET (mínimo 16 caracteres).");
    const url = `${await origin()}/api/webhooks/pix/${secret}`;
    try {
      await registerItauWebhook(url);
    } catch (err) {
      throw new FormError(`Itaú recusou o cadastro: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { ok: true, message: "Webhook cadastrado no Itaú." };
  });
}

export async function simulatePaymentAdmin(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const txid = text(fd, "txid", { required: true, max: 35, label: "txid" })!;
    const paid = text(fd, "paid");
    const paidCents = paid ? parseBRLInput(paid) : undefined;
    if (paid && !paidCents) throw new FormError("Valor pago inválido.");

    const payment = must(
      await db().from("payments").select("provider").eq("txid", txid).maybeSingle(),
      "pagamento",
    ) as { provider: string } | null;
    if (!payment) throw new FormError("Cobrança não encontrada.");
    if (payment.provider !== "mock") throw new FormError("Só cobranças de teste (mock) podem ser simuladas.");

    const simulated = await simulateMockPayment(txid, paidCents ?? undefined);
    const status = await syncByTxid(txid);
    return {
      ok: simulated,
      message: simulated ? `Pagamento simulado. Status: ${status}.` : undefined,
      error: simulated ? undefined : "Cobrança já paga ou removida.",
    };
  });
}
