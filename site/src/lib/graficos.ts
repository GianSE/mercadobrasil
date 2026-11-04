import type { EChartsCoreOption } from "echarts/core";
import { base, eixo, type Tinta } from "../components/Grafico";
import { fmt } from "./formato";

/*
 * Os gráficos das seções, a partir dos do site do TCC (dashboards/src/lib/
 * graficos.ts), com as cores do tema novo. A paleta validada tem seis cores:
 * da sétima série em diante, cinza com o nome no fim da linha, em vez de uma
 * cor nova que se confundiria com outra.
 */

export type Formato = (v: number) => string;

export type SerieLinha = { nome: string; dados: (number | null)[]; area?: boolean; cinza?: boolean };

type Ponto = { seriesName?: string; value: unknown; color?: unknown; axisValueLabel?: string; dataIndex: number };

function tooltipEixo(t: Tinta, formato: Formato, extra?: (i: number) => string) {
  return {
    ...(base(t).tooltip as object),
    trigger: "axis",
    axisPointer: { type: "line", lineStyle: { color: t.eixo } },
    formatter: (params: unknown) => {
      const lista = (Array.isArray(params) ? params : [params]) as Ponto[];
      if (!lista.length) return "";
      const linhas = lista
        .filter((p) => p.seriesName && Number.isFinite(Number(p.value)))
        .map(
          (p) =>
            `<div style="display:flex;align-items:center;gap:6px;margin-top:3px"><span style="width:10px;height:3px;border-radius:2px;background:${String(p.color)}"></span><b>${formato(Number(p.value))}</b><span style="opacity:.7">${p.seriesName}</span></div>`,
        )
        .join("");
      return `<div style="font-size:11px;opacity:.7">${lista[0].axisValueLabel ?? ""}</div>${linhas}${extra ? extra(lista[0].dataIndex) : ""}`;
    },
  };
}

/**
 * Rótulos no fim de linhas que terminam perto um do outro se sobrepõem. Cada
 * rótulo que ficaria a menos de 13 px do vizinho de baixo sobe o que falta.
 * `altura` é a área útil do gráfico, aproximada. Devolve o deslocamento
 * vertical (negativo = para cima) por série. (Do site do TCC.)
 */
function afastarRotulos(series: SerieLinha[], altura: number, zero?: boolean): number[] {
  const ultimo = (d: (number | null)[]) => [...d].reverse().find((v) => v !== null && Number.isFinite(v)) ?? null;
  const todos = series.flatMap((s) => s.dados).filter((v): v is number => v !== null && Number.isFinite(v));
  if (!todos.length) return [];
  const [min, max] = [zero ? Math.min(0, ...todos) : Math.min(...todos), Math.max(...todos)];
  const pxPorUnidade = altura / (max - min || 1);
  const pontos = series
    .map((s, i) => ({ i, v: ultimo(s.dados) }))
    .filter((p): p is { i: number; v: number } => p.v !== null)
    .map((p) => ({ i: p.i, y: (p.v - min) * pxPorUnidade, pos: (p.v - min) * pxPorUnidade }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < pontos.length; k++) pontos[k].pos = Math.max(pontos[k].pos, pontos[k - 1].pos + 13);
  const saida: number[] = [];
  for (const p of pontos) saida[p.i] = -(p.pos - p.y);
  return saida;
}

export function opcaoLinhas(
  t: Tinta,
  x: (string | number)[],
  series: SerieLinha[],
  o: { formato?: Formato; formatoEixo?: Formato; zero?: boolean; rotuloFinal?: boolean; altura?: number } = {},
): EChartsCoreOption {
  const formato = o.formato ?? fmt.inteiro;
  const formatoEixo = o.formatoEixo ?? fmt.compacto;
  // Área útil: a altura do cartão menos o eixo de baixo e a margem de cima.
  const deslocamento = o.rotuloFinal ? afastarRotulos(series, (o.altura ?? 300) - 50, o.zero) : [];
  let cor = 0;
  return {
    ...base(t),
    legend: { show: false },
    grid: { left: 8, right: o.rotuloFinal ? 72 : 16, top: 12, bottom: 8, containLabel: true },
    tooltip: tooltipEixo(t, formato),
    xAxis: eixo(t, { type: "category", data: x, boundaryGap: false, splitLine: { show: false }, axisLabel: { color: t.rotulo, hideOverlap: true } }),
    yAxis: eixo(t, { type: "value", scale: !o.zero, axisLabel: { color: t.rotulo, formatter: (v: number) => formatoEixo(v) } }),
    series: series.map((s, i) => {
      const c = s.cinza ? t.rotulo : t.series[cor++ % t.series.length];
      return {
        type: "line",
        name: s.nome,
        data: s.dados,
        showSymbol: false,
        symbolSize: 8,
        connectNulls: false,
        lineStyle: { width: s.cinza ? 1.5 : 2, color: c },
        itemStyle: { color: c, borderColor: t.fundo, borderWidth: 2 },
        areaStyle: s.area ? { color: c, opacity: 0.14 } : undefined,
        endLabel: o.rotuloFinal
          ? { show: true, color: t.texto, fontSize: 11, offset: [0, deslocamento[i] ?? 0], formatter: () => s.nome }
          : undefined,
        emphasis: { focus: "series" },
      };
    }),
  };
}

export type SerieFluxo = "admissoes" | "desligamentos" | "saldo";

/**
 * Admissões para cima, desligamentos para baixo (o sinal é só desenho: no
 * tooltip o desligamento aparece positivo) e o saldo como linha por cima.
 */
export function opcaoFluxo(
  t: Tinta,
  x: string[],
  d: Record<SerieFluxo, (number | null)[]>,
  o: { visiveis: SerieFluxo[]; esmaecer?: number[] },
): EChartsCoreOption {
  const muitos = x.length > 40;
  const barra = (nome: string, dados: (number | null)[], cor: string) => ({
    type: "bar",
    name: nome,
    stack: "fluxo",
    data: dados.map((v, i) => ({ value: v, itemStyle: { opacity: o.esmaecer?.includes(i) ? 0.45 : 1 } })),
    itemStyle: { color: cor, borderColor: t.fundo, borderWidth: muitos ? 0 : 1 },
    barMaxWidth: 34,
    barCategoryGap: muitos ? "12%" : "30%",
  });
  const series = [
    o.visiveis.includes("admissoes") && barra("Admissões", d.admissoes, t.series[0]),
    o.visiveis.includes("desligamentos") && barra("Desligamentos", d.desligamentos.map((v) => (v === null ? null : -v)), t.series[1]),
    o.visiveis.includes("saldo") && {
      type: "line",
      name: "Saldo",
      data: d.saldo,
      showSymbol: !muitos,
      symbolSize: muitos ? 4 : 7,
      lineStyle: { width: 2, color: t.texto },
      itemStyle: { color: t.texto, borderColor: t.fundo, borderWidth: 2 },
      z: 5,
    },
  ].filter(Boolean);
  return {
    ...base(t),
    legend: { show: false },
    grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
    tooltip: {
      ...(base(t).tooltip as object),
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: t.grade, opacity: 0.5 } },
      formatter: (params: unknown) => {
        const lista = params as Ponto[];
        if (!lista.length) return "";
        const linhas = lista
          .map((p) => {
            const valor = (p.value as { value?: number } | number | null) ?? null;
            const v = typeof valor === "object" && valor !== null ? (valor.value ?? null) : valor;
            if (v === null || !Number.isFinite(v)) return "";
            const texto = p.seriesName === "Desligamentos" ? fmt.inteiro(-v) : p.seriesName === "Saldo" ? fmt.sinal(v) : fmt.inteiro(v);
            return `<div style="display:flex;align-items:center;gap:6px;margin-top:3px"><span style="width:10px;height:3px;border-radius:2px;background:${p.seriesName === "Saldo" ? t.texto : String(p.color)}"></span><b>${texto}</b><span style="opacity:.7">${p.seriesName}</span></div>`;
          })
          .join("");
        return `<div style="font-size:11px;opacity:.7">${lista[0].axisValueLabel ?? ""}</div>${linhas}`;
      },
    },
    xAxis: eixo(t, { type: "category", data: x, splitLine: { show: false }, axisLine: { onZero: false, lineStyle: { color: t.eixo } }, axisLabel: { color: t.rotulo, hideOverlap: true } }),
    yAxis: eixo(t, { type: "value", axisLabel: { color: t.rotulo, formatter: (v: number) => fmt.compacto(Math.abs(v)) } }),
    series,
  };
}
