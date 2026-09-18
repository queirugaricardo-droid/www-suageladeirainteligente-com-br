import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { analisarFoto } from "@/lib/fridge.functions";
import { gerarRelatorio } from "@/lib/fridge-logic";
import type { ItemIdeal, Relatorio } from "@/lib/fridge-types";

type Props = {
  estoque: ItemIdeal[];
  aoConcluir: (relatorio: Relatorio) => void;
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
        const maxLado = 1280;
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Não consegui processar a imagem."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
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
  const [foto, setFoto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const inputCamera = useRef<HTMLInputElement>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const analisar = useServerFn(analisarFoto);

  useImperativeHandle(ref, () => ({
    abrirCamera: () => inputCamera.current?.click(),
  }));

  const escolher = async (arquivo?: File) => {
    if (!arquivo) return;
    setErro("");
    try {
      setFoto(await comprimir(arquivo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar a foto.");
    }
  };

  const executar = async () => {
    if (!foto) return;
    if (estoque.length === 0) {
      setErro("Cadastre pelo menos um alimento no estoque ideal antes de analisar.");
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      const resposta = await analisar({ data: { imagem: foto } });
      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }
      if (resposta.itens.length === 0) {
        setErro("Não identifiquei alimentos nessa foto. Tente uma imagem mais iluminada e de perto.");
        return;
      }
      aoConcluir(gerarRelatorio(estoque, resposta.itens));
      toast.success(`${resposta.itens.length} itens identificados na sua geladeira.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao analisar a foto.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Foto da geladeira aberta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {foto ? (
          <div className="relative overflow-hidden rounded-2xl border border-border">
            <img src={foto} alt="Foto da geladeira enviada" className="max-h-96 w-full object-cover" />
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-3 top-3"
              aria-label="Remover foto"
              onClick={() => setFoto(null)}
            >
              <X className="size-4" />
            </Button>
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
              Abra a geladeira, fotografe de frente e com boa luz
            </span>
          </button>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => inputCamera.current?.click()}>
            <Camera className="size-4" /> Tirar foto
          </Button>
          <Button variant="outline" onClick={() => inputArquivo.current?.click()}>
            <ImagePlus className="size-4" /> Carregar imagem
          </Button>
          <Button onClick={executar} disabled={!foto || carregando} className="ml-auto">
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
