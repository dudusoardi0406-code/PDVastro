"use client";

import { useSyncExternalStore } from "react";
import { isDemo } from "../_lib/demo";

const noop = () => () => {};

/** true só no navegador em /totem/demo (no servidor é sempre false, sem erro de hidratação) */
export function useIsDemo(): boolean {
  return useSyncExternalStore(noop, isDemo, () => false);
}

/** Selo fixo do modo demonstração, com troca de tema. */
export function DemoBadge() {
  const demo = useIsDemo();
  if (!demo) return null;
  const current = new URLSearchParams(window.location.search).get("tema") === "underground" ? "underground" : "pagode";
  return (
    <div className="absolute top-0 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-b-xl bg-black/80 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white">
      <span>DEMONSTRAÇÃO · nada é cobrado</span>
      {(["pagode", "underground"] as const).map((t) => (
        <a
          key={t}
          href={`/totem/demo?tema=${t}`}
          className={`rounded px-2 py-0.5 ${t === current ? "bg-white text-black" : "bg-white/15 hover:bg-white/25"}`}
        >
          {t === "pagode" ? "Pagode" : "Underground"}
        </a>
      ))}
    </div>
  );
}
