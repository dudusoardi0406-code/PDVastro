import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { envStatus } from "@/lib/env";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand text-lg font-black text-white">P</span>
          <div>
            <h1 className="text-2xl font-bold">PDVastro</h1>
            <p className="text-sm text-muted">Totem de autoatendimento com Pix para eventos</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/totem" className="rounded-xl border border-line bg-panel p-4 transition hover:border-brand">
            <div className="font-semibold">Totem</div>
            <div className="text-sm text-muted">Tela do cliente (abrir no aparelho)</div>
          </Link>
          <Link href="/admin" className="rounded-xl border border-line bg-panel p-4 transition hover:border-brand">
            <div className="font-semibold">Painel</div>
            <div className="text-sm text-muted">Eventos, cardápio, pedidos e relatórios</div>
          </Link>
        </div>

        <div className="mt-3 rounded-xl border border-line bg-panel p-4">
          <div className="font-semibold">Demonstração do totem</div>
          <div className="text-sm text-muted">Sem banco e sem Pix de verdade, para ver o visual ou mostrar ao cliente.</div>
          <div className="mt-3 flex gap-2">
            <Link href="/totem/demo?tema=pagode" className="rounded-lg bg-[#0B4F27] px-3 py-1.5 text-sm font-semibold text-[#FFD21F]">
              Tema Pagode
            </Link>
            <Link href="/totem/demo?tema=underground" className="rounded-lg bg-[#0D0A0A] px-3 py-1.5 text-sm font-semibold text-[#F1ECE2]">
              Tema Underground
            </Link>
          </div>
        </div>

        <Suspense fallback={null}>
          <SetupStatus />
        </Suspense>
      </div>
    </main>
  );
}

async function SetupStatus() {
  await connection();
  const env = envStatus();
  if (env.supabase && env.pixProvider === "itau") return null;
  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Configuração</p>
      <ul className="mt-1 list-inside list-disc">
        {!env.supabase && <li>Supabase não configurado (veja .env.example).</li>}
        {env.pixProvider === "mock" && <li>Pix em modo de teste (PIX_PROVIDER=mock).</li>}
      </ul>
    </div>
  );
}
