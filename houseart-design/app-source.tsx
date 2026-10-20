
const RS = (k) => (window.__resources && window.__resources['img-' + k]) || ('img/ha-' + k + '.png');
const IMG = {
  mSup: RS('mSup'),
  k8: RS('k8'),
  mAir: RS('mAir'),
  mAbs: RS('mAbs'),
  hAlt: RS('hAlt'),
  hSvan: RS('hSvan'),
  verso: RS('verso'),
};
const ST = {
  aut: { nome: 'Autenticada', icon: 'verified', bg: 'var(--ha-verified-100)', fg: 'var(--ha-verified-500)' },
  cert: { nome: 'Em certificação', icon: 'schedule', bg: 'var(--ha-pending-100)', fg: 'var(--ha-ink-900)' },
  venda: { nome: 'À venda', icon: 'storefront', bg: 'var(--ha-paper-200)', fg: 'var(--ha-ink-900)' },
  vend: { nome: 'Vendida', icon: 'sell', bg: 'var(--ha-ink-900)', fg: 'var(--ha-paper-50)' },
  rasc: { nome: 'Rascunho', icon: 'edit_note', bg: 'var(--ha-paper-100)', fg: 'var(--ha-ink-500)' },
};
const OBRAS = [
  { id: 'a', src: IMG.mSup, titulo: 'Construção para um dia claro', ano: 2025, tecnica: 'Óleo sobre linho', dim: '100 × 80 cm', preco: 'R$ 38.000', st: 'venda' },
  { id: 'b', src: IMG.mAir, titulo: 'Voo baixo', ano: 2024, tecnica: 'Óleo sobre linho', dim: '120 × 100 cm', preco: 'R$ 44.000', st: 'venda' },
  { id: 'c', src: IMG.mAbs, titulo: 'Estudo em vermelho', ano: 2025, tecnica: 'Óleo sobre papel', dim: '50 × 50 cm', preco: 'R$ 9.800', st: 'cert' },
  { id: 'd', src: IMG.hSvan, titulo: 'Maré de março', ano: 2026, tecnica: 'Têmpera sobre tela', dim: '90 × 90 cm', preco: '—', st: 'rasc' },
  { id: 'e', src: IMG.k8, titulo: 'Partitura para Itapuã', ano: 2023, tecnica: 'Óleo sobre tela', dim: '140 × 200 cm', preco: 'R$ 46.500', st: 'vend' },
  { id: 'f', src: IMG.hAlt, titulo: 'Retábulo do Rio Vermelho', ano: 2023, tecnica: 'Acrílica e folha de ouro', dim: '140 × 105 cm', preco: 'R$ 46.000', st: 'aut' },
  { id: 'g', src: IMG.mSup, titulo: 'Janela para o Carmo', ano: 2024, tecnica: 'Óleo sobre linho', dim: '60 × 48 cm', preco: 'R$ 16.000', st: 'aut' },
  { id: 'h', src: IMG.mAir, titulo: 'Céu de Ondina', ano: 2025, tecnica: 'Óleo sobre linho', dim: '80 × 64 cm', preco: 'R$ 21.000', st: 'cert' },
];
const NAV = {
  artista: [['inicio', 'Início', 'space_dashboard'], ['obras', 'Minhas obras', 'imagesmode'], ['nova', 'Nova obra', 'add_photo_alternate'], ['cert', 'Certificação', 'verified', 2], ['vendas', 'Vendas e ofertas', 'handshake', 3], ['sequencia', 'Direito de sequência', 'autorenew'], ['cobranca', 'Cobrança', 'receipt_long']],
  galeria: [['inicio', 'Início', 'space_dashboard'], ['obras', 'Inventário', 'inventory_2'], ['nova', 'Nova obra', 'add_photo_alternate'], ['cert', 'Certificação', 'verified', 5], ['vendas', 'Vendas e ofertas', 'handshake', 3], ['crm', 'Colecionadores', 'view_kanban'], ['sequencia', 'Direito de sequência', 'autorenew'], ['cobranca', 'Cobrança', 'receipt_long']],
  colecionador: [['carteira', 'Carteira de escrituras', 'account_balance_wallet'], ['compras', 'Compras', 'local_shipping', 1], ['transferir', 'Transferir obra', 'swap_horiz'], ['market', 'Marketplace', 'storefront']],
  avaliador: [['laudos', 'Fila de laudos', 'assignment', 4]],
  admin: [['admin', 'Obras e certificados', 'fact_check', 6], ['tags', 'Etiquetas', 'sell'], ['cobranca', 'Cobrança', 'receipt_long']],
};
const USR = { artista: ['JT', 'Artista'], galeria: ['GL', 'Galeria Ladeira'], colecionador: ['MB', 'Colecionador'], avaliador: ['RA', 'Prestador · avaliador'], admin: ['HA', 'Admin HouseArt'] };
const PASSOS = ['Ficha técnica', 'Mídia', 'Condition report', 'Histórico', 'Preço e disponibilidade', 'Revisão'];
const ETAPAS_TL = [
  ['Oferta aceita', 'Preço fixo, sem negociação', '14/10', 'handshake'],
  ['Pagamento em garantia', 'Pix confirmado · valor retido na HouseArt', '14/10', 'lock'],
  ['Documentação e assinatura', 'Termo de transferência assinado pelas partes', '15/10', 'draw'],
  ['Retirada e transporte', 'Alves Tegam retirou na galeria · em trânsito para São Paulo', '17/10', 'local_shipping'],
  ['Entrega e leitura da etiqueta', 'Comprador encosta o celular no verso para confirmar', 'previsto 21/10', 'contactless'],
  ['Escritura emitida', 'Novo titular registrado e valores liberados', '—', 'contract'],
];
class Component extends DCLogic {
  state = { auth: 'login', perfil: 'artista', tela: 'inicio', passo: 0, dup: true, modal: 1, filtro: 'todas', sel: {}, qtd: 10, pedido: false, certs: { c: 3, h: 1, d: 0, a: 5, f: 5 }, assinando: null, assinStep: 0, aba: 'of', ofertas: {}, toast: '' };
  componentDidMount() { const k = (window.location.hash || '').replace('#', ''); if (NAV[k]) this.setState({ auth: 'in', perfil: k, tela: NAV[k][0][0] }); }
  componentWillUnmount() { clearTimeout(this.tt); clearTimeout(this.ta); }
  aviso(t) { clearTimeout(this.tt); this.setState({ toast: t }); this.tt = setTimeout(() => this.setState({ toast: '' }), 2600); }
  ir(tela) { this.setState({ tela }); window.scrollTo(0, 0); }
  extra(s, c) {
    const { ink, paper, brl, IMG } = c;
    const e = React.createElement;
    const ok = (bg, fg, st) => ({ bg, fg, st });
    const kp = (a) => a.map(([rotulo, valor, nota]) => ({ rotulo, valor, nota }));
    const gal = s.perfil === 'galeria';
    const WAL = [
      { src: IMG.k8, titulo: 'Partitura para Itapuã, 2023', artista: 'Rafael Moura', data: '04/08/2025', valor: 'R$ 46.500', id: 'HA-2025-9W1C-3RTE', apolice: 'Chubb · nº 77120-4 · vigente', st: 'Segurada', stBg: 'var(--ha-verified-100)', stFg: 'var(--ha-verified-500)' },
      { src: IMG.hAlt, titulo: 'Retábulo do Rio Vermelho, 2023', artista: 'Tomás Rezende', data: '11/01/2026', valor: 'R$ 46.000', id: 'HA-2025-4HHQ-7NZB', apolice: 'Sem apólice', st: 'Sem seguro', stBg: 'var(--ha-pending-100)', stFg: 'var(--ha-ink-900)' },
      { src: IMG.hSvan, titulo: 'Duas luas, 2024', artista: 'Clara Bittencourt', data: '02/03/2026', valor: 'R$ 24.500', id: 'HA-2026-1KDF-8PLM', apolice: 'Chubb · nº 77120-4 · vigente', st: 'Segurada', stBg: 'var(--ha-verified-100)', stFg: 'var(--ha-verified-500)' },
      { src: IMG.mAbs, titulo: 'Estudo em vermelho, 2025', artista: 'Joana Teixeira', data: '30/06/2026', valor: 'Preço selado', id: 'HA-2025-2P8D-4LXA', apolice: 'Tokio Marine · nº 3301-88 · vigente', st: 'Segurada', stBg: 'var(--ha-verified-100)', stFg: 'var(--ha-verified-500)' },
    ];
    const ws = WAL[s.wSel || 0];
    const tlC = s.recebido ? 6 : 4;
    const ETC = [['Oferta aceita', 'Compra a preço fixo', '14/10', 'handshake'], ['Pagamento em garantia', 'Pix · R$ 39.110 retidos na HouseArt', '14/10', 'lock'], ['Documentação e assinatura', 'Termo de transferência assinado', '15/10', 'draw'], ['Retirada e transporte', 'Alves Tegam · AT-88213-BA', '17/10', 'local_shipping'], ['Entrega e leitura da etiqueta', s.recebido ? 'Leitura válida · posse confirmada' : 'Previsto para 21/10', s.recebido ? '19/10' : '—', 'contactless'], ['Escritura emitida', s.recebido ? 'Você é o novo titular' : 'Após a leitura da etiqueta', s.recebido ? '19/10' : '—', 'contract']];
    const tr = s.tr || 0;
    const fila = [
      ['dup', 'Duplicidade', IMG.mAir, 'Céu de Ondina, 2025', 'Joana Teixeira', 'Imagem 91% semelhante a “Voo baixo”', 'há 2 h', 'var(--ha-pending-100)', ink],
      ['cont', 'Contestação', IMG.hAlt, 'Retábulo do Rio Vermelho', 'Tomás Rezende', 'Herdeiro alega titularidade anterior', 'há 1 dia', 'var(--ha-alert-100)', 'var(--ha-alert-500)'],
      ['kyc', 'Emissor novo', IMG.hSvan, '12 obras em lote', 'Ateliê Pedra Lisa, Cachoeira/BA', 'Primeiro lote · KYC aprovado, conferir portfólio', 'há 3 h', 'var(--ha-paper-200)', ink],
      ['rem', 'Etiqueta removida', IMG.mSup, 'Janela para o Carmo, 2024', 'Colecionador particular', 'Leitura indicou violação do chip', 'há 20 min', 'var(--ha-alert-500)', paper],
      ['iphan', 'Restrição IPHAN', IMG.k8, 'Paisagem com igreja, séc. XIX', 'Galeria Ladeira', 'Possível bem tombado · exportação bloqueada', 'há 4 dias', 'var(--ha-paper-200)', ink],
    ];
    const rv = s.rev || {};
    return {
      seqKpis: kp([['Recebido em 2026', 'R$ 4.380', '2 revendas'], ['A receber', 'R$ 275', '1 transferência em curso'], ['Obras revendidas', '3', 'desde a primeira certificação']]),
      seq: [['19/10/2026', IMG.k8, 'Partitura para Itapuã', 'R$ 52.000', 'R$ 5.500', 'R$ 275', 'A receber'], ['02/07/2026', IMG.mAbs, 'Estudo em vermelho', 'R$ 14.000', 'R$ 4.200', 'R$ 210', 'Repassado'], ['11/01/2026', IMG.hAlt, 'Retábulo do Rio Vermelho', 'R$ 46.000', 'R$ 18.000', 'R$ 900', 'Repassado'], ['04/08/2025', IMG.k8, 'Partitura para Itapuã', 'R$ 46.500', 'R$ 12.500', 'R$ 625', 'Repassado']].map(([data, src, titulo, venda, valoriz, repasse, st]) => ({ data, src, titulo, venda, valoriz, repasse, st, bg: st === 'Repassado' ? 'var(--ha-verified-100)' : 'var(--ha-pending-100)', fg: st === 'Repassado' ? 'var(--ha-verified-500)' : ink })),
      plano: gal ? { nome: 'Galeria Pro', desc: 'Certificação em lote a R$ 99, viewing rooms ilimitados, CRM e exportação assistida.', preco: 'R$ 899' } : { nome: 'Ateliê', desc: 'Obras ilimitadas, perfil público, negociador automático e relatórios.', preco: 'R$ 49' },
      uso: (gal ? [['Certificações no mês', 18, 40], ['Viewing rooms ativos', 3, 10], ['Assentos da equipe', 4, 5]] : [['Obras cadastradas', 38, 60], ['Etiquetas disponíveis', 7, 10], ['Laudos incluídos', 0, 1]]).map(([nome, a, b]) => ({ nome, txt: a + ' de ' + b, pct: Math.round((a / b) * 100) + '%' })),
      faturas: [['01/10/2026', gal ? 'Plano Galeria Pro · outubro' : 'Plano Ateliê · outubro', gal ? 'R$ 899,00' : 'R$ 49,00', 'Paga'], ['14/10/2026', 'Comissão 12% · Construção para um dia claro', 'R$ 4.560,00', 'Retida no split'], ['08/10/2026', '10 etiquetas de autenticação', 'R$ 150,00', 'Paga'], ['22/09/2026', 'Certificação · 3 obras', gal ? 'R$ 297,00' : 'R$ 447,00', 'Paga'], ['01/09/2026', gal ? 'Plano Galeria Pro · setembro' : 'Plano Ateliê · setembro', gal ? 'R$ 899,00' : 'R$ 49,00', 'Paga']].map(([data, desc, valor, st]) => ({ data, desc, valor, st, bg: st === 'Paga' ? 'var(--ha-verified-100)' : 'var(--ha-paper-200)', fg: st === 'Paga' ? 'var(--ha-verified-500)' : ink })),
      kanban: [['Interessados', [['AP', 'Ana Paes', 'Consultora · abstração brasileira', 'até R$ 60 mil', 'hoje'], ['LM', 'Luiza Moreno', 'Primeira obra · Salvador', 'até R$ 20 mil', 'ontem'], ['FC', 'Fundação Caramuru', 'Acervo institucional', 'sob consulta', '3 dias']]], ['Em conversa', [['RS', 'Ricardo Sá', 'Viu “Voo baixo” no viewing room', 'R$ 44 mil', 'hoje'], ['TB', 'Tereza Barreto', 'Coleciona têmpera', 'R$ 25 mil', '2 dias']]], ['Proposta', [['MB', 'Marcelo Bastos', 'Oferta em “Retábulo”', 'R$ 45 mil', '23 h']]], ['Fechado', [['CV', 'Carla Vieira', 'Comprou “Dia claro”', 'R$ 38 mil', '14/10'], ['JN', 'João Neto', 'Comprou 2 obras em papel', 'R$ 19,6 mil', '02/10']]]].map(([nome, cards]) => ({ nome, n: cards.length, cards: cards.map(([ini, nm, interesse, valor, quando]) => ({ ini, nome: nm, interesse, valor, quando })) })),
      carteira: WAL.map((w, i) => ({ ...w, borda: i === (s.wSel || 0) ? ink : 'var(--ha-paper-200)', go: () => this.setState({ wSel: i }) })),
      wSel: ws,
      irTransferir: () => this.setState({ tela: 'transferir', tr: 0 }),
      irVenderObra: () => this.aviso('Obra listada no mercado secundário · comissão 8% + 4%'),
      segurarObra: () => this.aviso('Cotação de seguro enviada · Chubb e Tokio Marine'),
      avaliarObra: () => this.aviso('Laudo solicitado · avaliador credenciado em até 5 dias'),
      timelineC: ETC.map(([nome, desc, data, icon], i) => ({ nome, desc, data, icon, bg: i < tlC ? ink : i === tlC ? 'var(--ha-sand-500)' : paper, fg: i < tlC ? paper : ink, borda: i <= tlC ? 'transparent' : 'var(--ha-ink-300)', linha: i === 5 ? 'transparent' : i < tlC ? ink : 'var(--ha-paper-200)', cor: i <= tlC ? ink : 'var(--ha-ink-500)' })),
      recebPend: !s.recebido,
      recebCor: s.recebido ? 'var(--ha-verified-500)' : 'var(--ha-ink-900)', recebIcon: s.recebido ? 'check' : 'contactless',
      recebTitulo: s.recebido ? 'Escritura emitida em seu nome' : 'A obra chegou?',
      recebTexto: s.recebido ? 'A obra entrou na sua carteira e o pagamento foi liberado à galeria.' : 'Abra o app e encoste o celular na etiqueta do verso. A leitura confirma a posse.',
      confirmarReceb: () => { this.setState({ recebido: true }); this.aviso('Leitura válida · escritura transferida'); },
      trPassos: ['Comprador', 'Valor', 'Assinaturas', 'Toque do comprador'].map((nome, i) => ({ nome, cor: i <= tr ? ink : 'var(--ha-paper-200)', fg: i <= tr ? ink : 'var(--ha-ink-500)', peso: i === tr ? 600 : 400 })),
      tr0: tr === 0, tr1: tr === 1, tr2: tr === 2, tr3: tr === 3,
      seladoBg: s.selado ? ink : 'var(--ha-ink-300)', seladoX: s.selado ? '21px' : '3px', toggleSelado: () => this.setState({ selado: !s.selado }),
      trVoltar: () => (tr === 0 ? this.ir('carteira') : this.setState({ tr: tr - 1 })),
      trAvancar: () => { if (tr < 3) this.setState({ tr: tr + 1 }); else { this.setState({ tela: 'carteira', tr: 0 }); this.aviso('Taxa paga · aguardando o toque da compradora'); } },
      trAvTxt: tr === 3 ? 'Pagar R$ 199 e concluir' : 'Continuar',
      anelTr: e('div', { style: { position: 'relative', width: 96, height: 96, flex: 'none' } }, e('span', { style: { position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid var(--ha-sand-500)', animation: 'ha-pulse 1200ms ease-out infinite' } }), e('span', { style: { position: 'absolute', inset: 20, borderRadius: '50%', background: 'var(--ha-sand-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Material Symbols Rounded', fontSize: 28, color: 'var(--ha-ink-900)' } }, 'contactless')),
      marketObras: [[IMG.mSup, 'Joana Teixeira', 'Construção para um dia claro', 2025, 'R$ 38.000'], [IMG.mAir, 'Joana Teixeira', 'Voo baixo', 2024, 'R$ 44.000'], [IMG.hSvan, 'Clara Bittencourt', 'Duas luas', 2024, 'R$ 24.500'], [IMG.hAlt, 'Tomás Rezende', 'Retábulo do Rio Vermelho', 2023, 'R$ 46.000'], [IMG.mAbs, 'Joana Teixeira', 'Estudo em vermelho', 2025, 'R$ 9.800'], [IMG.k8, 'Rafael Moura', 'Correnteza', 2026, 'R$ 31.000']].map(([src, artista, titulo, ano, preco]) => ({ src, artista, titulo, ano, preco })),
      laudos: [[IMG.k8, 'Partitura para Itapuã', 'Marcelo Bastos', '24/10', 'Rafael Moura · Óleo sobre tela · 140 × 200 cm · 2023'], [IMG.hAlt, 'Retábulo do Rio Vermelho', 'Marcelo Bastos', '27/10', 'Tomás Rezende · Acrílica e folha de ouro · 140 × 105 cm · 2023'], [IMG.mAir, 'Voo baixo', 'Galeria Ladeira', '30/10', 'Joana Teixeira · Óleo sobre linho · 120 × 100 cm · 2024'], [IMG.hSvan, 'Duas luas', 'Seguradora Chubb', '02/11', 'Clara Bittencourt · Têmpera sobre tela · 90 × 90 cm · 2024']].map(([src, titulo, quem, prazo, ficha], i) => ({ src, titulo, quem, prazo, ficha, bg: i === (s.lSel || 0) ? 'var(--ha-paper-100)' : 'transparent', go: () => this.setState({ lSel: i }) })),
      laudoSel: (() => { const L = [[IMG.k8, 'Partitura para Itapuã', 'Rafael Moura · Óleo sobre tela · 140 × 200 cm · 2023'], [IMG.hAlt, 'Retábulo do Rio Vermelho', 'Tomás Rezende · Acrílica e folha de ouro · 140 × 105 cm · 2023'], [IMG.mAir, 'Voo baixo', 'Joana Teixeira · Óleo sobre linho · 120 × 100 cm · 2024'], [IMG.hSvan, 'Duas luas', 'Clara Bittencourt · Têmpera sobre tela · 90 × 90 cm · 2024']][s.lSel || 0]; return { src: L[0], titulo: L[1], ficha: L[2] }; })(),
      comparaveis: [['Rafael Moura · Maré cheia, 2022 · leilão', '130 × 180', 'R$ 44.000', '05/2026'], ['Rafael Moura · Cais, 2021 · galeria', '100 × 150', 'R$ 36.000', '11/2025'], ['Rafael Moura · Partitura II, 2023 · HouseArt', '140 × 200', 'R$ 52.000', '10/2026']].map(([obra, dim, valor, data]) => ({ obra, dim, valor, data })),
      emitirLaudo: () => this.aviso('Laudo assinado e emitido · enviado ao titular'),
      admKpis: kp([['Obras certificadas', '18.402', '+1.240 em outubro'], ['Na fila de revisão', String(fila.filter((f) => !rv[f[0]]).length), 'tempo médio 6 h'], ['Contestações abertas', '3', '0,02% das obras']]),
      fila: fila.map(([k, tipo, src, titulo, quem, motivo, quando, bg, fg]) => ({ tipo, src, titulo, quem, motivo, quando, bg, fg, aberto: !rv[k], resolvido: !!rv[k], res: rv[k] === 'ok' ? 'Aprovado' : 'Rejeitado', aprovar: () => this.setState({ rev: { ...rv, [k]: 'ok' } }), rejeitar: () => this.setState({ rev: { ...rv, [k]: 'no' } }) })),
      tagKpis: kp([['Em estoque', '6.200', 'lote 2026-11 chega em 30/10'], ['Vinculadas', '18.402', '98,6% das enviadas'], ['Alertas de remoção', '1', 'hoje']]),
      lotes: [['2026-10', '2.000', 'Envios avulsos · artistas', 1310, 2000, 'Em uso'], ['2026-09', '500', 'Galeria Ladeira, Salvador/BA', 420, 500, 'Em uso'], ['2026-08', '1.000', 'Galerias SP · 14 destinos', 1000, 1000, 'Esgotado'], ['2026-07', '300', 'Ateliê Pedra Lisa, Cachoeira/BA', 12, 300, 'Novo emissor'], ['2026-06', '2.000', 'Envios avulsos · artistas', 1998, 2000, 'Esgotado']].map(([lote, qtd, destino, a, b, st]) => ({ lote, qtd, destino, vinc: a.toLocaleString('pt-BR'), pct: Math.round((a / b) * 100) + '%', st, bg: st === 'Esgotado' ? 'var(--ha-paper-200)' : st === 'Novo emissor' ? 'var(--ha-pending-100)' : 'var(--ha-verified-100)', fg: st === 'Em uso' ? 'var(--ha-verified-500)' : ink })),
    };
  }
  renderVals() {
    const s = this.state; const P = s.perfil; const ink = 'var(--ha-ink-900)', paper = 'var(--ha-paper-50)';
    const t = {}; ['inicio', 'obras', 'nova', 'cert', 'vendas', 'sequencia', 'cobranca', 'crm', 'carteira', 'compras', 'transferir', 'market', 'laudos', 'admin', 'tags'].forEach((k) => (t[k] = s.tela === k));
    const gal = P === 'galeria';
    const cont = { todas: OBRAS.length }; OBRAS.forEach((o) => (cont[o.st] = (cont[o.st] || 0) + 1));
    const certStage = (id) => s.certs[id] ?? (OBRAS.find((o) => o.id === id).st === 'rasc' ? 0 : 5);
    const stDe = (o) => { const c = s.certs[o.id]; if (o.st === 'cert' && c === 5) return ST.aut; return ST[o.st]; };
    const nSel = Object.keys(s.sel).filter((k) => s.sel[k]).length;
    const spin = (c) => React.createElement('span', { style: { width: 14, height: 14, borderRadius: '50%', border: '2px solid ' + c, borderTopColor: 'transparent', display: 'inline-block', animation: 'ha-spin 700ms linear infinite' } });
    const certItens = ['c', 'h', 'd', 'a', 'f'].map((id) => OBRAS.find((o) => o.id === id));
    const acaoDe = (n) => n <= 1 ? ['Aguardar etiqueta', 'none'] : n === 2 ? ['Vincular no app', 'app'] : n === 3 ? ['Assinar', 'assinar'] : n === 4 ? ['Emitir', 'emitir'] : ['Ver certificado', 'ver'];
    const ofBase = [
      { id: 1, src: IMG.mAir, titulo: 'Voo baixo, 2024', quem: 'Colecionador verificado, Recife/PE', expira: '2 dias', v: 41000, p: 44000 },
      { id: 2, src: IMG.mSup, titulo: 'Construção para um dia claro, 2025', quem: 'Consultora Ana Paes, para cliente', expira: '5 dias', v: 34000, p: 38000 },
      { id: 3, src: IMG.hAlt, titulo: 'Retábulo do Rio Vermelho, 2023', quem: 'Colecionador verificado, São Paulo/SP', expira: '23 h', v: 45000, p: 46000 },
    ];
    const brl = (n) => 'R$ ' + n.toLocaleString('pt-BR');
    const tlAtual = 3;
    const base = {
      img: IMG, t,
      telaLogin: s.auth === 'login', telaPerfil: s.auth === 'perfil', logado: s.auth === 'in',
      entrar: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ auth: 'perfil' }); },
      sair: () => this.setState({ auth: 'login' }),
      trocarPerfil: () => this.setState({ auth: 'perfil' }),
      perfis: [
        ['artista', 'Artista', 'palette', 'Cadastre e certifique suas obras, venda e receba o direito de sequência.'],
        ['galeria', 'Galeria', 'storefront', 'Inventário, artistas representados, consignações, viewing rooms e CRM.'],
        ['colecionador', 'Colecionador', 'account_balance_wallet', 'Sua carteira de escrituras: compre, transfira, segure e avalie.'],
        ['avaliador', 'Prestador de serviço · avaliador', 'query_stats', 'Fila de laudos, dossiê da obra e emissão do laudo assinado.'],
        ['galeria', 'Consultor de arte', 'support_agent', 'Clientes, propostas em nome deles e parcerias com galerias.'],
        ['admin', 'Equipe HouseArt', 'admin_panel_settings', 'Revisão de certificados, etiquetas, transações e compliance.'],
      ].map(([k, nome, icon, desc]) => ({ nome, icon, desc, go: () => { const first = NAV[k][0][0]; this.setState({ auth: 'in', perfil: k, tela: first }); } })),
      usuario: { ini: USR[P][0], perfil: USR[P][1] },
      nav: NAV[P].map(([k, nome, icon, badge]) => ({ nome, icon, badge: badge || null, bg: s.tela === k ? 'var(--ha-paper-200)' : 'transparent', fg: s.tela === k ? ink : 'var(--ha-ink-700)', peso: s.tela === k ? 600 : 500, go: () => this.ir(k) })),
      irNova: () => this.setState({ tela: 'nova', passo: 0 }), irObras: () => this.ir('obras'), irCert: () => this.ir('cert'),
      dash: {
        saudacao: gal ? 'Bom dia, Galeria Ladeira' : 'Bom dia, Joana',
        kpis: gal
          ? [['Obras em inventário', '212', '31 em consignação'], ['Certificadas', '164', '77% do inventário'], ['GMV em 2026', 'R$ 1,9 mi', '+18% sobre 2025'], ['Ofertas abertas', '9', '3 expiram esta semana']].map(([rotulo, valor, nota]) => ({ rotulo, valor, nota }))
          : [['Obras certificadas', '38', '2 aguardando assinatura'], ['À venda', '6', '2 no marketplace, 4 na galeria'], ['Vendidas em 2026', '11', 'R$ 268 mil no total'], ['Direito de sequência', 'R$ 4.380', 'recebido em 2 revendas']].map(([rotulo, valor, nota]) => ({ rotulo, valor, nota })),
        acoes: [
          ['draw', 'Assinar certificado', 'Estudo em vermelho · etiqueta já vinculada', 'var(--ha-sand-100)', ink, () => this.ir('cert')],
          ['handshake', 'Responder oferta de R$ 41.000', 'Voo baixo · expira em 2 dias', 'var(--ha-paper-200)', ink, () => this.ir('vendas')],
          ['add_a_photo', 'Enviar foto do verso', 'Maré de março · rascunho', 'var(--ha-paper-200)', ink, () => this.setState({ tela: 'nova', passo: 1 })],
          ['contactless', 'Vincular 1 etiqueta', 'Céu de Ondina · use o app no celular', 'var(--ha-paper-200)', ink, () => this.ir('cert')],
        ].map(([icon, titulo, sub, bg, fg, go]) => ({ icon, titulo, sub, bg, fg, go })),
        vendasTotal: gal ? 'R$ 1,9 mi em 131 obras' : 'R$ 268 mil em 11 obras',
        barras: [['jan', 1], ['fev', 0], ['mar', 2], ['abr', 3], ['mai', 1], ['jun', 0], ['jul', 1], ['ago', 2], ['set', 0], ['out', 1]].map(([m, v], i) => ({ m, v: gal ? v * 12 + 3 : v, h: Math.max(4, (v / 3) * 150) + 'px', cor: i === 9 ? 'var(--ha-sand-500)' : ink })),
      },
      recentes: OBRAS.slice(0, 4).map((o) => ({ ...o, st: stDe(o) })),
      obrasTitulo: gal ? 'Inventário' : 'Minhas obras',
      filtros: [['todas', 'Todas'], ['aut', 'Autenticadas'], ['cert', 'Em certificação'], ['venda', 'À venda'], ['vend', 'Vendidas'], ['rasc', 'Rascunhos']].map(([k, nome]) => ({ nome, n: cont[k] || 0, bg: s.filtro === k ? ink : 'transparent', fg: s.filtro === k ? paper : ink, borda: s.filtro === k ? ink : 'var(--ha-ink-300)', go: () => this.setState({ filtro: k }) })),
      obrasVis: OBRAS.filter((o) => s.filtro === 'todas' || o.st === s.filtro).map((o) => ({ ...o, st: stDe(o), chk: s.sel[o.id] ? 'check' : '', chkBg: s.sel[o.id] ? ink : 'rgba(251,250,247,.9)', outline: s.sel[o.id] ? '2px solid var(--ha-ink-900)' : 'none', toggle: () => this.setState((x) => ({ sel: { ...x.sel, [o.id]: !x.sel[o.id] } })) })),
      temSel: nSel > 0, selTxt: nSel + (nSel === 1 ? ' obra selecionada' : ' obras selecionadas'),
      limparSel: () => this.setState({ sel: {} }), listarSel: () => { this.setState({ sel: {} }); this.aviso('Obras listadas no marketplace'); },
      passos: PASSOS.map((nome, i) => ({ nome, marca: i < s.passo ? '✓' : String(i + 1), bg: i < s.passo ? ink : i === s.passo ? 'var(--ha-sand-500)' : 'transparent', fg: i < s.passo ? paper : ink, borda: i <= s.passo ? 'transparent' : 'var(--ha-ink-300)', peso: i === s.passo ? 600 : 400, cor: i <= s.passo ? ink : 'var(--ha-ink-500)', go: () => this.setState({ passo: i }) })),
      passoNome: PASSOS[s.passo], p0: s.passo === 0, p1: s.passo === 1, p2: s.passo === 2, p3: s.passo === 3, p4: s.passo === 4, p5: s.passo === 5,
      campos: [['Título', 'Maré de março', '', '1 / -1'], ['Ano', '2026', '', 'auto'], ['Técnica', 'Têmpera sobre tela', '', 'auto'], ['Materiais', 'Têmpera de ovo, pigmentos, tela de algodão', '', '1 / -1'], ['Altura (cm)', '90', '', 'auto'], ['Largura (cm)', '90', '', 'auto'], ['Profundidade (cm)', '', '3,5', 'auto'], ['Edição / tiragem', 'Obra única', '', 'auto'], ['Assinatura', 'Verso, canto inferior esquerdo', '', 'auto'], ['Série', 'Marés', '', 'auto']].map(([rotulo, valor, ph, col]) => ({ rotulo, valor, ph, col })),
      fecharDup: () => this.setState({ dup: false }), dupOn: s.dup,
      midias: [['Frontal com cartão de cor', IMG.hSvan, 'none', 'center', 'Boa'], ['Verso', IMG.verso, 'none', 'center', 'Boa'], ['Macro 1 · sup. esq.', IMG.hSvan, 'scale(3)', '15% 15%', 'Boa'], ['Macro 2 · sup. dir.', IMG.hSvan, 'scale(3)', '85% 15%', 'Desfocada'], ['Macro 3 · inf. esq.', '', '', '', ''], ['Macro 4 · inf. dir.', '', '', '', '']].map(([nome, src, tf, or, q]) => ({ nome, src, tf, or, q: q || 'Pendente', tem: !!src, vazio: !src, bg: src ? 'var(--ha-wall)' : 'var(--ha-paper-50)', traco: src ? 'solid' : 'dashed', qCor: q === 'Boa' ? 'var(--ha-verified-500)' : q ? 'var(--ha-alert-500)' : 'var(--ha-ink-500)' })),
      regioes: [['Superior esquerda', '15% 15%', 'Sem alterações', 'Íntegra'], ['Superior direita', '85% 15%', 'Microcraquelado leve no branco', 'Atenção'], ['Centro', '50% 50%', 'Sem alterações', 'Íntegra'], ['Inferior esquerda', '15% 85%', 'Assinatura no verso, visível por transparência', 'Íntegra'], ['Bordas e chassi', '50% 95%', 'Grampos inox, tela bem esticada', 'Íntegra']].map(([nome, or, nota, estado]) => ({ nome, or, nota, estado, bg: estado === 'Íntegra' ? 'var(--ha-verified-100)' : 'var(--ha-pending-100)', fg: estado === 'Íntegra' ? 'var(--ha-verified-500)' : ink })),
      historico: [['Exposição', 'Coletiva “Marés”, Museu de Arte Moderna da Bahia', '03/2026'], ['Publicação', 'Catálogo “Marés”, p. 42', '03/2026'], ['Prêmio', 'Menção honrosa, Salão de Artes Visuais da Bahia', '11/2025']].map(([tipo, desc, data]) => ({ tipo, desc, data })),
      modalidades: [['fixo', 'Preço fixo', 'O comprador paga o valor e a venda segue direto.'], ['oferta', 'Preço fixo e aceitar ofertas', 'Você recebe propostas; o negociador responde pela sua alçada.'], ['consulta', 'Sob consulta', 'O preço não aparece; interessados pedem contato.']].map(([k, nome, desc], i) => ({ nome, desc, borda: s.modal === i ? ink : 'var(--ha-paper-200)', radio: s.modal === i ? '6px solid var(--ha-ink-900)' : '1px solid var(--ha-ink-300)', go: () => this.setState({ modal: i }) })),
      revisao: [['Título', 'Maré de março, 2026'], ['Técnica', 'Têmpera sobre tela'], ['Dimensões', '90 × 90 × 3,5 cm'], ['Edição', 'Obra única'], ['Mídia', '4 de 6 fotos · 2 macros pendentes'], ['Condition report', 'Excelente · 1 ponto de atenção'], ['Preço', 'R$ 21.000 · aceita ofertas']].map(([k, v]) => ({ k, v })),
      voltarPasso: () => (s.passo === 0 ? this.ir('obras') : this.setState({ passo: s.passo - 1 })),
      avancarPasso: () => { if (s.passo < 5) this.setState({ passo: s.passo + 1 }); else { this.setState({ tela: 'cert', certs: { ...s.certs, d: 1 } }); this.aviso('Maré de março enviada para certificação'); } },
      avancarTxt: s.passo === 5 ? 'Enviar para certificação' : 'Continuar',
      qtdTag: s.qtd, menosTag: () => this.setState({ qtd: Math.max(1, s.qtd - 1) }), maisTag: () => this.setState({ qtd: s.qtd + 1 }),
      pedirTxt: s.pedido ? 'Pedido enviado' : 'Pedir etiquetas · ' + brl(s.qtd * 15),
      pedirTags: () => { this.setState({ pedido: true }); this.aviso(s.qtd + ' etiquetas a caminho · entrega em até 5 dias úteis'); },
      certs: certItens.map((o) => {
        const n = certStage(o.id); const [acao, tipo] = acaoDe(n);
        const st = n === 5 ? ST.aut : n === 0 ? ST.rasc : ST.cert;
        return { src: o.src, titulo: o.titulo, id: n >= 2 ? 'HA-2026-' + o.id.toUpperCase() + '4F2-9Q' + o.id.toUpperCase() + 'M' : 'ID gerado ao vincular', st, acao,
          acBg: tipo === 'assinar' || tipo === 'emitir' ? ink : 'transparent', acFg: tipo === 'assinar' || tipo === 'emitir' ? paper : tipo === 'none' ? 'var(--ha-ink-300)' : ink, acBorda: tipo === 'assinar' || tipo === 'emitir' ? ink : tipo === 'none' ? 'var(--ha-paper-200)' : ink,
          etapas: [0, 1, 2, 3, 4].map((i) => ({ bg: i < n ? (n === 5 ? 'var(--ha-verified-500)' : ink) : 'var(--ha-paper-50)', borda: i < n ? (n === 5 ? 'var(--ha-verified-500)' : ink) : 'var(--ha-ink-300)', linha: i === 0 ? 'transparent' : i < n ? (n === 5 ? 'var(--ha-verified-500)' : ink) : 'var(--ha-paper-200)' })),
          go: () => { if (tipo === 'assinar') this.setState({ assinando: o.id, assinStep: 0 }); else if (tipo === 'emitir') { this.setState({ certs: { ...s.certs, [o.id]: 5 } }); this.aviso('Certificado emitido · ' + o.titulo); } else if (tipo === 'app') this.aviso('Abra o app HouseArt e encoste o celular na etiqueta'); else if (tipo === 'ver') window.location.href = 'HouseArt Verificacao.dc.html'; } };
      }),
      assinando: !!s.assinando,
      assin: (() => { const o = OBRAS.find((x) => x.id === s.assinando) || OBRAS[0]; return { src: o.src, titulo: o.titulo + ', ' + o.ano, id: 'HA-2026-' + o.id.toUpperCase() + '4F2-9Q' + o.id.toUpperCase() + 'M' }; })(),
      fecharAssinar: () => this.setState({ assinando: null }),
      assinTxt: s.assinStep ? 'Assinando…' : 'Assinar digitalmente', spinAssin: s.assinStep ? spin('var(--ha-ink-900)') : null,
      confirmarAssinar: () => { const id = s.assinando; this.setState({ assinStep: 1 }); clearTimeout(this.ta); this.ta = setTimeout(() => { this.setState((x) => ({ assinando: null, assinStep: 0, certs: { ...x.certs, [id]: 4 } })); this.aviso('Assinado · carimbo do tempo aplicado. Falta emitir.'); }, 1400); },
      vendasTitulo: 'Vendas e ofertas',
      abaOf: s.aba === 'of', abaVe: s.aba === 've',
      abaOfertas: () => this.setState({ aba: 'of' }), abaVendas: () => this.setState({ aba: 've' }),
      abaOfFg: s.aba === 'of' ? ink : 'var(--ha-ink-500)', abaOfSh: s.aba === 'of' ? 'inset 0 -2px 0 var(--ha-ink-900)' : 'none',
      abaVeFg: s.aba === 've' ? ink : 'var(--ha-ink-500)', abaVeSh: s.aba === 've' ? 'inset 0 -2px 0 var(--ha-ink-900)' : 'none',
      ofertas: ofBase.map((o) => { const r = s.ofertas[o.id]; return { ...o, valor: brl(o.v), preco: brl(o.p), dif: '−' + Math.round((1 - o.v / o.p) * 100) + '%', aberta: !r, fechada: !!r, res: r === 'ok' ? 'Aceita · venda em andamento' : 'Recusada', resBg: r === 'ok' ? 'var(--ha-verified-100)' : 'var(--ha-paper-200)', resFg: r === 'ok' ? 'var(--ha-verified-500)' : 'var(--ha-ink-700)',
        aceitar: () => { this.setState({ ofertas: { ...s.ofertas, [o.id]: 'ok' } }); this.aviso('Oferta aceita · o comprador tem 24 h para pagar em garantia'); },
        recusar: () => this.setState({ ofertas: { ...s.ofertas, [o.id]: 'no' } }) }; }),
      tlPct: Math.round(((tlAtual + 0.5) / ETAPAS_TL.length) * 100) + '%',
      timeline: ETAPAS_TL.map(([nome, desc, data, icon], i) => ({ nome, desc, data, icon, bg: i < tlAtual ? ink : i === tlAtual ? 'var(--ha-sand-500)' : paper, fg: i < tlAtual ? paper : ink, borda: i <= tlAtual ? 'transparent' : 'var(--ha-ink-300)', linha: i === ETAPAS_TL.length - 1 ? 'transparent' : i < tlAtual ? ink : 'var(--ha-paper-200)', cor: i <= tlAtual ? ink : 'var(--ha-ink-500)' })),
      toastOn: !!s.toast, toast: s.toast,
    };
    return Object.assign(base, this.extra(s, { ink, paper, brl, spin, IMG, ST, OBRAS }));
  }
}
