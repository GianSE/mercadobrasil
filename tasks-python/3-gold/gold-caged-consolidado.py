"""
Gold CAGED consolidado — um parquet por tabela e por ano (para servir por
HTTPS) mais o arquivo unificado das duas gerações, a partir da
silver-caged-ti já publicada. Publica no mesmo repositório da silver
(Gianpedro/silver-caged-ti), como um espelho pronto pra consulta direta.

Totalmente independente do resto da gold: só depende de silver-caged-ti,
nunca lê nada que gold-rais.py, gold-territorio.py ou gold-modelos.py
produzem. Ao final, agrega o CAGED unificado nos cubos do site de
dashboards (gold_caged/cubos.py) e os publica na Gold.

`--anos recentes` (a fila mensal) refaz só o ano corrente e o anterior —
os únicos que um mês novo do CAGED muda: as declarações fora do prazo e os
acertos chegam no arquivo do ano em que são entregues. Os anos antigos do
espelho ficam como estão, e os cubos são mesclados: os anos antigos vêm dos
cubos publicados, os recentes desta rodada. `--anos todos` refaz tudo.

Uso:
    python gold-caged-consolidado.py --anos recentes
"""
import argparse
import datetime
import sys
from pathlib import Path

_AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI))
sys.path.insert(0, str(_AQUI.parent))

from _utils import log, nuvem, telegram  # noqa: E402

log.ativar_horario()


def _ano_inicio() -> int:
    """
    O primeiro ano a refazer, já repassado em sys.argv para consolidar,
    unificar e publicar_hf (que leem --ano-inicio de lá). 0 = todos.
    """
    from gold_caged import cubos

    p = argparse.ArgumentParser(description="Gold CAGED consolidado da área.")
    p.add_argument("--anos", choices=("recentes", "todos"), default="todos")
    anos = p.parse_args().anos
    ano_inicio = 0
    if anos == "recentes":
        ano_inicio = datetime.date.today().year - 1
        # Sem cubos publicados não há anos antigos para mesclar: refaz tudo.
        faltando = [n for n in cubos.CUBOS if not nuvem.existe_remoto(nuvem.REPO_GOLD, nuvem.caminho_na_gold(f"{n}.parquet"))]
        if faltando:
            print(f"↪️  cubos ainda não publicados ({', '.join(faltando)}): refazendo todos os anos")
            ano_inicio = 0
    print(f"📅 anos refeitos: {f'{ano_inicio} em diante' if ano_inicio else 'todos'}")
    sys.argv = sys.argv[:1] + (["--ano-inicio", str(ano_inicio)] if ano_inicio else [])
    return ano_inicio


def main() -> int:
    ano_inicio = _ano_inicio()
    from gold_caged import consolidar, unificar, publicar_hf

    codigo_consolidar = consolidar.main()
    codigo_unificar = unificar.main()

    if codigo_consolidar != 0 or codigo_unificar != 0:
        telegram.notificar("⚠️ *Gold CAGED consolidado*: consolidar/unificar falhou, "
                           "publicação pulada.")
        return 2

    print("\n📤 Publicando no Hugging Face...")
    codigo_publicar = publicar_hf.main()
    if codigo_publicar != 0:
        telegram.notificar("⚠️ *Gold CAGED consolidado*: publicação falhou.")
        return codigo_publicar

    print("\n🧊 Cubos do CAGED para o site de dashboards...")
    codigo_cubos = _publicar_cubos(ano_inicio)
    if codigo_cubos != 0:
        telegram.notificar("⚠️ *Gold CAGED consolidado*: espelho publicado, mas os cubos falharam.")
        return codigo_cubos

    telegram.notificar("🏁 *Gold CAGED consolidado*: reconstruído e publicado, com os cubos.")
    return 0


def _publicar_cubos(ano_inicio: int = 0) -> int:
    """
    Os cubos vão para a Gold (não para o espelho da silver): são agregados
    prontos para consumo, como o resto da Gold, e é dela que o site baixa
    os dados no build. Um commit só com os dois arquivos — o site nunca vê
    um cubo novo ao lado de um velho.
    """
    import duckdb
    from huggingface_hub import CommitOperationAdd, HfApi

    from gold_caged import cubos
    from gold_unificado.publicar_gold import _credencial

    try:
        nomes = cubos.montar(duckdb.connect(), (cubos.DIR_ENTRADA / "caged_unificado_*.parquet").as_posix(), cubos.DIR_SAIDA)
        if ano_inicio:
            _mesclar_cubos(nomes, ano_inicio)
    except Exception as e:
        print(f"❌ cubos falharam: {str(e)[:200]}")
        return 1

    api = HfApi(token=_credencial())
    # Numa área nova este é o primeiro job a escrever na Gold dela (gold-rais e
    # os outros podem rodar depois), e o commit não cria o repositório sozinho.
    api.create_repo(repo_id=nuvem.REPO_GOLD, repo_type="dataset", exist_ok=True)
    operacoes = [CommitOperationAdd(path_in_repo=nuvem.caminho_na_gold(f"{n}.parquet"), path_or_fileobj=str(cubos.DIR_SAIDA / f"{n}.parquet")) for n in nomes]
    api.create_commit(repo_id=nuvem.REPO_GOLD, repo_type="dataset", operations=operacoes,
                      commit_message="cubos do CAGED para o site")
    print(f"✅ {len(operacoes)} cubo(s) publicados em {nuvem.REPO_GOLD}")
    return 0


def _mesclar_cubos(nomes: list[str], ano_inicio: int) -> None:
    """
    Os cubos desta rodada só têm os anos recentes: os anos anteriores a
    `ano_inicio` vêm dos cubos publicados. Todo cubo tem o ano no grão (ver
    cubos.montar), então trocar os anos recentes inteiros não mistura nada.
    """
    import shutil

    import duckdb
    from huggingface_hub import hf_hub_download

    from gold_caged import cubos

    con = duckdb.connect()
    for n in nomes:
        novo = cubos.DIR_SAIDA / f"{n}.parquet"
        antigo = hf_hub_download(nuvem.REPO_GOLD, nuvem.caminho_na_gold(f"{n}.parquet"), repo_type="dataset")
        junto = cubos.DIR_SAIDA / f"_{n}_mesclado.parquet"
        con.execute(f"""
            COPY (SELECT * FROM read_parquet('{Path(antigo).as_posix()}') WHERE ano < {ano_inicio}
                  UNION ALL BY NAME
                  SELECT * FROM read_parquet('{novo.as_posix()}')
                  ORDER BY ALL)
            TO '{junto.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD, COMPRESSION_LEVEL 9)""")
        shutil.move(junto, novo)
        anos = con.execute(f"SELECT min(ano), max(ano), count(*) FROM read_parquet('{novo.as_posix()}')").fetchone()
        print(f"   🧩 {n}: anos {anos[0]}–{anos[1]}, {anos[2]:,} linhas (antes de {ano_inicio} vindos do publicado)")


if __name__ == "__main__":
    sys.exit(main())
