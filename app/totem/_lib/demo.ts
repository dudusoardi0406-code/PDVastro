// Modo demonstração (/totem/demo): o totem completo rodando no navegador, sem
// banco nem Pix. Serve para ver o visual e mostrar ao cliente. Nada é salvo.

import { resolveTheme, type ThemePreset } from "@/lib/themes";
import type { Charge, Heartbeat, MenuCategory, OrderStatusView } from "./api";

export function isDemo(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/totem/demo");
}

function preset(): ThemePreset {
  return new URLSearchParams(window.location.search).get("tema") === "underground" ? "underground" : "pagode";
}

const EVENTS: Record<ThemePreset, { name: string; venue: string; prefix: string }> = {
  pagode: { name: "Pagode do Zé", venue: "Zé Beer · Av. Lauro Sodré, 2182", prefix: "A" },
  underground: { name: "Submundo do Funk", venue: "Oásis Camping Club", prefix: "U" },
};

const p = (id: string, name: string, price_cents: number, description: string | null = null) => ({
  id,
  name,
  description,
  price_cents,
  image_url: null,
});

const MENUS: Record<ThemePreset, MenuCategory[]> = {
  pagode: [
    {
      id: "c1",
      name: "Cervejas",
      products: [
        p("p1", "Original 600ml", 1500, "Garrafa bem gelada"),
        p("p2", "Balde de Original", 5000, "5 garrafas 600ml"),
        p("p3", "Heineken long neck", 1200),
        p("p4", "Spaten long neck", 1200),
      ],
    },
    {
      id: "c2",
      name: "Drinks",
      products: [
        p("p5", "Gin Tropical", 2500, "Gin, tônica e frutas"),
        p("p6", "Copão de vodka", 3000, "Vodka + energético"),
        p("p7", "Caipirinha", 1800, "Limão, cachaça e açúcar"),
      ],
    },
    {
      id: "c3",
      name: "Sem álcool",
      products: [p("p8", "Água", 500, "500ml"), p("p9", "Refrigerante lata", 700), p("p10", "Energético", 1500)],
    },
  ],
  underground: [
    {
      id: "c1",
      name: "Cervejas",
      products: [p("p1", "Heineken long neck", 1300), p("p2", "Balde Heineken", 6000, "5 long necks")],
    },
    {
      id: "c2",
      name: "Drinks",
      products: [p("p3", "Copão de whisky", 3500, "Whisky + energético"), p("p4", "Gummy shot", 1000, "Bala de gin")],
    },
    { id: "c3", name: "Sem álcool", products: [p("p5", "Água", 500, "500ml"), p("p6", "Energético", 1500)] },
  ],
};

interface DemoOrder {
  status: OrderStatusView["status"];
  totalCents: number;
  expiresAt: number;
  txid: string;
  ticketCode: string | null;
}

const orders = new Map<string, DemoOrder>();
let ticketCounter = 0;
const EXPIRES_MS = 3 * 60 * 1000;

function charge(orderId: string, o: DemoOrder): Charge {
  return {
    orderId,
    txid: o.txid,
    pixCopiaECola: `DEMONSTRACAO-PDVASTRO|${o.txid}|nao-pague-este-qr`,
    amountCents: o.totalCents,
    expiresAt: new Date(o.expiresAt).toISOString(),
  };
}

const newId = () => crypto.randomUUID();

/** Responde as rotas do totem como o servidor faria. */
export async function demoApi<T>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}): Promise<T> {
  await new Promise((r) => setTimeout(r, 250));
  const kind = preset();
  const ev = EVENTS[kind];

  if (path === "/api/totem/heartbeat") {
    const hb: Heartbeat = {
      serverTime: new Date().toISOString(),
      totem: { id: "demo", name: "Totem de demonstração", paperWidthMm: 80 },
      event: { id: `demo-${kind}`, name: ev.name, venue: ev.venue, theme: resolveTheme({ preset: kind }) },
      tickets: [],
      mockPix: true,
      version: "demo",
    };
    return hb as T;
  }

  if (path === "/api/totem/menu") return { categories: MENUS[kind] } as T;

  if (path === "/api/totem/orders" && method === "POST") {
    const index = new Map(MENUS[kind].flatMap((c) => c.products).map((x) => [x.id, x]));
    const items = (body as { items: { product_id: string; quantity: number }[] }).items;
    const totalCents = items.reduce((sum, i) => sum + (index.get(i.product_id)?.price_cents ?? 0) * i.quantity, 0);
    const id = newId();
    const o: DemoOrder = {
      status: "aguardando_pagamento",
      totalCents,
      expiresAt: Date.now() + EXPIRES_MS,
      txid: id.replace(/-/g, ""),
      ticketCode: null,
    };
    orders.set(id, o);
    return charge(id, o) as T;
  }

  if (path === "/api/dev/simulate-payment") {
    const { txid } = body as { txid: string };
    for (const o of orders.values()) {
      if (o.txid === txid && o.status === "aguardando_pagamento") {
        ticketCounter += 1;
        o.status = "pago";
        o.ticketCode = `${ev.prefix}-${String(ticketCounter).padStart(3, "0")}`;
      }
    }
    return { simulated: true } as T;
  }

  const m = /^\/api\/totem\/orders\/([^/]+)(?:\/(pix|cancel))?$/.exec(path);
  const o = m ? orders.get(m[1]) : undefined;
  if (m && o) {
    const [, id, action] = m;
    if (action === "cancel") {
      if (o.status !== "pago") o.status = "cancelado";
      return { cancelled: true } as T;
    }
    if (action === "pix") {
      o.status = "aguardando_pagamento";
      o.expiresAt = Date.now() + EXPIRES_MS;
      o.txid = newId().replace(/-/g, "");
      return charge(id, o) as T;
    }
    if (o.status === "aguardando_pagamento" && Date.now() > o.expiresAt) o.status = "expirado";
    const view: OrderStatusView = {
      orderId: id,
      status: o.status,
      ticketCode: o.ticketCode,
      totalCents: o.totalCents,
      payment: null,
    };
    return view as T;
  }

  return { ok: true } as T;
}
