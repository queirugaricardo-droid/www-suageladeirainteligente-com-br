import { test } from "node:test";
import assert from "node:assert/strict";
import { erroGemini } from "./gemini.server";

test("chave sem acesso vira mensagem clara sem expor detalhes", () => {
  assert.match(erroGemini(new Error("API key not valid. 403 PERMISSION_DENIED")).message, /chave Gemini/);
  assert.match(erroGemini(new Error("Request failed with status 401")).message, /chave Gemini/);
});

test("limite de uso vira mensagem de cota", () => {
  assert.match(erroGemini(new Error("429 RESOURCE_EXHAUSTED: quota exceeded")).message, /limite de uso/);
});

test("bloqueio de segurança vira mensagem específica", () => {
  assert.match(erroGemini(new Error("SAFETY blockReason")).message, /restrição de segurança/);
});

test("erros desconhecidos são preservados", () => {
  assert.equal(erroGemini(new Error("falha de rede")).message, "falha de rede");
});
