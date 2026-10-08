import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus, type PaymentStatus } from "@/lib/types";
import { Badge } from "../../_components/ui";

const ORDER_TONE = {
  aguardando_pagamento: "yellow",
  pago: "green",
  expirado: "neutral",
  cancelado: "neutral",
} as const;

const PAYMENT_TONE = {
  pendente: "yellow",
  pago: "green",
  expirado: "neutral",
  cancelado: "neutral",
  divergente: "red",
  duplicado: "red",
} as const;

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}
