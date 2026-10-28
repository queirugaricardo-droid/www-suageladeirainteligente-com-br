import { test } from "node:test";
import assert from "node:assert/strict";
import { chavePublica, provedorFoto } from "./deploy-config";
import { imagemInline, textoGemini } from "./gemini-response";

test("sem GEMINI_API_KEY mantém Lovable", () => assert.equal(provedorFoto(undefined), "lovable"));
test("GEMINI_API_KEY seleciona Gemini direto", () => assert.equal(provedorFoto("test-key"), "gemini"));
test("chave vazia não desliga Gateway", () => assert.equal(provedorFoto("  "), "lovable"));
test("ANON_KEY externa tem prioridade sobre valor atual", () => assert.equal(chavePublica("external", "current"), "external"));
test("sem ANON_KEY preserva publishable atual", () => assert.equal(chavePublica(undefined, "current"), "current"));
test("Gemini usa bytes da foto e ignora raciocínio", () => {
  assert.deepEqual(imagemInline("data:image/jpeg;base64,YWJj"), { inlineData: { mimeType: "image/jpeg", data: "YWJj" } });
  assert.equal(textoGemini({ candidates: [{ content: { parts: [{ text: "secret thought", thought: true }, { text: '{"itens":[]}' }] }, finishReason: "STOP" }] }), '{"itens":[]}');
});
test("recusa ou resposta truncada não é uma análise válida", () => {
  assert.throws(() => textoGemini({ promptFeedback: { blockReason: "SAFETY" } }));
  assert.throws(() => textoGemini({ candidates: [{ finishReason: "MAX_TOKENS" }] }));
});