"use client";

import { QRCodeSVG } from "qrcode.react";
import { formatBRL } from "@/lib/money";
import type { Charge, MenuCategory, MenuProduct, TotemEvent } from "../_lib/api";
import { EventLogo, ProductGlyph, ThemeDecor } from "./decor";

/** tamanho em unidades do totem (--u) */
export const u = (n: number) => `calc(var(--u) * ${n})`;

export type Cart = Record<string, number>;

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
export function IdleScreen({ event, onStart }: { event: TotemEvent; onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="relative flex flex-1 flex-col items-center justify-center text-center"
      style={{ gap: u(5), padding: u(6) }}
    >
      <ThemeDecor preset={event.theme.preset} />
      <div className="relative z-10 flex w-full flex-col items-center" style={{ gap: u(4) }}>
        <EventLogo name={event.name} theme={event.theme} sizeU={46} />
        {event.theme.tagline && (
          <p className="t-label" style={{ fontSize: u(4.2), opacity: 0.95 }}>
            {event.theme.tagline}
          </p>
        )}
        {event.venue && (
          <span className="t-ribbon" style={{ fontSize: u(3) }}>
            {event.venue}
          </span>
        )}
      </div>
      <span className="t-btn t-pulse relative z-10" style={{ fontSize: u(6), minHeight: u(15), marginTop: u(6) }}>
        Toque para pedir
      </span>
      <p className="relative z-10" style={{ fontSize: u(3), opacity: 0.85 }}>
        Pagamento só por Pix · retire sua ficha aqui
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Cardápio
// ---------------------------------------------------------------------------
export function MenuScreen({
  event,
  categories,
  activeCategoryId,
  onSelectCategory,
  cart,
  onAdd,
  onRemove,
  onReview,
  onExit,
}: {
  event: TotemEvent;
  categories: MenuCategory[] | null;
  activeCategoryId: string | null;
  onSelectCategory: (id: string) => void;
  cart: Cart;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onReview: () => void;
  onExit: () => void;
}) {
  const active = categories?.find((c) => c.id === activeCategoryId) ?? categories?.[0] ?? null;
  const { count, total } = cartSummary(categories, cart);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between" style={{ padding: `${u(3)} ${u(4)}`, gap: u(3) }}>
        <div className="flex min-w-0 items-center" style={{ gap: u(3), maxHeight: u(14) }}>
          {event.theme.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.theme.logoUrl} alt={event.name} draggable={false} className="object-contain" style={{ height: u(13) }} />
          ) : (
            <span
              className="t-title truncate uppercase"
              style={{ fontSize: u(Math.min(7, 58 / (event.name.length * 0.62))) }}
            >
              {event.name}
            </span>
          )}
        </div>
        <button type="button" onClick={onExit} className="t-btn t-btn-ghost" style={{ fontSize: u(3), minHeight: u(8) }}>
          Recomeçar
        </button>
      </header>

      <nav className="totem-scroll flex flex-none overflow-x-auto" style={{ gap: u(2), padding: `${u(1)} ${u(4)} ${u(3)}` }}>
        {categories?.map((c) => (
          <button
            key={c.id}
            type="button"
            className="t-tab"
            aria-pressed={c.id === active?.id}
            onClick={() => onSelectCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </nav>

      <main className="totem-scroll min-h-0 flex-1" style={{ padding: `${u(1)} ${u(4)} ${u(6)}` }}>
        {!categories ? (
          <CenteredMessage title="Carregando cardápio…" />
        ) : categories.length === 0 ? (
          <CenteredMessage title="Cardápio vazio" text="Nenhum produto ativo para este evento." />
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${u(42)}, 46%), 1fr))`, gap: u(3.5) }}
          >
            {active?.products.map((p) => (
              <ProductCard key={p.id} product={p} qty={cart[p.id] ?? 0} onAdd={() => onAdd(p.id)} onRemove={() => onRemove(p.id)} />
            ))}
          </div>
        )}
      </main>

      <footer className="t-cartbar relative z-10 flex items-center justify-between" style={{ padding: `${u(3)} ${u(4)}`, gap: u(3) }}>
        <div className="min-w-0">
          <div className="t-label" style={{ fontSize: u(3), opacity: 0.85 }}>
            {count === 0 ? "Seu pedido está vazio" : `Seu pedido · ${count} ${count === 1 ? "item" : "itens"}`}
          </div>
          <div className="t-display" style={{ fontSize: u(6.5) }}>
            {formatBRL(total)}
          </div>
        </div>
        <button type="button" className="t-btn" disabled={count === 0} onClick={onReview} style={{ fontSize: u(4.6) }}>
          Ver pedido
        </button>
      </footer>
    </div>
  );
}

function ProductCard({
  product,
  qty,
  onAdd,
  onRemove,
}: {
  product: MenuProduct;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="t-card" data-selected={qty > 0}>
      <button type="button" onClick={onAdd} className="flex flex-1 flex-col text-left">
        <div
          className="relative flex w-full items-center justify-center overflow-hidden"
          style={{ aspectRatio: "4 / 3", background: "color-mix(in srgb, var(--t-bg-alt) 35%, var(--t-surface))" }}
        >
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt="" draggable={false} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <ProductGlyph />
          )}
          {qty > 0 && (
            <span className="t-ribbon t-pop absolute" style={{ top: u(1.5), right: u(1.5), fontSize: u(3.4) }}>
              {qty}x
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col items-start" style={{ padding: `${u(2.5)} ${u(2.5)} ${u(1)}`, gap: u(1.2) }}>
          <span className="t-display" style={{ fontSize: u(4) }}>
            {product.name}
          </span>
          {product.description && (
            <span className="line-clamp-2" style={{ fontSize: u(2.6), opacity: 0.75 }}>
              {product.description}
            </span>
          )}
          <span className="t-price" style={{ marginTop: "auto" }}>
            {formatBRL(product.price_cents)}
          </span>
        </div>
      </button>
      <div style={{ padding: `${u(1.5)} ${u(2.5)} ${u(2.5)}` }}>
        {qty === 0 ? (
          <button
            type="button"
            className="t-btn w-full"
            onClick={onAdd}
            style={{ fontSize: u(3.4), minHeight: u(8) }}
            aria-label={`Adicionar ${product.name}`}
          >
            + Adicionar
          </button>
        ) : (
          <Stepper qty={qty} onAdd={onAdd} onRemove={onRemove} label={product.name} wide />
        )}
      </div>
    </div>
  );
}

function Stepper({
  qty,
  onAdd,
  onRemove,
  label,
  wide = false,
}: {
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  label: string;
  wide?: boolean;
}) {
  return (
    <div className={`flex items-center ${wide ? "justify-between" : ""}`} style={{ gap: u(1.5) }}>
      <button type="button" className="t-step t-step-minus" onClick={onRemove} aria-label={`Remover ${label}`}>
        −
      </button>
      <span className="t-display text-center" style={{ fontSize: u(4.6), minWidth: u(5) }}>
        {qty}
      </span>
      <button type="button" className="t-step" onClick={onAdd} aria-label={`Adicionar ${label}`}>
        +
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumo do pedido
// ---------------------------------------------------------------------------
export function CartScreen({
  categories,
  cart,
  onAdd,
  onRemove,
  onBack,
  onClear,
  onPay,
  busy,
  error,
}: {
  categories: MenuCategory[] | null;
  cart: Cart;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  onClear: () => void;
  onPay: () => void;
  busy: boolean;
  error: string | null;
}) {
  const lines = cartLines(categories, cart);
  const { total } = cartSummary(categories, cart);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ padding: `${u(5)} ${u(5)} ${u(4)}`, gap: u(4) }}>
      <div className="flex items-end justify-between" style={{ gap: u(3) }}>
        <h2 className="t-title" style={{ fontSize: u(9) }}>
          Seu pedido
        </h2>
        <button type="button" className="t-btn t-btn-ghost" onClick={onClear} style={{ fontSize: u(3), minHeight: u(8) }}>
          Limpar
        </button>
      </div>

      <div className="t-panel t-paper totem-scroll min-h-0 flex-1" style={{ padding: `${u(5)} ${u(4)} ${u(3)}` }}>
        {lines.length === 0 ? (
          <CenteredMessage title="Pedido vazio" />
        ) : (
          <ul className="flex flex-col" style={{ gap: u(3) }}>
            {lines.map(({ product, qty }) => (
              <li
                key={product.id}
                className="flex items-center justify-between"
                style={{ gap: u(2), paddingBottom: u(3), borderBottom: "2px dashed color-mix(in srgb, var(--t-surface-text) 25%, transparent)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="t-display" style={{ fontSize: u(4.2) }}>
                    {product.name}
                  </div>
                  <div style={{ fontSize: u(2.8), opacity: 0.7 }}>{formatBRL(product.price_cents)} cada</div>
                </div>
                <Stepper qty={qty} onAdd={() => onAdd(product.id)} onRemove={() => onRemove(product.id)} label={product.name} />
                <div className="t-display text-right" style={{ fontSize: u(4.2), minWidth: u(20) }}>
                  {formatBRL(product.price_cents * qty)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="t-label" style={{ fontSize: u(5) }}>
          Total
        </span>
        <span className="t-title" style={{ fontSize: u(10) }}>
          {formatBRL(total)}
        </span>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-col" style={{ gap: u(3) }}>
        <button
          type="button"
          className="t-btn w-full"
          disabled={busy || lines.length === 0}
          onClick={onPay}
          style={{ fontSize: u(6), minHeight: u(15) }}
        >
          {busy ? <Spinner /> : <PixGlyph />}
          {busy ? "Gerando Pix…" : "Pagar com Pix"}
        </button>
        <button type="button" className="t-btn t-btn-ghost w-full" onClick={onBack} disabled={busy}>
          Continuar comprando
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagamento (QR)
// ---------------------------------------------------------------------------
export function PaymentScreen({
  charge,
  remainingMs,
  totalMs,
  onCancel,
  mockPix,
  onSimulate,
}: {
  charge: Charge;
  remainingMs: number;
  totalMs: number;
  onCancel: () => void;
  mockPix: boolean;
  onSimulate: () => void;
}) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const progress = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center text-center" style={{ padding: u(5), gap: u(3.5) }}>
      <h2 className="t-title" style={{ fontSize: u(9) }}>
        Pague com Pix
      </h2>
      <span className="t-price" style={{ fontSize: u(8) }}>
        {formatBRL(charge.amountCents)}
      </span>

      <div className="t-panel" style={{ padding: u(3), background: "#fff", marginTop: u(2) }}>
        <QRCodeSVG
          value={charge.pixCopiaECola}
          level="M"
          marginSize={2}
          size={512}
          title="QR code Pix"
          style={{ width: u(58), height: u(58), display: "block" }}
        />
      </div>

      <ol className="flex flex-col text-left" style={{ fontSize: u(3.4), gap: u(1), marginTop: u(1) }}>
        <li>1. Abra o app do seu banco</li>
        <li>2. Escolha Pix › Pagar com QR code</li>
        <li>3. Aponte a câmera para a tela</li>
      </ol>

      <div className="flex items-center" style={{ gap: u(3), marginTop: u(1) }}>
        <svg viewBox="0 0 100 100" style={{ width: u(12), height: u(12) }} aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="var(--t-primary)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dashoffset 250ms linear" }}
          />
        </svg>
        <div className="text-left">
          <div className="t-display" style={{ fontSize: u(6.5) }}>
            {mm}:{ss}
          </div>
          <div className="flex items-center" style={{ fontSize: u(3), gap: u(1.5), opacity: 0.85 }}>
            <Spinner />
            {seconds > 0 ? "Aguardando pagamento…" : "Verificando pagamento…"}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center" style={{ gap: u(2.5), marginTop: u(3) }}>
        <button type="button" className="t-btn t-btn-ghost" onClick={onCancel} style={{ fontSize: u(3.6), minHeight: u(9) }}>
          Cancelar
        </button>
        {mockPix && (
          <button type="button" className="t-btn t-btn-secondary" onClick={onSimulate} style={{ fontSize: u(3), minHeight: u(8) }}>
            Simular pagamento (teste)
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pago
// ---------------------------------------------------------------------------
export function PaidScreen({ ticketCode, secondsLeft, onDone }: { ticketCode: string; secondsLeft: number; onDone: () => void }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center text-center" style={{ padding: u(6), gap: u(4) }}>
      <svg viewBox="0 0 100 100" className="t-pop" style={{ width: u(22), height: u(22) }} aria-hidden>
        <circle cx="50" cy="50" r="44" fill="var(--t-primary)" stroke="var(--t-ink)" strokeWidth="6" />
        <path d="M30 52 L45 66 L72 36" fill="none" stroke="var(--t-primary-text)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 className="t-title" style={{ fontSize: u(8) }}>
        Pagamento confirmado!
      </h2>
      <div className="t-panel t-pop flex flex-col items-center" style={{ padding: `${u(4)} ${u(10)}`, gap: u(1), animationDelay: "150ms" }}>
        <span className="t-label" style={{ fontSize: u(4), opacity: 0.75 }}>
          Sua senha
        </span>
        <span className="t-display whitespace-nowrap" style={{ fontSize: u(ticketCode.length > 5 ? 14 : 17) }}>
          {ticketCode}
        </span>
      </div>
      <p className="t-label" style={{ fontSize: u(4.6) }}>
        Retire sua ficha impressa abaixo
      </p>
      <svg viewBox="0 0 40 40" className="t-float" style={{ width: u(10), height: u(10) }} aria-hidden>
        <path d="M20 4v26M8 20l12 12 12-12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <button type="button" className="t-btn" onClick={onDone} style={{ marginTop: u(2) }}>
        Novo pedido
      </button>
      <p style={{ fontSize: u(2.8), opacity: 0.75 }}>Voltando ao início em {secondsLeft}s</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pix expirado
// ---------------------------------------------------------------------------
export function ExpiredScreen({
  amountCents,
  onRetry,
  onCancel,
  busy,
  error,
}: {
  amountCents: number;
  onRetry: () => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center text-center" style={{ padding: u(6), gap: u(4) }}>
      <h2 className="t-title" style={{ fontSize: u(9) }}>
        O tempo do Pix acabou
      </h2>
      <p style={{ fontSize: u(3.8), maxWidth: u(80) }}>
        Nenhum valor foi cobrado. Você pode gerar um novo Pix de {formatBRL(amountCents)} para o mesmo pedido.
      </p>
      {error && <ErrorBanner message={error} />}
      <button type="button" className="t-btn" onClick={onRetry} disabled={busy} style={{ fontSize: u(5.5), minHeight: u(14) }}>
        {busy ? <Spinner /> : <PixGlyph />}
        {busy ? "Gerando Pix…" : "Gerar novo Pix"}
      </button>
      <button type="button" className="t-btn t-btn-ghost" onClick={onCancel} disabled={busy}>
        Cancelar pedido
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------
export function CenteredMessage({ title, text }: { title: string; text?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: u(2), padding: u(6) }}>
      <p className="t-display" style={{ fontSize: u(5) }}>
        {title}
      </p>
      {text && <p style={{ fontSize: u(3.2), opacity: 0.8 }}>{text}</p>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="t-label text-center"
      style={{
        fontSize: u(3.4),
        padding: `${u(2.5)} ${u(3)}`,
        background: "var(--t-accent)",
        color: "var(--t-accent-text)",
        border: "calc(var(--u) * 0.45) solid var(--t-ink)",
      }}
    >
      {message}
    </div>
  );
}

export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="t-spin" style={{ width: "1em", height: "1em" }} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function PixGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: "1.1em", height: "1.1em" }} aria-hidden>
      <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Carrinho
// ---------------------------------------------------------------------------
function productIndex(categories: MenuCategory[] | null): Map<string, MenuProduct> {
  const map = new Map<string, MenuProduct>();
  categories?.forEach((c) => c.products.forEach((p) => map.set(p.id, p)));
  return map;
}

export function cartLines(categories: MenuCategory[] | null, cart: Cart) {
  const index = productIndex(categories);
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ product: index.get(id), qty }))
    .filter((l): l is { product: MenuProduct; qty: number } => !!l.product);
}

export function cartSummary(categories: MenuCategory[] | null, cart: Cart) {
  const lines = cartLines(categories, cart);
  return {
    count: lines.reduce((n, l) => n + l.qty, 0),
    total: lines.reduce((n, l) => n + l.qty * l.product.price_cents, 0),
  };
}

/** Remove do carrinho o que saiu do cardápio */
export function pruneCart(categories: MenuCategory[], cart: Cart): Cart {
  const index = productIndex(categories);
  return Object.fromEntries(Object.entries(cart).filter(([id, qty]) => qty > 0 && index.has(id)));
}
