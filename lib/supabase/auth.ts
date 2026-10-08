import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/env";
import { db } from "@/lib/supabase/service";

/** Cliente com a sessão do usuário (cookies). Usado só para login/logout e identidade. */
export async function authClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl()!, supabasePublishableKey()!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component não grava cookie; o proxy renova a sessão
        }
      },
    },
  });
}

export interface AdminUser {
  userId: string;
  email: string | null;
}

export type AdminCheck = { status: "ok"; admin: AdminUser } | { status: "anon" } | { status: "forbidden"; email: string | null };

/** Quem está logado e se está na tabela admins. */
export async function checkAdmin(): Promise<AdminCheck> {
  // lê os cookies antes de tudo: marca a página como dinâmica mesmo quando o
  // build roda sem as variáveis do Supabase (senão o Next "congela" o redirect)
  await cookies();
  if (!isSupabaseConfigured()) return { status: "anon" };
  const supabase = await authClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { status: "anon" };

  const email = typeof claims.email === "string" ? claims.email : null;
  const { data: row } = await db().from("admins").select("user_id").eq("user_id", claims.sub).maybeSingle();
  if (!row) return { status: "forbidden", email };
  return { status: "ok", admin: { userId: claims.sub, email } };
}

/** Use no início de toda página e Server Action do painel. */
export async function requireAdmin(): Promise<AdminUser> {
  const check = await checkAdmin();
  if (check.status === "ok") return check.admin;
  redirect(check.status === "forbidden" ? "/admin/login?erro=sem-permissao" : "/admin/login");
}
