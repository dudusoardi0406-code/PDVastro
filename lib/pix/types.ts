// Camada única de provedor Pix (seção 6.1 do escopo). Trocar de banco/gateway
// é escrever outro provedor com esta interface.

export interface CriarCobrancaInput {
  txid: string;
  amountCents: number;
  expiresInSeconds: number;
  /** aparece no app do banco do cliente (máx. 140 caracteres) */
  description: string;
}

export interface CobrancaCriada {
  pixCopiaECola: string;
  raw: unknown;
}

export type EstadoCobranca =
  | { status: "ativa" }
  | { status: "paga"; paidCents: number; e2eId: string | null }
  | { status: "removida" };

export interface ConsultaCobranca {
  estado: EstadoCobranca;
  raw: unknown;
}

export interface PixProvider {
  readonly name: string;
  criarCobranca(input: CriarCobrancaInput): Promise<CobrancaCriada>;
  consultarCobranca(txid: string): Promise<ConsultaCobranca>;
  /** Remove a cobrança no provedor para não poder mais ser paga (melhor esforço). */
  cancelarCobranca(txid: string): Promise<void>;
  /**
   * Extrai os txids de uma notificação. O payload NUNCA é tratado como prova de
   * pagamento: o servidor sempre reconsulta o provedor.
   */
  tratarWebhook(body: unknown): string[];
}

export class PixProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PixProviderError";
  }
}

/** Extrai txids no formato padrão do Bacen: { pix: [{ txid, endToEndId, valor, ... }] } */
export function txidsFromBacenWebhook(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const pix = (body as { pix?: unknown }).pix;
  if (!Array.isArray(pix)) return [];
  const txids = pix
    .map((p) => (p && typeof p === "object" ? (p as { txid?: unknown }).txid : undefined))
    .filter((t): t is string => typeof t === "string" && /^[a-zA-Z0-9]{26,35}$/.test(t));
  return [...new Set(txids)];
}
