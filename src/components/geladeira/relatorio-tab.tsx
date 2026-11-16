import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  MapPin,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  Trash2,
  X,
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

const FREQUENCIAS = [
  { fator: 1, titulo: "Semanal", detalhe: "1x" },
  { fator: 2, titulo: "Quinzenal", detalhe: "2x" },
  { fator: 4, titulo: "Mensal", detalhe: "4x" },
] as const;

export function RelatorioTab({
  relatorio,
  estoque,
  atualizarRelatorio,
  adicionar,
  irParaAnalise,
}: Props) {
  const [comprados, setComprados] = useState<Record<string, boolean>>({});
  const [precos, setP...[truncated]