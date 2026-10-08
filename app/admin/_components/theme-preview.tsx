import { EventLogo, ProductGlyph, ThemeDecor } from "@/app/totem/_components/decor";
import { themeVars, type ResolvedTheme } from "@/lib/themes";

/** Miniatura do totem com o tema (tela inicial + card de produto). */
export function ThemePreview({ name, theme }: { name: string; theme: ResolvedTheme }) {
  const u = (n: number) => `calc(var(--u) * ${n})`;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="totem-frame aspect-[9/16] overflow-hidden rounded-xl border border-line">
        <div className="totem totem-preview" data-preset={theme.preset} style={themeVars(theme)}>
          <div className="relative flex flex-1 flex-col items-center justify-center text-center" style={{ gap: u(4), padding: u(5) }}>
            <ThemeDecor preset={theme.preset} />
            <div className="relative z-10 flex w-full flex-col items-center" style={{ gap: u(3) }}>
              <EventLogo name={name || "Evento"} theme={theme} sizeU={34} />
              {theme.tagline && (
                <p className="t-label" style={{ fontSize: u(3.6) }}>
                  {theme.tagline}
                </p>
              )}
            </div>
            <span className="t-btn relative z-10" style={{ fontSize: u(4.6), minHeight: u(12) }}>
              Toque para pedir
            </span>
          </div>
        </div>
      </div>

      <div className="totem-frame aspect-[9/16] overflow-hidden rounded-xl border border-line">
        <div className="totem totem-preview" data-preset={theme.preset} style={themeVars(theme)}>
          <div className="flex flex-1 flex-col" style={{ padding: u(4), gap: u(3) }}>
            <div className="flex" style={{ gap: u(2) }}>
              <span className="t-tab flex items-center" aria-pressed="true">
                Cervejas
              </span>
              <span className="t-tab flex items-center" aria-pressed="false">
                Drinks
              </span>
            </div>
            <div className="t-card" data-selected="true">
              <div
                className="flex items-center justify-center"
                style={{ aspectRatio: "4 / 3", background: "color-mix(in srgb, var(--t-bg-alt) 35%, var(--t-surface))" }}
              >
                <ProductGlyph />
              </div>
              <div style={{ padding: u(2.5) }}>
                <div className="t-display" style={{ fontSize: u(4.4) }}>
                  Gin Tropical
                </div>
                <div className="flex items-center justify-between" style={{ marginTop: u(2) }}>
                  <span className="t-price">R$ 25,00</span>
                  <span className="t-step">+</span>
                </div>
              </div>
            </div>
            <div className="mt-auto">
              <span className="t-btn w-full" style={{ fontSize: u(4.4) }}>
                Pagar com Pix
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
