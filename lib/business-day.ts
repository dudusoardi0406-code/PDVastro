// "Dia operacional": vira às 06:00 de Porto Velho, porque os eventos vão das 20h às 04h.
// Mesma regra da função SQL public.business_date_at().

export const TIMEZONE = "America/Porto_Velho";
const DAY_START_HOURS = 6;

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data operacional (YYYY-MM-DD) de um instante. */
export function businessDate(at: Date = new Date()): string {
  return ymd.format(new Date(at.getTime() - DAY_START_HOURS * 3600 * 1000));
}

export function isIsoDate(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeOnly = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

export function formatTime(iso: string | null | undefined): string {
  return iso ? timeOnly.format(new Date(iso)) : "—";
}

/** "2026-10-10" -> "10/10/2026" */
export function formatIsoDate(value: string): string {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}
