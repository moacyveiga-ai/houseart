// Central de Ajuda (/e/help): six short articles written from what the product does today —
// each sentence was checked against the code it describes (lib/certificates, lib/offers,
// lib/payments/async-core, lib/deals, lib/stripe/connect-server, lib/ownership,
// lib/physical-markers). A number that lives in a constant is read from it, never copied.
import { VALIDITY_HOURS } from '@/lib/payment-methods/domain'
import { BOLETO_DAYS, PIX_TTL_SECONDS } from '@/lib/payments/async-core'
import { RESALE_ROYALTY_BPS } from '@/lib/resale-royalty/core'
import type { ReadBlock } from './reading-core'

export interface HelpArticle { slug: string; icon: string; title: string; lead: string; readMinutes: number; blocks: ReadBlock[] }

const PIX_HOURS = PIX_TTL_SECONDS / 3600
const ROYALTY_PCT = `${RESALE_ROYALTY_BPS / 100}%`

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'certificado',
    icon: 'verified',
    title: 'Como funciona o certificado',
    lead: 'A escritura digital da obra: quem fez, quem é o dono e por onde ela passou.',
    readMinutes: 2,
    blocks: [
      { kind: 'p', text: 'Cada obra autenticada na HouseArt tem um certificado com um número próprio (o ID que começa com HA-). O mesmo número fica gravado numa etiqueta NFC presa no verso da obra.' },
      { kind: 'li', text: 'Assinado digitalmente', sub: 'O certificado é assinado no momento da emissão. Qualquer alteração depois disso deixa de bater com a assinatura.' },
      { kind: 'li', text: 'Versões, nunca edição', sub: 'Quando a obra muda de dono, nasce uma versão nova do certificado, ligada à anterior. As versões antigas ficam guardadas e formam a proveniência.' },
      { kind: 'li', text: 'Verificação pública', sub: 'Qualquer pessoa confere o certificado em houseart › Verificar, pelo ID ou encostando o celular na etiqueta. O nome de um colecionador particular nunca aparece ali.' },
      { kind: 'li', text: 'Selo "Obra Autenticada"', sub: 'Só obra com o selo verde pode ser anunciada no marketplace.' },
      { kind: 'q', text: 'Se a verificação mostrar furto, contestação ou etiqueta violada, não compre a obra e fale com a HouseArt.' },
    ],
  },
  {
    slug: 'proposta',
    icon: 'handshake',
    title: 'Como fazer uma proposta',
    lead: 'Proponha um valor, acompanhe a resposta e feche o negócio com segurança.',
    readMinutes: 3,
    blocks: [
      { kind: 'p', text: 'Nas obras que aceitam propostas, o botão "Fazer oferta" abre cinco etapas: valor, condições, identidade, garantia e revisão. Nas de preço fixo, a compra é direta.' },
      { kind: 'li', text: 'Confirmação por código', sub: 'Mandamos um código ao seu e-mail para confirmar que a proposta é sua.' },
      { kind: 'li', text: 'Validade que você escolhe', sub: `${VALIDITY_HOURS.slice(0, -1).join(', ')} ou ${VALIDITY_HOURS[VALIDITY_HOURS.length - 1]} horas. Se o vendedor não responder nesse prazo, a proposta vence sozinha e a garantia é liberada.` },
      { kind: 'li', text: 'Contraproposta', sub: 'O vendedor pode aceitar, recusar ou responder com outro valor. Você acompanha tudo pelo link da proposta ou em Compras.' },
      { kind: 'li', text: 'Sigilo', sub: 'Ninguém vê quantas propostas a obra recebeu nem os valores dos outros. Não há leilão nem disputa pública.' },
      { kind: 'q', text: 'Proposta aceita vira negócio: daí em diante você acompanha cada etapa em Compras.' },
    ],
  },
  {
    slug: 'pagamento-em-garantia',
    icon: 'lock',
    title: 'Pagamento em garantia',
    lead: 'O dinheiro fica guardado até a obra chegar e você confirmar pela etiqueta.',
    readMinutes: 2,
    blocks: [
      { kind: 'p', text: 'Na HouseArt o vendedor só recebe depois da entrega. Até lá, o valor fica em garantia.' },
      { kind: 'li', text: 'Cartão', sub: 'Na proposta, o valor é reservado no cartão e só é cobrado se o vendedor aceitar. Recusada, vencida ou retirada, a reserva é desfeita.' },
      { kind: 'li', text: 'Pix', sub: `O código vale por ${PIX_HOURS} horas. A confirmação chega sozinha quando o banco avisa.` },
      { kind: 'li', text: 'Boleto', sub: `Vence em ${BOLETO_DAYS} dias. A compensação pode levar até um dia útil depois do pagamento.` },
      { kind: 'li', text: 'Confirmação da entrega', sub: 'Quando a obra chegar, abra o app e encoste o celular na etiqueta do verso. A leitura válida libera o valor e emite a escritura em seu nome.' },
      { kind: 'q', text: 'Garantia que não é paga no prazo cancela o negócio e a obra volta para o marketplace.' },
    ],
  },
  {
    slug: 'receber-uma-venda',
    icon: 'payments',
    title: 'Como recebo uma venda',
    lead: 'O valor da venda chega depois que o comprador confirma a entrega.',
    readMinutes: 2,
    blocks: [
      { kind: 'p', text: 'A divisão do valor (sua parte, a comissão da plataforma, frete, seguro e, na revenda, o direito de sequência do artista) é calculada pela HouseArt e aparece no detalhe de cada venda.' },
      { kind: 'li', text: 'Conta Stripe', sub: 'Na tela "Pix para receber vendas", conecte uma conta Stripe. Com ela ativa, a sua parte é transferida sozinha assim que o negócio é concluído.' },
      { kind: 'li', text: 'Chave Pix', sub: 'Sem conta Stripe, cadastre uma chave Pix no mesmo lugar: a HouseArt faz o repasse por ela.' },
      { kind: 'li', text: 'Galerias', sub: 'Numa galeria, quem conecta a conta de recebimento é a pessoa administradora.' },
      { kind: 'li', text: 'Direito de sequência', sub: `Na revenda de uma obra que valorizou, ${ROYALTY_PCT} da valorização vão para o artista. A plataforma calcula; ninguém digita.` },
    ],
  },
  {
    slug: 'transferencia-fora-da-plataforma',
    icon: 'swap_horiz',
    title: 'Vendi fora da HouseArt: como transfiro a obra',
    lead: 'A escritura passa ao novo dono mesmo quando a venda foi feita por fora.',
    readMinutes: 2,
    blocks: [
      { kind: 'p', text: 'Só quem tem a escritura em seu nome pode transferir. Na sua coleção, abra a obra e toque em "Transferir" (na galeria, o botão é "Vendida fora", na gestão do anúncio).' },
      { kind: 'li', text: 'Convite', sub: 'O comprador recebe um link por e-mail para aceitar a transferência.' },
      { kind: 'li', text: 'Identidade', sub: 'O comprador confirma quem é antes de assinar.' },
      { kind: 'li', text: 'Duas assinaturas', sub: 'Vendedor e comprador assinam o termo de cessão.' },
      { kind: 'li', text: 'Taxa e toque', sub: 'O vendedor paga a taxa de transferência mostrada na tela e o comprador encosta o celular na etiqueta da obra. Só então nasce a versão nova do certificado.' },
      { kind: 'q', text: `Se a obra valorizou, a transferência mostra o direito de sequência do artista (${ROYALTY_PCT} da valorização) antes das assinaturas.` },
    ],
  },
  {
    slug: 'etiqueta',
    icon: 'nfc',
    title: 'Etiqueta NFC: o que fazer se ela for removida',
    lead: 'A etiqueta do verso é a ligação física entre a obra e o certificado.',
    readMinutes: 2,
    blocks: [
      { kind: 'p', text: 'A etiqueta é um chip que confirma, a cada leitura, que é ela mesma — não uma cópia. Se alguém a arrancar ou violar, a leitura seguinte indica isso.' },
      { kind: 'li', text: 'Na verificação', sub: 'A página mostra "Etiqueta não confirmada" quando a leitura indica violação ou remoção do chip.' },
      { kind: 'li', text: 'Revisão da equipe', sub: 'A HouseArt abre uma revisão da obra e analisa o caso. Sem uma etiqueta válida, nenhuma venda chega ao fim: a entrega só se confirma com a leitura do chip.' },
      { kind: 'li', text: 'O que você faz', sub: 'Não tente colar ou trocar a etiqueta. Fale com a HouseArt e informe o ID da obra.' },
      { kind: 'q', text: 'Furto ou perda? Fale com a HouseArt e informe o ID da obra.' },
    ],
  },
]

export const helpArticle = (slug: string): HelpArticle | null => HELP_ARTICLES.find((a) => a.slug === slug) ?? null
