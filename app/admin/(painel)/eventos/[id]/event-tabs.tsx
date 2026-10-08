import Link from "next/link";

export function EventTabs({ eventId, current }: { eventId: string; current: "dados" | "cardapio" }) {
  const tabs = [
    { key: "dados", label: "Dados e tema", href: `/admin/eventos/${eventId}` },
    { key: "cardapio", label: "Cardápio", href: `/admin/eventos/${eventId}/cardapio` },
  ] as const;
  return (
    <div className="mb-6 flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
            current === t.key ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
