# HouseArt — Estudo Estratégico e de Produto

2026-10-19 · @Moacy Veiga De Bulhões

## Sumário executivo

A HouseArt deve nascer como o registro de propriedade das obras de arte no Brasil (tag física + certificado-escritura transferível), usando cerca de 70% do código da Housebroker, e virar marketplace e hub de serviços (laudo, frete, seguro, exportação, crédito) por consequência. A tese se sustenta em quatro fatos: o mercado brasileiro de arte vale ~R$ 3,1 bilhões e foi o que mais cresceu no mundo em 2025, mas 99% das vendas de galerias acontecem fora de plataformas; metade das obras em circulação é falsa ou mal atribuída e não existe registro público de obras no país; nenhum player, aqui ou lá fora, une identidade física, escritura digital, transação e serviços; e o que sobreviveu ao ciclo blockchain/NFT foi exatamente o certificado acoplado à obra física e à venda, não o registro isolado.

| Pergunta | Resposta |
|---|---|
| Tamanho | Mundo US$ 59,6 bi (2025); Brasil ~R$ 3,1 bi, dos quais R$ 1,76 bi domésticos; 95% das transações globais e 59% da receita das galerias brasileiras estão abaixo de US$ 50 mil / R$ 50 mil, a faixa da HouseArt |
| Dor | Falsificação (50% estimado), proveniência em papel, direito de sequência inaplicável, exportação de 60 dias, 40% das obras sem seguro, galerias vendendo por WhatsApp sem ferramenta |
| Concorrentes | Artsy+Artnet (global, em reestruturação), Nano Art (galerias, 27 obras no 1º ano), Artsoul (varejo), Verisart e Arcual (certificado sem marketplace); nenhum com tag + escritura + serviços no Brasil |
| O que reaproveitar | Cadastro, selo, due diligence, marketplace, motor de ofertas, negociador, timeline, HouseValor, cobrança Stripe/BTG, assinatura ICP, CRM, comunidade, estúdio de anúncios, HouseAgentic |
| O que construir | Serviço de tags NFC seguras, ledger assinado e carimbado, transferência acoplada a escrow e tap, direito de sequência automático, orquestração de frete e seguro |
| Modelo | Assinatura de galeria/artista + certificação por obra + 12% no primário e 12% no secundário + serviços (laudo, due diligence, frete, seguro, exportação) + dados e API na fase 3 |
| Estratégia | Entrar pelo registro (grátis ou barato, encaixado no Instagram), validar com seguradoras e institutos, abrir transação com obras já certificadas, exportar como consolidadora para EUA e Europa |
| Maior risco | Adoção num mercado informal e concentrado em SP; mitigado com MVP de 90 dias e três hipóteses de corte antes de investir no marketplace |

Decisão recomendada: aprovar um MVP de registro de 90 dias (tag, cadastro, certificado, página pública), com três galerias-âncora e 500 artistas convidados, e só liberar o marketplace quando 10 mil obras estiverem certificadas e uma seguradora aceitar o dossiê HouseArt.

## Tamanho e dinâmica do mercado de arte — mundo e Brasil

O mercado global vale US$ 59,6 bilhões (2025, +4%), o brasileiro cerca de R$ 3,1 bilhões (2025), e a faixa onde a HouseArt compete, obras até US$ 50 mil, concentra 95% das transações do mundo e 59% da receita das galerias brasileiras. O Brasil é pequeno em valor (0,9% do global) mas é o mercado que mais cresceu entre os analisados em 2025, tem o colecionador mais jovem do mundo (34 anos) e vende quase tudo fora de plataformas.

### Mundo

| Indicador (2025) | Valor | Fonte |
|---|---|---|
| Vendas globais | US$ 59,6 bi (+4%), 41,5 milhões de transações | [](https://www.artbasel.com/stories/the-art-basel-and-ubs-global-art-market-report-2026?lang=en) |
| Dealers (galerias) | US$ 34,8 bi (+2%) | Art Basel & UBS 2026 |
| Leilões (público + privado) | US$ 24,8 bi (+6%) | Art Basel & UBS 2026 |
| Países | EUA 44%, Reino Unido 18%, China 14%, França 8% | Art Basel & UBS 2026 |
| Vendas online | US$ 9,2 bi, 15% do mercado (pico de 25% em 2020); 63% do valor dos leilões online-only vem de lotes abaixo de US$ 50 mil | Art Basel & UBS 2026 |
| Novos compradores | 49% dos compradores dos dealers; 60% nas galerias pequenas; 40% do valor online dos dealers | Art Basel & UBS 2026 |
| Base do mercado | ~95% das transações abaixo de US$ 50 mil, ~75% abaixo de US$ 5 mil; 80% dos lotes de leilão abaixo de US$ 3.160 | Art Basel; [](https://www.aap.com.au/aapreleases/cision20260310en05826) |
| Gravuras e múltiplos | US$ 526 mi em leilão (+11%), 23% dos lotes, preço médio US$ 2.600 | [](https://news.artprice.com/de/13451/prints-the-quiet-engine-behind-the-art-market) |
| Colecionadores HNW | 77% do gasto em obras abaixo de US$ 50 mil; 69% compram direto do artista; 22% usam apps/IA; 65% acham que IA melhora verificação de proveniência | [](https://www.artbasel.com/stories/the-art-basel-and-ubs-survey-of-global-collecting-2026) |
| Riqueza em arte e colecionáveis | US$ 2,56 tri (2024) → US$ 3,47 tri (2030e); transferência geracional de ~US$ 100 bi/ano em arte | [](https://www.deloitte.com/lu/en/services/financial-advisory/research/art-finance-report.html) |

A dinâmica recente é de duas pontas: em 2023–24 o topo caiu (lotes acima de US$ 10 mi −40% a −45%) e a base cresceu (galerias pequenas +17%, lotes abaixo de US$ 50 mil +8% a +20%); em 2025 o topo recuperou (+21% a +30%) e a base recuou 2%, mas em volume o mercado continua de base larga. O online estabilizou em 15% do total e é a porta de entrada de novos compradores; o leilão perde espaço para a compra direta do artista (63–69% dos HNW) e para o Instagram (35%). A próxima geração é maioria entre os colecionadores de alta renda (millennials e Gen Z são 74% da amostra) e a Gen Z gasta mais que o dobro das demais gerações.

### Brasil

Em dólares o mercado brasileiro cresceu 36% entre 2021 e 2025 (~8% ao ano) contra −2,5% ao ano do global; o mercado doméstico bateu recorde de R$ 1,76 bi em 2025 e as exportações caíram de US$ 288 mi para US$ 227 mi ([](https://relatoriomercado2026.actarte.com/)). As empresas registradas no segmento passaram de 4.802 (2019) para 9.890 (2025).

| Indicador | Valor | Fonte |
|---|---|---|
| Mercado total 2023 | R$ 2,9 bi (+21%); 0,89% do global; mercado interno R$ 1,5 bi | [](https://latitudebrasil.com/wp-content/uploads/2025/02/250122-Act-PesquisaSetorial2024-Resumo-Executivo.pdf) |
| Leilões | R$ 57 mi em 2023 (−36%); estável em 2025; mais de 120 casas online | Pesquisa Setorial; [](https://neofeed.com.br/finde/os-bastidores-do-crescimento-das-milionarias-falsificacoes-de-arte-no-brasil/) |
| Exportações 2023 | US$ 268 mi; EUA 56%, Reino Unido 21%, França 7%, Suíça 4%; pinturas 61% | Pesquisa Setorial |
| Canais de venda das galerias | Presencial 42%, feiras nacionais 25%, online próprio 20% (8% em 2018), feiras internacionais 9%, plataformas de terceiros 1% | Pesquisa Setorial |
| Faixa de preço | Obras até R$ 50 mil = 59% da receita; acima de R$ 300 mil = 9% | Pesquisa Setorial |
| Mídias | Pintura 57%, escultura 17%, papel 9%, fotografia 9%, múltiplos 5% | Pesquisa Setorial |
| Galerias | 58% faturam até R$ 5 mi; 82% em SP e RJ; 27 artistas representados em média; top 3 artistas = 51% da receita; 141 obras vendidas por galeria/ano | Pesquisa Setorial |
| Compradores | 77% colecionadores nacionais, 15% estrangeiros; 73 a 248 clientes únicos por galeria/ano | Pesquisa Setorial |
| Carga tributária média sobre vendas | 14% | Pesquisa Setorial |
| Colecionador HNW brasileiro | Idade média 34 anos (menor dos 10 mercados), 56 obras em média, 72% pretendem comprar em 2026 (maior), ticket médio US$ 23 mil, apenas 8% compram via Instagram | [](https://braziljournal.com/o-novo-colecionador-de-arte-brasileiro/) |
| Crescimento 2025 | Galerias brasileiras +21%, melhor entre os mercados analisados; 83% projetam alta em 2026 | Art Basel & UBS 2026 via [](https://exame.com/casual/como-se-sustenta-o-mercado-de-arte-no-brasil-em-2026/) |
| Feiras | SP-Arte 2026: 35.811 visitantes, 180+ expositores, vendas de R$ 6 mil a R$ 1,5 mi; ArtRio 16ª edição em set/2026 | [](https://artequeacontece.com.br/vendas-da-sp-arte-2026-batem-recordes-mas-concentracao-nos-grandes-tickets-preocupa-galerias-menores/) |
| Produtos financeiros emergentes | FICART IOX Bellas Artes (CVM), Hurst (fracionamento via CR, R$ 10 mil), Artk (CR para feiras) | [](https://forbes.com.br/forbes-money/2026/03/mercado-de-arte-segue-em-crescimento-segundo-o-ubs-saiba-como-investir/) |

### Tributação e regras que afetam o produto

Importação definitiva de obras (NCM 9701–9703) sofre II, PIS/COFINS-importação e ICMS do estado de destino, com carga total estimada entre 43% e 60% do valor ([](https://select.art.br/o-que-saber-sobre-importacao-e-exportacao-de-obras-de-arte/)); a alíquota exata de II diverge entre fontes (0% a 4%) e precisa ser confirmada na TEC vigente. O Convênio ICMS 1/2013 isenta vendas em feiras (até R$ 3 mi por obra) e foi prorrogado até 31/12/2026, mas São Paulo ficou de fora, o que reduziu galerias internacionais na SP-Arte. A exportação não paga tributos federais, mas exige anuência do IPHAN e é proibida para bens tombados e obras produzidas ou trazidas até 1889. ISS de 2% a 5% incide sobre intermediação e consultoria. A reforma tributária (IBS/CBS, transição 2026–2033) ainda não tem regra específica para arte.

O [](https://www.migalhas.com.br/depeso/324499/o-famigerado-direito-de-sequencia-no-mercado-de-artes-brasileiro) (art. 38 da Lei 9.610/98) dá ao artista e herdeiros 5% sobre o aumento de preço em cada revenda, é irrenunciável e cabe ao intermediário recolher; na prática quase não é aplicado porque o artista não consegue provar as revendas e a valorização, exatamente o que um registro de transações resolve.

### Fraudes e proveniência

Estimativas conservadoras falam em 50% de obras falsas ou mal atribuídas em circulação ([](https://news.artnet.com/market/over-50-percent-of-art-is-fake-130821)); a Eurojust apreendeu mais de 2.000 obras falsas e 500 certificados falsos numa única operação em 2024 ([](https://www.eurojust.europa.eu/news/international-operation-leads-seizure-2-000-fake-works-art-potential-losses-eur-200-million)). No Brasil os mais falsificados são Volpi, Portinari, Di Cavalcanti, Guignard, Djanira, Burle Marx e Tarsila; o Projeto Portinari identifica falsos todo mês, há "Di Cavalcantis" a R$ 70–80 mil em sites de leilão e a explosão de casas de leilão online (de 30 para mais de 120) é apontada como fator central. O único remédio prático é anulação judicial da venda, lenta e cara. Certificados de autenticidade hoje são papel sem padrão, emitidos por galerias, institutos ou pelo próprio artista, e 65% dos colecionadores HNW já veem a IA como aliada na verificação de proveniência. É a dor que a HouseArt ataca: a obra sem proveniência vale menos, vende menos e não é aceita por casas sérias nem por seguradoras.

## Concorrentes e players — marketplaces, autenticação, Brasil e lacunas

Não existe, no Brasil nem no mundo, um player que una registro físico-digital da obra, escritura transferível, marketplace e serviços de avaliação, frete e seguro numa só plataforma; o que mais se aproxima é a tese da Beowolff Capital, que em 2025–26 comprou e fundiu [](https://itsartlaw.org/al-clippings/artsy-and-artnet-merger/) para montar marketplace, software, dados e serviços financeiros. O mercado global de plataformas é maduro e pressionado (Artnet com receita em queda e prejuízo, [](https://www.businesswire.com/news/home/20260227605469/en/1stDibs-Reports-Fourth-Quarter-and-Full-Year-2025-Financial-Results) com GMV e compradores em queda), enquanto o mercado brasileiro continua quase totalmente fora de plataforma: segundo a [](https://latitudebrasil.org/wp-content/uploads/2025/03/250122-Act-PesquisaSetorial2024-Resumo-Executivo.pdf), galerias vendem 20% por canais online próprios (WhatsApp, Instagram) e apenas 1% por plataformas de terceiros.

### Marketplaces globais

| Player | Modelo | Take rate / preço | Escala | Fraqueza relevante para a HouseArt |
|---|---|---|---|---|
| [](https://multiples.vc/private-comps/artsy) (+ Artnet) | B2B2C: galerias assinam, colecionadores compram | Assinatura US$ 200 a 3.000+/mês + 15% no checkout | ~US$ 100M receita 2025; 3.000+ galerias; 1M+ obras | Caro para galeria pequena; sem registro físico; em reestruturação pós-fusão |
| [](https://priceyourpainting.substack.com/p/where-to-sell-your-paintings-in-2026) | Artista direto, originais e prints | 35–40% de comissão, sem mensalidade | Maior marketplace aberto do mundo | Comissão alta, ticket baixo, sem curadoria |
| [](https://www.privateequitywire.co.uk/singulart-raises-eur60m-series-b-round/) | Galeria online curada, cuida de frete e seguro | 30–50% | Série B €60M (2021); 10 mil+ artistas | Comissão alta; logística é diferencial que a HouseArt pode copiar |
| [](https://sellers.artfinder.com/article/927-what-are-artfinders-seller-plan-subscriptions) | Artista direto com assinatura | £14–40/mês + 35–42% | 100 mil+ clientes | Paga-se mesmo sem vender |
| [](https://www.artmajeur.com/en/our-services) | Freemium aberto, já emite COA online com timestamp | Grátis ou US$ 7–9/mês com comissão reduzida | 137 mil artistas, 3,5M obras | Volume sem curadoria; ticket baixo |
| [](https://news.artnet.com/news-pro/david-zwirner-platform-e-commerce-art-detective-2000570) | Lotes mensais de galerias, preço fixo, parcelamento Klarna | 20% | ~50% das obras vendidas em 2021 | Referência de take rate aceitável para galeria |
| [](https://avantarte.com/about/) | Publisher de edições com artistas (margem própria) | Margem de publisher | Comunidade 3,5M; receita +250%/ano | Modelo de produto próprio, não marketplace |
| [](https://investormint.com/investing/masterworks-review-2026) | Fracional via Reg A | 1,5% a.a. + 20% carry + ~11% sourcing | US$ 1,1 bi captados; AUM US$ 479M | Governança frágil; mostra demanda e risco regulatório do fracional |
| [](https://www.antiquestradegazette.com/news/2025/auction-houses-christie-s-and-sotheby-s-reveal-totals-for-2025/) | Leilões online | Buyer's premium 27–28% até US$ 2M | Online-only combinado US$ 424M em 2025; 46% dos novos compradores são millennials ou mais jovens | Ticket médio online US$ 14 mil: faixa onde a HouseArt compete |
| [](https://infinitebreguet.substack.com/p/a-and-a-auction-aggregators-and-ai) | Agregadores de leilões | Online fee ao arrematante + taxas das casas | ATG comprou LiveAuctioneers por US$ 525M | Software datado; frete e pagamento fracos |
| [](https://www.arcual.com/about-us) (Art Basel + BCG) | Blockchain para galerias: certificados, lojas, pagamentos | Não divulgado | Sem métrica pública de adoção | Prova que "blockchain para galerias" sozinho não tracionou |
| [](https://fairchain.art) | Certificado de título + contrato com royalty de revenda | Não divulgado | 150+ artistas (Katz, Serra) | Conceito muito próximo da escritura HouseArt, ainda incipiente |

### Autenticação, proveniência e registro

| Player | O que faz | Preço | Lição |
|---|---|---|---|
| [](https://help.verisart.com/en/articles/6303087-verisart-shopify-app-pricing-and-limits) | COA com timestamp em blockchain, app Shopify | US$ 0,25–0,50 por COA; 0,5% por venda via Shopify | Só sobreviveu acoplado ao fluxo de venda; o certificado não prova autenticidade física |
| [](https://www.artnews.com/art-news/news/winston-artory-merger-launches-1234748119) | Registro blockchain + avaliação para bancos e seguradoras | Taxa por transferência de título + avaliação | Registro puro não escalou; pivotou para avaliação (US$ 15 bi/ano) com parceria AXA XL |
| [](https://tagsmart.helpscoutdocs.com/article/72-pricing) | DNA sintético + certificado + arquivo | Tag £12,50 (tela £25), certificado £12,50 | Marcação física existe há 10 anos sem escala: faltou marketplace e serviços em volta |
| [](https://www.artloss.com/faqs/) | Base de 700 mil obras roubadas; 400 mil checagens/ano | £85 por busca; assinaturas £700–1.500 | Parceiro natural para a due diligence de proveniência |
| [](https://pricingsaas.com/companies/exhibite) | Inventário + CRM + site para galerias | US$ 90–409/mês | Líder de software de galeria; caro para 58% das galerias brasileiras (até R$ 5M/ano) |
| [](https://news.artnet.com/market/artbinder-acquisition-2207671) | Inventário para galerias blue-chip | SaaS | 750 mil objetos; comprada pela Constellation (2023) |
| [](https://artdependence.com/articles/conservation-and-authentication-of-fine-art-interview-with-paul-lindahl-co-founder-and-ceo-arius-technology) / Artmyn | Scanner 3D/5D de superfície (fingerprint) | Serviço | Fingerprint físico ainda é serviço de museu, não produto de massa |
| [](https://www.nfcw.com/?p=58091) | Tag NFC + registro | Kit US$ 20 | Sem tração: tag sem ecossistema não vende |

O que sobreviveu ao [](https://www.theartnewspaper.com/2026/03/11/nifty-gateway-shut-down-nft-marketplace-evolving) (Nifty Gateway, KnownOrigin e MakersPlace fecharam em 2025–26) foi o uso de registro digital como certificado acoplado à obra física e a uma venda, avaliação ou seguro. Registro blockchain como negócio autônomo não se sustentou em nenhum caso.

### Brasil e América Latina

| Player | O que faz | Números | Leitura |
|---|---|---|---|
| [](https://braziljournal.com/f8nc) | Marketplace B2B2C de galerias; comprou a Tropix (NFT) | Comissão 10%; 71 galerias; 27 obras e R$ 490 mil no 1º ano; valuation ~R$ 7M | Único concorrente direto de galerias; volume mínimo; educação rende mais que o marketplace |
| [](https://www.artsoul.com.br) | Marketplace de arte e design com escrow ("Compra Garantida"), lojas físicas em SP | 1.495+ artistas, 173+ galerias | Mais varejo/decoração; sem registro nem laudo |
| [](https://www.folhavitoria.com.br/economia/unica-franquia-de-arte-do-brasil-estuda-abrir-loja-na-capital-capixaba/) | Franquia de prints e arte decorativa | 30 lojas; 9 mil artistas; R$ 14,5M (2015) | Mercado de reprodução, não de originais |
| Bolsa de Arte, James Lisboa, Soraia Cals, iArremate, Leilões BR | Casas e plataformas de leilão | Leilões brasileiros ~R$ 57M em 2023 | Canal pequeno e analógico; [](https://www.bemparana.com.br/cultura/artistas-e-herdeiros-querem-parte-do-lucro-das-casas-de-leiloes-e-galerias/amp/) quase não aplicado (4 de 12 casas aderiram) |
| SP-Arte Viewing Room, ArtRio Marketplace | Iniciativas digitais das feiras | Voltaram ao foco presencial | Feiras são parceiras de distribuição, não concorrentes |
| Instagram + WhatsApp | O marketplace real das galerias brasileiras | 20% das vendas das galerias | A HouseArt precisa se encaixar nesse fluxo, não substituí-lo |
| Cryga/Crypto Gallery (2022) | Tokenização com score por IA | Status desconhecido | Nenhuma startup brasileira de certificação de arte com tração |

### Avaliação e laudo

No Brasil não há profissão regulamentada de avaliador de arte: laudos são emitidos por historiadores, museólogos, galeristas, leiloeiros e peritos judiciais, e a [](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/processos-seletivos/2021/2021-edital-alfgru-no-1-2021-selecao-de-peritos.pdf) credencia "especialistas em obras de arte" por edital das alfândegas para laudos de importação e exportação. Não há padrão de laudo nem base nacional de preços; as bases globais ([](https://www.artnet.com/price-database) US$ 32,50 a 1.175/ano, [](https://www.ideal-investisseur.fr/en/stock-news/artmarketcom-reports-3-annual-growth-in-2025-supported-by-the-integration-of-its-proprietary-ai/13701.html) receita €8,6M, [](https://www.mutualart.com/plans) US$ 24–39/mês, [](https://www.liveart.ai/about) com modelo XGBoost de 100+ variáveis) cobrem mal artistas brasileiros e vendas privadas. A demanda recorrente por laudo vem de inventário e ITCMD, divórcio, seguro, garantia e importação/exportação; [](https://www.cbinsights.com/company/artscapy) vende estimativa grátis por IA e laudo completo por £59,99, modelo replicável.

### Lacunas que a HouseArt pode ocupar

1. CRM + catálogo + checkout + certificado + logística para a galeria e o artista que já vendem pelo Instagram, a preço acessível (Artlogic custa US$ 205–409/mês).
2. Registro de obras confiável para seguro, inventário, ITCMD, Receita Federal e revenda, sem depender de blockchain pública.
3. Direito de sequência aplicado automaticamente, hoje inviável por falta de rastreabilidade das transações.
4. Laudo de avaliação padronizado e marketplace de avaliadores, com base de preços nacional construída a partir das próprias transações da plataforma.
5. Serviços financeiros sobre arte (seguro, crédito com garantia, parcelamento), inexistentes de forma estruturada no Brasil.

### Modelos de monetização com evidência

Assinatura SaaS de galeria e artista é a receita mais previsível; comissão de 10–20% em marketplace curado é aceita por galerias, enquanto 35–50% só funciona em modelo artista-direto de ticket baixo; taxa por evento (certificado, busca de proveniência, laudo) escala quando embutida no fluxo de venda ou seguro; avaliação como serviço B2B para bancos e seguradoras foi o modelo que mais cresceu no pós-NFT. Não funcionaram: registro blockchain isolado, editorial pesado com marketplace, fee flat em leilão e fracional com governança frágil.

## Serviços adjacentes — frete, seguro, exportação, avaliação, financeiro

Frete e seguro são os dois serviços que mais convertem quando embutidos no checkout (a Convelio afirma até +30% de conversão com cotação instantânea na página da obra), e no Brasil ambos são mercados pequenos, analógicos e caros, o que abre espaço para a HouseArt operar como orquestradora com parceiros em vez de operadora própria. Exportação é viável e sem tributo federal, mas exige PJ habilitada no Siscomex e anuência do IPHAN, o que empurra a plataforma para o papel de exportadora-consolidadora.

### Frete e transporte especializado

| Player | Perfil | Relevância para a HouseArt |
|---|---|---|
| [](https://www.convelio.com/en/convelio-api/) (Paris, Londres, NY) | Forwarder digital de arte; API e widget de cotação instantânea no checkout, booking automático, tracking, documentos de exportação, seguro ad valorem AXA embutido; Série C em abr/2026; clientes Christie's, Phillips, Artsper | Modelo a replicar para o checkout; parceiro para rotas internacionais |
| [](https://arta.io) (NY) | Infraestrutura de frete, seguro e fulfillment para marketplaces (Artsy, 1stDibs, Sotheby's, Phillips); API, hosted e app Shopify; seguro pós-entrega com Chubb; 65+ países | Alternativa à Convelio; referência de seguro embarcado |
| [](https://www.fink.com.br/mobility/transporte-de-obras-de-arte/) (SP) | Embalagem museológica, climatização, courier, condition report, despacho e trâmite IPHAN, atua como exportadora para quem não tem RADAR, opera ATA Carnet | Parceiro nacional principal para exportação |
| [](https://www.alvestegam.com.br/) (SP) | Especialista em arte desde 1996, nacional e internacional | Parceiro nacional |
| [](https://www.bloomberglinea.com.br/negocios/grupo-frances-investe-r-17-mi-para-guardar-obras-de-arte-de-elite-em-sao-paulo/) (SP, Barueri) | Transporte para museus + armazém climatizado de 5.500 m² e nova unidade de 2.000 m² (R$ 17 mi, mai/2026), módulos a partir de R$ 500/mês; grupo Horus Finance | Armazenagem e custódia para crédito e consignação |
| [](https://fineartshippers.com/ags-cargo-professional-art-logistics-services-in-brazil/) (SP, RJ, Manaus) | Agente de carga com divisão de arte | Capilaridade regional |
| Crozier, Gander & White, Cadogan Tate, Momart, Hasenkamp ([](https://icefat.org/?p=13972)) | Rede global de ~80 agentes auditados, sem membro brasileiro | Rede de destino para entregas no exterior |

Referências de preço ([](https://momaa.org/art-shipping-cost-calculator-2026/), [](https://www.freightamigo.com/en/blog/logistics/shipping-artwork-internationally-a-complete-cost-guide-for-2025/)): pintura de US$ 10 mil custa US$ 400–800 em frete doméstico nos EUA e US$ 1.500–3.000 transatlântico; caixa de madeira sob medida 5–15% do valor da obra; embalagem é 20–40% do custo total; white glove acrescenta 50–100%; aéreo custa 2–3× o marítimo. No Brasil ninguém publica tabela, e a [](https://latitudebrasil.org/wp-content/uploads/2025/03/250122-Act-PesquisaSetorial2024-Resumo-Executivo.pdf) mostra que a exportação leva até 60 dias e que feiras internacionais consomem 25% das despesas das galerias. Uma tabela de frete nacional transparente, cotada na página da obra, é por si um diferencial.

### Seguro

| Item | Situação no Brasil | Fonte |
|---|---|---|
| Seguradoras com produto de arte | [](https://www.tokiomarine.com.br/seguros/seguro-obras-de-arte) (RD Obras de Arte), [](https://www.chubb.com/content/dam/chubb-sites/chubb-com/br-pt/condicoes-gerais/patrimonial-e-riscos-diversos/rd-obras-de-arte-processo-susep-15414-0022682012-33-versao-de-23-12-2022-ate-10-12-2025.pdf) (All Risks + adicional de trânsito), Essor, Allianz, Liberty, Fairfax, resseguro Lloyd's | Condições gerais SUSEP |
| Corretoras especializadas | [](https://finarte.com.br/) (grupo SP-Arte, absorveu a Foco Art Seguros), Enchanter, Affinité, Osten, ICG | Sites das corretoras |
| Cobertura padrão | All risks "prego a prego": da parede de origem à fixação no destino, trânsito, armazenagem, exposição; 85% dos sinistros ocorrem no transporte e manuseio | [](https://revistaapolice.com.br/2022/07/seguro-para-obras-de-arte-entenda-como-funciona-e-sua-importancia/) |
| Exigências da seguradora | Relação item a item com foto, técnica, dimensões, estado; declaração de valor; laudo de avaliação e certificado de autenticidade no sinistro; exclui obra sem comprovação de propriedade | Chubb |
| Prêmio | Brasil não publica; referência internacional: apólice anual 0,2–1% do valor, trânsito 0,8–2% por envio sobre 110% do valor | [](https://momaa.org/art-insurance-calculator/) |
| Tamanho do mercado | ~R$ 100 mi/ano de prêmios no Brasil vs US$ 500 mi+ no mundo; só 40% das obras seguradas no Brasil vs 70% na Europa | Revista Apólice |

As exigências da seguradora (ficha item a item, foto, valor comprovado, certificado, prova de propriedade) são exatamente o que o cadastro e o certificado HouseArt produzem, o que permite à plataforma atuar como estipulante de uma apólice coletiva de trânsito e acervo com certificado por obra, precificada no checkout, via corretora especializada. Para rotas internacionais, Convelio e Arta já embutem o seguro no frete.

### Exportação do Brasil para o mundo

| Tema | Regra | Fonte |
|---|---|---|
| IPHAN | [](http://www.planalto.gov.br/ccivil_03/leis/L4845.htm) proíbe saída definitiva de obras produzidas ou trazidas até 1889; Lei 5.471/68 (livros e documentos séc. XVI–XIX), Lei 3.924/61 (arqueológicos), DL 25/37 (tombados). Arte moderna e contemporânea não está vedada, mas a DSBC (Declaração de Saída de Bens Culturais) é gratuita, no gov.br, com resposta automática na maioria dos casos e 15 dias quando vai a análise | [](https://www.gov.br/iphan/pt-br/servicos/saida-de-bens-culturais-do-brasil) |
| Receita Federal | Exportação por PJ habilitada no RADAR/Siscomex com DU-E; pessoa física não exporta comercialmente; regimes definitivo, em consignação (feiras) e temporário; Exporta Fácil dos Correios até US$ 50 mil | [](https://www.gruposerpa.com.br/exportacao-de-obras-de-arte/) |
| Tributos | Sem tributos federais na exportação; subvaloração é fraude; importação paga 43–58% | seLecT |
| ATA Carnet | Emitido pela CNI, R$ 443 a R$ 931 por faixa de valor, válido 1 ano em 74+ países, só para saída sem intenção de venda | [](https://www.fazcomex.com.br/blog/como-funciona-o-ata-carnet) |
| Entrada nos EUA | Capítulo 97 com tarifa base zero; arte ficou fora das tarifas IEEPA de 2025 e da Section 301 de 25% sobre o Brasil; paga só MPF de 0,346% | [](https://koalagains.com/industry-tariff-report/chapters/97-works-of-art-and-antiques/tariff-updates) |
| Entrada na UE/UK | IVA reduzido: França 5,5%, Alemanha 7%, Itália 5% (desde jul/2025), Bélgica 6%, Reino Unido 5% | [](https://www.barnebys.com/blog/what-art-buyers-need-to-know-about-vat-in-2025) |
| Recebimento | Venda de obra é exportação de mercadoria com contrato de câmbio; Wise Business e Remessa Online cobram câmbio comercial + IOF 0,38% | [](https://www.contabilidadezen.com.br/blog/pj-recebe-exterior-tributacao-cambio-2026/) |
| Documentação exigida lá fora | Fatura com artista, título, ano, técnica e materiais, packing list, certificado de autenticidade, proveniência, DSBC, DU-E, condition report | Convelio |

Conclusão operacional: a HouseArt (ou uma SPE logística) deve ser a exportadora de registro para artistas pessoa física e galerias sem RADAR, consolidando DSBC, DU-E, câmbio e documentação a partir do dossiê que a plataforma já tem. É o mesmo papel que a Fink faz manualmente hoje, só que automatizado.

### Financeiro e outros serviços

| Serviço | Referência | Aplicação na HouseArt |
|---|---|---|
| Parcelamento (BNPL de arte) | [](https://www.forbes.com.au/?p=50821): 10 parcelas sem juros, galeria paga 10% e recebe à vista; 1.900 galerias, ticket médio US$ 10 mil, inadimplência <1% | Parceria com fintech ou produto próprio via HouseCredito; aumenta ticket e conversão |
| Crédito com garantia em obra | Global US$ 34–40 bi, LTV 30–50%; no Brasil a [](https://finarte.com.br/) empresta R$ 100 mil a R$ 2 mi, 40–50% do valor, até 60 meses, a partir de 1,8% a.m., com custódia | Fase 2: a escritura HouseArt vira garantia verificável |
| Armazenagem climatizada | Clé Chenue a partir de R$ 500/mês; Brasil não tem freeport | Parceiro para custódia e consignação |
| Locação de arte | [](https://istoedinheiro.com.br/aluga-se-obra-de-arte-2) cobra 5–10% do valor; corporate leasing é comum no exterior | Módulo futuro, aproveitando o motor de locação da HouseRent |
| Tokenização e fracional | [](https://www.mattosfilho.com.br/unico/cvm-parecer-criptoativos/): fração com expectativa de ganho é valor mobiliário; oferta via Resolução CVM 88 em revisão; FICART IOX e Hurst já operam | Não entrar no MVP; avaliar após volume, possivelmente via HouseCap |
| Molduraria, restauração, fotografia, instalação | Mercado pulverizado, sem player digital | Marketplace de prestadores com avaliação, igual ao de parceiros da Housebroker |

## Mapeamento Housebroker → HouseArt: o que reaproveitar e o que adaptar

Cerca de 70% da Housebroker migra para a HouseArt com troca de domínio (imóvel → obra; corretor → galeria/artista; matrícula → certificado), e os 30% restantes são o núcleo novo que diferencia o produto: autenticação física, certificado-escritura e cadeia de titularidade. A analogia estrutural é direta: a obra é o ativo, o certificado HouseArt é a matrícula, o artista é o incorporador original, a galeria é a imobiliária, o consultor/art advisor é o corretor autônomo e o laudo de avaliação é a Avaliação Imobiliária.

| Módulo Housebroker | Equivalente HouseArt | Reaproveitamento | Adaptação necessária |
|---|---|---|---|
| Cadastro de imóvel (ficha, fotos, documentos) | Cadastro de obra (ficha técnica: título, técnica, dimensões, ano, edição/tiragem, materiais; fotos; condition report) | Alto: entidade, mídia, versionamento | Campos de arte (tiragem, série, assinatura, moldura), check de duplicidade por imagem (hash perceptual + embeddings), tipos: pintura, escultura, papel, fotografia, digital |
| Selo "Apto à Venda" (matrícula + doc do proprietário + termo de autorização) | Selo "Obra Autenticada" (ID físico vinculado + certificado emitido + titular verificado) | Alto: fluxo de upload, leitura por IA, propagação de dados | Substituir matrícula pelo certificado HouseArt; leitura por IA de certificados antigos/notas de galeria para pré-preencher proveniência |
| Due Diligence (certidões do proprietário via Infosimples) | Due Diligence de proveniência (cadeia de propriedade, Art Loss Register, sanções/PLD, certidões do vendedor, licença IPHAN quando aplicável) | Médio: motor de checklist, status e validade por documento | Novo conjunto de verificações; integração com bases de obras roubadas; checagem de restrições de saída do país |
| Marketplace de usados | Marketplace de obras (primário via artista/galeria e secundário entre colecionadores) | Alto: listagem, busca, filtros, página do ativo, leads | Filtros por artista, técnica, faixa de preço, tamanho; viewing room; dois mercados (primário e secundário) com regras distintas de comissão e direito de sequência |
| Fazer Oferta (proposta firme, piso oculto, anti-leilão, 2 etapas) | Fazer Oferta em obra (mesmo motor) | Muito alto | Adicionar modalidade "preço fixo" e, em fase posterior, leilão cronometrado |
| Negociador ativo com mandato do vendedor | Negociador ativo com mandato da galeria/artista | Muito alto | Linguagem e objeções próprias do mercado de arte; integração com direito de sequência |
| Timeline unificada de venda (proposta → registro) | Timeline de transação (oferta → pagamento em escrow → transporte → entrega confirmada → transferência do certificado) | Alto: Kanban, visões por parte, status percentual | Etapas novas: embalagem/frete, seguro de trânsito, aceite na entrega, transferência da escritura |
| HouseValor (Avaliação Imobiliária, percentuais fixos, fator de anúncio) | HouseArt Avaliação (Laudo de Opinião de Valor por comparáveis + histórico do artista + atributos) | Médio: motor de relatório, UX de perguntas objetivas | Metodologia diferente (comparáveis de leilão e de mercado primário, índice do artista, estado de conservação); laudo assinado por avaliador credenciado para fins de seguro e inventário |
| HouseCredito (correspondente bancário) | HouseArt Financeiro: parcelamento (BNPL de arte), crédito com garantia em obras, consórcio/clube de compra | Baixo no curto prazo | Produto financeiro próprio não é prioridade de MVP; parceria com BNPL (modelo Art Money) |
| Cobrança via Stripe/BTG (planos, corretagem, serviços, NF) | Cobrança HouseArt (assinatura de galeria/artista, comissão por venda, serviços de certificação/avaliação/frete/seguro) | Muito alto | Split de pagamento multi-parte (plataforma, galeria, artista, direito de sequência, frete); escrow |
| Assinatura eletrônica (ONR/ICP-Brasil, HouseSign) | Assinatura do certificado e do termo de transferência pelas partes | Muito alto | Carimbo do tempo ICP-Brasil no certificado; assinatura avançada para quem não tem certificado digital |
| CRM + Kanban + leads | CRM da galeria/artista (colecionadores, interesses, follow-up) | Alto | Perfil do colecionador (técnicas, artistas, faixa de preço) para recomendação |
| Comunidade de corretores (rede social, parceria por swipe) | Comunidade HouseArt (artistas, galerias, colecionadores; parcerias de representação) | Alto | Feed por obra/artista; convites de exposição; parcerias galeria–galeria |
| Estúdio de anúncios Instagram (IA + impulsionamento Meta) | Estúdio de divulgação de obras | Muito alto | Templates de peça para arte; integração com catálogo Meta para shopping |
| HouseAgentic (canais, leads, score, cadência) | Mesma camada, quarta plataforma do grupo | Muito alto | Novos agentes: curador-recomendador, assistente de proveniência, verificador de autenticidade no cadastro |
| Cabeçalho com índices (IPCA, INCC, dólar, euro) | Índices de mercado de arte + dólar/euro | Alto | Trocar INCC por índice de preços de arte (Artprice100 ou índice próprio) |
| Design system Housebroker | Design system HouseArt | Médio | Nova identidade: estética de galeria (fundo neutro, tipografia editorial, foco na imagem); manter componentes e tokens estruturais |

O que é novo e não existe em nenhuma plataforma do grupo: o módulo de identidade física da obra (tag NFC segura aplicada e vinculada ao registro), o certificado-escritura com cadeia de custódia assinada e carimbada no tempo, a transferência de titularidade acoplada ao pagamento, o cálculo e repasse automático do direito de sequência e a orquestração de frete e seguro na transação. Esses cinco itens são o investimento de engenharia real da HouseArt; o restante é adaptação de domínio sobre código já existente.

## Arquitetura de autenticação: ID único, dispositivo físico, certificado digital e escritura/transferência

A recomendação é não depender de blockchain pública nem de hardware proprietário: o "dispositivo" é uma tag NFC segura de prateleira (NXP NTAG 424 DNA, R$ 3 a 8 em volume) que qualquer celular lê sem aplicativo, e a prova jurídica vem de assinatura eletrônica das partes mais carimbo do tempo ICP-Brasil em cada evento, encadeados num registro próprio e ancorados diariamente numa cadeia pública gratuita. É o que a Verisart faz com sucesso e o que a Arcual, com blockchain própria, não conseguiu escalar.

A tag prova que a tag é autêntica; o vínculo com a obra vem da fixação tamper-evident e do fingerprint fotográfico tirado no cadastro, e o vínculo com o titular vem da cadeia de assinaturas.

### Camada 1 — identidade física da obra

| Tecnologia | Como funciona | Custo | Uso na HouseArt |
|---|---|---|---|
| [](https://www.nxp.com/products/rfid-nfc/nfc-hf/NTAG424DNA) (variante TT) | A cada leitura a tag gera URL com UID + contador + CMAC AES-128; o servidor valida a assinatura e rejeita replays; versão TT detecta remoção da etiqueta; EAL4; chaves diversificadas por UID a partir de master key em HSM | [](https://shopnfc.com/en/nfc-stickers/487-nfc-stickers-ntag424-dna-d22mm.html) por sticker; inlays Avery Dennison Circus Pro; sem estoque nacional de prateleira, cotar ACURA, HID Brasil, Avery Dennison ou importar de Shop NFC/GoToTags | Padrão para pintura (verso do chassi), escultura (versão on-metal na base) e certificado físico de obras em papel |
| Fingerprint fotográfico próprio | Foto frontal calibrada com cartão de cor + 3 a 5 macros de regiões fixas (cantos, assinatura, craquelê, fibra do papel) + verso; feature matching (SIFT/LightGlue + RANSAC) na verificação | Zero (celular + lente macro de R$ 50) | Obrigatório em todo cadastro; é a versão acessível do que [](https://www.alitheon.com/what-is-this) e [](https://looptechnology.com/case-studies/authenticating-art-with-artclear/) vendem a museus |
| QR impresso + selo void | Ponteiro para a página pública; copiável, nunca prova | Centavos | Fallback para celulares sem NFC |
| Bubble tag ([](https://bigpicturemag.com/bubbletagging-certification/)) | Bolhas aleatórias irreproduzíveis, verificação visual | Baixo | Opção para fotografia e gravura onde não se cola nada na obra |
| DNA sintético ([](https://tagsmart.helpscoutdocs.com/article/72-pricing), SmartWater) | Marcador invisível verificado em laboratório | £12,50–25 por tag | Só para obras de alto valor, como upsell |
| Scanner de superfície (Alitheon, Artclear, Arius) | Vetor numérico das irregularidades microscópicas | Licença sob consulta | Fase 2, para instituições e seguradoras |
| Atribuição por IA ([](https://art-recognition.com/fr/faq/), Hephaestus £8.500) | Responde "é da mão do artista?" com corpus validado | Alto | Não se aplica a emergentes; parceiro para secundário de modernos |

Para arte digital não há tag: SHA-256 do arquivo, hash perceptual, assinatura do artista e carimbo do tempo, com edição numerada no registro e cartão físico de edição com NFC opcional.

### Camada 2 — certificado-escritura e registro

Cada obra tem um ID público legível (por exemplo HA-2026-7K3F-9Q2M) vinculado ao UID da tag e aos fingerprints, e uma cadeia de eventos imutáveis: criado, certificado, listado, transferido, emprestado, restaurado, roubado ou contestado. Cada evento é um JSON canônico que recebe SHA-256, assinatura das partes (JWS com certificado ICP-Brasil ou assinatura avançada via gov.br prata/ouro com biometria), [](https://www.serpro.gov.br/links-fixos-superiores/pss-serpro/actserpro/) de uma ACT ICP-Brasil e o hash do evento anterior. O merkle root diário é ancorado em [](https://help.verisart.com/en/articles/5050610-how-do-blockchain-certificates-work) (Bitcoin, gratuito) ou Polygon (centavos), e o titular pode exportar um arquivo verificável offline. A escritura é o PDF PAdES gerado do evento de transferência, com QR para a página pública, no mesmo pipeline de assinatura já implantado na HouseMap e na Housebroker.

Base legal: a [](https://cnbsp.org.br/2025/02/13/artigo-stj-valida-uso-de-assinatura-eletronica-nao-certificada-pela-icp-brasil-por-jose-higidio/) distingue assinatura simples, avançada e qualificada, e o STJ (REsp 2.159.442) reconheceu validade idêntica à avançada em contratos privados; acima de um valor de corte (sugestão R$ 100 mil) a plataforma exige assinatura qualificada ou e-Notariado e oferece registro no RTD (data certa, custos de [](https://www.tjba.jus.br/portal/wp-content/uploads/2025/12/TABELA-DE-CUSTAS-TJBA-2026-C-DECRETO.pdf)). Atenção: a Resolução CG ICP-Brasil 211 encerra os certificados A1/A2 na cadeia V10 em 31/12/2026, o que afeta o fluxo de assinatura já existente.

Não existe registro público de obras de arte no Brasil (o projeto de 2019 não avançou; o Uruguai tem, pela Lei 17.473/2002). O [](https://www.gov.br/bn/pt-br/atuacao/direitos-autorais-1/documentos-do-eda-2/05-tabela-de-retribuicao.pdf) registra autoria por R$ 40 (PF) e serve como prova de anterioridade; o sistema gera o PDF e orienta o artista. O [](https://www.gov.br/iphan/pt-br/acesso-a-informacao/perguntas-frequentes/cadastro-nacional-de-negociantes-de-obras-de-arte-e-antiguidades-cnart) não registra obras, mas obriga negociantes, inclusive e-commerce, a cadastrar clientes, registrar transações acima de R$ 10 mil e comunicar o COAF: a HouseArt será obrigada e o KYC nasce aderente.

Padrão de dados: [](https://icom.museum/en/resources/standards-guidelines/objectid/) (Getty/ICOM, usado pela Interpol) para descrição da obra e CIDOC-CRM/Linked Art para a ontologia de eventos, o que torna o registro interoperável com museus, seguradoras e o Art Loss Register.

### Camada 3 — transferência de titularidade

A transferência só acontece quando quatro condições se fecham: KYC do comprador (CPF + biometria + PEP, ~US$ 0,30 por verificação via [](https://docs.didit.me/api-reference/database-validation/brazil/biometric-identity-check.md)), assinatura da cessão pelo vendedor e do aceite pelo comprador, liquidação do pagamento na conta da plataforma com [](https://blog.asaas.com/qual-api-oferece-split-de-pagamentos/amp/) (Stripe Connect, Asaas, Pagar.me; tickets acima de R$ 100 mil por TED/Pix ou escrow bancário BTG) e tap da tag no celular do comprador com SUN válido, que prova posse física. Só então o evento transferido é gravado, a nova versão do certificado é emitida e o split libera os valores. Se o colecionador quiser NFT, o padrão [](https://ercs.ethereum.org/ERCS/erc-6956) (asset-bound) permite que o token só se transfira mediante atestado do oráculo da plataforma após o tap, sem carteira cripto obrigatória.

O direito de sequência é calculado automaticamente: 5% sobre max(0, preço atual − preço anterior registrado), retido no split e repassado ao artista ou herdeiros com recibo. Isso exige registrar o preço de cada transferência, com opção de preço selado (apenas o hash público). O sistema também emite ao vendedor pessoa física um informe de alienação (ganho de capital de 15% a 22,5%, isenção para vendas de até R$ 35 mil no mês, [](https://www.ibet.com.br/tributacao-de-colecao-de-arte/)) e ao comprador o comprovante de custo de aquisição para a DIRPF.

### Camada 4 — avaliação e detecção de duplicidade

Para obras com histórico, o modelo combina regressão hedônica (artista, técnica, dimensões, ano) com comparáveis e embeddings de imagem; a literatura ([](https://www.sfi.ch/en/publications/n-25-110-deep-learning-for-art-market-valuation)) mostra R² de 0,70 com imagem contra 0,60 sem. Para artistas emergentes, onde os modelos falham, o sistema produz faixa de referência a partir do preço de tabela do próprio artista por cm² e técnica, pares com CV semelhante (formação, exposições, galerias, prêmios) e vendas primárias registradas na plataforma, sempre rotulada como estimativa e não laudo. Não há API aberta de preços (Artnet, Artprice e MutualArt são assinaturas web), e a base nacional terá de ser construída com catálogos públicos de leiloeiros e com as próprias transações: a HouseArt vira, com o tempo, o único índice de preços do mercado brasileiro.

No cadastro, duplicidade e plágio são detectados em duas etapas: pHash/dHash (distância de Hamming até 5 = mesma imagem) e embeddings CLIP/DINOv2 em pgvector no Supabase para crops, reproduções e semelhança estilística, com fila de revisão humana na zona cinzenta.

## Produto HouseArt: módulos, jornadas e dados

A HouseArt é o registro de propriedade da obra primeiro e marketplace depois: todo o valor do produto nasce do fato de que uma obra com certificado HouseArt vale mais, vende mais rápido e circula com menos atrito do que uma obra sem ele. O marketplace, a avaliação, o frete e o seguro são serviços que orbitam o registro.

### Perfis de usuário

| Perfil | Papel na plataforma | Equivalente Housebroker | O que paga |
|---|---|---|---|
| Artista | Cadastra obras, solicita autenticação, vende no mercado primário, recebe direito de sequência | Proprietário/incorporador | Plano de ateliê + tags de autenticação |
| Galeria / marchand | Representa artistas, lista estoque, vende, emite certificados em nome do artista representado | Imobiliária | Plano de galeria + comissão por venda |
| Consultor / art advisor | Intermedeia compras, monta coleções, aciona avaliações | Corretor autônomo | Plano individual + split de comissão |
| Colecionador / comprador | Compra, guarda a escritura digital, revende no secundário, contrata seguro e avaliação | Comprador / proprietário de usado | Serviços avulsos e comissão na revenda |
| Avaliador credenciado | Emite laudo de opinião de valor e laudo pericial | Avaliador do HouseValor | Recebe por laudo |
| Parceiros de serviço | Transportadora, seguradora, molduraria, restaurador, fotógrafo | Cartório, banco, despachante | Taxa de marketplace de serviços |
| Instituições (museus, bancos, leiloeiros) | Consultam proveniência, validam certificados, importam coleções | HousemapMC | API e planos corporativos |

### Módulos

1. Registro de obras: ficha técnica completa, mídia em alta resolução, condition report, histórico de exposições e publicações, detecção de duplicidade por imagem no cadastro.
2. Autenticação e identidade física: aplicação da tag NFC segura (ou marcador alternativo para papel/fotografia), vinculação criptográfica tag ↔ obra ↔ artista, verificação por celular sem app (leitura NFC abre a página pública da obra).
3. Certificado-escritura: documento assinado pelo artista (ou galeria com mandato), carimbado no tempo via ICP-Brasil, com hash da mídia e do condition report; página pública de verificação; cadeia de titularidade visível ao titular e, de forma anonimizada, ao público.
4. Transferência de titularidade: fluxo bilateral (vendedor assina cessão, comprador aceita com KYC), acoplado ao pagamento em escrow e à confirmação de entrega; emissão automática de nova versão do certificado com o novo titular.
5. Marketplace: mercado primário (artista/galeria) e secundário (colecionador), viewing rooms, motor de ofertas herdado da Housebroker, negociador ativo com mandato, recomendação por perfil de colecionador.
6. Avaliação: Laudo de Opinião de Valor com comparáveis (leilões, mercado primário, histórico do próprio artista na plataforma), fatores de ajuste fixos (técnica, dimensão, estado, assinatura, exposição institucional), laudo assinado por avaliador credenciado para seguro, inventário, partilha e garantia.
7. Serviços na transação: cotação e contratação de frete especializado e seguro de trânsito dentro do checkout; seguro de acervo pós-compra; molduraria, instalação e armazenagem como marketplace de parceiros.
8. Direito de sequência: cálculo automático de 5% sobre a mais-valia na revenda, retenção no split de pagamento e repasse ao artista ou herdeiros, com comprovante.
9. Cobrança e financeiro: assinaturas, comissões, split multi-parte, escrow, notas fiscais, câmbio para venda internacional.
10. Comunidade e divulgação: perfis de artista e galeria, feed, estúdio de anúncios com IA e impulsionamento Meta, convites para exposições e feiras.
11. HouseAgentic: atendimento e qualificação de leads, assistente de proveniência (lê certificados antigos e notas fiscais para reconstruir histórico), curador-recomendador.
12. API e integrações: consulta pública de certificado, webhooks para galerias com sistema próprio (Artlogic, ArtBinder), importação de acervos.

### Jornadas centrais

| Jornada | Passos | Resultado |
|---|---|---|
| Artista autentica uma obra | Cadastra ficha e fotos → sistema checa duplicidade → recebe kit de tags pelo correio ou aplica na galeria parceira → aproxima o celular da tag para vincular → assina o certificado | Obra com Selo HouseArt e página pública de verificação |
| Galeria vende obra autenticada | Lista a obra → comprador faz oferta ou compra a preço fixo → pagamento em escrow → galeria contrata frete e seguro no checkout → comprador confirma recebimento lendo a tag → escritura transferida e valores liberados | Transação concluída com rastreio completo |
| Colecionador revende no secundário | Lista a obra a partir da própria escritura → plataforma valida titularidade → venda → direito de sequência retido e repassado → nova escritura | Mercado secundário líquido e legítimo |
| Comprador verifica uma obra fora da plataforma | Aproxima o celular da tag → página mostra obra, artista, titular atual (anonimizado) e status (ativa, roubada, contestada) | Confiança sem precisar de conta |
| Avaliação para seguro ou inventário | Titular solicita laudo → avaliador recebe dossiê completo (ficha, proveniência, condition report) → emite laudo assinado → laudo anexado ao certificado | Documento aceito por seguradora e cartório |

### Modelo de dados (núcleo novo)

As entidades herdadas da Housebroker (usuário, organização, lead, oferta, transação, cobrança, documento, assinatura) permanecem; o núcleo novo é: Artista (identidade verificada, herdeiros/espólio, representantes); Obra (ficha técnica, mídia com hash, edição e tiragem, estado); Marcador físico (UID da tag, chave, status de ativação, histórico de leituras); Certificado (versão, titular, hash do conteúdo, assinaturas, carimbo do tempo, status); Titularidade (cadeia de cessões com preço quando declarado, data, partes anonimizadas); Laudo (avaliador, metodologia, valor, validade); Evento de proveniência (exposição, publicação, restauro, sinistro, roubo). Cada versão do certificado referencia a anterior por hash, formando uma cadeia verificável sem blockchain pública.

## Modelo de negócio e precificação

A HouseArt repete a monetização tripla da Housebroker (assinatura, comissão e serviços) e acrescenta uma quarta linha, a taxa de certificação, que é a única receita que não depende de a obra ser vendida na plataforma. A referência de take rate aceitável para galerias é 10–20% (Platform 20%, Nano 10%, Artsy 15%); comissões de 35–50% dos marketplaces artista-direto não se sustentam no Brasil, onde galerias vendem 20% pelo WhatsApp sem pagar nada.

### Linhas de receita

| Linha | Preço proposto | Lógica |
|---|---|---|
| Certificação (tag + certificado-escritura) | R$ 149 por obra (artista) / R$ 99 em lote de 10+ (galeria); tag inclusa; recertificação após restauro R$ 49 | Custo da tag NFC segura fica abaixo de R$ 15; Tagsmart cobra £25 só pela tag; o valor é a confiança, não o hardware |
| Transferência de titularidade fora do marketplace | R$ 199 por transferência (vendas feitas na galeria física ou por WhatsApp e registradas depois) | Captura as vendas off-platform (80% do mercado) sem exigir que passem pelo checkout |
| Assinatura Artista | Grátis até 10 obras; Ateliê R$ 49/mês (obras ilimitadas, loja, estúdio de anúncios, CRM) | Freemium para atrair volume de cadastro; o artista paga quando vende |
| Assinatura Galeria | R$ 349/mês (até 3 usuários, inventário, viewing room, CRM, due diligence, exportação assistida); Galeria Pro R$ 899/mês (multiusuário, API, relatórios) | Entre a Artlogic (US$ 205–409) e o nada; cabe nas 58% das galerias com até R$ 5 mi/ano |
| Assinatura Consultor / Art advisor | R$ 149/mês | Equivalente ao plano do corretor na Housebroker |
| Comissão no marketplace primário | 12% sobre a venda (galeria ou artista); split automático | Abaixo da Artsy (15%) e da Platform (20%); acima da Nano (10%) com muito mais serviço |
| Comissão no mercado secundário | 8% do comprador + 4% do vendedor; direito de sequência de 5% sobre a mais-valia retido e repassado | Secundário é onde a escritura gera mais valor; comissão menor para criar liquidez |
| Laudo de Opinião de Valor | Estimativa automática grátis; laudo assinado por avaliador credenciado R$ 390 a R$ 1.490 conforme valor da obra; laudo pericial sob orçamento | Artscapy cobra £60; mercado brasileiro sem padrão; avaliador recebe 60% |
| Due diligence de proveniência | R$ 290 por obra (Art Loss Register, certidões do vendedor, checagem IPHAN, PLD) | Custo do ALR £85 por busca; margem no empacotamento |
| Frete e seguro | Margem de 10–15% sobre a cotação do parceiro (Fink, Alves Tegam, Convelio, Arta); seguro de trânsito e de acervo como estipulante com comissão de corretagem | Replica Convelio/Arta; seguro de acervo recorrente é receita anual |
| Serviços de parceiros | 10% sobre molduraria, restauração, fotografia, instalação, armazenagem | Marketplace de prestadores, igual à Housebroker |
| Exportação assistida | R$ 890 por processo (DSBC, DU-E, câmbio, documentação) + frete | Resolve a dor de 60 dias de burocracia da Pesquisa Setorial |
| Divulgação | Impulsionamento Meta com margem de 15% sobre a mídia; destaque no marketplace R$ 99/semana | Já implementado na Housebroker/HouseRent |
| Dados e API (fase 2) | Índice HouseArt de preços, API de verificação para seguradoras, bancos, leiloeiros e museus; planos corporativos a partir de R$ 2.500/mês | Modelo Winston Artory Group e Artnet; só vale com massa crítica |
| Financeiro (fase 2) | Comissão sobre BNPL (10% da galeria, modelo Art Money) e originação de crédito com garantia em obra | Via HouseCredito e parceiros |

### Unit economics indicativos

Uma galeria mediana da Pesquisa Setorial vende 141 obras por ano com faturamento de até R$ 5 mi; se certificar 100 obras (R$ 9.900), assinar o plano Galeria (R$ 4.188/ano), transferir 30 vendas off-platform (R$ 5.970) e fechar 10 vendas no marketplace a R$ 25 mil (R$ 30.000 de comissão), gera cerca de R$ 50 mil/ano, com frete, seguro e laudos por cima. Com 100 galerias ativas e 2.000 artistas pagantes, a receita recorrente e transacional passa de R$ 6 mi/ano antes de serviços adjacentes. O custo variável relevante é a tag (abaixo de R$ 15), o carimbo do tempo ICP-Brasil (centavos por documento) e o repasse ao avaliador; o resto é software já amortizado pela Housebroker.

### Decisões de precificação a confirmar

1. Se a certificação do artista deve ser gratuita no lançamento (subsidiada) para acelerar a base de obras certificadas, cobrando apenas da galeria e na transferência.
2. Se a comissão no primário deve ser cobrada da galeria (modelo Artsy) ou dividida com o comprador (modelo de leilão).
3. Se o direito de sequência deve ser retido obrigatoriamente em toda revenda (cumprimento estrito da lei) ou oferecido como opção com selo "artista remunerado".

## Estratégia de entrada e expansão internacional

A estratégia é entrar pelo registro, não pelo marketplace: certificar obras que já estão sendo vendidas pelo Instagram, pelo WhatsApp e nas galerias físicas, e só depois disputar a transação. Todo marketplace de arte que começou pela venda (Nano, Artspace, Arcual) ficou sem oferta e sem demanda ao mesmo tempo; o registro resolve o problema do ovo e da galinha porque gera valor para o artista e para a galeria antes de existir um único comprador na plataforma.

### Fase 1 — Registro como cabeça de ponte (meses 1 a 9)

Público: artistas contemporâneos emergentes e mid-career com venda ativa e galerias com faturamento até R$ 5 mi (58% das galerias do país). Proposta: "toda obra que sai do seu ateliê sai com escritura". Táticas: certificação gratuita ou subsidiada para os primeiros 500 artistas; kit de tags enviado pelo correio com protocolo de foto; integração com Instagram (a página pública da obra vira o link da bio e dos posts); programa com escolas de arte, ateliês coletivos e coletivos de artistas; parceria com 2 ou 3 galerias-âncora em Salvador e São Paulo que certificam o estoque inteiro. Meta: 10 mil obras certificadas e 1.000 artistas ativos. A Bahia é o laboratório natural: mercado forte (Salvador tem galerias consolidadas e escolas de arte), pouca concorrência e proximidade do time.

### Fase 2 — Transação e serviços (meses 6 a 18)

Abrir o marketplace primário com as obras já certificadas, o motor de ofertas e o negociador da Housebroker, frete e seguro cotados no checkout com Fink/Alves Tegam e apólice coletiva, laudo de opinião de valor e transferência paga de titularidade para vendas feitas fora da plataforma. Parcerias de distribuição: SP-Arte Rotas e ArtRio (a HouseArt certifica e intermedeia a logística das obras vendidas na feira), leiloeiros regionais que não têm plataforma, corretoras de seguro de arte (Finarte, Enchanter) que precisam da documentação por obra. Meta: GMV de R$ 20 mi e 100 galerias assinantes.

### Fase 3 — Secundário, financeiro e dados (meses 18 a 36)

Mercado secundário entre colecionadores com direito de sequência automático, BNPL e crédito com garantia em obra via HouseCredito e parceiros, índice HouseArt de preços e API de verificação para seguradoras, bancos, museus e leiloeiros (modelo Winston Artory Group), e possível empacotamento de obras em veículos regulados via HouseCap quando a CVM concluir a revisão da Resolução 88.

### Expansão internacional — vender arte brasileira para o mundo

| Decisão | Recomendação | Por quê |
|---|---|---|
| Mercado-alvo inicial | EUA (56% das exportações brasileiras de arte), depois Reino Unido e França | Arte entra nos EUA sem tarifa e com MPF de 0,346%; interesse internacional por artistas latino-americanos percebido por 88% dos agentes do setor |
| Modelo | Exportadora-consolidadora: a HouseArt (SPE com RADAR) exporta em nome de artistas PF e galerias sem habilitação, com DSBC, DU-E, câmbio e documentação automáticos | Pessoa física não exporta comercialmente; o processo hoje leva até 60 dias e é a principal dor da Pesquisa Setorial |
| Logística | Convelio ou Arta via API para a perna internacional; Fink para a perna nacional e o despacho | Cotação instantânea no checkout; seguro AXA/Chubb embutido; rede ICEFAT no destino |
| Vitrine | Listagem espelhada em inglês e página de verificação bilíngue; parceria com galerias e feiras latino-americanas em Miami e Nova York; integração com Artsy como canal (galerias brasileiras já assinam) em vez de concorrência | O comprador internacional precisa do certificado, da proveniência e da fatura padronizada, que a HouseArt já produz |
| Recebimento | Contrato de câmbio de exportação via Wise Business ou Remessa Online, pagamento internacional com Stripe | Câmbio comercial e IOF de 0,38% |
| Compliance | DSBC automática com triagem de obras pré-1889 e tombadas; CITES para materiais (madeiras protegidas, penas, conchas); fatura com descrição de materiais para evitar reclassificação tarifária (metal, mobiliário) | Evita apreensão e tarifas indevidas |
| Produto para o exterior | Primeiro o registro como serviço para galerias latino-americanas (o Uruguai tem registro estatal, Argentina, Colômbia e México não têm plataforma de certificação); depois marketplace | O registro viaja melhor que o marketplace: não depende de logística local nem de base de compradores |

### Posicionamento e marca

A HouseArt deve se apresentar como a infraestrutura de confiança do mercado de arte brasileiro (registro, escritura, laudo, logística), não como mais uma galeria online. Isso evita o conflito com galerias (que são clientes, não concorrentes), aproxima institutos de artistas, seguradoras e leiloeiros, e cria a base de dados que nenhum concorrente tem. O marketplace é consequência: quem tem a escritura, tem a listagem. A identidade visual segue a família House (estrutura e componentes), com estética editorial de galeria: fundo neutro, tipografia serifada nos títulos, imagem da obra como protagonista.

## Fatores críticos de sucesso e riscos

O negócio dá certo se, em dois anos, uma obra com escritura HouseArt for aceita como padrão por seguradoras, leiloeiros e galerias e vendida a um prêmio visível sobre uma obra sem ela; tudo o mais é consequência. O maior risco não é tecnológico nem concorrencial, é de adoção: o mercado brasileiro é pequeno, informal, concentrado em São Paulo e avesso a intermediários digitais (1% das vendas em plataformas de terceiros).

### Fatores críticos de sucesso

1. Massa crítica de obras certificadas antes do marketplace: a escritura só tem valor de rede quando seguradoras e compradores a reconhecem; 10 mil obras em 9 meses é o número que muda a conversa.
2. Adoção pelas galerias como ferramenta de trabalho, não como canal de venda: inventário, CRM, certificado e exportação assistida a preço inferior ao da Artlogic; a galeria é cliente, nunca concorrente.
3. Validação institucional precoce: acordo com ao menos uma corretora de seguro de arte (Finarte ou Enchanter), um leiloeiro e um instituto de artista (Projeto Portinari, Instituto Volpi ou similar) reconhecendo o certificado reduz o custo de convencimento de todos os demais.
4. Fricção zero no registro: tag pelo correio, foto pelo celular, assinatura via gov.br, sem app obrigatório; cada minuto a mais no cadastro derruba a adoção de artistas.
5. Reaproveitamento disciplinado da Housebroker: lançar com 70% de código existente e concentrar engenharia nas cinco peças novas (tag, ledger, transferência, direito de sequência, orquestração de frete e seguro).
6. Logística e seguro realmente embutidos no checkout, com preço visível na página da obra; é o que diferencia Convelio e Singulart e o que nenhum player brasileiro faz.
7. Base de preços própria: cada transação registrada alimenta o índice que, em três anos, vira o produto de dados mais defensável da plataforma.
8. Compliance desde o dia 1: CNART/IPHAN, COAF, LGPD para dados de titulares e KYC; a credibilidade do registro depende disso.

### Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Baixa adoção por artistas e galerias (mercado informal, WhatsApp dominante) | Alta | Alto | Entrar pelo registro gratuito/subsidiado; encaixar no fluxo do Instagram; galerias-âncora; medir obras certificadas, não GMV, nos primeiros 9 meses |
| Certificado não reconhecido pelo mercado (vira "mais um papel") | Média | Alto | Acordos com seguradoras, leiloeiros e institutos; padrão Object ID; carimbo ICP-Brasil e opção de RTD; página pública de verificação sem login |
| Fraude na origem: artista ou galeria certifica obra falsa ou de terceiro | Média | Alto | KYC do emissor, detecção de duplicidade por imagem, fingerprint, status "contestada" com fluxo de disputa, termo de responsabilidade; a HouseArt atesta registro e cadeia, não autoria (limitar responsabilidade contratualmente) |
| Tag removida e aplicada em outra obra | Média | Médio | Variante TT (tamper), fingerprint fotográfico obrigatório, verificação cruzada no tap de transferência |
| GMV baixo e take rate insuficiente para sustentar a operação | Alta | Médio | Receita recorrente (assinatura, certificação, transferência off-platform, seguro) antes da comissão; custo de software já amortizado pela Housebroker |
| Concorrência: Artsy+Artnet com serviços financeiros, Nano Art com galerias, Artsoul com varejo | Média | Médio | Nenhum tem registro físico-digital nem opera exportação e seguro no Brasil; integrar com Artsy como canal em vez de competir |
| Regulatório: CVM em fracional, BCB em escrow, Resolução ICP-Brasil 211 (fim do A1 em dez/2026), reforma tributária | Média | Médio | Não entrar em fracional no MVP; usar instituição de pagamento parceira para split; migrar assinatura para os novos perfis ICP; acompanhar IBS/CBS |
| Responsabilidade civil por laudo de avaliação ou por obra roubada vendida na plataforma | Média | Alto | Laudo assinado por avaliador credenciado com seguro de responsabilidade; checagem obrigatória no Art Loss Register para obras acima de um corte; termos de uso claros sobre o papel de intermediária |
| Exportação: apreensão por obra restrita (pré-1889, tombada), CITES, reclassificação tarifária | Baixa | Alto | DSBC automática com triagem por data e autor; fatura com materiais; parceiro despachante especializado |
| Dependência de fornecedor estrangeiro de tags e de Convelio/Arta | Média | Baixo | Homologar dois fornecedores (Avery Dennison, Shop NFC/GoToTags) e manter Fink/Alves Tegam como alternativa nacional |
| Direito de sequência gera atrito com galerias e leiloeiros | Média | Médio | Selo "artista remunerado" como diferencial de marketing; cobrança transparente e automática; não há exposição da plataforma, a lei já obriga o intermediário |
| Dispersão de foco do grupo (HouseMap, Housebroker, HouseRent, HouseCredito, HouseCond, Kivid) | Alta | Alto | Time dedicado de produto e vendas para arte; engenharia compartilhada apenas nos módulos herdados; metas trimestrais próprias |

### O que precisa ser verdade para seguir

Antes de investir no marketplace completo, três hipóteses devem ser testadas em 90 dias com um MVP de registro: ao menos 30% dos artistas convidados certificam mais de 5 obras; ao menos 3 galerias aceitam certificar o estoque inteiro pagando assinatura; ao menos uma corretora de seguro aceita o dossiê HouseArt como documentação de apólice. Se duas das três falharem, o produto deve ser repensado como software de gestão para galerias (modelo Artlogic brasileiro) em vez de plataforma de registro e transação.

## Roadmap de implantação e próximos passos

O MVP de registro cabe em 90 dias porque cadastro, mídia, assinatura, cobrança e CRM já existem na Housebroker; o esforço novo é a integração da tag NFC, o ledger com carimbo do tempo e a página pública de verificação.

Cada fase só abre quando o gate anterior é atingido; se o Gate 1 falhar, o produto vira software de gestão de galerias em vez de plataforma de registro e transação.

### Frentes de trabalho do MVP (90 dias)

| Frente | Entrega | Origem |
|---|---|---|
| Produto e design | Brief para o Claude Design: cadastro de obra, kit de certificação, página pública, perfil de artista e galeria, com o design system House em estética de galeria | Novo, sobre componentes existentes |
| Engenharia — domínio | Fork da Housebroker com entidades Artista, Obra, Marcador, Certificado, Titularidade, Laudo, Evento de proveniência; detecção de duplicidade (pHash + pgvector) | Adaptação |
| Engenharia — núcleo novo | Serviço de tags (chaves diversificadas em KMS, validação SUN), ledger append-only com JWS + carimbo ACT + âncora diária, gerador de certificado PAdES, página de verificação sem login | Novo |
| Hardware | Cotação e homologação de NTAG 424 DNA TT com ACURA, HID Brasil, Avery Dennison e importação de 2 mil unidades; protocolo de fixação por tipo de obra | Novo |
| Jurídico e compliance | Termos de uso (papel de registradora, limite de responsabilidade), termo de certificação do artista, cadastro CNART/IPHAN, política COAF/LGPD, cotação de ACT (Serpro, Certisign, Valid) | Novo |
| Comercial | 3 galerias-âncora (Salvador e São Paulo), 1 corretora de seguro (Finarte ou Enchanter), 1 leiloeiro, 1 instituto de artista; 500 artistas convidados | Novo |
| HouseAgentic | Agente de atendimento e qualificação no WhatsApp da HouseArt; assistente de proveniência que lê certificados antigos | Reaproveitamento |

### Próximos passos imediatos

- Validar com 10 artistas e 3 galerias o fluxo de certificação em papel (entrevistas de 30 minutos) antes de codar
- Decidir as 3 questões de precificação (certificação gratuita no lançamento, quem paga a comissão, sequência obrigatória)
- Cotar tags NTAG 424 DNA TT e carimbo do tempo ICP-Brasil
- Gerar o brief de design (Claude Design) e a spec técnica do núcleo novo (Claude Code) a partir deste documento
- Registrar a marca HouseArt no INPI (classes 9, 35, 36, 42) e verificar domínios
- Abrir conversa com Finarte/SP-Arte e com a ArtRio sobre certificação e logística das feiras de 2027

## Fontes

Mercado: [](https://www.artbasel.com/stories/the-art-basel-and-ubs-global-art-market-report-2026?lang=en) · [](https://www.artbasel.com/stories/the-art-basel-and-ubs-survey-of-global-collecting-2026) · [](https://www.aap.com.au/aapreleases/cision20260310en05826) · [](https://www.deloitte.com/lu/en/services/financial-advisory/research/art-finance-report.html) · [](https://latitudebrasil.com/wp-content/uploads/2025/02/250122-Act-PesquisaSetorial2024-Resumo-Executivo.pdf) · [](https://relatoriomercado2026.actarte.com/) · [](https://braziljournal.com/o-novo-colecionador-de-arte-brasileiro/) · [](https://exame.com/casual/como-se-sustenta-o-mercado-de-arte-no-brasil-em-2026/) · [](https://artequeacontece.com.br/vendas-da-sp-arte-2026-batem-recordes-mas-concentracao-nos-grandes-tickets-preocupa-galerias-menores/) · [](https://neofeed.com.br/finde/os-bastidores-do-crescimento-das-milionarias-falsificacoes-de-arte-no-brasil/) · [](https://news.artnet.com/market/over-50-percent-of-art-is-fake-130821) · [](https://www.eurojust.europa.eu/news/international-operation-leads-seizure-2-000-fake-works-art-potential-losses-eur-200-million) · [](https://www.migalhas.com.br/depeso/324499/o-famigerado-direito-de-sequencia-no-mercado-de-artes-brasileiro) · [](https://select.art.br/o-que-saber-sobre-importacao-e-exportacao-de-obras-de-arte/)

Concorrentes: [](https://itsartlaw.org/al-clippings/artsy-and-artnet-merger/) · [](https://multiples.vc/private-comps/artsy) · [](https://www.businesswire.com/news/home/20260227605469/en/1stDibs-Reports-Fourth-Quarter-and-Full-Year-2025-Financial-Results) · [](https://priceyourpainting.substack.com/p/where-to-sell-your-paintings-in-2026) · [](https://www.privateequitywire.co.uk/singulart-raises-eur60m-series-b-round/) · [](https://sellers.artfinder.com/article/927-what-are-artfinders-seller-plan-subscriptions) · [](https://www.artmajeur.com/en/our-services) · [](https://news.artnet.com/news-pro/david-zwirner-platform-e-commerce-art-detective-2000570) · [](https://avantarte.com/about/) · [](https://investormint.com/investing/masterworks-review-2026) · [](https://www.antiquestradegazette.com/news/2025/auction-houses-christie-s-and-sotheby-s-reveal-totals-for-2025/) · [](https://www.arcual.com/about-us) · [](https://fairchain.art) · [](https://help.verisart.com/en/articles/6303087-verisart-shopify-app-pricing-and-limits) · [](https://www.artnews.com/art-news/news/winston-artory-merger-launches-1234748119) · [](https://tagsmart.helpscoutdocs.com/article/72-pricing) · [](https://www.artloss.com/faqs/) · [](https://pricingsaas.com/companies/exhibite) · [](https://www.theartnewspaper.com/2026/03/11/nifty-gateway-shut-down-nft-marketplace-evolving) · [](https://braziljournal.com/f8nc) · [](https://www.artsoul.com.br) · [](https://www.cbinsights.com/company/artscapy) · [](https://www.liveart.ai/about) · [](https://www.mutualart.com/plans)

Serviços adjacentes: [](https://www.convelio.com/en/convelio-api/) · [](https://tech.eu/2026/04/14/fine-art-logistics-company-convelio-secures-series-c-funding/) · [](https://arta.io) · [](https://www.silicon.co.uk/press-release/arta-launches-embedded-valuables-insurance-product-in-partnership-with-chubb-to-expand-its-suite-of-consumer-offerings) · [](https://www.fink.com.br/mobility/transporte-de-obras-de-arte/) · [](https://www.bloomberglinea.com.br/negocios/grupo-frances-investe-r-17-mi-para-guardar-obras-de-arte-de-elite-em-sao-paulo/) · [](https://momaa.org/art-shipping-cost-calculator-2026/) · [](https://www.tokiomarine.com.br/seguros/seguro-obras-de-arte) · [](https://www.chubb.com/content/dam/chubb-sites/chubb-com/br-pt/condicoes-gerais/patrimonial-e-riscos-diversos/rd-obras-de-arte-processo-susep-15414-0022682012-33-versao-de-23-12-2022-ate-10-12-2025.pdf) · [](https://finarte.com.br/) · [](https://revistaapolice.com.br/2022/07/seguro-para-obras-de-arte-entenda-como-funciona-e-sua-importancia/) · [](https://www.gov.br/iphan/pt-br/servicos/saida-de-bens-culturais-do-brasil) · [](http://www.planalto.gov.br/ccivil_03/leis/L4845.htm) · [](https://www.gruposerpa.com.br/exportacao-de-obras-de-arte/) · [](https://koalagains.com/industry-tariff-report/chapters/97-works-of-art-and-antiques/tariff-updates) · [](https://www.barnebys.com/blog/what-art-buyers-need-to-know-about-vat-in-2025) · [](https://www.forbes.com.au/?p=50821) · [](https://www.mattosfilho.com.br/unico/cvm-parecer-criptoativos/)

Tecnologia e jurídico: [](https://www.nxp.com/products/rfid-nfc/nfc-hf/NTAG424DNA) · [](https://shopnfc.com/en/nfc-stickers/487-nfc-stickers-ntag424-dna-d22mm.html) · [](https://rfid.averydennison.com/content/dam/rfid/en/products/rfid-products/data-sheets/datasheet-Circus-Pro-NTAG424-DNA.pdf) · [](https://www.alitheon.com/what-is-this) · [](https://looptechnology.com/case-studies/authenticating-art-with-artclear/) · [](https://art-recognition.com/fr/faq/) · [](https://help.verisart.com/en/articles/5050610-how-do-blockchain-certificates-work) · [](https://ercs.ethereum.org/ERCS/erc-6956) · [](https://icom.museum/en/resources/standards-guidelines/objectid/) · [](https://cnbsp.org.br/2025/02/13/artigo-stj-valida-uso-de-assinatura-eletronica-nao-certificada-pela-icp-brasil-por-jose-higidio/) · [](https://www.serpro.gov.br/links-fixos-superiores/pss-serpro/actserpro/) · [](https://portalspedbrasil.com.br/?p=19554) · [](https://www.tjba.jus.br/portal/wp-content/uploads/2025/12/TABELA-DE-CUSTAS-TJBA-2026-C-DECRETO.pdf) · [](https://www.gov.br/bn/pt-br/atuacao/direitos-autorais-1/documentos-do-eda-2/05-tabela-de-retribuicao.pdf) · [](https://www.gov.br/iphan/pt-br/acesso-a-informacao/perguntas-frequentes/cadastro-nacional-de-negociantes-de-obras-de-arte-e-antiguidades-cnart) · [](https://docs.didit.me/api-reference/database-validation/brazil/biometric-identity-check.md) · [](https://blog.asaas.com/qual-api-oferece-split-de-pagamentos/amp/) · [](https://www.ibet.com.br/tributacao-de-colecao-de-arte/) · [](https://www.sfi.ch/en/publications/n-25-110-deep-learning-for-art-market-valuation) · [](https://mixpeek.com/guides/perceptual-image-hashing-near-duplicate-detection)

Pendências de verificação: alíquota vigente de II para NCM 9701–9703; preços de carimbo do tempo por volume; fornecedor nacional de NTAG 424 DNA; regras BCB para escrow em marketplace; comissão da Artsoul; balanços das leiloeiras brasileiras.
