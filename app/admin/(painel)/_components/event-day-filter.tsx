import type { ReactNode } from "react";
import type { EventRow } from "@/lib/types";
import { buttonClass, Field, inputClass } from "../../_components/ui";

/** Filtro GET de evento + dia operacional (sem JS). */
export function EventDayFilter({
  action,
  events,
  eventId,
  date,
  children,
}: {
  action: string;
  events: EventRow[];
  eventId: string;
  date: string;
  children?: ReactNode;
}) {
  return (
    <form action={action} method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-panel p-4">
      <Field label="Evento" className="min-w-52 flex-1">
        <select name="evento" defaultValue={eventId} className={inputClass}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Dia operacional" hint="Das 06:00 até 05:59 do dia seguinte">
        <input type="date" name="dia" defaultValue={date} className={inputClass} />
      </Field>
      {children}
      <button type="submit" className={`${buttonClass.secondary} mb-5`}>
        Filtrar
      </button>
    </form>
  );
}
