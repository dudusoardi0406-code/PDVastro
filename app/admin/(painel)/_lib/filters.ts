import "server-only";
import { businessDate, isIsoDate } from "@/lib/business-day";
import { isUuid } from "@/lib/http";
import type { EventRow } from "@/lib/types";

type Search = Record<string, string | string[] | undefined>;

export function param(search: Search, key: string): string | null {
  const v = search[key];
  return typeof v === "string" && v ? v : null;
}

/** Evento (?evento=) e dia operacional (?dia=) com padrões razoáveis. */
export function eventAndDate(search: Search, events: EventRow[]) {
  const requested = param(search, "evento");
  const event =
    (isUuid(requested) && events.find((e) => e.id === requested)) || events.find((e) => e.active) || events[0] || null;
  const day = param(search, "dia");
  return { event, date: isIsoDate(day) ? day : businessDate() };
}
