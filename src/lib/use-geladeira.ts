import { useCallback, useEffect, useState } from "react";
import { ESTOQUE_EXEMPLO } from "./fridge-logic";
import type { ItemIdeal, Relatorio } from "./fridge-types";

const CHAVE_ESTOQUE = "geladeira:estoque";
const CHAVE_RELATORIO = "geladeira:relatorio";

function ler<T>(chave: string, padrao: T): T {
  if (typeof window === "undefined") return padrao;
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

export function useGeladeira() {
  const [pronto, setPronto] = useState(false);
  const [estoque, setEstoque] = useState<ItemIdeal[]>(ESTOQUE_EXEMPLO);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);

  useEffect(() => {
    setEstoque(ler<ItemIdeal[]>(CHAVE_ESTOQUE, ESTOQUE_EXEMPLO));
    setRelatorio(ler<Relatorio | null>(CHAVE_RELATORIO, null));
    setPronto(true);
  }, []);

  useEffect(() => {
    if (pronto) window.localStorage.setItem(CHAVE_ESTOQUE, JSON.stringify(estoque));
  }, [estoque, pronto]);

  useEffect(() => {
    if (!pronto) return;
    if (relatorio) window.localStorage.setItem(CHAVE_RELATORIO, JSON.stringify(relatorio));
    else window.localStorage.removeItem(CHAVE_RELATORIO);
  }, [relatorio, pronto]);

  const adicionar = useCallback((item: Omit<ItemIdeal, "id">) => {
    setEstoque((atual) => [...atual, { ...item, id: crypto.randomUUID() }]);
  }, []);

  const atualizar = useCallback((id: string, mudancas: Partial<ItemIdeal>) => {
    setEstoque((atual) => atual.map((i) => (i.id === id ? { ...i, ...mudancas } : i)));
  }, []);

  const remover = useCallback((id: string) => {
    setEstoque((atual) => atual.filter((i) => i.id !== id));
  }, []);

  return { pronto, estoque, relatorio, setRelatorio, adicionar, atualizar, remover };
}
