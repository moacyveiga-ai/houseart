# Cenário de demonstração

Desde 2026-11-10 as obras e os artistas são REAIS e em domínio público (Van Gogh, Hokusai, Monet, Vermeer,
Almeida Júnior), com ficha e biografia verdadeiras; só a venda é simulada. Os logins `joana.demo@` e `marta.demo@`
representam Van Gogh e Hokusai. As fotos reais entram por `real-works.manual.mjs` (precisa de rede até a produção e a
Wikimedia e de `sharp`); sem ele, o roteiro usa as imagens sintéticas de `images/`.

Percorre TODOS os perfis pelas rotas reais da API e deixa dados de demonstração: obras com fotos,
certificação com etiqueta, mandatos, propostas, negócios até a escritura, revenda no secundário,
mensagens, comunidade e laudo. Nenhum atalho pelo banco além das contas.

0. Recriar do zero (apaga só as contas `*.demo@houseart.test`, a `smoke.artista@houseart.test` e o que é delas):
   `scripts/demo/reset.sql`, numa execução só — contas reais e o admin ficam.
1. Contas (o cadastro exige e-mail; por isso entram por SQL): `scripts/demo/accounts.sql`
   — local: `psql "$DATABASE_URL" -f scripts/demo/accounts.sql`; produção: SQL Editor do Supabase.
2. Roteiro: `DEMO_BASE_URL=https://… DEMO_ADMIN_EMAIL=… DEMO_ADMIN_PASSWORD=… node scripts/demo/scenario.mjs`
   (uma vez por ambiente: cada execução cadastra obras novas; o freio de propostas por IP é 10/h).

Logins de demonstração (senha `Demo-HouseArt-2026`): joana.demo@ (artista) · marta.demo@ (artista) ·
ana.demo@ (galeria, admin) · caio.demo@ (galeria, vendas) · helena.demo@ (consultora) ·
marina.demo@, marcelo.demo@, lia.demo@ (colecionadores) · rui.demo@ (avaliador) — todos `@houseart.test`.
Com o Stripe em modo de teste o cartão entra pelo SetupIntent confirmado com `pm_card_visa`/`pm_card_mastercard`.

**Preços.** Os anúncios usam estimativas de valor de mercado (recordes de leilão e valores de seguro, US$ 1 = R$ 5,50), com o piso em 85 %: a Mona Lisa sai por R$ 5,5 bilhões, as gravuras japonesas e o estudo de Almeida Júnior abaixo de R$ 1 milhão. A Stripe cobra no máximo cerca de R$ 1 milhão por pagamento, então o cenário só COMPRA essas obras baratas (Fuji vermelho e o estudo do Caipira, que a Marina revende no secundário; a Grande onda recebe contraproposta do negociador). As propostas nas obras-primas usam a garantia "Transferência na aceitação", que não cobra nada: a da Moça com brinco de pérola é aceita e fica reservada esperando a transferência. O "Comprar agora" dessas obras falha de propósito. Os CPFs são de teste (dígitos válidos, não pertencem a ninguém); os cartões são os números de teste do Stripe.
2b. Mais obras reais para encher o marketplace: `more-works.manual.mjs` (26 obras; precisa de `sharp` e de rede até a Wikimedia) e depois `more-content.sql` (biografias dos artistas novos).
3. Conteúdo público com imagem (capa da galeria, notícias, posts, retratos e trajetória dos artistas, fotos/salas/equipe
   da galeria, publicações): `scripts/demo/content.sql`, depois do roteiro — reaproveita as derivadas públicas das obras.
   Aplicado em produção em 2026-10-22.
