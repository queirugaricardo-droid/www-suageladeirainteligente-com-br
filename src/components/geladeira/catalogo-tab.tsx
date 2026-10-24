import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIAS, CATEGORIAS_DETECCAO, UNIDADES } from "@/lib/fridge-types";
import { categoriaDeteccao, emojiDoAlimento, normalizar } from "@/lib/fridge-logic";
import type { AlimentoCatalogo, NovoAlimento } from "@/lib/use-food-data";

type Props = { alimentos: AlimentoCatalogo[]; conectado: boolean; carregando: boolean; erro: boolean; tentar: () => void; salvar: (item: NovoAlimento, id?: string) => Promise<void> };
const categorias = [...new Set([...CATEGORIAS_DETECCAO, ...CATEGORIAS])];

export function CatalogoTab({ alimentos, conectado, carregando, erro, tentar, salvar }: Props) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [id, setId] = useState<string>();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Outros");
  const [unidade, setUnidade] = useState("un");
  const [salvando, setSalvando] = useState(false);
  const limpar = () => { setId(undefined); setNome(""); setCategoria("Outros"); setUnidade("un"); };
  const editar = (item: AlimentoCatalogo) => { setId(item.id); setNome(item.nome); setCategoria(item.categoria); setUnidade(item.unidade); window.scrollTo({ top: 0, behavior: "smooth" }); };
  if (!conectado) return <div className="py-16 text-center"><BookOpen className="mx-auto mb-4 size-8 text-primary" /><h2 className="text-xl font-bold">Seu catálogo de alimentos</h2><p className="my-3 text-muted-foreground">Entre para acessar os alimentos salvos na sua conta.</p><Button asChild><Link to="/auth">Entrar</Link></Button></div>;
  const visiveis = alimentos.filter(a => normalizar(a.nome).includes(normalizar(busca)) && (filtro === "todas" || a.categoria === filtro));
  return <div className="space-y-8">
    <header><h2 className="text-2xl font-bold">Catálogo de alimentos</h2><p className="mt-2 text-sm text-muted-foreground">{alimentos.length} alimentos salvos na sua conta</p></header>
    <form className="grid gap-4 border-y border-border py-6 sm:grid-cols-2" onSubmit={async e => { e.preventDefault(); setSalvando(true); try { await salvar({ nome, categoria, unidade, emoji: emojiDoAlimento(nome) }, id); limpar(); toast.success("Alimento salvo na conta."); } catch { toast.error("Não foi possível salvar. Confira o nome e tente novamente."); } finally { setSalvando(false); } }}>
      <div className="space-y-2"><Label htmlFor="catalogo-nome">Nome do alimento</Label><Input id="catalogo-nome" required maxLength={120} value={nome} onChange={e => { setNome(e.target.value); if (!id) setCategoria(categoriaDeteccao(e.target.value)); }} placeholder="Ex.: Iogurte natural" /></div>
      <div className="space-y-2"><Label>Categoria</Label><Select value={categoria} onValueChange={setCategoria}><SelectTrigger aria-label="Categoria do catálogo"><SelectValue /></SelectTrigger><SelectContent>{categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Unidade preferida</Label><Select value={unidade} onValueChange={setUnidade}><SelectTrigger aria-label="Unidade do catálogo"><SelectValue /></SelectTrigger><SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex items-end gap-2"><Button disabled={salvando} type="submit"><Plus />{salvando ? "Salvando…" : id ? "Salvar alterações" : "Adicionar alimento"}</Button>{id && <Button type="button" variant="ghost" size="icon" aria-label="Cancelar edição do catálogo" onClick={limpar}><X /></Button>}</div>
    </form>
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar no catálogo" placeholder="Buscar alimento" value={busca} onChange={e => setBusca(e.target.value)} /></div><Select value={filtro} onValueChange={setFiltro}><SelectTrigger className="sm:w-56" aria-label="Filtrar catálogo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as categorias</SelectItem>{categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
    {carregando ? <p role="status">Carregando alimentos…</p> : erro ? <div role="alert"><p>Não foi possível carregar seu catálogo.</p><Button variant="outline" onClick={tentar}>Tentar novamente</Button></div> : visiveis.length === 0 ? <p className="py-12 text-center text-muted-foreground">{alimentos.length ? "Nenhum alimento encontrado." : "Seu catálogo está vazio."}</p> : <div className="grid gap-3 sm:grid-cols-2">{visiveis.map(a => <article key={a.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-4"><span className="text-3xl" aria-hidden="true">{emojiDoAlimento(a.nome, a.emoji ?? undefined)}</span><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{a.nome}</h3><p className="text-sm text-muted-foreground">{a.categoria} · {a.unidade}</p></div><Button variant="ghost" size="icon" aria-label={`Editar ${a.nome} no catálogo`} onClick={() => editar(a)}><Pencil /></Button></article>)}</div>}
  </div>;
}