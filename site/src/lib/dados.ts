import { parquetReadObjects } from "hyparquet";
import { decompress } from "fzstd";
import { useEffect, useState } from "react";

// A gold sai do DuckDB em ZSTD; o hyparquet só traz o Snappy embutido.
const compressors = { ZSTD: (entrada: Uint8Array) => decompress(entrada) };

/*
 * Os dados não vêm no build: cada área tem a sua gold no Hugging Face
 * (gold-analise-mercado-<área>), e o site lê de lá as tabelas que a página
 * pede. A base fica numa variável para poder trocar o Hub por outro
 * endereço (um bucket R2, por exemplo) sem mexer nas páginas.
 */
const BASE = (import.meta.env.VITE_DADOS_BASE as string | undefined) ?? "https://huggingface.co";

// O Hub responde 404 a toda requisição com Referer de *.workers.dev (o
// endereço do site), na API e nos arquivos; sem Referer, a mesma requisição
// passa. A origem continua indo, que é o que o CORS precisa.
const SEM_REFERER: RequestInit = { referrerPolicy: "no-referrer" };

export type Linha = Record<string, unknown>;

type InfoGold = { sha: string; atualizado: Date; tabelas: Set<string> };

const infos = new Map<string, Promise<InfoGold>>();
const tabelas = new Map<string, Promise<Linha[] | null>>();

/** O commit atual e as tabelas publicadas de uma gold. Uma chamada por repositório e sessão. */
export function infoGold(repo: string): Promise<InfoGold> {
  let info = infos.get(repo);
  if (!info) {
    info = fetch(`${BASE}/api/datasets/${repo}`, SEM_REFERER)
      .then((r) => {
        if (!r.ok) throw new Error(`${repo}: HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { sha: string; lastModified: string; siblings?: { rfilename: string }[] }) => ({
        sha: d.sha,
        atualizado: new Date(d.lastModified),
        tabelas: new Set(
          (d.siblings ?? []).map((s) => s.rfilename).filter((f) => f.endsWith(".parquet")).map((f) => f.slice(0, -8)),
        ),
      }));
    info.catch(() => infos.delete(repo));
    infos.set(repo, info);
  }
  return info;
}

/** Números grandes do Parquet chegam como BigInt; os gráficos e a formatação querem Number. */
function normalizar(linha: Linha): Linha {
  for (const k in linha) if (typeof linha[k] === "bigint") linha[k] = Number(linha[k]);
  return linha;
}

/**
 * Uma tabela inteira da gold. As tabelas são agregados pequenos (poucos KB a
 * 1 MB), então vem o arquivo todo. null quando a área ainda não publicou a
 * tabela — o que é normal: cada etapa da gold roda separada.
 */
export function lerTabela(repo: string, nome: string): Promise<Linha[] | null> {
  const chave = `${repo}/${nome}`;
  let tabela = tabelas.get(chave);
  if (!tabela) {
    tabela = infoGold(repo).then(async (info) => {
      if (!info.tabelas.has(nome)) return null;
      // Pela revisão, não por "main": o endereço não muda enquanto a gold
      // não for republicada, e o cache do navegador pode guardá-lo.
      const r = await fetch(`${BASE}/datasets/${repo}/resolve/${info.sha}/${nome}.parquet`, SEM_REFERER);
      if (!r.ok) throw new Error(`${nome}: HTTP ${r.status}`);
      const linhas = (await parquetReadObjects({ file: await r.arrayBuffer(), compressors })) as Linha[];
      return linhas.map(normalizar);
    });
    tabela.catch(() => tabelas.delete(chave));
    tabelas.set(chave, tabela);
  }
  return tabela;
}

export type Estado<T> =
  | { tipo: "carregando" }
  | { tipo: "ausente" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "pronto"; dados: T };

/** Lê uma tabela e a transforma; refaz quando o repositório ou a tabela mudam. */
export function useTabela<T>(repo: string, nome: string, transformar: (linhas: Linha[]) => T): Estado<T> {
  const [estado, setEstado] = useState<Estado<T>>({ tipo: "carregando" });
  useEffect(() => {
    let vivo = true;
    setEstado({ tipo: "carregando" });
    lerTabela(repo, nome).then(
      (linhas) => vivo && setEstado(linhas ? { tipo: "pronto", dados: transformar(linhas) } : { tipo: "ausente" }),
      (e: unknown) => vivo && setEstado({ tipo: "erro", mensagem: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
    // `transformar` é uma função pura de cada página; mudar só ela não pede outra leitura.
  }, [repo, nome]);
  return estado;
}
