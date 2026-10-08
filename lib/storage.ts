import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/supabase/service";

// Imagens (logo, fundo, fotos de produto) no bucket público "assets".
// O navegador já reduz a imagem antes de enviar (components/image-input.tsx).

const BUCKET = "assets";
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
};

export function hasFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "size" in value && value.size > 0;
}

/** Envia a imagem e retorna a URL pública. Lança erro com mensagem para o admin. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Formato de imagem não aceito. Use JPG, PNG, WEBP ou SVG.");
  if (file.size > MAX_BYTES) throw new Error("Imagem muito grande (máx. 3 MB).");

  const path = `${folder}/${randomUUID()}.${ext}`;
  const { error } = await db()
    .storage.from(BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Falha ao enviar imagem: ${error.message}`);

  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
