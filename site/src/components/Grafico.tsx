import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import { useTema } from "../lib/tema";

echarts.use([LineChart, BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

/** As cores do gráfico, lidas das variáveis CSS do tema na hora de desenhar. */
export type Tinta = {
  series: string[];
  texto: string;
  rotulo: string;
  grade: string;
  eixo: string;
  fundo: string;
};

function lerTinta(): Tinta {
  const css = getComputedStyle(document.documentElement);
  const v = (nome: string) => css.getPropertyValue(nome).trim();
  return {
    series: [1, 2, 3, 4, 5, 6].map((i) => v(`--chart-${i}`)),
    texto: v("--foreground"),
    rotulo: v("--chart-rotulo"),
    grade: v("--chart-grade"),
    eixo: v("--chart-eixo"),
    fundo: v("--card"),
  };
}

/** O que todo gráfico do site compartilha: fonte, eixos discretos, tooltip no tema. */
export function base(t: Tinta): EChartsCoreOption {
  return {
    color: t.series,
    textStyle: { fontFamily: "inherit", color: t.texto },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    tooltip: {
      backgroundColor: t.fundo,
      borderColor: t.grade,
      textStyle: { color: t.texto },
      confine: true,
    },
    legend: { top: 0, left: 0, icon: "roundRect", itemWidth: 12, itemHeight: 8, textStyle: { color: t.texto } },
  };
}

export function eixo(t: Tinta, extra: Record<string, unknown> = {}) {
  return {
    axisLine: { lineStyle: { color: t.eixo } },
    axisTick: { show: false },
    axisLabel: { color: t.rotulo },
    splitLine: { lineStyle: { color: t.grade } },
    ...extra,
  };
}

const COR_DA_SERIE = ["bg-chart-1", "bg-chart-2", "bg-chart-3"];

/**
 * Legenda em HTML, fora do canvas: quebra linha sozinha em tela estreita, onde
 * a do ECharts passava por cima do gráfico. A ordem é a das séries.
 */
export function Legenda({ nomes }: { nomes: string[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {nomes.map((n, i) => (
        <li key={n} className="flex items-center gap-1.5">
          <span className={`h-2 w-3 shrink-0 rounded-sm ${COR_DA_SERIE[i]}`} aria-hidden />
          {n}
        </li>
      ))}
    </ul>
  );
}

type Props = {
  /** Recebe as cores do tema atual: ao trocar de tema, o gráfico é redesenhado. */
  opcao: (t: Tinta) => EChartsCoreOption;
  altura?: number;
  rotulo: string;
};

export function Grafico({ opcao, altura = 300, rotulo }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const grafico = useRef<echarts.ECharts | null>(null);
  const { tema } = useTema();

  useEffect(() => {
    if (!ref.current) return;
    const g = echarts.init(ref.current, undefined, { renderer: "canvas" });
    grafico.current = g;
    const observador = new ResizeObserver(() => g.resize());
    observador.observe(ref.current);
    return () => {
      observador.disconnect();
      g.dispose();
      grafico.current = null;
    };
  }, []);

  useEffect(() => {
    grafico.current?.setOption(opcao(lerTinta()), { notMerge: true });
  }, [opcao, tema]);

  return <div ref={ref} role="img" aria-label={rotulo} style={{ height: altura }} className="w-full" />;
}
