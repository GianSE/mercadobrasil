import { useMemo, useState } from "react";
import { BarraFiltros, FiltroPeriodo, SeletorUF } from "../../components/Filtros";
import { Grafico } from "../../components/Grafico";
import { Painel } from "../../components/Painel";
import { Titulo } from "../../components/Titulo";
import { Segmentado } from "../../components/ui/segmentado";
import { Skeleton } from "../../components/ui/skeleton";
import type { Area } from "../../lib/areas";
import { useConsulta, type LinhaSQL } from "../../lib/db";
import { useFiltro } from "../../lib/filtro";
import { fmt } from "../../lib/formato";
import { opcaoBarrasH, opcaoLinhas } from "../../lib/graficos";
import { useAnoRais } from "../../lib/rais";
import { coluna, entre, medianaExata, medianaHist, num, ponderada, RECORTE, rotulos, tabelaRais, type Periodo } from "../../lib/sql";
import { escreverPeriodo, lerPeriodo, useParametro } from "../../lib/url";

/*
 * Trabalho: quanto se ganha, quem é contratado e quanto tempo se fica. As
 * páginas 3a (salário), 3b (permanência) e 4a (perfil) do site do TCC.
 */

const ANO_INICIAL = 2007;

// Escolaridade em ordem de nível, não de valor.
const ESCOLARIDADES = ["Analfabeto", "Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo", "Superior incompleto", "Superior completo", "Pós-graduação", "Mestrado", "Doutorado"];
const FAIXAS = ["0-6m", "6-12m", "1-2a", "2-3a", "3-5a", "5-10a", "10-20a"];
const ROTULO_FAIXA: Record<string, string> = { "0-6m": "0–6 meses", "6-12m": "6–12 meses", "1-2a": "1–2 anos", "2-3a": "2–3 anos", "3-5a": "3–5 anos", "5-10a": "5–10 anos", "10-20a": "10–20 anos" };

// A remuneração pode ser lida em salários mínimos (compara anos entre si) ou
// em reais da época (o valor do contracheque, sem correção).
type Unidade = "sm" | "reais";

/** Espera o último ano da RAIS: o período começa nele, e o padrão é lido uma vez só. */
export function Trabalho({ area }: { area: Area }) {
  const anoRais = useAnoRais(area);
  return anoRais === undefined ? <Skeleton className="h-96" /> : <ConteudoTrabalho area={area} anoRais={anoRais} />;
}

function ConteudoTrabalho({ area, anoRais }: { area: Area; anoRais: number }) {
  const f = useFiltro();
  const q = (sql: string | null) => useConsulta(area.slug, area.repo, sql);
  const [periodo, setPeriodo] = useParametro<Periodo>("periodo", [ANO_INICIAL, anoRais], lerPeriodo, escreverPeriodo);
  const [unidade, setUnidade] = useState<Unidade>("sm");
  const fimRais = Math.min(periodo[1], anoRais);
  const pRais: Periodo = [periodo[0], fimRais];
  const onde = f.ativo ? ` em ${f.rotulo}` : "";

  // A média vem dos grupos (média ponderada pelo tamanho é a média do
  // conjunto); a mediana não se soma: vem exata, ou do histograma no recorte.
  const anual = q(`
    SELECT a.ano, a.media, m.mediana, a.estoque, a.desligados
    FROM (SELECT ano, ${ponderada("remuneracao_sm")} AS media, sum(estoque_3112)::DOUBLE AS estoque, sum(desligados_no_ano)::DOUBLE AS desligados
          FROM ${tabelaRais(f.ativo)} WHERE ${RECORTE} AND ${entre(pRais)} AND ${f.sql()} GROUP BY 1) a
    LEFT JOIN (${f.ativo ? medianaHist(`${entre(pRais)} AND ${f.sql()}`) : `SELECT ano AS g, mediana FROM (${medianaExata("total")})`}) m ON m.g = a.ano
    ORDER BY 1`);
  // O salário mínimo de cada ano sai do próprio dado: a RAIS traz a
  // remuneração em reais e em SM, e a razão entre as duas é o mínimo vigente.
  const salarioMinimo = q(`
    SELECT ano, sum(remuneracao_nominal * estoque_3112) / nullif(sum(remuneracao_sm * estoque_3112), 0) AS sm
    FROM rais_estoque_anual WHERE remuneracao_sm > 0 GROUP BY 1`);
  const subareas = q(`SELECT grupo AS nome, mediana_sm AS valor FROM rais_mediana WHERE recorte = 'area' AND ano = ${fimRais} AND grupo <> ${`'${area.rotulos.nao_area.replace(/'/g, "''")}'`} ORDER BY 2 DESC`);
  const escolaridade = q(`SELECT grupo AS nome, mediana_sm AS valor FROM rais_mediana WHERE recorte = 'escolaridade' AND ano = ${fimRais}`);

  const smDoAno = useMemo(
    () => new Map((salarioMinimo.tipo === "pronto" ? salarioMinimo.dados : []).map((l) => [num(l, "ano"), num(l, "sm")])),
    [salarioMinimo],
  );
  const reais = unidade === "reais";
  const conv = (ano: number, v: unknown) => (v === null || v === undefined ? null : reais ? Number(v) * (smDoAno.get(ano) ?? NaN) : Number(v));
  const fmtValor = reais ? (v: number) => `R$ ${fmt.inteiro(v)}` : fmt.sm;
  const fmtEixo = reais ? fmt.compacto : (v: number) => v.toFixed(1).replace(".", ",");
  const emUnidade = (linhas: LinhaSQL[], ano = fimRais) => linhas.map((l) => ({ ...l, valor: conv(ano, l.valor) }));

  const a = anual.tipo === "pronto" ? anual.dados : [];
  const resposta = (() => {
    const com = a.filter((l) => l.mediana !== null);
    if (com.length < 2) return undefined;
    const [p0, p1] = [com[0], com.at(-1)!];
    const v = num(p1, "mediana") / num(p0, "mediana") - 1;
    const movimento = Math.abs(v) < 0.05 ? "ficou praticamente estável" : v > 0 ? `subiu ${fmt.parte(v)}` : `caiu ${fmt.parte(-v)}`;
    return `A remuneração mediana de ${area.sigla}${onde} ${movimento} em salários mínimos entre ${num(p0, "ano")} e ${num(p1, "ano")} (de ${fmt.sm(num(p0, "mediana"))} para ${fmt.sm(num(p1, "mediana"))}).`;
  })();

  return (
    <div className="flex flex-col gap-6">
      <BarraFiltros>
        <FiltroPeriodo valor={periodo} aoMudar={setPeriodo} min={ANO_INICIAL} max={anoRais} />
        <SeletorUF />
        <Segmentado<Unidade> rotulo="Salário em" valor={unidade} opcoes={[{ valor: "sm", rotulo: "Salários mínimos" }, { valor: "reais", rotulo: "Reais da época" }]} aoMudar={setUnidade} />
      </BarraFiltros>

      <section className="flex flex-col gap-4">
        <Titulo pergunta={`Quanto se ganha em ${area.sigla}?`} resposta={resposta} />
        <Painel
          titulo={`Mediana e média da remuneração · ${f.rotulo}`}
          descricao={reais ? "RAIS · remuneração bruta em reais de cada ano, sem correção pela inflação: para comparar anos, use salários mínimos" : `RAIS · em salários mínimos${f.ativo ? " · mediana pelas faixas de 0,1 SM" : ""}`}
          estado={anual}
          altura={300}
          tabela={(d) => ({
            colunas: [{ chave: "ano", rotulo: "Ano" }, { chave: "mediana", rotulo: "Mediana", formato: fmtValor }, { chave: "media", rotulo: "Média", formato: fmtValor }],
            linhas: d.map((l) => ({ ...l, mediana: conv(num(l, "ano"), l.mediana), media: conv(num(l, "ano"), l.media) })),
          })}
        >
          {(d) => (
            <Grafico
              rotulo={`Mediana e média da remuneração de ${area.nome}`}
              altura={300}
              opcao={(t) =>
                opcaoLinhas(
                  t,
                  rotulos(d, "ano"),
                  [
                    { nome: "Mediana", dados: d.map((l) => conv(num(l, "ano"), l.mediana)) },
                    { nome: "Média", dados: d.map((l) => conv(num(l, "ano"), l.media)) },
                  ],
                  { formato: fmtValor, formatoEixo: fmtEixo, zero: true, rotuloFinal: true, altura: 300 },
                )
              }
            />
          )}
        </Painel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Painel titulo="Por subárea" descricao={`RAIS · mediana, ${fimRais} · Brasil`} estado={subareas} altura={280}
            tabela={(d) => ({ colunas: [{ chave: "nome", rotulo: "Subárea" }, { chave: "valor", rotulo: "Mediana", formato: fmtValor }], linhas: emUnidade(d) })}>
            {(d) => <Grafico rotulo={`Remuneração mediana por subárea de ${area.nome}`} altura={280} opcao={(t) => opcaoBarrasH(t, rotulos(d, "nome"), coluna(emUnidade(d), "valor"), { formato: fmtValor })} />}
          </Painel>
          <Painel titulo="Por escolaridade" descricao={`RAIS · mediana, ${fimRais} · Brasil`} estado={escolaridade} altura={280}
            tabela={(d) => ({ colunas: [{ chave: "nome", rotulo: "Escolaridade" }, { chave: "valor", rotulo: "Mediana", formato: fmtValor }], linhas: ordenarEscolaridade(emUnidade(d)) })}>
            {(d) => {
              const o = ordenarEscolaridade(emUnidade(d));
              return <Grafico rotulo={`Remuneração mediana por escolaridade em ${area.nome}`} altura={280} opcao={(t) => opcaoBarrasH(t, rotulos(o, "nome"), coluna(o, "valor"), { formato: fmtValor })} />;
            }}
          </Painel>
        </div>
      </section>

      <Perfil area={area} periodo={periodo} anoRais={anoRais} />
      <Permanencia area={area} anual={anual} />
    </div>
  );
}

function ordenarEscolaridade<T extends LinhaSQL>(linhas: T[]): T[] {
  const pos = (n: unknown) => {
    const i = ESCOLARIDADES.indexOf(String(n));
    return i < 0 ? 99 : i;
  };
  return [...linhas].sort((a, b) => pos(a.nome) - pos(b.nome));
}

// ------------------------------------------------------------- perfil
const perfilSql = (dim: string, p: Periodo, territorio: string) => `
  SELECT ${dim} AS nome, sum(admissoes)::DOUBLE AS admissoes
  FROM caged_cubo WHERE ${entre(p)} AND ${territorio} AND ${dim} IS NOT NULL AND ${dim} <> 'Não informado'
  GROUP BY 1 ORDER BY 2 DESC`;

function Perfil({ area, periodo, anoRais }: { area: Area; periodo: Periodo; anoRais: number }) {
  const f = useFiltro();
  const q = (sql: string | null) => useConsulta(area.slug, area.repo, sql);
  const sexo = q(perfilSql("sexo", periodo, f.sql()));
  const raca = q(perfilSql("raca_cor", periodo, f.sql()));
  const feminina = q(`
    SELECT ano, sum(estoque_3112) FILTER (WHERE sexo = 'Mulher') / sum(estoque_3112) FILTER (WHERE sexo IN ('Homem', 'Mulher')) AS mulheres
    FROM rais_estoque_perfil WHERE ${RECORTE} AND ${entre([periodo[0], Math.min(periodo[1], anoRais)])} GROUP BY 1 ORDER BY 1`);
  const parte = (d: LinhaSQL[]) => {
    const total = d.reduce((s, l) => s + num(l, "admissoes"), 0);
    return d.map((l) => ({ ...l, parte: total ? num(l, "admissoes") / total : null }));
  };
  const fem = feminina.tipo === "pronto" ? feminina.dados.filter((l) => l.mulheres !== null) : [];
  const resposta =
    fem.length > 1
      ? `As mulheres eram ${fmt.parte(num(fem[0], "mulheres"))} dos vínculos de ${area.sigla} em ${num(fem[0], "ano")} e ${fmt.parte(num(fem.at(-1), "mulheres"))} em ${num(fem.at(-1), "ano")}.`
      : undefined;

  const barras = (d: LinhaSQL[], rotulo: string) => {
    const p = parte(d);
    return <Grafico rotulo={rotulo} altura={240} opcao={(t) => opcaoBarrasH(t, rotulos(p, "nome"), coluna(p, "parte"), { formato: fmt.parte, larguraRotulo: 120 })} />;
  };
  const tabela = (d: LinhaSQL[]) => ({
    colunas: [{ chave: "nome", rotulo: "Grupo" }, { chave: "admissoes", rotulo: "Admissões", formato: fmt.inteiro }, { chave: "parte", rotulo: "Parte", formato: fmt.parte }],
    linhas: parte(d),
  });

  return (
    <section className="flex flex-col gap-4">
      <Titulo pergunta={`Quem trabalha em ${area.sigla}?`} resposta={resposta} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo={`Admissões por sexo · ${f.rotulo}`} descricao={`CAGED · ${periodo[0]}–${periodo[1]}`} estado={sexo} altura={240} tabela={tabela}>
          {(d) => barras(d, `Admissões em ${area.nome} por sexo`)}
        </Painel>
        <Painel titulo={`Admissões por raça/cor · ${f.rotulo}`} descricao={`CAGED · ${periodo[0]}–${periodo[1]}`} estado={raca} altura={240} tabela={tabela}>
          {(d) => barras(d, `Admissões em ${area.nome} por raça/cor`)}
        </Painel>
      </div>
      <Painel titulo="Participação feminina no estoque" descricao={`RAIS · parte de mulheres entre os vínculos de ${area.sigla} ativos em 31/12 · Brasil`} estado={feminina} altura={260}
        tabela={(d) => ({ colunas: [{ chave: "ano", rotulo: "Ano" }, { chave: "mulheres", rotulo: "Mulheres", formato: fmt.parte }], linhas: d })}>
        {(d) => <Grafico rotulo={`Participação feminina em ${area.nome}`} altura={260} opcao={(t) => opcaoLinhas(t, rotulos(d, "ano"), [{ nome: "Mulheres no estoque", dados: coluna(d, "mulheres") }], { formato: fmt.parte, formatoEixo: (v) => fmt.parte(v), altura: 260 })} />}
      </Painel>
    </section>
  );
}

// -------------------------------------------------------- permanência
function Permanencia({ area, anual }: { area: Area; anual: ReturnType<typeof useConsulta> }) {
  const f = useFiltro();
  const q = (sql: string | null) => useConsulta(area.slug, area.repo, sql);
  const risco = q(`SELECT tempo_de_casa, "risco_%" / 100 AS risco, vinculos::DOUBLE AS vinculos, ano FROM sobrevivencia_risco`);
  const tabua = q(`SELECT * EXCLUDE (ano) FROM sobrevivencia_tabua WHERE recorte = 'todos'`);
  const giro =
    anual.tipo === "pronto"
      ? { ...anual, dados: anual.dados.map((l) => ({ ano: l.ano, giro: num(l, "desligados") / num(l, "estoque"), desligados: l.desligados, estoque: l.estoque })) }
      : anual;
  const ordenado = (d: LinhaSQL[]) => FAIXAS.map((fx) => d.find((l) => l.tempo_de_casa === fx)).filter((l): l is LinhaSQL => !!l);
  const r = risco.tipo === "pronto" ? ordenado(risco.dados) : [];
  const pico = r.length ? r.reduce((m, l) => (num(l, "risco") > num(m, "risco") ? l : m)) : null;
  const resposta = pico ? `O risco de perder o emprego no ano é maior com ${ROTULO_FAIXA[String(pico.tempo_de_casa)]} de casa (${fmt.parte(num(pico, "risco"))}) e cai a partir daí.` : undefined;
  const ano = r.length ? num(r[0], "ano") : "";

  return (
    <section className="flex flex-col gap-4">
      <Titulo pergunta="Quanto tempo as pessoas ficam?" resposta={resposta} />
      <Painel titulo={`Giro do mercado · ${f.rotulo}`} descricao="RAIS · vínculos encerrados no ano em proporção ao estoque" estado={giro as typeof anual} altura={260}
        tabela={(d) => ({ colunas: [{ chave: "ano", rotulo: "Ano" }, { chave: "desligados", rotulo: "Desligados", formato: fmt.inteiro }, { chave: "estoque", rotulo: "Estoque", formato: fmt.inteiro }, { chave: "giro", rotulo: "Giro", formato: fmt.parte }], linhas: d })}>
        {(d) => <Grafico rotulo={`Giro do mercado de ${area.nome}`} altura={260} opcao={(t) => opcaoLinhas(t, rotulos(d, "ano"), [{ nome: "Giro", dados: coluna(d, "giro") }], { formato: fmt.parte, formatoEixo: (v) => fmt.parte(v), altura: 260 })} />}
      </Painel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Risco anual de desligamento" descricao={`RAIS ${ano} · por tempo de casa · Brasil`} estado={risco} altura={280}
          tabela={(d) => ({ colunas: [{ chave: "faixa", rotulo: "Tempo de casa" }, { chave: "risco", rotulo: "Risco anual", formato: fmt.parte }, { chave: "vinculos", rotulo: "Vínculos", formato: fmt.inteiro }], linhas: ordenado(d).map((l) => ({ ...l, faixa: ROTULO_FAIXA[String(l.tempo_de_casa)] })) })}>
          {(d) => {
            const o = ordenado(d);
            return <Grafico rotulo={`Risco anual de desligamento em ${area.nome}`} altura={280} opcao={(t) => opcaoBarrasH(t, o.map((l) => ROTULO_FAIXA[String(l.tempo_de_casa)]), coluna(o, "risco"), { formato: fmt.parte, larguraRotulo: 90 })} />;
          }}
        </Painel>
        <Painel titulo="Sobrevivência acumulada do vínculo" descricao={`RAIS ${ano} · parte que continua no emprego ao fim de cada faixa · Brasil`} estado={tabua} altura={280}
          tabela={(d) => ({ colunas: [{ chave: "faixa", rotulo: "Tempo de casa" }, { chave: "valor", rotulo: "Ainda no emprego", formato: fmt.parte }], linhas: FAIXAS.map((fx) => ({ faixa: ROTULO_FAIXA[fx], valor: d[0] ? num(d[0], fx) / 100 : null })) })}>
          {(d) => (
            <Grafico
              rotulo={`Sobrevivência acumulada do vínculo em ${area.nome}`}
              altura={280}
              opcao={(t) => opcaoLinhas(t, FAIXAS.map((fx) => ROTULO_FAIXA[fx]), [{ nome: "Ainda no emprego", dados: FAIXAS.map((fx) => (d[0] ? num(d[0], fx) / 100 : null)), area: true }], { formato: fmt.parte, formatoEixo: (v) => fmt.parte(v), zero: true, altura: 280 })}
            />
          )}
        </Painel>
      </div>
    </section>
  );
}
