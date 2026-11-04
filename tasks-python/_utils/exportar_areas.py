"""
Exporta a definição das áreas para o site: site/src/areas.json.

O site não sabe o que é uma área — lê deste arquivo o nome, o resumo, as
subáreas e os rótulos das lentes, e lê os dados de cada uma direto da gold da
área no Hugging Face. Uma área nova em _utils/areas.py aparece no site depois
de rodar este script e publicar a gold dela.

Os rótulos vêm de escopo_tecnologia com AREA trocada, para serem exatamente
os textos que a gold grava nas colunas (lente, setor).

Uso:
    python _utils/exportar_areas.py
"""
import importlib
import json
import os
import sys
from pathlib import Path

_RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "tasks-python"))

from _utils import areas  # noqa: E402

DESTINO = _RAIZ / "site" / "src" / "areas.json"


def _descrever(slug: str) -> dict:
    os.environ["AREA"] = slug
    from _utils import escopo_tecnologia as esc
    esc = importlib.reload(esc)
    a = areas.AREAS[slug]
    return {
        "slug": slug,
        "nome": a["nome"],
        "sigla": a["sigla"],
        "resumo": a["resumo"],
        "repo": f"Gianpedro/gold-analise-mercado-{slug}",
        "subareas": list(a["subareas"]),
        "cnaes": len(a["cnae"]),
        "familias_cbo": len(a["cbo_familias"]),
        "rotulos": {
            "setor_dentro": esc.ROTULO_SETOR_DENTRO,
            "setor_fora": esc.ROTULO_SETOR_FORA,
            "lente_dentro": esc.LENTE_DENTRO,
            "lente_fora": esc.LENTE_FORA,
            "lente_so_setor": esc.LENTE_SO_SETOR,
            "nao_area": esc.AREA_NAO_TI,
        },
    }


def main() -> int:
    saida = [_descrever(slug) for slug in areas.AREAS]
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✅ {len(saida)} área(s) em {DESTINO}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
