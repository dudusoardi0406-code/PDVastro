import "server-only";
import { db, must } from "@/lib/supabase/service";
import { centsToDecimal } from "@/lib/money";
import { txidsFromBacenWebhook, type PixProvider } from "@/lib/pix/types";

// Provedor de teste (PIX_PROVIDER=mock). Guarda as cobranças na tabela
// mock_pix_charges para funcionar igual em vários processos/instâncias.

export const mockProvider: PixProvider = {
  name: "mock",

  async criarCobranca({ txid, amountCents }) {
    must(await db().from("mock_pix_charges").insert({ txid, amount_cents: amountCents }), "mock: criar cobrança");
    return {
      pixCopiaECola: `PIX-SIMULADO|${txid}|R$${centsToDecimal(amountCents)}`,
      raw: { mock: true, txid, amount_cents: amountCents },
    };
  },

  async consultarCobranca(txid) {
    const row = must(
      await db().from("mock_pix_charges").select("*").eq("txid", txid).maybeSingle(),
      "mock: consultar cobrança",
    ) as { txid: string; amount_cents: number; paid_cents: number | null; removed: boolean } | null;

    if (!row || (row.removed && row.paid_cents === null)) {
      return { estado: { status: "removida" }, raw: row };
    }
    if (row.paid_cents !== null) {
      return {
        estado: { status: "paga", paidCents: row.paid_cents, e2eId: `E00000000MOCK${txid.slice(0, 16)}` },
        raw: row,
      };
    }
    return { estado: { status: "ativa" }, raw: row };
  },

  async cancelarCobranca(txid) {
    must(
      await db().from("mock_pix_charges").update({ removed: true }).eq("txid", txid).is("paid_cents", null),
      "mock: cancelar cobrança",
    );
  },

  tratarWebhook: txidsFromBacenWebhook,
};

/** Simula o cliente pagando o QR. paidCents diferente do valor serve para testar divergência. */
export async function simulateMockPayment(txid: string, paidCents?: number): Promise<boolean> {
  const row = must(
    await db().from("mock_pix_charges").select("amount_cents, removed, paid_cents").eq("txid", txid).maybeSingle(),
    "mock: simular pagamento",
  ) as { amount_cents: number; removed: boolean; paid_cents: number | null } | null;

  if (!row || row.removed || row.paid_cents !== null) return false;

  must(
    await db()
      .from("mock_pix_charges")
      .update({ paid_cents: paidCents ?? row.amount_cents })
      .eq("txid", txid),
    "mock: marcar pago",
  );
  return true;
}
