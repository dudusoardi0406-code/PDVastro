import { after, connection, type NextRequest } from "next/server";
import { appVersion, isSupabaseConfigured, pixProviderName } from "@/lib/env";
import { json, jsonError } from "@/lib/http";
import { db, must } from "@/lib/supabase/service";
import { resolveTheme } from "@/lib/themes";
import { pendingTickets } from "@/lib/tickets";
import { totemFromRequest, totemUnauthorized } from "@/lib/totem-auth";
import type { EventRow } from "@/lib/types";

// Chamado pelo totem a cada 5 s: confirma conexão, entrega tema/evento atual
// e as fichas pendentes de impressão.
export async function GET(req: NextRequest) {
  await connection();
  if (!isSupabaseConfigured()) {
    return jsonError("SUPABASE_NAO_CONFIGURADO", "Banco de dados não configurado.", 503);
  }
  const totem = await totemFromRequest(req);
  if (!totem) return totemUnauthorized();

  const [event, tickets] = await Promise.all([
    totem.event_id
      ? db()
          .from("events")
          .select("id, name, venue, theme, active")
          .eq("id", totem.event_id)
          .maybeSingle()
          .then((r) => must(r, "evento do totem") as Pick<EventRow, "id" | "name" | "venue" | "theme" | "active"> | null)
      : Promise.resolve(null),
    pendingTickets(totem.id),
  ]);

  after(async () => {
    await db().from("totems").update({ last_seen_at: new Date().toISOString() }).eq("id", totem.id);
  });

  return json({
    serverTime: new Date().toISOString(),
    totem: { id: totem.id, name: totem.name, paperWidthMm: totem.paper_width_mm },
    event:
      event && event.active
        ? { id: event.id, name: event.name, venue: event.venue, theme: resolveTheme(event.theme) }
        : null,
    tickets,
    mockPix: pixProviderName() === "mock",
    version: appVersion(),
  });
}
