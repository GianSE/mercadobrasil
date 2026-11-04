import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Link } from "wouter";
import type { Area } from "../lib/areas";
import { acharNo, caminhoAte, folhasDe, type No } from "../lib/arvore";
import { useTabela, type Estado } from "../lib/dados";
import { fmt } from "../lib/formato";
import { opcaoFluxo, opcaoHierarquia, opcaoLinhas, type NoAnel } from "../lib/graficos";
import { serieDe, useRecorteCbo, useRecorteCnae, type Hierarquia, type Recorte } from "../lib/recorte";
import { useParametro } from "../lib/url";
import { cn } from "../lib/utils";
import { Grafico } from "./Grafico";
import { Painel } from "./Painel";
import { SeletorArvore } from "./SeletorArvore";
import { Titulo } from "./Titulo";
import { Segmentado } from "./ui/segmentado";

/*
 * O recorte da área como hierarquia: os anéis (visão geral) e a ficha com
 * drill down (crescimento). Escolher um nível no menu, clicar num anel ou numa
 * linha levam ao mesmo lugar, e a escolha fica no endereço (?h=cbo&no=...).
 */

const TODOS = "todos";
const lerH = (s: string) => (s === "cbo" || s === "cnae" ? s : null);
const lerNo = (s: string) => s || null;

function useEscolha() {
  const [h, setH] = useParametro<Hierarquia>("h", "cbo", lerH, String);
  const [no, setNo] = useParametro<string>("no", TODOS, lerNo, String);
  return { h, no, trocarH: (v: Hierarquia) => (setH(v), setNo(TODOS)), setNo };
}

function useRecorte(area: Area, h: Hierarquia): Estado<Recorte> {
  const cbo = useRecorteCbo(area);
  const cnae = useRecorteCnae(area);
  return h === "cbo" ? cbo : cnae;
}

const textos = (area: Area, h: Hierarquia) =>
  h === "cbo"
    ? { rotulo: "Ocupação", todos: `Todas as ocupações de ${area.sigla}`, busca: "Buscar ocupação ou código CBO", unidade: "vínculos" }
    : { rotulo: "Atividade", todos: `Todas as atividades do setor de ${area.sigla}`, busca: "Buscar atividade ou código CNAE", unidade: "vínculos" };

/** A trilha do topo até o nó escolhido, cada passo clicável. */
function Trilha({ caminho, raiz, aoIr }: { caminho: No[]; raiz: string; aoIr: (id: string) => void }) {
  if (!caminho.length) return null;
  return (
    <nav aria-label="Nível escolhido" className="flex flex-wrap items-center gap-1 text-sm">
      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => aoIr(TODOS)}>
        {raiz}
      </button>
      {caminho.map((n, i) => (
        <span key={n.id} className="flex items-center gap-1">
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
          {i === caminho.length - 1 ? (
            <span className="font-medium">{n.nome}</span>
          ) : (
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => aoIr(n.id)}>
              {n.nome}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

function Controles({ area, h, no, trocarH, setNo, arvore }: { area: Area; h: Hierarquia; no: string; trocarH: (h: Hierarquia) => void; setNo: (id: string) => void; arvore: No[] }) {
  const t = textos(area, h);
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Segmentado<Hierarquia> rotulo="Hierarquia" valor={h} opcoes={[{ valor: "cbo", rotulo: "Ocupações (CBO)" }, { valor: "cnae", rotulo: "Atividades (CNAE)" }]} aoMudar={trocarH} />
      <SeletorArvore rotulo={t.rotulo} valor={no} nos={arvore} todos={{ id: TODOS, nome: t.todos }} aoMudar={setNo} placeholder={t.busca} />
    </div>
  );
}

const paraAnel = (nos: No[]): NoAnel[] => nos.map((n) => ({ id: n.id, nome: n.codigo && !n.filhos?.length ? `${n.codigo} ${n.nome}` : n.nome, valor: n.valor, filhos: n.filhos?.length ? paraAnel(n.filhos) : undefined }));

// ------------------------------------------------------------- anéis
export function AneisRecorte({ area }: { area: Area }) {
  const { h, no, trocarH, setNo } = useEscolha();
  const estado = useRecorte(area, h);
  const t = textos(area, h);
  const r = estado.tipo === "pronto" ? estado.dados : null;
  const arvore = useMemo(() => r?.arvore ?? [], [r]);
  const atual = no === TODOS ? undefined : acharNo(arvore, no);
  // Uma folha não tem anel próprio: mostra a família dela, com ela dentro.
  const caminho = atual ? caminhoAte(arvore, atual.id) : [];
  const centro = atual && !atual.filhos?.length ? caminho.at(-2) : atual;
  const nos = centro ? [centro] : arvore;
  const clicar = useCallback((p: { data?: unknown }) => {
    const id = (p.data as { id?: string } | undefined)?.id;
    if (id) setNo(id);
  }, [setNo]);
  const total = nos.reduce((s, n) => s + n.valor, 0);

  return (
    <section className="flex flex-col gap-4">
      <Titulo
        pergunta={`O que conta como ${area.sigla}?`}
        resposta={r ? `Em ${r.ano}, ${fmt.inteiro(arvore.reduce((s, n) => s + n.valor, 0))} vínculos ativos ${h === "cbo" ? `de quem exerce ocupação de ${area.sigla}, em ${folhasDe({ id: "", codigo: "", nome: "", valor: 0, filhos: arvore }).length} ocupações` : `nas ${folhasDe({ id: "", codigo: "", nome: "", valor: 0, filhos: arvore }).length} atividades do setor de ${area.sigla}`}. Clique num anel para descer na hierarquia.` : undefined}
      />
      <Painel
        titulo={atual ? atual.nome : t.todos}
        descricao={
          <>
            RAIS · vínculos ativos em 31/12{r ? `/${r.ano}` : ""} · {h === "cbo" ? "subárea → família → ocupação" : "divisão → subclasse"}
            {atual && <span className="block">{fmt.inteiro(atual.valor)} vínculos · {fmt.parte(atual.valor / (arvore.reduce((s, n) => s + n.valor, 0) || 1))} do recorte</span>}
          </>
        }
        estado={estado}
        altura={520}
        controles={
          <div className="flex flex-col gap-3">
            <Controles area={area} h={h} no={no} trocarH={trocarH} setNo={setNo} arvore={arvore} />
            <Trilha caminho={caminho} raiz={t.todos} aoIr={setNo} />
          </div>
        }
        tabela={() => ({
          colunas: [{ chave: "codigo", rotulo: "Código" }, { chave: "nome", rotulo: "Nome" }, { chave: "valor", rotulo: "Vínculos", formato: fmt.inteiro }, { chave: "parte", rotulo: "Parte", formato: fmt.parte }],
          linhas: nos.flatMap(folhasDe).sort((a, b) => b.valor - a.valor).map((f) => ({ codigo: f.codigo, nome: f.nome, valor: f.valor, parte: f.valor / (total || 1) })),
        })}
      >
        {() => <Grafico rotulo={`Hierarquia do recorte de ${area.nome}`} altura={520} aoClicar={clicar} opcao={(tinta) => opcaoHierarquia(tinta, paraAnel(nos), { unidade: "vínculos" })} />}
      </Painel>
      <Link href={`/${area.slug}/crescimento?h=${h}${no !== TODOS ? `&no=${encodeURIComponent(no)}` : ""}`} className="inline-flex w-fit items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
        Ver {atual ? atual.nome : t.todos.toLowerCase()} ano a ano <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

// -------------------------------------------------------------- ficha
const CORES = 7;

export function FichaRecorte({ area }: { area: Area }) {
  const { h, no, trocarH, setNo } = useEscolha();
  const estado = useRecorte(area, h);
  const t = textos(area, h);
  const r = estado.tipo === "pronto" ? estado.dados : null;
  const arvore = useMemo(() => r?.arvore ?? [], [r]);
  const atual = no === TODOS ? undefined : acharNo(arvore, no);
  const caminho = atual ? caminhoAte(arvore, atual.id) : [];
  // As linhas são os filhos do nível escolhido; numa folha, ela sozinha.
  const filhos = atual ? (atual.filhos?.length ? atual.filhos : [atual]) : arvore;
  const ordenados = [...filhos].sort((a, b) => b.valor - a.valor);
  const porNome = useMemo(() => new Map(ordenados.map((f) => [f.nome, f])), [ordenados]);
  const clicar = useCallback((p: { seriesName?: string }) => {
    const alvo = p.seriesName ? porNome.get(p.seriesName) : undefined;
    if (alvo?.filhos?.length) setNo(alvo.id);
  }, [porNome, setNo]);
  const acima = caminho.length > 1 ? caminho.at(-2)!.id : TODOS;

  // CAGED das ocupações escolhidas, pelo nome (o mesmo nas duas bases): as
  // lentes em que elas são ocupação da área. Na CNAE, só a RAIS.
  const caged = useTabela(area.repo, "caged_ocupacao", (l) => l);
  const fluxo = useMemo(() => {
    if (h !== "cbo" || caged.tipo !== "pronto" || !r) return null;
    const nomes = new Set((atual ? folhasDe(atual) : arvore.flatMap(folhasDe)).map((f) => f.nome.toLowerCase()));
    const porAno = new Map<number, { admissoes: number; desligamentos: number; saldo: number }>();
    for (const l of caged.dados) {
      if (l.lente === area.rotulos.lente_so_setor || !nomes.has(String(l.ocupacao).toLowerCase())) continue;
      const a = porAno.get(Number(l.ano)) ?? { admissoes: 0, desligamentos: 0, saldo: 0 };
      a.admissoes += Number(l.admissoes);
      a.desligamentos += Number(l.desligamentos);
      a.saldo += Number(l.saldo);
      porAno.set(Number(l.ano), a);
    }
    return [...porAno.entries()].sort(([x], [y]) => x - y).map(([ano, v]) => ({ periodo: String(ano), ...v }));
  }, [h, caged, r, atual, arvore, area]);

  const nome = atual?.nome ?? t.todos;
  const serieTotal = r ? serieDe(r, atual ? [atual] : arvore) : [];
  const resposta = (() => {
    if (!r) return undefined;
    const i0 = serieTotal.findIndex((v) => v !== null);
    const v0 = serieTotal[i0];
    const v1 = serieTotal.at(-1);
    if (i0 < 0 || !v0 || !v1) return undefined;
    return `${nome}: ${fmt.inteiro(v1)} vínculos em ${r.anos.at(-1)}, ${v1 >= v0 ? "alta" : "queda"} de ${fmt.parte(Math.abs(v1 / v0 - 1))} desde ${r.anos[i0]}.`;
  })();

  return (
    <section className="flex flex-col gap-4" id="ocupacao">
      <Titulo pergunta={h === "cbo" ? "Quais ocupações cresceram?" : "Quais atividades cresceram?"} resposta={resposta} />
      <Painel
        titulo={`${nome} · ano a ano`}
        descricao={`RAIS · vínculos ativos em 31/12 · Brasil · ${atual?.filhos?.length || !atual ? "uma linha por nível de baixo; clique numa linha para descer" : "uma ocupação"}${ordenados.length > CORES ? ` · a partir da ${CORES + 1}ª linha, em cinza` : ""}`}
        estado={estado}
        altura={380}
        controles={
          <div className="flex flex-col gap-3">
            <Controles area={area} h={h} no={no} trocarH={trocarH} setNo={setNo} arvore={arvore} />
            <div className="flex flex-wrap items-center gap-3">
              {atual && (
                <button type="button" onClick={() => setNo(acima)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm hover:bg-accent">
                  <ArrowLeft className="size-3.5" aria-hidden /> Voltar um nível
                </button>
              )}
              <Trilha caminho={caminho} raiz={t.todos} aoIr={setNo} />
            </div>
            {atual?.filhos?.length || !atual ? (
              <div className="flex flex-wrap gap-1.5">
                {ordenados.filter((f) => f.filhos?.length).slice(0, 12).map((f) => (
                  <button key={f.id} type="button" onClick={() => setNo(f.id)} className={cn("rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground")}>
                    Abrir {f.nome}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        }
        tabela={(d) => ({
          colunas: [{ chave: "ano", rotulo: "Ano" }, ...ordenados.map((f) => ({ chave: f.id, rotulo: f.nome, formato: fmt.inteiro }))],
          linhas: d.anos.map((ano, i) => Object.fromEntries([["ano", ano], ...ordenados.map((f) => [f.id, serieDe(d, [f])[i]])])),
        })}
      >
        {(d) => (
          <Grafico
            rotulo={`${nome}: vínculos ano a ano`}
            altura={380}
            aoClicar={clicar}
            opcao={(tinta) => opcaoLinhas(tinta, d.anos, ordenados.map((f, i) => ({ nome: f.nome, dados: serieDe(d, [f]), cinza: i >= CORES })), { zero: true, rotuloFinal: ordenados.length <= 8, altura: 380 })}
          />
        )}
      </Painel>
      {h === "cbo" && (
        <Painel
          titulo={`${nome} · admissões, desligamentos e saldo`}
          descricao="CAGED · admissões para cima, desligamentos para baixo; a linha é o saldo · Brasil"
          estado={fluxo ? { tipo: "pronto", dados: fluxo } : caged.tipo === "pronto" ? { tipo: "carregando" } : (caged as Estado<never>)}
          altura={300}
          tabela={(d) => ({
            colunas: [{ chave: "periodo", rotulo: "Ano" }, { chave: "admissoes", rotulo: "Admissões", formato: fmt.inteiro }, { chave: "desligamentos", rotulo: "Desligamentos", formato: fmt.inteiro }, { chave: "saldo", rotulo: "Saldo", formato: fmt.sinal }],
            linhas: d,
          })}
        >
          {(d) => (
            <Grafico
              rotulo={`${nome}: admissões e desligamentos no CAGED`}
              altura={300}
              opcao={(tinta) =>
                opcaoFluxo(tinta, d.map((x) => x.periodo), { admissoes: d.map((x) => x.admissoes), desligamentos: d.map((x) => x.desligamentos), saldo: d.map((x) => x.saldo) }, { visiveis: ["admissoes", "desligamentos", "saldo"] })
              }
            />
          )}
        </Painel>
      )}
    </section>
  );
}
