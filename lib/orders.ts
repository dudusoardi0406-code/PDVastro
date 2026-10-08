import "server-only";
import { db, must } from "@/lib/supabase/service";
import { getPixProvider, newTxid } from "@/lib/pix";
import { EXPIRY_GRACE_MS, syncPayment } from "@/lib/pix/confirm";
import type { OrderRow, OrderStatus, PaymentRow, PaymentStatus } from "@/lib/types";

export interface CartItemInput {
  product_id: string;
  quantity: number;
}

export interface ChargeInfo {
  orderId: string;
  txid: string;
  pixCopiaECola: string;
  amountCents: number;
  expiresAt: string;
}

export async function createOrder(totemId: string, items: CartItemInput[]): Promise<string> {
  const result = must(
    await db().rpc("create_order", { p_totem_id: totemId, p_items: items }),
    "create_order",
  ) as { order_id: string };
  return result.order_id;
}

/** Abre uma cobrança Pix para o pedido (primeira vez ou "tentar de novo"). */
export async function startCharge(totemId: string, orderId: string): Promise<ChargeInfo> {
  const provider = getPixProvider();
  const txid = newTxid();

  const started = must(
    await db().rpc("start_payment", {
      p_order_id: orderId,
      p_totem_id: totemId,
      p_provider: provider.name,
      p_txid: txid,
    }),
    "start_payment",
  ) as { payment_id: string; amount_cents: number; expires_at: string; expiration_seconds: number; event_name: string };

  try {
    const created = await provider.criarCobranca({
      txid,
      amountCents: started.amount_cents,
      expiresInSeconds: started.expiration_seconds,
      description: `${started.event_name} - pedido no totem`,
    });
    must(
      await db()
        .from("payments")
        .update({ pix_copia_cola: created.pixCopiaECola, raw_provider: created.raw ?? null })
        .eq("id", started.payment_id),
      "salvar cobrança",
    );
    return {
      orderId,
      txid,
      pixCopiaECola: created.pixCopiaECola,
      amountCents: started.amount_cents,
      expiresAt: started.expires_at,
    };
  } catch (err) {
    await db().rpc("discard_payment", { p_payment_id: started.payment_id });
    throw err;
  }
}

export interface OrderStatusView {
  orderId: string;
  status: OrderStatus;
  ticketCode: string | null;
  totalCents: number;
  payment: { status: PaymentStatus; expiresAt: string; txid: string } | null;
}

async function loadOrder(totemId: string, orderId: string) {
  const order = must(
    await db()
      .from("orders")
      .select("id, status, ticket_code, total_cents, totem_id")
      .eq("id", orderId)
      .eq("totem_id", totemId)
      .maybeSingle(),
    "pedido",
  ) as Pick<OrderRow, "id" | "status" | "ticket_code" | "total_cents" | "totem_id"> | null;
  if (!order) return null;

  const payment = must(
    await db()
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "pagamento do pedido",
  ) as PaymentRow | null;

  return { order, payment };
}

/**
 * Status do pedido para o totem. Enquanto o Pix estiver pendente, aproveita
 * a consulta para checar o provedor (polling de segurança, com trava de ~2,5 s).
 */
export async function orderStatusForTotem(totemId: string, orderId: string): Promise<OrderStatusView | null> {
  let loaded = await loadOrder(totemId, orderId);
  if (!loaded) return null;

  const { order, payment } = loaded;
  if (order.status === "aguardando_pagamento" && payment?.status === "pendente") {
    const expired = Date.now() > Date.parse(payment.expires_at) + EXPIRY_GRACE_MS;
    const before = payment.status;
    const after = await syncPayment(payment, { force: expired });
    if (after !== before) loaded = await loadOrder(totemId, orderId);
  }
  if (!loaded) return null;

  return {
    orderId: loaded.order.id,
    status: loaded.order.status,
    ticketCode: loaded.order.ticket_code,
    totalCents: loaded.order.total_cents,
    payment: loaded.payment
      ? { status: loaded.payment.status, expiresAt: loaded.payment.expires_at, txid: loaded.payment.txid }
      : null,
  };
}

/** Cliente cancelou no totem: cancela o pedido e remove a cobrança no provedor. */
export async function cancelOrderForTotem(totemId: string, orderId: string): Promise<boolean> {
  const result = must(
    await db().rpc("cancel_order", { p_order_id: orderId, p_totem_id: totemId }),
    "cancel_order",
  ) as { cancelled: boolean; txids: string[] };

  if (result.txids.length) {
    const payments = must(
      await db().from("payments").select("txid, provider").in("txid", result.txids),
      "pagamentos cancelados",
    ) as Pick<PaymentRow, "txid" | "provider">[];
    await Promise.all(
      payments.map(async (p) => {
        try {
          await getPixProvider(p.provider).cancelarCobranca(p.txid);
        } catch (err) {
          // o cron continua conferindo cobranças canceladas por 20 minutos
          console.error(`[pix] falha ao remover cobrança ${p.txid}:`, err);
        }
      }),
    );
  }
  return result.cancelled;
}
