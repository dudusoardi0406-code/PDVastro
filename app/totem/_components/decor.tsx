import type { ResolvedTheme, ThemePreset } from "@/lib/themes";

// Elementos visuais dos temas: logo (imagem ou texto 3D), folhagens do pagode,
// estrelas do underground e ícone de produto sem foto.

export function EventLogo({
  name,
  theme,
  sizeU,
}: {
  name: string;
  theme: ResolvedTheme;
  /** altura/tamanho em unidades --u */
  sizeU: number;
}) {
  if (theme.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={theme.logoUrl}
        alt={name}
        draggable={false}
        style={{ maxHeight: `calc(var(--u) * ${sizeU})`, maxWidth: "88%" }}
        className="object-contain drop-shadow-[0_8px_0_rgba(0,0,0,0.35)]"
      />
    );
  }
  const words = name.trim().split(/\s+/);
  // "Pagode do Zé" -> ["PAGODE", "DO ZÉ"]: palavras curtas grudam na seguinte
  const lines: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length <= 3 && i < words.length - 1) {
      words[i + 1] = `${w} ${words[i + 1]}`;
    } else {
      lines.push(w);
    }
  }
  // cabe na altura pedida e na largura da tela (~88u)
  const longest = Math.max(...lines.map((l) => l.length));
  const fontU = Math.min(sizeU / Math.max(2, lines.length), 88 / (longest * 0.62));
  return (
    <h1 className="t-title text-center uppercase" style={{ fontSize: `calc(var(--u) * ${fontU.toFixed(2)})` }}>
      {lines.map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </h1>
  );
}

/** Folhas de espada-de-são-jorge (como no flyer do Pagode do Zé) */
function Leaves({ flip = false }: { flip?: boolean }) {
  const blades = [
    { x: 40, h: 300, w: 26, r: -24 },
    { x: 70, h: 380, w: 30, r: -10 },
    { x: 105, h: 330, w: 28, r: 6 },
    { x: 135, h: 260, w: 24, r: 20 },
    { x: 20, h: 210, w: 22, r: -38 },
  ];
  return (
    <svg
      viewBox="-40 -400 240 400"
      className="pointer-events-none absolute bottom-0 t-float"
      style={{
        width: "calc(var(--u) * 30)",
        height: "calc(var(--u) * 50)",
        [flip ? "right" : "left"]: "calc(var(--u) * -6)",
        transform: flip ? "scaleX(-1)" : undefined,
      }}
      aria-hidden
    >
      {blades.map((b, i) => (
        <g key={i} transform={`rotate(${b.r} ${b.x} 0)`}>
          <path
            d={`M ${b.x} 0 C ${b.x - b.w} ${-b.h * 0.4}, ${b.x - b.w * 0.55} ${-b.h * 0.85}, ${b.x} ${-b.h} C ${b.x + b.w * 0.55} ${-b.h * 0.85}, ${b.x + b.w} ${-b.h * 0.4}, ${b.x} 0 Z`}
            fill="#1d6b34"
            stroke="#e9d84a"
            strokeWidth="5"
          />
          <path
            d={`M ${b.x} -10 C ${b.x - 4} ${-b.h * 0.4}, ${b.x - 2} ${-b.h * 0.8}, ${b.x} ${-b.h + 30}`}
            fill="none"
            stroke="#0f3f1f"
            strokeWidth="4"
            strokeDasharray="18 14"
          />
        </g>
      ))}
    </svg>
  );
}

function Star({ style }: { style: React.CSSProperties }) {
  const points = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 === 0 ? 50 : 22;
    const a = (Math.PI * 2 * i) / 16 - Math.PI / 2;
    return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute t-float" style={style} aria-hidden>
      <polygon points={points} fill="var(--t-text)" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}

export function ThemeDecor({ preset }: { preset: ThemePreset }) {
  if (preset === "pagode") {
    return (
      <>
        <Leaves />
        <Leaves flip />
      </>
    );
  }
  return (
    <>
      <Star style={{ width: "calc(var(--u) * 12)", top: "calc(var(--u) * 6)", left: "calc(var(--u) * 5)", ["--r" as string]: "-12deg" }} />
      <Star style={{ width: "calc(var(--u) * 8)", top: "calc(var(--u) * 26)", right: "calc(var(--u) * 6)", ["--r" as string]: "18deg" }} />
      <Star style={{ width: "calc(var(--u) * 10)", bottom: "calc(var(--u) * 14)", left: "calc(var(--u) * 8)", ["--r" as string]: "8deg" }} />
    </>
  );
}

/** Ícone para produto sem foto */
export function ProductGlyph() {
  return (
    <svg viewBox="0 0 64 64" className="h-1/2 w-1/2 opacity-80" aria-hidden>
      <path d="M16 10h32l-4 44a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" fill="var(--t-primary)" stroke="var(--t-ink)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M18 22h28" stroke="var(--t-ink)" strokeWidth="3" />
      <circle cx="28" cy="34" r="3" fill="var(--t-surface)" />
      <circle cx="36" cy="42" r="2.4" fill="var(--t-surface)" />
      <circle cx="31" cy="48" r="1.8" fill="var(--t-surface)" />
    </svg>
  );
}
