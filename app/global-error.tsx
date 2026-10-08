"use client";

import { useEffect } from "react";

// Erro no layout raiz. No totem (/totem) recarrega sozinho; no painel mostra o botão.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    if (window.location.pathname.startsWith("/totem")) {
      const id = setTimeout(() => window.location.reload(), 5000);
      return () => clearTimeout(id);
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#111", color: "#fff" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: 32 }}>
          <div>
            <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>Algo deu errado</h1>
            <p style={{ opacity: 0.8, margin: "0 0 24px" }}>Tente de novo. No totem, a página recarrega sozinha.</p>
            <button
              type="button"
              onClick={() => retry()}
              style={{ padding: "12px 24px", fontSize: 16, borderRadius: 8, border: 0, cursor: "pointer" }}
            >
              Tentar de novo
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
