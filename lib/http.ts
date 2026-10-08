import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { errorCode, friendlyError } from "@/lib/errors";
import { PixProviderError } from "@/lib/pix/types";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export function jsonError(error: string, message: string, status: number, extra?: Record<string, unknown>): Response {
  return json({ error, message, ...extra }, status);
}

/** Lê e valida o corpo JSON. Retorna Response de erro se inválido. */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("JSON_INVALIDO", "Requisição inválida.", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("DADOS_INVALIDOS", "Dados inválidos.", 400);
  }
  return parsed.data;
}

/** Converte erros conhecidos (códigos SQL, provedor Pix) em resposta para o totem. */
export function errorResponse(err: unknown, extra?: Record<string, unknown>): Response {
  // erros internos do Next (ex.: interrupção de pré-renderização) seguem adiante
  unstable_rethrow(err);
  const code = errorCode(err);
  if (code) {
    return jsonError(code, friendlyError(err), 409, extra);
  }
  if (err instanceof PixProviderError) {
    console.error("[pix]", err.message);
    return jsonError("PIX_INDISPONIVEL", "Não foi possível gerar o Pix agora. Tente novamente.", 502, extra);
  }
  console.error(err);
  return jsonError("ERRO_INTERNO", "Algo deu errado. Tente novamente.", 500, extra);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID.test(value);
}
