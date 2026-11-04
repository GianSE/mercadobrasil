import type { LinhaSQL } from "./db";

/*
 * Pedaços de SQL que as seções repetem, vindos do site do TCC. As colunas
 * setor_ti e ocupacao_ti existem em toda área (ver tasks-python/_utils/areas.py)
 * e querem dizer "setor da área" e "ocupação da área".
 */

/** O recorte da área na RAIS: a união das duas lentes, como no CAGED. */
export const RECORTE = "(setor_ti OR ocupacao_ti)";

export type Periodo = readonly [number, number];

/**
 * Série anual da RAIS: a tabela nacional quando não há filtro de território,
 * a tabela por UF quando há. O estoque soma igual nas duas.
 */
export const tabelaRais = (filtrada: boolean) => (filtrada ? "rais_estoque_uf" : "rais_estoque_anual");

export const entre = (p: Periodo, coluna = "ano") => `${coluna} BETWEEN ${p[0]} AND ${p[1]}`;

export const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

export const num = (l: LinhaSQL | undefined, chave: string): number => Number(l?.[chave] ?? NaN);

export const coluna = (linhas: LinhaSQL[], chave: string) => linhas.map((l) => (l[chave] === null ? null : Number(l[chave])));

export const rotulos = (linhas: LinhaSQL[], chave: string) => linhas.map((l) => String(l[chave] ?? "—"));

export const intervalo = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);
