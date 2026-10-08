import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { envStatus } from "@/lib/env";
import { requireAdmin } from "@/lib/supabase/auth";
import { registerWebhook, simulatePaymentAdmin } from "../../actions";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { Badge, Card, Field, inputClass, Notice, PageHeader, PageSkeleton } from "../../_components/ui";

export const metadata: Metadata = { title: "Pix" };

export default function PixPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Pix />
    </Suspense>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <code className="text-xs">{label}</code>
      {ok ? <Badge tone="green">definida</Badge> : <Badge tone="red">faltando</Badge>}
    </li>
  );
}

async function Pix() {
  await requireAdmin();
  const env = envStatus();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "seu-dominio";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const isItau = env.pixProvider === "itau";

  return (
    <>
      <PageHeader title="Pix" description="Provedor, credenciais e webhook. As chaves ficam só nas variáveis de ambiente do servidor." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Provedor ativo"
          actions={isItau ? <Badge tone="green">Itaú</Badge> : <Badge tone="yellow">Teste (mock)</Badge>}
        >
          {isItau ? (
            <p className="text-sm text-muted">Novas cobranças são criadas na API Pix do Itaú.</p>
          ) : (
            <Notice>
              Modo de teste: os QR codes não são reais e o botão &quot;Simular pagamento&quot; aparece no totem. Para receber de verdade,
              defina <code>PIX_PROVIDER=itau</code> e as variáveis do Itaú abaixo.
            </Notice>
          )}
          <ul className="mt-4 divide-y divide-line">
            {Object.entries(env.itau).map(([k, ok]) => (
              <Check key={k} label={k} ok={ok} />
            ))}
            <Check label="PIX_WEBHOOK_SECRET" ok={env.webhookSecret} />
            <Check label="CRON_SECRET" ok={env.cronSecret} />
          </ul>
        </Card>

        <Card title="Webhook" description="Acelera a confirmação. O pagamento é sempre reconsultado no Itaú antes de valer.">
          <Field label="URL do webhook">
            <code className="block rounded-lg border border-line bg-canvas p-2 text-xs break-all">
              {proto}://{host}/api/webhooks/pix/{env.webhookSecret ? "•••••• (PIX_WEBHOOK_SECRET)" : "<defina PIX_WEBHOOK_SECRET>"}
            </code>
          </Field>
          <p className="mt-3 text-sm text-muted">
            Mesmo sem webhook o sistema funciona: o totem consulta o Itaú a cada poucos segundos enquanto o QR está na tela, e o cron
            confere as cobranças a cada minuto.
          </p>
          <ActionForm action={registerWebhook} className="mt-4">
            <SubmitButton variant="secondary">Cadastrar webhook no Itaú</SubmitButton>
          </ActionForm>
        </Card>

        {!isItau && (
          <Card title="Simular pagamento (teste)" description="Para testar valor divergente, informe um valor pago diferente do pedido.">
            <ActionForm action={simulatePaymentAdmin} className="space-y-3">
              <Field label="txid da cobrança" hint="Aparece no detalhe do pedido.">
                <input name="txid" required maxLength={35} className={`${inputClass} font-mono`} />
              </Field>
              <Field label="Valor pago (opcional)" hint="Vazio = valor exato da cobrança.">
                <input name="paid" inputMode="decimal" placeholder="0,00" className={inputClass} />
              </Field>
              <SubmitButton variant="secondary">Simular</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
