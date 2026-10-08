"use client";

import { useRef, useState } from "react";
import { buttonClass } from "./ui";

const MAX_SIDE = 1400;

/** Reduz a foto no navegador (máx. 1400 px, WEBP) antes de enviar. */
async function shrink(file: File): Promise<File> {
  if (file.type === "image/svg+xml") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
}

export function ImageInput({
  name,
  currentUrl,
  removeName,
  onPreview,
  aspect = "aspect-square",
}: {
  name: string;
  currentUrl?: string | null;
  /** nome do checkbox "remover imagem" */
  removeName?: string;
  onPreview?: (url: string | null) => void;
  aspect?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-start gap-3">
      <div className={`${aspect} w-20 flex-none overflow-hidden rounded-lg border border-line bg-canvas`}>
        {preview && !removed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">sem imagem</div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={input}
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              const small = await shrink(file);
              const dt = new DataTransfer();
              dt.items.add(small);
              e.target.files = dt.files;
              const url = URL.createObjectURL(small);
              setPreview(url);
              setRemoved(false);
              onPreview?.(url);
            } finally {
              setBusy(false);
            }
          }}
        />
        <button type="button" className={buttonClass.secondary} onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Preparando…" : preview && !removed ? "Trocar imagem" : "Escolher imagem"}
        </button>
        {removeName && currentUrl && (
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              name={removeName}
              className="accent-danger"
              onChange={(e) => {
                setRemoved(e.target.checked);
                onPreview?.(e.target.checked ? null : (preview ?? null));
              }}
            />
            Remover imagem
          </label>
        )}
      </div>
    </div>
  );
}
