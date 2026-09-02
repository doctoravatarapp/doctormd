import assert from "node:assert/strict";
import test from "node:test";
import { matchRedFlagRules, matchesRedFlagConfiguration, normalizeClinicalText, parseConfirmationAnswer, patientMessageForRedFlag, redFlagConfirmationPrompt } from "../lib/red-flags/detector.ts";

test("normaliza acentos e pontuação em português", () => {
  assert.equal(normalizeClinicalText("  Não faço Xixi há 8 horas! "), "nao faco xixi ha 8 horas");
});

test("aceita regra legada contains sem quebrar regras adicionais", () => {
  assert.equal(matchesRedFlagConfiguration("Estou com DOR FORTE", { match_type: "contains", pattern: "dor forte" }), true);
});

test("corresponde paráfrase por grupos de alternativas", () => {
  assert.equal(matchesRedFlagConfiguration("Minha barriga está muito inchada, dolorida e estou vomitando", {
    matcher: { groups: [["barriga inchada", "muito inchada"], ["dor", "dolorida"], ["vômito", "vomitando"]] },
  }), true);
});

test("não dispara orientação domiciliar quando há termo de exclusão", () => {
  assert.equal(matchesRedFlagConfiguration("A dor leve está piorando e ficou muito forte", {
    matcher: { phrases: ["dor leve"], exclude: ["piorando", "muito forte"] },
  }), false);
});

test("prioriza emergência sobre orientação domiciliar", () => {
  const matched = matchRedFlagRules("Estou com dor leve, mas comecei a vomitar tudo que bebo", [
    { id: "home", name: "Dor controlada", severity: "low", configuration: { priority: "home_guidance", matcher: { phrases: ["dor leve"] }, recommended_action: "Observar" } },
    { id: "urgent", name: "Vômitos persistentes", severity: "critical", configuration: { priority: "immediate_emergency", matcher: { phrases: ["vomitar tudo que bebo"] }, recommended_action: "Levar ao pronto-socorro imediatamente" } },
  ]);
  assert.deepEqual(matched.map((rule) => rule.id), ["urgent", "home"]);
  assert.equal(patientMessageForRedFlag(matched[0]), "Levar ao pronto-socorro imediatamente");
  assert.match(redFlagConfirmationPrompt(matched[0]), /Vômitos persistentes/);
});

test("interpreta somente respostas inequívocas na confirmação", () => {
  assert.equal(parseConfirmationAnswer("Sim"), "confirmed");
  assert.equal(parseConfirmationAnswer("não"), "rejected");
  assert.equal(parseConfirmationAnswer("acho que talvez"), null);
});
