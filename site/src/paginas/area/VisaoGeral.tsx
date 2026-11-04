import { base, eixo, Grafico, Legenda } from "../../components/Grafico";
import { Indicador } from "../../components/Indicador";
import { Painel } from "../../components/Painel";
import { AneisRecorte } from "../../components/Recorte";
import type { Area as TipoArea } from "../../lib/areas";
import { useTabela, type Linha } from "../../lib/dados";
import { fmt } from "../../lib/formato";
import { estoqueAnual, LENTES, resumir, rotuloLente } from "../../lib/rais";

/** Visão geral da área: os números do último ano, sem filtro e sem o DuckDB. */
export function VisaoGeral({ area }: { area: TipoArea }) {
  const anual = useTabela(area.repo, "rais_estoque_anual", estoqueAnual);
  const resumo = anual.tipo === "pronto" ? resumir(anual.dados) : null;
  const mediana = useTabela(area.repo, "rais_mediana", medianaTotal);
  const estab = useTabela(area.repo, "rais_estabelecimentos", estabelecimentosDoSetor);
  const subareas = useTabela(area.repo, "rais_estoque_area", (l) => porSubarea(l, area));
  const ufs = useTabela(area.repo, "rais_estoque_uf", porUF);
  const mensal = useTabela(area.repo, "serie_mensal", saldoMensal);

  return (
    <>
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Indicador
        titulo={resumo ? `Vínculos ativos em 31/12/${resumo.ano}` : "Vínculos ativos"}
        valor={anual.tipo === "carregando" ? undefined : resumo ? fmt.inteiro(resumo.estoque) : "—"}
        variacao={resumo?.variacao}
      />
      <Indicador
        titulo="Fora do setor da área"
        valor={anual.tipo === "carregando" ? undefined : resumo ? fmt.parte(resumo.foraDoSetor) : "—"}
        nota={`dos profissionais de ${area.sigla} trabalham em outro setor`}
      />
      <Indicador
        titulo="Remuneração mediana"
        valor={
          mediana.tipo === "pronto" && mediana.dados
            ? fmt.sm(mediana.dados)
            : mediana.tipo === "carregando"
              ? undefined
              : "—"
        }
        nota="em salários mínimos, vínculos ativos"
      />
      <Indicador
        titulo="Estabelecimentos do setor"
        valor={
          estab.tipo === "pronto" && estab.dados
            ? fmt.inteiro(estab.dados)
            : estab.tipo === "carregando"
              ? undefined
              : "—"
        }
        nota="com ao menos um empregado no ano"
      />
    </section>

    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <Painel
          titulo="Vínculos ativos ano a ano, por lente"
          descricao="Estoque em 31 de dezembro. Quem exerce ocupação da área, dentro e fora do setor dela, e quem trabalha no setor em outra ocupação."
          estado={anual}
          altura={320}
        >
          {(e) => (
            <>
              <Legenda nomes={LENTES.map((k) => rotuloLente(area, k))} />
              <Grafico
                rotulo={`Vínculos ativos por lente, ${e.anos[0]} a ${e.anos.at(-1)}`}
                altura={320}
                opcao={(t) => ({
                  ...base(t),
                  legend: { show: false },
                  grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
                  tooltip: {
                    ...(base(t).tooltip as object),
                    trigger: "axis",
                    valueFormatter: (v: number) => fmt.inteiro(v),
                  },
                  xAxis: eixo(t, { type: "category", data: e.anos, boundaryGap: false, splitLine: { show: false } }),
                  yAxis: eixo(t, {
                    type: "value",
                    axisLabel: { color: t.rotulo, formatter: (v: number) => fmt.compacto(v) },
                  }),
                  series: LENTES.map((k) => ({
                    name: rotuloLente(area, k),
                    type: "line",
                    stack: "total",
                    data: e.porLente[k],
                    showSymbol: false,
                    lineStyle: { width: 2 },
                    areaStyle: { opacity: 0.18 },
                  })),
                })}
              />
            </>
          )}
        </Painel>
      </div>

      <Painel
        titulo="Subáreas"
        descricao={`Vínculos ativos de quem exerce ocupação de ${area.sigla}, último ano.`}
        estado={subareas}
        altura={300}
      >
        {(d) => <BarrasHorizontais itens={d} rotulo={`Vínculos ativos por subárea de ${area.nome}`} />}
      </Painel>

      <Painel
        titulo="Estados com mais vínculos"
        descricao="Os dez maiores, último ano, todas as lentes."
        estado={ufs}
        altura={300}
      >
        {(d) => <BarrasHorizontais itens={d.slice(0, 10)} rotulo={`Dez estados com mais vínculos de ${area.nome}`} />}
      </Painel>

      <div className="lg:col-span-2">
        <Painel
          titulo="Saldo mensal de empregos (CAGED)"
          descricao="Admissões menos desligamentos, mês a mês."
          estado={mensal}
          altura={280}
        >
          {(d) => (
            <Grafico
              rotulo="Saldo mensal de empregos no CAGED"
              altura={280}
              opcao={(t) => ({
                ...base(t),
                legend: { show: false },
                grid: { left: 8, right: 28, top: 16, bottom: 8, containLabel: true },
                tooltip: {
                  ...(base(t).tooltip as object),
                  trigger: "axis",
                  formatter: (p: { dataIndex: number }[]) => {
                    const m = d[p[0].dataIndex];
                    return `<b>${m.rotulo}</b><br/>Saldo: ${fmt.inteiro(m.saldo)}<br/>Admissões: ${fmt.inteiro(m.admissoes)}<br/>Desligamentos: ${fmt.inteiro(m.desligamentos)}`;
                  },
                },
                xAxis: eixo(t, {
                  type: "category",
                  data: d.map((m) => m.rotulo),
                  splitLine: { show: false },
                  axisLabel: { color: t.rotulo, hideOverlap: true },
                }),
                yAxis: eixo(t, {
                  type: "value",
                  axisLabel: { color: t.rotulo, formatter: (v: number) => fmt.compacto(v) },
                }),
                series: [
                  {
                    name: "Saldo",
                    type: "bar",
                    data: d.map((m) => ({
                      value: m.saldo,
                      itemStyle: { color: m.saldo >= 0 ? t.series[0] : t.series[1] },
                    })),
                    barCategoryGap: "20%",
                  },
                ],
              })}
            />
          )}
        </Painel>
      </div>
    </section>

      <div className="mt-8">
        <AneisRecorte area={area} />
      </div>
    </>
  );
}

type Item = { nome: string; valor: number };

function BarrasHorizontais({ itens, rotulo }: { itens: Item[]; rotulo: string }) {
  const ordem = [...itens].reverse(); // o ECharts desenha de baixo para cima
  return (
    <Grafico
      rotulo={rotulo}
      altura={300}
      opcao={(t) => ({
        ...base(t),
        legend: { show: false },
        grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
        tooltip: { ...(base(t).tooltip as object), trigger: "item", valueFormatter: (v: number) => fmt.inteiro(v) },
        xAxis: eixo(t, { type: "value", axisLabel: { show: false }, splitLine: { show: false } }),
        yAxis: eixo(t, { type: "category", data: ordem.map((i) => i.nome), axisLine: { show: false } }),
        series: [
          {
            type: "bar",
            data: ordem.map((i) => i.valor),
            itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] },
            barMaxWidth: 22,
            label: {
              show: true,
              position: "right",
              color: t.rotulo,
              formatter: (p: { value: number }) => fmt.compacto(p.value),
            },
          },
        ],
      })}
    />
  );
}

function ultimoAno(linhas: Linha[]): number {
  return Math.max(...linhas.map((l) => l.ano as number));
}

function medianaTotal(linhas: Linha[]): number | null {
  const total = linhas.filter((l) => l.recorte === "total");
  if (!total.length) return null;
  const ano = ultimoAno(total);
  return (total.find((l) => l.ano === ano)?.mediana_sm as number) ?? null;
}

function estabelecimentosDoSetor(linhas: Linha[]): number | null {
  if (!linhas.length) return null;
  const ano = ultimoAno(linhas);
  // "ZERO" é o porte de quem não tem empregado no ano: conta como empresa, não como empregador.
  return linhas
    .filter((l) => l.ano === ano && l.setor_ti && l.porte !== "ZERO")
    .reduce((s, l) => s + ((l.estabelecimentos as number) ?? 0), 0);
}

function somarPor(linhas: Linha[], chave: string, valor: string): Item[] {
  const soma = new Map<string, number>();
  for (const l of linhas)
    soma.set(l[chave] as string, (soma.get(l[chave] as string) ?? 0) + ((l[valor] as number) ?? 0));
  return [...soma].map(([nome, v]) => ({ nome, valor: v })).sort((a, b) => b.valor - a.valor);
}

function porSubarea(linhas: Linha[], area: TipoArea): Item[] {
  const ano = ultimoAno(linhas);
  return somarPor(
    linhas.filter((l) => l.ano === ano && l.area_ti !== area.rotulos.nao_area),
    "area_ti",
    "estoque_3112",
  );
}

function porUF(linhas: Linha[]): Item[] {
  const ano = ultimoAno(linhas);
  return somarPor(
    linhas.filter((l) => l.ano === ano),
    "uf",
    "estoque_3112",
  );
}

type Mes = { rotulo: string; saldo: number; admissoes: number; desligamentos: number };

function saldoMensal(linhas: Linha[]): Mes[] {
  return linhas
    .map((l) => ({ data: new Date(l.mes as string | number | Date), l }))
    .sort((a, b) => a.data.getTime() - b.data.getTime())
    .map(({ data, l }) => ({
      rotulo: data.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }),
      saldo: l.saldo as number,
      admissoes: l.admissoes as number,
      desligamentos: l.desligamentos as number,
    }));
}
