"""
Gold território — mapa (RAIS + CAGED) e os perfis de município (clusters),
a partir das silvers já publicadas.

`--base caged` refaz só o fluxo do mapa (a fila mensal do CAGED), `--base
rais` só o estoque (a fila anual da RAIS); a outra parte vem da gold
publicada (ver gold_unificado/mapa.py). Os clusters, que custam segundos,
rodam depois em qualquer caso: usam as duas partes.

Independente de gold-rais.py: mapa.py lê a silver direto, não o agregado
da RAIS. Clusters depende do MAPA desta mesma rodada (mapa_municipio), por
isso os dois ficam juntos num script só em vez de dois jobs separados.

Publica a própria fatia em Gianpedro/gold-analise-mercado-ti ao final
(ver gold-rais.py para o motivo: cada job roda num runner novo).

Uso:
    python gold-territorio.py --base caged --anos recentes   # a fila semanal do CAGED
    python gold-territorio.py --base rais                    # a fila da RAIS
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


def _semear_geo_municipios() -> None:
    """
    geo_municipios (coordenadas do IBGE) é referência estática — não é
    reconstruída a cada rodada (muda só se o IBGE redesenhar municípios).
    Baixa a versão já publicada antes do cluster, que depende dela.
    """
    from huggingface_hub import hf_hub_download
    import shutil

    nuvem.DIR_GOLD_LOCAL.mkdir(parents=True, exist_ok=True)
    # Não depende da área: numa área nova, que ainda não o tem na gold dela,
    # vem da gold de referência (a do TCC).
    erro = None
    # Na gold de referência (a do TCC) o arquivo fica na raiz.
    for repo, arquivo in ((nuvem.REPO_GOLD, nuvem.caminho_na_gold("geo_municipios.parquet")),
                          (nuvem.REPO_GOLD_REFERENCIA, "geo_municipios.parquet")):
        try:
            caminho = hf_hub_download(repo, arquivo, repo_type="dataset")
            shutil.copy(caminho, nuvem.DIR_GOLD_LOCAL / "geo_municipios.parquet")
            print(f"✅ geo_municipios.parquet semeado (de {repo})")
            return
        except Exception as e:
            erro = e
    print(f"⚠️  geo_municipios.parquet ainda não existe no Hub ({erro})")


def _argumentos() -> tuple[str, int]:
    """A base a refazer e, com --base caged --anos recentes, o primeiro ano do fluxo a refazer."""
    p = argparse.ArgumentParser(description="Gold território da área.")
    p.add_argument("--base", choices=("caged", "rais", "ambas"), default="ambas")
    p.add_argument("--anos", choices=("recentes", "todos"), default="todos",
                   help="Com --base caged: recentes refaz o fluxo só do ano corrente e do anterior.")
    args = p.parse_args()
    # Os módulos chamados abaixo (clusters, publicação) leem os próprios
    # argumentos de sys.argv: sem isto, recusariam o --base.
    sys.argv = sys.argv[:1]
    ano_inicio = datetime.date.today().year - 1 if (args.base == "caged" and args.anos == "recentes") else 0
    return args.base, ano_inicio


def main() -> int:
    base, ano_inicio = _argumentos()
    _semear_geo_municipios()

    from gold_unificado import mapa
    from ciencia_dados import clusters_municipios

    codigo_mapa = mapa.construir(base, ano_inicio=ano_inicio)
    if codigo_mapa != 0:
        telegram.notificar("⚠️ *Gold território*: mapa falhou, clusters pulado.")
        return codigo_mapa

    try:
        codigo_clusters = clusters_municipios.main() or 0
    except Exception as e:
        print(f"❌ clusters falhou: {str(e)[:200]}")
        codigo_clusters = 1

    if codigo_clusters != 0:
        telegram.notificar("⚠️ *Gold território*: mapa ok, clusters falhou, "
                           "publicação pulada.")
        return codigo_clusters

    print("\n📤 Publicando no Hugging Face...")
    from gold_unificado import publicar_gold

    codigo_publicar = publicar_gold.main()
    if codigo_publicar != 0:
        telegram.notificar("⚠️ *Gold território*: reconstruído, mas a publicação falhou.")
        return codigo_publicar

    telegram.notificar(f"🏁 *Gold território* ({base}): mapa e clusters reconstruídos e publicados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
