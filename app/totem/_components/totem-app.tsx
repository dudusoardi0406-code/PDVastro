"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { resolveTheme, themeVars } from "@/lib/themes";
import type { TicketData } from "@/lib/types";
import { api, ApiError, type Charge, type Heartbeat, type MenuCategory, type OrderStatusView } from "../_lib/api";
import { DemoBadge } from "./demo-badge";
import { PrintTicket } from "./print-ticket";
import {
  CartScreen,
  ExpiredScreen,
  IdleScreen,
  MenuScreen,
  PaidScreen,
  PaymentScreen,
  Spinner,
  pruneCart,
  u,
  type Cart,
} from "./screens";

type Screen =
  | { name: "idle" }
  | { name: "menu" }
  | { name: "cart" }
  | { name: "payment"; charge: Charge; startedAt: number }
  | { name: "paid"; ticketCode: string; at: number }
  | { name: "expired"; orderId: string; amountCents: number; at: number };

type Connection = "boot" | "ready" | "unpaired" | "unconfigured";

const HEARTBEAT_MS = 5_000;
const POLL_MS = 2_000;
const IDLE_ASK_MS = 60_000;
const IDLE_ASK_SECONDS = 15;
const PAID_RETURN_MS = 10_000;
const EXPIRED_RETURN_MS = 45_000;
const MAX_QTY = 20;

const FALLBACK_THEME = resolveTheme({ preset: "pagode" });

export function TotemApp() {
  // /totem?erro=pareamento (link inválido); só é usado depois do primeiro heartbeat
  const [pairingError] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("erro") === "pareamento",
  );
  const [connection, setConnection] = useState<Connection>("boot");
  const [hb, setHb] = useState<Heartbeat | null>(null);
  const [offline, setOffline] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: "idle" });
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  const [cart, setCart] = useState<Cart>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState<TicketData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [askStillThere, setAskStillThere] = useState<number | null>(null);
  // atualizado pelo relógio enquanto há contagem na tela (0 até lá)
  const [now, setNow] = useState(0);
  /** diferença entre o relógio do servidor e o do totem */
  const [clockOffset, setClockOffset] = useState(0);

  const failures = useRef(0);
  const lastTouch = useRef(0);
  const pulse = useRef<() => void>(() => {});
  const handledJobs = useRef(new Set<string>());
  const printQueue = useRef<TicketData[]>([]);
  const printBusy = useRef(false);
  const version = useRef<string | null>(null);
  const eventId = hb?.event?.id ?? null;

  // tela sempre acesa (Wake Lock); o Chrome solta a trava quando a aba some
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // sem suporte ou sem permissão: segue sem a trava
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);

  // ---------------------------------------------------------------- ações
  const reset = useCallback(() => {
    setScreen({ name: "idle" });
    setCart({});
    setActiveCategory(null);
    setError(null);
    setBusy(false);
    setAskStillThere(null);
  }, []);

  const loadMenu = useCallback(async () => {
    try {
      const res = await api<{ categories: MenuCategory[] }>("/api/totem/menu");
      setMenu(res.categories);
      setCart((c) => pruneCart(res.categories, c));
    } catch {
      // mantém o cardápio anterior; o heartbeat cuida do "fora do ar"
    }
  }, []);

  const start = () => {
    setScreen({ name: "menu" });
    setError(null);
    void loadMenu();
  };

  const add = (id: string) => setCart((c) => ({ ...c, [id]: Math.min(MAX_QTY, (c[id] ?? 0) + 1) }));
  const remove = (id: string) =>
    setCart((c) => {
      const next = { ...c, [id]: (c[id] ?? 0) - 1 };
      if (next[id] <= 0) delete next[id];
      return next;
    });

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const items = Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }));
      const charge = await api<Charge>("/api/totem/orders", { method: "POST", body: { items }, timeoutMs: 20_000 });
      setScreen({ name: "payment", charge, startedAt: Date.now() });
    } catch (err) {
      const e = err instanceof ApiError ? err : null;
      if (e?.orderId) {
        // pedido criado mas o Pix falhou: cancela para não ficar pendurado
        void api(`/api/totem/orders/${e.orderId}/cancel`, { method: "POST" }).catch(() => {});
      }
      if (e?.code === "PRODUTO_INDISPONIVEL") void loadMenu();
      setError(e?.message ?? "Não foi possível gerar o Pix. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const retry = async (orderId: string) => {
    setBusy(true);
    setError(null);
    try {
      const charge = await api<Charge>(`/api/totem/orders/${orderId}/pix`, { method: "POST", timeoutMs: 20_000 });
      setScreen({ name: "payment", charge, startedAt: Date.now() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível gerar o Pix. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = (orderId: string, then: "cart" | "idle") => {
    void api(`/api/totem/orders/${orderId}/cancel`, { method: "POST" }).catch(() => {});
    if (then === "cart") {
      setScreen({ name: "cart" });
      setError(null);
    } else {
      reset();
    }
  };

  const simulate = async (txid: string) => {
    try {
      await api("/api/dev/simulate-payment", { method: "POST", body: { txid } });
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : "Falha ao simular");
    }
  };

  // ---------------------------------------------------------------- impressão
  const drainPrintQueue = useEffectEvent(async () => {
    while (!printBusy.current) {
      const next = printQueue.current.shift();
      if (!next) return;
      printBusy.current = true;
      try {
        await api(`/api/totem/print-jobs/${next.jobId}/claim`, { method: "POST" });
        setPrinting(next); // printBusy é liberado depois de imprimir
        return;
      } catch (err) {
        printBusy.current = false;
        // sem conexão: tenta de novo no próximo heartbeat; 409 = já impressa
        if (err instanceof ApiError && err.status === 0) handledJobs.current.delete(next.jobId);
      }
    }
  });

  const onTicketPrinted = useEffectEvent((ticket: TicketData) => {
    const showingThis = screen.name === "paid" && screen.ticketCode === ticket.ticketCode;
    if (!showingThis) setToast(`Ficha ${ticket.ticketCode} impressa. Retire abaixo.`);
  });

  useEffect(() => {
    if (!printing) return;
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;
      // com o Chrome em --kiosk-printing a impressão é silenciosa
      window.print();
      onTicketPrinted(printing);
      printBusy.current = false;
      setPrinting(null);
      void drainPrintQueue();
    })();
    return () => {
      cancelled = true;
    };
  }, [printing]);

  // ---------------------------------------------------------------- heartbeat
  const onHeartbeat = useEffectEvent((data: Heartbeat) => {
    // deploy novo: recarrega quando o totem está parado (sem cliente e sem ficha na fila)
    if (version.current === null) {
      version.current = data.version;
    } else if (
      data.version !== version.current &&
      screen.name === "idle" &&
      !printBusy.current &&
      printQueue.current.length === 0
    ) {
      window.location.reload();
      return;
    }

    setClockOffset(Date.parse(data.serverTime) - Date.now());
    setConnection("ready");
    setHb(data);

    if ((data.event?.id ?? null) !== eventId) {
      setMenu(null);
      if (data.event) void loadMenu();
      if (screen.name !== "payment" && screen.name !== "paid") reset();
    }

    for (const t of data.tickets) {
      if (!handledJobs.current.has(t.jobId)) {
        handledJobs.current.add(t.jobId);
        printQueue.current.push(t);
      }
    }
    void drainPrintQueue();
  });

  const onHeartbeatError = useEffectEvent((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      setConnection("unpaired");
      return;
    }
    if (err instanceof ApiError && err.code === "SUPABASE_NAO_CONFIGURADO") {
      setConnection("unconfigured");
      return;
    }
    failures.current += 1;
    if (failures.current >= 2) setOffline(true);
  });

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      clearTimeout(timer);
      try {
        const data = await api<Heartbeat>("/api/totem/heartbeat", { timeoutMs: 4_000 });
        failures.current = 0;
        setOffline(false);
        onHeartbeat(data);
      } catch (err) {
        onHeartbeatError(err);
      } finally {
        inFlight = false;
      }
      if (stopped) return;
      if (again) {
        again = false;
        void tick();
      } else {
        timer = setTimeout(tick, HEARTBEAT_MS);
      }
    };

    pulse.current = () => void tick();
    void tick();

    const goOffline = () => setOffline(true);
    const goOnline = () => void tick();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  // ---------------------------------------------------------------- status do Pix
  const onOrderStatus = useEffectEvent((view: OrderStatusView, orderId: string) => {
    if (view.status === "pago") {
      setScreen({ name: "paid", ticketCode: view.ticketCode ?? "", at: Date.now() });
      setCart({});
      pulse.current(); // busca a ficha para imprimir já
      return true;
    }
    if (view.status === "expirado") {
      setScreen({ name: "expired", orderId, amountCents: view.totalCents, at: Date.now() });
      return true;
    }
    if (view.status === "cancelado") {
      reset();
      return true;
    }
    return false;
  });

  const paymentOrderId = screen.name === "payment" ? screen.charge.orderId : null;
  useEffect(() => {
    if (!paymentOrderId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const view = await api<OrderStatusView>(`/api/totem/orders/${paymentOrderId}`, { timeoutMs: 6_000 });
        if (stopped || onOrderStatus(view, paymentOrderId)) return;
      } catch {
        // sem conexão: continua tentando; o webhook/cron confirmam no servidor
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, 1_500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [paymentOrderId]);

  // ---------------------------------------------------------------- relógio e tempos
  const ticking = screen.name === "payment" || screen.name === "paid" || screen.name === "expired" || askStillThere !== null;
  const onTimers = useEffectEvent(() => {
    if (screen.name === "paid" && Date.now() - screen.at > PAID_RETURN_MS) reset();
    if (screen.name === "expired" && Date.now() - screen.at > EXPIRED_RETURN_MS) cancelOrder(screen.orderId, "idle");
    if (askStillThere !== null && Date.now() > askStillThere) reset();
  });
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      setNow(Date.now());
      onTimers();
    }, 250);
    return () => clearInterval(id);
  }, [ticking]);

  // inatividade no cardápio/resumo
  const shopping = screen.name === "menu" || screen.name === "cart";
  useEffect(() => {
    if (!shopping) return;
    lastTouch.current = Date.now();
    const touch = () => {
      lastTouch.current = Date.now();
    };
    window.addEventListener("pointerdown", touch, { capture: true });
    const id = setInterval(() => {
      if (Date.now() - lastTouch.current > IDLE_ASK_MS) {
        setAskStillThere((current) => current ?? Date.now() + IDLE_ASK_SECONDS * 1000);
      }
    }, 1_000);
    return () => {
      window.removeEventListener("pointerdown", touch, { capture: true });
      clearInterval(id);
    };
  }, [shopping]);

  // aviso temporário
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6_000);
    return () => clearTimeout(id);
  }, [toast]);

  // ---------------------------------------------------------------- render
  const event = hb?.event ?? null;
  const theme = event?.theme ?? FALLBACK_THEME;
  const serverNow = now + clockOffset;

  let content: React.ReactNode;
  if (connection === "boot") {
    content = <FullMessage title="Iniciando totem…" spinner />;
  } else if (connection === "unpaired") {
    content = (
      <FullMessage
        title="Totem não pareado"
        text={
          pairingError
            ? "O link de pareamento é inválido ou foi substituído. Gere um novo no painel."
            : "No painel admin, abra Totens › Gerar link de pareamento e abra o link neste totem."
        }
      />
    );
  } else if (connection === "unconfigured") {
    content = <FullMessage title="Sistema não configurado" text="Configure o Supabase nas variáveis de ambiente." />;
  } else if (!event) {
    content = (
      <FullMessage
        title="Totem fechado"
        text={hb ? `O totem "${hb.totem.name}" não tem evento ativo no momento. Procure o caixa.` : undefined}
      />
    );
  } else if (screen.name === "idle") {
    content = <IdleScreen event={event} onStart={start} />;
  } else if (screen.name === "menu") {
    content = (
      <MenuScreen
        event={event}
        categories={menu}
        activeCategoryId={activeCategory}
        onSelectCategory={setActiveCategory}
        cart={cart}
        onAdd={add}
        onRemove={remove}
        onReview={() => setScreen({ name: "cart" })}
        onExit={reset}
      />
    );
  } else if (screen.name === "cart") {
    content = (
      <CartScreen
        categories={menu}
        cart={cart}
        onAdd={add}
        onRemove={remove}
        onBack={() => setScreen({ name: "menu" })}
        onClear={() => {
          setCart({});
          setScreen({ name: "menu" });
        }}
        onPay={pay}
        busy={busy}
        error={error}
      />
    );
  } else if (screen.name === "payment") {
    const expiresAt = Date.parse(screen.charge.expiresAt);
    const totalMs = expiresAt - (screen.startedAt + clockOffset);
    content = (
      <PaymentScreen
        charge={screen.charge}
        remainingMs={Math.min(totalMs, expiresAt - serverNow)}
        totalMs={totalMs}
        onCancel={() => cancelOrder(screen.charge.orderId, "cart")}
        mockPix={!!hb?.mockPix}
        onSimulate={() => simulate(screen.charge.txid)}
      />
    );
  } else if (screen.name === "paid") {
    content = (
      <PaidScreen
        ticketCode={screen.ticketCode}
        secondsLeft={Math.max(0, Math.ceil((PAID_RETURN_MS - Math.max(0, now - screen.at)) / 1000))}
        onDone={reset}
      />
    );
  } else {
    content = (
      <ExpiredScreen
        amountCents={screen.amountCents}
        onRetry={() => retry(screen.orderId)}
        onCancel={() => cancelOrder(screen.orderId, "idle")}
        busy={busy}
        error={error}
      />
    );
  }

  return (
    <>
      <div
        className="totem"
        data-preset={theme.preset}
        style={themeVars(theme)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {content}

        {askStillThere !== null && !offline && (
          <Overlay>
            <p className="t-title" style={{ fontSize: u(8) }}>
              Ainda está aí?
            </p>
            <p style={{ fontSize: u(3.6) }}>
              O pedido será cancelado em{" "}
              {Math.min(IDLE_ASK_SECONDS, Math.max(0, Math.ceil((askStillThere - now) / 1000)))}s.
            </p>
            <button type="button" className="t-btn" onClick={() => setAskStillThere(null)}>
              Continuar pedido
            </button>
            <button type="button" className="t-btn t-btn-ghost" onClick={reset}>
              Recomeçar
            </button>
          </Overlay>
        )}

        {offline && connection === "ready" && (
          <Overlay>
            <p className="t-title" style={{ fontSize: u(7.5) }}>
              Totem temporariamente fora do ar
            </p>
            <p style={{ fontSize: u(4) }}>Procure o caixa.</p>
            {screen.name === "payment" && (
              <p className="t-label" style={{ fontSize: u(3.4), maxWidth: u(80) }}>
                Se você já pagou, aguarde: sua ficha será impressa quando a conexão voltar.
              </p>
            )}
            <span className="flex items-center" style={{ gap: u(2), fontSize: u(3), opacity: 0.8 }}>
              <Spinner /> Reconectando…
            </span>
          </Overlay>
        )}

        <DemoBadge />

        {toast && (
          <div
            role="status"
            className="t-ribbon t-pop absolute left-1/2 z-[60] -translate-x-1/2"
            style={{ bottom: u(22), fontSize: u(3.6) }}
          >
            {toast}
          </div>
        )}
      </div>

      {printing && hb && <PrintTicket ticket={printing} paperWidthMm={hb.totem.paperWidthMm} />}
    </>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 z-[55] flex flex-col items-center justify-center text-center"
      style={{ gap: u(4), padding: u(8), background: "color-mix(in srgb, var(--t-bg) 88%, black)" }}
    >
      {children}
    </div>
  );
}

function FullMessage({ title, text, spinner }: { title: string; text?: string; spinner?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center" style={{ gap: u(4), padding: u(8) }}>
      <p className="t-title" style={{ fontSize: u(8) }}>
        {title}
      </p>
      {text && <p style={{ fontSize: u(3.8), maxWidth: u(80) }}>{text}</p>}
      {spinner && (
        <span style={{ fontSize: u(6) }}>
          <Spinner />
        </span>
      )}
      <p style={{ fontSize: u(2.6), opacity: 0.6 }}>PDVastro</p>
    </div>
  );
}
