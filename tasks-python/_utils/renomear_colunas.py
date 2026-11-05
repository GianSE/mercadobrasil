"""
Migração única: renomeia, nos dados JÁ PUBLICADOS de uma área, as colunas
herdadas de TI para os nomes genéricos que o pipeline passou a gravar.

    setor_ti     -> setor_da_area
    ocupacao_ti  -> ocupacao_da_area
    area_ti      -> subarea

Sem isso o site, que lê os nomes novos, quebraria até cada área ser refeita,
e a gold incremental mesclaria a tabela publicada (nomes antigos) com os anos
novos (nomes novos) em colunas separadas e meio vazias. Refazer as 10 áreas
inteiras custaria horas para mudar só nomes: aqui cada arquivo é baixado,
regravado com as colunas renomeadas (o resto igual, na mesma ordem) e
publicado de novo. Arquivo sem coluna antiga é pulado, então rodar de novo
depois de uma falha só refaz o que faltou.

Entra: a gold da área (gold-<área>/*.parquet) e o CAGED unificado do espelho
(silver-caged-<área>/caged_unificado_*.parquet), que tem area_ti.

    AREA=saude python _utils/renomear_colunas.py
"""
import shutil
import sys
from pathlib import Path

_AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI.parent))

from _utils import nuvem  # noqa: E402

NOVOS = {"setor_ti": "setor_da_area", "ocupacao_ti": "ocupacao_da_area", "area_ti": "subarea"}
# O Hub recomenda commits de até ~100 arquivos; os 2 GB seguram o disco do runner.
MAX_BYTES = 2 * 1024**3


def main() -> int:
    import duckdb
    from huggingface_hub import CommitOperationAdd, HfApi, hf_hub_download

    api = HfApi()
    repo = nuvem.REPO_AREA
    pastas = (nuvem.pasta_gold(), nuvem.pasta_base("caged"))
    arquivos = [f for f in api.list_repo_tree(repo, repo_type="dataset", recursive=True)
                if getattr(f, "size", None) is not None and f.path.endswith(".parquet")
                and (f.path.startswith(f"{pastas[0]}/") and f.path.count("/") == 1
                     or f.path.startswith(f"{pastas[1]}/caged_unificado_"))]
    print(f"📦 {repo}: {len(arquivos)} arquivo(s) a conferir")

    nuvem.preparar_staging()
    baixados, saida = nuvem.DIR_TEMP / "renomear_baixados", nuvem.DIR_TEMP / "renomear_saida"
    # Conexão crua, e não a do projeto: aquela desliga preserve_insertion_order,
    # e aqui o arquivo tem de sair com as linhas na mesma ordem.
    con = duckdb.connect()
    lote, tamanho, total, commits = [], 0, 0, 0

    def enviar():
        nonlocal lote, tamanho, commits
        if not lote:
            return
        operacoes = [CommitOperationAdd(path_in_repo=caminho, path_or_fileobj=str(local)) for caminho, local in lote]
        nuvem.com_espera_no_limite(lambda: api.create_commit(
            repo_id=repo, repo_type="dataset", operations=operacoes,
            commit_message=f"colunas genéricas: setor_da_area, ocupacao_da_area, subarea ({len(operacoes)} arquivo(s))"),
            repo)
        commits += 1
        print(f"   ☁️  commit {commits}: {len(lote)} arquivo(s)", flush=True)
        shutil.rmtree(baixados, ignore_errors=True)
        shutil.rmtree(saida, ignore_errors=True)
        lote, tamanho = [], 0

    for f in sorted(arquivos, key=lambda x: x.path):
        local = Path(nuvem.com_espera_no_limite(
            lambda: hf_hub_download(repo, f.path, repo_type="dataset", local_dir=baixados), f.path))
        colunas = [r[0] for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{local.as_posix()}')").fetchall()]
        trocas = {c: NOVOS[c] for c in colunas if c in NOVOS}
        if not trocas:
            continue
        conflito = set(trocas.values()) & set(colunas)
        if conflito:
            raise SystemExit(f"❌ {f.path}: já tem {sorted(conflito)} ao lado do nome antigo; não sei qual vale")
        destino = saida / f.path
        destino.parent.mkdir(parents=True, exist_ok=True)
        renomear = ", ".join(f'"{a}" AS "{b}"' for a, b in trocas.items())
        con.execute(f"""COPY (SELECT * RENAME ({renomear}) FROM read_parquet('{local.as_posix()}'))
                        TO '{destino.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)""")
        antes = con.execute(f"SELECT count(*) FROM read_parquet('{local.as_posix()}')").fetchone()[0]
        depois = con.execute(f"SELECT count(*) FROM read_parquet('{destino.as_posix()}')").fetchone()[0]
        assert antes == depois, (f.path, antes, depois)
        print(f"   ✏️  {f.path}: {', '.join(f'{a} → {b}' for a, b in trocas.items())} ({depois:,} linhas)", flush=True)
        lote.append((f.path, destino))
        tamanho += destino.stat().st_size
        total += 1
        if len(lote) >= 100 or tamanho >= MAX_BYTES:
            enviar()
    enviar()
    print(f"🏁 {repo}: {total} arquivo(s) renomeado(s) em {commits} commit(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
