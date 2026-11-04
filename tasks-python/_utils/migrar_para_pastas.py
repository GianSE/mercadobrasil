"""
Migração única: dos repositórios por área (silver-caged-<área>,
silver-rais-<área>, gold-analise-mercado-<área>) para os de área com uma pasta
por área (silver-caged-area/<área>, silver-rais-area/<área>,
gold-mercado-brasil/<área>).

O Hub não copia arquivo entre repositórios: cada um é baixado no runner e
enviado de novo, já no caminho novo. O que já está no destino com o mesmo
tamanho é pulado, então rodar de novo depois de uma falha continua de onde
parou. Os repositórios antigos não são apagados aqui; os do TCC (-ti) nem
entram.

    python _utils/migrar_para_pastas.py --origem silver-caged-saude
"""
import argparse
import re
import shutil
import sys
from pathlib import Path

_AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI.parent))

from _utils import nuvem  # noqa: E402
from _utils.areas import AREAS  # noqa: E402
from _utils.cartoes_raiz import cartao_raiz  # noqa: E402

USUARIO = "Gianpedro"
DESTINOS = {"silver-caged": "silver-caged-area", "silver-rais": "silver-rais-area", "gold-analise-mercado": "gold-mercado-brasil"}
# O Hub recomenda commits de até ~100 arquivos; os 2 GB seguram o disco do runner.
MAX_ARQUIVOS, MAX_BYTES = 100, 2 * 1024**3


def destino_de(origem: str) -> tuple[str, str]:
    """`silver-caged-saude` -> (`silver-caged-area`, `saude`)."""
    for prefixo, destino in DESTINOS.items():
        if origem.startswith(prefixo + "-"):
            area = origem[len(prefixo) + 1:]
            if area not in AREAS:
                raise SystemExit(f"{origem}: '{area}' não é uma área do areas.py")
            return destino, area
    raise SystemExit(f"{origem}: não é um repositório por área")


def caminho_novo(area: str, caminho: str) -> str:
    """Na pasta da área; o CAGED unificado já com o nome novo."""
    caminho = re.sub(r"^caged_ti_(\d{4})\.parquet$", r"caged_unificado_\1.parquet", caminho)
    return f"{area}/{caminho}"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--origem", required=True, help="repositório antigo, sem o usuário (ex.: silver-caged-saude)")
    args = p.parse_args()

    from huggingface_hub import CommitOperationAdd, HfApi, hf_hub_download

    destino, area = destino_de(args.origem)
    origem, alvo = f"{USUARIO}/{args.origem}", f"{USUARIO}/{destino}"
    api = HfApi()
    api.create_repo(repo_id=alvo, repo_type="dataset", exist_ok=True)

    na_origem = {f.path: f.size for f in api.list_repo_tree(origem, repo_type="dataset", recursive=True)
                 if getattr(f, "size", None) is not None and f.path != ".gitattributes"}
    no_destino = {f.path: f.size for f in api.list_repo_tree(alvo, repo_type="dataset", recursive=True)
                  if getattr(f, "size", None) is not None}
    pendentes = sorted(c for c, t in na_origem.items() if no_destino.get(caminho_novo(area, c)) != t)
    print(f"📦 {origem} -> {alvo}/{area}/: {len(na_origem)} arquivo(s), "
          f"{len(na_origem) - len(pendentes)} já no destino, {len(pendentes)} a mover "
          f"({sum(na_origem[c] for c in pendentes) / 1e9:.2f} GB)")

    nuvem.preparar_staging()
    pasta = nuvem.DIR_TEMP / "migracao" / args.origem
    lote, tamanho, commits = [], 0, 0

    def enviar():
        nonlocal lote, tamanho, commits
        if not lote:
            return
        operacoes = [CommitOperationAdd(path_in_repo=novo, path_or_fileobj=str(local)) for novo, local in lote]
        nuvem.com_espera_no_limite(lambda: api.create_commit(
            repo_id=alvo, repo_type="dataset", operations=operacoes,
            commit_message=f"{area}: migrado de {args.origem} ({len(operacoes)} arquivo(s))"), f"{args.origem}")
        commits += 1
        print(f"   ☁️  commit {commits}: {len(lote)} arquivo(s), {tamanho / 1e9:.2f} GB", flush=True)
        shutil.rmtree(pasta, ignore_errors=True)
        lote, tamanho = [], 0

    for caminho in pendentes:
        local = nuvem.com_espera_no_limite(
            lambda: hf_hub_download(origem, caminho, repo_type="dataset", local_dir=pasta), caminho)
        lote.append((caminho_novo(area, caminho), Path(local)))
        tamanho += na_origem[caminho]
        if len(lote) >= MAX_ARQUIVOS or tamanho >= MAX_BYTES:
            enviar()
    enviar()

    # O índice das áreas na raiz do repositório novo.
    raiz = nuvem.DIR_TEMP / f"cartao_raiz_{destino}.md"
    raiz.write_text(cartao_raiz(alvo), encoding="utf-8")
    if nuvem.publicar_cartao(alvo, raiz):
        print("   📝 cartão da raiz atualizado")
    print(f"🏁 {args.origem}: {len(pendentes)} arquivo(s) movido(s) em {commits} commit(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
