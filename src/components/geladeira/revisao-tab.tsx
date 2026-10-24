import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { categoriaDeteccao, emojiDoAlimento } from "@/lib/fridge-logic";
import { CATEGORIAS_DETECCAO, UNIDADES } from "@/lib/fridge-types";
import type { CategoriaDeteccao, ItemDetectado } from "@/lib/fridge-types";

type Props = {
  itens: ItemDetectado[];
  aoConfirmar: (itens: ItemDetectado[]) => void | Promise<void>;
  salvando?: boolean;
  aoVoltar: () => void;
};

const LIMITE_ALTA_CONFIANCA = 0.9;

function seloConfianca(confianca?: number) {
  if (confianca === undefined || confianca >= LIMITE_ALTA_CONFIANCA) {
    return { texto: "Alta confiança", classe: "bg-primary/15 text-primary", revisar: false };
  }
  return { texto: "Revisar", classe: "bg-chart-4/25 text-chart-4", revisar: true };
}

export function RevisaoTab({ itens, aoConfirmar, aoVoltar, salvando = false }: Props) {
  const [lista, setLista] = useState<ItemDetectado[]>(itens);
  const [editando, setEditando] = useState<number | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaQuantidade, setNovaQuantidade] = useState("1");
  const [novaUnidade, setNovaUnidade] = useState<string>("un");

  const grupos = useMemo(() => {
    const mapa = new Map<CategoriaDeteccao, Array<{ item: ItemDetectado; indice: number }>>();
    lista.forEach((item, indice) => {
      const categoria = item.categoria ?? categoriaDeteccao(item.nome);
      const grupo = mapa.get(categoria) ?? [];
      grupo.push({ item, indice });
      mapa.set(categoria, grupo);
    });
    return CATEGORIAS_DETECCAO.filter((c) => mapa.has(c)).map((c) => ({
      categoria: c,
      itens: mapa.get(c) ?? [],
    }));
  }, [lista]);

  const precisamRevisao = lista.filter((i) => seloConfianca(i.confianca).revisar).length;

  const ajustarQuantidade = (indice: number, direcao: -1 | 1) => {
    setLista((atual) =>
      atual.map((item, i) => {
        if (i !== indice) return item;
        const unidade = item.unidade.toLowerCase();
        const passo = unidade === "g" || unidade === "ml" ? 50 : unidade === "kg" || unidade === "l" ? 0.1 : 1;
        const quantidade = Math.max(0, Math.round((item.quantidade + direcao * passo) * 100) / 100);
        return { ...item, quantidade, confianca: 1, estimado: false };
      }),
    );
  };

  const iniciarEdicao = (indice: number) => {
    setEditando(indice);
    setNomeEditado(lista[indice]?.nome ?? "");
  };

  const confirmarEdicao = (indice: number) => {
    const item = lista[indice];
    const nome = nomeEditado.trim();
    setEditando(null);
    if (!item || !nome || nome === item.nome) return;
    setLista((atual) =>
      atual.map((d, i) =>
        i === indice
          ? { ...d, nome, emoji: emojiDoAlimento(nome), categoria: categoriaDeteccao(nome), confianca: 1 }
          : d,
      ),
    );
    toast.success(`"${item.nome}" renomeado para "${nome}".`);
  };

  const removerItem = (indice: number) => {
    const item = lista[indice];
    setLista((atual) => atual.filter((_, i) => i !== indice));
    if (item) toast.success(`"${item.nome}" removido da análise.`);
  };

  const adicionarManual = () => {
    const nome = novoNome.trim();
    const quantidade = Number(novaQuantidade.replace(",", "."));
    if (!nome) {
      toast.error("Digite o nome do alimento.");
      return;
    }
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      toast.error("Digite uma quantidade válida.");
      return;
    }
    setLista((atual) => [
      ...atual,
      {
        nome,
        quantidade,
        unidade: novaUnidade,
        confianca: 1,
        emoji: emojiDoAlimento(nome),
        categoria: categoriaDeteccao(nome),
      },
    ]);
    setNovoNome("");
    setNovaQuantidade("1");
    toast.success(`${nome} adicionado à revisão.`);
  };

  const confirmar = () => {
    if (lista.length === 0) {
      toast.error("Nenhum item para confirmar. Adicione um alimento ou refaça a foto.");
      return;
    }
    aoConfirmar(lista);
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-primary" /> Revise o que a IA encontrou
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{lista.length} {lista.length === 1 ? "item identificado" : "itens identificados"}</span>
            {precisamRevisao > 0 && (
              <>
                {" — "}
                <span className="font-semibold text-chart-4">{precisamRevisao} {precisamRevisao === 1 ? "precisa" : "precisam"} de revisão</span>
              </>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Confira, corrija ou remova itens antes de confirmar. Nada é salvo até você confirmar.
          </p>
        </CardContent>
      </Card>

      {grupos.map(({ categoria, itens: itensGrupo }) => (
        <Card key={categoria}>
          <CardHeader>
            <CardTitle className="text-base">{categoria}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {itensGrupo.map(({ item, indice }) => {
              const selo = seloConfianca(item.confianca);
              return (
                <div
                  key={`${item.nome}-${indice}`}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card/80 p-3"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-3xl" aria-hidden="true">
                    {emojiDoAlimento(item.nome, item.emoji)}
                  </span>
                  <div className="min-w-0 flex-1">
                    {editando === indice ? (
                      <form
                        className="flex items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          confirmarEdicao(indice);
                        }}
                      >
                        <Input
                          autoFocus
                          className="h-8 text-sm"
                          value={nomeEditado}
                          onChange={(e) => setNomeEditado(e.target.value)}
                          aria-label={`Novo nome para ${item.nome}`}
                        />
                        <Button type="submit" variant="outline" size="icon" className="size-8 shrink-0" aria-label="Confirmar novo nome">
                          <Check className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Cancelar edição" onClick={() => setEditando(null)}>
                          <X className="size-4" />
                        </Button>
                      </form>
                    ) : (
                      <>
                        <p className="truncate font-semibold">{item.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.estimado ? "≈ " : ""}
                          {item.quantidade.toLocaleString("pt-BR")} {item.unidade}
                          {item.estimado && <span className="ml-1 text-xs">(estimado, confira)</span>}
                        </p>
                        <Badge className={`mt-1 ${selo.classe}`}>{selo.texto}</Badge>
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1" aria-label={`Ajustar ${item.nome}`}>
                    <Button variant="outline" size="icon" className="size-9" aria-label={`Diminuir quantidade de ${item.nome}`} onClick={() => ajustarQuantidade(indice, -1)} disabled={item.quantidade <= 0}>
                      <Minus className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="size-9" aria-label={`Aumentar quantidade de ${item.nome}`} onClick={() => ajustarQuantidade(indice, 1)}>
                      <Plus className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9" aria-label={`Renomear ${item.nome}`} onClick={() => iniciarEdicao(indice)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label={`Remover ${item.nome} da análise`} onClick={() => removerItem(indice)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">A IA não viu algo? Adicione manualmente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Input
            className="h-11 min-w-40 flex-1"
            placeholder="Nome do alimento"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionarManual();
              }
            }}
          />
          <Input
            className="h-11 w-24"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={novaQuantidade}
            onChange={(e) => setNovaQuantidade(e.target.value)}
            aria-label="Quantidade"
          />
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={novaUnidade}
            onChange={(e) => setNovaUnidade(e.target.value)}
            aria-label="Unidade"
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <Button variant="outline" className="h-11" onClick={adicionarManual}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" disabled={salvando} onClick={aoVoltar}>
          <ArrowLeft className="size-4" /> Refazer foto
        </Button>
        <Button size="lg" className="h-12" disabled={salvando} onClick={confirmar}>
          <CheckCircle2 className="size-5" /> {salvando ? "Salvando na conta…" : "Confirmar e gerar relatório"}
        </Button>
      </div>
    </div>
  );
}
