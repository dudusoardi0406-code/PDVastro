// Ícones do cardápio (categoria e produto sem foto), desenhados com as cores do tema.

export type GlyphKind =
  | "promo"
  | "beer"
  | "bucket"
  | "bottle"
  | "drink"
  | "tumbler"
  | "food"
  | "plate"
  | "skewer"
  | "soft"
  | "water"
  | "other";

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Ícone da categoria pelo nome (funciona com categorias criadas no admin). */
export function glyphKind(name: string, featured = false): GlyphKind {
  const t = normalize(name);
  if (featured || /promo|oferta|combo|desconto/.test(t)) return "promo";
  if (/comida|porca|lanche|petisc|espet|batata|salgad|pizza|caldo/.test(t)) return "food";
  if (/drink|\bgin\b|vodka|whisk|caipi|copao|\bdose|\bshot|cachaca|tequila/.test(t)) return "drink";
  if (/cerve|chop|beer|balde/.test(t)) return "beer";
  if (/sem alcool|agua|refri|suco|energ|soda|bebida/.test(t)) return "soft";
  return "other";
}

/** Ícone do produto pelo nome; se não reconhecer, usa o da categoria. */
export function productGlyphKind(name: string, category: GlyphKind): GlyphKind {
  const t = normalize(name);
  // a ordem importa: "Vodka com energético" é copão, "Amstel lata" é lata
  if (/balde/.test(t)) return "bucket";
  if (/batata|frita/.test(t)) return "food";
  if (/espet/.test(t)) return "skewer";
  if (/calabresa|isca|frango|porcao|pastel|salgad|lanche|petisc|pizza|hamb|caldo|comida/.test(t)) return "plate";
  if (/\bgin\b|drink|\bshot|gummy|tequila/.test(t)) return "drink";
  if (/copao|whisk|caipi|vodka|\bdose|cachaca|\brum\b/.test(t)) return "tumbler";
  if (/agua/.test(t)) return "water";
  if (/long neck|garrafa|600ml/.test(t)) return "bottle";
  if (/lata/.test(t)) return "soft";
  if (/cerve|chop|beer|heineken|original|spaten|amstel|brahma|skol|budweiser|stella/.test(t)) return "beer";
  if (/sem alcool|refri|suco|energ|soda|tonica/.test(t)) return "soft";
  return category === "promo" ? "other" : category;
}

const stroke = { stroke: "var(--t-ink)", strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Lime({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#8BC34A" {...stroke} strokeWidth={2.5} />
      <circle cx={x} cy={y} r={r * 0.62} fill="#DDEFA6" />
      <path d={`M${x - r * 0.6} ${y}h${r * 1.2}M${x} ${y - r * 0.6}v${r * 1.2}`} stroke="#8BC34A" strokeWidth="1.5" />
    </g>
  );
}

export function Glyph({ kind, className = "", style }: { kind: GlyphKind; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden>
      {kind === "beer" && (
        <>
          <path d="M44 24h5a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6h-5" fill="none" {...stroke} strokeWidth={4} />
          <rect x="14" y="18" width="30" height="38" rx="5" fill="var(--t-primary)" {...stroke} />
          <path d="M22 28v20M30 28v20M38 28v20" stroke="var(--t-ink)" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
          <path d="M12 20c0-5 4-8 8-7 1-4 6-6 10-4 3-3 9-3 11 1 4-1 7 2 6 6 1 3-1 6-4 6H16c-3 0-4-1-4-2z" fill="#fff" {...stroke} />
        </>
      )}
      {kind === "bucket" && (
        <>
          <path d="M20 26V8l3-3 3 3v18" fill="#2E7D32" {...stroke} />
          <path d="M30 26V6l3-3 3 3v20" fill="#7A4A1E" {...stroke} />
          <path d="M40 26V9l3-3 3 3v17" fill="#2E7D32" {...stroke} />
          <rect x="17" y="20" width="9" height="7" rx="1.5" fill="#E3F4FB" stroke="var(--t-ink)" strokeWidth="2" transform="rotate(-12 21 23)" />
          <rect x="38" y="19" width="9" height="7" rx="1.5" fill="#E3F4FB" stroke="var(--t-ink)" strokeWidth="2" transform="rotate(10 42 22)" />
          <path d="M10 26h44l-5 30H15z" fill="#C9CED6" {...stroke} />
          <path d="M13 34h38" stroke="var(--t-ink)" strokeOpacity="0.3" strokeWidth="2" />
          <rect x="22" y="38" width="20" height="10" rx="2" fill="var(--t-primary)" stroke="var(--t-ink)" strokeWidth="2" />
        </>
      )}
      {kind === "bottle" && (
        <>
          <path d="M27 4h10v12c0 4 7 7 7 15v25a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V31c0-8 7-11 7-15z" fill="#7A4A1E" {...stroke} />
          <rect x="26" y="2" width="12" height="5" rx="1.5" fill="var(--t-accent)" {...stroke} strokeWidth={2.5} />
          <rect x="22" y="34" width="20" height="14" rx="2" fill="var(--t-primary)" stroke="var(--t-ink)" strokeWidth="2.5" />
          <path d="M26 12v6" stroke="#fff" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {kind === "drink" && (
        <>
          <Lime x={46} y={14} r={8} />
          <path d="M10 16h40L30 38z" fill="var(--t-accent)" {...stroke} />
          <path d="M30 38v16M20 56h20" fill="none" {...stroke} strokeWidth={4} />
          <circle cx="26" cy="22" r="2.5" fill="#fff" fillOpacity="0.8" />
        </>
      )}
      {kind === "tumbler" && (
        <>
          <path d="M38 4l-6 30" stroke="var(--t-ink)" strokeWidth="6" strokeLinecap="round" />
          <path d="M38 4l-6 30" stroke="var(--t-accent)" strokeWidth="3" strokeLinecap="round" />
          <path d="M14 18h36l-4 38a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#fff" fillOpacity="0.85" {...stroke} />
          <path d="M16.5 30h31l-2.7 25.5a3 3 0 0 1-3 2.5H22.2a3 3 0 0 1-3-2.5z" fill="#F2A93B" />
          <rect x="22" y="33" width="7" height="7" rx="1.5" fill="#fff" fillOpacity="0.7" transform="rotate(12 25 36)" />
          <rect x="33" y="38" width="7" height="7" rx="1.5" fill="#fff" fillOpacity="0.7" transform="rotate(-10 36 41)" />
          <Lime x={48} y={20} r={7} />
        </>
      )}
      {kind === "food" && (
        <>
          <path d="M20 10l4 22M27 7l2 25M34 8l-1 24M41 10l-4 22M47 14l-7 18" stroke="var(--t-ink)" strokeWidth="8" strokeLinecap="round" />
          <path d="M20 10l4 22M27 7l2 25M34 8l-1 24M41 10l-4 22M47 14l-7 18" stroke="var(--t-primary)" strokeWidth="4" strokeLinecap="round" />
          <path d="M12 28h40l-5 28H17z" fill="var(--t-accent)" {...stroke} />
          <path d="M22 40c3 4 17 4 20 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === "plate" && (
        <>
          <ellipse cx="32" cy="44" rx="27" ry="11" fill="#fff" {...stroke} />
          <ellipse cx="32" cy="43" rx="19" ry="6.5" fill="none" stroke="var(--t-ink)" strokeOpacity="0.2" strokeWidth="2" />
          <path d="M16 41c2-10 9-15 16-15s14 5 16 15c-5 3-27 3-32 0z" fill="#C0692C" {...stroke} />
          <circle cx="25" cy="33" r="3.5" fill="#E8A03C" />
          <circle cx="35" cy="30" r="3.5" fill="#E8A03C" />
          <circle cx="40" cy="36" r="3" fill="#E8A03C" />
          <path d="M22 31c4-3 6 2 10-1M30 37c4-2 7 2 11-1" fill="none" stroke="#7CB342" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {kind === "skewer" && (
        <>
          <path d="M8 56L56 8" stroke="#B08A5A" strokeWidth="4" strokeLinecap="round" />
          <rect x="15" y="37" width="13" height="12" rx="3" fill="#8B4A2B" {...stroke} transform="rotate(-45 21 43)" />
          <rect x="26" y="28" width="11" height="10" rx="3" fill="#E53935" {...stroke} transform="rotate(-45 31 33)" />
          <rect x="33" y="17" width="13" height="12" rx="3" fill="#8B4A2B" {...stroke} transform="rotate(-45 40 23)" />
          <rect x="44" y="11" width="9" height="8" rx="2.5" fill="#7CB342" {...stroke} transform="rotate(-45 48 15)" />
        </>
      )}
      {kind === "soft" && (
        <>
          <path d="M20 12c0-3 4-5 12-5s12 2 12 5v42c0 3-4 5-12 5s-12-2-12-5z" fill="var(--t-secondary)" {...stroke} />
          <path d="M20 26h24v14H20z" fill="#fff" fillOpacity="0.85" />
          <path d="M26 12h12" fill="none" {...stroke} />
          <circle cx="32" cy="33" r="3.5" fill="var(--t-accent)" />
        </>
      )}
      {kind === "water" && (
        <>
          <rect x="26" y="3" width="12" height="7" rx="2" fill="#1E88E5" {...stroke} strokeWidth={2.5} />
          <path d="M26 10h12l2 6c4 3 5 6 5 10v28a5 5 0 0 1-5 5H24a5 5 0 0 1-5-5V26c0-4 1-7 5-10z" fill="#9FD8F7" {...stroke} />
          <rect x="19" y="32" width="26" height="12" fill="#fff" fillOpacity="0.9" />
          <path d="M27 38h10" stroke="#1E88E5" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 20c-1 2-1 6-1 8" stroke="#fff" strokeOpacity="0.8" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {kind === "promo" && (
        <>
          <polygon
            points={Array.from({ length: 24 }, (_, i) => {
              const r = i % 2 === 0 ? 29 : 22;
              const a = (Math.PI * 2 * i) / 24;
              return `${32 + r * Math.cos(a)},${32 + r * Math.sin(a)}`;
            }).join(" ")}
            fill="var(--t-accent)"
            {...stroke}
          />
          <text x="32" y="40" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff" fontFamily="Arial, sans-serif">
            %
          </text>
        </>
      )}
      {kind === "other" && (
        <>
          <path d="M16 10h32l-4 44a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" fill="var(--t-primary)" {...stroke} />
          <path d="M18 22h28" stroke="var(--t-ink)" strokeWidth="3" />
          <circle cx="28" cy="34" r="3" fill="#fff" fillOpacity="0.8" />
          <circle cx="36" cy="42" r="2.4" fill="#fff" fillOpacity="0.8" />
        </>
      )}
    </svg>
  );
}
