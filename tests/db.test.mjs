// Testa as migrações e as funções SQL num Postgres embutido (PGlite), sem Supabase.
// Rodar: npm test
import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, test } from "node:test";

const sqlFile = (path) => readFileSync(new URL(`../supabase/${path}`, import.meta.url), "utf8");

const db = new PGlite();
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const val = async (sql, params) => Object.values(await one(sql, params))[0];
const rejects = (sql, params, code) => assert.rejects(db.query(sql, params), (e) => String(e.message).includes(code));
const items = (list) => JSON.stringify(list.map(([p, q]) => ({ product_id: p.id ?? p, quantity: q })));
const txid = (tag) => `tx${tag}`.padEnd(32, "x");

let pagode, under, totem, prods, underProd;

/** cria pedido + cobrança e devolve { orderId, total } */
async function orderWithPix(t, list, tag) {
  const r = (await one("select create_order($1, $2::jsonb) as r", [t, items(list)])).r;
  await db.query("select start_payment($1, $2, 'mock', $3)", [r.order_id, t, txid(tag)]);
  return { orderId: r.order_id, total: r.total_cents };
}
const confirm = async (tag, cents) => (await one("select confirm_payment($1, $2, 'E2E', '{}') as r", [txid(tag), cents])).r;
const status = (orderId) => val("select status from orders where id = $1", [orderId]);

before(async () => {
  // o que o Supabase já traz pronto
  await db.exec(`
    create schema auth; create table auth.users (id uuid primary key);
    create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
    create role anon; create role authenticated; create role service_role;
  `);
  await db.exec(sqlFile("migrations/0001_schema.sql"));
  await db.exec(sqlFile("migrations/0002_functions.sql"));
  await db.exec(sqlFile("migrations/0003_promos.sql"));
  await db.exec(sqlFile("migrations/0003_promos.sql")); // idempotente
  await db.exec(sqlFile("seed.sql"));
  await db.exec(sqlFile("seed.sql")); // idempotente

  pagode = await val("select id from events where slug = 'pagode-do-ze'");
  under = await val("select id from events where slug = 'submundo-do-funk'");
  totem = await val("insert into totems (name, event_id, token_hash) values ('T1', $1, 'h') returning id", [pagode]);
  prods = (await db.query("select id, price_cents from products where event_id = $1 order by price_cents", [pagode])).rows;
  underProd = await val("select id from products where event_id = $1 limit 1", [under]);
});

test("seed roda duas vezes sem duplicar e cria o bucket", async () => {
  assert.equal(await val("select count(*)::int from events"), 2);
  assert.equal(await val("select count(*)::int from storage.buckets where id = 'assets'"), 1);
  assert.equal(await val("select count(*)::int from products p join events e on e.id = p.event_id where e.slug = 'pagode-do-ze'"), 16);
  assert.equal(await val("select count(*)::int from products p join events e on e.id = p.event_id where e.slug = 'submundo-do-funk'"), 9);
});

test("promoções: destaque, preço 'de' e só o Pagode tem comidas", async () => {
  const promo = await one("select featured, subtitle from categories where event_id = $1 and name = 'Promoções do dia'", [pagode]);
  assert.equal(promo.featured, true);
  assert.equal(promo.subtitle, "Válidas até as 22h");
  assert.equal(await val("select compare_at_cents from products where event_id = $1 and name = 'Balde de Original'", [pagode]), 6000);
  assert.equal(await val("select count(*)::int from categories where event_id = $1 and name = 'Comidas'", [pagode]), 1);
  assert.equal(await val("select count(*)::int from categories where event_id = $1 and name = 'Comidas'", [under]), 0);
  // preço "de" precisa ser maior que o preço cobrado
  await rejects("update products set compare_at_cents = price_cents where event_id = $1", [pagode], "products_compare_at_gt_price");
});

test("dia operacional vira às 06:00", async () => {
  assert.equal(await val("select business_date_at('2026-10-11 03:00-04')::text"), "2026-10-10");
  assert.equal(await val("select business_date_at('2026-10-11 07:00-04')::text"), "2026-10-11");
});

test("fluxo feliz: total no banco, senha A-001, idempotência e ficha única", async () => {
  const r = (await one("select create_order($1, $2::jsonb) as r", [totem, items([[prods[0], 2], [prods[1], 1], [prods[0], 1]])])).r;
  assert.equal(r.total_cents, prods[0].price_cents * 3 + prods[1].price_cents);
  assert.equal(await val("select count(*)::int from order_items where order_id = $1", [r.order_id]), 2);

  const p = (await one("select start_payment($1, $2, 'mock', $3) as r", [r.order_id, totem, txid("1a")])).r;
  assert.equal(p.amount_cents, r.total_cents);
  assert.equal(p.event_name, "Pagode do Zé");
  await rejects("select start_payment($1, $2, 'mock', $3)", [r.order_id, totem, txid("1b")], "PIX_JA_ATIVO");

  assert.equal(await val("select try_lock_payment_check($1, 2500)", [p.payment_id]), true);
  assert.equal(await val("select try_lock_payment_check($1, 2500)", [p.payment_id]), false);

  const c = await confirm("1a", r.total_cents);
  assert.equal(c.result, "pago");
  assert.equal(c.ticket_code, "A-001");
  const again = await confirm("1a", r.total_cents);
  assert.equal(again.result, "ja_processado");
  assert.equal(await val("select count(*)::int from print_jobs where order_id = $1", [r.order_id]), 1);

  const job = await val("select id from print_jobs where order_id = $1", [r.order_id]);
  assert.equal(await val("select claim_print_job($1, $2)", [job, totem]), true);
  assert.equal(await val("select claim_print_job($1, $2)", [job, totem]), false);
  assert.equal(await val("select print_count from orders where id = $1", [r.order_id]), 1);
});

test("expira, tenta de novo, valor divergente e Pix antigo pago no último segundo", async () => {
  const { orderId, total } = await orderWithPix(totem, [[prods[2], 1]], "2a");
  await db.query("update payments set expires_at = now() - interval '1 minute' where txid = $1", [txid("2a")]);
  await db.query("select expire_payment($1)", [txid("2a")]);
  assert.equal(await status(orderId), "expirado");

  await db.query("select start_payment($1, $2, 'mock', $3)", [orderId, totem, txid("2b")]);
  assert.equal(await status(orderId), "aguardando_pagamento");
  assert.equal((await confirm("2b", 1)).result, "divergente");
  assert.equal(await status(orderId), "aguardando_pagamento");

  const late = await confirm("2a", total);
  assert.equal(late.result, "pago");
  assert.equal(late.ticket_code, "A-002");
});

test("cancelado no totem, mas o Pix caiu: vale e outro totem não cancela", async () => {
  const { orderId, total } = await orderWithPix(totem, [[prods[0], 1]], "3a");
  const other = await val("insert into totems (name, event_id) values ('T2', $1) returning id", [pagode]);
  assert.equal((await one("select cancel_order($1, $2) as r", [orderId, other])).r.cancelled, false);

  const cancel = (await one("select cancel_order($1, $2) as r", [orderId, totem])).r;
  assert.equal(cancel.cancelled, true);
  assert.deepEqual(cancel.txids, [txid("3a")]);
  assert.equal((await confirm("3a", total)).result, "pago");
});

test("dois Pix pagos para o mesmo pedido: o segundo fica duplicado", async () => {
  const { orderId, total } = await orderWithPix(totem, [[prods[0], 1]], "4a");
  await db.query("update payments set expires_at = now() - interval '1 minute' where txid = $1", [txid("4a")]);
  await db.query("select start_payment($1, $2, 'mock', $3)", [orderId, totem, txid("4b")]);
  assert.equal((await confirm("4b", total)).result, "pago");
  assert.equal((await confirm("4a", total)).result, "duplicado");
});

test("create_order recusa carrinho inválido", async () => {
  const q = "select create_order($1, $2::jsonb)";
  await rejects(q, [totem, items([[underProd, 1]])], "PRODUTO_INDISPONIVEL");
  await db.query("update products set active = false where id = $1", [prods[1].id]);
  await rejects(q, [totem, items([[prods[1], 1]])], "PRODUTO_INDISPONIVEL");
  await db.query("update products set active = true where id = $1", [prods[1].id]);
  await db.query("update categories set active = false where id = (select category_id from products where id = $1)", [prods[1].id]);
  await rejects(q, [totem, items([[prods[1], 1]])], "PRODUTO_INDISPONIVEL");
  await db.query("update categories set active = true");
  await rejects(q, [totem, items([[prods[0], 0]])], "QUANTIDADE_INVALIDA");
  await rejects(q, [totem, "[]"], "CARRINHO_VAZIO");
  await rejects(q, [totem, items([[prods[0], 60], [prods[0], 60]])], "QUANTIDADE_INVALIDA");
  const noEvent = await val("insert into totems (name) values ('T3') returning id");
  await rejects(q, [noEvent, items([[prods[0], 1]])], "TOTEM_SEM_EVENTO");
});

test("senha com 4 dígitos não é cortada (U-1000)", async () => {
  const t = await val("insert into totems (name, event_id) values ('TU', $1) returning id", [under]);
  const { total } = await orderWithPix(t, [[underProd, 1]], "Ua");
  await db.query(
    "update ticket_counters set last_number = 999 where event_id = $1 and business_date = business_date_at(now())",
    [under],
  );
  await db.query(
    "insert into ticket_counters (event_id, business_date, last_number) values ($1, business_date_at(now()), 999) on conflict do nothing",
    [under],
  );
  assert.equal((await confirm("Ua", total)).ticket_code, "U-1000");
});

test("relatório do dia e conciliação", async () => {
  const r = (await one("select sales_report($1, business_date_at(now())) as r", [pagode])).r;
  assert.equal(r.orders_paid, 4);
  assert.deepEqual(r.pix_problems.map((p) => p.status).sort(), ["divergente", "duplicado"]);
  assert.equal(r.not_printed, 3);
  assert.ok(r.by_product.length > 0 && r.by_hour.length > 0);
  assert.equal(r.pix_received_cents, r.total_cents);
  assert.ok(Array.isArray((await db.query("select * from payments_to_reconcile()")).rows));
  assert.equal(await val("select close_stale_orders()"), 0);
});

test("copiar cardápio e integridade de categoria por evento", async () => {
  const to = await val("insert into events (slug, name) values ('copia', 'Cópia') returning id");
  const products = await val("select count(*)::int from products where event_id = $1", [pagode]);
  const categories = await val("select count(*)::int from categories where event_id = $1", [pagode]);
  assert.equal(await val("select copy_menu($1, $2)", [pagode, to]), products);
  assert.equal(await val("select count(*)::int from categories where event_id = $1", [to]), categories);
  assert.equal(await val("select count(*)::int from categories where event_id = $1 and featured", [to]), 1);
  assert.equal(await val("select count(*)::int from products where event_id = $1 and compare_at_cents is not null", [to]), 3);
  await rejects("select copy_menu($1, $1)", [pagode], "MESMO_EVENTO");

  const underCat = await val("select id from categories where event_id = $1 limit 1", [under]);
  await rejects(
    "insert into products (event_id, category_id, name, price_cents) values ($1, $2, 'x', 100)",
    [pagode, underCat],
    "foreign key",
  );
});
