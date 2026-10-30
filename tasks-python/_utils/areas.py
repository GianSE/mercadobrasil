"""
Áreas de atuação — o mesmo recorte de duas lentes, uma lista por área.

TI é a área do TCC (repositório mercadotech): validada e reproduzida.
Educação e saúde usam as mesmas regras (escopo_tecnologia.py) com as listas
delas. Cada área define as mesmas peças:

  SETOR     (CNAE, atividade do estabelecimento)  — quem trabalha numa escola
  OCUPAÇÃO  (família CBO, ocupação da pessoa)      — quem é professor, em
                                                     qualquer setor

e `escopo_tecnologia` aplica as da área que a variável de ambiente AREA pedir
(os workflows passam `AREA` pelo input). Sem AREA é TI.

Os nomes das colunas não mudam com a área — `setor_ti`, `ocupacao_ti`,
`area_ti` continuam se chamando assim na gold de saúde ou de educação, e lá
querem dizer "setor da área", "ocupação da área" e "subárea" (a silver não
tem colunas de classificação: é o microdado traduzido, só recortado).
Renomear tocaria todo o código validado de TI; manter o esquema igual deixa
a mesma gold e o mesmo site lerem qualquer área.

Os códigos de educação e saúde foram tirados de
publicacao/referencias/{cbos,cnaes}.parquet (o dicionário do MTE com a
hierarquia, ver gold_caged/gerar_cbo_cnae.py) e ainda não passaram pela
verificação que TI teve — medir quanto cada família
pesa e o que ela arrasta de carona. É o próximo passo antes de usar os
números de uma área.
"""
import os

# Slug da área: vai no nome dos repositórios (silver-caged-<slug>,
# gold-analise-mercado-<slug>), por isso sem acento. TI é "tec" e não "ti":
# silver-caged-ti e gold-analise-mercado-ti são os conjuntos do TCC, que o
# repositório mercadotech mantém.
AREA_PADRAO = "tec"


# --- TI ---------------------------------------------------------------------
# O recorte do TCC. As listas e os comentários vieram de escopo_tecnologia.py
# sem mudar um código.

# --- LENTE 1: setor de TI, por CNAE (subclasse de 7 dígitos) ---------------
# Divisão 62 = Serviços de tecnologia da informação (núcleo do setor).
# Divisão 63 = Serviços de informação; só as subclasses de dados/internet
# entram. Agências de notícias (6391700) ficam de fora: é mídia, não TI.
CNAE_TI = {
    "6201500": "Desenvolvimento de programas sob encomenda",
    "6201501": "Desenvolvimento de programas sob encomenda",
    "6201502": "Web design",
    "6202300": "Software customizável",
    "6203100": "Software não-customizável",
    "6204000": "Consultoria em TI",
    "6209100": "Suporte técnico e manutenção em TI",
    "6311900": "Tratamento de dados e hospedagem",
    "6319400": "Portais e provedores de conteúdo",
    "6399200": "Outros serviços de informação",
}

# --- LENTE 2: profissionais de TI, por família CBO (4 primeiros dígitos) ---
# Família é o nível certo de agregação: agrupa as ocupações de uma mesma
# natureza sem depender de o MTE criar/renomear códigos específicos ao longo
# dos anos (o que de fato aconteceu — "Arquiteto de Soluções de TI" e
# "Analista de Testes de TI" são códigos recentes dentro da família 2124).
CBO_FAMILIAS_TI = {
    "1236": "Direção de serviços de informática",
    "1425": "Gerência de TI",
    "2031": "Pesquisa em computação",
    "2112": "Estatística e ciência de dados",
    "2122": "Engenharia em computação",
    "2123": "Administração de TI (BD, redes, SO)",
    "2124": "Análise de sistemas e desenvolvimento",
    "3171": "Programação e desenvolvimento (técnico)",
    "3172": "Operação e suporte ao usuário",
}

# Ocupações de TI que não caem nas famílias acima e valem incluir
# explicitamente, por código completo.
CBO_AVULSOS_TI = {
    "313220": "Técnico em manutenção de equipamentos de informática",
    "313305": "Técnico de comunicação de dados",
    "142135": "Encarregado de proteção de dados (DPO)",
}

# Códigos que a seleção por FAMÍLIA trazia e que não são de tecnologia.
#
# A família é boa regra porque captura códigos que o MTE cria com o tempo — mas
# duas famílias misturam TI com outra coisa. A 2031 é "pesquisa em ciências
# naturais e exatas": dela só a computação (2031-05) é TI; física, química,
# matemática e ciências da terra entravam de carona. A 3171 inclui o
# programador de máquina CNC (3171-15), que é chão de fábrica. Somavam 1.921
# admissões/ano no CAGED 2025, com 1 a 6% delas em empresa de TI.
#
# A exclusão vale só para a LENTE DE OCUPAÇÃO: quem exerce essas ocupações
# dentro de uma empresa de TI continua no recorte pela lente de setor.
CBO_EXCLUIDOS_TI = {
    "203110": "Pesquisador em ciências da terra e meio ambiente",
    "203115": "Pesquisador em física",
    "203120": "Pesquisador em matemática",
    "203125": "Pesquisador em química",
    "317115": "Programador de máquinas-ferramenta com comando numérico (CNC)",
}

# Famílias que entraram DEPOIS da primeira construção da silver de TI.
#
# A 2112 (estatísticos) é onde analistas e cientistas de dados são registrados
# — 2.324 admissões/ano no CAGED 2025, 72% delas FORA de empresa de TI, com
# salário mediano de R$ 7.500. A inclusão foi decidida com o orientador.
#
# Guardar a lista separada é o que permite acrescentar só o que falta à silver
# já construída, em vez de reprocessar a série inteira: ver
# `auditoria.ajustar_recorte` em escopo_tecnologia.
CBO_ACRESCENTADAS_TI = {"2112"}

# --- ÁREAS DE ATUAÇÃO EM TI -----------------------------------------------
# Agrupamento das famílias CBO em áreas analiticamente comparáveis.
#
# Por que agrupar em vez de usar a família crua: medido no CAGED, duas
# famílias respondem por quase nada isoladamente — "Pesquisa em computação"
# (0,3%) e "Direção de serviços de informática" (0,1%). Como categoria
# própria virariam ruído em qualquer gráfico ou recorte; somadas ao seu
# parente natural, viram série legível.
#
# A ordem aqui não importa: cada família pertence a exatamente uma área.
AREAS_TI = {
    "Desenvolvimento": ["2124", "3171"],          # análise/desenvolvimento + programação
    "Suporte e Operação": ["3172"],               # helpdesk, operação
    "Infraestrutura e Dados": ["2123"],           # banco de dados, redes, SO
    "Engenharia e Pesquisa": ["2122", "2031"],    # engenharia de computação + pesquisa
    "Estatística e Ciência de Dados": ["2112"],   # estatísticos, analistas e cientistas de dados
    "Gestão e Direção": ["1425", "1236"],         # gerência e direção de TI
}

# Os códigos avulsos também precisam de área.
AREA_DOS_AVULSOS_TI = {
    "313220": "Suporte e Operação",   # manutenção de equipamentos
    "313305": "Infraestrutura e Dados",  # comunicação de dados
    "142135": "Gestão e Direção",     # encarregado de proteção de dados (DPO)
}


# --- EDUCAÇÃO -------------------------------------------------------------
# Setor: a divisão 85 inteira. Ela já é só ensino (da creche à pós e aos
# cursos livres), sem a mistura que obrigou TI a escolher subclasse.
CNAE_EDUCACAO = {
    "8511200": "Educação infantil - creche",
    "8512100": "Educação infantil - pré-escola",
    "8513900": "Ensino fundamental",
    "8520100": "Ensino médio",
    "8531700": "Educação superior - graduação",
    "8532500": "Educação superior - graduação e pós-graduação",
    "8533300": "Educação superior - pós-graduação e extensão",
    "8541400": "Educação profissional de nível técnico",
    "8542200": "Educação profissional de nível tecnológico",
    "8550301": "Administração de caixas escolares",
    "8550302": "Atividades de apoio à educação, exceto caixas escolares",
    "8591100": "Ensino de esportes",
    "8592901": "Ensino de dança",
    "8592902": "Ensino de artes cênicas, exceto dança",
    "8592903": "Ensino de música",
    "8592999": "Ensino de arte e cultura não especificado anteriormente",
    "8593700": "Ensino de idiomas",
    "8599601": "Formação de condutores",
    "8599602": "Cursos de pilotagem",
    "8599603": "Treinamento em informática",
    "8599604": "Treinamento em desenvolvimento profissional e gerencial",
    "8599605": "Cursos preparatórios para concursos",
    "8599699": "Outras atividades de ensino não especificadas anteriormente",
}

# Ocupação: os professores (subgrupo principal 23 e os de nível médio, 33),
# a coordenação pedagógica e a direção de escola.
CBO_FAMILIAS_EDUCACAO = {
    "1313": "Direção e gerência de instituição educacional",
    "2311": "Professores de nível superior na educação infantil",
    "2312": "Professores de nível superior do ensino fundamental (1ª a 4ª)",
    "2313": "Professores de nível superior do ensino fundamental (5ª a 8ª)",
    "2321": "Professores do ensino médio",
    "2331": "Professores do ensino profissional",
    "2332": "Instrutores do ensino profissional",
    "2341": "Professores de matemática, estatística e computação (superior)",
    "2342": "Professores de ciências físicas e químicas (superior)",
    "2343": "Professores de arquitetura, engenharia e geociências (superior)",
    "2344": "Professores de ciências biológicas e da saúde (superior)",
    "2345": "Professores na área de formação pedagógica (superior)",
    "2346": "Professores de línguas e literatura (superior)",
    "2347": "Professores de ciências humanas (superior)",
    "2348": "Professores de economia, administração e contabilidade (superior)",
    "2349": "Professores de artes (superior)",
    "2392": "Professores de educação especial",
    "2394": "Coordenação e orientação pedagógica",
    "3311": "Professores de nível médio na educação infantil",
    "3312": "Professores de nível médio no ensino fundamental",
    "3313": "Professores de nível médio no ensino profissionalizante",
    "3321": "Professores leigos no ensino fundamental",
    "3322": "Professores práticos no ensino profissionalizante",
    "3331": "Instrutores e professores de cursos livres",
    "3341": "Inspetores de alunos",
}

AREAS_EDUCACAO = {
    "Educação Básica": ["2311", "2312", "2313", "2321", "2392", "3311", "3312", "3321"],
    "Educação Profissional": ["2331", "2332", "3313", "3322"],
    "Ensino Superior": ["2341", "2342", "2343", "2344", "2345", "2346", "2347", "2348", "2349"],
    "Cursos Livres": ["3331"],
    "Coordenação e Apoio Pedagógico": ["2394", "3341"],
    "Gestão Escolar": ["1313"],
}


# --- SAÚDE ----------------------------------------------------------------
# Setor: a divisão 86 inteira (atenção à saúde humana) e, da 87, só o que é
# cuidado de saúde com alojamento. Orfanatos, albergues e condomínios de
# idosos (8730, 8711505) são assistência social e moradia; a 88 também.
CNAE_SAUDE = {
    "8610101": "Atendimento hospitalar, exceto pronto-socorro",
    "8610102": "Pronto-socorro e unidades hospitalares de urgência",
    "8621601": "UTI móvel",
    "8621602": "Serviços móveis de urgência, exceto UTI móvel",
    "8622400": "Remoção de pacientes",
    "8630501": "Atividade médica ambulatorial com procedimentos cirúrgicos",
    "8630502": "Atividade médica ambulatorial com exames complementares",
    "8630503": "Atividade médica ambulatorial restrita a consultas",
    "8630504": "Atividade odontológica",
    "8630506": "Vacinação e imunização humana",
    "8630507": "Reprodução humana assistida",
    "8630599": "Atenção ambulatorial não especificada anteriormente",
    "8640201": "Laboratórios de anatomia patológica e citológica",
    "8640202": "Laboratórios clínicos",
    "8640203": "Diálise e nefrologia",
    "8640204": "Tomografia",
    "8640205": "Diagnóstico por imagem com radiação ionizante, exceto tomografia",
    "8640206": "Ressonância magnética",
    "8640207": "Diagnóstico por imagem sem radiação ionizante, exceto ressonância",
    "8640208": "Diagnóstico por registro gráfico (ECG, EEG)",
    "8640209": "Diagnóstico por métodos ópticos (endoscopia)",
    "8640210": "Quimioterapia",
    "8640211": "Radioterapia",
    "8640212": "Hemoterapia",
    "8640213": "Litotripsia",
    "8640214": "Bancos de células e tecidos humanos",
    "8640299": "Complementação diagnóstica e terapêutica não especificada",
    "8650001": "Enfermagem",
    "8650002": "Nutrição",
    "8650003": "Psicologia e psicanálise",
    "8650004": "Fisioterapia",
    "8650005": "Terapia ocupacional",
    "8650006": "Fonoaudiologia",
    "8650007": "Terapia de nutrição enteral e parenteral",
    "8650099": "Profissionais da saúde não especificados anteriormente",
    "8660700": "Apoio à gestão de saúde",
    "8690901": "Práticas integrativas e complementares",
    "8690902": "Bancos de leite humano",
    "8690903": "Acupuntura",
    "8690904": "Podologia",
    "8690999": "Outras atividades de atenção à saúde humana",
    "8711501": "Clínicas e residências geriátricas",
    "8711502": "Instituições de longa permanência para idosos",
    "8711503": "Assistência a deficientes físicos, imunodeprimidos e convalescentes",
    "8711504": "Centros de apoio a pacientes com câncer e com aids",
    "8712300": "Assistência a paciente no domicílio",
    "8720401": "Centros de assistência psicossocial",
    "8720499": "Assistência psicossocial e à saúde a portadores de distúrbios psíquicos",
}

# Ocupação: as profissões de saúde de nível superior (2231-2263, a
# psicologia), os técnicos e auxiliares (322x, 324x, 3251) e os agentes
# comunitários. O veterinário (2233) fica de fora: é saúde animal.
CBO_FAMILIAS_SAUDE = {
    "1312": "Direção e gerência de serviços de saúde",
    "2212": "Biomédicos",
    "2231": "Médicos (códigos desativados em 2011)",
    "2232": "Cirurgiões-dentistas",
    "2234": "Farmacêuticos",
    "2235": "Enfermeiros",
    "2236": "Fisioterapeutas",
    "2237": "Nutricionistas",
    "2238": "Fonoaudiólogos",
    "2239": "Terapeutas ocupacionais e ortoptistas",
    "2251": "Médicos clínicos",
    "2252": "Médicos em especialidades cirúrgicas",
    "2253": "Médicos em medicina diagnóstica e terapêutica",
    "2261": "Quiropraxistas e osteopatas",
    "2263": "Terapias criativas e naturologia",
    "2515": "Psicólogos e psicanalistas",
    "3222": "Técnicos e auxiliares de enfermagem",
    "3223": "Técnicos em óptica e optometria",
    "3224": "Técnicos e auxiliares de saúde bucal",
    "3225": "Técnicos em ortopedia",
    "3226": "Técnicos em imobilização ortopédica",
    "3241": "Técnicos em equipamentos médicos e radiologia",
    "3242": "Técnicos de laboratório de saúde e hemoterapia",
    "3251": "Técnicos em farmácia",
    "5151": "Agentes comunitários de saúde e afins",
    "5152": "Auxiliares de laboratório da saúde",
}

# A família 3221 (terapias complementares e estéticas) tem o esteticista e a
# doula; dela só entram os dois códigos de saúde. Os outros dois avulsos
# vivem em famílias que não são de saúde (meio ambiente, cuidadores).
CBO_AVULSOS_SAUDE = {
    "322105": "Técnico em acupuntura",
    "322110": "Podólogo",
    "352210": "Agente de saúde pública",
    "516220": "Cuidador em saúde",
}

AREAS_SAUDE = {
    "Medicina": ["2231", "2251", "2252", "2253"],
    "Enfermagem": ["2235", "3222"],
    "Odontologia": ["2232", "3224"],
    "Farmácia e Diagnóstico": ["2212", "2234", "3241", "3242", "3251", "5152"],
    "Reabilitação e Terapias": ["2236", "2237", "2238", "2239", "2261", "2263", "2515",
                                "3223", "3225", "3226"],
    "Atenção Comunitária": ["5151"],
    "Gestão em Saúde": ["1312"],
}

AREA_DOS_AVULSOS_SAUDE = {
    "322105": "Reabilitação e Terapias",
    "322110": "Reabilitação e Terapias",
    "352210": "Atenção Comunitária",
    "516220": "Atenção Comunitária",
}


# --- REGISTRO ---------------------------------------------------------------
# `sigla` e `estabelecimento` formam os rótulos que a gold grava: em TI
# "Empresa de TI" e "Profissional de TI fora do setor de TI", em saúde
# "Estabelecimento de saúde" e "Profissional de saúde fora do setor de saúde".
AREAS = {
    "tec": {
        "nome": "TI",
        "sigla": "TI",
        "estabelecimento": "empresa de TI",
        "cnae": CNAE_TI,
        "cbo_familias": CBO_FAMILIAS_TI,
        "cbo_avulsos": CBO_AVULSOS_TI,
        "cbo_excluidos": CBO_EXCLUIDOS_TI,
        "cbo_acrescentadas": CBO_ACRESCENTADAS_TI,
        "subareas": AREAS_TI,
        "area_dos_avulsos": AREA_DOS_AVULSOS_TI,
    },
    "educacao": {
        "nome": "Educação",
        "sigla": "educação",
        "estabelecimento": "instituição de ensino",
        "cnae": CNAE_EDUCACAO,
        "cbo_familias": CBO_FAMILIAS_EDUCACAO,
        "cbo_avulsos": {},
        "cbo_excluidos": {},
        "cbo_acrescentadas": set(),
        "subareas": AREAS_EDUCACAO,
        "area_dos_avulsos": {},
    },
    "saude": {
        "nome": "Saúde",
        "sigla": "saúde",
        "estabelecimento": "estabelecimento de saúde",
        "cnae": CNAE_SAUDE,
        "cbo_familias": CBO_FAMILIAS_SAUDE,
        "cbo_avulsos": CBO_AVULSOS_SAUDE,
        "cbo_excluidos": {},
        "cbo_acrescentadas": set(),
        "subareas": AREAS_SAUDE,
        "area_dos_avulsos": AREA_DOS_AVULSOS_SAUDE,
    },
}


def area_selecionada() -> str:
    """
    A área pedida pela variável AREA, ou TI.

    Uma área desconhecida derruba o job em vez de cair em TI: um erro de
    digitação no input escreveria por cima dos repositórios do TCC.
    """
    area = (os.getenv("AREA") or AREA_PADRAO).strip().lower()
    if area not in AREAS:
        raise SystemExit(f"AREA={area!r} desconhecida; use uma de {sorted(AREAS)}")
    return area


def _conferir() -> None:
    """Cada família numa subárea só, e toda família da lista com subárea."""
    for slug, a in AREAS.items():
        vistas = [f for fams in a["subareas"].values() for f in fams]
        repetidas = {f for f in vistas if vistas.count(f) > 1}
        assert not repetidas, f"{slug}: família em mais de uma subárea: {repetidas}"
        sem_area = set(a["cbo_familias"]) - set(vistas)
        sobrando = set(vistas) - set(a["cbo_familias"])
        assert not sem_area and not sobrando, f"{slug}: sem subárea {sem_area}, fora da lista {sobrando}"
        assert set(a["area_dos_avulsos"]) == set(a["cbo_avulsos"]), f"{slug}: avulso sem subárea"
        assert not set(a["cbo_avulsos"]) & set(a["cbo_excluidos"]), f"{slug}: avulso também excluído"


_conferir()
