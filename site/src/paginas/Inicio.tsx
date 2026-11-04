import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Variacao } from "../components/Indicador";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { AREAS, iconeDa, type Area } from "../lib/areas";
import { useTabela } from "../lib/dados";
import { fmt } from "../lib/formato";
import { estoqueAnual, resumir } from "../lib/rais";

export function Inicio() {
  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="py-12 sm:py-16">
        <p className="text-sm font-medium text-muted-foreground">RAIS e CAGED · Ministério do Trabalho e Emprego</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          O mercado de trabalho formal no Brasil, área por área
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Quantos vínculos existem, onde estão, quanto pagam e como mudaram desde 2007. Escolha uma área para começar.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map((a) => (
          <CartaoArea key={a.slug} area={a} />
        ))}
      </section>
    </main>
  );
}

function CartaoArea({ area }: { area: Area }) {
  const Icone = iconeDa(area);
  const estado = useTabela(area.repo, "rais_estoque_anual", (l) => resumir(estoqueAnual(l)));
  return (
    <Link href={`/${area.slug}`} className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <Card className="h-full transition-colors group-hover:border-foreground/25">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-lg bg-secondary">
            <Icone className="size-5" aria-hidden />
          </div>
          <CardTitle className="text-lg">{area.nome}</CardTitle>
          <CardDescription>{area.resumo}</CardDescription>
        </CardHeader>
        <CardContent className="mt-auto flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            {estado.tipo === "pronto" && estado.dados ? (
              <>
                <span className="text-xs text-muted-foreground">Vínculos ativos em 31/12/{estado.dados.ano}</span>
                <span className="text-2xl font-semibold tracking-tight">{fmt.inteiro(estado.dados.estoque)}</span>
                {estado.dados.variacao != null && <Variacao v={estado.dados.variacao} sufixo="no ano" />}
              </>
            ) : estado.tipo === "carregando" ? (
              <>
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-8 w-32" />
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Dados ainda não publicados</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Badge>{area.subareas.length} subáreas</Badge>
            <span className="inline-flex items-center gap-1 text-sm font-medium">
              Ver área <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
