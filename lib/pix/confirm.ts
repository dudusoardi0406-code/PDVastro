import "server-only";
import { db, must } from "@/lib/supabase/service";
import { getPixProvider } from "@/lib/pix";
import type { PaymentRow, PaymentStatus } from "@/lib/types";

// Lógica única de confirmação. Toda confirmação passa por aqui:
// polling do totem, webhook e cron. Sempre consulta o provedor antes de
// marcar como pago (o payload do webhook nunca é prova de pagamento).

const FINAL: PaymentStatus[] = ["pago", "divergente", "duplicado"];

/** Folga depois do vencimento antes de expirar (o Pix pode estar a caminho). */
export const EXPIRY_GRACE_MS = 5_000;

export interface SyncOptions {
  /** ignora o intervalo mínimo entre consultas */
  force?: boolean;
  minIntervalMs?: number;
}

export async function syncPayment(payment: PaymentRow, opts: SyncOptions = {}): Promise<PaymentStatus> {
  if (FINAL.includes(payment.status)) return payment.status;

  const locked = must(
    await db().rpc("try_lock_payment_check", {
      p_payment_id: payment.id,
      p_min_interval_ms: opts.force ? 0 : (opts.minIntervalMs ?? 2_500),
    }),
    "try_lock_payment_check",
  ) as boolean;
  if (!locked) return payment.status;

  let lookup;
  try {
    lookup = await getPixProvider(payment.provider).consultarCobranca(payment.txid);
  } catch (err) {
    console.error(`[pix] falha ao consultar ${payment.txid}:`, err);
    return payment.status;
  }

  if (lookup.estado.status === "paga") {
    const result = must(
      await db().rpc("confirm_payment", {
        p_txid: payment.txid,
        p_paid_cents: lookup.estado.paidCents,
        p_e2e_id: lookup.estado.e2eId,
        p_raw: lookup.raw ?? null,
      }),
      "confirm_payment",
    ) as { result: string };

    if (result.result === "pago" || result.result === "ja_processado") return "pago";
    if (result.result === "divergente" || result.result === "duplicado") {
      console.warn(`[pix] pagamento ${payment.txid}: ${result.result}`);
      return result.result;
    }
    return payment.status;
  }

  if (payment.status === "pendente") {
    const expired = Date.now() > Date.parse(payment.expires_at) + EXPIRY_GRACE_MS;
    if (lookup.estado.status === "removida" || expired) {
      must(await db().rpc("expire_payment", { p_txid: payment.txid }), "expire_payment");
      return "expirado";
    }
  }

  return payment.status;
}

/** Usado pelo webhook: localiza o pagamento e reconsulta o provedor. */
export async function syncByTxid(txid: string): Promise<PaymentStatus | null> {
  const payment = must(
    await db().from("payments").select("*").eq("txid", txid).maybeSingle(),
    "payments por txid",
  ) as PaymentRow | null;
  if (!payment) return null;
  return syncPayment(payment, { force: true });
}
