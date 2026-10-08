import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Cliente com a chave secreta (ignora RLS). Só no servidor. */
export function db(): SupabaseClient {
  if (!client) {
    const url = supabaseUrl();
    const key = supabaseSecretKey();
    if (!url || !key) {
      throw new Error("Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Lança erro legível quando o Supabase devolve erro. */
export function must<T>(result: { data: T; error: { message: string } | null }, context: string): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}
