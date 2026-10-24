import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSignOut } from "@/lib/use-sign-out";
import { useSessao } from "@/lib/use-sessao";
import { Camera, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { analisarFoto, consultarUsoFotos } from "@/lib/fridge.functions";
import type { ItemDetectado, ItemIdeal } from "@/lib/fridge-types";

const MAX_FOTOS = 2;

type Props = {
  estoque: ItemIdeal[];
  aoConcluir: (itens: ItemDetectado[]) => void;
};

export type AnaliseTabHandle = {
  abrirCamera: () => void;
};

function comprimir(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não consegui ler a imagem."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida."));
      img.onload = () => {
        const maxLado = 2048;
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Não consegui processar a imagem."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}

export const AnaliseTab = forwardRef<AnaliseTabHandle, Props>(function AnaliseTab(
  { estoque, aoConcluir },
  ref,
) {
  const [fotos, setFotos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const inputCamera = useRef<HTMLInputElement>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const analisar = useServerFn(analisarFoto);
  const consultarUso = useServerFn(consultarUsoFotos);
  const { usuario, pronto } = useSessao();
  const sair = useSignOut();
  const [restantes, setRestantes] = useState<number | null>(null);

  const atualizarUso = useCallback(async () => {
    try {
      const uso = await consultarUso();
      setRestantes(uso.restantes);
    } catch {
      setRestantes(null);
    }
  }, [consultarUso]);

  useEffect(() => {
    if (usuario) atualizarUso();
    else setRestantes(null);
  }, [usuario, atualizarUso]);

  useImperativeHandle(ref, () => ({
    abrirCamera: () => inputCamera.current?.click(),
  }));

  const escolher = async (arquivo?: File) => {
    if (!arquivo) return;
    setErro("");
    if (fotos.length >= MAX_FOTOS) {
      setErro(`Você pode enviar no máximo ${MAX_FOTOS} fotos por análise.`);
      return;
    }
    try {
      const nova = await comprimir(arquivo);
      setFotos((atual) => [...atual, nova].slice(0, MAX_FOTOS));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar a foto.");
    }
  };

  const removerFoto = (indice: number) => {
    setFotos((atual) => atual.filter((_, i) => i !== indice));
  };

  const executar = async () => {
    if (fotos.length === 0) return;
    if (!usuario) {
      setErro("Entre na sua conta para analisar fotos.");
      return;
    }
    if (restantes !== null && fotos.length > restantes) {
      setErro(restantes === 0 ? "Você já usou suas 2 fotos deste mês. O limite renova no dia 1º." : `Você só tem ${restantes} foto restante neste mês.`);
      return;
    }
    if (estoque.length === 0) {
      setErro("Cadastre pelo menos um alimento no estoque ideal antes de analisar.");
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      const resposta = await analisar({ data: { imagens: fotos } });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      if (resposta.itens.length === 0) {
        setErro("Não identifiquei alimentos nessa foto. Tente uma imagem mais iluminada e de perto.");
        return;
      }
      aoConcluir(resposta.itens);
      toast.success(`${resposta.itens.length} itens identificados — revise antes de confirmar.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao analisar a foto.");
    } finally {
      setCarregando(false);
      atualizarUso();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Foto da geladeira aberta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pronto && !usuario ? (
          <Alert>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>Entre na sua conta para analisar fotos (2 fotos por mês).</span>
              <Button asChild size="sm">
                <Link to="/auth">Entrar</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : usuario ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-sm">
            <span>
              {restantes === null ? "Verificando seu limite..." : `${restantes} de 2 fotos restantes neste mês`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void sair().catch(() => toast.error("Não foi possível sair da conta."))}>
              Sair ({usuario.email})
            </Button>
          </div>
        ) : null}
        <input
          ref={inputCamera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => escolher(e.target.files?.[0])}
        />
        <input
          ref={inputArquivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => escolher(e.target.files?.[0])}
        />

        {fotos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {fotos.map((foto, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl border border-border">
                <img
                  src={foto}
                  alt={`Foto ${i + 1} da geladeira`}
                  className="h-44 w-full object-cover sm:h-56"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2"
                  aria-label={`Remover foto ${i + 1}`}
                  onClick={() => removerFoto(i)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            {fotos.length < MAX_FOTOS && (
              <button
                type="button"
                onClick={() => inputArquivo.current?.click()}
                className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/40 text-center transition-colors hover:bg-secondary sm:h-56"
              >
                <ImagePlus className="size-7 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Adicionar 2ª foto (outro ângulo)
                </span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputArquivo.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/40 px-6 py-14 text-center transition-colors hover:bg-secondary"
          >
            <ImagePlus className="size-8 text-primary" />
            <span className="font-medium text-foreground">Toque para escolher uma foto</span>
            <span className="text-sm text-muted-foreground">
              Abra a geladeira, fotografe de frente e com boa luz. Você pode enviar até {MAX_FOTOS}{" "}
              fotos de ângulos diferentes.
            </span>
          </button>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => inputCamera.current?.click()}
            disabled={fotos.length >= MAX_FOTOS}
          >
            <Camera className="size-4" /> Tirar foto
          </Button>
          <Button
            variant="outline"
            onClick={() => inputArquivo.current?.click()}
            disabled={fotos.length >= MAX_FOTOS}
          >
            <ImagePlus className="size-4" /> Carregar imagem
          </Button>
          <Button onClick={executar} disabled={fotos.length === 0 || carregando || !usuario || restantes === 0} className="ml-auto">
            {carregando ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Analisando sua geladeira...
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Analisar geladeira
              </>
            )}
          </Button>
        </div>

        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
});
