import { ArrowLeft, BriefcaseBusiness, ChevronDown, Clock, FlaskConical, LayoutDashboard, MapPin, TrendingUp } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { Link, useLocation } from "wouter";
import { Skeleton } from "../components/ui/skeleton";
import { acharArea, AREAS, iconeDa, type Area as TipoArea } from "../lib/areas";
import { infoGold } from "../lib/dados";
import { ProvedorFiltro } from "../lib/filtro";
import { cn } from "../lib/utils";
import { VisaoGeral } from "./area/VisaoGeral";

// As seções que consultam com SQL trazem o DuckDB: só carregam quando abertas.
const Crescimento = lazy(() => import("./area/Crescimento").then((m) => ({ default: m.Crescimento })));
const Onde = lazy(() => import("./area/Onde").then((m) => ({ default: m.Onde })));
const Trabalho = lazy(() => import("./area/Trabalho").then((m) => ({ default: m.Trabalho })));
const Modelos = lazy(() => import("./area/Modelos").then((m) => ({ default: m.Modelos })));

/** As seções da área, na ordem das abas. */
const SECOES = [
  { id: "", rotulo: "Visão geral", icone: LayoutDashboard },
  { id: "crescimento", rotulo: "Crescimento", icone: TrendingUp },
  { id: "onde", rotulo: "Onde", icone: MapPin },
  { id: "trabalho", rotulo: "Trabalho", icone: BriefcaseBusiness },
  { id: "modelos", rotulo: "Modelos", icone: FlaskConical },
] as const;

export function Area({ slug, secao = "" }: { slug: string; secao?: string }) {
  const area = acharArea(slug);
  const atual = SECOES.find((s) => s.id === secao);
  useEffect(() => {
    document.title = area ? `${area.nome}${atual?.id ? ` · ${atual.rotulo}` : ""} · Mercado Brasil` : "Mercado Brasil";
  }, [area, atual]);

  if (!area || !atual) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-2xl font-semibold">{area ? "Seção não encontrada" : "Área não encontrada"}</h1>
        <Link href={area ? `/${area.slug}` : "/"} className="mt-4 inline-block underline underline-offset-4">
          {area ? `Voltar para ${area.nome}` : "Ver as áreas disponíveis"}
        </Link>
      </main>
    );
  }
  // A key remonta a área ao trocar: nenhum dado nem filtro de uma aparece na outra.
  return <LayoutArea key={area.slug} area={area} secao={atual.id} />;
}

function LayoutArea({ area, secao }: { area: TipoArea; secao: string }) {
  const Icone = iconeDa(area);
  // Área criada há pouco, que ainda não rodou a gold: um aviso só, no topo,
  // em vez de cada cartão dizer sozinho que não há dados.
  const [semGold, setSemGold] = useState(false);
  useEffect(() => {
    infoGold(area.repo).then((i) => setSemGold(i.tabelas.size === 0), () => {});
  }, [area.repo]);
  const caminho = (slug: string, id: string) => `/${slug}${id ? `/${id}` : ""}`;
  const [, navegar] = useLocation();

  return (
    <ProvedorFiltro>
      <main className="mx-auto max-w-6xl px-4 pb-8">
        {/* Navegação secundária, discreta: voltar e trocar de área. */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-5">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <ArrowLeft className="size-4" aria-hidden /> Todas as áreas
          </Link>
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only sm:not-sr-only">Trocar de área</span>
            <span className="relative">
              <select
                className="h-9 appearance-none rounded-md border bg-card pr-8 pl-3 text-sm font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={area.slug}
                onChange={(e) => navegar(caminho(e.target.value, secao))}
              >
                {AREAS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.nome}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" aria-hidden />
            </span>
          </label>
        </div>

        {/* O que é a área: o maior peso da página. As subáreas são informação, e não controles: texto corrido. */}
        <header className="flex items-start gap-4 pb-6">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Icone className="size-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{area.nome}</h1>
            <p className="mt-1 max-w-3xl text-muted-foreground">{area.resumo}</p>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Subáreas:</span> {area.subareas.join("\u00a0· ")}
            </p>
          </div>
        </header>

        {/* As seções: a navegação principal da área, na largura toda, com cara de botão. */}
        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5 shadow-xs" aria-label="Seções">
          {SECOES.map((s) => (
            <LinkComFiltros
              key={s.id}
              href={caminho(area.slug, s.id)}
              aria-current={s.id === secao ? "page" : undefined}
              className={cn(
                "inline-flex min-w-fit flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:flex-row sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm",
                s.id === secao ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <s.icone className="size-4 shrink-0" aria-hidden />
              {s.rotulo}
            </LinkComFiltros>
          ))}
        </nav>

        {semGold && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-medium">{area.nome} ainda não tem dados publicados.</span>{" "}
              <span className="text-muted-foreground">A área já está definida; os números aparecem aqui quando a pipeline dela rodar.</span>
            </p>
          </div>
        )}

        <Suspense fallback={<Skeleton className="h-96" />}>
          {secao === "" && <VisaoGeral area={area} />}
          {secao === "crescimento" && <Crescimento area={area} />}
          {secao === "onde" && <Onde area={area} />}
          {secao === "trabalho" && <Trabalho area={area} />}
          {secao === "modelos" && <Modelos area={area} />}
        </Suspense>
      </main>
    </ProvedorFiltro>
  );
}

/**
 * Link de aba que leva junto os filtros do endereço (?uf=, ?periodo=):
 * trocar de seção não perde o recorte. Lidos no clique, não na renderização,
 * porque o filtro muda sem a aba ser redesenhada.
 */
function LinkComFiltros({ href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const [, navegar] = useLocation();
  return (
    <Link
      href={href}
      {...props}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navegar(href + window.location.search);
      }}
    />
  );
}
