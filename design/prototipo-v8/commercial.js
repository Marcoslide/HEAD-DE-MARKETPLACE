/* =============================================================
   HEAD MARKETPLACE OS · v8 — CAMADA COMERCIAL (UMD) · Sprint 10.V
   Contas, papéis com enforcement real, planos SEM cobrança, trial
   que preserva dados, convites com escopo, checklist de ativação,
   suporte com estados honestos e separação absoluta entre
   DEMONSTRAÇÃO e OPERAÇÃO REAL. Roda em Node (testes) e navegador.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8COM = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOJE = '2026-07-04';
  const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const addDias = (iso, n) => new Date(new Date(iso).getTime() + n * 86400000).toISOString().slice(0, 10);

  /* ---------------- papéis e permissões (enforcement real) ---------------- */
  const PERMS = ['verMargem', 'editarMaster', 'editarPerfilLoja', 'criarMissao', 'aprovar',
    'convidar', 'exportar', 'adminIntegracao', 'alterarPlano', 'verFinanceiro'];
  const ROLES = {
    OWNER:              { verMargem: 1, editarMaster: 1, editarPerfilLoja: 1, criarMissao: 1, aprovar: 1, convidar: 1, exportar: 1, adminIntegracao: 1, alterarPlano: 1, verFinanceiro: 1 },
    ADMIN:              { verMargem: 1, editarMaster: 1, editarPerfilLoja: 1, criarMissao: 1, aprovar: 1, convidar: 1, exportar: 1, adminIntegracao: 1, alterarPlano: 0, verFinanceiro: 1 },
    HEAD_MARKETPLACE:   { verMargem: 1, editarMaster: 1, editarPerfilLoja: 1, criarMissao: 1, aprovar: 1, convidar: 0, exportar: 1, adminIntegracao: 0, alterarPlano: 0, verFinanceiro: 0 },
    GESTOR_COMERCIAL:   { verMargem: 1, editarMaster: 0, editarPerfilLoja: 1, criarMissao: 1, aprovar: 0, convidar: 0, exportar: 1, adminIntegracao: 0, alterarPlano: 0, verFinanceiro: 0 },
    GESTOR_OPERACIONAL: { verMargem: 0, editarMaster: 0, editarPerfilLoja: 1, criarMissao: 1, aprovar: 0, convidar: 0, exportar: 1, adminIntegracao: 0, alterarPlano: 0, verFinanceiro: 0 },
    CATALOGO:           { verMargem: 0, editarMaster: 1, editarPerfilLoja: 1, criarMissao: 1, aprovar: 0, convidar: 0, exportar: 0, adminIntegracao: 0, alterarPlano: 0, verFinanceiro: 0 },
    FINANCEIRO:         { verMargem: 1, editarMaster: 0, editarPerfilLoja: 0, criarMissao: 0, aprovar: 0, convidar: 0, exportar: 1, adminIntegracao: 0, alterarPlano: 0, verFinanceiro: 1 },
    EXPEDICAO:          { verMargem: 0, editarMaster: 0, editarPerfilLoja: 0, criarMissao: 1, aprovar: 0, convidar: 0, exportar: 0, adminIntegracao: 0, alterarPlano: 0, verFinanceiro: 0 },
    DESIGNER:           { verMargem: 0, editarMaster: 0, editarPerfilLoja: 1, criarMissao: 0, aprovar: 0, convidar: 0, exportar: 0, adminIntegracao: 0, alterarPlano: 0, verFinanceiro: 0 },
    CONSULTOR:          { verMargem: 1, editarMaster: 0, editarPerfilLoja: 0, criarMissao: 1, aprovar: 0, convidar: 0, exportar: 1, adminIntegracao: 0, alterarPlano: 0, verFinanceiro: 0 },
    LEITURA:            { verMargem: 0, editarMaster: 0, editarPerfilLoja: 0, criarMissao: 0, aprovar: 0, convidar: 0, exportar: 0, adminIntegracao: 0, alterarPlano: 0, verFinanceiro: 0 },
  };

  /* ---------------- planos (estrutura, SEM cobrança) ---------------- */
  const PLANS = {
    STARTER: {
      nome: 'Starter', para: 'pequenas operações iniciando em marketplace',
      limites: { empresas: 1, cnpjs: 1, lojas: 2, usuarios: 3, marketplaces: 2, catalogo: 200, missoesMes: 50 },
      recursos: { crescimento: true, inteligencia: 'essencial', suporte: 'central de ajuda', integracoes: 'leitura', whatsapp: false, auditoria: true, avancados: false },
      emBreve: ['WhatsApp controle remoto'],
    },
    PRO: {
      nome: 'Pro', para: 'empresas com múltiplas contas, catálogo e equipe',
      limites: { empresas: 1, cnpjs: 2, lojas: 6, usuarios: 10, marketplaces: 4, catalogo: 2000, missoesMes: 500 },
      recursos: { crescimento: true, inteligencia: 'completa', suporte: 'prioritário', integracoes: 'leitura', whatsapp: true, auditoria: true, avancados: true },
      emBreve: [],
    },
    SCALE: {
      nome: 'Scale', para: 'operação multiempresa, multiCNPJ, multiloja e suporte estratégico',
      limites: { empresas: 5, cnpjs: 10, lojas: 25, usuarios: 30, marketplaces: 5, catalogo: 20000, missoesMes: 5000 },
      recursos: { crescimento: true, inteligencia: 'completa + playbooks', suporte: 'estratégico', integracoes: 'leitura + escrita gate a gate (quando disponível)', whatsapp: true, auditoria: true, avancados: true },
      emBreve: ['escrita externa gate a gate'],
    },
    ENTERPRISE: {
      nome: 'Enterprise', para: 'grupos, operações complexas e necessidades especiais',
      limites: { empresas: 'sob acordo', cnpjs: 'sob acordo', lojas: 'sob acordo', usuarios: 'sob acordo', marketplaces: 'todos', catalogo: 'sob acordo', missoesMes: 'sob acordo' },
      recursos: { crescimento: true, inteligencia: 'dedicada', suporte: 'dedicado + ativação assistida', integracoes: 'sob acordo', whatsapp: true, auditoria: true, avancados: true },
      emBreve: [],
    },
  };
  const TRIAL_DIAS = 14;

  const V8COM = {
    PERMS, ROLES, PLANS, TRIAL_DIAS,
    can(role, perm) {
      const r = ROLES[role];
      if (!r) return false;
      return !!r[perm];
    },

    /* ---------------- conta e cadastro ---------------- */
    createAccount(f, hoje) {
      hoje = hoje || HOJE;
      for (const k of ['nome', 'sobrenome', 'email', 'telefone', 'senha', 'empresa', 'pais'])
        if (!f[k] || !String(f[k]).trim()) throw new Error('cadastro incompleto: falta ' + k);
      if (!f.aceiteTermos || !f.aceitePrivacidade) throw new Error('aceite de termos e política de privacidade é obrigatório');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) throw new Error('e-mail inválido');
      /* a senha NUNCA é armazenada em claro no protótipo */
      return {
        id: 'acc-' + f.email.replace(/[^a-z0-9]/gi, '').slice(0, 12),
        user: { nome: f.nome, sobrenome: f.sobrenome, email: f.email, telefone: f.telefone, pais: f.pais, papel: 'OWNER', senhaDefinida: true },
        empresaPrincipal: f.empresa,
        status: 'CONTA NOVA', modo: 'OPERACAO',
        plano: 'TRIAL', trial: { dias: TRIAL_DIAS, iniciadoEm: hoje, expiraEm: addDias(hoje, TRIAL_DIAS) },
        onboarding: { etapa: 1, concluido: false, marcos: {} },
        escopo: { grupos: [], empresas: [], cnpjs: [], lojas: [], contas: [] },
        catalogoModo: null, marketplacesSel: [],
        membros: [], convites: [], solicitacoes: [], planoHistorico: [{ plano: 'TRIAL', em: hoje, origem: 'cadastro' }],
        audit: [{ acao: 'conta_criada', em: hoje, detalhe: f.email }],
        seq: 0,
      };
    },
    _audit(acc, acao, detalhe, hoje) { acc.audit.push({ acao, detalhe, em: hoje || HOJE }); },

    /* ---------------- onboarding guiado (8 etapas) ---------------- */
    obGrupoEmpresa(acc, f) {
      for (const k of ['grupo', 'empresa', 'segmento', 'pais', 'modelo'])
        if (!f[k]) throw new Error('etapa 2 incompleta: falta ' + k);
      const g = { id: 'g-' + (++acc.seq), nome: f.grupo, autorizado: true };
      const e = { id: 'e-' + (++acc.seq), grupoId: g.id, nome: f.empresa, segmento: f.segmento, pais: f.pais, porte: f.porte || null, modelo: f.modelo, tipoDado: 'DADOS REAIS' };
      acc.escopo.grupos.push(g); acc.escopo.empresas.push(e);
      acc.onboarding.etapa = 3; acc.onboarding.marcos.empresaCriada = true;
      acc.status = 'ONBOARDING EM ANDAMENTO';
      V8COM._audit(acc, 'onboarding_empresa', `${f.grupo} / ${f.empresa} (${f.modelo})`);
      return { grupo: g, empresa: e };
    },
    obAddCnpj(acc, f) {
      if (f === null) { /* pular por enquanto — permitido */
        acc.onboarding.etapa = Math.max(acc.onboarding.etapa, 4);
        V8COM._audit(acc, 'onboarding_cnpj_pulado', 'usuário decidiu adicionar depois');
        return null;
      }
      for (const k of ['nomeFiscal', 'nomeFantasia', 'estado', 'cidade'])
        if (!f[k]) throw new Error('CNPJ incompleto: falta ' + k);
      const c = { id: 'c-' + (++acc.seq), empresaId: acc.escopo.empresas[0].id, nomeFiscal: f.nomeFiscal, nomeFantasia: f.nomeFantasia, estado: f.estado, cidade: f.cidade, principal: !!f.principal || acc.escopo.cnpjs.length === 0, validacaoExterna: 'não exigida neste modo' };
      acc.escopo.cnpjs.push(c);
      acc.onboarding.etapa = Math.max(acc.onboarding.etapa, 4);
      acc.onboarding.marcos.cnpjCadastrado = true;
      V8COM._audit(acc, 'onboarding_cnpj', f.nomeFantasia);
      return c;
    },
    TIPOS_LOJA: ['marketplace', 'loja física', 'centro de distribuição', 'operação digital', 'filial', 'outro'],
    obAddLoja(acc, f) {
      for (const k of ['nome', 'tipo']) if (!f[k]) throw new Error('loja incompleta: falta ' + k);
      if (!V8COM.TIPOS_LOJA.includes(f.tipo)) throw new Error('tipo de loja inválido: ' + f.tipo);
      const s = { id: 's-' + (++acc.seq), nome: f.nome, tipo: f.tipo, cnpjId: f.cnpjId || (acc.escopo.cnpjs[0] || {}).id || null, cidade: f.cidade || null, responsavel: f.responsavel || null, deposito: f.deposito || null };
      acc.escopo.lojas.push(s);
      acc.onboarding.etapa = Math.max(acc.onboarding.etapa, 5);
      acc.onboarding.marcos.lojaCadastrada = true;
      V8COM._audit(acc, 'onboarding_loja', f.nome);
      return s;
    },
    MARKETPLACES: ['Mercado Livre', 'Shopee', 'TikTok Shop', 'Magalu', 'Amazon', 'Outro', 'Ainda não vendo'],
    ESTADOS_MKT: ['conectar agora', 'conectar depois', 'usar demonstração', 'importar manualmente', 'ativação assistida'],
    obSelectMarketplaces(acc, escolhas) {
      for (const e of escolhas) {
        if (!V8COM.MARKETPLACES.includes(e.marketplace)) throw new Error('marketplace inválido: ' + e.marketplace);
        if (!V8COM.ESTADOS_MKT.includes(e.estado)) throw new Error('estado inválido: ' + e.estado);
        acc.marketplacesSel.push({
          marketplace: e.marketplace, estado: e.estado,
          leitura: e.estado === 'conectar agora' ? 'AGUARDANDO CONEXÃO' : 'NÃO INICIADA',
          escrita: 'ESCRITA EXTERNA BLOQUEADA', /* conectar NUNCA habilita escrita */
        });
        if (e.estado === 'ativação assistida')
          V8COM.createTicket(acc, { tipo: 'ativação assistida', msg: 'Solicitada na etapa de marketplaces: ' + e.marketplace });
      }
      acc.onboarding.etapa = Math.max(acc.onboarding.etapa, 6);
      acc.onboarding.marcos.marketplaceSelecionado = escolhas.length > 0;
      V8COM._audit(acc, 'onboarding_marketplaces', escolhas.map(x => `${x.marketplace}:${x.estado}`).join(', '));
      return acc.marketplacesSel;
    },
    CATALOGO_MODOS: ['importar planilha', 'adicionar manualmente', 'catálogo demonstrativo', 'pular', 'importar de marketplace futuramente'],
    obCatalogo(acc, modo) {
      if (!V8COM.CATALOGO_MODOS.includes(modo)) throw new Error('modo de catálogo inválido');
      acc.catalogoModo = modo;
      if (modo === 'catálogo demonstrativo') acc.demoTemporaria = true; /* rotulada, nunca misturada */
      if (modo === 'importar planilha') acc.status = 'IMPORTAÇÃO EM ANDAMENTO';
      acc.onboarding.etapa = Math.max(acc.onboarding.etapa, 7);
      acc.onboarding.marcos.catalogoDefinido = true;
      V8COM._audit(acc, 'onboarding_catalogo', modo);
      return modo;
    },
    obComplete(acc) {
      acc.onboarding.concluido = true; acc.onboarding.etapa = 8;
      acc.status = 'TRIAL ATIVO';
      V8COM._audit(acc, 'onboarding_concluido', 'jornada inicial completa');
      return V8COM.firstMission(acc);
    },
    /* sugestão de primeira missão baseada no que foi (ou não) feito */
    firstMission(acc) {
      if (!acc.escopo.lojas.length) return { acao: 'configurar lojas', motivo: 'nenhuma loja cadastrada ainda' };
      if (acc.catalogoModo === 'pular' || !acc.catalogoModo) return { acao: 'completar catálogo', motivo: 'catálogo adiado no onboarding' };
      if (acc.catalogoModo === 'catálogo demonstrativo') return { acao: 'abrir demonstração guiada', motivo: 'você escolheu explorar com dados fictícios' };
      if (acc.catalogoModo === 'importar planilha') return { acao: 'revisar importação', motivo: 'importação em andamento' };
      if (!acc.marketplacesSel.some(m => m.estado === 'conectar agora')) return { acao: 'conectar marketplace', motivo: 'nenhuma conexão de leitura iniciada' };
      if (!acc.convites.length) return { acao: 'convidar responsável', motivo: 'equipe ainda não convidada' };
      return { acao: 'revisar margem', motivo: 'base pronta — margem é o primeiro controle' };
    },

    /* ---------------- equipe: convites com escopo ---------------- */
    invite(acc, f) {
      if (!V8COM.can(acc.user.papel, 'convidar') && acc.user.papel !== 'OWNER') throw new Error('seu papel não pode convidar pessoas');
      if (!f.email || !ROLES[f.papel]) throw new Error('convite exige e-mail e papel válido');
      const limite = PLANS[acc.plano === 'TRIAL' ? 'PRO' : acc.plano];
      if (typeof limite.limites.usuarios === 'number' && acc.membros.length + acc.convites.filter(c => c.status !== 'cancelado').length + 1 >= limite.limites.usuarios + 1)
        throw new Error('limite de usuários do plano atingido — solicite upgrade');
      const conv = {
        id: 'inv-' + (++acc.seq), email: f.email, papel: f.papel,
        escopo: { empresas: f.escopo && f.escopo.empresas || acc.escopo.empresas.map(e => e.id), cnpjs: f.escopo && f.escopo.cnpjs || [], lojas: f.escopo && f.escopo.lojas || [] },
        status: 'enviado', em: HOJE,
      };
      acc.convites.push(conv);
      acc.onboarding.marcos.equipeConvidada = true;
      V8COM._audit(acc, 'convite_enviado', `${f.email} (${f.papel})`);
      return conv;
    },
    acceptInvite(acc, invId) {
      const c = acc.convites.find(x => x.id === invId);
      if (!c || c.status === 'cancelado') throw new Error('convite inválido ou cancelado');
      c.status = 'aceito';
      const m = { id: 'u-' + (++acc.seq), email: c.email, papel: c.papel, escopo: c.escopo, ultimaAtividade: HOJE, missoes: 0 };
      acc.membros.push(m);
      V8COM._audit(acc, 'convite_aceito', c.email);
      return m;
    },
    resendInvite(acc, invId) { const c = acc.convites.find(x => x.id === invId); if (c) { c.status = 'reenviado'; V8COM._audit(acc, 'convite_reenviado', c.email); } return c; },
    cancelInvite(acc, invId) { const c = acc.convites.find(x => x.id === invId); if (c) { c.status = 'cancelado'; V8COM._audit(acc, 'convite_cancelado', c.email); } return c; },
    setRole(acc, memberId, papel) {
      if (!ROLES[papel]) throw new Error('papel inválido');
      const m = acc.membros.find(x => x.id === memberId);
      m.papel = papel; V8COM._audit(acc, 'papel_alterado', `${m.email} → ${papel}`);
      return m;
    },
    removeAccess(acc, memberId) {
      const i = acc.membros.findIndex(x => x.id === memberId);
      if (i >= 0) { V8COM._audit(acc, 'acesso_removido', acc.membros[i].email); acc.membros.splice(i, 1); }
    },
    /* escopo do membro: o que ele pode ver — enforcement, não decoração */
    memberSees(member, tipo, id) {
      const esc = member.escopo || {};
      if (tipo === 'empresa') return !esc.empresas.length || esc.empresas.includes(id);
      if (tipo === 'cnpj') return !esc.cnpjs.length || esc.cnpjs.includes(id);
      if (tipo === 'loja') return !esc.lojas.length || esc.lojas.includes(id);
      return false;
    },

    /* ---------------- trial e planos (sem cobrança) ---------------- */
    trialDaysLeft(acc, hoje) { return Math.max(0, dias(hoje || HOJE, acc.trial.expiraEm)); },
    trialStatus(acc, hoje) {
      const d = V8COM.trialDaysLeft(acc, hoje);
      if (acc.plano !== 'TRIAL') return 'PLANO ATIVO';
      if (d === 0) return 'TRIAL EXPIRADO';
      if (d <= 3) return 'TRIAL EXPIRANDO';
      return 'TRIAL ATIVO';
    },
    accessLevel(acc, hoje) {
      if (acc.status === 'CONTA SUSPENSA') return 'ACESSO NEGADO';
      if (V8COM.trialStatus(acc, hoje) === 'TRIAL EXPIRADO') return 'ACESSO LIMITADO';
      return 'ACESSO COMPLETO';
    },
    /* upgrade NUNCA cobra: gera solicitação interna auditável */
    requestUpgrade(acc, plano) {
      if (!PLANS[plano]) throw new Error('plano inexistente: ' + plano);
      const s = { id: 'req-' + (++acc.seq), tipo: 'UPGRADE', plano, status: 'solicitação criada', em: HOJE, cobranca: 'nenhuma — cobrança real fora do escopo deste modo' };
      acc.solicitacoes.push(s);
      V8COM._audit(acc, 'upgrade_solicitado', plano);
      return s;
    },
    usage(acc) {
      return { empresas: acc.escopo.empresas.length, cnpjs: acc.escopo.cnpjs.length, lojas: acc.escopo.lojas.length, usuarios: 1 + acc.membros.length, marketplaces: acc.marketplacesSel.filter(m => m.marketplace !== 'Ainda não vendo').length, contas: acc.escopo.contas.length };
    },

    /* ---------------- suporte (estados honestos) ---------------- */
    TICKET_TIPOS: ['suporte', 'ativação assistida', 'integração', 'treinamento', 'problema'],
    TICKET_ESTADOS: ['solicitação criada', 'aguardando resposta', 'respondido', 'resolvido', 'indisponível'],
    createTicket(acc, f) {
      if (!V8COM.TICKET_TIPOS.includes(f.tipo)) throw new Error('tipo de solicitação inválido');
      const t = { id: 'tk-' + (++acc.seq), tipo: f.tipo, msg: f.msg || '', status: 'solicitação criada', em: HOJE, resposta: null };
      acc.solicitacoes.push(t);
      V8COM._audit(acc, 'ticket_criado', `${f.tipo}: ${f.msg || ''}`.trim());
      return t;
    },

    /* ---------------- ativação: checklist com CTA e impacto ---------------- */
    activationChecklist(acc) {
      const m = acc.onboarding.marcos;
      const item = (nome, feito, cta, impacto, bloqueio) => ({
        item: nome, feito: !!feito, status: feito ? 'concluído' : 'pendente',
        responsavel: acc.user.nome, cta, impacto, bloqueio: bloqueio || null,
      });
      const conectado = acc.marketplacesSel.some(x => x.leitura === 'AGUARDANDO CONEXÃO');
      return [
        item('Empresa criada', m.empresaCriada, 'criar empresa no onboarding', 'destrava toda a operação'),
        item('CNPJ cadastrado', m.cnpjCadastrado, 'adicionar CNPJ', 'organiza lojas por entidade fiscal'),
        item('Loja cadastrada', m.lojaCadastrada, 'adicionar loja', 'escopo real de estoque e preço'),
        item('Equipe convidada', m.equipeConvidada, 'convidar pessoa', 'missões com responsável'),
        item('Marketplace selecionado', m.marketplaceSelecionado, 'selecionar marketplaces', 'prepara conexões de leitura'),
        item('Marketplace conectado', conectado, 'iniciar conexão de leitura', 'dados reais no lugar de simulados', conectado ? null : 'OAuth real fora do escopo deste modo'),
        item('Catálogo importado', acc.catalogoModo && acc.catalogoModo !== 'pular', 'importar ou criar produtos', 'o Head passa a vigiar o que existe'),
        item('Produto revisado', m.produtoRevisado, 'revisar um produto', 'ficha completa = readiness'),
        item('Margem configurada', m.margemConfigurada, 'informar custo e preço', 'margem visível por loja'),
        item('Estoque preenchido', m.estoquePreenchido, 'preencher estoque por loja', 'alertas de ruptura'),
        item('Primeiro draft criado', m.draftCriado, 'criar rascunho interno', 'caminho de expansão aberto'),
        item('Primeira missão concluída', m.missaoConcluida, 'concluir uma missão', 'ciclo de execução fechado'),
        item('Primeiro relatório visualizado', m.relatorioVisto, 'abrir Crescimento · Resultados', 'leitura de resultado com origem'),
      ];
    },
    activationProgress(acc) {
      const c = V8COM.activationChecklist(acc);
      return { feitos: c.filter(x => x.feito).length, total: c.length, pct: Math.round((c.filter(x => x.feito).length / c.length) * 100) };
    },

    /* ---------------- demo × operação real: nunca misturar ---------------- */
    switchMode(acc, modo) {
      if (!['DEMONSTRACAO', 'OPERACAO'].includes(modo)) throw new Error('modo inválido');
      acc.modo = modo;
      V8COM._audit(acc, 'modo_alterado', modo + ' (troca explícita)');
      return modo;
    },
    /* anexar dado demonstrativo a empresa real é RECUSADO */
    guardDemoMix(acc, dado) {
      const empresaReal = acc.escopo.empresas.find(e => e.tipoDado === 'DADOS REAIS');
      if (empresaReal && dado && dado.origem === 'DADO SIMULADO' && dado.empresaId === empresaReal.id)
        throw new Error('dado demonstrativo não pode ser anexado a empresa real — use o modo DEMONSTRAÇÃO');
      return true;
    },

    /* estados canônicos do produto comercial */
    PRODUCT_STATES: ['CONTA NOVA', 'ONBOARDING EM ANDAMENTO', 'ONBOARDING CONCLUÍDO', 'TRIAL ATIVO',
      'TRIAL EXPIRANDO', 'TRIAL EXPIRADO', 'PLANO ATIVO', 'PLANO EM REVISÃO', 'CONTA SUSPENSA',
      'ACESSO LIMITADO', 'INTEGRAÇÃO PENDENTE', 'ATIVAÇÃO ASSISTIDA SOLICITADA', 'SEM DADOS',
      'IMPORTAÇÃO EM ANDAMENTO', 'ERRO DE IMPORTAÇÃO'],
  };

  return V8COM;
}));
