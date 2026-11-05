"""
Gold RAIS — estoque de emprego em tecnologia, a partir da silver-rais-ti
já publicada. Publica a própria fatia em Gianpedro/gold-analise-mercado-ti
ao final: cada job de gold roda num runner novo, sem acesso ao disco de
outro job, então publicar aqui (em vez de depender de um job final que leria
arquivo local) é o que entrega o dado pra quem depende dele (gold-modelos,
pelo rais_estoque_anual).

Independente das outras partes da gold: só depende de silver-rais-ti.

Uso:
    python gold-rais.py               # todos os anos
    python gold-rais.py --anos recentes   # só os anos novos (Pipeline · RAIS)
"""
import argparse
import sys
from pathlib import Path

_AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI))
sys.path.insert(0, str(_AQUI.parent))

from _utils import log, telegram  # noqa: E402

log.ativar_horario()


def main() -> int:
    p = argparse.ArgumentParser(description="Gold RAIS da área.")
    p.add_argument("--anos", choices=("todos", "recentes"), default="todos",
                   help="recentes: só os anos novos da RAIS, mesclados com a gold publicada")
    anos = p.parse_args().anos
    # A medição de volume e a publicação, chamadas abaixo, leem os próprios
    # argumentos de sys.argv.
    sys.argv = sys.argv[:1]

    from gold_rais import construir_gold as gr
    from gold_unificado import publicar_gold, volume

    codigo = gr.main(["--anos", anos])
    if codigo != 0:
        telegram.notificar("⚠️ *Gold RAIS*: concluído com falha, publicação pulada.")
        return codigo
    # O tamanho da plataforma (para a visão geral do site) é medido aqui, a
    # etapa que já lê a RAIS; nunca derruba a publicação.
    volume.main()

    print("\n📤 Publicando no Hugging Face...")
    codigo_publicar = publicar_gold.main()
    if codigo_publicar != 0:
        telegram.notificar("⚠️ *Gold RAIS*: reconstruído, mas a publicação falhou.")
        return codigo_publicar

    telegram.notificar("🏁 *Gold RAIS*: estoque de emprego reconstruído e publicado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
