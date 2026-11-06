import { useState } from "react";
import { fmt } from "../lib/formato";

type Parte = { nome: string; valor: number };

/**
 * Como um todo se divide, de relance: uma barra alta com um bloco por parte,
 * na ordem dos dados e com a cor da paleta na ordem fixa. A parte vai escrita
 * dentro do bloco quando cabe; a legenda dá os nomes. Para até 6 partes; as
 * demais se juntam em "Outros" (skill dataviz: tall segmented bar).
 */
export function BarraSegmentada({ partes, rotulo, formato }: { partes: Parte[]; rotulo: string; formato: (v: number) => string }) {
  const [focada, setFocada] = useState<number | null>(null);
  const ordenadas = [...partes].sort((a, b) => b.valor - a.valor);
  const visiveis = ordenadas.length > 6 ? [...ordenadas.slice(0, 5), { nome: "Outros", valor: ordenadas.slice(5).reduce((s, p) => s + p.valor, 0) }] : ordenadas;
  const total = visiveis.reduce((s, p) => s + p.valor, 0) || 1;
  const cor = (i: number) => `var(--chart-${(i % 7) + 1})`;
  const atual = focada !== null ? visiveis[focada] : null;

  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={`${rotulo}: ${visiveis.map((p) => `${p.nome} ${fmt.parte(p.valor / total)}`).join(", ")}`} className="flex h-12 w-full gap-0.5 overflow-hidden rounded-lg">
        {visiveis.map((p, i) => {
          const parte = p.valor / total;
          return (
            <div
              key={p.nome}
              onMouseEnter={() => setFocada(i)}
              onMouseLeave={() => setFocada(null)}
              className="segmento flex min-w-0 items-center justify-center text-xs font-semibold text-white transition-[filter,opacity] first:rounded-l-lg last:rounded-r-lg"
              style={{ width: `${parte * 100}%`, background: cor(i), opacity: focada === null || focada === i ? 1 : 0.55, animationDelay: `${i * 90}ms` }}
            >
              {/* Só escreve a parte onde o bloco tem largura para ela. */}
              {parte >= 0.09 && <span className="truncate px-1 drop-shadow-[0_1px_1px_rgb(0_0_0/0.45)]">{fmt.parte(parte)}</span>}
            </div>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {visiveis.map((p, i) => (
          <li key={p.nome} className="flex items-center gap-1.5" onMouseEnter={() => setFocada(i)} onMouseLeave={() => setFocada(null)}>
            <span className="h-2 w-3 shrink-0 rounded-sm" style={{ background: cor(i) }} aria-hidden />
            <span className={focada === i ? "text-foreground" : undefined}>{p.nome}</span>
          </li>
        ))}
      </ul>
      <p className="h-4 text-xs text-muted-foreground" aria-live="polite">
        {atual ? `${atual.nome}: ${formato(atual.valor)} (${fmt.parte(atual.valor / total)})` : "Passe o mouse num bloco para ver o número."}
      </p>
    </div>
  );
}
