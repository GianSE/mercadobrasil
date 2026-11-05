"""
O tamanho da plataforma, para a visão geral do site: quantos arquivos,
registros e gigabytes há em cada tabela de cada camada, de 2007 em diante.
O número que importa é o da Silver de TI (os registros brutos do recorte);
o da Bronze dá a escala de onde eles foram selecionados.

Os registros saem do rodapé de cada Parquet (num_rows), sem ler dado: a
Bronze inteira (mais de 2 bilhões de linhas) é contada em cerca de dois
minutos. Os bytes saem da listagem do repositório.

Uso:
    python -m gold_unificado.volume
"""
import re
import sys
import time

import duckdb
from huggingface_hub import HfApi

from _utils import escopo_tecnologia as esc, nuvem

ANO_INICIAL = 2007
# O repositório da área guarda as duas silvers, a gold e o espelho consolidado
# do CAGED (silver-caged/caged_unificado_<ano>): cada linha conta só as pastas
# das tabelas tratadas da sua base.
TABELAS_CAGED = ("caged_mov", "caged_old", "caged_for", "caged_exc", "caged_ajustes")
TABELAS_RAIS = ("rais_vinc", "rais_estab")

CAMADAS = [
    ("Bronze", "RAIS", nuvem.REPO_BRONZE_RAIS, None),
    ("Bronze", "CAGED", nuvem.REPO_BRONZE_CAGED, None),
    (f"Silver de {esc.SIGLA}", "RAIS", nuvem.REPO_SILVER_TI_RAIS, tuple(f"{nuvem.pasta_silver(t)}/" for t in TABELAS_RAIS)),
    (f"Silver de {esc.SIGLA}", "CAGED", nuvem.REPO_SILVER_TI_CAGED, tuple(f"{nuvem.pasta_silver(t)}/" for t in TABELAS_CAGED)),
]


def _no_periodo(caminho: str) -> bool:
    m = re.search(r"ano(?:_particao)?=(\d+)", caminho)
    return m is not None and int(m.group(1)) >= ANO_INICIAL


def medir(con) -> list[tuple]:
    api = HfApi()
    linhas = []
    for camada, base, repo, prefixos in CAMADAS:
        inicio = time.time()
        arquivos = [f for f in api.list_repo_tree(repo, repo_type="dataset", recursive=True)
                    if getattr(f, "size", None) is not None and f.path.endswith(".parquet")
                    and (prefixos is None or f.path.startswith(prefixos)) and _no_periodo(f.path)]
        # Uma linha por tabela (rais_vinc, rais_estab, caged_mov...): a Silver
        # da RAIS junta vínculos e estabelecimentos, que não se somam.
        por_tabela: dict[str, list] = {}
        for f in arquivos:
            # A tabela é a primeira pasta, ou a segunda dentro de silver-<base>/.
            partes = f.path.split("/")
            por_tabela.setdefault(partes[1] if partes[0].startswith("silver-") else partes[0], []).append(f)
        for tabela, grupo in sorted(por_tabela.items()):
            lista = "[" + ", ".join(f"'{nuvem.fonte_leitura(repo, f.path)}'" for f in grupo) + "]"
            registros = con.execute(f"SELECT sum(num_rows) FROM parquet_file_metadata({lista})").fetchone()[0]
            anos = [int(m.group(1)) for f in grupo if (m := re.search(r"ano(?:_particao)?=(\d+)", f.path))]
            linhas.append((camada, base, tabela, len(grupo), int(registros or 0), sum(f.size for f in grupo),
                           min(anos, default=None), max(anos, default=None)))
        print(f"   {camada} · {base}: {len(arquivos):,} arquivos ({time.time() - inicio:.0f}s)")
    return linhas


def main() -> int:
    con = nuvem.conectar_duckdb()
    con.execute("SET enable_progress_bar=false")
    print("\n📏 volume da plataforma")
    try:
        linhas = medir(con)
    except Exception as e:
        # Medida de apresentação: se o Hub recusar, a Gold segue sem ela.
        print(f"   ⚠️ não foi possível medir: {str(e)[:200]}")
        return 0
    con.execute("CREATE TEMP TABLE volume (camada VARCHAR, base VARCHAR, tabela VARCHAR, arquivos BIGINT, registros BIGINT, bytes BIGINT, ano_inicial INTEGER, ano_final INTEGER)")
    con.executemany("INSERT INTO volume VALUES (?, ?, ?, ?, ?, ?, ?, ?)", linhas)
    nuvem.DIR_GOLD_LOCAL.mkdir(parents=True, exist_ok=True)
    destino = nuvem.caminho_gold("plataforma_volume")
    con.execute(f"COPY volume TO '{destino}' (FORMAT PARQUET, COMPRESSION 'ZSTD')")
    print(f"   ✅ {destino}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
