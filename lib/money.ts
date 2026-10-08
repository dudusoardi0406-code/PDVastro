// Valores sempre em centavos (inteiro). Conversões para string sem usar float.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** 1250 -> "12.50" (formato da API Pix) */
export function centsToDecimal(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`Valor em centavos inválido: ${cents}`);
  }
  const s = String(cents).padStart(3, "0");
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

/** "12.50" | "12.5" | "12" -> 1250 (formato da API Pix) */
export function decimalToCents(value: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!m) throw new Error(`Valor decimal inválido: ${value}`);
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

/** Entrada do admin: "12,50" | "12.50" | "R$ 12,50" | "1.250,00" -> 1250. Retorna null se inválido. */
export function parseBRLInput(value: string): number | null {
  let v = value.replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (!v) return null;
  if (v.includes(",")) {
    v = v.replace(/\./g, "").replace(",", ".");
  }
  try {
    return decimalToCents(v);
  } catch {
    return null;
  }
}

/** 1250 -> "12,50" (para preencher inputs do admin) */
export function centsToInput(cents: number): string {
  return centsToDecimal(cents).replace(".", ",");
}
