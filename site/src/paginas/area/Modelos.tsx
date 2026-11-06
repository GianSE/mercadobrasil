import { FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";
import { Grafico } from "../../components/Grafico";
import { Indicador } from "../../components/Indicador";
import { Painel } from "../../components/Painel";
import { Titulo } from "../../components/Titulo";
import { Segmentado } from "../../components/ui/segmentado";
import type { Area } from "../../lib/areas";
import type { Estado } from "../../lib/dados";
import { useConsulta, type LinhaSQL } from "../../lib/db";
import { fmt } from "../../lib/formato";
import { opcaoLinhas, opcaoPrevisao, opcaoRazaoChances } from "../../lib/graficos";
import { coluna, num, rotulos } from "../../lib/sql";

/*
 * Modelos: previsão do saldo, estimativa do estoque do ano corrente, hiato
 * salarial e o que leva ao desligamento. As páginas 4b, 5a e 5b do site do
 * TCC. Os modelos foram validados para TI; nas outras áreas eles rodam com o
 * mesmo código, mas ninguém conferiu ainda se fazem sentido — daí o aviso.
 */

const COMPARACOES = ["Homem vs Mulher", "Branca vs Parda", "Branca vs Preta"] as const;
const PLURAL: Record<string, string> = { Homem: "homens", Mulher: "mulheres", Branca: "pessoas brancas", Parda: "pessoas pardas", Preta: "pessoas pretas" };
type Comparacao = (typeof COMPARACOES)[number];

export function Modelos({ area }: { area: Area }) {
  return (
    <div className="flex flex-col gap-6">
      {area.slug !== "tec" && (
        <div className="flex items-start gap-3 rounded-xl border p-4 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-medium">Modelos validados só para TI.</span>{" "}
            <span className="text-muted-foreground">
              Em {area.nome.toLowerCase()} eles rodam com o mesmo código e os mesmos testes com o passado, mas a escolha do modelo e as variáveis foram pensadas para TI. Leia como exploração, não como conclusão.
            </span>
          </p>
        </div>
      )}
      <Previsao area={area} />
      <Nowcast area={area} />
      <Hiato area={area} />
      <Desligamento area={area} />
    </div>
  );
}

// ------------------------------------------------------------ previsão
function Previsao({ area }: { area: Area }) {
  const q = (sql: string) => useConsulta(area.slug, area.repo, sql);
  const serie = q("SELECT strftime(mes, '%Y-%m') AS mes, saldo FROM serie_mensal ORDER BY mes DESC LIMIT 72");
  const prev = q("SELECT strftime(mes, '%Y-%m') AS mes, previsao, inferior, superior, acum_previsao, acum_inferior, acum_superior, modelo FROM previsao_saldo ORDER BY mes");

  // As duas consultas viram um estado só: o gráfico precisa das duas juntas.
  const juntos = useMemo<Estado<{ obs: LinhaSQL[]; p: LinhaSQL[] }>>(() => {
    if (serie.tipo === "pronto" && prev.tipo === "pronto") return { tipo: "pronto", dados: { obs: [...serie.dados].reverse(), p: prev.dados } };
    const outro = serie.tipo !== "pronto" ? serie : prev;
    if (outro.tipo === "erro") return { tipo: "erro", mensagem: outro.mensagem };
    return { tipo: outro.tipo === "ausente" ? "ausente" : "carregando" };
  }, [serie, prev]);
  const p = prev.tipo === "pronto" ? prev.dados : [];
  const fim = p.at(-1);
  const resposta = fim
    ? `Nos próximos ${p.length} meses, o modelo projeta para ${area.sigla} um saldo acumulado de ${fmt.sinal(num(fim, "acum_previsao"))} vagas, entre ${fmt.sinal(num(fim, "acum_inferior"))} e ${fmt.sinal(num(fim, "acum_superior"))} em 8 de cada 10 cenários.`
    : undefined;

  return (
    <section className="flex flex-col gap-4">
      <Titulo pergunta="Quanto o mercado deve contratar nos próximos meses?" resposta={resposta} />
      <Painel
        titulo="Saldo mensal: observado e projetado"
        descricao={`CAGED · últimos 72 meses observados e ${p.length || 18} projetados · a área sombreada é a faixa de 80%${fim ? ` · modelo ${String(fim.modelo)}` : ""}`}
        estado={juntos}
        altura={340}
      >
        {(d) => {
          const meses = [...d.obs.map((l) => String(l.mes)), ...d.p.map((l) => String(l.mes))];
          const k = d.obs.length;
          // A previsão começa no último observado, para a linha não ficar solta.
          const observado = [...d.obs.map((l) => num(l, "saldo")), ...d.p.map(() => null)];
          const previsto = meses.map((_, i) => (i === k - 1 ? num(d.obs[k - 1], "saldo") : i >= k ? num(d.p[i - k], "previsao") : null));
          const inferior = meses.map((_, i) => (i >= k ? num(d.p[i - k], "inferior") : null));
          const superior = meses.map((_, i) => (i >= k ? num(d.p[i - k], "superior") : null));
          return <Grafico rotulo={`Saldo mensal observado e projetado de ${area.nome}`} altura={340} opcao={(t) => opcaoPrevisao(t, meses, observado, previsto, inferior, superior)} />;
        }}
      </Painel>
    </section>
  );
}

// ------------------------------------------------------------- nowcast
function Nowcast({ area }: { area: Area }) {
  const proj = useConsulta(area.slug, area.repo, "SELECT * FROM nowcast_projecao");
  const pr = proj.tipo === "pronto" ? proj.dados[0] : undefined;
  const carregando = proj.tipo === "carregando";
  const semDado = proj.tipo === "ausente" || proj.tipo === "erro";
  return (
    <section className="flex flex-col gap-4">
      <Titulo
        pergunta={`Quantos empregos de ${area.sigla} há hoje?`}
        resposta={pr ? `A RAIS de ${num(pr, "ano")} só sai no ano seguinte. Pelo fluxo que o CAGED já mostrou em ${num(pr, "meses_observados")} meses, o estoque de ${area.sigla} deve fechar ${num(pr, "ano")} perto de ${fmt.inteiro(num(pr, "estoque_estimado"))} vínculos.` : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador titulo={pr ? `Estoque estimado para ${num(pr, "ano")}` : "Estoque estimado"} valor={carregando ? undefined : pr ? fmt.inteiro(num(pr, "estoque_estimado")) : "—"} nota={pr ? `± ${fmt.compacto(num(pr, "margem"))} · nowcast pelo CAGED` : semDado ? "esta área ainda não publicou o nowcast" : undefined} />
        <Indicador titulo={pr ? `Último estoque da RAIS (${num(pr, "ano_base")})` : "Último estoque da RAIS"} valor={carregando ? undefined : pr ? fmt.inteiro(num(pr, "estoque_base")) : "—"} nota="RAIS, 31/12" />
        <Indicador titulo="Fluxo no ano" valor={carregando ? undefined : pr ? fmt.sinal(num(pr, "fluxo_total")) : "—"} nota={pr ? `${fmt.sinal(num(pr, "fluxo_observado"))} observado + ${fmt.sinal(num(pr, "fluxo_previsto"))} previsto` : undefined} />
      </div>
    </section>
  );
}

// --------------------------------------------------------------- hiato
function Hiato({ area }: { area: Area }) {
  const [comparacao, setComparacao] = useState<Comparacao>("Homem vs Mulher");
  const serie = useConsulta(area.slug, area.repo, `SELECT ano, hiato_pct / 100 AS hiato, explicada, nao_explicada FROM hiato_serie WHERE comparacao = '${comparacao}' ORDER BY ano`);
  const s = serie.tipo === "pronto" ? serie.dados : [];
  const ultimo = s.at(-1);
  const [a, b] = comparacao.split(" vs ");
  const resposta = ultimo
    ? (() => {
        // As parcelas estão em log: exp - 1 dá a diferença em %.
        const perfil = Math.exp(num(ultimo, "explicada")) - 1;
        const iguais = Math.exp(num(ultimo, "nao_explicada")) - 1;
        return `Em ${num(ultimo, "ano")}, em ${area.sigla}, ${PLURAL[a]} ganhavam ${fmt.parte(Math.abs(num(ultimo, "hiato")))} ${num(ultimo, "hiato") >= 0 ? "a mais" : "a menos"} que ${PLURAL[b]}. Entre pessoas de mesmo perfil, a diferença é de ${fmt.parte(Math.abs(iguais))}; o resto (${fmt.variacao(perfil)}) vem de os grupos estarem em posições diferentes.`;
      })()
    : undefined;
  return (
    <section className="flex flex-col gap-4">
      <Titulo pergunta="Quem ganha menos, e por quê?" resposta={resposta} />
      <Painel
        titulo={`Hiato salarial · ${comparacao.replace(" vs ", " × ")}`}
        descricao="RAIS · decomposição de Oaxaca-Blinder: quanto o primeiro grupo ganha a mais, e quanto disso sobra entre pessoas de mesmo perfil (escolaridade, subárea, porte, região, idade, jornada, tempo de casa) · Brasil"
        estado={serie}
        altura={300}
        controles={<Segmentado<Comparacao> rotulo="Comparar" valor={comparacao} opcoes={COMPARACOES.map((c) => ({ valor: c, rotulo: c.replace(" vs ", " × ") }))} aoMudar={setComparacao} />}
        tabela={(d) => ({
          colunas: [{ chave: "ano", rotulo: "Ano" }, { chave: "hiato", rotulo: "Hiato", formato: fmt.parte }, { chave: "perfil", rotulo: "Do perfil", formato: fmt.variacao }, { chave: "iguais", rotulo: "Entre iguais", formato: fmt.variacao }],
          linhas: d.map((l) => ({ ...l, perfil: Math.exp(num(l, "explicada")) - 1, iguais: Math.exp(num(l, "nao_explicada")) - 1 })),
        })}
      >
        {(d) => (
          <Grafico
            rotulo={`Hiato salarial ${comparacao} em ${area.nome}`}
            altura={300}
            opcao={(t) =>
              opcaoLinhas(
                t,
                rotulos(d, "ano"),
                [
                  { nome: "Hiato total", dados: coluna(d, "hiato") },
                  { nome: "Entre pessoas iguais", dados: d.map((l) => Math.exp(num(l, "nao_explicada")) - 1) },
                ],
                { formato: fmt.parte, formatoEixo: (v) => fmt.parte(v), zero: true, rotuloFinal: true, altura: 300 },
              )
            }
          />
        )}
      </Painel>
      <p className="max-w-3xl text-sm text-muted-foreground">
        A parte entre iguais não prova discriminação: é o que sobra depois de comparar pessoas de mesmo perfil, e inclui tudo o que o modelo não mede. É o limite superior do que a discriminação poderia explicar.
      </p>
    </section>
  );
}

// -------------------------------------------------------- desligamento
const GRUPOS: Record<string, string> = { sexo: "Sexo", escolaridade: "Escolaridade", area: "Subárea", porte: "Porte da empresa", tempo_de_casa: "Tempo de casa", idade: "Idade", log_remun: "Salário" };

// A gold grava as categorias como saem da RAIS ("SUP. COMP", "DE 250 A 499");
// aqui viram nomes, na ordem natural de cada grupo. (Do site do TCC.)
const NOMES: Record<string, Record<string, string>> = {
  escolaridade: {
    ANALFABETO: "analfabeto", "ATE 5.A INC": "fundamental I incompleto", "5.A CO FUND": "fundamental I completo", "6. A 9. FUND": "fundamental II incompleto",
    "FUND COMPL": "fundamental completo", "MEDIO INCOMP": "médio incompleto", "MEDIO COMPL": "médio completo", "SUP. INCOMP": "superior incompleto",
    "SUP. COMP": "superior completo", MESTRADO: "mestrado", DOUTORADO: "doutorado",
  },
  porte: {
    ZERO: "sem empregados em 31/12", "ATE 4": "até 4 empregados", "DE 5 A 9": "5 a 9", "DE 10 A 19": "10 a 19", "DE 20 A 49": "20 a 49", "DE 50 A 99": "50 a 99",
    "DE 100 A 249": "100 a 249", "DE 250 A 499": "250 a 499", "DE 500 A 999": "500 a 999", "1000 OU MAIS": "1.000 ou mais",
  },
  tempo_de_casa: { "0-6m": "0–6 meses", "6-12m": "6–12 meses", "1-2a": "1–2 anos", "2-3a": "2–3 anos", "3-5a": "3–5 anos", "5-10a": "5–10 anos", "10-20a": "10–20 anos", "20a+": "20 anos ou mais" },
};
const nomeCategoria = (grupo: string, cat: string) => NOMES[grupo]?.[cat.toUpperCase()] ?? NOMES[grupo]?.[cat] ?? cat.toLowerCase();
const ordemCategoria = (grupo: string, cat: string) => {
  const chaves = Object.keys(NOMES[grupo] ?? {});
  const i = chaves.findIndex((k) => k === cat || k === cat.toUpperCase());
  return i < 0 ? 99 : i;
};

function itensModelo(linhas: LinhaSQL[]) {
  const refs: Record<string, string> = {};
  const itens = linhas.map((l) => {
    const grupo = String(l.grupo ?? "");
    if (typeof l.referencia === "string" && l.referencia) refs[grupo] = l.referencia;
    const [or, p] = [num(l, "razao_de_chances"), num(l, "p")];
    // As contínuas viram um passo que se entende: dez anos a mais de idade e o salário dobrado.
    if (grupo === "idade") return { grupo, rotulo: "Idade · 10 anos a mais", valor: or ** 10, p, ordem: 0 };
    if (grupo === "log_remun") return { grupo, rotulo: "Salário · o dobro", valor: or ** Math.LN2, p, ordem: 0 };
    const cat = String(l.categoria ?? l.variavel);
    return { grupo, rotulo: `${GRUPOS[grupo] ?? grupo} · ${nomeCategoria(grupo, cat)}`, valor: or, p, ordem: ordemCategoria(grupo, cat) };
  });
  const ordem = Object.keys(GRUPOS);
  itens.sort((x, y) => ordem.indexOf(x.grupo) - ordem.indexOf(y.grupo) || x.ordem - y.ordem || y.valor - x.valor);
  const referencias = Object.entries(refs).map(([g, r]) => `${(GRUPOS[g] ?? g).toLowerCase()}: ${nomeCategoria(g, r)}`).join(" · ");
  return { itens, referencias };
}

function Desligamento({ area }: { area: Area }) {
  const multi = useConsulta(area.slug, area.repo, "SELECT * FROM sobrevivencia_multivariado");
  const m = useMemo(() => (multi.tipo === "pronto" ? itensModelo(multi.dados) : null), [multi]);
  return (
    <section className="flex flex-col gap-4">
      <Titulo pergunta="O que leva as pessoas a saírem?" />
      <Painel
        titulo="O que muda o risco de desligamento, comparando pessoas parecidas no resto"
        descricao={`Modelo de risco em tempo discreto, RAIS · à direita do ×1, mais chance de sair no ano; à esquerda, menos. Ponto vazado: não difere da referência com segurança (p ≥ 0,05).${m?.referencias ? ` Referências — ${m.referencias}.` : ""}`}
        estado={multi}
        altura={Math.max(320, (m?.itens.length ?? 0) * 22)}
        tabela={() => ({
          colunas: [{ chave: "rotulo", rotulo: "Característica" }, { chave: "valor", rotulo: "Razão de chances", formato: (v) => `×${v.toFixed(2).replace(".", ",")}` }, { chave: "p", rotulo: "p-valor", formato: (v) => (v < 0.001 ? "< 0,001" : v.toFixed(3).replace(".", ",")) }],
          linhas: m?.itens ?? [],
        })}
      >
        {() => m && <Grafico rotulo={`Razão de chances de desligamento em ${area.nome}`} altura={Math.max(320, m.itens.length * 22)} opcao={(t) => opcaoRazaoChances(t, m.itens)} />}
      </Painel>
    </section>
  );
}
