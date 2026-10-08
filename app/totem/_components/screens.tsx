"use client";

import { QRCodeSVG } from "qrcode.react";
import { formatBRL } from "@/lib/money";
import type { Charge, MenuCategory, MenuProduct, TotemEvent } from "../_lib/api";
import { EventLogo, ThemeDecor } from "./decor";
import { Glyph, glyphKind, productGlyphKind, type GlyphKind } from "./icons";

/** tamanho em unidades do totem (--u) */
export const u = (n: number) => `calc(var(--u) * ${n})`;

export type Cart = Record<string, number>;

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
export function IdleScreen({
  event,
  promo,
  onStart,
}: {
  event: TotemEvent;
  /** categoria em destaque, para chamar atenção na tela inicial */
  promo: MenuCategory | null;
  onStart: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="relative flex flex-1 flex-col items-center justify-center text-center"
      style={{ gap: u(4), padding: u(6) }}
    >
      <ThemeDecor preset={event.theme.preset} />
      <div className="relative z-10 flex w-full flex-col items-center" style={{ gap: u(3.5) }}>
        <EventLogo name={event.name} theme={event.theme} sizeU={44} />
        {event.theme.tagline && (
          <p className="t-label" style={{ fontSize: u(4) }}>
            {event.theme.tagline}
          </p>
        )}
        {event.venue && (
          <span className="t-ribbon" style={{ fontSize: u(2.8) }}>
            {event.venue}
          </span>
        )}
      </div>

      {promo && (
        <div className="t-promo-callout relative z-10 flex items-center" style={{ gap: u(2.5), marginTop: u(2) }}>
          <Glyph kind="promo" style={{ width: u(9), height: u(9) }} />
          <div className="text-left">
            <div className="t-label" style={{ fontSize: u(3.6) }}>
              {promo.name}
            </div>
            <div style={{ fontSize: u(2.6), opacity: 0.85 }}>
              {promo.subtitle ?? `${promo.products.length} ofertas especiais`}
            </div>
          </div>
        </div>
      )}

      <span className="t-btn t-pulse relative z-10" style={{ fontSize: u(5.5), minHeight: u(14), marginTop: u(3) }}>
        Toque para pedir
      </span>
      <p className="relative z-10" style={{ fontSize: u(2.8), opacity: 0.8 }}>
        Pagamento só por Pix · retire sua ficha aqui
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Cardápio: categorias à esquerda, produtos no meio e (deitado) pedido à direita
// ---------------------------------------------------------------------------
export interface OrderActions {
  cart: Cart;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPay: () => void;
  busy: boolean;
  error: string | null;
}

export function MenuScreen({
  event,
  categories,
  activeCategoryId,
  onSelectCategory,
  onReview,
  onExit,
  wide,
  order,
}: {
  event: TotemEvent;
  categories: MenuCategory[] | null;
  activeCategoryId: string | null;
  onSelectCategory: (id: string) => void;
  /** em pé: abre a tela "Seu pedido" */
  onReview: () => void;
  onExit: () => void;
  /** deitado (computador/monitor): pedido fixo na lateral */
  wide: boolean;
  order: OrderActions;
}) {
  const active = categories?.find((c) => c.id === activeCategoryId) ?? categories?.[0] ?? null;
  const activeKind = active ? glyphKind(active.name, active.featured) : "other";
  const { count, total } = cartSummary(categories, order.cart);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between" style={{ padding: `${u(2.5)} ${u(4)}`, gap: u(3) }}>
        <div className="flex min-w-0 items-center" style={{ gap: u(3) }}>
          {event.theme.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.theme.logoUrl} alt={event.name} draggable={false} className="object-contain" style={{ height: u(11) }} />
          ) : (
            <span
              className="t-title truncate uppercase"
              style={{ fontSize: u(Math.min(6, (wide ? 50 : 70) / (event.name.length * 0.62))) }}
            >
              {event.name}
            </span>
          )}
          {wide && event.venue && (
            <span className="truncate" style={{ fontSize: u(2.5), opacity: 0.7 }}>
              {event.venue}
            </span>
          )}
        </div>
        <button type="button" onClick={onExit} className="t-link flex-none">
          Recomeçar
        </button>
      </header>

      <div className="flex min-h-0 flex-1" style={{ gap: u(3), padding: `0 ${u(4)} ${u(3)}` }}>
        <nav
          className="totem-scroll flex flex-none flex-col"
          style={{ width: u(wide ? 25 : 21), gap: u(2) }}
          aria-label="Categorias"
        >
          {categories?.map((c) => (
            <CategoryButton
              key={c.id}
              category={c}
              active={c.id === active?.id}
              inCart={c.products.reduce((n, p) => n + (order.cart[p.id] ?? 0), 0)}
              onClick={() => onSelectCategory(c.id)}
            />
          ))}
        </nav>

        <main className="totem-scroll min-w-0 flex-1" style={{ paddingBottom: u(4) }}>
          {!categories ? (
            <CenteredMessage title="Carregando cardápio…" />
          ) : !active ? (
            <CenteredMessage title="Cardápio vazio" text="Nenhum produto ativo para este evento." />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline" style={{ gap: `${u(1)} ${u(3)}`, margin: `${u(1)} 0 ${u(3.5)}` }}>
                <h2 className="t-heading" style={{ fontSize: u(6) }}>
                  {active.name}
                </h2>
                {active.subtitle && (
                  <span className="t-label" style={{ fontSize: u(2.8), opacity: 0.85 }}>
                    {active.subtitle}
                  </span>
                )}
              </div>
              <div className="t-grid">
                {active.products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    kind={productGlyphKind(p.name, activeKind)}
                    promo={active.featured || !!p.compare_at_cents}
                    qty={order.cart[p.id] ?? 0}
                    onAdd={() => order.onAdd(p.id)}
                    onRemove={() => order.onRemove(p.id)}
                  />
                ))}
              </div>
            </>
          )}
        </main>

        {wide && <OrderPanel categories={categories} {...order} style={{ width: u(68), flex: "none" }} />}
      </div>

      {!wide && (
        <footer className="t-cartbar relative z-10 flex items-center justify-between" style={{ padding: `${u(3)} ${u(4)}`, gap: u(3) }}>
          <div className="min-w-0">
            <div className="t-label" style={{ fontSize: u(2.8), opacity: 0.85 }}>
              {count === 0 ? "Seu pedido está vazio" : `Seu pedido · ${count} ${count === 1 ? "item" : "itens"}`}
            </div>
            <div className="t-display" style={{ fontSize: u(6.5) }}>
              {formatBRL(total)}
            </div>
          </div>
          <button type="button" className="t-btn" disabled={count === 0} onClick={onReview}>
            Ver pedido
          </button>
        </footer>
      )}
    </div>
  );
}

function CategoryButton({
  category,
  active,
  inCart,
  onClick,
}: {
  category: MenuCategory;
  active: boolean;
  inCart: number;
  onClick: () => void;
}) {
  return (
    <button type="button" className="t-cat" aria-pressed={active} data-featured={category.featured} onClick={onClick}>
      <Glyph kind={glyphKind(category.name, category.featured)} style={{ width: u(9), height: u(9) }} />
      <span className="t-label" style={{ fontSize: u(2.6), lineHeight: 1.1 }}>
        {category.name}
      </span>
      {inCart > 0 && (
        <span className="t-cat-count t-pop" aria-label={`${inCart} no pedido`}>
          {inCart}
        </span>
      )}
    </button>
  );
}

function ProductCard({
  product,
  kind,
  promo,
  qty,
  onAdd,
  onRemove,
}: {
  product: MenuProduct;
  kind: GlyphKind;
  promo: boolean;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="t-card" data-selected={qty > 0}>
      <button type="button" onClick={onAdd} className="flex flex-1 flex-col text-left">
        <div className="t-card-img relative flex w-full items-center justify-center overflow-hidden">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt="" draggable={false} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Glyph kind={kind} style={{ width: "46%", height: "70%" }} />
          )}
          {promo && (
            <span className="t-badge absolute" style={{ top: u(1.5), left: u(1.5) }}>
              Promo
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col" style={{ padding: `${u(2.2)} ${u(2.5)} ${u(1)}`, gap: u(0.8) }}>
          <span className="t-display" style={{ fontSize: u(3.6) }}>
            {product.name}
          </span>
          {product.description && (
            <span className="line-clamp-2" style={{ fontSize: u(2.4), opacity: 0.7 }}>
              {product.description}
            </span>
          )}
          <div className="flex flex-wrap items-center" style={{ gap: u(1.5), marginTop: "auto", paddingTop: u(1) }}>
            <span className="t-price">{formatBRL(product.price_cents)}</span>
            {product.compare_at_cents && (
              <s style={{ fontSize: u(2.6), opacity: 0.6 }}>{formatBRL(product.compare_at_cents)}</s>
            )}
          </div>
        </div>
      </button>
      <div style={{ padding: `${u(1.5)} ${u(2.5)} ${u(2.5)}` }}>
        {qty === 0 ? (
          <button
            type="button"
            className="t-btn w-full whitespace-nowrap"
            onClick={onAdd}
            style={{ fontSize: u(3.1), minHeight: u(7.5), paddingLeft: u(2), paddingRight: u(2) }}
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
      <span className="t-display text-center" style={{ fontSize: u(4.2), minWidth: u(5) }}>
        {qty}
      </span>
      <button type="button" className="t-step" onClick={onAdd} aria-label={`Adicionar ${label}`}>
        +
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pedido (lateral quando deitado; tela própria quando em pé)
// ---------------------------------------------------------------------------
export function OrderPanel({
  categories,
  cart,
  onAdd,
  onRemove,
  onClear,
  onPay,
  busy,
  error,
  className = "",
  style,
}: OrderActions & { categories: MenuCategory[] | null; className?: string; style?: React.CSSProperties }) {
  const lines = cartLines(categories, cart);
  const { total } = cartSummary(categories, cart);

  return (
    <aside className={`t-panel t-paper flex min-h-0 flex-col ${className}`} style={{ padding: u(3.5), gap: u(2.5), ...style }}>
      <div className="flex items-center justify-between">
        <h2 className="t-display" style={{ fontSize: u(5) }}>
          Seu pedido
        </h2>
        {lines.length > 0 && (
          <button type="button" className="t-link" onClick={onClear} disabled={busy}>
            Limpar
          </button>
        )}
      </div>

      <div className="totem-scroll min-h-0 flex-1">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center" style={{ gap: u(2), opacity: 0.7, padding: u(3) }}>
            <Glyph kind="other" style={{ width: u(12), height: u(12) }} />
            <p style={{ fontSize: u(2.8) }}>Toque nos produtos para montar seu pedido.</p>
          </div>
        ) : (
          <ul className="flex flex-col" style={{ gap: u(2.5) }}>
            {lines.map(({ product, qty }) => (
              <li key={product.id} className="t-divider" style={{ paddingBottom: u(2.5) }}>
                <div className="flex items-baseline justify-between" style={{ gap: u(2) }}>
                  <span className="t-display" style={{ fontSize: u(3.4) }}>
                    {product.name}
                  </span>
                  <span className="t-display whitespace-nowrap" style={{ fontSize: u(3.4) }}>
                    {formatBRL(product.price_cents * qty)}
                  </span>
                </div>
                <div className="flex items-center justify-between" style={{ marginTop: u(1.2) }}>
                  <Stepper qty={qty} onAdd={() => onAdd(product.id)} onRemove={() => onRemove(product.id)} label={product.name} />
                  <span style={{ fontSize: u(2.4), opacity: 0.65 }}>{formatBRL(product.price_cents)} cada</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-end justify-between">
        <span className="t-label" style={{ fontSize: u(3.4) }}>
          Total
        </span>
        <span className="t-display" style={{ fontSize: u(7) }}>
          {formatBRL(total)}
        </span>
      </div>

      {error && <ErrorBanner message={error} />}

      <button type="button" className="t-btn w-full" disabled={busy || lines.length === 0} onClick={onPay} style={{ fontSize: u(4.2) }}>
        {busy ? <Spinner /> : <PixGlyph />}
        {busy ? "Gerando Pix…" : "Pagar com Pix"}
      </button>
    </aside>
  );
}

export function CartScreen({ categories, onBack, ...order }: OrderActions & { categories: MenuCategory[] | null; onBack: () => void }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ padding: `${u(5)} ${u(5)} ${u(4)}`, gap: u(3) }}>
      <OrderPanel categories={categories} {...order} className="flex-1" style={{ padding: u(5) }} />
      <button type="button" className="t-btn t-btn-ghost w-full" onClick={onBack} disabled={order.busy}>
        Continuar comprando
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagamento (QR): empilhado em pé, QR à esquerda quando deitado (.t-pay)
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
    <div className="t-pay relative flex-1" style={{ padding: u(5) }}>
      <h2 className="t-title" style={{ gridArea: "title", fontSize: u(8) }}>
        Pague com Pix
      </h2>
      <span className="t-price" style={{ gridArea: "price", fontSize: u(7) }}>
        {formatBRL(charge.amountCents)}
      </span>

      <div className="t-panel self-center" style={{ gridArea: "qr", padding: u(3), background: "#fff" }}>
        <QRCodeSVG
          value={charge.pixCopiaECola}
          level="M"
          marginSize={2}
          size={512}
          title="QR code Pix"
          style={{ width: "var(--t-qr)", height: "var(--t-qr)", display: "block" }}
        />
      </div>

      <ol className="flex flex-col text-left" style={{ gridArea: "steps", fontSize: u(3.2), gap: u(1) }}>
        <li>1. Abra o app do seu banco</li>
        <li>2. Escolha Pix › Pagar com QR code</li>
        <li>3. Aponte a câmera para a tela</li>
      </ol>

      <div className="flex items-center" style={{ gridArea: "timer", gap: u(3) }}>
        <svg viewBox="0 0 100 100" style={{ width: u(11), height: u(11) }} aria-hidden>
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
          <div className="t-display" style={{ fontSize: u(6) }}>
            {mm}:{ss}
          </div>
          <div className="flex items-center" style={{ fontSize: u(2.8), gap: u(1.5), opacity: 0.85 }}>
            <Spinner />
            {seconds > 0 ? "Aguardando pagamento…" : "Verificando pagamento…"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center" style={{ gridArea: "actions", gap: u(2.5), marginTop: u(1) }}>
        <button type="button" className="t-btn t-btn-ghost" onClick={onCancel} style={{ fontSize: u(3.4), minHeight: u(9) }}>
          Cancelar
        </button>
        {mockPix && (
          <button type="button" className="t-btn t-btn-secondary" onClick={onSimulate} style={{ fontSize: u(3), minHeight: u(9) }}>
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
export function PaidScreen({
  event,
  ticketCode,
  secondsLeft,
  onDone,
}: {
  event: TotemEvent;
  ticketCode: string;
  secondsLeft: number;
  onDone: () => void;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center text-center" style={{ padding: u(6), gap: u(3.5) }}>
      <ThemeDecor preset={event.theme.preset} />
      <svg viewBox="0 0 100 100" className="t-pop relative z-10" style={{ width: u(18), height: u(18) }} aria-hidden>
        <circle cx="50" cy="50" r="44" fill="var(--t-primary)" stroke="var(--t-ink)" strokeWidth="5" />
        <path d="M30 52 L45 66 L72 36" fill="none" stroke="var(--t-primary-text)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 className="t-title relative z-10" style={{ fontSize: u(7.5) }}>
        Pagamento confirmado!
      </h2>
      <div className="t-panel t-pop relative z-10 flex flex-col items-center" style={{ padding: `${u(3.5)} ${u(10)}`, gap: u(1), animationDelay: "150ms" }}>
        <span className="t-label" style={{ fontSize: u(3.4), opacity: 0.75 }}>
          Sua senha
        </span>
        <span className="t-display whitespace-nowrap" style={{ fontSize: u(ticketCode.length > 5 ? 13 : 16) }}>
          {ticketCode}
        </span>
      </div>
      <p className="t-label relative z-10" style={{ fontSize: u(4) }}>
        Retire sua ficha impressa abaixo
      </p>
      <svg viewBox="0 0 40 40" className="t-float relative z-10" style={{ width: u(8), height: u(8) }} aria-hidden>
        <path d="M20 4v26M8 20l12 12 12-12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <button type="button" className="t-btn relative z-10" onClick={onDone}>
        Novo pedido
      </button>
      <p className="relative z-10" style={{ fontSize: u(2.6), opacity: 0.75 }}>
        Voltando ao início em {secondsLeft}s
      </p>
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
      <h2 className="t-title" style={{ fontSize: u(8) }}>
        O tempo do Pix acabou
      </h2>
      <p style={{ fontSize: u(3.6), maxWidth: u(80) }}>
        Nenhum valor foi cobrado. Você pode gerar um novo Pix de {formatBRL(amountCents)} para o mesmo pedido.
      </p>
      {error && <ErrorBanner message={error} />}
      <button type="button" className="t-btn" onClick={onRetry} disabled={busy} style={{ fontSize: u(5), minHeight: u(13) }}>
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
        fontSize: u(3),
        padding: `${u(2)} ${u(3)}`,
        background: "var(--t-accent)",
        color: "var(--t-accent-text)",
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
