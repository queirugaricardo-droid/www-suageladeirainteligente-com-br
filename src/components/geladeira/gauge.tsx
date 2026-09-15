import { useEffect, useState } from "react";

type Props = {
  percentual: number;
  tamanho?: number;
  legenda?: string;
};

export function Gauge({ percentual, tamanho = 180, legenda = "abastecida" }: Props) {
  const [animado, setAnimado] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimado(percentual), 80);
    return () => clearTimeout(t);
  }, [percentual]);

  const raio = (tamanho - 18) / 2;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = circunferencia * (Math.min(100, Math.max(0, animado)) / 100);

  const cor =
    percentual < 40
      ? "var(--color-destructive)"
      : percentual < 76
        ? "var(--color-chart-4)"
        : "var(--color-primary)";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: tamanho, height: tamanho }}>
        <svg width={tamanho} height={tamanho} className="-rotate-90">
          <circle
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            fill="none"
            strokeWidth={14}
            className="stroke-muted"
          />
          <circle
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            fill="none"
            strokeWidth={14}
            strokeLinecap="round"
            stroke={cor}
            strokeDasharray={`${preenchido} ${circunferencia}`}
            style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-semibold tabular-nums text-foreground">
            {Math.round(percentual)}%
          </span>
          <span className="text-xs text-muted-foreground">{legenda}</span>
        </div>
      </div>
    </div>
  );
}
