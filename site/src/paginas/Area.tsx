import { ArrowLeft } from "lucide-react";
import { lazy, Suspense, useEffect, type ComponentProps } from "react";
import { Link, useLocation } from "wouter";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { acharArea, AREAS, iconeDa, type Area as TipoArea } from "../lib/areas";
import { ProvedorFiltro } from "../lib/filtro";
import { cn } from "../lib/utils";
import { VisaoGeral } from "./area/VisaoGeral";

// As seções que consultam com SQL trazem o DuckDB: só carregam quando abertas.
const Crescimento = lazy(() => import("./area/Crescimento").then((m) => ({ default: m.Crescimento })));

/** As seções da área, na ordem das abas. `pronta: false` aparece desativada, como "em breve". */
const SECOES = [
  { id: "", rotulo: "Visão geral", pronta: true },
  { id: "crescimento", rotulo: "Crescimento", pronta: true },
  { id: "onde", rotulo: "Onde", pronta: false },
  { id: "trabalho", rotulo: "Trabalho", pronta: false },
  { id: "modelos", rotulo: "Modelos", pronta: false },
] as const;

export function Area({ slug, secao = "" }: { slug: string; secao?: string }) {
  const area = acharArea(slug);
  const atual = SECOES.find((s) => s.id === secao && s.pronta);
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
  const caminho = (slug: string, id: string) => `/${slug}${id ? `/${id}` : ""}`;

  return (
    <ProvedorFiltro>
      <main className="mx-auto max-w-6xl px-4 pb-8">
        <nav className="flex flex-wrap items-center gap-2 py-6" aria-label="Áreas">
          <Link href="/" className="mr-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Áreas
          </Link>
          {AREAS.map((a) => (
            <Link
              key={a.slug}
              href={caminho(a.slug, secao)}
              aria-current={a.slug === area.slug ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                a.slug === area.slug ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {a.nome}
            </Link>
          ))}
        </nav>

        <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary">
            <Icone className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{area.nome}</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">{area.resumo}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {area.subareas.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
          </div>
        </header>

        <nav className="mb-6 flex gap-1 overflow-x-auto border-b" aria-label="Seções">
          {SECOES.map((s) =>
            s.pronta ? (
              <LinkComFiltros
                key={s.id}
                href={caminho(area.slug, s.id)}
                aria-current={s.id === secao ? "page" : undefined}
                className={cn(
                  "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
                  s.id === secao ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {s.rotulo}
              </LinkComFiltros>
            ) : (
              <span key={s.id} className="shrink-0 cursor-default px-3 py-2 text-sm text-muted-foreground/60" title="Em breve">
                {s.rotulo}
              </span>
            ),
          )}
        </nav>

        <Suspense fallback={<Skeleton className="h-96" />}>
          {secao === "" && <VisaoGeral area={area} />}
          {secao === "crescimento" && <Crescimento area={area} />}
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
