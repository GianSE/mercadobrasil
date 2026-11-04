import { ChartColumn, CircleAlert, Clock, Table } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Estado } from "../lib/dados";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export type Tabela = {
  colunas: { chave: string; rotulo: string; formato?: (v: number) => string }[];
  linhas: Record<string, unknown>[];
};

type Props<T> = {
  titulo: string;
  descricao?: ReactNode;
  /** `anterior`: o resultado da consulta passada, mostrado esmaecido enquanto a nova carrega. */
  estado: Estado<T> & { anterior?: T };
  altura?: number;
  /** Os mesmos números do gráfico, em tabela: o leitor de tela e quem quer o número exato. */
  tabela?: (dados: T) => Tabela;
  /** Controles do gráfico (Ano/Mês, séries), entre o título e o gráfico. */
  controles?: ReactNode;
  children: (dados: T) => ReactNode;
};

/**
 * O cartão de um gráfico. Enquanto a tabela carrega pela primeira vez, um
 * esqueleto do mesmo tamanho; se a área ainda não publicou a tabela, um
 * aviso em vez de quebrar a página.
 */
export function Painel<T>({ titulo, descricao, estado, altura = 300, tabela, controles, children }: Props<T>) {
  const [verTabela, setVerTabela] = useState(false);
  const dados = estado.tipo === "pronto" ? estado.dados : estado.tipo === "carregando" ? estado.anterior : undefined;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>{titulo}</CardTitle>
          {descricao && <CardDescription>{descricao}</CardDescription>}
        </div>
        {tabela && dados !== undefined && (
          <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => setVerTabela((v) => !v)} aria-pressed={verTabela}>
            {verTabela ? <ChartColumn aria-hidden /> : <Table aria-hidden />}
            {verTabela ? "Gráfico" : "Tabela"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {controles}
        {dados !== undefined ? (
          <div className={cn("transition-opacity", estado.tipo === "carregando" && "opacity-50")} aria-busy={estado.tipo === "carregando"}>
            {verTabela && tabela ? <TabelaDados {...tabela(dados)} altura={altura} /> : children(dados)}
          </div>
        ) : estado.tipo === "carregando" ? (
          <Skeleton style={{ height: altura }} />
        ) : estado.tipo === "ausente" ? (
          <Aviso altura={altura} icone={<Clock className="size-5" />}>
            Esta área ainda não publicou estes dados.
          </Aviso>
        ) : estado.tipo === "erro" ? (
          <Aviso altura={altura} icone={<CircleAlert className="size-5" />}>
            Não foi possível carregar os dados ({estado.mensagem}).
          </Aviso>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TabelaDados({ colunas, linhas, altura }: Tabela & { altura: number }) {
  return (
    <div className="overflow-auto rounded-lg border" style={{ maxHeight: altura }}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-secondary text-left">
          <tr>
            {colunas.map((c, i) => (
              <th key={c.chave} className={cn("px-3 py-2 font-medium", i > 0 && "text-right")}>
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t">
              {colunas.map((c, j) => {
                const v = l[c.chave];
                const texto = v === null || v === undefined ? "—" : c.formato ? c.formato(Number(v)) : String(v);
                return (
                  <td key={c.chave} className={cn("px-3 py-1.5", j > 0 && "text-right")}>
                    {texto}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Aviso({ altura, icone, children }: { altura: number; icone: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{ height: altura }}
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground"
    >
      {icone}
      {children}
    </div>
  );
}
