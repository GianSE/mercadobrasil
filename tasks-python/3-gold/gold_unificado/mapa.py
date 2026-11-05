"""
Agregados territoriais das DUAS bases, para o mapa do dashboard.

POR QUE JUNTAR AS DUAS NO MESMO MAPA
------------------------------------
Cada base pinta metade do quadro, e a metade que falta é sempre a que muda a
conclusão:

    RAIS  -> ESTOQUE. Onde o emprego de TI ESTÁ hoje.
    CAGED -> FLUXO.   Onde ele está SE MOVENDO agora.

São Paulo domina o estoque e vai dominar em qualquer mapa de nível — o que não
diz nada que já não se soubesse. O interessante é onde as duas leituras
DIVERGEM: um estado com estoque pequeno e fluxo forte está crescendo rápido; um
com estoque grande e fluxo negativo está encolhendo em silêncio. Nenhuma das
duas bases sozinha mostra isso.

UMA PARTE POR BASE
------------------
O CAGED sai todo mês e a RAIS uma vez por ano, e cada uma tem a sua fila (ver
.github/workflows/pipeline-caged.yml e pipeline-rais.yml). Por isso o mapa é
montado em duas partes, cada uma gravada na gold:

    mapa_<nível>_fluxo    só do CAGED
    mapa_<nível>_estoque  só da RAIS

e `mapa_<nível>`, o que o site lê, é a junção das duas — segundos, sobre
tabelas pequenas. A fila de uma base refaz só a parte dela e pega a outra já
publicada: o mensal do CAGED nunca relê a RAIS, que é a base pesada.

A CHAVE COMUM
-------------
A RAIS não tem coluna de UF e o CAGED tem — mas as duas gravam
`municipio_descricao` no mesmo formato, com a sigla no prefixo ('Sp-Campinas',
'Es-Serra'). Derivar a UF do prefixo nas DUAS é o que garante que estão
falando da mesma coisa; usar `uf_descricao` num lado e o prefixo no outro
abriria espaço para divergência silenciosa em município com nome ambíguo.

Uso:
    python -m gold_unificado.mapa --base caged   # refaz o fluxo, junta com o estoque publicado
    python -m gold_unificado.mapa --base rais    # refaz o estoque, junta com o fluxo publicado
    python -m gold_unificado.mapa                # refaz as duas
"""
import argparse
import datetime
import shutil
import sys
import time
from pathlib import Path

from _utils import incremental, nuvem
from _utils import escopo_tecnologia as esc

UF = "upper(split_part(municipio_descricao, '-', 1))"
MUNICIPIO = "municipio_descricao"
# As TRÊS tabelas (caged_mov, caged_old, rais_vinc) gravam o código IBGE de 6
# dígitos na mesma coluna. Levá-lo adiante é o que permite juntar com as
# coordenadas sem casar por nome — e nome de município é chave ruim: existem 21
# "Bom Jesus" no Brasil, e a base do MTE grava sem acento.
CODIGO = "municipio"


# Funções, e não constantes: a fonte de cada base só é listada (e, com a cópia
# local ligada, baixada) se a parte dela for de fato recalculada.
def _caged(ano_inicio: int = 0) -> str | None:
    """
    O CAGED da área, nas duas gerações, com o território normalizado.

    Com `ano_inicio`, só as competências desse ano em diante, lendo só os
    arquivos desse ano em diante. Basta isso porque a silver é particionada
    pelo ano do ARQUIVO, e uma competência nunca chega antes do seu ano: a
    declaração atrasada de dezembro de 2025 vem num arquivo de 2026, nunca o
    contrário. Já os anos anteriores a `ano_inicio` ficariam incompletos lidos
    assim (falta o que chegou nos arquivos deles), e por isso não são refeitos.
    """
    if not ano_inicio:
        mov, old = nuvem.fonte_silver_ti("caged_mov"), nuvem.fonte_silver_ti("caged_old")
    else:
        mov, old = nuvem.fonte_silver_ti_desde("caged_mov", ano_inicio), nuvem.fonte_silver_ti_desde("caged_old", ano_inicio)
    partes = []
    if mov:
        partes.append(f"""
    SELECT year(competenciamov_data) AS ano,
           {UF} AS uf, {MUNICIPIO} AS municipio, {CODIGO} AS cod_municipio,
           saldomovimentacao AS saldo
    FROM read_parquet({mov}, hive_partitioning=true)
    WHERE competenciamov_data IS NOT NULL AND municipio_descricao IS NOT NULL
      AND year(competenciamov_data) >= {ano_inicio}""")
    if old:
        partes.append(f"""
    SELECT year(competencia_declarada_data), {UF}, {MUNICIPIO}, {CODIGO}, saldo_mov
    FROM read_parquet({old}, hive_partitioning=true)
    WHERE competencia_declarada_data IS NOT NULL AND municipio_descricao IS NOT NULL
      AND year(competencia_declarada_data) >= {ano_inicio}""")
    # Nenhum arquivo desse ano em diante: nada a recalcular (ver _sql_fluxo_incremental).
    return "\n    UNION ALL".join(partes) if partes else None


def _rais(ano_inicio: int = 0) -> str | None:
    """
    A RAIS da área. Com `ano_inicio`, só os anos desse em diante: na RAIS o
    ano é o do arquivo, então ler os arquivos desses anos basta. O filtro de
    Rondônia é por ano e código, e vale igual sobre os anos lidos.
    """
    fonte = nuvem.fonte_silver_ti_desde("rais_vinc", ano_inicio) if ano_inicio else nuvem.fonte_silver_ti("rais_vinc")
    if fonte is None:
        return None
    return f"""
    SELECT ano_particao AS ano, {UF} AS uf, {MUNICIPIO} AS municipio,
           {CODIGO} AS cod_municipio,
           vinculo_ativo_3112, vl_remun_media_sm,
           {esc.sql_classificacao('cnae_20_subclasse', 'cbo_ocupacao_2002')}
    FROM read_parquet({fonte}, hive_partitioning=true)
    WHERE municipio_descricao IS NOT NULL
      -- Sem o funcionalismo de Rondônia declarado como programador
      -- (ver escopo_tecnologia.ARTEFATO_RO).
      AND {esc.sql_sem_artefato_rais(fonte)}
"""


# Teto de plausibilidade da remuneração — ver gold_rais.construir_gold: a fonte
# inverte a conversão para salário mínimo em alguns registros a partir de 2023.
REMUN = ("CASE WHEN vinculo_ativo_3112 = '1' AND vl_remun_media_sm > 0 "
         "AND vl_remun_media_sm <= 500 THEN vl_remun_media_sm END")

NIVEIS = {"uf": "uf", "municipio": "uf, municipio, cod_municipio"}
# Cada parte e a base que a calcula.
PARTES = {"fluxo": "caged", "estoque": "rais"}


def _sql_parte(parte: str, nivel: str, ano_inicio: int = 0) -> str:
    chave = NIVEIS[nivel]
    if parte == "fluxo":
        return f"""
            SELECT ano, {chave},
                   sum(saldo)                            AS saldo,
                   count(*) FILTER (WHERE saldo = 1)     AS admissoes,
                   count(*) FILTER (WHERE saldo = -1)    AS desligamentos
            FROM ({_caged(ano_inicio)}) GROUP BY ALL
        """
    return f"""
        SELECT ano, {chave},
               count(*) FILTER (WHERE vinculo_ativo_3112 = '1') AS estoque,
               round(avg({REMUN}), 2)                           AS remuneracao_sm,
               round(median({REMUN}), 2)                        AS remuneracao_sm_mediana
        FROM ({_rais(ano_inicio)}) WHERE setor_ti OR ocupacao_ti GROUP BY ALL
    """


def _sql_juntar(nivel: str) -> str:
    """
    A junção das duas partes, que é o que o site lê.

    FULL OUTER JOIN de propósito: um município pode ter movimentação no CAGED
    sem estoque na RAIS naquele ano (empresa nova) ou o contrário (estoque
    parado, sem contratação). INNER perderia justamente esses casos, que são
    os mais informativos. O ano do CAGED corre na frente do da RAIS: os anos
    só com fluxo entram com estoque 0, como antes da separação.
    """
    fluxo = f"read_parquet('{nuvem.caminho_gold(f'mapa_{nivel}_fluxo')}')"
    estoque = f"read_parquet('{nuvem.caminho_gold(f'mapa_{nivel}_estoque')}')"
    municipal = nivel != "uf"
    return f"""
        SELECT coalesce(f.ano, e.ano)                     AS ano,
               coalesce(f.uf, e.uf)                       AS uf,
               {"coalesce(f.municipio, e.municipio) AS municipio, coalesce(f.cod_municipio, e.cod_municipio) AS cod_municipio," if municipal else ""}
               coalesce(e.estoque, 0)                     AS estoque,
               e.remuneracao_sm,
               e.remuneracao_sm_mediana,
               coalesce(f.saldo, 0)                       AS saldo,
               coalesce(f.admissoes, 0)                   AS admissoes,
               coalesce(f.desligamentos, 0)               AS desligamentos
        FROM {fluxo} f FULL OUTER JOIN {estoque} e
          ON f.ano = e.ano AND f.uf = e.uf
         {"AND f.cod_municipio = e.cod_municipio" if municipal else ""}
        WHERE coalesce(f.uf, e.uf) IS NOT NULL
        ORDER BY 1, 2
    """


def _gravar(con, nome: str, sql: str) -> bool:
    nuvem.DIR_GOLD_LOCAL.mkdir(parents=True, exist_ok=True)
    destino = nuvem.caminho_gold(nome)
    print(f"\n🔨 {nome}")
    inicio = time.time()
    try:
        con.execute(f"""
            COPY ({sql}) TO '{destino}' (
                FORMAT PARQUET,
                COMPRESSION 'ZSTD',
                COMPRESSION_LEVEL 3
            );
        """)
        linhas = con.execute(f"SELECT count(*) FROM read_parquet('{destino}')").fetchone()[0]
        print(f"   ✅ {linhas:,} linhas em {time.time() - inicio:.0f}s -> {destino}")
        return True
    except Exception as e:
        print(f"   ❌ falhou: {str(e)[:300]}")
        return False


def _semear(nome: str) -> bool:
    """A parte da outra base, como está publicada na gold da área."""
    caminho = incremental.publicado(nome)
    if not caminho:
        return False
    nuvem.DIR_GOLD_LOCAL.mkdir(parents=True, exist_ok=True)
    shutil.copy(caminho, nuvem.caminho_gold(nome))
    print(f"\n⬇️  {nome}: da gold publicada (é da outra base)")
    return True


def _sql_incremental(parte: str, nivel: str, ano_inicio: int, publicado: str) -> str:
    """
    Os anos anteriores a `ano_inicio` como estão publicados, e os de
    `ano_inicio` em diante recalculados. As duas partes têm o ano no grão,
    então trocar os anos recentes inteiros não mistura nada.
    """
    if (_caged(ano_inicio) if parte == "fluxo" else _rais(ano_inicio)) is None:
        # Sem arquivo nenhum desses anos: o publicado fica como está.
        return f"SELECT * FROM read_parquet('{Path(publicado).as_posix()}') ORDER BY ALL"
    return incremental.sql_mesclado(publicado, _sql_parte(parte, nivel, ano_inicio), ano_inicio)


def _inicio_incremental(con, parte: str, nome: str) -> tuple[int, str | None]:
    """
    O primeiro ano a refazer na parte e o arquivo publicado dela; (0, None)
    se ainda não há publicado (refaz tudo). Fluxo: o ano corrente e o
    anterior, que são os que um mês novo do CAGED muda. Estoque: o ano novo
    da RAIS (ver _utils/incremental.py).
    """
    if parte == "fluxo":
        arquivo = incremental.publicado(nome)
        return (datetime.date.today().year - 1, arquivo) if arquivo else (0, None)
    return incremental.ano_inicio_rais(con, nome)


def construir(base: str = "ambas", threads: int = 4, recentes: bool = False) -> int:
    """
    Refaz a parte de `base` ("caged", "rais" ou "ambas") nos dois níveis e
    junta com a outra. A parte da outra base vem da gold publicada; se ainda
    não existir (a primeira execução depois da separação), é calculada aqui.

    `recentes`: cada parte refeita refaz só os anos novos e mantém os
    anteriores publicados (fluxo: ano corrente e anterior; estoque: o ano
    novo da RAIS). Sem a parte publicada ainda, refaz tudo. Devolve 0 se
    tudo deu certo.
    """
    con = nuvem.conectar_duckdb()
    con.execute(f"SET threads={threads}")
    con.execute("SET enable_progress_bar=false")
    print("=" * 70)
    print(f"  GOLD — território: estoque (RAIS) e fluxo (CAGED) · refazendo: {base}"
          + (" (só os anos novos)" if recentes else ""))
    print("=" * 70)

    falhas = []
    for nivel in NIVEIS:
        for parte, dona in PARTES.items():
            nome = f"mapa_{nivel}_{parte}"
            if base in ("ambas", dona):
                ano_inicio, publicado = _inicio_incremental(con, parte, nome) if recentes else (0, None)
                if publicado:
                    print(f"\n… {nome}: {ano_inicio} em diante; os anos anteriores vêm da gold publicada")
                    ok = _gravar(con, nome, _sql_incremental(parte, nivel, ano_inicio, publicado))
                else:
                    if recentes:
                        print(f"\n↪️  {nome} ainda não está na gold: refazendo todos os anos")
                    ok = _gravar(con, nome, _sql_parte(parte, nivel))
            else:
                ok = _semear(nome)
                if not ok:
                    print(f"\n↪️  {nome} ainda não está na gold: calculando agora (só na primeira vez)")
                    ok = _gravar(con, nome, _sql_parte(parte, nivel))
            if not ok:
                falhas.append(nome)
        if not any(f.startswith(f"mapa_{nivel}_") for f in falhas):
            if not _gravar(con, f"mapa_{nivel}", _sql_juntar(nivel)):
                falhas.append(f"mapa_{nivel}")

    print(f"\n🏁 território: {'tudo construído' if not falhas else 'falhou: ' + ', '.join(falhas)}")
    return 0 if not falhas else 2


def main() -> int:
    p = argparse.ArgumentParser(description="Agregados territoriais das duas bases.")
    p.add_argument("--base", choices=("caged", "rais", "ambas"), default="ambas",
                   help="Qual parte refazer; a outra vem da gold publicada.")
    p.add_argument("--threads", type=int, default=4)
    p.add_argument("--anos", choices=("todos", "recentes"), default="todos",
                   help="recentes: a parte refeita só nos anos novos, mesclada com a publicada")
    args = p.parse_args()
    return construir(args.base, args.threads, args.anos == "recentes")


if __name__ == "__main__":
    sys.exit(main())
