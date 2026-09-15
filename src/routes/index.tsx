import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Refrigerator } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { EstoqueTab } from "@/components/geladeira/estoque-tab";
import { AnaliseTab } from "@/components/geladeira/analise-tab";
import { RelatorioTab } from "@/components/geladeira/relatorio-tab";
import { useGeladeira } from "@/lib/use-geladeira";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Geladeira Inteligente | Lista de compras por foto" },
      {
        name: "description",
        content:
          "Fotografe sua geladeira, veja o que está faltando em relação ao seu estoque ideal e monte a lista de compras com preços estimados perto de você.",
      },
      { property: "og:title", content: "Geladeira Inteligente" },
      {
        property: "og:description",
        content:
          "A IA analisa a foto da sua geladeira, mostra o percentual de abastecimento e monta a lista de compras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { estoque, relatorio, setRelatorio, adicionar, atualizar, remover } = useGeladeira();
  const [aba, setAba] = useState("estoque");

  return (
    <main className="min-h-screen bg-background">
      <Toaster position="top-center" />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-6">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15">
            <Refrigerator className="size-6 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">Geladeira Inteligente</h1>
            <p className="text-sm text-muted-foreground">
              Uma foto vira relatório de estoque e lista de compras.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="mb-6 grid w-full grid-cols-3">
            <TabsTrigger value="estoque">Estoque ideal</TabsTrigger>
            <TabsTrigger value="analise">Analisar</TabsTrigger>
            <TabsTrigger value="relatorio">Relatório</TabsTrigger>
          </TabsList>

          <TabsContent value="estoque">
            <EstoqueTab
              estoque={estoque}
              adicionar={adicionar}
              atualizar={atualizar}
              remover={remover}
            />
          </TabsContent>

          <TabsContent value="analise">
            <AnaliseTab
              estoque={estoque}
              aoConcluir={(r) => {
                setRelatorio(r);
                setAba("relatorio");
              }}
            />
          </TabsContent>

          <TabsContent value="relatorio">
            <RelatorioTab
              relatorio={relatorio}
              adicionar={adicionar}
              irParaAnalise={() => setAba("analise")}
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
