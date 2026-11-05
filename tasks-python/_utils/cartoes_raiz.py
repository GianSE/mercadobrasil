"""
O cartão da RAIZ do repositório de uma área (Gianpedro/mercadobrasil-<área>): o que
é a área e o que há em cada pasta. Cada camada tem o próprio cartão, na pasta
dela (`silver-caged/README.md`, `silver-rais/README.md`, `gold/README.md`),
escrito pelo script que a publica; este aqui é o índice, gerado de
_utils/areas.py para nunca ficar desatualizado.
"""
from _utils import nuvem
from _utils.areas import AREAS

PASTAS = (
    (nuvem.pasta_base("caged"), "Microdados do CAGED recortados na área, já traduzidos (movimentações, mês a mês), e o espelho anual consolidado"),
    (nuvem.pasta_base("rais"), "Microdados da RAIS recortados na área, já traduzidos (vínculos e estabelecimentos, ano a ano)"),
    (nuvem.PASTA_GOLD, "Agregados prontos para consumo: estoque, fluxo, mapa, salários, perfil, cubos do CAGED e modelos"),
)


def _configs(tabelas: list[str]) -> str:
    """
    Uma configuração do visualizador do Hub por tabela da gold: cada uma tem o
    próprio esquema, e o visualizador mostra uma de cada vez. A silver fica de
    fora: são GB de microdados, e o cartão da pasta explica como ler.
    """
    if not tabelas:
        # Sem gold ainda: nada para mostrar, e o visualizador tentaria ler a silver.
        return "viewer: false"
    # A que abre primeiro: o estoque anual, a mais fácil de ler sem contexto.
    padrao = "rais_estoque_anual" if "rais_estoque_anual" in tabelas else tabelas[0]
    linhas = ["configs:"]
    for t in tabelas:
        linhas += [f"  - config_name: {t}", f"    data_files: {nuvem.PASTA_GOLD}/{t}.parquet"]
        if t == padrao:
            linhas.append("    default: true")
    return "\n".join(linhas)


def tabelas_da_gold(repo: str) -> list[str]:
    """As tabelas publicadas direto em gold/ (sem as subpastas, como auditoria/)."""
    prefixo = f"{nuvem.PASTA_GOLD}/"
    try:
        arquivos = nuvem.arquivos_remotos(repo, forcar=True)
    except Exception:
        return []  # repositório ainda não existe
    return sorted(c[len(prefixo):-8] for c in arquivos
                  if c.startswith(prefixo) and c.endswith(".parquet") and "/" not in c[len(prefixo):])


def cartao_raiz(area: str, tabelas: list[str] = ()) -> str:
    """O README da raiz do repositório da área `area` (o slug), com as tabelas da gold no visualizador."""
    a = AREAS[area]
    arvore = f"https://huggingface.co/datasets/Gianpedro/mercadobrasil-{area}/tree/main"
    pastas = "\n".join(f"| [`{p}/`]({arvore}/{p}) | {o} |" for p, o in PASTAS)
    outras = "\n".join(f"- [{x['nome']}](https://huggingface.co/datasets/Gianpedro/mercadobrasil-{s})"
                        for s, x in AREAS.items() if s != area)
    return f"""---
license: odc-by
language:
  - pt
tags:
  - brazil
  - labor-market
  - {area}
pretty_name: Mercado de trabalho em {a['nome']} (Brasil)
{_configs(list(tabelas))}
---

# Mercado de trabalho em {a['nome']} (Brasil)

{a['resumo']}

Microdados da RAIS e do CAGED (Ministério do Trabalho e Emprego, PDET)
tratados pelo pipeline do repositório
[GianSE/mercadobrasil](https://github.com/GianSE/mercadobrasil). Cada camada é
uma pasta, com o próprio cartão (`<pasta>/README.md`) descrevendo o recorte e
as tabelas:

| Pasta | O que tem |
|---|---|
{pastas}

O recorte da área é pela subclasse CNAE do estabelecimento **ou** pela família
CBO da ocupação, as listas de `tasks-python/_utils/areas.py`. As listas de TI
foram validadas no TCC que deu origem ao projeto; as das outras áreas ainda
passam pela mesma verificação.

## As outras áreas

{outras}

## Licença e citação

Dados originais públicos (MTE/PDET). Este derivado é distribuído sob ODC-BY:
cite a fonte original e este tratamento.
"""


def publicar_raiz(repo: str, area: str) -> None:
    """Sobe o índice da raiz, só se mudou (um commit a menos quando não mudou)."""
    nuvem.preparar_staging()
    local = nuvem.DIR_TEMP / f"cartao_raiz_{area}.md"
    local.write_text(cartao_raiz(area, tabelas_da_gold(repo)), encoding="utf-8")
    if nuvem.publicar_cartao(repo, local):
        print(f"   📝 cartão da raiz de {repo} atualizado")
