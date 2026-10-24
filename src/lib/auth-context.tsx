import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Sessao = { usuario: User | null; pronto: boolean };
const Context = createContext<Sessao>({ usuario: null, pronto: false });
export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao>({ usuario: null, pronto: false });
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    if (window.location.pathname === "/reset-password" && new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery") sessionStorage.setItem("geladeira:recovery", "true");
    let ativo = true;
    let versao = 0;
    const { data } = supabase.auth.onAuthStateChange((evento, session) => {
      versao++;
      if (!ativo) return;
      setSessao({ usuario: session?.user ?? null, pronto: true });
      if (evento === "PASSWORD_RECOVERY") sessionStorage.setItem("geladeira:recovery", "true");
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(evento)) return;
      // Never await auth work inside this synchronous provider callback.
      queueMicrotask(() => {
        if (!ativo) return;
        if (evento === "SIGNED_OUT") { void queryClient.cancelQueries(); queryClient.clear(); }
        else void queryClient.invalidateQueries();
        void router.invalidate();
      });
    });
    const inicial = versao;
    supabase.auth.getUser().then(({ data }) => {
      if (ativo && inicial === versao) setSessao({ usuario: data.user ?? null, pronto: true });
    }).catch(() => { if (ativo && inicial === versao) setSessao({ usuario: null, pronto: true }); });
    return () => { ativo = false; data.subscription.unsubscribe(); };
  }, [queryClient, router]);
  return <Context.Provider value={sessao}>{children}</Context.Provider>;
}
export function useSessaoContext() { return useContext(Context); }