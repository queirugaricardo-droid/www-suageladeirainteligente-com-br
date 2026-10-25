import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  ListChecks,
  MessageCircle,
  Refrigerator,
  ScanSearch,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import fridgeHero from "@/assets/fridge-hero.jpg";

const SITE_URL = "https://www-suageladeirainteligente-com-br.lovable.app";

export const Route = createFileRoute("/oferta")({
  head: () => ({
    meta: [
      { title: "Plano Geladeira Inteligente — Organize suas compras por R$ 19,90/mês" },
      {
        name: "description",
        content:
          "Fotografe sua geladeira, identifique alimentos com IA e receba uma lista de compras organizada. Conheça o plano por R$ 19,90 ao mês.",
      },
      { property: "og:title", content: "Sua geladeira organizada por R$ 19,90/mês" },
      {
        property: "og:description",
        content:
          "Use fotos para conferir os alimentos, comparar com seu estoque ideal e preparar sua lista de compras.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/oferta` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/oferta` }],
  }),
  component: PaginaOferta,
});

const recursos = [
  {
    icon: ScanSearch,
    titulo: "Análise por foto",
    texto: "A inteligência artificial identifica os alimentos visíveis e estima as quantidades para você revisar.",
  },
  {
    icon: Refrigerator,
    titulo: "Estoque ideal",
    texto: "Defina quanto quer manter de cada item e acompanhe o que está suficiente, baixo ou faltando.",
  },
  {
    icon: ShoppingBasket,
    titulo: "Lista automática",
    texto: "Transforme as faltas em uma lista categorizada, com quantidades sugeridas e preços estimados.",
  },
  {
    icon: Cloud,
    titulo: "Dados na sua conta",
    texto: "Seu estoque ideal fica protegido na sua conta e disponível quando você entrar em outro aparelho.",
  },
  {
    icon: MessageCircle,
    titulo: "Pronta para compartilhar",
    texto: "Envie sua lista pelo WhatsApp em uma mensagem limpa, organizada por categorias e fácil de conferir.",
  },
  {
    icon: ShieldCheck,
    titulo: "Você mantém o controle",
    texto: "Revise nomes e quantidades identificados antes de usar o resultado nas decisões de compra.",
  },
];

const perguntas = [
  {
    pergunta: "Quantas fotos posso analisar?",
    resposta:
      "O plano mensal inclui até 50 fotos por mês (a conta gratuita tem 2). Você pode usar dois ângulos da mesma geladeira em cada análise.",
  },
  {
    pergunta: "A identificação da foto pode ser corrigida?",
    resposta:
      "Sim. Você pode revisar os alimentos encontrados e corrigir nome ou quantidade antes de usar o resultado.",
  },
  {
    pergunta: "Minha lista é criada automaticamente?",
    resposta:
      "Sim. O aplicativo compara o que aparece na foto com o estoque ideal cadastrado e sugere o que comprar.",
  },
  {
    pergunta: "Funciona no celular?",
    resposta:
      "Sim. A experiência foi preparada para celular e permite tirar ou enviar as fotos diretamente pelo aparelho.",
  },
];

function Marca() {
  return (
    <span className="inline-flex items-center gap-2.5 font-extrabold text-foreground">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Refrigerator className="size-5" />
      </span>
      <span>Geladeira <span className="text-primary">Inteligente</span></span>
    </span>
  );
}

function PaginaOferta() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Ir para o aplicativo"><Marca /></Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth">Já tenho conta</Link>
            </Button>
            <Button asChild>
              <Link to="/cadastro">Criar conta <ArrowRight /></Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative border-b border-border/70">
        <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_0.92fr] lg:py-16">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-secondary px-3 py-1.5 text-sm font-bold text-primary">
              <Sparkles className="size-4" /> Sua cozinha mais simples
            </div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">
              Descubra o que falta sem conferir item por item.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Fotografe sua geladeira, revise o que a IA encontrou e transforme as faltas em uma lista de compras organizada.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-13 px-6 text-base shadow-xl shadow-primary/20">
                <Link to="/cadastro"><Camera className="size-5" /> Criar minha conta</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-13 bg-card px-6 text-base">
                <Link to="/">Conhecer o aplicativo <ChevronRight /></Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Check className="size-4 text-primary" /> 50 fotos por mês</span>
              <span className="flex items-center gap-2"><Check className="size-4 text-primary" /> Estoque salvo na conta</span>
              <span className="flex items-center gap-2"><Check className="size-4 text-primary" /> Lista no WhatsApp</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
                <img
                  src={fridgeHero}
                  alt="Geladeira aberta com alimentos sendo identificados"
                  width={1200}
                  height={1500}
                  className="size-full object-cover"
                />
                <div className="absolute inset-x-0 top-0 h-px animate-scan bg-primary shadow-[0_0_18px_var(--primary)]" />
                <div className="absolute left-3 top-3 rounded-lg border border-border/80 bg-card/90 px-3 py-2 text-xs font-bold shadow-lg backdrop-blur sm:left-5 sm:top-5">
                  <span className="mr-2 inline-block size-2 rounded-full bg-primary" />Análise em andamento
                </div>
                <div className="absolute inset-x-3 bottom-3 grid grid-cols-3 divide-x divide-border rounded-xl border border-border/80 bg-card/90 p-3 text-center shadow-xl backdrop-blur sm:inset-x-5 sm:bottom-5 sm:p-4">
                  <div><p className="text-lg font-extrabold sm:text-xl">12</p><p className="text-[10px] text-muted-foreground sm:text-xs">identificados</p></div>
                  <div><p className="text-lg font-extrabold text-primary sm:text-xl">70%</p><p className="text-[10px] text-muted-foreground sm:text-xs">abastecida</p></div>
                  <div><p className="text-lg font-extrabold sm:text-xl">5</p><p className="text-[10px] text-muted-foreground sm:text-xs">para comprar</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/45 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-extrabold uppercase text-primary">Do clique à lista</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Três passos. Nenhuma prateleira esquecida.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { numero: "01", icon: Camera, titulo: "Fotografe", texto: "Tire ou envie até duas fotos da sua geladeira aberta." },
              { numero: "02", icon: WandSparkles, titulo: "Revise a análise", texto: "Confira os alimentos e ajuste qualquer nome ou quantidade." },
              { numero: "03", icon: ListChecks, titulo: "Compre com clareza", texto: "Veja o que falta e leve a lista organizada no celular." },
            ].map(({ numero, icon: Icon, titulo, texto }) => (
              <article key={numero} className="border-t-2 border-primary bg-background px-5 py-6 transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between text-sm font-extrabold text-muted-foreground">
                  <span>{numero}</span><Icon className="size-6 text-primary" />
                </div>
                <h3 className="mt-8 text-xl font-extrabold">{titulo}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-extrabold uppercase text-primary">Tudo em um só lugar</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Menos dúvida antes de comprar.</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">Recursos pensados para ajudar você a cuidar do estoque sem depender da memória.</p>
          </div>
          <div className="mt-10 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {recursos.map(({ icon: Icon, titulo, texto }) => (
              <article key={titulo} className="group border-b border-border py-7">
                <span className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-extrabold">{titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-foreground py-16 text-background sm:py-24">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-sm font-extrabold uppercase text-primary">Plano mensal</p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-extrabold sm:text-4xl">Sua geladeira sob controle por menos de R$ 1 por dia.</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-background/70">
              Uma ferramenta prática para conferir alimentos, manter o estoque ideal e chegar ao mercado com a lista pronta.
            </p>
          </div>

          <div className="rounded-2xl border border-background/15 bg-background p-6 text-foreground shadow-2xl sm:p-8">
            <p className="font-bold text-muted-foreground">Geladeira Inteligente</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-5xl font-extrabold">R$ 19,90</span>
              <span className="pb-1 text-sm text-muted-foreground">/mês</span>
            </div>
            <ul className="mt-7 space-y-3 text-sm">
              {[
                "Até 50 fotos por mês",
                "Análise de alimentos com IA",
                "Estoque ideal salvo na conta",
                "Lista de compras categorizada",
                "Estimativa de preços e mercados próximos",
                "Compartilhamento pelo WhatsApp",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{item}</li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-8 h-12 w-full text-base">
              <Link to="/assinar">Assinar por R$ 19,90/mês <ArrowRight /></Link>
            </Button>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
              Entre ou crie sua conta para assinar. 50 fotos por mês, cancele quando quiser.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center">
            <CircleHelp className="mx-auto size-8 text-primary" />
            <h2 className="mt-4 font-display text-3xl font-extrabold">Perguntas frequentes</h2>
          </div>
          <div className="mt-9 divide-y divide-border border-y border-border">
            {perguntas.map(({ pergunta, resposta }) => (
              <details key={pergunta} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                  {pergunta}<ChevronRight className="size-5 shrink-0 text-primary transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 max-w-2xl pr-8 text-sm leading-relaxed text-muted-foreground">{resposta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-display text-3xl font-extrabold">Pare de adivinhar. Comece a organizar.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Crie sua conta e conheça uma forma mais simples de cuidar da geladeira e da lista de compras.</p>
          <Button asChild size="lg" className="mt-7 h-12 px-7 text-base">
            <Link to="/cadastro"><Camera /> Criar minha conta</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border bg-background py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:px-6 sm:text-left">
          <Marca />
          <p>Organização prática para a sua cozinha.</p>
        </div>
      </footer>
    </main>
  );
}