export function authHead(titulo: string, descricao: string) {
  return { meta: [{ title: `${titulo} — Geladeira Inteligente` }, { name: "description", content: descricao }, { property: "og:title", content: `${titulo} — Geladeira Inteligente` }, { property: "og:description", content: descricao }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] };
}