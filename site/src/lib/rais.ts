import type { Area } from "./areas";
import type { Linha } from "./dados";

/*
 * Leituras da gold que mais de uma página usa. As colunas setor_da_area e
 * ocupacao_da_area se chamam assim em toda área (ver tasks-python/_utils/areas.py):
 * querem dizer "setor da área" e "ocupação da área".
 */

export type Lente = "dentro" | "fora" | "so_setor";

export function lenteDe(l: Linha): Lente {
  if (l.ocupacao_da_area) return l.setor_da_area ? "dentro" : "fora";
  return "so_setor";
}

export function rotuloLente(area: Area, lente: Lente): string {
  return { dentro: area.rotulos.lente_dentro, fora: area.rotulos.lente_fora, so_setor: area.rotulos.lente_so_setor }[lente];
}

export const LENTES: Lente[] = ["dentro", "fora", "so_setor"];

export type EstoqueAnual = {
  anos: number[];
  /** estoque em 31/12 por lente, alinhado a `anos` */
  porLente: Record<Lente, number[]>;
  total: number[];
};

/** rais_estoque_anual: uma linha por ano e combinação de lentes. */
export function estoqueAnual(linhas: Linha[]): EstoqueAnual {
  const anos = [...new Set(linhas.map((l) => l.ano as number))].sort((a, b) => a - b);
  const indice = new Map(anos.map((a, i) => [a, i]));
  const porLente: Record<Lente, number[]> = {
    dentro: anos.map(() => 0),
    fora: anos.map(() => 0),
    so_setor: anos.map(() => 0),
  };
  for (const l of linhas) porLente[lenteDe(l)][indice.get(l.ano as number)!] += (l.estoque_3112 as number) ?? 0;
  const total = anos.map((_, i) => LENTES.reduce((s, k) => s + porLente[k][i], 0));
  return { anos, porLente, total };
}

export type Resumo = {
  ano: number;
  estoque: number;
  variacao: number | null;
  /** parte dos profissionais da área que trabalham fora do setor da área */
  foraDoSetor: number;
};

export function resumir(e: EstoqueAnual): Resumo | null {
  const n = e.anos.length;
  if (!n) return null;
  const ultimo = n - 1;
  const profissionais = e.porLente.dentro[ultimo] + e.porLente.fora[ultimo];
  return {
    ano: e.anos[ultimo],
    estoque: e.total[ultimo],
    variacao: n > 1 && e.total[ultimo - 1] ? e.total[ultimo] / e.total[ultimo - 1] - 1 : null,
    foraDoSetor: profissionais ? e.porLente.fora[ultimo] / profissionais : 0,
  };
}
