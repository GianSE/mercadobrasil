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


# --- ENGENHARIA ------------------------------------------------------------
# Setor: a divisão 71 (arquitetura, engenharia, testes e análises técnicas).
# Ocupação: os engenheiros (214x e os de mecatrônica e alimentos), os
# arquitetos e os técnicos de nível médio das mesmas especialidades (31x). A
# engenharia de computação (2122) fica em TI.
CNAE_ENGENHARIA = {
    "7111100": "Serviços de Arquitetura",
    "7112000": "Serviços de Engenharia",
    "7119701": "Serviços de Cartografia, Topografia e Geodésia",
    "7119702": "Atividades de Estudos Geológicos",
    "7119703": "Serviços de Desenho Técnico Relacionados à Arquitetura e Engenharia",
    "7119704": "Serviços de Perícia Técnica Relacionados à Segurança do Trabalho",
    "7119799": "Atividades Técnicas Relacionadas à Engenharia e Arquitetura não Especificadas Anteriormente",
    "7120100": "Testes e Análises Técnicas",
}

CBO_FAMILIAS_ENGENHARIA = {
    "2021": "Engenheiros mecatrônicos e de automação",
    "2140": "Engenheiros ambientais",
    "2141": "Arquitetos e urbanistas",
    "2142": "Engenheiros civis",
    "2143": "Engenheiros eletricistas e eletrônicos",
    "2144": "Engenheiros mecânicos",
    "2145": "Engenheiros químicos",
    "2146": "Engenheiros de materiais e metalurgistas",
    "2147": "Engenheiros de minas",
    "2148": "Engenheiros agrimensores e cartógrafos",
    "2149": "Engenheiros de produção, qualidade e segurança",
    "2222": "Engenheiros de alimentos",
    "3001": "Técnicos em mecatrônica",
    "3003": "Técnicos em eletromecânica",
    "3121": "Técnicos de obras civis",
    "3122": "Técnicos de estradas e saneamento",
    "3123": "Técnicos em agrimensura e topografia",
    "3131": "Eletrotécnicos",
    "3132": "Técnicos em eletrônica",
    "3133": "Técnicos em telecomunicações",
    "3134": "Técnicos em instrumentação e calibração",
    "3135": "Técnicos em fotônica",
    "3141": "Técnicos mecânicos",
    "3142": "Técnicos em ferramentaria",
    "3143": "Técnicos em automobilística, aeronaves e embarcações",
    "3144": "Técnicos em manutenção de máquinas",
    "3146": "Técnicos em soldagem e estruturas metálicas",
    "3147": "Técnicos em siderurgia",
    "3161": "Técnicos em geologia e geofísica",
    "3163": "Técnicos de mineração",
}

AREAS_ENGENHARIA = {
    "Civil e Construção": ["2142", "3121", "3122"],
    "Arquitetura e Urbanismo": ["2141"],
    "Elétrica e Eletrônica": ["2143", "3131", "3132", "3133", "3134", "3135"],
    "Mecânica e Mecatrônica": ["2021", "2144", "3001", "3003", "3141", "3142", "3143", "3144", "3146"],
    "Produção e Qualidade": ["2149"],
    "Química, Materiais e Alimentos": ["2145", "2146", "2222", "3147"],
    "Minas, Geociências e Ambiental": ["2140", "2147", "2148", "3123", "3161", "3163"],
}


# --- FINANÇAS --------------------------------------------------------------
# Setor: as divisões 64 a 66 (bancos, seguros, previdência, auxiliares).
# Ocupação: bancários, profissionais de investimento e crédito, contadores,
# economistas e técnicos de seguros. Os fiscais de tributos (254x) ficam de
# fora: são administração pública, não mercado financeiro.
CNAE_FINANCAS = {
    "6410700": "Banco Central",
    "6421200": "Bancos Comerciais",
    "6422100": "Bancos Múltiplos, com Carteira Comercial",
    "6423900": "Caixas Econômicas",
    "6424701": "Bancos Cooperativos",
    "6424702": "Cooperativas Centrais de Crédito",
    "6424703": "Cooperativas de Crédito Mútuo",
    "6424704": "Cooperativas de Crédito Rural",
    "6431000": "Bancos Múltiplos, sem Carteira Comercial",
    "6432800": "Bancos de Investimento",
    "6433600": "Bancos de Desenvolvimento",
    "6434400": "Agências de Fomento",
    "6435201": "Sociedades de Crédito Imobiliário",
    "6435202": "Associações de Poupança e Empréstimo",
    "6435203": "Companhias Hipotecárias",
    "6436100": "Sociedades de Crédito, Financiamento e Investimento - Financeiras",
    "6437900": "Sociedades de Crédito ao Microempreendedor",
    "6438701": "Bancos de Câmbio",
    "6438799": "Outras Instituições de Intermediação Não-Monetária não Especificadas Anteriormente",
    "6440900": "Arrendamento Mercantil",
    "6450600": "Sociedades de Capitalização",
    "6461100": "Holdings de Instituições Financeiras",
    "6462000": "Holdings de Instituições Não-Financeiras",
    "6463800": "Outras Sociedades de Participação, Exceto Holdings",
    "6470101": "Fundos de Investimento, Exceto Previdenciários e Imobiliários",
    "6470102": "Fundos de Investimento Previdenciários",
    "6470103": "Fundos de Investimento Imobiliários",
    "6491300": "Sociedades de Fomento Mercantil - Factoring",
    "6492100": "Securitização de Créditos",
    "6493000": "Administração de Consórcios para Aquisição de Bens e Direitos",
    "6499901": "Clubes de Investimento",
    "6499902": "Sociedades de Investimento",
    "6499903": "Fundo Garantidor de Crédito",
    "6499904": "Caixas de Financiamento de Corporações",
    "6499905": "Concessão de Crédito Pelas Oscip",
    "6499999": "Outras Atividades de Serviços Financeiros não Especificadas Anteriormente",
    "6511101": "Seguros de Vida",
    "6511102": "Planos de Auxílio-Funeral",
    "6512000": "Seguros Não-Vida",
    "6520100": "Seguros-Saúde",
    "6530800": "Resseguros",
    "6541300": "Previdência Complementar Fechada",
    "6542100": "Previdência Complementar Aberta",
    "6550200": "Planos de Saúde",
    "6611801": "Bolsa de Valores",
    "6611802": "Bolsa de Mercadorias",
    "6611803": "Bolsa de Mercadorias e Futuros",
    "6611804": "Administração de Mercados de Balcão Organizados",
    "6612601": "Corretoras de Títulos e Valores Mobiliários",
    "6612602": "Distribuidoras de Títulos e Valores Mobiliários",
    "6612603": "Corretoras de Câmbio",
    "6612604": "Corretoras de Contratos de Mercadorias",
    "6612605": "Agentes de Investimentos em Aplicações Financeiras",
    "6613400": "Administração de Cartões de Crédito",
    "6619301": "Serviços de Liquidação e Custódia",
    "6619302": "Correspondentes de Instituições Financeiras",
    "6619303": "Representações de Bancos Estrangeiros",
    "6619304": "Caixas Eletrônicos",
    "6619305": "Operadoras de Cartões de Débito",
    "6619399": "Outras Atividades Auxiliares dos Serviços Financeiros não Especificadas Anteriormente",
    "6621501": "Peritos e Avaliadores de Seguros",
    "6621502": "Auditoria e Consultoria Atuarial",
    "6622300": "Corretores e Agentes de Seguros, de Planos de Previdência Complementar e de Saúde",
    "6629100": "Atividades Auxiliares dos Seguros, da Previdência Complementar e dos Planos de Saúde não Especificadas Anteriormente",
    "6630400": "Atividades de Administração de Fundos por Contrato ou Comissão",
}

CBO_FAMILIAS_FINANCAS = {
    "1417": "Gerentes de instituição financeira",
    "2512": "Economistas",
    "2522": "Contadores e auditores",
    "2525": "Profissionais de finanças (crédito, câmbio, investimentos)",
    "2532": "Gerentes de conta e de relacionamento",
    "3511": "Técnicos de contabilidade",
    "3517": "Técnicos de seguros",
    "3532": "Técnicos de operações bancárias",
    "4131": "Auxiliares de contabilidade e faturamento",
    "4132": "Escriturários e caixas de banco",
}

AREAS_FINANCAS = {
    "Bancos e Crédito": ["1417", "3532", "4132"],
    "Investimentos e Relacionamento": ["2525", "2532"],
    "Contabilidade e Auditoria": ["2522", "3511", "4131"],
    "Seguros": ["3517"],
    "Economia": ["2512"],
}


# --- AGRONEGÓCIO -----------------------------------------------------------
# Setor: a seção A inteira (divisões 01 a 03: lavoura, pecuária, floresta,
# pesca). A agroindústria (alimentos, divisão 10) fica de fora: é indústria.
# Ocupação: todo o grande grupo 6 (produtores, trabalhadores e operadores
# rurais) e os profissionais de ciência agrária. As subclasses daqui são as
# únicas que começam com zero, e o Novo CAGED as grava sem ele: é o caso que
# o lpad de escopo_tecnologia.sql_filtro_cnae resolve.
CNAE_AGRONEGOCIO = {
    "0111301": "Cultivo de Arroz",
    "0111302": "Cultivo de Milho",
    "0111303": "Cultivo de Trigo",
    "0111399": "Cultivo de Outros Cereais não Especificados Anteriormente",
    "0112101": "Cultivo de Algodão Herbáceo",
    "0112102": "Cultivo de Juta",
    "0112199": "Cultivo de Outras Fibras de Lavoura Temporária não Especificadas Anteriormente",
    "0113000": "Cultivo de Cana-De-Açúcar",
    "0114800": "Cultivo de Fumo",
    "0115600": "Cultivo de Soja",
    "0116401": "Cultivo de Amendoim",
    "0116402": "Cultivo de Girassol",
    "0116403": "Cultivo de Mamona",
    "0116499": "Cultivo de Outras Oleaginosas de Lavoura Temporária não Especificadas Anteriormente",
    "0119901": "Cultivo de Abacaxi",
    "0119902": "Cultivo de Alho",
    "0119903": "Cultivo de Batata-Inglesa",
    "0119904": "Cultivo de Cebola",
    "0119905": "Cultivo de Feijão",
    "0119906": "Cultivo de Mandioca",
    "0119907": "Cultivo de Melão",
    "0119908": "Cultivo de Melancia",
    "0119909": "Cultivo de Tomate Rasteiro",
    "0119999": "Cultivo de Outras Plantas de Lavoura Temporária não Especificadas Anteriormente",
    "0121101": "Horticultura, Exceto Morango",
    "0121102": "Cultivo de Morango",
    "0122900": "Cultivo de Flores e Plantas Ornamentais",
    "0131800": "Cultivo de Laranja",
    "0132600": "Cultivo de Uva",
    "0133401": "Cultivo de Açaí",
    "0133402": "Cultivo de Banana",
    "0133403": "Cultivo de Caju",
    "0133404": "Cultivo de Cítricos, Exceto Laranja",
    "0133405": "Cultivo de Coco-Da-Baía",
    "0133406": "Cultivo de Guaraná",
    "0133407": "Cultivo de Maçã",
    "0133408": "Cultivo de Mamão",
    "0133409": "Cultivo de Maracujá",
    "0133410": "Cultivo de Manga",
    "0133411": "Cultivo de Pêssego",
    "0133499": "Cultivo de Frutas de Lavoura Permanente não Especificadas Anteriormente",
    "0134200": "Cultivo de Café",
    "0135100": "Cultivo de Cacau",
    "0139301": "Cultivo de Chá-Da-índia",
    "0139302": "Cultivo de Erva-Mate",
    "0139303": "Cultivo de Pimenta-Do-Reino",
    "0139304": "Cultivo de Plantas para Condimento, Exceto Pimenta-Do-Reino",
    "0139305": "Cultivo de Dendê",
    "0139306": "Cultivo de Seringueira",
    "0139399": "Cultivo de Outras Plantas de Lavoura Permanente não Especificadas Anteriormente",
    "0141501": "Produção de Sementes Certificadas, Exceto de Forrageiras para Pasto",
    "0141502": "Produção de Sementes Certificadas de Forrageiras para Formação de Pasto",
    "0142300": "Produção de Mudas e Outras Formas de Propagação Vegetal, Certificadas",
    "0151201": "Criação de Bovinos para Corte",
    "0151202": "Criação de Bovinos para Leite",
    "0151203": "Criação de Bovinos, Exceto para Corte e Leite",
    "0152101": "Criação de Bufalinos",
    "0152102": "Criação de EqüInos",
    "0152103": "Criação de Asininos e Muares",
    "0153901": "Criação de Caprinos",
    "0153902": "Criação de Ovinos, Inclusive para Produção de Lã",
    "0154700": "Criação de Suínos",
    "0155501": "Criação de Frangos para Corte",
    "0155502": "Produção de Pintos de Um Dia",
    "0155503": "Criação de Outros Galináceos, Exceto para Corte",
    "0155504": "Criação de Aves, Exceto Galináceos",
    "0155505": "Produção de Ovos",
    "0159801": "Apicultura",
    "0159802": "Criação de Animais de Estimação",
    "0159803": "Criação de Escargô",
    "0159804": "Criação de Bicho-Da-Seda",
    "0159899": "Criação de Outros Animais não Especificados Anteriormente",
    "0161001": "Serviço de Pulverização e Controle de Pragas Agrícolas",
    "0161002": "Serviço de Poda de árvores para Lavouras",
    "0161003": "Serviço de Preparação de Terreno, Cultivo e Colheita",
    "0161099": "Atividades de Apoio à Agricultura não Especificadas Anteriormente",
    "0162801": "Serviço de Inseminação Artificial em Animais",
    "0162802": "Serviço de Tosquiamento de Ovinos",
    "0162803": "Serviço de Manejo de Animais",
    "0162899": "Atividades de Apoio à Pecuária não Especificadas Anteriormente",
    "0163600": "Atividades de Pós-Colheita",
    "0170900": "Caça e Serviços Relacionados",
    "0210101": "Cultivo de Eucalipto",
    "0210102": "Cultivo de Acácia-Negra",
    "0210103": "Cultivo de Pinus",
    "0210104": "Cultivo de Teca",
    "0210105": "Cultivo de Espécies Madeireiras, Exceto Eucalipto, Acácia-Negra, Pinus e Teca",
    "0210106": "Cultivo de Mudas em Viveiros Florestais",
    "0210107": "Extração de Madeira em Florestas Plantadas",
    "0210108": "Produção de Carvão Vegetal - Florestas Plantadas",
    "0210109": "Produção de Casca de Acácia-Negra - Florestas Plantadas",
    "0210199": "Produção de Produtos Não-Madeireiros não Especificados Anteriormente em Florestas Plantadas",
    "0220901": "Extração de Madeira em Florestas Nativas",
    "0220902": "Produção de Carvão Vegetal - Florestas Nativas",
    "0220903": "Coleta de Castanha-Do-Pará em Florestas Nativas",
    "0220904": "Coleta de Látex em Florestas Nativas",
    "0220905": "Coleta de Palmito em Florestas Nativas",
    "0220906": "Conservação de Florestas Nativas",
    "0220999": "Coleta de Produtos Não-Madeireiros não Especificados Anteriormente em Florestas Nativas",
    "0230600": "Atividades de Apoio à Produção Florestal",
    "0311601": "Pesca de Peixes em água Salgada",
    "0311602": "Pesca de Crustáceos e Moluscos em água Salgada",
    "0311603": "Coleta de Outros Produtos Marinhos",
    "0311604": "Atividades de Apoio à Pesca em água Salgada",
    "0312401": "Pesca de Peixes em água Doce",
    "0312402": "Pesca de Crustáceos e Moluscos em água Doce",
    "0312403": "Coleta de Outros Produtos Aquáticos de água Doce",
    "0312404": "Atividades de Apoio à Pesca em água Doce",
    "0321301": "Criação de Peixes em água Salgada e Salobra",
    "0321302": "Criação de Camarões em água Salgada e Salobra",
    "0321303": "Criação de Ostras e Mexilhões em água Salgada e Salobra",
    "0321304": "Criação de Peixes Ornamentais em água Salgada e Salobra",
    "0321305": "Atividades de Apoio à AqüIcultura em água Salgada e Salobra",
    "0321399": "Cultivos e Semicultivos da AqüIcultura em água Salgada e Salobra não Especificados Anteriormente",
    "0322101": "Criação de Peixes em água Doce",
    "0322102": "Criação de Camarões em água Doce",
    "0322103": "Criação de Ostras e Mexilhões em água Doce",
    "0322104": "Criação de Peixes Ornamentais em água Doce",
    "0322105": "Ranicultura",
    "0322106": "Criação de Jacaré",
    "0322107": "Atividades de Apoio à AqüIcultura em água Doce",
    "0322199": "Cultivos e Semicultivos da AqüIcultura em água Doce não Especificados Anteriormente",
}

CBO_FAMILIAS_AGRONEGOCIO = {
    "6110": "Produtores agropecuários em geral",
    "6120": "Produtores agrícolas polivalentes",
    "6121": "Produtores de grãos e cana",
    "6122": "Produtores de fibras",
    "6123": "Produtores de hortaliças",
    "6124": "Produtores de flores e plantas ornamentais",
    "6125": "Produtores de frutas",
    "6126": "Produtores de café, cacau, mate e fumo",
    "6127": "Produtores de oleaginosas",
    "6128": "Produtores de especiarias e plantas medicinais",
    "6130": "Criadores em pecuária polivalente",
    "6131": "Criadores de bovinos e equinos",
    "6132": "Criadores de caprinos, ovinos e suínos",
    "6133": "Avicultores e cunicultores",
    "6134": "Apicultores e outros criadores",
    "6220": "Trabalhadores agrícolas em geral",
    "6221": "Trabalhadores da cultura de grãos e cana",
    "6222": "Trabalhadores da cultura de fibras",
    "6223": "Trabalhadores da olericultura",
    "6224": "Trabalhadores no cultivo de flores",
    "6225": "Trabalhadores da fruticultura",
    "6226": "Trabalhadores da cultura de café, cacau e mate",
    "6227": "Trabalhadores da cultura de oleaginosas",
    "6228": "Trabalhadores da cultura de especiarias",
    "6230": "Trabalhadores da pecuária polivalente",
    "6231": "Trabalhadores da pecuária de grande porte",
    "6232": "Trabalhadores da caprino, ovino e suinocultura",
    "6233": "Trabalhadores da avicultura",
    "6234": "Trabalhadores da apicultura e criações especiais",
    "6201": "Supervisores de exploração agropecuária",
    "6210": "Trabalhadores agropecuários em geral",
    "6301": "Supervisores da aquicultura e da área florestal",
    "6310": "Pescadores e catadores artesanais",
    "6311": "Pescadores artesanais de água doce",
    "6312": "Pescadores industriais",
    "6313": "Criadores de organismos aquáticos",
    "6314": "Trabalhadores de apoio à pesca",
    "6320": "Trabalhadores florestais de viveiro",
    "6321": "Trabalhadores da extração de madeira",
    "6322": "Extrativistas de gomas e resinas",
    "6323": "Extrativistas de fibras e ceras",
    "6324": "Extrativistas de frutos e castanhas",
    "6325": "Extrativistas de plantas aromáticas e medicinais",
    "6326": "Carvoeiros",
    "6410": "Operadores de máquinas agrícolas",
    "6420": "Operadores de máquinas florestais",
    "6430": "Operadores de irrigação",
    "2221": "Engenheiros agrônomos, florestais e de pesca",
    "2233": "Veterinários e zootecnistas",
    "3211": "Técnicos agrícolas e agropecuários",
    "3212": "Técnicos florestais",
    "3213": "Técnicos em aquicultura",
    "3231": "Técnicos em pecuária",
}

AREAS_AGRONEGOCIO = {
    "Produtores Rurais": ["6110", "6120", "6121", "6122", "6123", "6124", "6125", "6126", "6127", "6128", "6130", "6131", "6132", "6133", "6134"],
    "Lavoura": ["6220", "6221", "6222", "6223", "6224", "6225", "6226", "6227", "6228"],
    "Pecuária": ["6230", "6231", "6232", "6233", "6234"],
    "Trabalho Agropecuário Geral": ["6201", "6210"],
    "Floresta e Pesca": ["6301", "6310", "6311", "6312", "6313", "6314", "6320", "6321", "6322", "6323", "6324", "6325", "6326"],
    "Mecanização e Irrigação": ["6410", "6420", "6430"],
    "Ciência e Técnica Agrária": ["2221", "2233", "3211", "3212", "3213", "3231"],
}


# --- COMÉRCIO --------------------------------------------------------------
# Setor: a seção G inteira (divisões 45 a 47: veículos, atacado e varejo).
# Ocupação: vendedores, caixas, compradores, representantes e a gestão de
# loja. Os almoxarifes e estoquistas (4141) ficam fora: são logística.
CNAE_COMERCIO = {
    "4511101": "Comércio a Varejo de Automóveis, Camionetas e Utilitários Novos",
    "4511102": "Comércio a Varejo de Automóveis, Camionetas e Utilitários Usados",
    "4511103": "Comércio por Atacado de Automóveis, Camionetas e Utilitários Novos e Usados",
    "4511104": "Comércio por Atacado de Caminhões Novos e Usados",
    "4511105": "Comércio por Atacado de Reboques e Semi-Reboques Novos e Usados",
    "4511106": "Comércio por Atacado de ônibus e Microônibus Novos e Usados",
    "4512901": "Representantes Comerciais e Agentes do Comércio de Veículos Automotores",
    "4512902": "Comércio Sob Consignação de Veículos Automotores",
    "4520001": "Serviços de Manutenção e Reparação Mecânica de Veículos Automotores",
    "4520002": "Serviços de Lanternagem ou Funilaria e Pintura de Veículos Automotores",
    "4520003": "Serviços de Manutenção e Reparação Elétrica de Veículos Automotores",
    "4520004": "Serviços de Alinhamento e Balanceamento de Veículos Automotores",
    "4520005": "Serviços de Lavagem, Lubrificação e Polimento de Veículos Automotores",
    "4520006": "Serviços de Borracharia para Veículos Automotores",
    "4520007": "Serviços de Instalação, Manutenção e Reparação de Acessórios para Veículos Automotores",
    "4520008": "Serviços de Capotaria",
    "4530701": "Comércio por Atacado de Peças e Acessórios Novos para Veículos Automotores",
    "4530702": "Comércio por Atacado de Pneumáticos e Câmaras-De-Ar",
    "4530703": "Comércio a Varejo de Peças e Acessórios Novos para Veículos Automotores",
    "4530704": "Comércio a Varejo de Peças e Acessórios Usados para Veículos Automotores",
    "4530705": "Comércio a Varejo de Pneumáticos e Câmaras-De-Ar",
    "4530706": "Representantes Comerciais e Agentes do Comércio de Peças e Acessórios Novos e Usados para Veículos Automotores",
    "4541201": "Comércio por Atacado de Motocicletas e Motonetas",
    "4541202": "Comércio por Atacado de Peças e Acessórios para Motocicletas e Motonetas",
    "4541203": "Comércio a Varejo de Motocicletas e Motonetas Novas",
    "4541204": "Comércio a Varejo de Motocicletas e Motonetas Usadas",
    "4541205": "Comércio a Varejo de Peças e Acessórios para Motocicletas e Motonetas (Desativado)",
    "4541206": "Comércio a Varejo de Peças e Acessórios Novos para Motocicletas e Motonetas",
    "4541207": "Comércio a Varejo de Peças e Acessórios Usados para Motocicletas e Motonetas",
    "4542101": "Representantes Comerciais e Agentes do Comércio de Motocicletas e Motonetas, Peças e Acessórios",
    "4542102": "Comércio Sob Consignação de Motocicletas e Motonetas",
    "4543900": "Manutenção e Reparação de Motocicletas e Motonetas",
    "4611700": "Representantes Comerciais e Agentes do Comércio de Matérias-Primas Agrícolas e Animais Vivos",
    "4612500": "Representantes Comerciais e Agentes do Comércio de Combustíveis, Minerais, Produtos Siderúrgicos e Químicos",
    "4613300": "Representantes Comerciais e Agentes do Comércio de Madeira, Material de Construção e Ferragens",
    "4614100": "Representantes Comerciais e Agentes do Comércio de Máquinas, Equipamentos, Embarcações e Aeronaves",
    "4615000": "Representantes Comerciais e Agentes do Comércio de Eletrodomésticos, Móveis e Artigos de Uso Doméstico",
    "4616800": "Representantes Comerciais e Agentes do Comércio de Têxteis, Vestuário, Calçados e Artigos de Viagem",
    "4617600": "Representantes Comerciais e Agentes do Comércio de Produtos Alimentícios, Bebidas e Fumo",
    "4618401": "Representantes Comerciais e Agentes do Comércio de Medicamentos, Cosméticos e Produtos de Perfumaria",
    "4618402": "Representantes Comerciais e Agentes do Comércio de Instrumentos e Materiais Odonto-Médico-Hospitalares",
    "4618403": "Representantes Comerciais e Agentes do Comércio de Jornais, Revistas e Outras Publicações",
    "4618499": "Outros Representantes Comerciais e Agentes do Comércio Especializado em Produtos não Especificados Anteriormente",
    "4619200": "Representantes Comerciais e Agentes do Comércio de Mercadorias em Geral não Especializado",
    "4621400": "Comércio Atacadista de Café em Grão",
    "4622200": "Comércio Atacadista de Soja",
    "4623101": "Comércio Atacadista de Animais Vivos",
    "4623102": "Comércio Atacadista de Couros, Lãs, Peles e Outros Subprodutos Não-Comestíveis de Origem Animal",
    "4623103": "Comércio Atacadista de Algodão",
    "4623104": "Comércio Atacadista de Fumo em Folha não Beneficiado",
    "4623105": "Comércio Atacadista de Cacau",
    "4623106": "Comércio Atacadista de Sementes, Flores, Plantas e Gramas",
    "4623107": "Comércio Atacadista de Sisal",
    "4623108": "Comércio Atacadista de Matérias-Primas Agrícolas com Atividade de Fracionamento e Acondicionamento Associada",
    "4623109": "Comércio Atacadista de Alimentos para Animais",
    "4623199": "Comércio Atacadista de Matérias-Primas Agrícolas não Especificadas Anteriormente",
    "4631100": "Comércio Atacadista de Leite e Laticínios",
    "4632001": "Comércio Atacadista de Cereais e Leguminosas Beneficiados",
    "4632002": "Comércio Atacadista de Farinhas, Amidos e Féculas",
    "4632003": "Comércio Atacadista de Cereais e Leguminosas Beneficiados, Farinhas, Amidos e Féculas, com Atividade de Fracionamento e Acondicionamento Associada",
    "4633801": "Comércio Atacadista de Frutas, Verduras, Raízes, Tubérculos, Hortaliças e Legumes Frescos",
    "4633802": "Comércio Atacadista de Aves Vivas e Ovos",
    "4633803": "Comércio Atacadista de Coelhos e Outros Pequenos Animais Vivos para Alimentação",
    "4634601": "Comércio Atacadista de Carnes Bovinas e Suínas e Derivados",
    "4634602": "Comércio Atacadista de Aves Abatidas e Derivados",
    "4634603": "Comércio Atacadista de Pescados e Frutos do Mar",
    "4634699": "Comércio Atacadista de Carnes e Derivados de Outros Animais",
    "4635401": "Comércio Atacadista de água Mineral",
    "4635402": "Comércio Atacadista de Cerveja, Chope e Refrigerante",
    "4635403": "Comércio Atacadista de Bebidas com Atividade de Fracionamento e Acondicionamento Associada",
    "4635499": "Comércio Atacadista de Bebidas não Especificadas Anteriormente",
    "4636201": "Comércio Atacadista de Fumo Beneficiado",
    "4636202": "Comércio Atacadista de Cigarros, Cigarrilhas e Charutos",
    "4637101": "Comércio Atacadista de Café Torrado, Moído e Solúvel",
    "4637102": "Comércio Atacadista de Açúcar",
    "4637103": "Comércio Atacadista de óleos e Gorduras",
    "4637104": "Comércio Atacadista de Pães, Bolos, Biscoitos e Similares",
    "4637105": "Comércio Atacadista de Massas Alimentícias",
    "4637106": "Comércio Atacadista de Sorvetes",
    "4637107": "Comércio Atacadista de Chocolates, Confeitos, Balas, Bombons e Semelhantes",
    "4637199": "Comércio Atacadista Especializado em Outros Produtos Alimentícios não Especificados Anteriormente",
    "4639701": "Comércio Atacadista de Produtos Alimentícios em Geral",
    "4639702": "Comércio Atacadista de Produtos Alimentícios em Geral, com Atividade de Fracionamento e Acondicionamento Associada",
    "4641901": "Comércio Atacadista de Tecidos",
    "4641902": "Comércio Atacadista de Artigos de Cama, Mesa e Banho",
    "4641903": "Comércio Atacadista de Artigos de Armarinho",
    "4642701": "Comércio Atacadista de Artigos do Vestuário e Acessórios, Exceto Profissionais e de Segurança",
    "4642702": "Comércio Atacadista de Roupas e Acessórios para Uso Profissional e de Segurança do Trabalho",
    "4643501": "Comércio Atacadista de Calçados",
    "4643502": "Comércio Atacadista de Bolsas, Malas e Artigos de Viagem",
    "4644301": "Comércio Atacadista de Medicamentos e Drogas de Uso Humano",
    "4644302": "Comércio Atacadista de Medicamentos e Drogas de Uso Veterinário",
    "4645101": "Comércio Atacadista de Instrumentos e Materiais para Uso Médico, Cirúrgico, Hospitalar e de Laboratórios",
    "4645102": "Comércio Atacadista de Próteses e Artigos de Ortopedia",
    "4645103": "Comércio Atacadista de Produtos Odontológicos",
    "4646001": "Comércio Atacadista de Cosméticos e Produtos de Perfumaria",
    "4646002": "Comércio Atacadista de Produtos de Higiene Pessoal",
    "4647801": "Comércio Atacadista de Artigos de Escritório e de Papelaria",
    "4647802": "Comércio Atacadista de Livros, Jornais e Outras Publicações",
    "4649401": "Comércio Atacadista de Equipamentos Elétricos de Uso Pessoal e Doméstico",
    "4649402": "Comércio Atacadista de Aparelhos Eletrônicos de Uso Pessoal e Doméstico",
    "4649403": "Comércio Atacadista de Bicicletas, Triciclos e Outros Veículos Recreativos",
    "4649404": "Comércio Atacadista de Móveis e Artigos de Colchoaria",
    "4649405": "Comércio Atacadista de Artigos de Tapeçaria, Persianas e Cortinas",
    "4649406": "Comércio Atacadista de Lustres, Luminárias e Abajures",
    "4649407": "Comércio Atacadista de Filmes, Cds, Dvds, Fitas e Discos",
    "4649408": "Comércio Atacadista de Produtos de Higiene, Limpeza e Conservação Domiciliar",
    "4649409": "Comércio Atacadista de Produtos de Higiene, Limpeza e Conservação Domiciliar, com Atividade de Fracionamento e Acondicionamento Associada",
    "4649410": "Comércio Atacadista de Jóias, Relógios e Bijuterias, Inclusive Pedras Preciosas e Semipreciosas Lapidadas",
    "4649499": "Comércio Atacadista de Outros Equipamentos e Artigos de Uso Pessoal e Doméstico não Especificados Anteriormente",
    "4651601": "Comércio Atacadista de Equipamentos de Informática",
    "4651602": "Comércio Atacadista de Suprimentos para Informática",
    "4652400": "Comércio Atacadista de Componentes Eletrônicos e Equipamentos de Telefonia e Comunicação",
    "4661300": "Comércio Atacadista de Máquinas, Aparelhos e Equipamentos para Uso Agropecuário, Partes e Peças",
    "4662100": "Comércio Atacadista de Máquinas, Equipamentos para Terraplenagem, Mineração e Construção, Partes e Peças",
    "4663000": "Comércio Atacadista de Máquinas e Equipamentos para Uso Industrial, Partes e Peças",
    "4664800": "Comércio Atacadista de Máquinas, Aparelhos e Equipamentos para Uso Odonto-Médico-Hospitalar, Partes e Peças",
    "4665600": "Comércio Atacadista de Máquinas e Equipamentos para Uso Comercial, Partes e Peças",
    "4669901": "Comércio Atacadista de Bombas e Compressores, Partes e Peças",
    "4669999": "Comércio Atacadista de Outras Máquinas e Equipamentos não Especificados Anteriormente, Partes e Peças",
    "4671100": "Comércio Atacadista de Madeira e Produtos Derivados",
    "4672900": "Comércio Atacadista de Ferragens e Ferramentas",
    "4673700": "Comércio Atacadista de Material Elétrico",
    "4674500": "Comércio Atacadista de Cimento",
    "4679601": "Comércio Atacadista de Tintas, Vernizes e Similares",
    "4679602": "Comércio Atacadista de Mármores e Granitos",
    "4679603": "Comércio Atacadista de Vidros, Espelhos e Vitrais",
    "4679604": "Comércio Atacadista Especializado de Materiais de Construção não Especificados Anteriormente",
    "4679699": "Comércio Atacadista de Materiais de Construção em Geral",
    "4681801": "Comércio Atacadista de álcool Carburante, Biodiesel, Gasolina e Demais Derivados de Petróleo, Exceto Lubrificantes, não Realizado por Transportador Re",
    "4681802": "Comércio Atacadista de Combustíveis Realizado por Transportador Retalhista (Trr)",
    "4681803": "Comércio Atacadista de Combustíveis de Origem Vegetal, Exceto álcool Carburante",
    "4681804": "Comércio Atacadista de Combustíveis de Origem Mineral em Bruto",
    "4681805": "Comércio Atacadista de Lubrificantes",
    "4682600": "Comércio Atacadista de Gás LiqüEfeito de Petróleo (Glp)",
    "4683400": "Comércio Atacadista de Defensivos Agrícolas, Adubos, Fertilizantes e Corretivos do Solo",
    "4684201": "Comércio Atacadista de Resinas e Elastômeros",
    "4684202": "Comércio Atacadista de Solventes",
    "4684299": "Comércio Atacadista de Outros Produtos Químicos e Petroquímicos não Especificados Anteriormente",
    "4685100": "Comércio Atacadista de Produtos Siderúrgicos e Metalúrgicos, Exceto para Construção",
    "4686901": "Comércio Atacadista de Papel e Papelão em Bruto",
    "4686902": "Comércio Atacadista de Embalagens",
    "4687701": "Comércio Atacadista de Resíduos de Papel e Papelão",
    "4687702": "Comércio Atacadista de Resíduos e Sucatas Não-Metálicos, Exceto de Papel e Papelão",
    "4687703": "Comércio Atacadista de Resíduos e Sucatas Metálicos",
    "4689301": "Comércio Atacadista de Produtos da Extração Mineral, Exceto Combustíveis",
    "4689302": "Comércio Atacadista de Fios e Fibras Têxteis Beneficiados",
    "4689399": "Comércio Atacadista Especializado em Outros Produtos Intermediários não Especificados Anteriormente",
    "4691500": "Comércio Atacadista de Mercadorias em Geral, com Predominância de Produtos Alimentícios",
    "4692300": "Comércio Atacadista de Mercadorias em Geral, com Predominância de Insumos Agropecuários",
    "4693100": "Comércio Atacadista de Mercadorias em Geral, sem Predominância de Alimentos ou de Insumos Agropecuários",
    "4711301": "Comércio Varejista de Mercadorias em Geral, com Predominância de Produtos Alimentícios - Hipermercados",
    "4711302": "Comércio Varejista de Mercadorias em Geral, com Predominância de Produtos Alimentícios - Supermercados",
    "4712100": "Comércio Varejista de Mercadorias em Geral, com Predominância de Produtos Alimentícios - Minimercados, Mercearias e Armazéns",
    "4713001": "Lojas de Departamentos ou Magazines (Desativado)",
    "4713002": "Lojas de Variedades, Exceto Lojas de Departamentos ou Magazines",
    "4713003": "Lojas duty free de aeroportos internacionais",
    "4713004": "Lojas de Departamentos ou Magazines, Exceto Lojas Francas (Duty Free)",
    "4713005": "Lojas Francas (Duty Free) de Aeroportos, Portos e em Fronteiras Terrestres",
    "4721101": "Padaria e confeitaria com predominância de produção própria",
    "4721102": "Padaria e Confeitaria com Predominância de Revenda",
    "4721103": "Comércio Varejista de Laticínios e Frios",
    "4721104": "Comércio Varejista de Doces, Balas, Bombons e Semelhantes",
    "4722901": "Comércio Varejista de Carnes - Açougues",
    "4722902": "Peixaria",
    "4723700": "Comércio Varejista de Bebidas",
    "4724500": "Comércio Varejista de Hortifrutigranjeiros",
    "4729601": "Tabacaria",
    "4729602": "Comércio Varejista de Mercadorias em Lojas de Conveniência",
    "4729699": "Comércio Varejista de Produtos Alimentícios em Geral ou Especializado em Produtos Alimentícios não Especificados Anteriormente",
    "4731800": "Comércio Varejista de Combustíveis para Veículos Automotores",
    "4732600": "Comércio Varejista de Lubrificantes",
    "4741500": "Comércio Varejista de Tintas e Materiais para Pintura",
    "4742300": "Comércio Varejista de Material Elétrico",
    "4743100": "Comércio Varejista de Vidros",
    "4744001": "Comércio Varejista de Ferragens e Ferramentas",
    "4744002": "Comércio Varejista de Madeira e Artefatos",
    "4744003": "Comércio Varejista de Materiais Hidráulicos",
    "4744004": "Comércio Varejista de Cal, Areia, Pedra Britada, Tijolos e Telhas",
    "4744005": "Comércio Varejista de Materiais de Construção não Especificados Anteriormente",
    "4744006": "Comércio Varejista de Pedras para Revestimento",
    "4744099": "Comércio Varejista de Materiais de Construção em Geral",
    "4751200": "Comércio varejista especializado de equipamentos e suprimentos de informática",
    "4751201": "Comércio Varejista Especializado de Equipamentos e Suprimentos de Informática",
    "4751202": "Recarga de Cartuchos para Equipamentos de Informática",
    "4752100": "Comércio Varejista Especializado de Equipamentos de Telefonia e Comunicação",
    "4753900": "Comércio Varejista Especializado de Eletrodomésticos e Equipamentos de áudio e Vídeo",
    "4754701": "Comércio Varejista de Móveis",
    "4754702": "Comércio Varejista de Artigos de Colchoaria",
    "4754703": "Comércio Varejista de Artigos de Iluminação",
    "4755501": "Comércio Varejista de Tecidos",
    "4755502": "Comercio Varejista de Artigos de Armarinho",
    "4755503": "Comercio Varejista de Artigos de Cama, Mesa e Banho",
    "4756300": "Comércio Varejista Especializado de Instrumentos Musicais e Acessórios",
    "4757100": "Comércio Varejista Especializado de Peças e Acessórios para Aparelhos Eletroeletrônicos para Uso Doméstico, Exceto Informática e Comunicação",
    "4759801": "Comércio Varejista de Artigos de Tapeçaria, Cortinas e Persianas",
    "4759899": "Comércio Varejista de Outros Artigos de Uso Doméstico não Especificados Anteriormente",
    "4761001": "Comércio Varejista de Livros",
    "4761002": "Comércio Varejista de Jornais e Revistas",
    "4761003": "Comércio Varejista de Artigos de Papelaria",
    "4762800": "Comércio Varejista de Discos, Cds, Dvds e Fitas",
    "4763601": "Comércio Varejista de Brinquedos e Artigos Recreativos",
    "4763602": "Comércio Varejista de Artigos Esportivos",
    "4763603": "Comércio Varejista de Bicicletas e Triciclos, Peças e Acessórios",
    "4763604": "Comércio Varejista de Artigos de Caça, Pesca e Camping",
    "4763605": "Comércio Varejista de Embarcações e Outros Veículos Recreativos, Peças e Acessórios",
    "4771701": "Comércio Varejista de Produtos Farmacêuticos, sem Manipulação de Fórmulas",
    "4771702": "Comércio Varejista de Produtos Farmacêuticos, com Manipulação de Fórmulas",
    "4771703": "Comércio Varejista de Produtos Farmacêuticos Homeopáticos",
    "4771704": "Comércio Varejista de Medicamentos Veterinários",
    "4772500": "Comércio Varejista de Cosméticos, Produtos de Perfumaria e de Higiene Pessoal",
    "4773300": "Comércio Varejista de Artigos Médicos e Ortopédicos",
    "4774100": "Comércio Varejista de Artigos de óptica",
    "4781400": "Comércio Varejista de Artigos do Vestuário e Acessórios",
    "4782201": "Comércio Varejista de Calçados",
    "4782202": "Comércio Varejista de Artigos de Viagem",
    "4783101": "Comércio Varejista de Artigos de Joalheria",
    "4783102": "Comércio Varejista de Artigos de Relojoaria",
    "4784900": "Comércio Varejista de Gás LiqüEfeito de Petróleo (Glp)",
    "4785701": "Comércio Varejista de AntigüIdades",
    "4785799": "Comércio Varejista de Outros Artigos Usados",
    "4789001": "Comércio Varejista de Suvenires, Bijuterias e Artesanatos",
    "4789002": "Comércio Varejista de Plantas e Flores Naturais",
    "4789003": "Comércio Varejista de Objetos de Arte",
    "4789004": "Comércio Varejista de Animais Vivos e de Artigos e Alimentos para Animais de Estimação",
    "4789005": "Comércio Varejista de Produtos Saneantes Domissanitários",
    "4789006": "Comércio Varejista de Fogos de Artifício e Artigos Pirotécnicos",
    "4789007": "Comércio Varejista de Equipamentos para Escritório",
    "4789008": "Comércio Varejista de Artigos Fotográficos e para Filmagem",
    "4789009": "Comércio Varejista de Armas e Munições",
    "4789099": "Comércio Varejista de Outros Produtos não Especificados Anteriormente",
}

CBO_FAMILIAS_COMERCIO = {
    "1414": "Comerciantes e gerentes de loja",
    "3541": "Técnicos de vendas e promotores",
    "3542": "Compradores",
    "3547": "Representantes comerciais autônomos",
    "4211": "Caixas e bilheteiros",
    "5201": "Supervisores de vendas",
    "5211": "Vendedores do comércio varejista e atacadista",
    "5241": "Vendedores em domicílio",
    "5242": "Feirantes e vendedores permissionários",
    "5243": "Vendedores ambulantes",
}

AREAS_COMERCIO = {
    "Vendas no Varejo e Atacado": ["5211"],
    "Caixas e Atendimento": ["4211"],
    "Gestão Comercial": ["1414", "5201"],
    "Representação e Compras": ["3541", "3542", "3547"],
    "Venda Direta e Ambulante": ["5241", "5242", "5243"],
}


# --- REGISTRO ---------------------------------------------------------------
# `resumo` é a frase da área na página inicial do site (ver
# _utils/exportar_areas.py). `sigla` e `estabelecimento` formam os rótulos que
# a gold grava: em TI
# "Empresa de TI" e "Profissional de TI fora do setor de TI", em saúde
# "Estabelecimento de saúde" e "Profissional de saúde fora do setor de saúde".
AREAS = {
    "tec": {
        "nome": "TI",
        "resumo": "Desenvolvimento, infraestrutura, dados e suporte, dentro e fora das empresas de tecnologia.",
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
        "resumo": "Professores da creche à pós-graduação, coordenação pedagógica e gestão escolar.",
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
        "resumo": "Medicina, enfermagem, odontologia, diagnóstico, reabilitação e atenção comunitária.",
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
    "engenharia": {
        "nome": "Engenharia",
        "resumo": "Engenheiros, arquitetos e técnicos de obras, eletroeletrônica, mecânica e mineração.",
        "sigla": "engenharia",
        "estabelecimento": "empresa de engenharia",
        "cnae": CNAE_ENGENHARIA,
        "cbo_familias": CBO_FAMILIAS_ENGENHARIA,
        "cbo_avulsos": {},
        "cbo_excluidos": {},
        "cbo_acrescentadas": set(),
        "subareas": AREAS_ENGENHARIA,
        "area_dos_avulsos": {},
    },
    "financas": {
        "nome": "Finanças",
        "resumo": "Bancos, crédito, investimentos, seguros, contabilidade e economia.",
        "sigla": "finanças",
        "estabelecimento": "instituição financeira",
        "cnae": CNAE_FINANCAS,
        "cbo_familias": CBO_FAMILIAS_FINANCAS,
        "cbo_avulsos": {},
        "cbo_excluidos": {},
        "cbo_acrescentadas": set(),
        "subareas": AREAS_FINANCAS,
        "area_dos_avulsos": {},
    },
    "agronegocio": {
        "nome": "Agronegócio",
        "resumo": "Lavoura, pecuária, floresta e pesca, da produção à mecanização e à ciência agrária.",
        "sigla": "agronegócio",
        "estabelecimento": "estabelecimento agropecuário",
        "cnae": CNAE_AGRONEGOCIO,
        "cbo_familias": CBO_FAMILIAS_AGRONEGOCIO,
        "cbo_avulsos": {},
        "cbo_excluidos": {},
        "cbo_acrescentadas": set(),
        "subareas": AREAS_AGRONEGOCIO,
        "area_dos_avulsos": {},
    },
    "comercio": {
        "nome": "Comércio",
        "resumo": "Vendedores, caixas, compradores e gestão comercial no varejo e no atacado.",
        "sigla": "comércio",
        "estabelecimento": "estabelecimento comercial",
        "cnae": CNAE_COMERCIO,
        "cbo_familias": CBO_FAMILIAS_COMERCIO,
        "cbo_avulsos": {},
        "cbo_excluidos": {},
        "cbo_acrescentadas": set(),
        "subareas": AREAS_COMERCIO,
        "area_dos_avulsos": {},
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
