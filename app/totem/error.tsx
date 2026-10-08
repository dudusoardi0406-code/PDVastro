"use client";

import { useEffect, useState } from "react";

const RELOAD_SECONDS = 5;

// Se algo quebrar na tela do totem, ninguém vai apertar "tentar de novo":
// mostra um aviso e recarrega sozinho.
export default function TotemError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  const [seconds, setSeconds] = useState(RELOAD_SECONDS);

  useEffect(() => {
    console.error("[totem] erro na tela:", error);
    const started = Date.now();
    const id = setInterval(() => {
      const left = RELOAD_SECONDS - Math.floor((Date.now() - started) / 1000);
      if (left <= 0) window.location.reload();
      else setSeconds(left);
    }, 250);
    return () => clearInterval(id);
  }, [error]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black p-8 text-center text-white">
      <p className="text-4xl font-bold">Reiniciando o totem…</p>
      <p className="text-lg opacity-80">Só um instante. Se continuar, procure o caixa.</p>
      <p className="text-sm opacity-60">Recarregando em {seconds}s</p>
    </div>
  );
}
