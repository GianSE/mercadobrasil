"""
Silver de VÁRIAS áreas de uma vez, lendo a silver completa uma vez só.

Recortar área por área (silver-area.py) relê do Hub a mesma tabela e o
mesmo ano da silver completa para cada área: com 10 áreas, 10 leituras dos
mesmos GB, e foi assim que rodar todas juntas bateu no limite do Hub (429).
Aqui cada tabela e ano é BAIXADO uma vez para o disco do runner, e dali sai a
silver de cada área que precisa dele.

O recorte de cada área continua sendo o do silver-area.py, chamado uma vez
por área com AREA trocada e --fonte-local: as listas de CNAE e CBO, os nomes
dos repositórios e a publicação dependem da área escolhida ao carregar os
módulos, e reaproveitar o script evita duplicar o que já foi conferido (o
recorte de TI bate linha a linha com a silver do TCC). Uma linha pode ir para
mais de uma área (um engenheiro civil numa construtora entra em Engenharia e
em Construção): é um filtro por área sobre a mesma leitura, não uma partição.

    python silver-areas.py --base caged --modo verificar --areas "tec saude" [--ano-inicio N] [--ano-fim N] [--forcar]
        Verifica cada área (silver-area.py --modo verificar) e junta as
        pendências por tabela e ano: [{"tabela", "ano", "areas": "tec saude"}].

    python silver-areas.py --base caged --modo processar --tabela caged_mov --ano 2025 --areas "tec saude"
        Baixa caged_mov/ano_particao=2025 da completa e recorta cada área.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

_AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI.parent))

from _utils import areas, log, nuvem, telegram  # noqa: E402

log.ativar_horario()

SCRIPT = _AQUI / "silver-area.py"


def _argumentos():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base", choices=("caged", "rais"), required=True)
    p.add_argument("--modo", choices=("verificar", "processar"), required=True)
    p.add_argument("--areas", required=True, help='Áreas separadas por espaço, ou "todas"')
    p.add_argument("--ano-inicio", type=int, default=2007)
    p.add_argument("--ano-fim", type=int, default=9999)
    p.add_argument("--forcar", action="store_true")
    p.add_argument("--tabela", help="processar: a tabela")
    p.add_argument("--ano", type=int, help="processar: o ano")
    args = p.parse_args()
    args.areas = list(areas.AREAS) if args.areas.strip() == "todas" else args.areas.split()
    desconhecidas = set(args.areas) - set(areas.AREAS)
    if desconhecidas or not args.areas:
        raise SystemExit(f"área(s) desconhecida(s): {sorted(desconhecidas)}; use {sorted(areas.AREAS)} ou todas")
    if args.modo == "processar" and not (args.tabela and args.ano):
        raise SystemExit("--modo processar precisa de --tabela e --ano")
    return args


def _por_area(area: str, *argumentos: str) -> int:
    """Roda o silver-area.py para uma área. Sem GITHUB_OUTPUT: as saídas do job são deste script."""
    ambiente = {**os.environ, "AREA": area}
    ambiente.pop("GITHUB_OUTPUT", None)
    return subprocess.run([sys.executable, str(SCRIPT), *argumentos], env=ambiente).returncode


def _saida_do_job(**valores) -> None:
    caminho = os.getenv("GITHUB_OUTPUT")
    if caminho:
        with open(caminho, "a", encoding="utf-8") as f:
            for chave, valor in valores.items():
                f.write(f"{chave}={valor}\n")


def modo_verificar(args) -> int:
    nuvem.preparar_staging()
    pendentes: dict[tuple[str, int], list[str]] = {}
    com_novidade, falhas = [], []
    for area in args.areas:
        print(f"\n── {area}", flush=True)
        saida = nuvem.DIR_TEMP / f"verificar_{args.base}_{area}.json"
        codigo = _por_area(area, "--base", args.base, "--modo", "verificar",
                           "--ano-inicio", str(args.ano_inicio), "--ano-fim", str(args.ano_fim),
                           *(["--forcar"] if args.forcar else []), "--silencioso", "--json-saida", str(saida))
        if codigo != 0:
            falhas.append(area)
            continue
        resultado = json.loads(saida.read_text(encoding="utf-8"))
        if resultado["tem_novidade"]:
            com_novidade.append(area)
        for p in resultado["anos"]:
            pendentes.setdefault((p["tabela"], p["ano"]), []).append(area)

    itens = [{"tabela": t, "ano": a, "areas": " ".join(lista)} for (t, a), lista in sorted(pendentes.items())]
    print(f"\n📋 {len(itens)} tabela/ano a baixar, para {len(com_novidade)} área(s) com novidade: "
          f"{', '.join(com_novidade) or 'nenhuma'}")
    for item in itens:
        print(f"   {item['tabela']} {item['ano']}: {item['areas']}")
    _saida_do_job(tem_novidade=str(bool(itens)).lower(), itens=json.dumps(itens),
                  areas_com_novidade=json.dumps(com_novidade))

    if falhas:
        telegram.notificar(f"⚠️ *Silver {args.base.upper()} das áreas*: verificação falhou em {', '.join(falhas)}")
        return 1
    if itens or os.getenv("GITHUB_EVENT_NAME") != "schedule":
        situacao = (f"{len(itens)} tabela/ano a recortar para {', '.join(com_novidade)}" if itens
                    else "todas as áreas em dia")
        telegram.notificar(f"🔎 *Silver {args.base.upper()} das áreas*: {situacao}.")
    return 0


def modo_processar(args) -> int:
    from huggingface_hub import snapshot_download

    nuvem.preparar_staging()
    origem = nuvem.repo_silver(args.tabela, completa=True)
    local = nuvem.DIR_TEMP / "completa_baixada"
    shutil.rmtree(local, ignore_errors=True)
    inicio = time.time()
    nuvem.com_espera_no_limite(
        lambda: snapshot_download(origem, repo_type="dataset", local_dir=local,
                                  allow_patterns=[f"{args.tabela}/ano_particao={args.ano}/*"]),
        f"{args.tabela} {args.ano}")
    arquivos = list((local / args.tabela).rglob("*.parquet"))
    print(f"⬇️  {args.tabela} {args.ano} da silver completa: {len(arquivos)} arquivo(s), "
          f"{sum(a.stat().st_size for a in arquivos) / 1e9:.2f} GB em {time.time() - inicio:.0f}s", flush=True)

    falhas = []
    for area in args.areas:
        print(f"\n── {area}", flush=True)
        codigo = _por_area(area, "--base", args.base, "--modo", "processar", "--tabela", args.tabela,
                           "--ano-inicio", str(args.ano), "--ano-fim", str(args.ano),
                           "--fonte-local", str(local), "--sem-cartao", "--silencioso")
        if codigo != 0:
            falhas.append(area)
    shutil.rmtree(local, ignore_errors=True)

    print(f"\n🏁 {args.tabela} {args.ano}: {len(args.areas) - len(falhas)}/{len(args.areas)} área(s)"
          + (f" — falhou em {', '.join(falhas)}" if falhas else ""))
    if falhas:
        telegram.notificar(f"⚠️ *Silver {args.tabela} {args.ano}*: falhou em {', '.join(falhas)}")
        return 2
    return 0


def main() -> int:
    args = _argumentos()
    return modo_verificar(args) if args.modo == "verificar" else modo_processar(args)


if __name__ == "__main__":
    sys.exit(main())
