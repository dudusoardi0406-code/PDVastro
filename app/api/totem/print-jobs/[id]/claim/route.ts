import type { NextRequest } from "next/server";
import { errorResponse, isUuid, json, jsonError } from "@/lib/http";
import { db, must } from "@/lib/supabase/service";
import { totemFromRequest, totemUnauthorized } from "@/lib/totem-auth";

// O totem só imprime se este "claim" der certo: garante ficha única.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/totem/print-jobs/[id]/claim">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError("FICHA_NAO_ENCONTRADA", "Ficha não encontrada.", 404);

  try {
    const totem = await totemFromRequest(req);
    if (!totem) return totemUnauthorized();

    const claimed = must(
      await db().rpc("claim_print_job", { p_job_id: id, p_totem_id: totem.id }),
      "claim_print_job",
    ) as boolean;

    return claimed ? json({ ok: true }) : jsonError("JA_IMPRESSA", "Ficha já impressa.", 409);
  } catch (err) {
    return errorResponse(err);
  }
}
