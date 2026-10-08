"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Visão geral", exact: true },
  { href: "/admin/eventos", label: "Eventos e cardápio" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/relatorios", label: "Relatórios" },
  { href: "/admin/totens", label: "Totens" },
  { href: "/admin/pix", label: "Pix" },
];

/** Links do menu; sem pathname (pré-renderização) nenhum fica destacado. */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map((l) => {
        const active = pathname !== null && (l.exact ? pathname === l.href : pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
              active ? "bg-brand text-white" : "text-ink/80 hover:bg-white hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminNav() {
  return <NavLinks pathname={usePathname()} />;
}
