import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordInput({ id, label, value, onChange, autoComplete = "new-password" }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete?: string }) {
  const [visivel, setVisivel] = useState(false);
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><div className="relative"><Input id={id} required type={visivel ? "text" : "password"} value={value} maxLength={72} autoComplete={autoComplete} onChange={e => onChange(e.target.value)} className="h-11 pr-12" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-9" aria-label={visivel ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} onClick={() => setVisivel(v => !v)}>{visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div></div>;
}