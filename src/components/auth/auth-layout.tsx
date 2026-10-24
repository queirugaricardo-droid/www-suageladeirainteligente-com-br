import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Refrigerator, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthLayout({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return <main className="min-h-screen bg-background px-4 py-8 sm:py-12"><div className="mx-auto max-w-md">
    <Button asChild variant="ghost" className="mb-6 px-0"><Link to="/"><ArrowLeft /> Voltar ao início</Link></Button>
    <Link to="/" className="mb-8 flex items-center gap-3 text-lg font-extrabold"><span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Refrigerator /></span><span>Geladeira <span className="text-primary">Inteligente</span></span></Link>
    <header className="mb-7"><h1 className="text-3xl font-bold">{titulo}</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitulo}</p></header>
    <div className="space-y-5">{children}</div>
    <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Conta individual · Dados protegidos</p>
  </div></main>;
}