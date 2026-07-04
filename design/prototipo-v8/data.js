/* =============================================================
   HEAD MARKETPLACE OS · v8 — DADOS + LÓGICA (UMD)
   Todo dado aqui é DADO SIMULADO e rotulado como tal. Nenhuma conta
   externa está conectada; nenhuma escrita externa é possível.
   A lógica (V8LOGIC) é pura e roda em Node (testes) e no navegador.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { const m = factory(); root.V8DATA = m.V8DATA; root.V8LOGIC = m.V8LOGIC; }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MKTS = [
    { key: 'ml',     nome: 'Mercado Livre' },
    { key: 'shopee', nome: 'Shopee' },
    { key: 'tiktok', nome: 'TikTok Shop' },
    { key: 'magalu', nome: 'Magalu' },
  ];

  /* status canônicos exigidos pelo sprint 10.UI */
  const STATUS = {
    PRODUCAO: 'PRODUÇÃO', STAGING: 'STAGING', DEMONSTRACAO: 'DEMONSTRAÇÃO',
    DADO_REAL: 'DADO REAL', DADO_IMPORTADO: 'DADO IMPORTADO', DADO_SIMULADO: 'DADO SIMULADO',
    SEM_DADOS: 'SEM DADOS', AGUARDANDO_CONEXAO: 'AGUARDANDO CONEXÃO',
    ACAO_INTERNA: 'AÇÃO INTERNA', ESCRITA_BLOQUEADA: 'ESCRITA EXTERNA BLOQUEADA',
    EM_PROCESSAMENTO: 'EM PROCESSAMENTO', AGUARDANDO_APROVACAO: 'AGUARDANDO APROVAÇÃO',
    EM_REVISAO: 'EM REVISÃO', BLOQUEADO: 'BLOQUEADO', PRONTO_REVISAO: 'PRONTO PARA REVISÃO',
  };

  const P = (id, nome, sku, categoria, tipo, estoque, custo, precoBase, mkt, pend, up) => ({
    id, nome, sku, categoria, tipo, estoque, custo, precoBase,
    origem: STATUS.DADO_SIMULADO, atualizadoEm: up, pendencias: pend,
    mkt, master: {
      titulo: nome, marca: 'Casa Demo', descricao: `Descrição base de ${nome}. (dado simulado)`,
      pesoEmbaladoKg: pend.includes('peso embalado ausente') ? null : 1.2,
      material: pend.includes('ficha técnica incompleta: material') ? null : 'MDF / vidro / metal',
    },
    versoes: [],
  });
  const M = (status, preco, extra) => Object.assign({ status, preco, profile: {} }, extra || {});

  const products = [
    P('p1', 'Quadro Paisagem 60x90', 'QP-6090', 'Decoração', 'PRONTA_ENTREGA', 34, 48.9, 129.9,
      { ml: M('ATIVO', 129.9, { profile: { titulo: 'Quadro Paisagem 60x90 c/ Maleta Presente' } }),
        shopee: M('ATIVO', 124.9, { profile: { titulo: 'Quadro Paisagem Grande 60x90 Sala' } }),
        tiktok: M('NAO_PUBLICADO', null), magalu: M('PAUSADO', 132.9) },
      [], '2026-07-03'),
    P('p2', 'Kit 3 Quadros Sala Moderna', 'KIT3-SALA', 'Decoração', 'PRONTA_ENTREGA', 6, 92.0, 249.9,
      { ml: M('ATIVO', 249.9), shopee: M('ATIVO', 244.9), tiktok: M('ATIVO', 239.9), magalu: M('NAO_PUBLICADO', null) },
      ['risco de ruptura de estoque'], '2026-07-04'),
    P('p3', 'Quadro Personalizado Nome Família', 'QPN-FAM', 'Decoração', 'PERSONALIZADO', 0, 39.0, 159.9,
      { ml: M('ATIVO', 159.9), shopee: M('EM_REVISAO', 154.9), tiktok: M('NAO_PUBLICADO', null), magalu: M('NAO_PUBLICADO', null) },
      ['foto sem escala real'], '2026-07-02'),
    P('p4', 'Espelho Decorativo Orgânico 70cm', 'ESP-ORG', 'Decoração', 'SOB_ENCOMENDA', 0, 110.0, 289.9,
      { ml: M('PAUSADO', 289.9), shopee: M('BLOQUEADO', null, { motivo: 'sob encomenda: modalidade de envio incompatível (regra provisória interna)' }),
        tiktok: M('NAO_PUBLICADO', null), magalu: M('NAO_PUBLICADO', null) },
      ['peso embalado ausente'], '2026-06-30'),
    P('p5', 'Quadro Abstrato Dourado 50x70', 'QAD-ABS', 'Decoração', 'PRONTA_ENTREGA', 21, 41.5, 119.9,
      { ml: M('ATIVO', 119.9), shopee: M('NAO_PUBLICADO', null), tiktok: M('NAO_PUBLICADO', null), magalu: M('ATIVO', 122.9) },
      ['ficha técnica incompleta: material'], '2026-07-01'),
    P('p6', 'Porta-Retrato 3D Duplo Vidro', 'POR-3D', 'Decoração', 'PRONTA_ENTREGA', 58, 18.4, 59.9,
      { ml: M('ATIVO', 59.9), shopee: M('ATIVO', 57.9), tiktok: M('ATIVO', 55.9), magalu: M('ATIVO', 59.9) },
      [], '2026-07-04'),
    P('p7', 'Garrafa Térmica Inox 1L', 'GAR-1L', 'Casa e Cozinha', 'PRONTA_ENTREGA', 112, 27.0, 89.9,
      { ml: M('ATIVO', 89.9), shopee: M('ATIVO', 84.9), tiktok: M('NAO_PUBLICADO', null), magalu: M('ATIVO', 88.9) },
      [], '2026-07-03'),
    P('p8', 'Cafeteira Italiana 6 Xícaras', 'CAF-6X', 'Casa e Cozinha', 'PRONTA_ENTREGA', 40, 33.2, 109.9,
      { ml: M('ATIVO', 109.9), shopee: M('PAUSADO', 104.9), tiktok: M('NAO_PUBLICADO', null), magalu: M('NAO_PUBLICADO', null) },
      [], '2026-06-28'),
    P('p9', 'Tênis Runner Feminino 37', 'TEN-R37', 'Moda e Calçados', 'PRONTA_ENTREGA', 14, 61.0, 179.9,
      { ml: M('EM_REVISAO', 179.9), shopee: M('ATIVO', 169.9), tiktok: M('ATIVO', 174.9), magalu: M('NAO_PUBLICADO', null) },
      ['grade de numeração incompleta'], '2026-07-02'),
    P('p10', 'Luminária de Mesa LED Touch', 'LUM-LED', 'Iluminação', 'PRONTA_ENTREGA', 27, 44.8, 139.9,
      { ml: M('BLOQUEADO', null, { motivo: 'certificação INMETRO não informada (exigência da categoria — pack interno provisório)' }),
        shopee: M('NAO_PUBLICADO', null), tiktok: M('NAO_PUBLICADO', null), magalu: M('NAO_PUBLICADO', null) },
      ['certificação INMETRO não informada'], '2026-06-25'),
    P('p11', 'Caneca Cerâmica Eco 350ml', 'CAN-ECO', 'Casa e Cozinha', 'PRONTA_ENTREGA', 203, 9.9, 39.9,
      { ml: M('ATIVO', 39.9), shopee: M('ATIVO', 37.9), tiktok: M('ATIVO', 36.9), magalu: M('ATIVO', 39.9) },
      [], '2026-07-04'),
    P('p12', 'Organizador MDF Escritório 4 nichos', 'ORG-MDF', 'Escritório', 'SOB_ENCOMENDA', 0, 52.0, 149.9,
      { ml: M('NAO_PUBLICADO', null), shopee: M('NAO_PUBLICADO', null), tiktok: M('NAO_PUBLICADO', null), magalu: M('NAO_PUBLICADO', null) },
      ['dimensões da embalagem ausentes'], '2026-06-20'),
  ];

  const V8DATA = {
    meta: {
      env: STATUS.DEMONSTRACAO,
      empresa: 'Empresa Demonstração LTDA',
      conta: 'conta-demo · multicanal',
      usuario: 'Marcos', papel: 'ADMIN',
      hoje: '2026-07-04',
      aviso: 'Todos os dados desta instância são simulados e rotulados. Nenhuma conta externa conectada; escrita externa bloqueada.',
    },
    STATUS, MKTS, products,

    conexoes: [
      { key: 'ml', nome: 'Mercado Livre', status: STATUS.AGUARDANDO_CONEXAO, escopo: 'leitura (planejado)', escrita: STATUS.ESCRITA_BLOQUEADA, saude: null, ultimaSync: null },
      { key: 'shopee', nome: 'Shopee', status: STATUS.AGUARDANDO_CONEXAO, escopo: 'leitura (planejado)', escrita: STATUS.ESCRITA_BLOQUEADA, saude: null, ultimaSync: null },
      { key: 'tiktok', nome: 'TikTok Shop', status: STATUS.AGUARDANDO_CONEXAO, escopo: 'leitura (planejado)', escrita: STATUS.ESCRITA_BLOQUEADA, saude: null, ultimaSync: null },
      { key: 'magalu', nome: 'Magalu', status: STATUS.AGUARDANDO_CONEXAO, escopo: 'leitura (planejado)', escrita: STATUS.ESCRITA_BLOQUEADA, saude: null, ultimaSync: null },
      { key: 'whatsapp', nome: 'WhatsApp (controle remoto)', status: STATUS.AGUARDANDO_CONEXAO, escopo: 'comando interno', escrita: 'AÇÃO INTERNA apenas', saude: null, ultimaSync: null },
    ],

    /* ranking: só com contexto legítimo — nunca posição inventada */
    ranking: [
      { marketplace: 'Mercado Livre', palavra: 'quadro paisagem grande', posicao: 7, comparacao: 'era 5 há 7 dias', data: '2026-07-03', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
      { marketplace: 'Shopee', palavra: 'kit quadros sala', posicao: 12, comparacao: 'era 15 há 7 dias', data: '2026-07-02', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    ],

    home: {
      resumo: 'Dia operacionalmente estável em demonstração: 2 riscos ativos, 1 oportunidade priorizada, 1 decisão aguardando você.',
      melhorou: [
        { txt: 'Conversão do Kit 3 Quadros Sala subiu 6% na Shopee', fonte: 'resultado simulado · 7 dias' },
        { txt: 'Tempo de resposta a perguntas caiu para 11 min', fonte: 'operação interna' },
      ],
      piorou: [
        { txt: 'Quadro Paisagem 60x90 caiu de 5º para 7º em "quadro paisagem grande" (ML)', fonte: 'ranking simulado · 2026-07-03' },
        { txt: 'Cobertura de estoque do Kit 3 Quadros: 4,7 dias', fonte: 'estoque interno' },
      ],
      risco: { txt: 'Ruptura do Kit 3 Quadros Sala em ~5 dias no ritmo atual', acao: 'catalogo:p2' },
      oportunidade: { txt: 'Garrafa Térmica 1L com margem 63% e sem presença no TikTok Shop', acao: 'catalogo:p7' },
      decisaoPendente: { txt: 'Aprovar recalibragem da foto do Quadro Personalizado (devoluções)', status: STATUS.AGUARDANDO_APROVACAO, acao: 'missao:m2' },
      missaoAndamento: { txt: 'Frear queima de estoque · Kit 3 Quadros Sala', status: STATUS.EM_PROCESSAMENTO, acao: 'missao:m1' },
      intervencao: { txt: 'Ontem 21:14 — você pausou manualmente o anúncio do Espelho Orgânico no ML', fonte: 'intervenção registrada', acao: 'catalogo:p4' },
      proximosPassos: [
        'Completar peso embalado do Espelho Orgânico (destrava rascunho Shopee)',
        'Revisar grade do Tênis Runner 37 (EM REVISÃO no ML)',
        'Decidir sobre a foto do Quadro Personalizado',
      ],
    },

    missoes: [
      { id: 'm1', titulo: 'Frear queima de estoque · Kit 3 Quadros Sala', status: STATUS.EM_PROCESSAMENTO, tipo: STATUS.ACAO_INTERNA, agora: 'monitorando cobertura a cada hora (simulado)', origem: 'radar interno', reversivel: true },
      { id: 'm2', titulo: 'Recalibrar foto · Quadro Personalizado Nome Família', status: STATUS.AGUARDANDO_APROVACAO, tipo: STATUS.ACAO_INTERNA, agora: 'proposta pronta — aguardando sua decisão', origem: 'diagnóstico de devoluções', reversivel: true },
      { id: 'm3', titulo: 'Completar dados · Espelho Orgânico (peso embalado)', status: STATUS.EM_PROCESSAMENTO, tipo: 'SOLICITAÇÃO DE DADO', agora: 'pergunta enviada via WhatsApp (simulado)', origem: 'data completion engine', reversivel: true },
      { id: 'm4', titulo: 'Rascunho TikTok · Garrafa Térmica 1L', status: STATUS.PRONTO_REVISAO, tipo: STATUS.ACAO_INTERNA, agora: 'draft interno validado — publicação externa permanece bloqueada', origem: 'oportunidade priorizada', reversivel: true },
      { id: 'm5', titulo: 'Revisão de grade · Tênis Runner 37', status: STATUS.EM_REVISAO, tipo: STATUS.ACAO_INTERNA, agora: 'aguardando numeração 34–36', origem: 'pendência de catálogo', reversivel: true },
    ],

    crescimento: {
      leads: [
        { id: 'l1', nome: 'Loja Bella Casa (atacado)', canal: 'WhatsApp', etapa: 'NEGOCIAÇÃO', valorEstimado: 3400, followUp: '2026-07-04', origem: STATUS.DADO_SIMULADO },
        { id: 'l2', nome: 'Arq. Fernanda M. (projeto)', canal: 'Instagram', etapa: 'PROPOSTA', valorEstimado: 1900, followUp: '2026-07-05', origem: STATUS.DADO_SIMULADO },
        { id: 'l3', nome: 'Presentes Vila Nova', canal: 'Indicação afiliado', etapa: 'NOVO', valorEstimado: 800, followUp: '2026-07-04', origem: STATUS.DADO_SIMULADO },
      ],
      afiliados: [
        { id: 'a1', nome: 'Canal Decora Tudo', codigo: 'DECORA10', indicacoes: 14, convertidas: 5, comissaoPendente: 214.5, origem: STATUS.DADO_SIMULADO },
        { id: 'a2', nome: 'Perfil @casa.minimal', codigo: 'MINIMAL', indicacoes: 8, convertidas: 2, comissaoPendente: 74.0, origem: STATUS.DADO_SIMULADO },
      ],
      promocoes: [
        { id: 'pr1', nome: 'Semana da Sala (kits)', tipo: 'DESCONTO INTERNO', status: STATUS.EM_PROCESSAMENTO, itens: 3, margemMinimaRespeitada: true, origem: STATUS.DADO_SIMULADO },
        { id: 'pr2', nome: 'Frete parceiro julho', tipo: 'CAMPANHA PLANEJADA', status: STATUS.AGUARDANDO_APROVACAO, itens: 6, margemMinimaRespeitada: true, origem: STATUS.DADO_SIMULADO },
      ],
      resultados: { janela: '7 dias', receitaSimulada: 8412.4, pedidos: 63, ticketMedio: 133.5, origem: STATUS.DADO_SIMULADO },
      pendenciasComerciais: [
        { txt: 'Follow-up de hoje: Loja Bella Casa', quando: '2026-07-04' },
        { txt: 'Comissão do Canal Decora Tudo aguardando conferência', quando: '2026-07-06' },
      ],
    },

    silencio: [
      { id: 's1', txt: 'Vigiando cobertura de estoque de 12 produtos', detalhe: 'alerta se cobertura < 7 dias', ultimaChecagem: '2026-07-04 09:00', estado: 'normal' },
      { id: 's2', txt: 'Vigiando preço de 2 concorrentes do Quadro Paisagem', detalhe: 'alerta se corte > 10%', ultimaChecagem: '2026-07-04 08:40', estado: 'normal' },
      { id: 's3', txt: 'Vigiando devoluções por motivo dominante', detalhe: 'alerta se motivo repetir 3x na semana', ultimaChecagem: '2026-07-04 07:15', estado: 'atencao', nota: 'Quadro Personalizado: "veio diferente da foto" apareceu 3x — virou missão m2' },
      { id: 's4', txt: 'Vigiando perguntas sem resposta', detalhe: 'alerta se > 2h sem resposta', ultimaChecagem: '2026-07-04 09:05', estado: 'normal' },
    ],

    conhecimento: [
      { id: 'k1', tema: 'Método R.E.A.L.', tipo: 'PLAYBOOK', confianca: 'PROVISÓRIO', resumo: 'Reposicionar pelo diferencial antes de cobrir corte de preço.', quandoUsar: 'guerra de preço com diferencial real', quandoNaoUsar: 'produto commodity sem diferencial', origem: 'experiência interna (fixture)' },
      { id: 'k2', tema: 'Shopee · sob encomenda', tipo: 'REGRA PROVISÓRIA', confianca: 'PROVISÓRIO', resumo: 'Modalidades de envio incompatíveis com produção sob encomenda bloqueiam publicação.', quandoUsar: 'antes de rascunho Shopee de item sob encomenda', quandoNaoUsar: 'como regra oficial — confirmação final vem da conta conectada', origem: 'pack interno S10' },
      { id: 'k3', tema: 'Ads exige base validada', tipo: 'PLAYBOOK', confianca: 'PROVISÓRIO', resumo: 'Tráfego pago só depois de ficha completa, foto calibrada e margem conhecida.', quandoUsar: 'pedido de escalar com Ads', quandoNaoUsar: 'anúncio com pendência de dados', origem: 'estratégia interna 10.K.1' },
      { id: 'k4', tema: 'Ranking nunca é inventado', tipo: 'PRINCÍPIO', confianca: 'VERIFICADO INTERNO', resumo: 'Posição só aparece com marketplace, palavra, data, origem e confiança.', quandoUsar: 'sempre', quandoNaoUsar: '—', origem: 'contrato do produto' },
    ],
  };

  /* ================= LÓGICA PURA (testável em Node) ================= */
  const V8LOGIC = {
    margem(p, mktKey) {
      const preco = mktKey ? (p.mkt[mktKey] && p.mkt[mktKey].preco) : p.precoBase;
      if (!preco || !p.custo) return null;
      return Math.round(((preco - p.custo) / preco) * 1000) / 10;
    },

    readiness(p) {
      let total = 4, ok = 4;
      if (!p.master.pesoEmbaladoKg) ok--;
      if (!p.master.material) ok--;
      if (p.pendencias.length) ok--;
      if (!Object.values(p.mkt).some(m => m.status === 'ATIVO')) ok--;
      return Math.round((ok / total) * 100);
    },

    /* filtros combináveis — cada campo é AND; ausência = não filtra */
    filterProducts(list, f) {
      f = f || {};
      const q = (f.q || '').trim().toLowerCase();
      return list.filter(p => {
        if (q && !(p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))) return false;
        if (f.categoria && p.categoria !== f.categoria) return false;
        if (f.tipo && p.tipo !== f.tipo) return false;
        if (f.comPendencia === true && !p.pendencias.length) return false;
        if (f.comPendencia === false && p.pendencias.length) return false;
        if (f.marketplace && f.statusMkt) {
          const m = p.mkt[f.marketplace];
          if (!m || m.status !== f.statusMkt) return false;
        } else if (f.marketplace) {
          const m = p.mkt[f.marketplace];
          if (!m || m.status === 'NAO_PUBLICADO') return false;
        }
        if (f.estoqueMax != null && p.estoque > f.estoqueMax) return false;
        if (f.margemMin != null) {
          const mg = V8LOGIC.margem(p);
          if (mg == null || mg < f.margemMin) return false;
        }
        return true;
      });
    },

    activeFilterCount(f) {
      f = f || {};
      let n = 0;
      for (const k of ['q', 'categoria', 'tipo', 'marketplace', 'statusMkt']) if (f[k]) n++;
      if (f.comPendencia !== undefined) n++;
      if (f.estoqueMax != null) n++;
      if (f.margemMin != null) n++;
      return n;
    },

    sortProducts(list, key, dir) {
      const d = dir === 'desc' ? -1 : 1;
      const val = p => {
        if (key === 'margem') return V8LOGIC.margem(p) ?? -1;
        if (key === 'readiness') return V8LOGIC.readiness(p);
        return p[key];
      };
      return [...list].sort((a, b) => {
        const va = val(a), vb = val(b);
        if (typeof va === 'string') return va.localeCompare(vb, 'pt-BR') * d;
        return ((va ?? -Infinity) - (vb ?? -Infinity)) * d;
      });
    },

    /* estado mutável do protótipo: cópia dos produtos + trilha auditável */
    createState() {
      return {
        products: JSON.parse(JSON.stringify(V8DATA.products)),
        versions: [], jobs: [], audit: [], views: {},
        selection: new Set(), seq: 0,
      };
    },

    _audit(state, actor, acao, detalhe) {
      state.audit.push({ id: 'a' + (++state.seq), actor, acao, detalhe, origem: STATUS.ACAO_INTERNA, em: V8DATA.meta.hoje });
    },

    /* edição do Product Master: versiona, registra autor/origem, guarda valor
       anterior, reavalia rascunhos e NUNCA sobrescreve perfis por marketplace */
    editMaster(state, productId, field, value, author) {
      const p = state.products.find(x => x.id === productId);
      if (!p) throw new Error('produto não encontrado: ' + productId);
      const before = p.master[field];
      if (before === value) return { changed: false };
      p.master[field] = value;
      if (field === 'titulo') p.nome = value;
      const perfisPreservados = [];
      for (const mk of Object.keys(p.mkt))
        if (p.mkt[mk].profile && p.mkt[mk].profile[field] !== undefined) perfisPreservados.push(mk);
      /* reavaliar pendências dependentes do dado editado */
      if (field === 'pesoEmbaladoKg' && value) p.pendencias = p.pendencias.filter(x => x !== 'peso embalado ausente');
      if (field === 'material' && value) p.pendencias = p.pendencias.filter(x => !x.startsWith('ficha técnica incompleta'));
      const v = {
        id: 'v' + (++state.seq), entidade: 'product_master', produtoId: productId,
        campo: field, antes: before ?? null, depois: value,
        autor: author || 'Marcos', origem: STATUS.ACAO_INTERNA, em: V8DATA.meta.hoje,
        impacto: { rascunhosReavaliados: perfisPreservados.length + 1, perfisPreservados },
      };
      state.versions.push(v);
      p.versoes.push(v.id);
      V8LOGIC._audit(state, v.autor, 'edit_master', `${p.sku}.${field}: ${before ?? '—'} → ${value}`);
      return { changed: true, version: v, perfisPreservados };
    },

    /* edição de perfil POR MARKETPLACE: totalmente independente */
    editProfile(state, productId, mktKey, field, value, author) {
      const p = state.products.find(x => x.id === productId);
      if (!p || !p.mkt[mktKey]) throw new Error('perfil não encontrado');
      const before = p.mkt[mktKey].profile[field] ?? null;
      p.mkt[mktKey].profile[field] = value;
      const v = {
        id: 'v' + (++state.seq), entidade: 'mkt_profile', produtoId: productId, marketplace: mktKey,
        campo: field, antes: before, depois: value,
        autor: author || 'Marcos', origem: STATUS.ACAO_INTERNA, em: V8DATA.meta.hoje,
      };
      state.versions.push(v);
      V8LOGIC._audit(state, v.autor, 'edit_profile', `${p.sku}[${mktKey}].${field}`);
      return { version: v };
    },

    /* ações em massa: sempre viram JOB auditável; escrita externa é recusada */
    EXTERNAL_ACTIONS: ['publicar_externo', 'pausar_externo', 'alterar_preco_externo'],
    bulkAction(state, ids, action, author) {
      if (!ids.length) return { blocked: true, reason: 'nenhum item selecionado' };
      if (V8LOGIC.EXTERNAL_ACTIONS.includes(action)) {
        V8LOGIC._audit(state, author || 'Marcos', 'bulk_blocked', `${action} recusado: ${STATUS.ESCRITA_BLOQUEADA}`);
        return { blocked: true, reason: STATUS.ESCRITA_BLOQUEADA + ' — conecte a conta oficial e aprove para publicar.' };
      }
      const job = {
        id: 'job' + (++state.seq), acao: action, itens: [...ids], total: ids.length,
        status: STATUS.EM_PROCESSAMENTO, tipo: STATUS.ACAO_INTERNA, reversivel: true,
        autor: author || 'Marcos', em: V8DATA.meta.hoje,
      };
      state.jobs.push(job);
      V8LOGIC._audit(state, job.autor, 'bulk_job', `${action} sobre ${ids.length} itens (${job.id})`);
      if (action === 'marcar_revisao')
        for (const id of ids) {
          const p = state.products.find(x => x.id === id);
          if (p && !p.pendencias.includes('marcado para revisão')) p.pendencias.push('marcado para revisão');
        }
      job.status = 'CONCLUÍDO (interno)';
      return { job };
    },

    /* seleção */
    toggleSelect(state, id) { state.selection.has(id) ? state.selection.delete(id) : state.selection.add(id); return state.selection.size; },
    selectAllFiltered(state, filtered) { for (const p of filtered) state.selection.add(p.id); return state.selection.size; },
    clearSelection(state) { state.selection.clear(); },

    /* visões salvas (filtros persistíveis) */
    saveView(state, nome, filtros) { state.views[nome] = JSON.parse(JSON.stringify(filtros)); return Object.keys(state.views); },
    loadView(state, nome) { return state.views[nome] ? JSON.parse(JSON.stringify(state.views[nome])) : null; },

    /* matriz de publicação por produto — status honesto por canal */
    publicationMatrix(p) {
      return V8DATA.MKTS.map(mk => {
        const m = p.mkt[mk.key];
        const row = { marketplace: mk.nome, key: mk.key, status: m.status, preco: m.preco, margem: V8LOGIC.margem(p, mk.key) };
        if (m.status === 'NAO_PUBLICADO') { row.podeRascunho = true; row.publicacaoExterna = STATUS.ESCRITA_BLOQUEADA; }
        if (m.status === 'BLOQUEADO') row.motivo = m.motivo;
        return row;
      });
    },

    /* ranking legítimo: recusa entrada sem contexto completo */
    assertRankingLegit(entry) {
      for (const k of ['marketplace', 'palavra', 'posicao', 'data', 'origem', 'confianca'])
        if (entry[k] === undefined || entry[k] === null || entry[k] === '')
          throw new Error('ranking sem contexto legítimo: falta ' + k);
      return true;
    },

    /* botão desabilitado sempre tem razão explicável */
    disabledReason(kind) {
      const R = {
        publicar_externo: STATUS.ESCRITA_BLOQUEADA + ' — nenhuma conta oficial conectada. Conecte em Conexões e aprove a publicação.',
        sync: STATUS.AGUARDANDO_CONEXAO + ' — sincronização exige conexão oficial de leitura.',
        ranking_real: STATUS.SEM_DADOS + ' — ranking real exige conta conectada; nada será inventado.',
        ads: 'BLOQUEADO — Ads exige base validada (ficha completa, foto calibrada, margem conhecida).',
      };
      return R[kind] || 'indisponível neste modo';
    },

    badgeCounts(state) {
      const prods = state ? state.products : V8DATA.products;
      return {
        home: '', operacao: '',
        catalogo: String(prods.filter(p => p.pendencias.length).length),
        crescimento: String(V8DATA.crescimento.leads.filter(l => l.followUp === V8DATA.meta.hoje).length),
        conexoes: '0/5',
        missao: String(V8DATA.missoes.filter(m => m.status !== 'CONCLUÍDO (interno)').length),
        silencio: String(V8DATA.silencio.filter(s => s.estado === 'atencao').length),
        conhecimento: '',
      };
    },
  };

  return { V8DATA, V8LOGIC };
}));
