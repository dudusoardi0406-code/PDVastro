import "server-only";
import { randomUUID } from "node:crypto";
import { pixProviderName } from "@/lib/env";
import { itauProvider } from "@/lib/pix/itau";
import { mockProvider } from "@/lib/pix/mock";
import type { PixProvider } from "@/lib/pix/types";

const providers: Record<string, PixProvider> = {
  itau: itauProvider,
  mock: mockProvider,
};

/** Provedor para novas cobranças (PIX_PROVIDER) ou o de uma cobrança existente. */
export function getPixProvider(name?: string): PixProvider {
  const provider = providers[name ?? pixProviderName()];
  if (!provider) throw new Error(`Provedor Pix desconhecido: ${name}`);
  return provider;
}

/** txid do Bacen: 26 a 35 caracteres [a-zA-Z0-9]. UUID sem hífens = 32. */
export function newTxid(): string {
  return randomUUID().replace(/-/g, "");
}
