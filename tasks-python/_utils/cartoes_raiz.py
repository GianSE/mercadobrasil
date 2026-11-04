"""
O cartão da RAIZ dos repositórios de área (silver-caged-area, silver-rais-area,
gold-mercado-brasil): o que é o conjunto e onde está cada área. Cada área tem o
seu cartão na própria pasta (`saude/README.md`), com o recorte dela; este aqui
é o índice, gerado de _utils/areas.py para nunca ficar desatualizado.
"""
from _utils.areas import AREAS

DESCRICAO = {
    "silver-caged-area": ("CAGED", "os microdados do CAGED já traduzidos, recortados por área (as movimentações, mês a mês)"),
    "silver-rais-area": ("RAIS", "os microdados da RAIS já traduzidos, recortados por área (vínculos e estabelecimentos, ano a ano)"),
    "gold-mercado-brasil": ("RAIS e CAGED", "os agregados prontos para consumo de cada área: estoque, fluxo, mapa, salários, perfil e modelos"),
}


def cartao_raiz(repo: str) -> str:
    """O README da raiz do repositório `repo` (o nome sem o usuário)."""
    nome = repo.split("/")[-1]
    fonte, oque = DESCRICAO[nome]
    linhas = "\n".join(
        f"| `{slug}/` | {a['nome']} | {a['resumo']} |" for slug, a in AREAS.items()
    )
    return f"""---
license: odc-by
language:
  - pt
tags:
  - brazil
  - labor-market
pretty_name: Mercado de trabalho no Brasil por área ({fonte})
# Cada área tem as próprias tabelas, com esquemas diferentes: o visualizador
# automático do Hub não tem um esquema único para mostrar.
viewer: false
---

# Mercado de trabalho no Brasil por área — {fonte}

Este conjunto guarda {oque}. Os dados são do Ministério do Trabalho e Emprego
(PDET), tratados pelo pipeline do repositório
[GianSE/mercadobrasil](https://github.com/GianSE/mercadobrasil).

Cada área é uma pasta, com o próprio cartão (`<área>/README.md`) descrevendo o
recorte: as subclasses CNAE do setor e as famílias CBO das ocupações.

| Pasta | Área | O que entra |
|---|---|---|
{linhas}

As listas de TI foram validadas no TCC que deu origem ao projeto; as das outras
áreas ainda passam pela mesma verificação.

## Licença e citação

Dados originais públicos (MTE/PDET). Este derivado é distribuído sob ODC-BY:
cite a fonte original e este tratamento.
"""
