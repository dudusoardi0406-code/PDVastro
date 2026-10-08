// Leitura de campos de formulário (Server Actions).

export class FormError extends Error {}

export function text(fd: FormData, key: string, opts: { max?: number; required?: boolean; label?: string } = {}): string | null {
  const raw = fd.get(key);
  const value = typeof raw === "string" ? raw.trim() : "";
  const label = opts.label ?? key;
  if (!value) {
    if (opts.required) throw new FormError(`Preencha: ${label}.`);
    return null;
  }
  if (opts.max && value.length > opts.max) throw new FormError(`${label}: máximo de ${opts.max} caracteres.`);
  return value;
}

export function int(fd: FormData, key: string, opts: { min?: number; max?: number; fallback?: number; label?: string } = {}): number {
  const raw = fd.get(key);
  const label = opts.label ?? key;
  if (raw === null || raw === "") {
    if (opts.fallback !== undefined) return opts.fallback;
    throw new FormError(`Preencha: ${label}.`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new FormError(`${label}: número inválido.`);
  if (opts.min !== undefined && n < opts.min) throw new FormError(`${label}: mínimo ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw new FormError(`${label}: máximo ${opts.max}.`);
  return n;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Mensagem do erro para o admin (FormError e erros conhecidos do banco). */
export function formErrorMessage(err: unknown): string {
  if (err instanceof FormError) return err.message;
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("duplicate key") && message.includes("slug")) return "Já existe um evento com esse endereço (slug).";
  if (message.includes("violates foreign key")) return "Registro ligado a outro dado: não foi possível salvar.";
  if (message.includes("violates check constraint")) return "Algum valor está fora do permitido.";
  console.error(err);
  return message.startsWith("Imagem") || message.startsWith("Formato") || message.startsWith("Falha")
    ? message
    : "Não foi possível salvar. Tente novamente.";
}
