import { ChevronRight, Info, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Variacao } from "../components/Indicador";
import { LogoHero } from "../components/marca/LogoHero";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { AREAS, iconeDa, type Area } from "../lib/areas";
import { destaques, referencias, useComparacao, type AreaComparada, type Referencias } from "../lib/comparacao";
import { fmt } from "../lib/formato";
import { cn } from "../lib/utils";

/*
 * A página responde, nesta ordem: o que é o site, o que se destaca agora e como
 * as áreas se comparam. A lista é também a navegação: cada linha abre a área.
 */
export function Inicio() {
  const linhas = useComparacao();
  const ref = useMemo(() => (linhas ? referencias(linhas) : null), [linhas]);
  return (
    <main className="mx-auto max-w-6xl px-4 pb-12">
      <Abertura ref_={ref} />
      <Destaques linhas={linhas} ref_={ref} />
      <Comparacao linhas={linhas} ref_={ref} />
    </main>
  );
}

function Abertura({ ref_ }: { ref_: Referencias | null }) {
  return (
    <section className="flex items-center justify-between gap-10 pt-8 pb-6 lg:pt-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground">RAIS e CAGED · Ministério do Trabalho e Emprego</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">O mercado de trabalho formal no Brasil, área por área</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground sm:text-lg">Quantos vínculos existem, onde estão, quanto pagam e como mudaram. Compare as áreas e abra a que interessa.</p>
        {/* Sai do próprio dado: os Pipelines publicam o mês novo sozinhos. */}
        <p className="mt-3 h-5 text-sm text-muted-foreground">
          {ref_?.ano != null && ref_.anoBase != null && (
            <>
              RAIS de {ref_.anoBase} a {ref_.ano}
              {ref_.ate && ` · CAGED até ${fmt.mes(ref_.ate)}`}
            </>
          )}
        </p>
      </div>
      {/* A logo se desenha uma vez ao abrir. No celular ela sai daqui: o cabeçalho já traz a
          logo animada, e o espaço vai para os dados. */}
      <LogoHero className="hidden w-44 shrink-0 lg:flex" />
    </section>
  );
}

function Destaques({ linhas, ref_ }: { linhas: AreaComparada[] | null; ref_: Referencias | null }) {
  const d = useMemo(() => (linhas && ref_ ? destaques(linhas, ref_) : null), [linhas, ref_]);
  const periodo = ref_?.de && ref_.ate ? `saldo de ${fmt.mes(ref_.de, "short")} a ${fmt.mes(ref_.ate, "short")}` : "";
  const menor = d?.menorSaldo?.caged?.saldo;
  return (
    <section aria-label="Destaques" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {!d ? (
        Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="gap-2 px-5 py-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-40" />
          </Card>
        ))
      ) : (
        <>
          {d.maior?.rais && <Destaque titulo="A maior área" linha={d.maior} valor={fmt.inteiro(d.maior.rais.estoque)} nota={`vínculos em 31/12/${d.maior.rais.ano}`} />}
          {d.maisCresceu?.rais?.multiplo != null && (
            <Destaque titulo={`Mais cresceu desde ${d.maisCresceu.rais.anoBase}`} linha={d.maisCresceu} valor={fmt.multiplo(d.maisCresceu.rais.multiplo)} nota={`vínculos em relação a ${d.maisCresceu.rais.anoBase}`} />
          )}
          {d.maiorSaldo?.caged && <Destaque titulo="Mais abriu vagas em 12 meses" linha={d.maiorSaldo} valor={fmt.sinal(d.maiorSaldo.caged.saldo)} nota={periodo} sentido={d.maiorSaldo.caged.saldo} />}
          {d.menorSaldo?.caged && menor != null && (
            <Destaque titulo={menor < 0 ? "Mais fechou vagas em 12 meses" : "Menor saldo em 12 meses"} linha={d.menorSaldo} valor={fmt.sinal(menor)} nota={periodo} sentido={menor} />
          )}
        </>
      )}
    </section>
  );
}

function Destaque({ titulo, linha, valor, nota, sentido }: { titulo: string; linha: AreaComparada; valor: string; nota: string; sentido?: number }) {
  const Icone = iconeDa(linha.area);
  return (
    <Link href={`/${linha.area.slug}`} className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <Card className="h-full gap-1 px-4 py-4 transition-colors group-hover:border-foreground/25 sm:px-5">
        <span className="text-xs text-muted-foreground sm:text-sm">{titulo}</span>
        <span className={cn("text-2xl font-semibold tracking-tight sm:text-3xl", sentido != null && (sentido >= 0 ? "text-sobe" : "text-desce"))}>{valor}</span>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-medium">
          <Icone className="size-4 shrink-0 text-primary" aria-hidden />
          {linha.area.nome}
        </span>
        <span className="text-xs text-muted-foreground">{nota}</span>
      </Card>
    </Link>
  );
}

type Ordem = "estoque" | "variacao" | "multiplo" | "saldo";

const VALOR_DA_ORDEM: Record<Ordem, (l: AreaComparada) => number | null | undefined> = {
  estoque: (l) => l.rais?.estoque,
  variacao: (l) => l.rais?.variacao,
  multiplo: (l) => l.rais?.multiplo,
  saldo: (l) => l.caged?.saldo,
};

/** A grade da lista do tablet para cima; o cabeçalho e as linhas usam a mesma, para as colunas alinharem. */
const COLUNAS = "md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_5rem_9.5rem_6.5rem_1rem] md:gap-x-4 md:px-5 lg:gap-x-5";

function Comparacao({ linhas, ref_ }: { linhas: AreaComparada[] | null; ref_: Referencias | null }) {
  const [ordem, setOrdem] = useState<Ordem>("estoque");
  const noAno = ref_?.ano != null ? `Em ${ref_.ano}` : "No ano";
  const desde = ref_?.anoBase != null ? `Desde ${ref_.anoBase}` : "Desde o início";
  const opcoes: { id: Ordem; rotulo: string }[] = [
    { id: "estoque", rotulo: "Vínculos" },
    { id: "variacao", rotulo: noAno },
    { id: "multiplo", rotulo: desde },
    { id: "saldo", rotulo: "Saldo 12 meses" },
  ];
  const ordenadas = useMemo(() => {
    if (!linhas) return null;
    const valor = VALOR_DA_ORDEM[ordem];
    // Quem não tem o número vai para o fim, em qualquer ordem.
    return [...linhas].sort((a, b) => (valor(b) ?? -Infinity) - (valor(a) ?? -Infinity));
  }, [linhas, ordem]);

  return (
    <section aria-labelledby="titulo-comparacao" className="pt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-comparacao" className="text-2xl font-semibold tracking-tight">
            As {AREAS.length} áreas, lado a lado
          </h2>
          <p className="mt-1 text-muted-foreground">Clique em uma área para abrir os gráficos, o mapa e os modelos dela.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span id="rotulo-ordem" className="text-sm text-muted-foreground">
            Ordenar por
          </span>
          <div role="group" aria-labelledby="rotulo-ordem" className="flex flex-wrap gap-0.5 rounded-lg border bg-card p-1 shadow-xs">
            {opcoes.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={ordem === o.id}
                onClick={() => setOrdem(o.id)}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  ordem === o.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {/* Só para quem vê: cada célula da lista já leva o próprio rótulo para o leitor de tela. */}
        <div aria-hidden className={cn("hidden border-b py-2.5 text-xs font-medium text-muted-foreground md:grid", COLUNAS)}>
          <span>Área</span>
          <span className={cn(ordem === "estoque" && "text-foreground")}>Vínculos em 31/12</span>
          <span className={cn("text-right", ordem === "variacao" && "text-foreground")}>{noAno}</span>
          <span className={cn(ordem === "multiplo" && "text-foreground")}>{desde}</span>
          <span className={cn("text-right", ordem === "saldo" && "text-foreground")}>Saldo 12 meses</span>
        </div>
        <ol className="divide-y">
          {ordenadas && ref_
            ? ordenadas.map((l, i) => <LinhaArea key={l.area.slug} linha={l} ref_={ref_} indice={i} noAno={noAno} desde={desde} />)
            : AREAS.map((a) => <LinhaCarregando key={a.slug} area={a} />)}
        </ol>
      </Card>

      <p className="mt-4 flex max-w-4xl gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Vínculos e variação vêm da RAIS, que conta todo emprego formal, inclusive servidores públicos estatutários. O saldo vem do CAGED, que não conta os estatutários: uma área com muitos servidores, como educação, pode crescer muito na RAIS e ter saldo pequeno no CAGED. As áreas se sobrepõem (quem é engenheiro em uma fábrica conta em Engenharia e em Indústria), então os números não devem ser somados. Os minigráficos usam a mesma escala em todas as linhas.
        </span>
      </p>
    </section>
  );
}

/** Nome e ícone da área: a parte da linha que não depende de dado nenhum. */
function NomeArea({ area, Icone }: { area: Area; Icone: LucideIcon }) {
  return (
    <div className="col-span-3 flex items-center gap-3 pr-6 md:col-span-1 md:pr-0">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icone className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="font-semibold">{area.nome}</div>
        <div className="hidden text-xs text-muted-foreground lg:line-clamp-2">{area.resumo}</div>
      </div>
    </div>
  );
}

function LinhaCarregando({ area }: { area: Area }) {
  return (
    <li>
      <Link href={`/${area.slug}`} className={cn("relative grid grid-cols-3 items-center gap-3 p-4 outline-none hover:bg-accent focus-visible:bg-accent md:py-3", COLUNAS)}>
        <NomeArea area={area} Icone={iconeDa(area)} />
        <Skeleton className="col-span-3 h-8 md:col-span-1" />
        <Skeleton className="h-5" />
        <Skeleton className="h-5" />
        <Skeleton className="h-5" />
      </Link>
    </li>
  );
}

/** O rótulo da coluna: visível no celular, onde não há cabeçalho; no computador, só para o leitor de tela. */
function RotuloCelula({ children }: { children: string }) {
  return <span className="mb-0.5 block text-xs text-muted-foreground md:sr-only">{children}</span>;
}

function LinhaArea({ linha, ref_, indice, noAno, desde }: { linha: AreaComparada; ref_: Referencias; indice: number; noAno: string; desde: string }) {
  const { area, rais, caged } = linha;
  return (
    <li>
      <Link
        href={`/${area.slug}`}
        className={cn("group relative grid grid-cols-3 items-start gap-3 p-4 transition-colors outline-none hover:bg-accent focus-visible:bg-accent md:items-center md:py-3", COLUNAS)}
      >
        <NomeArea area={area} Icone={iconeDa(area)} />

        <div className="col-span-3 md:col-span-1">
          {rais ? (
            <>
              <div className="font-semibold">
                {fmt.inteiro(rais.estoque)}
                <span className="ml-1 text-xs font-normal text-muted-foreground md:sr-only">vínculos em 31/12</span>
                {/* Uma gold que ainda não recebeu o ano novo não pode parecer do mesmo ano das outras. */}
                {rais.ano !== ref_.ano && <span className="ml-1.5 text-xs font-normal text-muted-foreground">em {rais.ano}</span>}
              </div>
              <div
                aria-hidden
                className="segmento mt-1 h-2 min-w-0.5 rounded-r-[4px]"
                style={{ width: `${(rais.estoque / ref_.estoqueMax) * 100}%`, background: "var(--chart-1)", animationDelay: `${indice * 50}ms` }}
              />
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Dados ainda não publicados</span>
          )}
        </div>

        <div className="md:text-right">
          <RotuloCelula>{noAno}</RotuloCelula>
          {rais?.variacao != null ? <Variacao v={rais.variacao} /> : <SemValor />}
        </div>

        <div>
          <RotuloCelula>{desde}</RotuloCelula>
          <div className="flex items-center gap-1.5 md:gap-3">
            {rais?.multiplo != null ? (
              <>
                <span className="text-sm font-medium">{fmt.multiplo(rais.multiplo)}</span>
                <Minigrafico serie={rais.indice} maximo={ref_.indiceMax} indice={indice} rotulo={`${area.nome}: ${fmt.multiplo(rais.multiplo)} entre ${rais.anoBase} e ${rais.ano}`} />
              </>
            ) : (
              <SemValor />
            )}
          </div>
        </div>

        <div className="md:text-right">
          <RotuloCelula>Saldo 12 meses</RotuloCelula>
          {caged ? <span className={cn("text-sm font-medium", caged.saldo >= 0 ? "text-sobe" : "text-desce")}>{fmt.sinal(caged.saldo)}</span> : <SemValor />}
        </div>

        <ChevronRight className="absolute top-7 right-4 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:static" aria-hidden />
      </Link>
    </li>
  );
}

function SemValor() {
  return <span className="text-sm text-muted-foreground">—</span>;
}

/**
 * A série inteira em um traço, sem eixos. Todas as linhas dividem a mesma
 * escala (1 = o primeiro ano, `maximo` = o maior múltiplo entre as áreas): é ela
 * que deixa comparar o crescimento de uma linha com o da outra. Sem cor por
 * área: a identidade está no nome ao lado, e o traço só conta a forma.
 */
function Minigrafico({ serie, maximo, indice, rotulo }: { serie: number[]; maximo: number; indice: number; rotulo: string }) {
  const L = 72;
  const A = 30;
  const folga = 3;
  const minimo = Math.min(1, ...serie);
  const x = (i: number) => folga + (i / Math.max(1, serie.length - 1)) * (L - 2 * folga);
  const y = (v: number) => A - folga - ((v - minimo) / Math.max(1e-9, maximo - minimo)) * (A - 2 * folga);
  const traco = serie.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${traco} L${x(serie.length - 1).toFixed(1)} ${A} L${x(0).toFixed(1)} ${A} Z`;
  const atraso = { animationDelay: `${indice * 50}ms` };
  return (
    <svg viewBox={`0 0 ${L} ${A}`} width={L} height={A} role="img" aria-label={rotulo} className="h-auto w-12 shrink-0 overflow-visible md:w-[72px]">
      <title>{rotulo}</title>
      <path d={area} fill="var(--chart-1)" fillOpacity={0.1} className="mini-area" style={atraso} />
      <path d={traco} pathLength={1} fill="none" stroke="var(--chart-1)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="mini-traco" style={atraso} />
      <circle cx={x(serie.length - 1)} cy={y(serie[serie.length - 1])} r={2.75} fill="var(--chart-1)" className="mini-fim" style={{ animationDelay: `${indice * 50 + 800}ms` }} />
    </svg>
  );
}
