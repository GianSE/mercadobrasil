"""
Gold incremental: refazer só os anos novos e manter os publicados.

Toda tabela da gold tem o ano no grão (cada linha é de um ano, e nenhuma conta
atravessa anos), então trocar os anos recentes inteiros dá o mesmo que
refazer tudo — a parte cara, ler e agregar a silver, cai de ~19 anos para um.
A gold continua um arquivo por tabela: a mescla é por linhas (os anos antigos
do arquivo publicado + os novos desta rodada), não por arquivo.

Na RAIS, "novo" é o ano mais recente da silver da área, ou antes, se a tabela
publicada parou mais atrás (um ano que faltou numa rodada que falhou). O ano
da RAIS é o do arquivo (ano_particao), sem declaração atrasada caindo em
outro ano, como no CAGED. Sem tabela publicada, refaz tudo.
"""
from pathlib import Path

from _utils import nuvem


def publicado(nome: str) -> str | None:
    """O arquivo da tabela como está publicado na gold da área (no cache do Hub), ou None."""
    from huggingface_hub import hf_hub_download

    try:
        return hf_hub_download(nuvem.REPO_GOLD, nuvem.caminho_na_gold(f"{nome}.parquet"), repo_type="dataset")
    except Exception:
        return None


def anos_rais() -> list[int]:
    """Os anos da RAIS na silver da área, pela listagem (sem baixar nada)."""
    return sorted(nuvem.anos_no_repo(nuvem.repo_silver_ti("rais_vinc"), nuvem.pasta_silver("rais_vinc"), "ano_particao"))


def ano_inicio_rais(con, nome: str) -> tuple[int, str | None]:
    """
    O primeiro ano da RAIS a refazer na tabela `nome` da gold, e o arquivo
    publicado dela. (0, None): refazer tudo, porque a tabela ainda não foi
    publicada. Refaz pelo menos o último ano, para uma rodada repetida
    reproduzir o mesmo resultado.
    """
    anos = anos_rais()
    arquivo = publicado(nome)
    if not anos or not arquivo:
        return 0, None
    ultimo_publicado = con.execute(f"SELECT max(ano) FROM read_parquet('{Path(arquivo).as_posix()}')").fetchone()[0]
    if ultimo_publicado is None:
        return 0, None
    return min(anos[-1], int(ultimo_publicado) + 1), arquivo


def sql_mesclado(arquivo_publicado: str, sql_novo: str, ano_inicio: int, ordem: str = "ALL") -> str:
    """Os anos anteriores a `ano_inicio` como estão publicados, e os demais de `sql_novo`."""
    return f"""
        SELECT * FROM (
            SELECT * FROM read_parquet('{Path(arquivo_publicado).as_posix()}') WHERE ano < {ano_inicio}
            UNION ALL BY NAME
            ({sql_novo})
        ) ORDER BY {ordem}
    """
