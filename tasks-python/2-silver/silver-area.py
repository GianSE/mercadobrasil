"""
Silver de área — recorta da silver completa (a base inteira já traduzida) o
que é da área pedida em AREA e publica na pasta da base no repositório da
área (Gianpedro/mercadobrasil-tec/silver-caged-tec/..., Gianpedro/mercadobrasil-saude/silver-rais-saude/...).

Não traduz nada: a tradução é a da silver completa, a mesma da silver de TI
(silver-caged-ti.py com --completa). Recortar TI da completa dá, linha a
linha, a silver-caged-ti publicada — conferido em caged_mov, caged_old e
rais_estab, diferença zero. Por isso uma área nova custa um filtro, e não
uma releitura da bronze com todos os joins de dicionário.

Vale para TI também. No TCC (repositório mercadotech) a silver de TI sai da
bronze, traduzida e recortada de uma vez (silver-caged-ti.py); a daqui tem as
mesmas linhas e, a mais, a coluna arquivo_bronze, que a completa carrega.

    AREA=saude python silver-area.py --base caged --modo verificar [--ano-inicio N] [--ano-fim N] [--forcar]
        Compara a silver completa com a da área por LISTAGEM de partição
        (sem ler dado) e imprime o JSON de (tabela, ano) pendentes.

    AREA=saude python silver-area.py --base caged --modo processar --tabela X --ano-inicio Y --ano-fim Y
"""
import argparse
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

_AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI))
sys.path.insert(0, str(_AQUI.parent))

from silver_caged import mapeamento as mp_caged  # noqa: E402
from silver_rais import mapeamento as mp_rais  # noqa: E402
from _utils import areas, escopo_tecnologia as esc, log, nuvem, telegram  # noqa: E402
from _utils.cartoes_raiz import publicar_raiz  # noqa: E402

log.ativar_horario()

TABELAS = {"caged": tuple(mp_caged.TODAS_TABELAS), "rais": tuple(mp_rais.TABELAS_RAIS)}


def _argumentos():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base", choices=sorted(TABELAS), required=True)
    p.add_argument("--modo", choices=("verificar", "processar"), required=True)
    p.add_argument("--tabela", nargs="+")
    p.add_argument("--ano-inicio", type=int, default=0)
    p.add_argument("--ano-fim", type=int, default=9999)
    # Refaz os anos do intervalo mesmo que já estejam na silver da área: a
    # listagem não enxerga um ano da completa que foi reprocessado depois.
    p.add_argument("--forcar", action="store_true")
    args = p.parse_args()
    if args.modo == "processar" and not (args.ano_inicio and args.ano_fim != 9999):
        raise SystemExit("--modo processar precisa de --ano-inicio e --ano-fim")
    args.tabela = args.tabela or list(TABELAS[args.base])
    invalidas = set(args.tabela) - set(TABELAS[args.base])
    if invalidas:
        raise SystemExit(f"tabela(s) fora da base {args.base}: {sorted(invalidas)}")
    args.rotulo = f"Silver {args.base.upper()} {areas.AREAS[esc.AREA]['nome']}"
    return args


def _cartao(base: str, repo: str) -> Path:
    """O README do conjunto: de onde veio e qual é o recorte, para quem baixar sem ler o código."""
    nome = areas.AREAS[esc.AREA]["nome"]
    fonte = "CAGED" if base == "caged" else "RAIS"
    origem = nuvem.REPO_SILVER_CAGED if base == "caged" else nuvem.REPO_SILVER_RAIS
    cnaes = "\n".join(f"  - `{c}` {d}" for c, d in esc.CNAE_TI.items())
    familias = "\n".join(f"  - `{f}` {d}" for f, d in esc.CBO_FAMILIAS_TI.items())
    avulsos = "\n".join(f"  - `{c}` {d}" for c, d in esc.CBO_AVULSOS_TI.items())
    subareas = "\n".join(f"- **{a}**: {', '.join(fams)}" for a, fams in esc.AREAS_TI.items())
    texto = f"""---
license: odc-by
language:
  - pt
tags:
  - brazil
  - labor-market
  - {base}
  - {esc.AREA}
pretty_name: {fonte} — Mercado de Trabalho em {nome}
---

# {fonte} — Mercado de Trabalho em {nome} (Brasil)

Microdados da **{fonte}** (Ministério do Trabalho e Emprego) recortados para
o mercado de trabalho em **{esc.SIGLA}**. É a silver completa
([{origem}](https://huggingface.co/datasets/{origem})) — as mesmas colunas,
já traduzidas pelos dicionários oficiais do MTE — só com as linhas da área.
As lacunas e os cuidados de uso da fonte estão no cartão dela.

## Recorte

União de duas lentes, que descrevem populações diferentes:

- **Setor** — quem trabalha em estabelecimento da área, pela subclasse CNAE:
{cnaes}
- **Ocupação** — quem exerce ocupação da área, em qualquer setor, pela
  família CBO (4 primeiros dígitos):
{familias}
{"- Códigos CBO avulsos, fora das famílias acima:" + chr(10) + avulsos if avulsos else ""}

O recorte é por código, nunca por palavra-chave na descrição.

## Subáreas

{subareas}

## Cuidado

As listas desta área ainda não passaram pela verificação que o recorte de TI
teve (o peso de cada família e o que ela arrasta de carona). Confira antes de
publicar números.

## Licença e citação

Dados originais são públicos (MTE/PDET). Este derivado é distribuído sob
ODC-BY: cite a fonte original e este tratamento.
"""
    nuvem.preparar_staging()
    local = nuvem.DIR_TEMP / f"cartao_{base}_{esc.AREA}.md"
    local.write_text(texto, encoding="utf-8")
    return local


def _particoes(repo: str, pasta: str) -> set[tuple[int, int | None]]:
    """(ano, mês) das partições de uma tabela num repo, pela listagem. Mês None nas tabelas anuais."""
    padrao = re.compile(rf"^{re.escape(pasta)}/ano_particao=(\d{{4}})(?:/mes_particao=(\d{{1,2}}))?/[^/]+\.parquet$")
    vistas = set()
    for caminho in nuvem.arquivos_remotos(repo):
        if m := padrao.match(caminho):
            vistas.add((int(m.group(1)), int(m.group(2)) if m.group(2) else None))
    return vistas


def modo_verificar(args) -> int:
    ano_inicio = args.ano_inicio or (time.localtime().tm_year - 1)
    ano_fim = args.ano_fim if args.ano_fim != 9999 else time.localtime().tm_year

    pares = []
    for tabela in args.tabela:
        completa = _particoes(nuvem.repo_silver(tabela, completa=True), tabela)
        area = _particoes(nuvem.repo_silver(tabela), nuvem.pasta_silver(tabela))
        # Um mês da completa sem o mesmo mês na área deixa o ano inteiro
        # pendente: a publicação substitui o ano, nunca só o mês.
        candidatos = {a for a, _ in completa} if args.forcar else {a for a, _ in completa - area}
        faltam = sorted(a for a in candidatos if ano_inicio <= a <= ano_fim)
        print(f"   {tabela}: {len({a for a, _ in completa})} ano(s) na completa, "
              f"{len({a for a, _ in area})} na área, {len(faltam)} pendente(s)")
        pares += [{"tabela": tabela, "ano": a} for a in faltam]

    saida = {"tem_novidade": bool(pares), "anos": pares}
    print(json.dumps(saida, ensure_ascii=False, indent=2))

    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"tem_novidade={str(saida['tem_novidade']).lower()}\n")
            f.write(f"anos={json.dumps(saida['anos'])}\n")

    situacao = "tem ano pendente, recortando." if pares else "verificado, já em dia."
    telegram.notificar(f"🔎 *{args.rotulo}*: {situacao}")
    return 0


def recortar(con, tabela: str, ano: int) -> bool:
    """Um ano de uma tabela: lê da completa, filtra pela área, publica substituindo o ano."""
    inicio = time.time()
    fonte = nuvem.fonte_parquet(nuvem.repo_silver(tabela, completa=True),
                                f"{tabela}/ano_particao={ano}/**/*.parquet")
    leitura = f"read_parquet({fonte}, union_by_name = true, hive_partitioning = true)"
    try:
        colunas = nuvem.com_espera_na_leitura(
            lambda: [r[0] for r in con.execute(f"DESCRIBE SELECT * FROM {leitura}").fetchall()], f"{tabela} {ano}")
    except Exception as e:
        if "No files found" in str(e):
            print(f"   ⏭️  {tabela} {ano}: não está na silver completa")
            return True
        raise

    col_cnae, col_cbo = esc.colunas_da_tabela(tabela, colunas)
    filtro = esc.sql_filtro_tecnologia(f'"{col_cnae}"' if col_cnae else None,
                                       f'"{col_cbo}"' if col_cbo else None)
    # A silver de TI grava sem recorte quando falta a coluna; aqui isso
    # copiaria a base inteira para a área. Melhor parar.
    if not filtro:
        print(f"   ❌ {tabela} {ano}: sem coluna de CNAE nem de CBO, nada recortado")
        return False

    # Mensal ou anual pelo CAMINHO na completa, não pela coluna: a RAIS é
    # anual e mesmo assim traz mes_particao (vazia) dentro do arquivo.
    origem = nuvem.repo_silver(tabela, completa=True)
    mensal = any(a.startswith(f"{tabela}/ano_particao={ano}/mes_particao=")
                 for a in nuvem.arquivos_remotos(origem))
    particao = ["ano_particao"] + (["mes_particao"] if mensal else [])
    destino = nuvem.DIR_TEMP / f"silver_{esc.AREA}" / tabela
    shutil.rmtree(destino, ignore_errors=True)
    destino.mkdir(parents=True, exist_ok=True)

    print(f"   ✂️  {tabela} {ano}: lentes {col_cnae or '—'} / {col_cbo or '—'}")

    def copiar():
        # Recomeça do zero a cada tentativa: um COPY interrompido deixa
        # pedaços que somariam em dobro com os da tentativa seguinte.
        shutil.rmtree(destino, ignore_errors=True)
        destino.mkdir(parents=True, exist_ok=True)
        con.execute(f"""
            COPY (SELECT * FROM {leitura} WHERE {filtro})
            TO '{destino.as_posix()}' (FORMAT PARQUET, COMPRESSION 'ZSTD', COMPRESSION_LEVEL 3,
                                        PARTITION_BY ({', '.join(particao)}), OVERWRITE_OR_IGNORE,
                                        FILENAME_PATTERN '{tabela}_{{uuid}}')
        """)

    nuvem.com_espera_na_leitura(copiar, f"{tabela} {ano}")
    # Conferência pelo que FOI escrito: só o count(*) do destino prova que
    # saiu legível. Zero linhas é resultado válido (o COPY não cria arquivo).
    try:
        linhas = con.execute(f"SELECT count(*) FROM read_parquet('{destino.as_posix()}/**/*.parquet')").fetchone()[0]
    except Exception as e:
        if "No files found" not in str(e):
            raise
        linhas = 0
    if linhas:
        nuvem.publicar_particoes(con, destino, nuvem.repo_silver(tabela), tabela, pasta=nuvem.pasta_silver(tabela))
    print(f"   📊 {tabela} {ano}: {linhas:,} linhas em {(time.time() - inicio) / 60:.1f} min")
    shutil.rmtree(destino, ignore_errors=True)
    return True


def modo_processar(args) -> int:
    con = nuvem.conectar_duckdb()
    tarefas = [(t, a) for t in args.tabela for a in range(args.ano_inicio, args.ano_fim + 1)]
    sucesso = 0
    for tabela, ano in tarefas:
        try:
            sucesso += recortar(con, tabela, ano)
        except Exception as e:
            print(f"   ❌ {tabela} {ano}: {str(e)[:300]}")

    icone = "🏁" if sucesso == len(tarefas) else "⚠️"
    telegram.notificar(f"{icone} *{args.rotulo}*: {sucesso}/{len(tarefas)} "
                       f"({', '.join(args.tabela)} {args.ano_inicio})")
    return 0 if sucesso == len(tarefas) else 2


def main() -> int:
    args = _argumentos()
    repo = nuvem.repo_silver(args.tabela[0])
    publicar_raiz(repo, esc.AREA)
    # O cartão da base fica na pasta dela. No CAGED ele é do
    # gold-caged-consolidado (gold_caged/publicar_hf.py), que publica na mesma
    # pasta: aqui só nasce, para os dois não se sobrescreverem a cada execução.
    # Na RAIS o cartão é só deste script.
    cartao = f"{nuvem.pasta_base(args.base)}/README.md"
    if args.base == "rais" or not nuvem.existe_remoto(repo, cartao):
        if nuvem.publicar_cartao(repo, _cartao(args.base, repo), cartao):
            print(f"   📝 cartão de {repo}/{cartao} atualizado")
    if args.modo == "verificar":
        return modo_verificar(args)
    return modo_processar(args)


if __name__ == "__main__":
    sys.exit(main())
