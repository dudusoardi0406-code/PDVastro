import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { checkAdmin } from "@/lib/supabase/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-brand font-black text-white">P</span>
          <div className="leading-tight">
            <div className="text-lg font-bold">PDVastro</div>
            <div className="text-xs text-muted">Painel do totem</div>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-6">
          <h1 className="mb-4 text-xl font-bold">Entrar no painel</h1>
          <Suspense fallback={<LoginForm />}>
            <LoginGate searchParams={props.searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function LoginGate({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-danger">
        Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY.
      </p>
    );
  }
  const check = await checkAdmin();
  if (check.status === "ok") redirect("/admin");

  const { erro } = await searchParams;
  const notice =
    check.status === "forbidden" || erro === "sem-permissao"
      ? "Este usuário não tem acesso ao painel. Peça para incluí-lo na tabela admins."
      : null;
  return <LoginForm notice={notice} />;
}
