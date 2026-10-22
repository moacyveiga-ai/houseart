# Cenário fictício (demo)

Percorre TODOS os perfis pelas rotas reais da API e deixa dados de demonstração: obras com fotos,
certificação com etiqueta, mandatos, propostas, negócios até a escritura, revenda no secundário,
mensagens, comunidade e laudo. Nenhum atalho pelo banco além das contas.

1. Contas (o cadastro exige e-mail; por isso entram por SQL): `scripts/demo/accounts.sql`
   — local: `psql "$DATABASE_URL" -f scripts/demo/accounts.sql`; produção: SQL Editor do Supabase.
2. Roteiro: `DEMO_BASE_URL=https://… DEMO_ADMIN_EMAIL=… DEMO_ADMIN_PASSWORD=… node scripts/demo/scenario.mjs`
   (uma vez por ambiente: cada execução cadastra obras novas; o freio de propostas por IP é 10/h).

Logins de demonstração (senha `Demo-HouseArt-2026`): joana.demo@ (artista) · marta.demo@ (artista) ·
ana.demo@ (galeria, admin) · caio.demo@ (galeria, vendas) · helena.demo@ (consultora) ·
marina.demo@, marcelo.demo@, lia.demo@ (colecionadores) · rui.demo@ (avaliador) — todos `@houseart.test`.
Os CPFs são de teste (dígitos válidos, não pertencem a ninguém); os cartões são os números de teste do Stripe.
