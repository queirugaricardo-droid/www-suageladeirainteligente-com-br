// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import { chavePublica } from "./src/lib/deploy-config";

export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const anon = chavePublica(env["VITE_SUPABASE_ANON_KEY"]);
  return defineConfig({
  // Preserve generated clients; Nitro detects external hosts without SPA rewrites.
  vite: { define: {
    ...(anon ? { 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(anon) } : {}),
  } },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    pages: [{ path: "/oferta" }],
    prerender: { enabled: true, autoStaticPathsDiscovery: false },
  },
  });
};
