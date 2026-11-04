import { CircleAlert, Clock } from "lucide-react";
import type { ReactNode } from "react";
import type { Estado } from "../lib/dados";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

type Props<T> = {
  titulo: string;
  descricao?: string;
  estado: Estado<T>;
  altura?: number;
  children: (dados: T) => ReactNode;
};

/**
 * Um cartão de gráfico que sabe esperar: enquanto a tabela carrega, um
 * esqueleto do mesmo tamanho; se a área ainda não publicou a tabela, avisa
 * em vez de quebrar a página.
 */
export function Painel<T>({ titulo, descricao, estado, altura = 300, children }: Props<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent>
        {estado.tipo === "carregando" && <Skeleton style={{ height: altura }} />}
        {estado.tipo === "ausente" && (
          <Aviso altura={altura} icone={<Clock className="size-5" />}>
            Esta área ainda não publicou estes dados.
          </Aviso>
        )}
        {estado.tipo === "erro" && (
          <Aviso altura={altura} icone={<CircleAlert className="size-5" />}>
            Não foi possível carregar os dados ({estado.mensagem}).
          </Aviso>
        )}
        {estado.tipo === "pronto" && children(estado.dados)}
      </CardContent>
    </Card>
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
