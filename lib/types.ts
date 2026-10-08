// Linhas das tabelas (espelham supabase/migrations/0001_schema.sql)

import type { EventTheme } from "@/lib/themes";

export type OrderStatus = "aguardando_pagamento" | "pago" | "expirado" | "cancelado";
export type PaymentStatus = "pendente" | "pago" | "expirado" | "cancelado" | "divergente" | "duplicado";

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  venue: string | null;
  starts_at: string;
  ticket_prefix: string;
  pix_expiration_seconds: number;
  theme: EventTheme;
  active: boolean;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  event_id: string;
  name: string;
  position: number;
  active: boolean;
  /** destaque no totem (ex.: Promoções do dia) */
  featured: boolean;
  subtitle: string | null;
  created_at: string;
}

export interface ProductRow {
  id: string;
  event_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  /** preço "de" (riscado) */
  compare_at_cents: number | null;
  image_url: string | null;
  position: number;
  active: boolean;
  created_at: string;
}

export interface TotemRow {
  id: string;
  name: string;
  event_id: string | null;
  token_hash: string | null;
  paper_width_mm: 58 | 80;
  last_seen_at: string | null;
  created_at: string;
}

export interface OrderRow {
  id: string;
  event_id: string;
  totem_id: string | null;
  business_date: string;
  ticket_number: number | null;
  ticket_code: string | null;
  status: OrderStatus;
  total_cents: number;
  created_at: string;
  paid_at: string | null;
  printed_at: string | null;
  print_count: number;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  name_snapshot: string;
  unit_price_cents: number;
  quantity: number;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  provider: string;
  txid: string;
  pix_copia_cola: string | null;
  amount_cents: number;
  paid_amount_cents: number | null;
  status: PaymentStatus;
  e2e_id: string | null;
  expires_at: string;
  created_at: string;
  paid_at: string | null;
  last_checked_at: string | null;
  raw_provider: unknown;
}

export interface PrintJobRow {
  id: string;
  order_id: string;
  totem_id: string | null;
  kind: "original" | "reprint";
  status: "pendente" | "impresso" | "cancelado";
  created_at: string;
  printed_at: string | null;
}

/** Dados que o totem precisa para imprimir uma ficha */
export interface TicketData {
  jobId: string;
  kind: "original" | "reprint";
  orderId: string;
  ticketCode: string;
  eventName: string;
  venue: string | null;
  paidAt: string;
  totalCents: number;
  items: { name: string; quantity: number; unitPriceCents: number }[];
  pixRef: string | null;
}

export interface SalesReport {
  total_cents: number;
  orders_paid: number;
  orders_expired: number;
  orders_cancelled: number;
  orders_pending: number;
  items_sold: number;
  not_printed: number;
  by_product: { name: string; quantity: number; total_cents: number }[];
  by_hour: { hour: number; orders: number; total_cents: number }[];
  pix_received_cents: number;
  pix_received_count: number;
  pix_problems: {
    payment_id: string;
    order_id: string;
    status: PaymentStatus;
    txid: string;
    amount_cents: number;
    paid_amount_cents: number | null;
    e2e_id: string | null;
    paid_at: string | null;
  }[];
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  aguardando_pagamento: "Aguardando Pix",
  pago: "Pago",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  expirado: "Expirado",
  cancelado: "Cancelado",
  divergente: "Valor divergente",
  duplicado: "Pago em duplicidade",
};
