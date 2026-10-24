import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function useSignOut() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await client.cancelQueries();
    client.clear();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await navigate({ to: "/auth", replace: true });
  };
}