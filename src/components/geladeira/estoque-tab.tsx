import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CATEGORIAS, UNIDADES } from "@/lib/fridge-types";
import type { Categoria, ItemIdeal, Unidade } from "@/lib/fridge-types";
import { categoriaPalpite } from "@/lib/fridge-logic";

type Props = {
  estoque: ItemIdeal[];
  adicionar: (item: Omit<ItemIdeal, "id">) => void;
  atualizar: (id: string, mudancas: Partial<ItemIdeal>) => void;
  remover: (id: string) => void;
};

export function EstoqueTab({ estoque, adicionar, atualizar, remover }: Props) {
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [unidade, setUnidade] = useState<Unidade>("un");
  const [categoria, setCategoria] = useState<Categoria>("Outros");

  const enviar = () => {
    const limpo = nome.trim();
    if (!limpo) return;
    adicionar({
      nome: limpo,
      quantidade: Math.max(0.1, Number(quantidade) || 1),
      unidade,
      categoria,
    });
    setNome("");
    setQuantidade("1");
    setUnidade("un");
    setCategoria("Outros");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adicionar alimento ao estoque ideal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_1.4fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Alimento</Label>
              <Input
                id="nome"
                value={nome}
                placeholder="Ex.: Iogurte natural"
                onChange={(e) => {
                  setNome(e.target.value);
                  setCategoria(categoriaPalpite(e.target.value));
                }}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qtd">Quantidade</Label>
              <Input
                id="qtd"
                type="number"
                min="0.1"
                step="0.1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={unidade} onValueChange={(v) => setUnidade(v as Unidade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={enviar} className="sm:mb-0">
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {CATEGORIAS.filter((c) => estoque.some((i) => i.categoria === c)).map((c) => (
          <Card key={c}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {c}
                <Badge variant="secondary">{estoque.filter((i) => i.categoria === c).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {estoque
                .filter((i) => i.categoria === c)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2"
                  >
                    <Input
                      className="h-9 flex-1 min-w-40"
                      value={item.nome}
                      onChange={(e) => atualizar(item.id, { nome: e.target.value })}
                    />
                    <Input
                      className="h-9 w-24"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={item.quantidade}
                      onChange={(e) =>
                        atualizar(item.id, { quantidade: Number(e.target.value) || 0 })
                      }
                    />
                    <Select
                      value={item.unidade}
                      onValueChange={(v) => atualizar(item.id, { unidade: v as Unidade })}
                    >
                      <SelectTrigger className="h-9 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIDADES.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover ${item.nome}`}
                      onClick={() => remover(item.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
        {estoque.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Seu estoque ideal está vazio. Adicione os alimentos que você gosta de ter sempre em casa.
          </p>
        )}
      </div>
    </div>
  );
}
