import "server-only";
import { randomUUID } from "node:crypto";
import { Agent, fetch as undiciFetch } from "undici";
import { centsToDecimal, decimalToCents } from "@/lib/money";
import { PixProviderError, txidsFromBacenWebhook, type PixProvider } from "@/lib/pix/types";

// API Pix Recebimentos do Itaú (padrão Bacen v2), autenticação OAuth2
// client_credentials + mTLS com o certificado gerado no portal do Itaú.
//
// As URLs vêm de variáveis de ambiente porque as fontes públicas divergem.
// Confirmar com o Itaú quando as credenciais chegarem (ver README).

const DEFAULT_TOKEN_URL = "https://sts.itau.com.br/api/oauth/token";
const DEFAULT_PIX_BASE_URL = "https://secure.api.itau/pix_recebimentos/v2";

interface ItauConfig {
  clientId: string;
  clientSecret: string;
  cert: string;
  key: string;
  passphrase?: string;
  pixKey: string;
  tokenUrl: string;
  baseUrl: string;
}

function config(): ItauConfig {
  const required = ["ITAU_CLIENT_ID", "ITAU_CLIENT_SECRET", "ITAU_CERT_B64", "ITAU_KEY_B64", "ITAU_PIX_KEY"] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new PixProviderError(`Itaú não configurado. Faltam: ${missing.join(", ")}`);
  }
  const decode = (b64: string) => Buffer.from(b64, "base64").toString("utf8");
  return {
    clientId: process.env.ITAU_CLIENT_ID!,
    clientSecret: process.env.ITAU_CLIENT_SECRET!,
    cert: decode(process.env.ITAU_CERT_B64!),
    key: decode(process.env.ITAU_KEY_B64!),
    passphrase: process.env.ITAU_KEY_PASSPHRASE || undefined,
    pixKey: process.env.ITAU_PIX_KEY!,
    tokenUrl: process.env.ITAU_TOKEN_URL || DEFAULT_TOKEN_URL,
    baseUrl: (process.env.ITAU_PIX_BASE_URL || DEFAULT_PIX_BASE_URL).replace(/\/$/, ""),
  };
}

let agent: Agent | null = null;
function mtls(cfg: ItauConfig): Agent {
  agent ??= new Agent({
    connect: { cert: cfg.cert, key: cfg.key, passphrase: cfg.passphrase },
  });
  return agent;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(cfg: ItauConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 30_000 > Date.now()) {
    return cachedToken.value;
  }
  const res = await undiciFetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }).toString(),
    dispatcher: mtls(cfg),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new PixProviderError(`Itaú token -> HTTP ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  const json = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new PixProviderError("Itaú token: resposta sem access_token");
  }
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 300) * 1000,
  };
  return cachedToken.value;
}

async function call<T>(method: "GET" | "PUT" | "PATCH", path: string, body?: unknown): Promise<T> {
  const cfg = config();
  const token = await accessToken(cfg);
  const res = await undiciFetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-correlationID": randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    dispatcher: mtls(cfg),
  });
  const text = await res.text();
  if (res.status === 401) cachedToken = null;
  if (!res.ok) {
    throw new PixProviderError(`Itaú ${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 500)}`, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

interface ItauCob {
  txid: string;
  status: "ATIVA" | "CONCLUIDA" | "REMOVIDA_PELO_USUARIO_RECEBEDOR" | "REMOVIDA_PELO_PSP";
  pixCopiaECola?: string;
  valor?: { original?: string };
  pix?: { endToEndId?: string; valor?: string; horario?: string }[];
}

export const itauProvider: PixProvider = {
  name: "itau",

  async criarCobranca({ txid, amountCents, expiresInSeconds, description }) {
    const cfg = config();
    const cob = await call<ItauCob>("PUT", `/cob/${txid}`, {
      calendario: { expiracao: expiresInSeconds },
      valor: { original: centsToDecimal(amountCents) },
      chave: cfg.pixKey,
      solicitacaoPagador: description.slice(0, 140),
    });
    if (!cob.pixCopiaECola) {
      throw new PixProviderError("Itaú: cobrança criada sem pixCopiaECola");
    }
    return { pixCopiaECola: cob.pixCopiaECola, raw: cob };
  },

  async consultarCobranca(txid) {
    const cob = await call<ItauCob>("GET", `/cob/${txid}`);
    if (cob.status === "CONCLUIDA") {
      const pix = cob.pix ?? [];
      const paidCents = pix.length
        ? pix.reduce((sum, p) => sum + (p.valor ? decimalToCents(p.valor) : 0), 0)
        : decimalToCents(cob.valor?.original ?? "0");
      return {
        estado: { status: "paga", paidCents, e2eId: pix[0]?.endToEndId ?? null },
        raw: cob,
      };
    }
    if (cob.status === "REMOVIDA_PELO_PSP" || cob.status === "REMOVIDA_PELO_USUARIO_RECEBEDOR") {
      return { estado: { status: "removida" }, raw: cob };
    }
    return { estado: { status: "ativa" }, raw: cob };
  },

  async cancelarCobranca(txid) {
    await call("PATCH", `/cob/${txid}`, { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" });
  },

  tratarWebhook: txidsFromBacenWebhook,
};

/** Cadastra a URL de webhook na chave Pix (PUT /webhook/{chave}). */
export async function registerItauWebhook(webhookUrl: string): Promise<void> {
  const cfg = config();
  await call("PUT", `/webhook/${encodeURIComponent(cfg.pixKey)}`, { webhookUrl });
}
