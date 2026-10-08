import "server-only";

// Aceita tanto os nomes novos do Supabase (publishable/secret) quanto os
// nomes que a integração Supabase da Vercel cria (anon/service_role).

export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
}

export function supabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY
  );
}

export function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey() && supabaseSecretKey());
}

export type PixProviderName = "mock" | "itau";

export function pixProviderName(): PixProviderName {
  return process.env.PIX_PROVIDER === "itau" ? "itau" : "mock";
}

export function appUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

/** Nomes das variáveis exigidas por cada parte, para a tela de diagnóstico. */
export function envStatus() {
  const has = (k: string) => Boolean(process.env[k]);
  return {
    supabase: isSupabaseConfigured(),
    pixProvider: pixProviderName(),
    webhookSecret: has("PIX_WEBHOOK_SECRET"),
    cronSecret: has("CRON_SECRET"),
    itau: {
      ITAU_CLIENT_ID: has("ITAU_CLIENT_ID"),
      ITAU_CLIENT_SECRET: has("ITAU_CLIENT_SECRET"),
      ITAU_CERT_B64: has("ITAU_CERT_B64"),
      ITAU_KEY_B64: has("ITAU_KEY_B64"),
      ITAU_PIX_KEY: has("ITAU_PIX_KEY"),
      ITAU_TOKEN_URL: has("ITAU_TOKEN_URL"),
      ITAU_PIX_BASE_URL: has("ITAU_PIX_BASE_URL"),
    },
  };
}
