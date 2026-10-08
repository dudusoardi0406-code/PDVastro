"use client";

import { useEffect } from "react";
import { buttonClass, Notice } from "../_components/ui";

export default function PainelError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Não foi possível carregar esta página</h1>
      <Notice tone="red">
        Verifique a conexão e se o Supabase está configurado. Código para suporte: <code>{error.digest ?? "—"}</code>
      </Notice>
      <button type="button" className={buttonClass.primary} onClick={() => retry()}>
        Tentar de novo
      </button>
    </div>
  );
}
