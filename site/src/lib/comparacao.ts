import { useEffect, useState } from "react";
import { AREAS, type Area } from "./areas";
import { lerTabela, type Linha } from "./dados";
import { estoqueAnual, resumir } from "./rais";

/*
 * A comparação entre as áreas, da página inicial: duas tabelas pequenas de cada
 * gold (as mesmas que a Visão geral lê, então o cache serve às duas).
 *
 * As áreas se sobrepõem de propósito: Indústria conta todo mundo do setor,
 * Engenharia conta a profissão em qualquer setor. Por isso nada aqui soma as
 * áreas: um total daria um número sem sentido.
 */

export type AreaComparada = {
  area: Area;
  rais: {
    ano: number;
    anoBase: number;
    estoque: number;
    /** variação do estoque contra o ano anterior */
    variacao: number | null;
    /** estoque do último ano dividido pelo do primeiro */
    multiplo: number | null;
    /** a série inteira dividida pelo primeiro ano, para desenhar todas na mesma escala */
    indice: number[];
  } | null;
  /** saldo do CAGED nos 12 meses mais recentes da área; null sem os 12 meses completos */
  caged: { saldo: number; de: Date; ate: Date } | null;
};

function lerRais(linhas: Linha[] | null): AreaComparada["rais"] {
  if (!linhas) return null;
  const serie = estoqueAnual(linhas);
  const resumo = resumir(serie);
  if (!resumo) return null;
  const base = serie.total[0];
  return {
    ano: resumo.ano,
    anoBase: serie.anos[0],
    estoque: resumo.estoque,
    variacao: resumo.variacao,
    multiplo: base ? resumo.estoque / base : null,
    indice: base ? serie.total.map((v) => v / base) : [],
  };
}

/** Pela data, e não pelas 12 últimas linhas: um mês faltando não pode alargar a janela. */
function lerCaged(linhas: Linha[] | null): AreaComparada["caged"] {
  if (!linhas?.length) return null;
  const meses = linhas.map((l) => ({ data: new Date(l.mes as string | number | Date), saldo: l.saldo as number }));
  const ate = meses.reduce((m, x) => (x.data > m ? x.data : m), meses[0].data);
  const de = new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth() - 11, 1));
  const janela = meses.filter((m) => m.data >= de);
  if (janela.length !== 12) return null;
  return { saldo: janela.reduce((s, m) => s + m.saldo, 0), de, ate };
}

async function comparar(area: Area): Promise<AreaComparada> {
  // Uma tabela que falhe não derruba a outra, nem a linha da área.
  const [rais, caged] = await Promise.allSettled([lerTabela(area.repo, "rais_estoque_anual"), lerTabela(area.repo, "serie_mensal")]);
  return {
    area,
    rais: rais.status === "fulfilled" ? lerRais(rais.value) : null,
    caged: caged.status === "fulfilled" ? lerCaged(caged.value) : null,
  };
}

/** Todas as áreas de uma vez; null enquanto carrega, para a lista não trocar de ordem no meio. */
export function useComparacao(): AreaComparada[] | null {
  const [linhas, setLinhas] = useState<AreaComparada[] | null>(null);
  useEffect(() => {
    let vivo = true;
    Promise.all(AREAS.map(comparar)).then((r) => vivo && setLinhas(r));
    return () => {
      vivo = false;
    };
  }, []);
  return linhas;
}

export type Referencias = {
  /** o ano da RAIS mais recente entre as áreas */
  ano: number | null;
  anoBase: number | null;
  /** o último mês do CAGED entre as áreas */
  ate: Date | null;
  de: Date | null;
  /** a escala comum dos minigráficos */
  indiceMax: number;
  estoqueMax: number;
};

export function referencias(linhas: AreaComparada[]): Referencias {
  const rais = linhas.flatMap((l) => (l.rais ? [l.rais] : []));
  const caged = linhas.flatMap((l) => (l.caged ? [l.caged] : []));
  const recente = caged.reduce<(typeof caged)[number] | null>((m, c) => (!m || c.ate > m.ate ? c : m), null);
  return {
    ano: rais.length ? Math.max(...rais.map((r) => r.ano)) : null,
    anoBase: rais.length ? Math.min(...rais.map((r) => r.anoBase)) : null,
    ate: recente?.ate ?? null,
    de: recente?.de ?? null,
    indiceMax: Math.max(1, ...rais.flatMap((r) => r.indice)),
    estoqueMax: Math.max(1, ...rais.map((r) => r.estoque)),
  };
}

export type Destaques = {
  maior: AreaComparada | null;
  maisCresceu: AreaComparada | null;
  maiorSaldo: AreaComparada | null;
  menorSaldo: AreaComparada | null;
};

function melhorPor(linhas: AreaComparada[], valor: (l: AreaComparada) => number | null | undefined): AreaComparada | null {
  let melhor: AreaComparada | null = null;
  let melhorValor = -Infinity;
  for (const l of linhas) {
    const v = valor(l);
    if (v != null && v > melhorValor) {
      melhor = l;
      melhorValor = v;
    }
  }
  return melhor;
}

/**
 * Os destaques só comparam áreas no mesmo período: uma área cuja gold ainda não
 * recebeu o ano novo fica de fora, em vez de disputar com um ano de diferença.
 *
 * A maior variação no ano fica de fora de propósito. Ela é a mais sensível ao que
 * a RAIS conta e o CAGED não: em Educação, a RAIS sobe 613 mil em 2025 e o saldo
 * do CAGED é de 45 mil. O número aparece na tabela, com a nota, mas não em destaque.
 */
export function destaques(linhas: AreaComparada[], r: Referencias): Destaques {
  const noAno = linhas.filter((l) => l.rais?.ano === r.ano);
  const noMes = linhas.filter((l) => r.ate && l.caged?.ate.getTime() === r.ate.getTime());
  return {
    maior: melhorPor(noAno, (l) => l.rais?.estoque),
    maisCresceu: melhorPor(noAno, (l) => l.rais?.multiplo),
    maiorSaldo: melhorPor(noMes, (l) => l.caged?.saldo),
    menorSaldo: melhorPor(noMes, (l) => (l.caged ? -l.caged.saldo : null)),
  };
}
