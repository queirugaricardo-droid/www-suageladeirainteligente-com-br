import assert from "node:assert/strict";
import { test } from "node:test";
import { comNovaTentativa503 } from "./gemini-retry";

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

test("nova tentativa Gemini limita a duas chamadas se continuar em 503", async () => {
  let chamadas = 0;
  const erro = Object.assign(new Error("UNAVAILABLE"), { status: 503 });

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
  assert.equal(chamadas, 2);
});
