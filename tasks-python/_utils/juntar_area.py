"""
Migração única: junta tudo de uma área num repositório só, Gianpedro/mercadobrasil-<área>,
uma pasta por camada.

    silver-caged-<área>              -> mercadobrasil-<área>/silver-caged-<área>/
    silver-rais-<área>               -> mercadobrasil-<área>/silver-rais-<área>/
    gold-mercado-brasil/<área>/      -> mercadobrasil-<área>/gold-<área>/

O caminho mais caro (o CAGED, ~580 arquivos por área) não baixa nada: o
repositório silver-caged-<área> é RENOMEADO para mercadobrasil-<área>, e os arquivos
mudam de pasta por cópia dentro do próprio repositório (o Hub reaproveita o
arquivo LFS que já guarda, sem transferir os bytes). Só a RAIS (~40 arquivos)
e a gold (~32 arquivos pequenos) passam pelo runner.

Pode rodar de novo depois de uma falha: o que já está no destino com o mesmo
tamanho é pulado. Não apaga silver-rais-<área> nem gold-mercado-brasil; os do
TCC (-ti) nem entram.

    python _utils/juntar_area.py --area saude
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
from _utils.cartoes_raiz import pastas, publicar_raiz  # noqa: E402

USUARIO = "Gianpedro"
# O Hub recomenda commits de até ~100 arquivos; os 2 GB seguram o disco do runner.
MAX_ARQUIVOS, MAX_BYTES = 100, 2 * 1024**3


def _arquivos(api, repo: str) -> dict:
    """Caminho -> o item da listagem (com tamanho e, se for LFS, o lfs)."""
    return {f.path: f for f in nuvem.com_espera_na_leitura(
        lambda: list(api.list_repo_tree(repo, repo_type="dataset", recursive=True)), f"listagem de {repo}")
        if getattr(f, "size", None) is not None and f.path != ".gitattributes"}


def renomear_caged(api, area: str, alvo: str) -> None:
    """silver-caged-<área> passa a se chamar mercadobrasil-<área> (só uma vez)."""
    caged = f"{USUARIO}/silver-caged-{area}"
    if api.repo_exists(alvo, repo_type="dataset"):
        print(f"✅ {alvo} já existe")
        return
    if api.repo_exists(caged, repo_type="dataset"):
        api.move_repo(from_id=caged, to_id=alvo, repo_type="dataset")
        print(f"🔀 {caged} renomeado para {alvo}")
    else:
        api.create_repo(repo_id=alvo, repo_type="dataset")
        print(f"🆕 {alvo} criado ({caged} não existia)")


def caged_para_pasta(api, alvo: str, area: str) -> None:
    """O que o CAGED deixou na raiz vai para silver-caged-<área>/, sem baixar os parquets."""
    from huggingface_hub import CommitOperationAdd, CommitOperationCopy, CommitOperationDelete, hf_hub_download

    na_raiz = {c: f for c, f in _arquivos(api, alvo).items() if not c.startswith(tuple(f"{p}/" for p, _ in pastas(area)))}
    if not na_raiz:
        print("✅ nada do CAGED na raiz")
        return
    pasta = nuvem.pasta_base("caged", area)
    temp = nuvem.DIR_TEMP / "juntar_caged"

    def novo(caminho: str) -> str:
        # O espelho unificado já com o nome novo (era caged_ti_<ano>).
        return f"{pasta}/" + re.sub(r"^caged_ti_(\d{4})\.parquet$", r"caged_unificado_\1.parquet", caminho)

    caminhos = sorted(na_raiz)
    print(f"📦 CAGED: {len(caminhos)} arquivo(s) da raiz para {pasta}/")
    for i in range(0, len(caminhos), MAX_ARQUIVOS):
        lote = caminhos[i:i + MAX_ARQUIVOS]
        copias = []
        for c in lote:
            if na_raiz[c].lfs is not None:
                copias.append(CommitOperationCopy(src_path_in_repo=c, path_in_repo=novo(c)))
            else:
                # Arquivo pequeno fora do LFS (o README): baixa e sobe de novo.
                local = hf_hub_download(alvo, c, repo_type="dataset", local_dir=temp)
                copias.append(CommitOperationAdd(path_in_repo=novo(c), path_or_fileobj=local))
        # Cópia e remoção em commits separados: se a remoção falhar, os
        # arquivos já estão nos dois lugares, e rodar de novo só refaz a cópia
        # (o mesmo conteúdo) e remove.
        nuvem.com_espera_no_limite(lambda: api.create_commit(
            repo_id=alvo, repo_type="dataset", operations=copias,
            commit_message=f"CAGED para {pasta}/ ({len(lote)} arquivo(s))"), alvo)
        nuvem.com_espera_no_limite(lambda: api.create_commit(
            repo_id=alvo, repo_type="dataset", operations=[CommitOperationDelete(path_in_repo=c) for c in lote],
            commit_message=f"CAGED: sai da raiz ({len(lote)} arquivo(s), já em {pasta}/)"), alvo)
        print(f"   ☁️  {i + len(lote)}/{len(caminhos)}", flush=True)
    shutil.rmtree(temp, ignore_errors=True)


def copiar_de(api, origem: str, prefixo: str, alvo: str, pasta: str) -> None:
    """Baixa os arquivos de `origem` (só os sob `prefixo`) e sobe em `alvo`/`pasta`/."""
    from huggingface_hub import CommitOperationAdd, hf_hub_download

    if not api.repo_exists(origem, repo_type="dataset"):
        print(f"↪️  {origem} não existe: nada a copiar para {pasta}/")
        return
    na_origem = {c[len(prefixo):]: f.size for c, f in _arquivos(api, origem).items() if c.startswith(prefixo)}
    no_destino = {c: f.size for c, f in _arquivos(api, alvo).items()}
    pendentes = sorted(c for c, t in na_origem.items() if no_destino.get(f"{pasta}/{c}") != t)
    print(f"📦 {origem}/{prefixo} -> {pasta}/: {len(na_origem)} arquivo(s), {len(pendentes)} a copiar "
          f"({sum(na_origem[c] for c in pendentes) / 1e9:.2f} GB)")

    temp = nuvem.DIR_TEMP / "juntar" / pasta
    lote, tamanho = [], 0

    def enviar():
        nonlocal lote, tamanho
        if not lote:
            return
        operacoes = [CommitOperationAdd(path_in_repo=f"{pasta}/{c}", path_or_fileobj=str(local)) for c, local in lote]
        nuvem.com_espera_no_limite(lambda: api.create_commit(
            repo_id=alvo, repo_type="dataset", operations=operacoes,
            commit_message=f"{pasta}/: copiado de {origem} ({len(operacoes)} arquivo(s))"), alvo)
        print(f"   ☁️  {len(lote)} arquivo(s), {tamanho / 1e9:.2f} GB", flush=True)
        shutil.rmtree(temp, ignore_errors=True)
        lote, tamanho = [], 0

    for c in pendentes:
        local = nuvem.com_espera_no_limite(
            lambda: hf_hub_download(origem, prefixo + c, repo_type="dataset", local_dir=temp), c)
        lote.append((c, Path(local)))
        tamanho += na_origem[c]
        if len(lote) >= MAX_ARQUIVOS or tamanho >= MAX_BYTES:
            enviar()
    enviar()


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--area", required=True, choices=[a for a in AREAS])
    args = p.parse_args()

    from huggingface_hub import HfApi

    api = HfApi()
    area = args.area
    alvo = f"{USUARIO}/mercadobrasil-{area}"
    nuvem.preparar_staging()

    renomear_caged(api, area, alvo)
    caged_para_pasta(api, alvo, area)
    copiar_de(api, f"{USUARIO}/silver-rais-{area}", "", alvo, nuvem.pasta_base("rais", area))
    copiar_de(api, f"{USUARIO}/gold-mercado-brasil", f"{area}/", alvo, nuvem.pasta_gold(area))
    publicar_raiz(alvo, area)

    # Conferência: cada pasta com o que a origem tinha.
    pastas = {}
    for c in _arquivos(api, alvo):
        pastas[c.split("/")[0]] = pastas.get(c.split("/")[0], 0) + 1
    print(f"🏁 {alvo}: " + ", ".join(f"{p}: {n}" for p, n in sorted(pastas.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
