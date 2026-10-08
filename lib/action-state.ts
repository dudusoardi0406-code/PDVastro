// Retorno padrão das Server Actions do painel (usado com useActionState).
export type ActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  /** link de pareamento do totem (mostrado uma vez) */
  link?: string;
} | null;
