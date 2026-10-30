"""
Definição do recorte de TECNOLOGIA — a decisão metodológica central do estudo.

Existem DUAS formas legítimas de recortar "mercado de tecnologia" nos
microdados do CAGED, e elas descrevem populações diferentes:

  SETOR DE TI (por CNAE, atividade do estabelecimento)
      Quem trabalha em empresa cuja atividade econômica é tecnologia.
      Inclui a recepcionista de uma software house.
      Exclui o desenvolvedor de um banco.

  PROFISSIONAIS DE TI (por CBO, ocupação da pessoa)
      Quem exerce ocupação de tecnologia, em qualquer setor.
      Inclui o desenvolvedor do banco.
      Exclui a recepcionista da software house.

No Brasil a maior parte dos profissionais de TI trabalha FORA do setor de TI
(bancos, varejo, indústria, governo). Por isso as duas lentes dão respostas
diferentes para "o mercado de tecnologia cresceu?" — e a diferença entre elas
é um resultado do trabalho, não um detalhe de implementação. A gold constrói
as duas, mais o mercado geral como linha de base: sem baseline, "TI cresceu
8%" não significa nada.

POR QUE POR FAMÍLIA DE CÓDIGO, E NÃO POR PALAVRA-CHAVE
------------------------------------------------------
Filtrar a descrição por palavras como "sistemas" ou "dados" traz
"Trabalhador na Operação de Sistemas de Irrigação por Aspersão" e "Montador
de Sistemas de Combustível de Aeronaves" — verificado no dicionário do MTE.
Os códigos de TI foram conferidos um a um contra
bronze/dicionarios/novo_caged/{subclasse,cbo2002ocupacao}.parquet.

As listas de cada área ficam em _utils/areas.py; todo o resto do pipeline
segue a partir daqui.
"""

from _utils import areas as _areas

# --- A ÁREA DO RECORTE ------------------------------------------------------
# As listas de cada área (TI, educação, saúde) vivem em _utils/areas.py; este
# módulo é a regra que as aplica. A variável de ambiente AREA escolhe qual —
# os workflows a passam pelo input — e sem ela é TI, o recorte do TCC. As funções abaixo leem estes nomes na hora da chamada, e o resto do
# pipeline continua importando-os daqui, com o nome de sempre.
AREA = _areas.area_selecionada()
_A = _areas.AREAS[AREA]

# LENTE 1: setor, por CNAE (subclasse de 7 dígitos).
CNAE_TI = _A["cnae"]

# LENTE 2: ocupação, por família CBO (4 primeiros dígitos), mais os códigos
# avulsos que valem incluir e os que a família trazia de carona.
CBO_FAMILIAS_TI = _A["cbo_familias"]
CBO_AVULSOS_TI = _A["cbo_avulsos"]
CBO_EXCLUIDOS = _A["cbo_excluidos"]

# Famílias que entraram depois da primeira construção da silver: é o que
# permite acrescentar só o que falta, em vez de reprocessar a série inteira
# (ver `auditoria.ajustar_recorte`).
CBO_FAMILIAS_ACRESCENTADAS = _A["cbo_acrescentadas"]


# As colunas de CNAE e CBO mudam de nome entre as gerações do CAGED e na
# RAIS. O recorte é o mesmo; só o nome do campo muda.
COLUNAS_POR_TABELA = {
    "caged_mov": ("subclasse", "cbo2002ocupacao"),
    "caged_for": ("subclasse", "cbo2002ocupacao"),
    "caged_exc": ("subclasse", "cbo2002ocupacao"),
    "caged_old": ("cnae_20_subclas", "cbo_2002_ocupacao"),
    "caged_ajustes": ("cnae_20_subclas", "cbo_2002_ocupacao"),
    # RAIS: nomes conferidos no bronze. Cobertura verificada em 100% desde
    # 2007 para as duas colunas — é o que sustenta o recorte começar nesse ano
    # (antes disso vigoravam CNAE 1.0 e CBO 1994, taxonomias diferentes).
    "rais_vinc": ("cnae_20_subclasse", "cbo_ocupacao_2002"),
    # O estabelecimento não tem ocupação: uma empresa não exerce CBO. Aqui o
    # recorte é necessariamente só pelo setor.
    "rais_estab": ("cnae_20_subclasse", None),
}


def colunas_da_tabela(tabela: str, colunas_existentes: list[str]) -> tuple[str | None, str | None]:
    """
    Descobre como CNAE e CBO se chamam nesta tabela.

    Devolve None para o que não existir no arquivo: o CAGED antigo dos
    primeiros anos não traz CNAE 2.0 (só a 1.0), e nesse caso o recorte cai
    para a ocupação apenas — melhor perder a lente de setor num ano do que
    derrubar a ingestão inteira.
    """
    cnae, cbo = COLUNAS_POR_TABELA.get(tabela, ("subclasse", "cbo2002ocupacao"))
    return (cnae if cnae in colunas_existentes else None,
            cbo if cbo in colunas_existentes else None)


def sql_filtro_tecnologia(col_cnae: str | None, col_cbo: str | None) -> str | None:
    """
    Predicado do recorte: fica a movimentação que for de SETOR de TI OU de
    OCUPAÇÃO de TI. A união das duas lentes é o que preserva, dentro do
    recorte, tanto o dev do banco quanto a recepcionista da software house —
    permitindo comparar as duas leituras depois, na gold.

    None quando nenhuma das colunas existe: sem elas não há como recortar, e
    a decisão de o que fazer cabe a quem chamou.
    """
    partes = []
    if col_cnae:
        partes.append(sql_filtro_cnae(col_cnae))
    if col_cbo:
        partes.append(sql_filtro_cbo(col_cbo))
    if not partes:
        return None
    return "(" + " OR ".join(partes) + ")"


# --- SUBÁREAS DE ATUAÇÃO ----------------------------------------------------
# O agrupamento das famílias CBO da área em subáreas comparáveis (em TI:
# desenvolvimento, suporte, infraestrutura...). A lista e o porquê de cada
# grupo estão em _utils/areas.py.
AREAS_TI = _A["subareas"]

# Famílias -> subárea, invertido para consulta direta.
_FAMILIA_PARA_AREA = {fam: area for area, fams in AREAS_TI.items() for fam in fams}

# Os códigos avulsos também precisam de subárea.
AREA_DOS_AVULSOS = _A["area_dos_avulsos"]

# Quem entrou no recorte só pela lente do SETOR (trabalha em empresa de TI mas
# não exerce ocupação de TI). São 39% do recorte no CAGED — não é resíduo, é
# uma categoria de pleno direito, e separá-la é o que permite responder
# "quanto do emprego em empresas de tecnologia não é trabalho técnico".
AREA_NAO_TI = f"Outra ocupação ({_A['estabelecimento']})"


def sql_area_ti(coluna: str = "cbo2002ocupacao") -> str:
    """
    Expressão SQL que classifica a ocupação numa área de TI.

    Normaliza o código antes de ler a família: o CAGED antigo grava com
    tamanho variável e às vezes com hífen, e sem o lpad os quatro primeiros
    dígitos não seriam a família.
    """
    codigo = sql_codigo_cbo(coluna)
    familia = f"substr({codigo}, 1, 4)"
    excluidos = ", ".join(f"'{c}'" for c in CBO_EXCLUIDOS)

    casos = "\n".join(
        f"            WHEN {familia} = '{fam}' THEN '{area}'"
        for fam, area in _FAMILIA_PARA_AREA.items()
    )
    casos_avulsos = "\n".join(
        f"            WHEN {codigo} = '{cod}' THEN '{area}'"
        for cod, area in AREA_DOS_AVULSOS.items()
    )

    # Excluído vem PRIMEIRO: sem isso o pesquisador de física cairia na área
    # "Engenharia e Pesquisa" pela família 2031 antes de chegar ao ELSE.
    # Sem excluídos (áreas além de TI) a linha some: "IN ()" não é SQL válido.
    caso_excluidos = f"WHEN {codigo} IN ({excluidos}) THEN '{AREA_NAO_TI}'" if excluidos else ""
    return f"""CASE
            {caso_excluidos}
{casos_avulsos}
{casos}
            ELSE '{AREA_NAO_TI}'
        END"""


def sql_filtro_cnae(coluna: str = "subclasse") -> str:
    """Predicado SQL do setor de TI."""
    lista = ", ".join(f"'{c}'" for c in CNAE_TI)
    return f"{coluna} IN ({lista})"


def sql_codigo_cbo(coluna: str = "cbo2002ocupacao") -> str:
    """
    O CBO normalizado em 6 dígitos: sem hífen, sem espaço, com zero à esquerda.

    Uma regra só para o filtro e para a classificação por área. Antes cada um
    normalizava de um jeito — a área removia hífen, o filtro não —, e um código
    gravado como "3132-20" passava pela área e escapava do filtro.
    """
    return f"lpad(regexp_replace(trim({coluna}), '[^0-9]', '', 'g'), 6, '0')"


def sql_filtro_cbo(coluna: str = "cbo2002ocupacao") -> str:
    """
    Predicado SQL dos profissionais de TI.

    Compara os 4 primeiros dígitos com a família, soma os códigos avulsos e
    tira os excluídos. O zero à esquerda importa: "21110" é o sargento da
    Polícia Militar (021110), não a família 2111 dos matemáticos.
    """
    familias = ", ".join(f"'{f}'" for f in CBO_FAMILIAS_TI)
    avulsos = ", ".join(f"'{c}'" for c in CBO_AVULSOS_TI)
    excluidos = ", ".join(f"'{c}'" for c in CBO_EXCLUIDOS)
    codigo = sql_codigo_cbo(coluna)
    # Listas vazias (áreas além de TI) viram constante: "IN ()" não é SQL válido.
    em_avulsos = f"{codigo} IN ({avulsos})" if avulsos else "false"
    fora_excluidos = f"{codigo} NOT IN ({excluidos})" if excluidos else "true"
    return (f"((substr({codigo}, 1, 4) IN ({familias}) OR {em_avulsos}) "
            f"AND {fora_excluidos})")


def sql_complemento_cbo(col_cnae: str | None, col_cbo: str) -> str:
    """
    As linhas que ENTRAM no recorte com as famílias acrescentadas.

    São as da família nova que ainda não estavam lá: as que já trabalham em
    empresa de TI entraram desde o começo pela lente de setor, e trazê-las de
    novo as duplicaria.
    """
    codigo = sql_codigo_cbo(col_cbo)
    novas = ", ".join(f"'{f}'" for f in CBO_FAMILIAS_ACRESCENTADAS)
    fora_do_setor = f"NOT coalesce({sql_filtro_cnae(col_cnae)}, false)" if col_cnae else "true"
    return f"(substr({codigo}, 1, 4) IN ({novas}) AND {fora_do_setor})"


def sql_saida_cbo(col_cnae: str | None, col_cbo: str) -> str:
    """
    As linhas que SAEM do recorte com os códigos excluídos.

    Só as que estavam lá exclusivamente pela ocupação: dentro de empresa de TI,
    a lente de setor as mantém.
    """
    codigo = sql_codigo_cbo(col_cbo)
    excluidos = ", ".join(f"'{c}'" for c in CBO_EXCLUIDOS)
    fora_do_setor = f"NOT coalesce({sql_filtro_cnae(col_cnae)}, false)" if col_cnae else "true"
    return f"({codigo} IN ({excluidos}) AND {fora_do_setor})"


# --- ARTEFATO DE DECLARAÇÃO NA RAIS ----------------------------------------
# O Poder Executivo Estadual de Rondônia (natureza jurídica 1023, município
# 110020, Porto Velho) declara o funcionalismo do estado inteiro sob UM código
# CBO só, e o código alterna entre os anos:
#
#     2007-2010, 2018-2020, 2022   317110  Programador de Sistemas de Informação
#     2011-2017                    721215  Operador de Máquinas-Ferramenta Convencionais
#
# São de 45 a 53 mil servidores todo ano, quase todos estatutários, com 140 a
# 160 meses de casa e mediana de 3 SM. O número e o tempo de casa não mudam;
# muda só o código. Nos anos do 317110, esse grupo é o MAIOR grupo de
# "profissionais de TI" do país (maior que os desenvolvedores das LTDA de São
# Paulo) e infla o recorte em até 7,3% (2007). Nos outros anos ele tem de 0 a
# 135 vínculos, que são a TI real do governo do estado e ficam.
#
# Daí a regra por ano, e não por código: o grupo sai só no ano em que passa do
# limiar. O limiar não precisa de ajuste fino: contando também os desligados,
# o maior ano legítimo tem 195 registros e o menor ano do artefato, 44.185.
ARTEFATO_RO = {"municipio": "110020", "natureza_juridica": "1023", "cbo": "317110"}
LIMIAR_ARTEFATO = 1000


def sql_grupo_artefato_ro(col_cbo: str = "cbo_ocupacao_2002") -> str:
    """Predicado do grupo (município, natureza jurídica, CBO) do artefato."""
    a = ARTEFATO_RO
    return (f"(municipio = '{a['municipio']}' AND natureza_juridica = '{a['natureza_juridica']}' "
            f"AND {sql_codigo_cbo(col_cbo)} = '{a['cbo']}')")


def sql_sem_artefato_rais(fonte: str, col_cbo: str = "cbo_ocupacao_2002") -> str:
    """
    Predicado que tira o artefato de Rondônia de uma leitura do rais_vinc.

    `fonte` é a mesma expressão do `read_parquet` principal (a série inteira
    ou só um ano): os anos do artefato são medidos no próprio dado, então um
    ano novo com o mesmo defeito sai sozinho, sem lista de anos para manter.
    """
    grupo = sql_grupo_artefato_ro(col_cbo)
    return (f"NOT ({grupo} AND ano IN ("
            f"SELECT ano FROM read_parquet({fonte}, union_by_name=true) "
            f"WHERE {grupo} GROUP BY ano HAVING count(*) > {LIMIAR_ARTEFATO}))")


def sql_classificacao(col_cnae: str = "subclasse",
                      col_cbo: str | None = "cbo2002ocupacao") -> str:
    """
    Expressão que rotula cada registro nas duas lentes de uma vez.

    Guardar os dois rótulos na mesma tabela permite responder, sem novo
    processamento, a pergunta mais interessante: quantos profissionais de TI
    estão fora do setor de TI.

    Os nomes de coluna são parâmetro porque a mesma classificação vale para o
    CAGED e para a RAIS, que chamam CNAE e CBO de outro jeito. `col_cbo=None`
    atende o estabelecimento da RAIS, que não tem ocupação — uma empresa não
    exerce CBO — e nesse caso a lente de ocupação sai sempre falsa em vez de
    quebrar a consulta.
    """
    ocupacao = (f"CASE WHEN {sql_filtro_cbo(col_cbo)} THEN true ELSE false END"
                if col_cbo else "false")
    return f"""
        CASE WHEN {sql_filtro_cnae(col_cnae)} THEN true ELSE false END AS setor_ti,
        {ocupacao} AS ocupacao_ti
    """


# --- RÓTULOS QUE A GOLD GRAVA ----------------------------------------------
# Derivados da área, para a gold de saúde não gravar "Empresa de TI". Em TI
# saem exatamente os textos de sempre ("Empresa de TI", "Profissional de TI
# fora do setor de TI"...), que o site lê.
SIGLA = _A["sigla"]
_estab = _A["estabelecimento"]
ROTULO_SETOR_DENTRO = _estab[0].upper() + _estab[1:]
ROTULO_SETOR_FORA = f"Fora do setor de {SIGLA}"
LENTE_DENTRO = f"Profissional de {SIGLA} em {_estab}"
LENTE_FORA = f"Profissional de {SIGLA} fora do setor de {SIGLA}"
LENTE_SO_SETOR = f"Outra ocupação em {_estab}"
