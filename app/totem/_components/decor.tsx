import type { ResolvedTheme, ThemePreset } from "@/lib/themes";

// Elementos visuais dos temas: logo (imagem ou texto 3D) e enfeites das telas
// de início e de pagamento confirmado (inspirados nos flyers dos eventos).

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

const u = (n: number) => `calc(var(--u) * ${n})`;

// ---------------------------------------------------------------------------
// Pagode: varal de luzes, folhas de espada-de-são-jorge, limão e pandeiro
// ---------------------------------------------------------------------------
function StringLights() {
  // duas curvas (Bézier quadrática) com lâmpadas espalhadas
  const curves = [
    [0, 8, 250, 95, 500, 14],
    [500, 14, 750, 95, 1000, 8],
  ];
  const bulbs: { x: number; y: number }[] = [];
  for (const [x0, y0, x1, y1, x2, y2] of curves) {
    for (let t = 0.1; t < 1; t += 0.16) {
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      bulbs.push({ x: a * x0 + b * x1 + c * x2, y: a * y0 + b * y1 + c * y2 });
    }
  }
  return (
    <svg
      viewBox="0 0 1000 120"
      preserveAspectRatio="xMidYMin meet"
      className="pointer-events-none absolute top-0 left-0 w-full"
      style={{ height: u(16) }}
      aria-hidden
    >
      <defs>
        <radialGradient id="bulb-glow">
          <stop offset="0%" stopColor="#FFE9A0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFE9A0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {curves.map(([x0, y0, x1, y1, x2, y2], i) => (
        <path key={i} d={`M${x0} ${y0} Q${x1} ${y1} ${x2} ${y2}`} fill="none" stroke="#0d2a16" strokeWidth="3" />
      ))}
      {bulbs.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${b.y})`}>
          <circle cy="16" r="22" fill="url(#bulb-glow)" />
          <rect x="-4" y="0" width="8" height="7" rx="1.5" fill="#3a3a3a" />
          <ellipse cy="15" rx="7" ry="10" fill="#FFE27A" stroke="#C99A1A" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}

function Leaves({ flip = false }: { flip?: boolean }) {
  const blades = [
    { x: 40, h: 300, w: 26, r: -24 },
    { x: 70, h: 380, w: 30, r: -10 },
    { x: 105, h: 330, w: 28, r: 6 },
    { x: 135, h: 250, w: 24, r: 20 },
  ];
  return (
    <svg
      viewBox="-40 -400 240 400"
      className="pointer-events-none absolute bottom-0 t-float"
      style={{
        width: u(22),
        height: u(36),
        [flip ? "right" : "left"]: u(-5),
        transform: flip ? "scaleX(-1)" : undefined,
        opacity: 0.95,
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

function Lime({ style }: { style: React.CSSProperties }) {
  const segments = Array.from({ length: 10 }, (_, i) => (i * 360) / 10);
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute t-float" style={style} aria-hidden>
      <circle cx="50" cy="50" r="48" fill="#5DAA2B" />
      <circle cx="50" cy="50" r="42" fill="#E4F2B5" />
      <circle cx="50" cy="50" r="38" fill="#B5DB4E" />
      {segments.map((a) => (
        <line
          key={a}
          x1="50"
          y1="50"
          x2={50 + 38 * Math.cos((a * Math.PI) / 180)}
          y2={50 + 38 * Math.sin((a * Math.PI) / 180)}
          stroke="#E4F2B5"
          strokeWidth="3"
        />
      ))}
      <circle cx="50" cy="50" r="5" fill="#E4F2B5" />
    </svg>
  );
}

function Pandeiro({ style }: { style: React.CSSProperties }) {
  const jingles = Array.from({ length: 5 }, (_, i) => (i * 360) / 5 + 18);
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute t-float" style={style} aria-hidden>
      <circle cx="50" cy="50" r="46" fill="#8B5A2B" />
      <circle cx="50" cy="50" r="40" fill="#F3E3C3" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#D9C49A" strokeWidth="2" strokeDasharray="3 5" />
      {jingles.map((a) => (
        <g key={a} transform={`rotate(${a} 50 50)`}>
          <rect x="44" y="0" width="12" height="9" rx="2" fill="#6B4320" />
          <ellipse cx="50" cy="4.5" rx="7" ry="3" fill="#D8D8D8" stroke="#9A9A9A" strokeWidth="1" />
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Underground: estrelas e raios de pôster
// ---------------------------------------------------------------------------
function Star({ style, points = 8 }: { style: React.CSSProperties; points?: number }) {
  const n = points * 2;
  const poly = Array.from({ length: n }, (_, i) => {
    const r = i % 2 === 0 ? 50 : 22;
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute t-float" style={style} aria-hidden>
      <polygon points={poly} fill="var(--t-text)" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}

function Bolt({ style }: { style: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 60 100" className="pointer-events-none absolute" style={style} aria-hidden>
      <path d="M38 2 8 56h20L18 98l36-58H32z" fill="var(--t-primary)" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

export function ThemeDecor({ preset }: { preset: ThemePreset }) {
  if (preset === "pagode") {
    return (
      <>
        <StringLights />
        <Lime style={{ width: u(16), top: u(13), right: u(-4), ["--r" as string]: "12deg" }} />
        <Pandeiro style={{ width: u(14), top: u(15), left: u(-3), ["--r" as string]: "-14deg" }} />
        <Leaves />
        <Leaves flip />
      </>
    );
  }
  return (
    <>
      <Star style={{ width: u(11), top: u(7), left: u(6), ["--r" as string]: "-12deg" }} />
      <Star style={{ width: u(6), top: u(20), left: u(20), ["--r" as string]: "10deg" }} points={6} />
      <Star style={{ width: u(8), top: u(24), right: u(7), ["--r" as string]: "18deg" }} />
      <Star style={{ width: u(9), bottom: u(12), left: u(8), ["--r" as string]: "8deg" }} points={6} />
      <Star style={{ width: u(6), bottom: u(20), right: u(12), ["--r" as string]: "-8deg" }} />
      <Bolt style={{ width: u(5), top: u(9), right: u(18), transform: "rotate(14deg)" }} />
      <Bolt style={{ width: u(4), bottom: u(28), left: u(22), transform: "rotate(-18deg)" }} />
    </>
  );
}
