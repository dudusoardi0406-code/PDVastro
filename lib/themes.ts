// Temas por evento. Cada evento guarda { preset, colors?, logoUrl?, backgroundUrl?, tagline? }
// e o totem aplica como CSS variables (ver app/globals.css, seção "Totem").

export type ThemePreset = "pagode" | "underground";

export interface ThemeColors {
  /** fundo principal */
  bg: string;
  /** fundo secundário (padrões, faixas) */
  bgAlt: string;
  /** cards de produto */
  surface: string;
  surfaceText: string;
  /** botão principal / destaque */
  primary: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
  /** etiquetas de preço, alertas */
  accent: string;
  accentText: string;
  /** texto sobre o fundo */
  text: string;
  /** contornos e sombras "3D" */
  ink: string;
}

export interface EventTheme {
  preset: ThemePreset;
  colors?: Partial<ThemeColors>;
  logoUrl?: string | null;
  backgroundUrl?: string | null;
  tagline?: string | null;
}

export interface ResolvedTheme {
  preset: ThemePreset;
  colors: ThemeColors;
  logoUrl: string | null;
  backgroundUrl: string | null;
  tagline: string | null;
}

export const PRESETS: Record<ThemePreset, { label: string; description: string; tagline: string; colors: ThemeColors }> = {
  pagode: {
    label: "Pagode",
    description: "Verde, amarelo e azul. Letras gordas com sombra 3D e cards de papel.",
    tagline: "Onde tudo vira samba",
    colors: {
      bg: "#0B4F27",
      bgAlt: "#127A38",
      surface: "#FBF6E9",
      surfaceText: "#1B1B1B",
      primary: "#FFD21F",
      primaryText: "#13213F",
      secondary: "#1F5FD6",
      secondaryText: "#FFFFFF",
      accent: "#E0322B",
      accentText: "#FFFFFF",
      text: "#FFFFFF",
      ink: "#13213F",
    },
  },
  underground: {
    label: "Underground",
    description: "Preto e vermelho, textura grunge e faixas em seta estilo line-up.",
    tagline: "Peça, pague no Pix e volte pro baile",
    colors: {
      bg: "#0D0A0A",
      bgAlt: "#4A0F0B",
      surface: "#171212",
      surfaceText: "#F1ECE2",
      primary: "#D9261C",
      primaryText: "#F1ECE2",
      secondary: "#F1ECE2",
      secondaryText: "#0D0A0A",
      accent: "#D9261C",
      accentText: "#F1ECE2",
      text: "#F1ECE2",
      ink: "#000000",
    },
  },
};

export const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "bg", label: "Fundo" },
  { key: "bgAlt", label: "Fundo (padrão)" },
  { key: "primary", label: "Destaque / botão" },
  { key: "primaryText", label: "Texto do botão" },
  { key: "secondary", label: "Secundária" },
  { key: "secondaryText", label: "Texto secundário" },
  { key: "accent", label: "Etiqueta de preço" },
  { key: "accentText", label: "Texto da etiqueta" },
  { key: "surface", label: "Card do produto" },
  { key: "surfaceText", label: "Texto do card" },
  { key: "text", label: "Texto sobre o fundo" },
  { key: "ink", label: "Contorno / sombra" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

export function isPreset(value: unknown): value is ThemePreset {
  return value === "pagode" || value === "underground";
}

export function resolveTheme(theme: Partial<EventTheme> | null | undefined): ResolvedTheme {
  const preset = isPreset(theme?.preset) ? theme.preset : "pagode";
  const base = PRESETS[preset].colors;
  const colors = { ...base };
  for (const { key } of COLOR_FIELDS) {
    const override = theme?.colors?.[key];
    if (isHexColor(override)) colors[key] = override;
  }
  return {
    preset,
    colors,
    logoUrl: theme?.logoUrl || null,
    backgroundUrl: theme?.backgroundUrl || null,
    tagline: theme?.tagline ?? PRESETS[preset].tagline,
  };
}

/** CSS variables do tema (usar em style={...} no container do totem). */
export function themeVars(theme: ResolvedTheme): Record<string, string> {
  const c = theme.colors;
  return {
    "--t-bg": c.bg,
    "--t-bg-alt": c.bgAlt,
    "--t-surface": c.surface,
    "--t-surface-text": c.surfaceText,
    "--t-primary": c.primary,
    "--t-primary-text": c.primaryText,
    "--t-secondary": c.secondary,
    "--t-secondary-text": c.secondaryText,
    "--t-accent": c.accent,
    "--t-accent-text": c.accentText,
    "--t-text": c.text,
    "--t-ink": c.ink,
    "--t-bg-image": theme.backgroundUrl ? `url("${theme.backgroundUrl}")` : "none",
  };
}
