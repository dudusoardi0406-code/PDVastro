import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { json, jsonError } from "@/lib/http";
import { getPixProvider } from "@/lib/pix";
import { syncByTxid } from "@/lib/pix/confirm";

// Webhook Pix. URL: {APP_URL}/api/webhooks/pix/{PIX_WEBHOOK_SECRET}
// O padrão Bacen faz POST em {webhookUrl}/pix, por isso o catch-all opcional.
//
// A Vercel não valida mTLS de entrada, então a origem é garantida pelo segredo
// na URL + reconsulta ao provedor: o payload nunca marca nada como pago sozinho.

function secretMatches(received: string): boolean {
  const expected = process.env.PIX_WEBHOOK_SECRET;
  if (!expected || expected.length < 16) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/webhooks/pix/[secret]/[[...rest]]">) {
  const { secret } = await ctx.params;
  if (!secretMatches(secret)) return jsonError("NAO_AUTORIZADO", "Não autorizado.", 401);

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // corpo vazio: alguns provedores testam a URL assim no cadastro
    return json({ ok: true });
  }

  const txids = getPixProvider().tratarWebhook(body);
  try {
    const results = await Promise.all(txids.map(async (txid) => [txid, await syncByTxid(txid)] as const));
    return json({ ok: true, results: Object.fromEntries(results) });
  } catch (err) {
    console.error("[webhook pix]", err);
    // 500 faz o provedor reenviar; o cron também cobre
    return jsonError("ERRO_INTERNO", "Falha ao processar.", 500);
  }
}
