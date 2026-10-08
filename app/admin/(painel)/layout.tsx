import type { Metadata } from "next";
import { Suspense } from "react";
import { pixProviderName } from "@/lib/env";
import { requireAdmin } from "@/lib/supabase/auth";
import { signOut } from "../actions";
import { AdminNav, NavLinks } from "../_components/nav";
import { buttonClass } from "../_components/ui";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel PDVastro" },
  robots: { index: false, follow: false },
};

export default function PainelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-line bg-canvas px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:flex-none lg:border-r lg:border-b-0 lg:py-6">
        <div className="mb-4 flex items-center gap-2 px-1 lg:mb-8">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-black text-white">P</span>
          <div className="leading-tight">
            <div className="font-bold">PDVastro</div>
            <div className="text-xs text-muted">Painel do totem</div>
          </div>
        </div>
        <Suspense fallback={<NavLinks pathname={null} />}>
          <AdminNav />
        </Suspense>
        <Suspense fallback={null}>
          <SessionBox />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

async function SessionBox() {
  const admin = await requireAdmin();
  const mock = pixProviderName() === "mock";
  return (
    <div className="mt-4 space-y-3 lg:mt-8">
      {mock && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <b>Pix de teste.</b> Nenhum pagamento é real (PIX_PROVIDER=mock).
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted">
        <span className="truncate" title={admin.email ?? undefined}>
          {admin.email}
        </span>
        <form action={signOut}>
          <button type="submit" className={buttonClass.ghost}>
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
