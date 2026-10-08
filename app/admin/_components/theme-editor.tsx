"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { COLOR_FIELDS, PRESETS, resolveTheme, type EventTheme, type ThemeColors, type ThemePreset } from "@/lib/themes";
import { ActionForm, SubmitButton } from "./action-form";
import { ImageInput } from "./image-input";
import { ThemePreview } from "./theme-preview";
import { buttonClass, Field, inputClass } from "./ui";

export function ThemeEditor({
  eventName,
  theme,
  action,
}: {
  eventName: string;
  theme: EventTheme;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const initial = resolveTheme(theme);
  const [preset, setPreset] = useState<ThemePreset>(initial.preset);
  const [colors, setColors] = useState<ThemeColors>(initial.colors);
  const [tagline, setTagline] = useState(theme.tagline ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(initial.backgroundUrl);

  const preview = resolveTheme({ preset, colors, tagline: tagline || null, logoUrl, backgroundUrl });

  return (
    <ActionForm action={action} className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="space-y-5">
        <div>
          <span className="text-sm font-medium">Estilo base</span>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(Object.keys(PRESETS) as ThemePreset[]).map((key) => (
              <label
                key={key}
                className={`cursor-pointer rounded-xl border p-3 transition ${preset === key ? "border-brand ring-2 ring-brand/20" : "border-line hover:border-muted"}`}
              >
                <input
                  type="radio"
                  name="preset"
                  value={key}
                  checked={preset === key}
                  onChange={() => {
                    setPreset(key);
                    setColors(PRESETS[key].colors);
                  }}
                  className="sr-only"
                />
                <div className="flex items-center gap-2">
                  <span className="flex -space-x-1">
                    {[PRESETS[key].colors.bg, PRESETS[key].colors.primary, PRESETS[key].colors.secondary].map((c) => (
                      <span key={c} className="size-4 rounded-full border border-white" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="font-semibold">{PRESETS[key].label}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{PRESETS[key].description}</p>
              </label>
            ))}
          </div>
        </div>

        <Field label="Frase da tela inicial" hint="Ex.: Onde tudo vira samba">
          <input name="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Logo do evento" hint="PNG com fundo transparente fica melhor.">
            <ImageInput name="logo" currentUrl={theme.logoUrl} removeName="remove_logo" onPreview={setLogoUrl} aspect="aspect-square" />
          </Field>
          <Field label="Imagem de fundo (opcional)" hint="Fica por cima do padrão do tema.">
            <ImageInput name="background" currentUrl={theme.backgroundUrl} removeName="remove_background" onPreview={setBackgroundUrl} aspect="aspect-[9/16]" />
          </Field>
        </div>

        <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium">Ajustar cores</summary>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="color"
                  name={`color_${key}`}
                  value={colors[key]}
                  onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                  className="h-8 w-10 cursor-pointer rounded border border-line bg-white"
                />
                <span className="text-xs">{label}</span>
              </label>
            ))}
          </div>
          <button type="button" className={`${buttonClass.ghost} mt-3`} onClick={() => setColors(PRESETS[preset].colors)}>
            Voltar às cores do estilo
          </button>
        </details>

        <SubmitButton>Salvar tema</SubmitButton>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <span className="text-sm font-medium">Prévia do totem</span>
        <div className="mt-2">
          <ThemePreview name={eventName} theme={preview} />
        </div>
      </div>
    </ActionForm>
  );
}
