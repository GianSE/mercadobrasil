import { useState } from "react";
import { BarraFiltros, SeletorUF } from "../../components/Filtros";
import { Grafico, useMapaBR } from "../../components/Grafico";
import { Painel } from "../../components/Painel";
import { Titulo } from "../../components/Titulo";
import { Segmentado } from "../../components/ui/segmentado";
import { Skeleton } from "../../components/ui/skeleton";
import type { Area } from "../../lib/areas";
import { useConsulta, type LinhaSQL } from "../../lib/db";
import { UFS, useFiltro } from "../../lib/filtro";
import { fmt } from "../../lib/formato";
import { opcaoBarrasH, opcaoMapa, type Formato } from "../../lib/graficos";
import { coluna, intervalo, literal, num, rotulos } from "../../lib/sql";
import { useParametro } from "../../lib/url";

/*
 * Onde: em que estados e municípios está o emprego da área, em que setores
 * trabalham os profissionais dela, e como os municípios evoluíram. As páginas
 * 2a (setor), 2b (mapa) e 2c (trajetória) do site do TCC.
 */

const ANO_INICIAL = 2007;
const ANO_RAIS = 2025;

const METRICAS = {
  estoque: { rotulo: "Vínculos", coluna: "estoque", nome: "Vínculos ativos em 31/12", formato: fmt.inteiro, fonte: "RAIS" },
  mediana: { rotulo: "Salário", coluna: "remuneracao_sm_mediana", nome: "Remuneração mediana", formato: fmt.sm, fonte: "RAIS" },
  saldo: { rotulo: "Saldo", coluna: "saldo", nome: "Saldo de empregos no ano", formato: fmt.sinal, fonte: "CAGED" },
} as const;
type Metrica = keyof typeof METRICAS;

const lerAno = (s: string) => (/^\d{4}$/.test(s) && Number(s) >= ANO_INICIAL && Number(s) <= ANO_RAIS ? Number(s) : null);

export function Onde({ area }: { area: Area }) {
  const f = useFiltro();
  const q = (sql: string | null) => useConsulta(area.slug, area.repo, sql);
  const [ano, setAno] = useParametro<number>("ano", ANO_RAIS, lerAno, String);
  const [metrica, setMetrica] = useState<Metrica>("estoque");
  const m = METRICAS[metrica];
  const mapaPronto = useMapaBR();

  const ufs = q(`SELECT uf, ${m.coluna}::DOUBLE AS valor, estoque::DOUBLE AS estoque FROM mapa_uf WHERE ano = ${ano} AND uf IN (${UFS.map(literal).join(", ")}) ORDER BY 2 DESC NULLS LAST`);
  const municipios = q(`
    SELECT regexp_replace(municipio, '^[A-Za-z]{2}-', '') || ' (' || uf || ')' AS nome, ${m.coluna}::DOUBLE AS valor, estoque::DOUBLE AS estoque
    FROM mapa_municipio WHERE ano = ${ano} AND ${f.sql()} AND estoque > 0
    ORDER BY ${metrica === "mediana" ? "estoque" : m.coluna} DESC NULLS LAST LIMIT 15`);

  const u = ufs.tipo === "pronto" ? ufs.dados : [];
  const resposta = (() => {
    if (metrica !== "estoque" || !u.length) return undefined;
    const total = u.reduce((s, l) => s + num(l, "estoque"), 0);
    const top3 = u.slice(0, 3);
    const parte = top3.reduce((s, l) => s + num(l, "estoque"), 0) / total;
    return `Em ${ano}, ${top3.map((l) => l.uf).join(", ")} concentravam ${fmt.parte(parte)} dos vínculos de ${area.sigla} do país; ${u[0].uf} sozinho, ${fmt.parte(num(u[0], "estoque") / total)}.`;
  })();

  const tabela = (d: LinhaSQL[], chave: string, rotulo: string) => ({
    colunas: [{ chave, rotulo }, { chave: "valor", rotulo: m.nome, formato: m.formato as Formato }],
    linhas: d,
  });

  return (
    <div className="flex flex-col gap-6">
      <BarraFiltros>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Ano</span>
          <select aria-label="Ano" className="h-9 rounded-md border bg-card px-2.5 text-sm" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {intervalo(ANO_INICIAL, ANO_RAIS).reverse().map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <Segmentado<Metrica> rotulo="Mostrar" valor={metrica} opcoes={(Object.keys(METRICAS) as Metrica[]).map((k) => ({ valor: k, rotulo: METRICAS[k].rotulo }))} aoMudar={setMetrica} />
        <SeletorUF />
      </BarraFiltros>

      <section className="flex flex-col gap-4">
        <Titulo pergunta={`Em que estados está o emprego de ${area.sigla}?`} resposta={resposta} />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Painel titulo={`${m.nome} por estado · ${ano}`} descricao={`${m.fonte} · o estado de lotação da empresa`} estado={ufs} altura={420} tabela={(d) => tabela(d, "uf", "Estado")}>
            {(d) =>
              mapaPronto ? (
                <Grafico rotulo={`Mapa: ${m.nome} de ${area.nome} por estado, ${ano}`} altura={420} opcao={(t) => opcaoMapa(t, d.map((l) => ({ uf: String(l.uf), valor: l.valor === null ? null : Number(l.valor) })), { formato: m.formato, nome: m.nome })} />
              ) : (
                <Skeleton style={{ height: 420 }} />
              )
            }
          </Painel>
          <Painel titulo="Ranking dos estados" descricao={`${m.fonte} · ${ano}`} estado={ufs} altura={420} tabela={(d) => tabela(d, "uf", "Estado")}>
            {(d) => <Grafico rotulo={`Ranking dos estados em ${m.nome}, ${area.nome}`} altura={420} opcao={(t) => opcaoBarrasH(t, rotulos(d, "uf"), coluna(d, "valor"), { formato: m.formato, larguraRotulo: 40 })} />}
          </Painel>
        </div>
        <Painel
          titulo={`Municípios com mais vínculos · ${f.rotulo} · ${ano}`}
          descricao="RAIS e CAGED · o município do estabelecimento, que nem sempre é onde a pessoa trabalha: empresas escolhem a sede pelo imposto"
          estado={municipios}
          altura={420}
          tabela={(d) => ({ colunas: [{ chave: "nome", rotulo: "Município" }, { chave: "estoque", rotulo: "Vínculos", formato: fmt.inteiro }, { chave: "valor", rotulo: m.nome, formato: m.formato as Formato }], linhas: d })}
        >
          {(d) => <Grafico rotulo={`Municípios com mais vínculos de ${area.nome}`} altura={420} opcao={(t) => opcaoBarrasH(t, rotulos(d, "nome"), coluna(d, "valor"), { formato: m.formato, larguraRotulo: 200 })} />}
        </Painel>
      </section>

      <Setor area={area} ano={ano} />
      <Trajetoria area={area} />
    </div>
  );
}

// ---------------------------------------------------------------- setor
function Setor({ area, ano }: { area: Area; ano: number }) {
  const dados = useConsulta(area.slug, area.repo, `
    SELECT setor_empresa AS nome, sum(estoque_3112)::DOUBLE AS valor
    FROM rais_setor_vs_ocupacao WHERE ano = ${ano} AND ocupacao_ti AND NOT setor_ti AND setor_empresa IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12`);
  const total = useConsulta(area.slug, area.repo, `
    SELECT sum(estoque_3112) FILTER (WHERE ocupacao_ti AND NOT setor_ti)::DOUBLE AS fora, sum(estoque_3112) FILTER (WHERE ocupacao_ti)::DOUBLE AS prof
    FROM rais_setor_vs_ocupacao WHERE ano = ${ano}`);
  const t = total.tipo === "pronto" ? total.dados[0] : undefined;
  const d = dados.tipo === "pronto" ? dados.dados : [];
  const resposta =
    t && num(t, "prof") && d.length
      ? `Em ${ano}, ${fmt.parte(num(t, "fora") / num(t, "prof"))} dos profissionais de ${area.sigla} trabalhavam fora do setor da área; o maior empregador fora dele era ${String(d[0].nome).toLowerCase()} (${fmt.compacto(num(d[0], "valor"))} vínculos).`
      : undefined;
  return (
    <section className="flex flex-col gap-4">
      <Titulo pergunta={`Onde trabalham os profissionais de ${area.sigla} fora do setor?`} resposta={resposta} />
      <Painel titulo={`Setores que mais empregam profissionais de ${area.sigla} · ${ano}`} descricao="RAIS · atividade (CNAE) da empresa, só os vínculos de quem exerce ocupação da área fora do setor dela · Brasil" estado={dados} altura={440}
        tabela={(x) => ({ colunas: [{ chave: "nome", rotulo: "Setor" }, { chave: "valor", rotulo: "Vínculos", formato: fmt.inteiro }], linhas: x })}>
        {(x) => <Grafico rotulo={`Setores que mais empregam profissionais de ${area.nome} fora do setor`} altura={440} opcao={(tinta) => opcaoBarrasH(tinta, rotulos(x, "nome"), coluna(x, "valor"), { formato: fmt.compacto, larguraRotulo: 280 })} />}
      </Painel>
    </section>
  );
}

// ------------------------------------------------------------ trajetória
function Trajetoria({ area }: { area: Area }) {
  const grupos = useConsulta(area.slug, area.repo, `
    SELECT nome, count(*)::DOUBLE AS municipios, sum(estoque)::DOUBLE AS estoque, median(crescimento) AS crescimento, median(remuneracao_sm_mediana) AS mediana
    FROM municipios_cluster WHERE nome IS NOT NULL GROUP BY 1 ORDER BY 3 DESC`);
  return (
    <section className="flex flex-col gap-4">
      <Titulo pergunta="Que trajetória os municípios seguem?" resposta="Os municípios agrupados por tamanho, especialização, crescimento, giro e salário do mercado da área: cada grupo junta lugares que se parecem nessas cinco medidas." />
      <Painel titulo="Grupos de municípios" descricao="RAIS e CAGED · agrupamento k-means dos municípios com mercado da área" estado={grupos} altura={300}
        tabela={(x) => ({
          colunas: [
            { chave: "nome", rotulo: "Grupo" },
            { chave: "municipios", rotulo: "Municípios", formato: fmt.inteiro },
            { chave: "estoque", rotulo: "Vínculos", formato: fmt.inteiro },
            { chave: "crescimento", rotulo: "Crescimento mediano", formato: (v) => fmt.variacao(v / 100) },
            { chave: "mediana", rotulo: "Salário mediano", formato: fmt.sm },
          ],
          linhas: x,
        })}>
        {(x) => <Grafico rotulo="Vínculos por grupo de municípios" altura={300} opcao={(t) => opcaoBarrasH(t, rotulos(x, "nome"), coluna(x, "estoque"), { formato: fmt.compacto, larguraRotulo: 200 })} />}
      </Painel>
    </section>
  );
}
