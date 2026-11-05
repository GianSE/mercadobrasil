# mercadobrasil

Mercado de trabalho formal no Brasil por área de atuação (TI, saúde, educação,
agronegócio, finanças, indústria, construção, logística, comércio e
engenharia), a partir da RAIS e do CAGED (MTE/PDET). Nasceu do TCC, que está
no repositório `mercadotech` (só TI, congelado). Tudo o que não é do TCC vem
para cá.

## Onde está cada coisa

- `tasks-python/` — o pipeline, em camadas medallion:
  - `1-bronze/` — baixa do FTP do MTE e converte para Parquet (comum a todas as áreas).
  - `2-silver/` — a silver **completa** (a base inteira traduzida pelos dicionários
    do MTE, comum a todas as áreas) e a silver de **área** (`silver-area.py`:
    só um filtro sobre a completa; `silver-areas.py`: várias áreas lendo a
    completa uma vez só).
  - `3-gold/` — agregados por área: `gold-rais.py`, `gold-caged-consolidado.py`
    (espelho anual + cubos), `gold-territorio.py` (mapa + clusters),
    `gold-modelos.py` (previsão, nowcast, hiato, sobrevivência).
  - `_utils/` — `areas.py` (as listas de CNAE e CBO de cada área), `nuvem.py`
    (repositórios, caminhos, leitura e publicação no Hub), `incremental.py`.
- `site/` — o site (Vite + React + Tailwind + ECharts + DuckDB-Wasm), um
  Cloudflare Worker de arquivos estáticos que lê a gold direto do Hugging Face.
  O deploy sai sozinho a cada push (Workers Builds).
- `.github/workflows/` — os Pipelines. Os nomes agrupam a lista do Actions:
  `Pipeline ·` (o que se roda), `Etapa ·` (conserto pontual), `Uso interno ·`
  (chamado pelos Pipelines), `Auditoria ·`, `Alerta ·`.
- `dashboards/` — o site antigo do TCC, só como referência. Não mexer.

## Dados no Hugging Face (`Gianpedro/...`)

- Comuns: `bronze-caged`, `bronze-rais`, `silver-caged`, `silver-rais` (completas),
  `mte-dicionarios`.
- Um repositório por área: `mercadobrasil-<área>`, com as pastas
  `silver-caged-<área>/`, `silver-rais-<área>/` e `gold-<área>/`. Os caminhos
  saem de `nuvem.pasta_silver`, `nuvem.pasta_base` e `nuvem.caminho_na_gold`;
  nunca escreva caminho na mão.
- Do TCC, **não escrever**: `silver-caged-ti`, `silver-rais-ti`,
  `gold-analise-mercado-ti` (TI aqui se chama `tec` justamente para isso).
- Os nomes `silver-caged-<área>` são redirecionamentos para
  `mercadobrasil-<área>`: nunca criar nem apagar repositório por eles.

## Como os Pipelines rodam

- `Pipeline · CAGED (semanal)`: toda terça, sozinho. `Pipeline · RAIS (mensal)`:
  todo dia 15. `Pipeline · CAGED + RAIS`: à mão, para área nova ou refazer.
- Cada um: bronze → silver completa → silver das áreas (uma leitura da
  completa para todas) → gold, 2 áreas por vez, só nas que ganharam dado novo.
- Gold incremental por padrão ("anos da gold: recentes"): toda tabela da gold
  tem o ano no grão, então refaz só os anos novos e mescla com a publicada.
  CAGED: ano corrente e anterior. RAIS: o ano novo. Tabela ainda não
  publicada sai inteira sozinha. "todos" refaz do zero (necessário depois de
  mudar as listas de uma área).

## Convenções

- Código, comentários, logs e mensagens de commit em português.
- Comentário explica o **porquê** (a decisão, o que deu errado antes), não o que
  a linha faz. Docstring no topo de cada script com o uso.
- As colunas de classificação são genéricas e iguais em toda área:
  `setor_da_area` (estabelecimento do setor, pela CNAE), `ocupacao_da_area`
  (ocupação da área, pela CBO) e `subarea`. Nomes internos do código ainda
  carregam `_ti`/`TI` (`escopo_tecnologia`, `CNAE_TI`, `fonte_silver_ti`...): são
  herança do TCC, e a área vem de `AREA`.
- Pandas e DuckDB; não propor polars.

## Armadilhas que já custaram caro

- **A área é fixada ao carregar os módulos**: `nuvem` e `escopo_tecnologia` leem
  `AREA` no import. Para várias áreas no mesmo job, um subprocesso por área
  (como `silver-areas.py`), nunca um laço trocando a variável.
- **Scripts que chamam outros `main()`**: `publicar_gold.main()`, os clusters e
  outros leem `sys.argv`. Quem recebe argumentos próprios (`--base`, `--anos`)
  limpa `sys.argv` antes de chamá-los.
- **Cópia local da silver** (`ESPELHO_SILVER_LOCAL=1` nas golds): montar uma
  lista de arquivos com `fonte_silver_ti` baixa esses arquivos. Por isso o
  `construir_gold.py` usa marcadores (`__FONTE_VINC__`) resolvidos na hora, e
  os anos de uma tabela saem da listagem (`nuvem.anos_no_repo`), nunca de um
  `SELECT DISTINCT ano` sobre os dados.
- **Novo CAGED grava a CNAE sem o zero à esquerda**: o filtro de setor completa
  até 7 dígitos (`lpad(..., greatest(length, 7))`).
- **Artefato de Rondônia na RAIS**: funcionalismo estadual de Porto Velho
  declarado como programador (CBO 317110/721215); sai pelo limiar por ano e
  código (`esc.sql_sem_artefato_rais`). Qualquer leitura nova do `rais_vinc`
  precisa do mesmo filtro.
- **Ano do CAGED**: a silver é particionada pelo ano do **arquivo**; a declaração
  atrasada de uma competência chega num arquivo posterior, nunca anterior.
- **Mediana exata** guarda tudo na memória: com muitos recortes e todos os anos
  de uma área grande, derruba o runner (a `rais_mediana` roda ano a ano).
- **Limites do Hub**: ~128 commits/hora por repositório e um limite de downloads
  por conta. Commit em lote (`create_commit`), esperas de `com_espera_no_limite`.
- **Site**: o Hub responde 404 a `Referer` de `*.workers.dev`, por isso todo
  fetch vai com `referrerPolicy: "no-referrer"`; repositório inexistente
  responde 401 sem login. As tabelas são baixadas pelo commit de cada uma.

## Comandos

```bash
# local: token no .env (copie .env.example); Python com requirements-pipeline.txt
AREA=saude python tasks-python/3-gold/gold-rais.py --anos recentes

# site
cd site && npm run build        # tsc + vite + service worker do PWA
cd site && npm run areas        # regenera src/areas.json a partir de areas.py
```

Os jobs pesados rodam no GitHub Actions, não na máquina local.

## Git

Não rodar `git commit` nem `git push` por conta própria: entregar os comandos
para o usuário rodar. Mensagens de commit sem linha de coautoria de IA.
