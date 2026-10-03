import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSessao() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setUsuario(sessao?.user ?? null);
      setPronto(true);
    });
    supabase.auth.getUser().then(({ data: d }) => {
      setUsuario(d.user ?? null);
      setPronto(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { usuario, pronto };
}
