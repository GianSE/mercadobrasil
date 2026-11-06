import { ChevronRight, MapPin, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Busca, type OpcaoBusca } from "../../components/Busca";
import { BarraFiltros, SeletorUF } from "../../components/Filtros";
import { Grafico } from "../../components/Grafico";
import { MapaOSM, type Municipio } from "../../components/MapaOSM";
import { Painel } from "../../components/Painel";
import { Titulo } from "../../components/Titulo";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Segmentado } from "../../components/ui/segmentado";
import { Skeleton } from "../../components/ui/skeleton";
import type { Area } from "../../lib/areas";
import { useConsulta, type LinhaSQL } from "../../lib/db";
import { NOMES_UF, UFS, useFiltro } from "../../lib/filtro";
import { fmt } from "../../lib/formato";
import { opcaoBarrasH, opcaoLinhas, type Formato } from "../../lib/graficos";
import { useAnoRais } from "../../lib/rais";
import { coluna, intervalo, literal, num, rotulos } from "../../lib/sql";
import { useParametro } from "../../lib/url";

/*
 * Onde: em que estados e municípios está o emprego da área, em que setores
 * trabalham os profissionais dela, e como os municípios evoluíram.
 *
 * Do Brasil ao município, por cliques: o mapa (OpenStreetMap) mostra os
 * estados; clicar num estado (no mapa, no ranking ou na busca) marca só ele no
 * filtro de território — que vale para a área inteira — e o mapa desce aos
 * municípios dele. Clicar num município crava um pino e abre a ficha dele.
 * O município escolhido mora no endereço (?mun=), como o estado (?uf=).
 */

const ANO_INICIAL = 2007;

const METRICAS = {
  estoque: { rotulo: "Vínculos", coluna: "estoque", nome: "Vínculos ativos em 31/12", formato: fmt.inteiro, fonte: "RAIS" },
  mediana: { rotulo: "Salário", coluna: "remuneracao_sm_mediana", nome: "Remuneração mediana", formato: fmt.sm, fonte: "RAIS" },
  saldo: { rotulo: "Saldo", coluna: "saldo", nome: "Saldo de empregos no ano", formato: fmt.sinal, fonte: "CAGED" },
} as const;
type Metrica = keyof typeof METRICAS;

/** Espera o último ano da RAIS: o filtro de ano começa nele, e o padrão é lido uma vez só. */
export function Onde({ area }: { area: Area }) {
  const anoRais = useAnoRais(area);
  return anoRais === undefined ? <Skeleton className="h-96" /> : <ConteudoOnde area={area} anoRais={anoRais} />;
}

function ConteudoOnde({ area, anoRais }: { area: Area; anoRais: number }) {
  const f = useFiltro();
  const q = (sql: string | null) => useConsulta(area.slug, area.repo, sql);
  const lerAno = (s: string) => (/^\d{4}$/.test(s) && Number(s) >= ANO_INICIAL && Number(s) <= anoRais ? Number(s) : null);
  const [ano, setAno] = useParametro<number>("ano", anoRais, lerAno, String);
  const [mun, setMun] = useParametro<string>("mun", "", (s) => (/^\d{6}$/.test(s) ? s : null), String);
  const [metrica, setMetrica] = useState<Metrica>("estoque");
  const [buscando, setBuscando] = useState(false);
  const m = METRICAS[metrica];
  // Um estado só no filtro: o mapa desce aos municípios dele.
  const foco = f.ufs.length === 1 ? f.ufs[0] : null;

  const ufs = q(`SELECT uf, ${m.coluna}::DOUBLE AS valor, estoque::DOUBLE AS estoque FROM mapa_uf WHERE ano = ${ano} AND uf IN (${UFS.map(literal).join(", ")}) ORDER BY 2 DESC NULLS LAST`);
  // O nome com acento e as coordenadas vêm de geo_municipios (IBGE).
  const doEstado = q(
    foco
      ? `SELECT m.cod_municipio AS cod, coalesce(g.nome, m.municipio) AS nome, m.uf, g.latitude AS lat, g.longitude AS lon, g.populacao::DOUBLE AS populacao,
                m.${m.coluna}::DOUBLE AS valor, m.estoque::DOUBLE AS estoque, m.remuneracao_sm_mediana AS mediana, m.saldo::DOUBLE AS saldo,
                m.admissoes::DOUBLE AS admissoes, m.desligamentos::DOUBLE AS desligamentos
         FROM mapa_municipio m LEFT JOIN geo_municipios g ON g.cod6 = m.cod_municipio
         WHERE m.ano = ${ano} AND m.uf = ${literal(foco)} AND m.estoque > 0 ORDER BY m.estoque DESC`
      : null,
  );
  const maiores = q(
    foco
      ? null
      : `SELECT m.cod_municipio AS cod, coalesce(g.nome, m.municipio) || ' (' || m.uf || ')' AS nome, m.uf, m.${m.coluna}::DOUBLE AS valor, m.estoque::DOUBLE AS estoque
         FROM mapa_municipio m LEFT JOIN geo_municipios g ON g.cod6 = m.cod_municipio
         WHERE m.ano = ${ano} AND ${f.sql("m.uf")} AND m.estoque > 0
         ORDER BY ${metrica === "mediana" ? "m.estoque" : `m.${m.coluna}`} DESC NULLS LAST LIMIT 15`,
  );
  // Todos os municípios com vínculo no ano, para a busca: só quando alguém foca o campo.
  const todos = q(
    buscando
      ? `SELECT m.cod_municipio AS cod, coalesce(g.nome, m.municipio) AS nome, m.uf FROM mapa_municipio m LEFT JOIN geo_municipios g ON g.cod6 = m.cod_municipio
         WHERE m.ano = ${ano} AND m.estoque > 0 ORDER BY m.estoque DESC`
      : null,
  );
  // Até o último ano da RAIS: depois dele o mapa só tem o fluxo do CAGED, e o estoque viria zero.
  const historico = q(mun ? `SELECT ano, estoque::DOUBLE AS estoque FROM mapa_municipio WHERE cod_municipio = ${literal(mun)} AND ano <= ${anoRais} ORDER BY ano` : null);

  const linhasEstado = doEstado.tipo === "pronto" ? doEstado.dados : [];
  const municipios = useMemo<Municipio[] | null>(
    () =>
      foco && doEstado.tipo === "pronto"
        ? doEstado.dados
            .filter((l) => l.lat !== null && l.lon !== null)
            .map((l) => ({ cod: String(l.cod), nome: String(l.nome), uf: String(l.uf), lat: num(l, "lat"), lon: num(l, "lon"), valor: l.valor === null ? null : num(l, "valor"), estoque: num(l, "estoque") }))
        : null,
    [foco, doEstado],
  );
  const escolhido = linhasEstado.find((l) => l.cod === mun);

  const escolherUF = useCallback((uf: string) => {
    setMun("");
    f.definir(f.ufs.length === 1 && f.ufs[0] === uf ? [] : [uf]);
  }, [f, setMun]);
  const escolherMunicipio = useCallback((cod: string, uf?: string) => {
    if (uf && foco !== uf) f.definir([uf]);
    setMun(cod);
  }, [f, foco, setMun]);
  const voltarAoBrasil = () => {
    setMun("");
    f.definir([]);
  };

  const opcoesBusca = useMemo<OpcaoBusca[]>(
    () => [
      ...UFS.map((uf) => ({ id: `uf:${uf}`, rotulo: NOMES_UF[uf], detalhe: `estado · ${uf}` })),
      ...(todos.tipo === "pronto" ? todos.dados.map((l) => ({ id: `mun:${l.cod}:${l.uf}`, rotulo: String(l.nome), detalhe: String(l.uf) })) : []),
    ],
    [todos],
  );
  const aoBuscar = (o: OpcaoBusca) => {
    const [tipo, cod, uf] = o.id.split(":");
    if (tipo === "uf") escolherUF(cod);
    else escolherMunicipio(cod, uf);
  };

  const u = ufs.tipo === "pronto" ? ufs.dados : [];
  // Memorizado: um array novo a cada render faria o mapa redesenhar os estados à toa.
  const estadosMapa = useMemo(() => (ufs.tipo === "pronto" ? ufs.dados : []).map((l) => ({ uf: String(l.uf), valor: l.valor === null ? null : num(l, "valor") })), [ufs]);
  const resposta = (() => {
    if (metrica !== "estoque" || !u.length) return undefined;
    const total = u.reduce((s, l) => s + num(l, "estoque"), 0);
    if (foco && linhasEstado.length) {
      const doUF = num(u.find((l) => l.uf === foco), "estoque");
      const top = linhasEstado[0];
      return `Em ${ano}, ${NOMES_UF[foco]} tinha ${fmt.inteiro(doUF)} vínculos de ${area.sigla} (${fmt.parte(doUF / total)} do país), em ${fmt.inteiro(linhasEstado.length)} municípios; ${top.nome} sozinho reunia ${fmt.parte(num(top, "estoque") / doUF)} do estado.`;
    }
    const top3 = u.slice(0, 3);
    const parte = top3.reduce((s, l) => s + num(l, "estoque"), 0) / total;
    return `Em ${ano}, ${top3.map((l) => l.uf).join(", ")} concentravam ${fmt.parte(parte)} dos vínculos de ${area.sigla} do país; ${u[0].uf} sozinho, ${fmt.parte(num(u[0], "estoque") / total)}. Clique num estado para ver os municípios dele.`;
  })();

  const tabelaEstados = (d: LinhaSQL[]) => ({
    colunas: [{ chave: "nome", rotulo: "Estado" }, { chave: "valor", rotulo: m.nome, formato: m.formato as Formato }],
    linhas: d.map((l) => ({ ...l, nome: NOMES_UF[String(l.uf)] ?? l.uf })),
  });
  const tabelaMunicipios = (d: LinhaSQL[]) => ({
    colunas: [{ chave: "nome", rotulo: "Município" }, { chave: "estoque", rotulo: "Vínculos", formato: fmt.inteiro }, { chave: "valor", rotulo: m.nome, formato: m.formato as Formato }],
    linhas: d,
  });

  // O ranking de municípios: os do estado em foco (já carregados para o mapa), ou os maiores do filtro.
  const ranking = foco ? (doEstado.tipo === "pronto" ? { ...doEstado, dados: ordenarRanking(doEstado.dados, metrica).slice(0, 15) } : doEstado) : maiores;
  const porNome = (d: LinhaSQL[]) => new Map(d.map((l) => [String(l.nome), l]));

  return (
    <div className="flex flex-col gap-6">
      <BarraFiltros>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Ano</span>
          <select aria-label="Ano" className="h-9 rounded-md border bg-card px-2.5 text-sm" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {intervalo(ANO_INICIAL, anoRais).reverse().map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <Segmentado<Metrica> rotulo="Mostrar" valor={metrica} opcoes={(Object.keys(METRICAS) as Metrica[]).map((k) => ({ valor: k, rotulo: METRICAS[k].rotulo }))} aoMudar={setMetrica} />
        <SeletorUF />
        <Busca rotulo="Buscar" placeholder="Estado ou município" opcoes={opcoesBusca} aoEscolher={aoBuscar} aoFocar={() => setBuscando(true)} carregando={todos.tipo === "carregando"} />
      </BarraFiltros>

      <section className="flex flex-col gap-4">
        <Titulo pergunta={foco ? `Onde está o emprego de ${area.sigla} em ${NOMES_UF[foco]}?` : `Em que estados está o emprego de ${area.sigla}?`} resposta={resposta} />
        <nav aria-label="Nível do mapa" className="flex flex-wrap items-center gap-1 text-sm">
          {foco ? (
            <button type="button" onClick={voltarAoBrasil} className="rounded-md text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
              Brasil
            </button>
          ) : (
            <span className="font-medium">Brasil</span>
          )}
          {foco && (
            <>
              <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
              <span className={escolhido ? "text-muted-foreground" : "font-medium"}>{NOMES_UF[foco]}</span>
            </>
          )}
          {escolhido && (
            <>
              <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="font-medium">{String(escolhido.nome)}</span>
            </>
          )}
        </nav>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Painel
            titulo={`${m.nome} · ${foco ? `municípios de ${NOMES_UF[foco]}` : "por estado"} · ${ano}`}
            descricao={`${m.fonte} · ${foco ? "cada bolha é um município: o tamanho é o número de vínculos, a cor é a métrica · clique para fixar" : "o estado de lotação da empresa · clique num estado para descer aos municípios"}`}
            // Os estados, que já estão carregados: o mapa não some enquanto os
            // municípios do estado chegam (as bolhas aparecem quando chegam).
            estado={ufs}
            altura={520}
            tabela={(d) => (foco ? tabelaMunicipios(linhasEstado) : tabelaEstados(d))}
          >
            {() => (
              <MapaOSM
                rotulo={`Mapa de ${m.nome.toLowerCase()} de ${area.nome}${foco ? ` nos municípios de ${NOMES_UF[foco]}` : " por estado"}, ${ano}`}
                altura={480}
                estados={estadosMapa}
                municipios={municipios}
                foco={foco}
                marcados={f.ufs}
                municipioEscolhido={mun || null}
                divergente={metrica === "saldo"}
                formato={m.formato}
                nomeMetrica={m.nome}
                aoEscolherUF={escolherUF}
                aoEscolherMunicipio={(cod) => escolherMunicipio(cod)}
              />
            )}
          </Painel>

          <div className="flex flex-col gap-4">
            {escolhido && <FichaMunicipio linha={escolhido} historico={historico.tipo === "pronto" ? historico.dados : null} area={area} aoFechar={() => setMun("")} />}
            <Painel titulo="Ranking dos estados" descricao={`${m.fonte} · ${ano} · clique para descer ao estado`} estado={ufs} altura={escolhido ? 300 : 520} tabela={tabelaEstados}>
              {(d) => (
                <Grafico
                  rotulo={`Ranking dos estados em ${m.nome}, ${area.nome}`}
                  altura={escolhido ? 300 : 520}
                  aoClicar={(p) => p.name && escolherUF(p.name)}
                  opcao={(t) => opcaoBarrasH(t, rotulos(d, "uf"), coluna(d, "valor"), { formato: m.formato, larguraRotulo: 40, destaque: f.ufs, clicavel: true })}
                />
              )}
            </Painel>
          </div>
        </div>

        <Painel
          titulo={`Municípios com mais vínculos · ${foco ? NOMES_UF[foco] : f.rotulo} · ${ano}`}
          descricao="RAIS e CAGED · o município do estabelecimento, que nem sempre é onde a pessoa trabalha: empresas escolhem a sede pelo imposto · clique para ver no mapa"
          estado={ranking}
          altura={420}
          tabela={tabelaMunicipios}
        >
          {(d) => {
            const mapa = porNome(d);
            return (
              <Grafico
                rotulo={`Municípios com mais vínculos de ${area.nome}`}
                altura={420}
                aoClicar={(p) => {
                  const l = p.name ? mapa.get(p.name) : undefined;
                  if (l) escolherMunicipio(String(l.cod), String(l.uf));
                }}
                opcao={(t) =>
                  opcaoBarrasH(t, rotulos(d, "nome"), coluna(d, "valor"), {
                    formato: m.formato,
                    larguraRotulo: 200,
                    destaque: escolhido ? [String(escolhido.nome)] : [],
                    clicavel: true,
                  })
                }
              />
            );
          }}
        </Painel>
      </section>

      <Setor area={area} ano={ano} />
      <Trajetoria area={area} />
    </div>
  );
}

function ordenarRanking(linhas: LinhaSQL[], metrica: Metrica): LinhaSQL[] {
  // O salário mediano de um município pequeno é ruído: ranqueia pelos maiores mercados.
  const chave = metrica === "mediana" ? "estoque" : "valor";
  return [...linhas].sort((a, b) => num(b, chave) - num(a, chave));
}

/** A ficha do município escolhido: os números do ano e a série do estoque. */
function FichaMunicipio({ linha, historico, area, aoFechar }: { linha: LinhaSQL; historico: LinhaSQL[] | null; area: Area; aoFechar: () => void }) {
  const populacao = num(linha, "populacao");
  const porMil = Number.isFinite(populacao) && populacao > 0 ? (num(linha, "estoque") / populacao) * 1000 : NaN;
  const saldo = num(linha, "saldo");
  return (
    <Card className="gap-3">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="size-4 text-primary" aria-hidden />
          {String(linha.nome)} <span className="text-sm font-normal text-muted-foreground">{String(linha.uf)}</span>
        </CardTitle>
        <button type="button" aria-label="Fechar a ficha do município" onClick={aoFechar} className="rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <X className="size-4" aria-hidden />
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Dado rotulo="Vínculos ativos" valor={fmt.inteiro(num(linha, "estoque"))} />
          <Dado rotulo="Por mil habitantes" valor={Number.isFinite(porMil) ? porMil.toFixed(1).replace(".", ",") : "—"} />
          <Dado rotulo="Remuneração mediana" valor={linha.mediana === null ? "—" : fmt.sm(num(linha, "mediana"))} />
          <Dado rotulo="Saldo no ano" valor={Number.isFinite(saldo) ? fmt.sinal(saldo) : "—"} tom={saldo > 0 ? "text-sobe" : saldo < 0 ? "text-desce" : undefined} />
          <Dado rotulo="Admissões" valor={fmt.inteiro(num(linha, "admissoes"))} />
          <Dado rotulo="Desligamentos" valor={fmt.inteiro(num(linha, "desligamentos"))} />
        </div>
        {historico && historico.length > 1 ? (
          <Grafico
            rotulo={`Vínculos de ${area.nome} em ${String(linha.nome)}, ano a ano`}
            altura={150}
            opcao={(t) => opcaoLinhas(t, rotulos(historico, "ano"), [{ nome: "Vínculos", dados: coluna(historico, "estoque"), area: true }], { zero: true, altura: 150 })}
          />
        ) : historico === null ? (
          <Skeleton className="h-[150px]" />
        ) : null}
      </CardContent>
    </Card>
  );
}

function Dado({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className={`font-semibold ${tom ?? ""}`}>{valor}</span>
    </div>
  );
}

// ---------------------------------------------------------------- setor
function Setor({ area, ano }: { area: Area; ano: number }) {
  const dados = useConsulta(area.slug, area.repo, `
    SELECT setor_empresa AS nome, sum(estoque_3112)::DOUBLE AS valor
    FROM rais_setor_vs_ocupacao WHERE ano = ${ano} AND ocupacao_da_area AND NOT setor_da_area AND setor_empresa IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12`);
  const total = useConsulta(area.slug, area.repo, `
    SELECT sum(estoque_3112) FILTER (WHERE ocupacao_da_area AND NOT setor_da_area)::DOUBLE AS fora, sum(estoque_3112) FILTER (WHERE ocupacao_da_area)::DOUBLE AS prof
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
