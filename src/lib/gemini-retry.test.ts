import assert from "node:assert/strict";
import { test } from "node:test";
import { comFallbackModelos, comNovaTentativa503 } from "./gemini-retry";

test("nova tentativa Gemini repete após 503 e retorna quando a próxima chamada funciona", async () => {
  let chamadas = 0;
  const resultado = await comNovaTentativa503(
    async () => {
      chamadas += 1;
      if (chamadas === 1) throw Object.assign(new Error("UNAVAILABLE"), { status: 503 });
      return { itens: [{ nome: "Leite" }] };
    },
    async () => {},
  );

  assert.equal(chamadas, 2);
  assert.deepEqual(resultado, { itens: [{ nome: "Leite" }] });
});

test("nova tentativa Gemini não repete erros que não sejam 503", async () => {
  let chamadas = 0;
  const erro = Object.assign(new Error("INVALID_ARGUMENT"), { status: 400 });

  await assert.rejects(
    comNovaTentativa503(
      async () => {
        chamadas += 1;
        throw erro;
      },
      async () => {},
    ),
    (recebido) => recebido === erro,
  );
  assert.equal(chamadas, 1);
});

test("fallback Gemini tenta o próximo modelo quando o principal retorna 503", async () => {
  let chamadas = 0;
  const resultado = await comFallbackModelos(
    [
      async () => {
        chamadas += 1;
        throw Object.assign(new Error("UNAVAILABLE"), { status: 503 });
      },
      async () => {
        chamadas += 1;
        return { itens: [{ nome: "Leite" }] };
      },
    ],
    async () => {},
  );

  assert.equal(chamadas, 2);
  assert.deepEqual(resultado, { itens: [{ nome: "Leite" }] });
});

test("fallback Gemini tenta o próximo modelo quando o principal excede a cota (429)", async () => {
  let chamadas = 0;
  const resultado = await comFallbackModelos(
    [
      async () => {
        chamadas += 1;
        throw Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 });
      },
      async () => {
        chamadas += 1;
        return { itens: [{ nome: "Tomates" }] };
      },
    ],
    async () => {},
  );

  assert.equal(chamadas, 2);
  assert.deepEqual(resultado, { itens: [{ nome: "Tomates" }] });
});

test("fallback Gemini não troca de modelo para erros diferentes de 429 e 503", async () => {
  let chamadasFallback = 0;
  const erro = Object.assign(new Error("INVALID_ARGUMENT"), { status: 400 });

  await assert.rejects(
    comFallbackModelos(
      [
        async () => {
          throw erro;
        },
        async () => {
          chamadasFallback += 1;
          return "não deveria executar";
        },
      ],
      async () => {},
    ),
    (recebido) => recebido === erro,
  );

  assert.equal(chamadasFallback, 0);
});

test("fallback Gemini percorre os modelos disponíveis quando todos retornam 429 ou 503", async () => {
  let chamadas = 0;
  const erroCota = Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 });
  const erroIndisponivel = Object.assign(new Error("UNAVAILABLE"), { status: 503 });

  await assert.rejects(
    comFallbackModelos(
      [
        async () => {
          chamadas += 1;
          throw erroCota;
        },
        async () => {
          chamadas += 1;
          throw erroIndisponivel;
        },
        async () => {
          chamadas += 1;
          throw erroCota;
        },
      ],
      async () => {},
    ),
    (recebido) => recebido === erroCota,
  );

  assert.equal(chamadas, 3);
});

test("fallback Gemini não executa nenhum modelo se a lista estiver vazia", async () => {
  await assert.rejects(
    comFallbackModelos([], async () => {}),
    /Nenhum modelo Gemini foi configurado/,
  );
});
