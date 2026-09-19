import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShoppingCart,
  Store,
  TriangleAlert,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Gauge } from "./gauge";
import { buscarMercados, estimarPrecos } from "@/lib/fridge.functions";
import { categoriaPalpite, emojiDoAlimento, gerarRelatorio, mesmoItem } from "@/lib/fridge-logic";
import { CATEGORIAS } from "@/lib/fridge-types";
import type { ItemIdeal, Loja, PrecoEstimado, Relatorio } from "@/lib/fridge-types";

type Props = {
  relatorio: Relatorio | null;
  estoque: ItemIdeal[];
  atualizarRelatorio: (relatorio: Relatorio) => void;
  adicionar: (item: Omit<ItemIdeal, "id">) => void;
  irParaAnalise: () => void;
};

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const rotulo = {
  ok: { texto: "OK", classe: "bg-primary/15 text-primary" },
  baixo: { texto: "Baixo", classe: "bg-chart-4/25 text-chart-4" },
  faltando: { texto: "Faltando", classe: "bg-destructive/15 text-destructive" },
} as const;

export function RelatorioTab({ relatorio, estoque, atualizarRelatorio, adicionar, irParaAnalise }: Props) {
  const [comprados, setComprados] = useState<Record<string, boolean>>({});
  const [precos, setPrecos] = useState<PrecoEstimado[]>([]);
  const [observacao, setObservacao] = useState("");
  const [local, setLocal] = useState("");
  const [localManual, setLocalManual] = useState("");
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [avisoLocal, setAvisoLocal] = useState("");
  const [carregandoLocal, setCarregandoLocal] = useState(false);
  const [carregandoPrecos, setCarregandoPrecos] = useState(false);

  const mercados = useServerFn(buscarMercados);
  const orcar = useServerFn(estimarPrecos);

  const faltantes = useMemo(
    () => (relatorio?.linhas ?? []).filter((l) => l.situacao !== "ok"),
    [relatorio],
  );

  const precoDe = (nome: string) => precos.find((p) => p.nome === nome)?.precoUnitario ?? 0;

  const detectados = useMemo(() => {
    if (!relatorio) return [];
    if (relatorio.detectados) return relatorio.detectados;
    return [
      ...relatorio.linhas
        .filter((linha) => linha.detectado > 0)
        .map((linha) => ({
          nome: linha.item.nome,
          quantidade: linha.detectado,
          unidade: linha.item.unidade,
          emoji: linha.item.emoji,
        })),
      ...relatorio.extras,
    ];
  }, [relatorio]);

  const ajustarQuantidade = (indice: number, direcao: -1 | 1) => {
    const item = detectados[indice];
    if (!item) return;
    const unidade = item.unidade.toLowerCase();
    const passo = unidade === "g" || unidade === "ml" ? 50 : unidade === "kg" || unidade === "l" ? 0.1 : 1;
    const novaQuantidade = Math.max(0, Math.round((item.quantidade + direcao * passo) * 100) / 100);
    const atualizados = detectados.map((detectado, i) =>
      i === indice ? { ...detectado, quantidade: novaQuantidade } : detectado,
    );
    atualizarRelatorio(gerarRelatorio(estoque, atualizados));
  };

  const quantidadeDetectada = (quantidade: number, unidade: string) =>
    unidade.toLowerCase() === "un"
      ? `${quantidade.toLocaleString("pt-BR")} ${quantidade === 1 ? "unidade detectada" : "unidades detectadas"}`
      : `${quantidade.toLocaleString("pt-BR")} ${unidade} detectados`;

  const total = useMemo(
    () =>
      faltantes
        .filter((l) => !comprados[l.item.id])
        .reduce((soma, l) => soma + precoDe(l.item.nome), 0),
    [faltantes, comprados, precos],
  );

  if (!relatorio) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShoppingCart className="size-8 text-primary" />
          <p className="font-medium">Nenhum relatório ainda</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Envie uma foto da sua geladeira aberta para ver o que está faltando e montar a lista de
            compras.
          </p>
          <Button onClick={irParaAnalise}>Analisar geladeira</Button>
        </CardContent>
      </Card>
    );
  }

  const resumo = {
    ok: relatorio.linhas.filter((l) => l.situacao === "ok").length,
    baixo: relatorio.linhas.filter((l) => l.situacao === "baixo").length,
    faltando: relatorio.linhas.filter((l) => l.situacao === "faltando").length,
  };

  const usarLocalizacao = () => {
    if (!navigator.geolocation) {
      setAvisoLocal("Seu navegador não permite detectar a localização. Digite sua cidade abaixo.");
      return;
    }
    setCarregandoLocal(true);
    setAvisoLocal("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const resposta = await mercados({
            data: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          setLojas(resposta.lojas);
          if (resposta.local) setLocal(resposta.local);
          if (!resposta.ok) setAvisoLocal(resposta.erro);
        } catch {
          setAvisoLocal("Não consegui buscar mercados próximos agora.");
        } finally {
          setCarregandoLocal(false);
        }
      },
      () => {
        setCarregandoLocal(false);
        setAvisoLocal("Permissão de localização negada. Digite sua cidade ou CEP abaixo.");
      },
      { timeout: 12000 },
    );
  };

  const calcularPrecos = async (mercado?: string) => {
    if (faltantes.length === 0) return;
    setCarregandoPrecos(true);
    try {
      const resposta = await orcar({
        data: {
          itens: faltantes.map((l) => ({
            nome: l.item.nome,
            quantidade: l.faltam || l.item.quantidade,
            unidade: l.item.unidade,
          })),
          local: localManual.trim() || local || "",
          mercado: mercado || "",
        },
      });
      if (!resposta.ok) {
        toast.error(resposta.erro);
        return;
      }
      setPrecos(resposta.precos);
      setObservacao(resposta.observacao);
      if (!local && resposta.local) setLocal(resposta.local);
    } finally {
      setCarregandoPrecos(false);
    }
  };

  const copiarLista = async () => {
    const texto = faltantes
      .filter((l) => !comprados[l.item.id])
      .map((l) => `- ${l.item.nome}: ${l.faltam || l.item.quantidade} ${l.item.unidade}`)
      .join("\n");
    await navigator.clipboard.writeText(`Lista de compras\n${texto}`);
    toast.success("Lista copiada!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-8 sm:flex-row sm:justify-around">
          <Gauge percentual={relatorio.abastecimento} />
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/15 text-primary">{resumo.ok}</Badge> itens completos
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-chart-4/25 text-chart-4">{resumo.baixo}</Badge> em quantidade
              baixa
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-destructive/15 text-destructive">{resumo.faltando}</Badge>{" "}
              faltando
            </div>
            <p className="max-w-56 text-xs text-muted-foreground">
              Análise feita em{" "}
              {new Date(relatorio.criadoEm).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      {detectados.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Alimentos detectados pela IA</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {detectados.map((item, indice) => (
              <div
                key={`${item.nome}-${indice}`}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card/80 p-3"
              >
                <span className="font-emoji flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-3xl" aria-hidden="true">
                  {emojiDoAlimento(item.nome, item.emoji)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {quantidadeDetectada(item.quantidade, item.unidade)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1" aria-label={`Ajustar quantidade de ${item.nome}`}>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9"
                    aria-label={`Diminuir quantidade de ${item.nome}`}
                    onClick={() => ajustarQuantidade(indice, -1)}
                    disabled={item.quantidade <= 0}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9"
                    aria-label={`Aumentar quantidade de ${item.nome}`}
                    onClick={() => ajustarQuantidade(indice, 1)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comparativo com o seu estoque ideal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {relatorio.linhas.map((l) => (
            <div key={l.item.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-emoji text-xl" aria-hidden="true">
                  {emojiDoAlimento(
                    l.item.nome,
                    detectados.find((item) => mesmoItem(item.nome, l.item.nome))?.emoji ?? l.item.emoji,
                  )}
                </span>
                <span className="font-medium">{l.item.nome}</span>
                <Badge className={rotulo[l.situacao].classe}>{rotulo[l.situacao].texto}</Badge>
                <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                  {l.detectado} de {l.item.quantidade} {l.item.unidade}
                </span>
              </div>
              <Progress value={l.percentual * 100} className="mt-2 h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {relatorio.extras.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Também vi na sua geladeira</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {relatorio.extras.map((e, i) => (
              <Button
                key={`${e.nome}-${i}`}
                variant="outline"
                size="sm"
                onClick={() => {
                  adicionar({
                    nome: e.nome,
                    quantidade: e.quantidade || 1,
                    unidade: "un",
                    categoria: categoriaPalpite(e.nome),
                  });
                  toast.success(`${e.nome} adicionado ao estoque ideal.`);
                }}
              >
                <Plus className="size-3.5" /> {emojiDoAlimento(e.nome, e.emoji)} {e.nome}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="size-4 text-primary" /> Preços perto de você
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={usarLocalizacao} disabled={carregandoLocal}>
              {carregandoLocal ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              Usar minha localização
            </Button>
            <Input
              className="h-9 w-56"
              placeholder="Ou digite cidade / CEP"
              value={localManual}
              onChange={(e) => setLocalManual(e.target.value)}
            />
            <Button
              onClick={() => calcularPrecos()}
              disabled={carregandoPrecos || faltantes.length === 0}
            >
              {carregandoPrecos ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Calculando...
                </>
              ) : (
                "Estimar preços"
              )}
            </Button>
          </div>

          {local && (
            <p className="text-sm text-muted-foreground">
              Região considerada: <span className="text-foreground">{local}</span>
            </p>
          )}

          {avisoLocal && (
            <Alert>
              <TriangleAlert className="size-4" />
              <AlertDescription>{avisoLocal}</AlertDescription>
            </Alert>
          )}

          {lojas.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {lojas.map((loja) => (
                <div
                  key={`${loja.nome}-${loja.endereco}`}
                  className="flex items-start gap-3 rounded-xl border border-border p-3"
                >
                  <Store className="mt-0.5 size-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{loja.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{loja.endereco}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {loja.distanciaKm !== undefined && `${loja.distanciaKm} km`}
                      {loja.nota !== undefined && ` · nota ${loja.nota}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => calcularPrecos(loja.nome)}
                    disabled={carregandoPrecos}
                  >
                    Comparar
                  </Button>
                </div>
              ))}
            </div>
          )}

          {observacao && <p className="text-xs text-muted-foreground">{observacao}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="size-4 text-primary" /> Lista de compras
          </CardTitle>
          <Button variant="outline" size="sm" onClick={copiarLista} disabled={!faltantes.length}>
            <Copy className="size-3.5" /> Copiar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {faltantes.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" /> Sua geladeira está completa. Nada para
              comprar!
            </p>
          ) : (
            <>
              {CATEGORIAS.filter((c) => faltantes.some((l) => l.item.categoria === c)).map((c) => (
                <div key={c} className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">{c}</p>
                  {faltantes
                    .filter((l) => l.item.categoria === c)
                    .map((l) => {
                      const marcado = !!comprados[l.item.id];
                      const preco = precoDe(l.item.nome);
                      return (
                        <label
                          key={l.item.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3"
                        >
                          <Checkbox
                            checked={marcado}
                            onCheckedChange={(v) =>
                              setComprados((atual) => ({ ...atual, [l.item.id]: v === true }))
                            }
                          />
                          <span className="font-emoji text-xl" aria-hidden="true">
                            {emojiDoAlimento(
                              l.item.nome,
                              detectados.find((item) => mesmoItem(item.nome, l.item.nome))?.emoji ?? l.item.emoji,
                            )}
                          </span>
                          <span className={marcado ? "line-through opacity-60" : ""}>
                            {l.item.nome}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {l.faltam || l.item.quantidade} {l.item.unidade}
                          </span>
                          <span className="ml-auto text-sm tabular-nums">
                            {preco > 0 ? moeda(preco) : "—"}
                          </span>
                        </label>
                      );
                    })}
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
                <span className="font-medium">Total estimado</span>
                <span className="text-xl font-semibold tabular-nums">{moeda(total)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Os valores são estimativas geradas por IA e podem variar de um mercado para outro.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
