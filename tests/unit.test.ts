// Testes das funções puras. Rodar: npm test (Node 24 executa .ts direto).
import assert from "node:assert/strict";
import { test } from "node:test";
import { businessDate, formatIsoDate, isIsoDate } from "../lib/business-day.ts";
import { errorCode, friendlyError } from "../lib/errors.ts";
import { slugify } from "../lib/forms.ts";
import { centsToDecimal, centsToInput, decimalToCents, formatBRL, parseBRLInput } from "../lib/money.ts";
import { txidsFromBacenWebhook } from "../lib/pix/types.ts";
import { PRESETS, resolveTheme, themeVars } from "../lib/themes.ts";

test("centavos <-> decimal da API Pix (sem float)", () => {
  assert.equal(centsToDecimal(1250), "12.50");
  assert.equal(centsToDecimal(5), "0.05");
  assert.equal(centsToDecimal(100), "1.00");
  assert.equal(decimalToCents("12.50"), 1250);
  assert.equal(decimalToCents("12.5"), 1250);
  assert.equal(decimalToCents("12"), 1200);
  assert.equal(decimalToCents("0.01"), 1);
  assert.throws(() => decimalToCents("12.345"));
  assert.throws(() => decimalToCents("-1.00"));
  assert.throws(() => centsToDecimal(1.5));
  // ida e volta em todos os centavos até R$ 100
  for (let c = 0; c <= 10_000; c++) assert.equal(decimalToCents(centsToDecimal(c)), c);
});

test("entrada de preço do admin", () => {
  assert.equal(parseBRLInput("12,50"), 1250);
  assert.equal(parseBRLInput("R$ 12,50"), 1250);
  assert.equal(parseBRLInput("1.250,00"), 125000);
  assert.equal(parseBRLInput("12.50"), 1250);
  assert.equal(parseBRLInput("abc"), null);
  assert.equal(parseBRLInput(""), null);
  assert.equal(centsToInput(1250), "12,50");
  assert.equal(formatBRL(1250).replace(/\s/g, " "), "R$ 12,50");
});

test("dia operacional vira às 06:00 de Porto Velho", () => {
  assert.equal(businessDate(new Date("2026-10-11T03:00:00-04:00")), "2026-10-10");
  assert.equal(businessDate(new Date("2026-10-11T05:59:00-04:00")), "2026-10-10");
  assert.equal(businessDate(new Date("2026-10-11T06:00:00-04:00")), "2026-10-11");
  assert.equal(businessDate(new Date("2026-10-10T23:30:00-04:00")), "2026-10-10");
  assert.ok(isIsoDate("2026-10-10"));
  assert.ok(!isIsoDate("10/10/2026"));
  assert.equal(formatIsoDate("2026-10-10"), "10/10/2026");
});

test("webhook Bacen: só extrai txids válidos, sem repetir", () => {
  const txid = "a".repeat(32);
  assert.deepEqual(txidsFromBacenWebhook({ pix: [{ txid }, { txid }, { txid: "curto" }, {}, null] }), [txid]);
  assert.deepEqual(txidsFromBacenWebhook(null), []);
  assert.deepEqual(txidsFromBacenWebhook({ pix: "x" }), []);
  assert.deepEqual(txidsFromBacenWebhook({ pix: [{ txid: "a".repeat(26) + "!" }] }), []);
});

test("temas: preset, cores inválidas ignoradas e CSS variables", () => {
  const t = resolveTheme({ preset: "underground", colors: { primary: "#123456", bg: "vermelho" as string } });
  assert.equal(t.preset, "underground");
  assert.equal(t.colors.primary, "#123456");
  assert.equal(t.colors.bg, PRESETS.underground.colors.bg);
  assert.equal(resolveTheme(null).preset, "pagode");
  assert.equal(resolveTheme({ preset: "outro" as "pagode" }).preset, "pagode");
  const vars = themeVars(resolveTheme({ preset: "pagode", backgroundUrl: "https://x/y.webp" }));
  assert.equal(vars["--t-primary"], PRESETS.pagode.colors.primary);
  assert.equal(vars["--t-bg-image"], 'url("https://x/y.webp")');
});

test("slug e mensagens de erro do banco", () => {
  assert.equal(slugify("Pagode do Zé — Sábado!"), "pagode-do-ze-sabado");
  assert.equal(slugify("  Submundo   do Funk "), "submundo-do-funk");
  assert.equal(errorCode(new Error('create_order: PRODUTO_INDISPONIVEL')), "PRODUTO_INDISPONIVEL");
  assert.equal(errorCode(new Error("outra coisa")), null);
  assert.match(friendlyError(new Error("PIX_JA_ATIVO")), /Pix ativo/);
});
