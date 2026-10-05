import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  History,
  Menu,
  Refrigerator,
  ScanLine,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { EstoqueTab } from "@/components/geladeira/estoque-tab";
import { AnaliseTab, type AnaliseTabHandle } from "@/components/geladeira/analise-tab";
import { RelatorioTab } from "@/components/geladeira/relatorio-tab";
import { RevisaoTab } from "@/components/geladeira/revisao-tab";
import { useGeladeira } from "@/lib/use-geladeira";
import { gerarRelatorio } from "@/lib/fridge-logic";
import type { ItemDetectado } from "@/lib/fridge-types";
import fridgeHero from "@/assets/fridge-hero.jpg";

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
  const [aba, setAba] = useState("inicio");
  const [menuAberto, setMenuAberto] = useState(false);
  const [rascunho, setRascunho] = useState<ItemDetectado[] | null>(null);
  const analiseRef = useRef<AnaliseTabHandle>(null);

  const fotografar = () => {
    setAba("analise");
    setMenuAberto(false);
    window.setTimeout(() => analiseRef.current?.abrirCamera(), 0);
  };

  const verExemplo = () => {
    const exemplo: ItemDetectado[] = [
      { nome: "Leite", quantidade: 0.7, unidade: "L", confianca: 0.98, emoji: "🥛" },
      { nome: "Ovos", quantidade: 6, unidade: "un", confianca: 0.97, emoji: "🥚" },
      { nome: "Tomate", quantidade: 4, unidade: "un", confianca: 0.95, emoji: "🍅" },
      { nome: "Alface", quantidade: 1, unidade: "un", confianca: 0.94, emoji: "🥬" },
      { nome: "Queijo mussarela", quantidade: 180, unidade: "g", confianca: 0.93, emoji: "🧀" },
      { nome: "Iogurte natural", quantidade: 2, unidade: "un", confianca: 0.91, emoji: "🥣" },
    ];
    setRascunho(exemplo);
    setAba("revisao");
    setMenuAberto(false);
  };

  const confirmarRevisao = (itens: ItemDetectado[]) => {
    setRelatorio(gerarRelatorio(estoque, itens));
    setRascunho(null);
    setAba("relatorio");
  };

  const navegar = (destino: string) => {
    setAba(destino);
    setMenuAberto(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <Toaster position="top-center" />
      <header className="relative z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button className="flex items-center gap-3" onClick={() => navegar("inicio")} aria-label="Ir para o início">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Refrigerator className="size-5" />
            </span>
            <span className="text-left text-lg font-extrabold text-foreground">
              Geladeira <span className="text-primary">Inteligente</span>
            </span>
          </button>

          <nav className="hidden items-center gap-2 md:flex" aria-label="Navegação principal">
            <Button variant={aba === "inicio" ? "secondary" : "ghost"} onClick={() => navegar("inicio")}>Início</Button>
            <Button variant={aba === "estoque" ? "secondary" : "ghost"} onClick={() => navegar("estoque")}>
              <Refrigerator /> Estoque ideal
            </Button>
            <Button variant={aba === "relatorio" ? "secondary" : "ghost"} onClick={() => navegar("relatorio")}>
              <History /> Último relatório
            </Button>
            <Button onClick={fotografar}><Camera /> Analisar agora</Button>
          </nav>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuAberto((v) => !v)} aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}>
            {menuAberto ? <X /> : <Menu />}
          </Button>
        </div>
        {menuAberto && (
          <nav className="grid gap-2 border-t border-border bg-background/95 p-4 backdrop-blur-xl md:hidden">
            <Button variant="ghost" className="justify-start" onClick={() => navegar("inicio")}>Início</Button>
            <Button variant="ghost" className="justify-start" onClick={() => navegar("estoque")}><Refrigerator /> Estoque ideal</Button>
            <Button variant="ghost" className="justify-start" onClick={() => navegar("relatorio")}><History /> Último relatório</Button>
            <Button className="justify-start" onClick={fotografar}><Camera /> Tirar foto da geladeira</Button>
          </nav>
        )}
      </header>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsContent value="inicio" className="mt-0">
          <section className="relative border-b border-border/70">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,var(--accent),transparent_42%)] opacity-60" />
            <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
              <div className="max-w-xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/60 px-3 py-1.5 text-sm font-bold text-primary shadow-sm backdrop-blur-xl">
                  <Sparkles className="size-4" /> Visão inteligente para sua cozinha
                </div>
                <h1 className="font-display text-4xl font-extrabold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl">
                  Sua geladeira sob controle em um clique.
                </h1>
                <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                  Fotografe, descubra o que está faltando e receba sua lista de compras com preços estimados — sem conferir prateleira por prateleira.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" className="h-14 px-6 text-base shadow-xl shadow-primary/20" onClick={fotografar}>
                    <Camera className="size-5" /> Tirar foto da geladeira
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 bg-card/60 px-6 text-base backdrop-blur-xl" onClick={verExemplo}>
                    Ver exemplo prático <ArrowRight />
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /> Resultado em segundos</span>
                  <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /> Lista pronta para comprar</span>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:ml-auto">
                <div className="absolute -inset-5 rounded-[2rem] bg-primary/10 blur-3xl" />
                <div className="relative overflow-hidden rounded-3xl border border-card/80 bg-card/45 p-3 shadow-2xl backdrop-blur-2xl">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
                    <img src={fridgeHero} alt="Geladeira aberta com alimentos sendo reconhecidos" width={1200} height={1500} className="size-full object-cover" />
                    <div className="absolute inset-x-0 top-0 h-px animate-scan bg-primary shadow-[0_0_18px_var(--primary)]" />
                    <div className="absolute left-[14%] top-[20%] rounded-lg border border-card/70 bg-card/75 px-3 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur-xl">
                      <span className="mr-2 inline-block size-2 rounded-full bg-primary" />Leite · 700 ml
                    </div>
                    <div className="absolute right-[9%] top-[43%] rounded-lg border border-card/70 bg-card/75 px-3 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur-xl">
                      <span className="mr-2 inline-block size-2 rounded-full bg-chart-4" />Ovos · 6 un
                    </div>
                    <div className="absolute bottom-[20%] left-[12%] rounded-lg border border-card/70 bg-card/75 px-3 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur-xl">
                      <span className="mr-2 inline-block size-2 rounded-full bg-primary" />Hortaliças
                    </div>
                  </div>
                  <div className="absolute inset-x-8 bottom-8 grid grid-cols-3 divide-x divide-border rounded-2xl border border-card/70 bg-card/75 p-4 shadow-xl backdrop-blur-2xl">
                    <div className="text-center"><p className="text-xl font-extrabold">12</p><p className="text-xs text-muted-foreground">itens vistos</p></div>
                    <div className="text-center"><p className="text-xl font-extrabold text-primary">70%</p><p className="text-xs text-muted-foreground">abastecida</p></div>
                    <div className="text-center"><p className="text-xl font-extrabold">5</p><p className="text-xs text-muted-foreground">para comprar</p></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="border-b border-border bg-card/35 py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <p className="text-sm font-extrabold uppercase text-primary">Como funciona</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold sm:text-4xl">Da foto à lista de compras em três passos.</h2>
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {[
                  { numero: "01", titulo: "Fotografe", texto: "Tire uma foto da sua geladeira aberta.", Icone: Camera },
                  { numero: "02", titulo: "A IA analisa", texto: "A visão inteligente identifica o que você tem e o que está faltando.", Icone: Bot },
                  { numero: "03", titulo: "Lista pronta", texto: "Receba a lista automática, categorizada e com estimativa de preços.", Icone: ShoppingCart },
                ].map(({ numero, titulo, texto, Icone }) => (
                  <article key={numero} className="group border-t border-border bg-background/35 px-1 py-7 backdrop-blur-xl transition-transform hover:-translate-y-1">
                    <div className="flex items-center justify-between"><span className="text-sm font-extrabold text-muted-foreground">{numero}</span><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icone /></span></div>
                    <h3 className="mt-8 text-xl font-extrabold">{titulo}</h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{texto}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="py-20">
            <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
              <div className="relative overflow-hidden rounded-3xl border border-card/80 bg-card/50 p-3 shadow-xl backdrop-blur-2xl">
                <img src={fridgeHero} alt="Visão computacional identificando alimentos" loading="lazy" width={1200} height={1500} className="aspect-[16/10] w-full rounded-2xl object-cover object-center" />
                <div className="absolute inset-x-8 bottom-8 flex items-center gap-3 rounded-xl border border-card/70 bg-card/75 p-4 backdrop-blur-xl">
                  <ScanLine className="size-6 text-primary" /><div><p className="font-extrabold">12 itens reconhecidos</p><p className="text-xs text-muted-foreground">Análise visual concluída</p></div>
                </div>
              </div>
              <div>
                <p className="text-sm font-extrabold uppercase text-primary">Inteligência que simplifica</p>
                <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Menos tempo conferindo. Mais clareza para comprar.</h2>
                <p className="mt-5 text-lg leading-relaxed text-muted-foreground">Nossa visão computacional reconhece os alimentos visíveis, compara com seu estoque ideal e transforma tudo em decisões simples para o dia a dia.</p>
                <Button className="mt-7" onClick={fotografar}><Camera /> Experimentar agora</Button>
              </div>
            </div>
          </section>
        </TabsContent>

        <div className={aba === "inicio" ? "hidden" : "mx-auto max-w-5xl px-4 py-8 sm:px-6"}>
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
              ref={analiseRef}
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
              estoque={estoque}
              atualizarRelatorio={setRelatorio}
              adicionar={adicionar}
              irParaAnalise={() => setAba("analise")}
            />
          </TabsContent>
        </div>
      </Tabs>
    </main>
  );
}
