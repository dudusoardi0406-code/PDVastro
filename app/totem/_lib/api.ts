// Chamadas do totem para o servidor (lado do navegador).

import type { ResolvedTheme } from "@/lib/themes";
import type { OrderStatus, PaymentStatus, TicketData } from "@/lib/types";
import { demoApi, isDemo } from "./demo";

export interface TotemEvent {
  id: string;
  name: string;
  venue: string | null;
  theme: ResolvedTheme;
}

export interface Heartbeat {
  serverTime: string;
  totem: { id: string; name: string; paperWidthMm: 58 | 80 };
  event: TotemEvent | null;
  tickets: TicketData[];
  mockPix: boolean;
  /** muda a cada deploy */
  version: string;
}

export interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  /** preço "de" (riscado) */
  compare_at_cents: number | null;
  image_url: string | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  subtitle: string | null;
  /** destaque (ex.: Promoções do dia) */
  featured: boolean;
  products: MenuProduct[];
}

export interface Charge {
  orderId: string;
  txid: string;
  pixCopiaECola: string;
  amountCents: number;
  expiresAt: string;
}

export interface OrderStatusView {
  orderId: string;
  status: OrderStatus;
  ticketCode: string | null;
  totalCents: number;
  payment: { status: PaymentStatus; expiresAt: string; txid: string } | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly orderId?: string,
  ) {
    super(message);
  }
}

/** status 0 = sem conexão / tempo esgotado */
export async function api<T>(
  path: string,
  { method = "GET", body, timeoutMs = 8000 }: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  if (isDemo()) return demoApi<T>(path, { method, body });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("Sem conexão com o servidor.", 0, "SEM_CONEXAO");
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string; message?: string; orderId?: string })
    | null;
  if (!res.ok) {
    throw new ApiError(
      data?.message ?? "Algo deu errado. Tente novamente.",
      res.status,
      data?.error ?? "ERRO",
      data?.orderId,
    );
  }
  return data as T;
}
