import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { limiteFotos } from "./plano";

describe("plano", () => {
  test("cada conta mantém 2 fotos por mês sem depender de cobrança", () => assert.equal(limiteFotos(), 2));
});
