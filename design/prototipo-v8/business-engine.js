/* =============================================================
   HEAD MARKETPLACE OS · v8 — BUSINESS ENGINE (10.E.4)
   EMPRESAS E OPERAÇÕES + CENTRO DE CUSTOS.
   Modelo simples na superfície: Empresa → Canal de Venda → Conta
   Marketplace (a estrutura Grupo/CNPJ continua embaixo, opcional).
   Financeiro honesto: nenhuma taxa inventada, nenhuma margem sem
   fórmula, nenhum número sem fonte e regra; custo fixo só entra
   com regra de rateio; estimativa NUNCA vira "lucro real".
   Toda mutação passa por permissão no motor e vira auditoria com
   antes/depois/motivo. Regra financeira alterada cria NOVA
   vigência — o passado não é reescrito. Roda em Node e navegador.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8BIZ = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOJE = '2026-07-05';
  const round2 = v => Math.round(v * 100) / 100;

  /* ---------- permissões (enforcement no motor) ---------- */
  const BIZ_PERMS_ALL = ['COMPANY_VIEW', 'COMPANY_CREATE', 'COMPANY_EDIT', 'COMPANY_ARCHIVE', 'COMPANY_DELETE_EMPTY',
    'CHANNEL_VIEW', 'CHANNEL_CREATE', 'CHANNEL_EDIT', 'CHANNEL_ARCHIVE', 'MARKETPLACE_ACCOUNT_CONNECT',
    'COST_CENTER_VIEW', 'COST_CENTER_EDIT', 'COST_CENTER_ARCHIVE', 'COST_RULE_CREATE', 'COST_RULE_EDIT',
    'COST_RULE_DELETE', 'COST_SIMULATOR_USE', 'COST_FINANCIAL_EXPORT', 'PRODUCT_COST_EDIT',
    'BREAK_EVEN_VIEW', 'BREAK_EVEN_EDIT'];
  const BIZ_PERMS = {
    OWNER: BIZ_PERMS_ALL.slice(), ADMIN: BIZ_PERMS_ALL.slice(),
    HEAD_MARKETPLACE: BIZ_PERMS_ALL.filter(p => !['COMPANY_DELETE_EMPTY', 'COST_RULE_DELETE'].includes(p)),
    FINANCEIRO: ['COMPANY_VIEW', 'CHANNEL_VIEW', 'COST_CENTER_VIEW', 'COST_CENTER_EDIT', 'COST_CENTER_ARCHIVE',
      'COST_RULE_CREATE', 'COST_RULE_EDIT', 'COST_SIMULATOR_USE', 'COST_FINANCIAL_EXPORT',
      'PRODUCT_COST_EDIT', 'BREAK_EVEN_VIEW', 'BREAK_EVEN_EDIT'],
    GESTOR_COMERCIAL: ['COMPANY_VIEW', 'CHANNEL_VIEW', 'COST_CENTER_VIEW', 'COST_SIMULATOR_USE', 'BREAK_EVEN_VIEW'],
    GESTOR_OPERACIONAL: ['COMPANY_VIEW', 'CHANNEL_VIEW', 'CHANNEL_CREATE', 'CHANNEL_EDIT', 'COST_CENTER_VIEW', 'BREAK_EVEN_VIEW'],
    CATALOGO: ['COMPANY_VIEW', 'CHANNEL_VIEW', 'COST_CENTER_VIEW', 'PRODUCT_COST_EDIT'],
    EXPEDICAO: ['COMPANY_VIEW', 'CHANNEL_VIEW'], DESIGNER: [],
    CONSULTOR: ['COMPANY_VIEW', 'CHANNEL_VIEW', 'COST_CENTER_VIEW', 'BREAK_EVEN_VIEW'],
    LEITURA: ['COMPANY_VIEW', 'CHANNEL_VIEW'],
  };
  const canBiz = (papel, perm) => (BIZ_PERMS[papel] || []).includes(perm);
  const negar = (papel, perm) => ({ blocked: true, reason: `papel ${papel || '?'} não possui ${perm} — barreira no motor, não no botão` });
  const semMotivo = m => !m || !String(m).trim() ? { blocked: true, reason: 'ação exige motivo — recusada' } : null;

  const TIPOS_CANAL = ['Shopee', 'Mercado Livre', 'TikTok Shop', 'Magalu', 'Amazon', 'Shein',
    'Loja Física', 'Site Próprio', 'WhatsApp', 'Instagram', 'Outro Marketplace', 'Outro Canal'];
  const MKT_KEY = { 'Shopee': 'shopee', 'Mercado Livre': 'ml', 'TikTok Shop': 'tiktok', 'Magalu': 'magalu' };
  const MODOS_ACESSO = ['Sem conexão', 'Importação manual', 'OAuth conectado', 'API oficial conectada', 'Leitura autorizada', 'Escrita bloqueada'];
  const FUNCOES = ['Owner', 'Administrador', 'Financeiro', 'Operação', 'Catálogo', 'Atendimento', 'Logística', 'Gestor de Marketplace', 'Visualizador', 'Outro'];
  const PERIODICIDADES = ['Mensal', 'Semanal', 'Quinzenal', 'Anual', 'Única', 'Personalizada'];
  const BASES_CALCULO = ['Por pedido', 'Por unidade', 'Por faturamento', 'Por produto', 'Por SKU', 'Por peso', 'Por volume', 'Por frete', 'Por comissão', 'Por regra manual'];
  const METODOS_RATEIO = ['Por pedidos pagos', 'Por unidades vendidas', 'Por faturamento', 'Por margem bruta', 'Por tempo de produção',
    'Por peso', 'Por volume', 'Por categoria', 'Por canal', 'Por participação manual', 'Híbrido'];
  const CATS_FIXO = ['Aluguel', 'Salários', 'Pró-labore', 'Energia', 'Água', 'Internet', 'Telefone', 'Sistemas', 'Contabilidade',
    'Consultoria', 'Marketing fixo', 'Depreciação', 'Manutenção', 'Segurança', 'Embalagem estrutural', 'Armazenagem', 'Logística fixa', 'Outros'];
  const CATS_VARIAVEL = ['Custo do produto', 'Matéria-prima', 'Custo de compra', 'Mão de obra direta', 'Personalização',
    'Embalagem por pedido', 'Frete de entrada', 'Frete subsidiado', 'Participação de frete', 'Devolução', 'Reembolso',
    'Falha de entrega', 'Taxa por embalagem', 'Taxa operacional por pedido', 'Fulfillment / Full', 'Armazenagem variável', 'Outros'];
  const TIPOS_TAXA = ['Comissão percentual', 'Taxa fixa por venda', 'Taxa de transação', 'Taxa de antecipação', 'Taxa de processamento',
    'Taxa de fulfillment', 'Taxa de serviço', 'Taxa de coleta', 'Taxa de anúncio', 'Taxa de campanha', 'Outra taxa'];

  /* ---------- criação + seed a partir do escopo existente ---------- */
  function createBiz(scope) {
    const biz = { empresas: [], canais: [], contas: [], custosFixos: [], custosVariaveis: [], taxas: [], adsRegras: [],
      rateios: [], produtoCustos: {}, simulacoes: [], audit: [], seq: 0, _scope: scope || null };
    const audit = (acao, detalhe, extra) => biz.audit.push(Object.assign({ id: 'ba' + (++biz.seq), acao, detalhe, em: HOJE, usuario: (extra && extra.usuario) || 'Marcos' }, extra || {}));
    biz._audit = audit;

    if (scope) {
      /* superfície simples sobre a estrutura existente: Empresa → Canal → Conta */
      for (const e of scope.empresas.filter(x => (scope.grupos.find(g => g.id === x.grupoId) || {}).autorizado)) {
        biz.empresas.push({ id: e.id, nome: e.nome, fantasia: e.nome.split(' LTDA')[0].split(' ME')[0], razaoSocial: e.nome,
          cnpj: (scope.cnpjs.find(c => c.empresaId === e.id) || {}).doc || null, status: 'Ativa', seed: true,
          responsavelPrincipal: 'Marcos', telefone: null, email: null, cidade: e.id === 'e1' ? 'Lagoa Santa' : 'São Paulo', estado: e.id === 'e1' ? 'MG' : 'SP',
          responsaveis: [{ nome: 'Marcos', funcao: 'Owner', ativo: true }], endereco: {}, contatos: {}, obs: {}, criadoEm: '2026-05-01', atualizadoEm: HOJE });
        for (const cnpj of scope.cnpjs.filter(c => c.empresaId === e.id))
          for (const s of scope.lojas.filter(l => l.cnpjId === cnpj.id)) {
            biz.canais.push({ id: s.id, empresaId: e.id, nome: s.nome, scopeLojaId: s.id,
              tipo: s.tipo === 'fisica' ? 'Loja Física' : ({ shopee: 'Shopee', ml: 'Mercado Livre', tiktok: 'TikTok Shop', magalu: 'Magalu' }[s.marketplace] || 'Outro Marketplace'),
              marketplace: s.marketplace, status: 'Ativo', responsavel: s.responsavel, seed: true, criadoEm: '2026-05-01' });
            for (const a of scope.contas.filter(x => x.lojaId === s.id))
              biz.contas.push({ id: a.id, canalId: s.id, empresaId: e.id, nomeInterno: a.nome, marketplace: a.marketplace,
                idExterno: null, status: 'Ativa', modoAcesso: 'Importação manual', escrita: 'ESCRITA EXTERNA BLOQUEADA',
                ultimaSincronizacao: null, ultimaImportacao: null, seed: true });
          }
      }
      audit('seed', biz.empresas.length + ' empresa(s), ' + biz.canais.length + ' canal(is), ' + biz.contas.length + ' conta(s) da estrutura existente');
    }
    return biz;
  }

  /* ---------- EMPRESAS ---------- */
  function createEmpresa(biz, dados, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COMPANY_CREATE')) return negar(opts.papel, 'COMPANY_CREATE');
    if (!dados.nome || !String(dados.nome).trim()) return { blocked: true, reason: 'Nome da empresa é obrigatório' };
    if (!dados.responsavelPrincipal) return { blocked: true, reason: 'Responsável principal é obrigatório' };
    /* CNPJ é OPCIONAL — dá para operar antes de ter todos os dados */
    const emp = Object.assign({ fantasia: null, razaoSocial: null, descricao: null, segmento: null, site: null, instagram: null,
      cnpj: null, inscEstadual: null, regimeTributario: null, naturezaJuridica: null, obsFiscais: null,
      endereco: {}, contatos: {}, obs: {}, responsaveis: [], cidade: null, estado: null, telefone: null, email: null },
      dados, { id: 'emp' + (++biz.seq), status: dados.status || 'Em configuração', seed: false, criadoEm: HOJE, atualizadoEm: HOJE });
    if (!emp.responsaveis.length) emp.responsaveis.push({ nome: emp.responsavelPrincipal, funcao: 'Owner', ativo: true });
    biz.empresas.push(emp);
    /* aparece nos FILTROS GLOBAIS automaticamente */
    if (biz._scope) {
      biz._scope.empresas.push({ id: emp.id, grupoId: 'g1', nome: emp.nome });
      biz._scope.cnpjs.push({ id: 'cnpj-' + emp.id, empresaId: emp.id, nome: emp.cnpj ? 'CNPJ principal' : 'sem CNPJ (cadastro inicial)', doc: emp.cnpj || '— opcional' });
    }
    biz._audit('empresa_criada', emp.nome + (emp.cnpj ? '' : ' (sem CNPJ — opcional)'), { usuario: opts.usuario, escopo: emp.id });
    return { ok: true, empresa: emp };
  }

  function editEmpresa(biz, id, campo, valor, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COMPANY_EDIT')) return negar(opts.papel, 'COMPANY_EDIT');
    const e = biz.empresas.find(x => x.id === id);
    if (!e) return { blocked: true, reason: 'empresa não encontrada' };
    const antes = e[campo];
    e[campo] = valor; e.atualizadoEm = HOJE;
    if (campo === 'nome' && biz._scope) { const se = biz._scope.empresas.find(x => x.id === id); if (se) se.nome = valor; }
    biz._audit('empresa_editada', `${e.nome} · ${campo}: "${antes ?? '—'}" → "${valor}"`, { usuario: opts.usuario, antes, depois: valor, escopo: id, motivo: opts.motivo || 'edição de cadastro' });
    return { ok: true, antes };
  }

  const temDados = (biz, empresaId, extra) => {
    const e = biz.empresas.find(x => x.id === empresaId);
    if (!e) return false;
    if (e.seed) return true; /* empresas da operação têm catálogo/pedidos/histórico */
    if (biz.custosFixos.some(c => c.empresaId === empresaId) || biz.custosVariaveis.some(c => c.empresaId === empresaId)) return true;
    if (extra && typeof extra.temDados === 'function') return !!extra.temDados(empresaId);
    return false;
  };

  function desativarEmpresa(biz, id, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COMPANY_ARCHIVE')) return negar(opts.papel, 'COMPANY_ARCHIVE');
    const m = semMotivo(opts.motivo); if (m) return m;
    const e = biz.empresas.find(x => x.id === id);
    if (!e) return { blocked: true, reason: 'empresa não encontrada' };
    e.status = 'Desativada';
    biz._audit('empresa_desativada', e.nome + ' · ' + opts.motivo, { usuario: opts.usuario, escopo: id, motivo: opts.motivo,
      impacto: 'não aceita novas importações nem jobs; sai dos filtros padrão; dados e histórico preservados' });
    return { ok: true, nota: 'desativada — sem novas importações/jobs; histórico preservado' };
  }
  function arquivarEmpresa(biz, id, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COMPANY_ARCHIVE')) return negar(opts.papel, 'COMPANY_ARCHIVE');
    const m = semMotivo(opts.motivo); if (m) return m;
    const e = biz.empresas.find(x => x.id === id);
    if (!e) return { blocked: true, reason: 'empresa não encontrada' };
    e.status = 'Arquivada';
    biz._audit('empresa_arquivada', e.nome + ' · ' + opts.motivo, { usuario: opts.usuario, escopo: id, motivo: opts.motivo,
      impacto: 'fora das listas principais; dados, auditoria e relatórios preservados' });
    return { ok: true };
  }
  function reativarEmpresa(biz, id, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COMPANY_ARCHIVE')) return negar(opts.papel, 'COMPANY_ARCHIVE');
    const e = biz.empresas.find(x => x.id === id);
    if (!e) return { blocked: true, reason: 'empresa não encontrada' };
    e.status = 'Ativa';
    biz._audit('empresa_reativada', e.nome + ' — integrações externas NÃO reativadas automaticamente', { usuario: opts.usuario, escopo: id });
    return { ok: true, nota: 'reativada — conexões externas exigem novo fluxo de autorização' };
  }
  function excluirEmpresa(biz, id, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COMPANY_DELETE_EMPTY')) return negar(opts.papel, 'COMPANY_DELETE_EMPTY');
    const e = biz.empresas.find(x => x.id === id);
    if (!e) return { blocked: true, reason: 'empresa não encontrada' };
    if (temDados(biz, id, opts))
      return { blocked: true, reason: 'empresa com pedidos/catálogo/custos/histórico NÃO pode ser apagada — desative ou arquive (histórico preservado)' };
    if (!opts.confirmado) return { blocked: true, reason: 'exclusão definitiva exige confirmação explícita' };
    biz.empresas = biz.empresas.filter(x => x.id !== id);
    biz.canais = biz.canais.filter(c => c.empresaId !== id);
    if (biz._scope) {
      biz._scope.empresas = biz._scope.empresas.filter(x => x.id !== id);
      biz._scope.cnpjs = biz._scope.cnpjs.filter(x => x.empresaId !== id);
    }
    biz._audit('empresa_excluida', e.nome + ' (vazia — sem dados; confirmada)', { usuario: opts.usuario, motivo: opts.motivo || 'cadastro vazio' });
    return { ok: true };
  }
  const empresasVisiveis = (biz, opts) => biz.empresas.filter(e =>
    (opts && opts.incluirArquivadas) ? true : !['Arquivada', 'Desativada'].includes(e.status));

  /* ---------- CANAIS DE VENDA ---------- */
  function addCanal(biz, empresaId, canal, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'CHANNEL_CREATE')) return negar(opts.papel, 'CHANNEL_CREATE');
    const e = biz.empresas.find(x => x.id === empresaId);
    if (!e) return { blocked: true, reason: 'empresa não encontrada' };
    if (!canal.nome || !canal.tipo) return { blocked: true, reason: 'Nome do canal e Tipo de canal são obrigatórios' };
    if (!TIPOS_CANAL.includes(canal.tipo)) return { blocked: true, reason: 'tipo de canal inválido' };
    const c = Object.assign({ descricao: null, url: null, cidade: null, estado: null, responsavel: null, obs: null },
      canal, { id: 'ch' + (++biz.seq), empresaId, marketplace: MKT_KEY[canal.tipo] || null,
        status: canal.status || 'Em configuração', seed: false, criadoEm: HOJE });
    biz.canais.push(c);
    if (biz._scope) { /* canal entra nos filtros globais como "loja" */
      const cnpj = biz._scope.cnpjs.find(x => x.empresaId === empresaId);
      c.scopeLojaId = c.id;
      biz._scope.lojas.push({ id: c.id, cnpjId: cnpj ? cnpj.id : null, nome: c.nome,
        tipo: c.tipo === 'Loja Física' ? 'fisica' : 'marketplace', marketplace: c.marketplace, deposito: '—', responsavel: c.responsavel || '—' });
    }
    biz._audit('canal_criado', `${e.nome} → ${c.nome} (${c.tipo})`, { usuario: opts.usuario, escopo: empresaId });
    return { ok: true, canal: c };
  }
  function editCanal(biz, id, campo, valor, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'CHANNEL_EDIT')) return negar(opts.papel, 'CHANNEL_EDIT');
    const c = biz.canais.find(x => x.id === id);
    if (!c) return { blocked: true, reason: 'canal não encontrado' };
    const antes = c[campo]; c[campo] = valor;
    if (campo === 'nome' && biz._scope) { const sl = biz._scope.lojas.find(x => x.id === (c.scopeLojaId || id)); if (sl) sl.nome = valor; }
    biz._audit('canal_editado', `${c.nome} · ${campo}: "${antes ?? '—'}" → "${valor}"`, { usuario: opts.usuario, antes, depois: valor, escopo: c.empresaId });
    return { ok: true, antes };
  }
  function statusCanal(biz, id, status, opts) {
    opts = opts || {};
    const perm = status === 'Arquivado' ? 'CHANNEL_ARCHIVE' : 'CHANNEL_EDIT';
    if (!canBiz(opts.papel || 'OWNER', perm)) return negar(opts.papel, perm);
    const m = semMotivo(opts.motivo); if (m) return m;
    const c = biz.canais.find(x => x.id === id);
    if (!c) return { blocked: true, reason: 'canal não encontrado' };
    const antes = c.status; c.status = status;
    biz._audit('canal_' + status.toLowerCase(), `${c.nome}: ${antes} → ${status} · ${opts.motivo}`, { usuario: opts.usuario, motivo: opts.motivo, escopo: c.empresaId });
    return { ok: true };
  }

  /* ---------- CONTAS MARKETPLACE + OAUTH ---------- */
  function addConta(biz, canalId, conta, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'CHANNEL_EDIT')) return negar(opts.papel, 'CHANNEL_EDIT');
    const c = biz.canais.find(x => x.id === canalId);
    if (!c) return { blocked: true, reason: 'canal não encontrado — a conta precisa nascer vinculada ao canal certo' };
    const a = Object.assign({ idExterno: null, url: null, apelido: null, responsavel: null, obs: null },
      conta, { id: 'acc' + (++biz.seq), canalId, empresaId: c.empresaId, marketplace: conta.marketplace || c.marketplace,
        status: 'Ativa', modoAcesso: conta.modoAcesso || 'Sem conexão', escrita: 'ESCRITA EXTERNA BLOQUEADA',
        ultimaSincronizacao: null, ultimaImportacao: null, seed: false });
    biz.contas.push(a);
    if (biz._scope) biz._scope.contas.push({ id: a.id, lojaId: c.scopeLojaId || c.id, marketplace: a.marketplace, nome: a.nomeInterno || a.apelido || a.id });
    biz._audit('conta_criada', `${c.nome} → ${a.nomeInterno || a.id} (${a.marketplace || 'sem marketplace'})`, { usuario: opts.usuario, escopo: c.empresaId });
    return { ok: true, conta: a };
  }

  function connectOAuth(biz, params, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'MARKETPLACE_ACCOUNT_CONNECT')) return negar(opts.papel, 'MARKETPLACE_ACCOUNT_CONNECT');
    /* NUNCA conectar sem empresa e canal definidos */
    if (!params.empresaId) return { blocked: true, reason: 'OAuth exige EMPRESA definida antes de conectar' };
    if (!params.canalId) return { blocked: true, reason: 'OAuth exige CANAL DE VENDA definido antes de conectar' };
    const e = biz.empresas.find(x => x.id === params.empresaId);
    const c = biz.canais.find(x => x.id === params.canalId);
    if (!e || !c) return { blocked: true, reason: 'empresa ou canal não encontrados' };
    if (c.empresaId !== e.id) return { blocked: true, reason: 'canal não pertence à empresa selecionada' };
    let conta = params.contaId ? biz.contas.find(a => a.id === params.contaId) : null;
    if (!conta) {
      const r = addConta(biz, c.id, { nomeInterno: (params.marketplace || c.marketplace) + '·' + e.fantasia, marketplace: params.marketplace || c.marketplace }, opts);
      if (r.blocked) return r;
      conta = r.conta;
    }
    /* honestidade: sem provedor real, a conexão fica AGUARDANDO AUTORIZAÇÃO — nunca simulada como concluída */
    conta.modoAcesso = 'OAuth iniciado — AGUARDANDO AUTORIZAÇÃO DO PROVEDOR (nada conectado de verdade ainda)';
    conta.escopoConexao = { empresa: e.nome, canal: c.nome, marketplace: conta.marketplace, modo: 'Leitura', escrita: 'Bloqueada' };
    biz._audit('oauth_iniciado', `${e.nome} · ${c.nome} · ${conta.marketplace} · modo Leitura · escrita BLOQUEADA`, { usuario: opts.usuario, escopo: e.id });
    return { ok: true, conta, contexto: conta.escopoConexao,
      nota: 'conexão registrada com escopo explícito — leitura apenas; escrita externa bloqueada; conclusão exige autorização real no provedor' };
  }

  /* ---------- vigências: regra financeira nunca reescreve o passado ---------- */
  function novaVigencia(biz, lista, id, mudancas, opts, permEdit) {
    if (!canBiz(opts.papel || 'OWNER', permEdit)) return negar(opts.papel, permEdit);
    const m = semMotivo(opts.motivo); if (m) return m;
    const atual = lista.find(x => x.id === id);
    if (!atual) return { blocked: true, reason: 'registro não encontrado' };
    atual.fimVigencia = HOJE; atual.status = 'Encerrado';
    const novo = Object.assign({}, atual, mudancas, { id: atual.id.replace(/-v\d+$/, '') + '-v' + (++biz.seq),
      inicioVigencia: HOJE, fimVigencia: null, status: 'Ativo', anteriorId: atual.id });
    lista.push(novo);
    biz._audit('vigencia_criada', `${atual.nome || atual.id}: nova vigência (${Object.keys(mudancas).join(', ')}) · ${opts.motivo}`,
      { usuario: opts.usuario, antes: JSON.stringify(mudancas).length > 0 ? Object.fromEntries(Object.keys(mudancas).map(k => [k, atual[k]])) : null,
        depois: mudancas, motivo: opts.motivo, impacto: 'vigência anterior preservada — o passado não é reescrito' });
    return { ok: true, anterior: atual, novo };
  }

  /* ---------- CUSTOS FIXOS ---------- */
  const fatorMensal = { 'Mensal': 1, 'Semanal': 4.33, 'Quinzenal': 2, 'Anual': 1 / 12, 'Única': 0, 'Personalizada': 1 };
  function addCustoFixo(biz, cf, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COST_CENTER_EDIT')) return negar(opts.papel, 'COST_CENTER_EDIT');
    for (const k of ['nome', 'categoria', 'valor', 'periodicidade', 'inicio', 'empresaId'])
      if (cf[k] == null || cf[k] === '') return { blocked: true, reason: 'custo fixo exige ' + k };
    if (!PERIODICIDADES.includes(cf.periodicidade)) return { blocked: true, reason: 'periodicidade inválida' };
    const c = Object.assign({ canalId: null, marketplace: null, centroCusto: null, criterioRateio: null,
      fonte: 'MANUAL', comprovante: null, obs: null, fim: null }, cf,
      { id: 'cfx' + (++biz.seq), status: cf.status || 'Ativo', inicioVigencia: HOJE, fimVigencia: null,
        valorMensal: round2(+cf.valor * (fatorMensal[cf.periodicidade] ?? 1)) });
    biz.custosFixos.push(c);
    biz._audit('custo_fixo_criado', `${c.nome} (${c.categoria}) R$ ${c.valor} ${c.periodicidade} · ${c.empresaId}`, { usuario: opts.usuario, escopo: c.empresaId });
    return { ok: true, custo: c };
  }

  /* ---------- CUSTOS VARIÁVEIS ---------- */
  function addCustoVariavel(biz, cv, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COST_CENTER_EDIT')) return negar(opts.papel, 'COST_CENTER_EDIT');
    if (!cv.nome || !cv.categoria || !cv.base) return { blocked: true, reason: 'custo variável exige nome, categoria e base de cálculo' };
    if (!BASES_CALCULO.includes(cv.base)) return { blocked: true, reason: 'base de cálculo inválida' };
    if (cv.valorFixo == null && cv.percentual == null) return { blocked: true, reason: 'informe valor fixo ou percentual' };
    const c = Object.assign({ empresaId: null, canalId: null, marketplace: null, produtoId: null, sku: null, categoriaProduto: null, fonte: 'MANUAL', obs: null },
      cv, { id: 'cvr' + (++biz.seq), status: 'Ativo', inicioVigencia: HOJE, fimVigencia: null });
    biz.custosVariaveis.push(c);
    biz._audit('custo_variavel_criado', `${c.nome} (${c.categoria}) ${c.percentual != null ? c.percentual + '%' : 'R$ ' + c.valorFixo} ${c.base}`, { usuario: opts.usuario, escopo: c.empresaId });
    return { ok: true, custo: c };
  }

  /* ---------- TAXAS DE MARKETPLACE (prioridade explicada) ---------- */
  function addTaxa(biz, t, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COST_RULE_CREATE')) return negar(opts.papel, 'COST_RULE_CREATE');
    if (!t.marketplace || !t.empresaId || !t.tipo) return { blocked: true, reason: 'taxa exige marketplace, empresa e tipo' };
    if (!TIPOS_TAXA.includes(t.tipo)) return { blocked: true, reason: 'tipo de taxa inválido' };
    if (t.percentual == null && t.valorFixo == null) return { blocked: true, reason: 'taxa sem percentual nem valor é taxa inventada — recusada' };
    const taxa = Object.assign({ canalId: null, contaId: null, categoria: null, produtoId: null, sku: null,
      base: 'Por faturamento', fonte: 'MANUAL', obs: null }, t,
      { id: 'tax' + (++biz.seq), status: 'Ativo', inicioVigencia: t.inicio || HOJE, fimVigencia: t.fim || null });
    biz.taxas.push(taxa);
    biz._audit('taxa_criada', `${taxa.tipo} ${taxa.percentual != null ? taxa.percentual + '%' : 'R$ ' + taxa.valorFixo} · ${taxa.marketplace}${taxa.sku ? ' · SKU ' + taxa.sku : taxa.produtoId ? ' · produto' : ''}`, { usuario: opts.usuario, escopo: taxa.empresaId });
    return { ok: true, taxa };
  }
  /* prioridade: SKU → Produto → Categoria → Conta → Canal → Empresa → Marketplace padrão */
  const NIVEIS_TAXA = [
    ['SKU específico', (t, ctx) => t.sku && t.sku === ctx.sku],
    ['Produto', (t, ctx) => t.produtoId && t.produtoId === ctx.produtoId && !t.sku],
    ['Categoria', (t, ctx) => t.categoria && t.categoria === ctx.categoria && !t.produtoId && !t.sku],
    ['Conta marketplace', (t, ctx) => t.contaId && t.contaId === ctx.contaId && !t.categoria && !t.produtoId && !t.sku],
    ['Canal', (t, ctx) => t.canalId && t.canalId === ctx.canalId && !t.contaId && !t.categoria && !t.produtoId && !t.sku],
    ['Empresa', (t, ctx) => t.empresaId === ctx.empresaId && !t.canalId && !t.contaId && !t.categoria && !t.produtoId && !t.sku],
    ['Marketplace padrão', (t, ctx) => !t.canalId && !t.contaId && !t.categoria && !t.produtoId && !t.sku],
  ];
  function taxaAplicavel(biz, tipo, ctx) {
    const ativas = biz.taxas.filter(t => t.status === 'Ativo' && t.tipo === tipo && t.marketplace === ctx.marketplace && !t.fimVigencia);
    for (const [nivel, match] of NIVEIS_TAXA) {
      const hit = ativas.find(t => match(t, ctx));
      if (hit) return { taxa: hit, nivel, explicacao: `regra usada: ${nivel} (${hit.id}) — ${hit.percentual != null ? hit.percentual + '%' : 'R$ ' + hit.valorFixo} · fonte ${hit.fonte}` };
    }
    return { taxa: null, nivel: null, explicacao: 'nenhuma taxa cadastrada para este contexto — o cálculo declara a ausência, nunca inventa' };
  }

  /* ---------- ADS, CUPONS E AFILIADOS ---------- */
  function addAdsRegra(biz, r, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COST_RULE_CREATE')) return negar(opts.papel, 'COST_RULE_CREATE');
    if (!r.tipo || (r.valor == null && r.percentual == null)) return { blocked: true, reason: 'regra exige tipo e valor/percentual' };
    const reg = Object.assign({ empresaId: null, canalId: null, marketplace: null, contaId: null, categoria: null,
      produtoId: null, sku: null, periodo: null, campanha: null, fonte: 'ESTIMATIVA MANUAL' }, r,
      { id: 'ads' + (++biz.seq), status: 'Ativo', inicioVigencia: HOJE, fimVigencia: null });
    biz.adsRegras.push(reg);
    biz._audit('ads_regra_criada', `${reg.tipo} ${reg.percentual != null ? reg.percentual + '%' : 'R$ ' + reg.valor}`, { usuario: opts.usuario, escopo: reg.empresaId });
    return { ok: true, regra: reg };
  }
  /* dado importado REAL tem prioridade sobre estimativa manual (período/escopo compatíveis) */
  function custoAdsEfetivo(biz, ctx, importadoReal) {
    if (importadoReal && importadoReal.valor != null && importadoReal.periodoCompativel !== false)
      return { valor: importadoReal.valor, fonte: 'DADO IMPORTADO (planilha real: ' + (importadoReal.arquivo || 'importação') + ')',
        regra: 'prioridade de dado real sobre estimativa — período e escopo compatíveis', estimado: false };
    const regra = biz.adsRegras.find(r => r.status === 'Ativo' && (!r.marketplace || r.marketplace === ctx.marketplace) &&
      (!r.produtoId || r.produtoId === ctx.produtoId));
    if (!regra) return { valor: null, fonte: 'NO_DATA', regra: 'sem regra e sem dado importado — declarado ausente', estimado: true };
    const valor = regra.percentual != null ? round2((ctx.faturamento || 0) * regra.percentual / 100) : regra.valor;
    return { valor, fonte: regra.fonte, regra: regra.tipo + ' (' + regra.id + ')', estimado: true };
  }

  /* ---------- REGRAS DE RATEIO ---------- */
  function addRateio(biz, r, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COST_RULE_CREATE')) return negar(opts.papel, 'COST_RULE_CREATE');
    if (!r.nome || !r.metodo || !r.empresaId) return { blocked: true, reason: 'regra de rateio exige nome, método e empresa' };
    if (!METODOS_RATEIO.includes(r.metodo)) return { blocked: true, reason: 'método de rateio inválido' };
    const reg = Object.assign({ canalId: null, marketplace: null, categoria: null, produtoId: null, sku: null,
      peso: 1, responsavel: null, motivo: null, obs: null }, r,
      { id: 'rat' + (++biz.seq), status: 'Ativo', inicioVigencia: HOJE, fimVigencia: null });
    biz.rateios.push(reg);
    biz._audit('rateio_criado', `${reg.nome} · ${reg.metodo}`, { usuario: opts.usuario, escopo: reg.empresaId });
    return { ok: true, regra: reg };
  }

  function calcularRateio(biz, params) {
    /* params: { empresaId, canalId?, base: { pedidosPagos, unidades, faturamento, faturamentoItem? }, fonteBase, periodo } */
    const regra = biz.rateios.find(r => r.status === 'Ativo' && r.empresaId === params.empresaId &&
      (!r.canalId || r.canalId === params.canalId)) || null;
    const fixos = biz.custosFixos.filter(c => c.status === 'Ativo' && c.empresaId === params.empresaId &&
      (!c.canalId || !params.canalId || c.canalId === params.canalId));
    const total = round2(fixos.reduce((a, c) => a + c.valorMensal, 0));
    if (!total) return { semCustoFixo: true, valorTotal: 0, explicacao: 'nenhum custo fixo ativo — nada a ratear' };
    if (!regra) return { semRegra: true, valorTotal: total,
      explicacao: 'custo fixo existe (R$ ' + total + '/mês) mas NENHUMA regra de rateio foi definida — o custo fixo não é jogado automaticamente' };
    const b = params.base || {};
    const out = { regra: regra.nome, metodo: regra.metodo, valorTotal: total, periodo: params.periodo || 'mês corrente',
      fonteBase: params.fonteBase || 'não declarada', confianca: params.fonteBase ? 'média — depende da cobertura da base' : 'baixa — base sem fonte',
      cobertura: params.cobertura || 'parcial' };
    if (regra.metodo === 'Por pedidos pagos') {
      if (!b.pedidosPagos) return Object.assign(out, { insuficiente: true, explicacao: 'sem pedidos pagos no período — rateio por pedido não calculável' });
      out.baseUtilizada = b.pedidosPagos + ' pedido(s) pago(s)';
      out.porPedido = round2(total / b.pedidosPagos);
      out.explicacao = `método: Por pedidos pagos · R$ ${total} ÷ ${b.pedidosPagos} pedidos = R$ ${out.porPedido}/pedido · base: ${out.fonteBase}`;
    } else if (regra.metodo === 'Por faturamento') {
      if (!b.faturamento) return Object.assign(out, { insuficiente: true, explicacao: 'sem faturamento no período — rateio por participação não calculável' });
      out.baseUtilizada = 'R$ ' + b.faturamento + ' de faturamento';
      out.percentualSobreFaturamento = round2((total / b.faturamento) * 100);
      if (b.faturamentoItem != null) {
        out.participacao = round2((b.faturamentoItem / b.faturamento) * 100);
        out.valorItem = round2(total * b.faturamentoItem / b.faturamento);
        out.explicacao = `método: Por faturamento · item faturou R$ ${b.faturamentoItem} de R$ ${b.faturamento} (${out.participacao}%) → R$ ${out.valorItem} de custo fixo · base: ${out.fonteBase}`;
      } else out.explicacao = `método: Por faturamento · custo fixo = ${out.percentualSobreFaturamento}% do faturamento · base: ${out.fonteBase}`;
    } else if (regra.metodo === 'Por unidades vendidas') {
      if (!b.unidades) return Object.assign(out, { insuficiente: true, explicacao: 'sem unidades no período' });
      out.baseUtilizada = b.unidades + ' unidade(s)';
      out.porUnidade = round2(total / b.unidades);
      out.explicacao = `método: Por unidades vendidas · R$ ${total} ÷ ${b.unidades} = R$ ${out.porUnidade}/unidade · base: ${out.fonteBase}`;
    } else {
      out.metodoGenerico = true;
      out.explicacao = `método "${regra.metodo}" configurado — informe a base correspondente para calcular (nada é assumido)`;
    }
    return out;
  }

  /* ---------- CUSTO POR PRODUTO (vigência preservada) ---------- */
  const CAMPOS_CUSTO_PRODUTO = ['custoCompra', 'custoProducao', 'materiaPrima', 'maoDeObra', 'personalizacao', 'embalagem',
    'freteEntrada', 'participacaoFreteSaida', 'freteSubsidiadoPct', 'devolucaoEstimado', 'reembolsoEstimado', 'margemMinimaPct'];
  function setProdutoCusto(biz, produtoId, campos, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'PRODUCT_COST_EDIT')) return negar(opts.papel, 'PRODUCT_COST_EDIT');
    const atual = biz.produtoCustos[produtoId];
    if (atual) { /* preserva custo antigo por período — vigência */
      atual.fimVigencia = HOJE;
      (biz.produtoCustos['_hist_' + produtoId] = biz.produtoCustos['_hist_' + produtoId] || []).push(atual);
    }
    biz.produtoCustos[produtoId] = Object.assign({}, campos,
      { produtoId, inicioVigencia: HOJE, fimVigencia: null, fonte: opts.fonte || 'MANUAL', autor: opts.usuario || 'Marcos' });
    biz._audit('custo_produto_definido', produtoId + ': ' + Object.keys(campos).join(', ') + (atual ? ' (vigência anterior preservada)' : ''),
      { usuario: opts.usuario, antes: atual ? Object.fromEntries(Object.keys(campos).map(k => [k, atual[k]])) : null, depois: campos, escopo: produtoId });
    return { ok: true, custo: biz.produtoCustos[produtoId], vigenciasAnteriores: (biz.produtoCustos['_hist_' + produtoId] || []).length };
  }
  const custoProdutoVigente = (biz, produtoId) => biz.produtoCustos[produtoId] || null;
  const custoProdutoHistorico = (biz, produtoId) => biz.produtoCustos['_hist_' + produtoId] || [];

  /* ---------- ECONOMIA DO PRODUTO (fórmula visível, linha a linha) ---------- */
  function economiaProduto(biz, params) {
    /* params: { produtoId, sku, marketplace, empresaId, canalId, contaId, categoria, preco,
                 base: { pedidosPagos, faturamento, faturamentoItem }, adsReal? } */
    const cp = custoProdutoVigente(biz, params.produtoId);
    const faltando = [];
    if (!cp) faltando.push('custo individual do produto (cadastre em Economia do Produto)');
    if (!params.preco) faltando.push('preço de venda');
    const linhas = [];
    const li = (item, valor, fonte, regra, estimado) => { linhas.push({ item, valor: valor != null ? round2(valor) : null, fonte, regra: regra || null, estimado: !!estimado, periodo: params.periodo || 'vigente' }); return valor || 0; };

    const preco = params.preco || 0;
    li('Preço de venda', preco, params.fontePreco || 'catálogo interno', null, false);
    let custos = 0;
    custos += li('Custo individual do produto', cp ? (cp.custoCompra || 0) + (cp.custoProducao || 0) + (cp.materiaPrima || 0) + (cp.maoDeObra || 0) + (cp.personalizacao || 0) : null, cp ? cp.fonte : 'NO_DATA', cp ? 'vigência ' + cp.inicioVigencia : 'sem cadastro', !cp);
    custos += li('Custo de embalagem', cp ? (cp.embalagem || 0) : null, cp ? cp.fonte : 'NO_DATA', null, !cp);
    custos += li('Frete subsidiado', cp && cp.freteSubsidiadoPct ? preco * cp.freteSubsidiadoPct / 100 : 0, cp ? cp.fonte : 'NO_DATA', cp && cp.freteSubsidiadoPct ? cp.freteSubsidiadoPct + '% do preço' : 'não configurado', true);

    const ctxTaxa = { marketplace: params.marketplace, empresaId: params.empresaId, canalId: params.canalId, contaId: params.contaId, categoria: params.categoria, produtoId: params.produtoId, sku: params.sku };
    const comissao = taxaAplicavel(biz, 'Comissão percentual', ctxTaxa);
    custos += li('Comissão marketplace', comissao.taxa ? preco * comissao.taxa.percentual / 100 : null,
      comissao.taxa ? comissao.taxa.fonte : 'NO_DATA', comissao.explicacao, !comissao.taxa || comissao.taxa.fonte === 'MANUAL');
    const taxaFixa = taxaAplicavel(biz, 'Taxa fixa por venda', ctxTaxa);
    custos += li('Taxa fixa por venda', taxaFixa.taxa ? (taxaFixa.taxa.valorFixo || 0) : null, taxaFixa.taxa ? taxaFixa.taxa.fonte : 'NO_DATA', taxaFixa.explicacao, !taxaFixa.taxa);
    const transacao = taxaAplicavel(biz, 'Taxa de transação', ctxTaxa);
    custos += li('Taxa de transação', transacao.taxa ? (transacao.taxa.percentual != null ? preco * transacao.taxa.percentual / 100 : transacao.taxa.valorFixo) : null, transacao.taxa ? transacao.taxa.fonte : 'NO_DATA', transacao.explicacao, true);

    const ads = custoAdsEfetivo(biz, { marketplace: params.marketplace, produtoId: params.produtoId, faturamento: preco }, params.adsReal);
    custos += li('Ads / afiliado / cupom', ads.valor, ads.fonte, ads.regra, ads.estimado);
    custos += li('Custo de devolução estimado', cp ? (cp.devolucaoEstimado || 0) : null, cp ? cp.fonte : 'NO_DATA', null, true);

    const margemContribuicao = round2(preco - custos);
    const rateio = calcularRateio(biz, { empresaId: params.empresaId, canalId: params.canalId, base: params.base, fonteBase: params.fonteBase, periodo: params.periodo });
    /* valorItem é a cota do produto NO PERÍODO — vira unitário só com as unidades do item */
    const unidadesItem = params.base && params.base.unidadesItem;
    const fixoUnit = rateio.porPedido != null ? rateio.porPedido
      : rateio.porUnidade != null ? rateio.porUnidade
      : (rateio.valorItem != null && unidadesItem ? round2(rateio.valorItem / unidadesItem) : null);
    li('Custo fixo rateado (por venda)', fixoUnit, rateio.semRegra || rateio.semCustoFixo || rateio.insuficiente || fixoUnit == null ? 'NO_DATA' : 'regra de rateio',
      rateio.valorItem != null && !unidadesItem ? rateio.explicacao + ' — informe as unidades vendidas do item para o valor por venda' : rateio.explicacao, true);
    if (fixoUnit == null && !rateio.semCustoFixo) faltando.push('rateio de custo fixo (' + (rateio.explicacao || 'defina regra e base') + ')');

    const margemLiquida = fixoUnit != null ? round2(margemContribuicao - fixoUnit) : null;
    const coberturaInsuficiente = faltando.length > 0;
    const custoBase = cp ? (cp.custoCompra || 0) + (cp.custoProducao || 0) + (cp.materiaPrima || 0) + (cp.maoDeObra || 0) + (cp.personalizacao || 0) + (cp.embalagem || 0) : null;
    const margemMinima = cp && cp.margemMinimaPct != null ? cp.margemMinimaPct : 10;
    const pctCustosVariaveisSobrePreco = preco ? (custos - (custoBase || 0)) / preco : 0;
    const precoMinimoSeguro = custoBase != null && preco
      ? round2((custoBase + (fixoUnit || 0)) / Math.max(0.01, 1 - pctCustosVariaveisSobrePreco - margemMinima / 100)) : null;

    return {
      linhas, faltando, coberturaInsuficiente,
      cobertura: coberturaInsuficiente ? 'INSUFICIENTE — ' + faltando.join('; ') : 'completa para estimativa',
      margemContribuicao, margemContribuicaoPct: preco ? round2((margemContribuicao / preco) * 100) : null,
      margemLiquidaEstimada: margemLiquida,
      margemLiquidaEstimadaPct: margemLiquida != null && preco ? round2((margemLiquida / preco) * 100) : null,
      lucroOperacionalEstimadoUnidade: margemLiquida,
      precoMinimoSeguro, precoRecomendado: precoMinimoSeguro != null ? round2(precoMinimoSeguro * 1.25) : null,
      formula: 'preço − custo do produto − embalagem − frete subsidiado − comissão − taxa fixa − transação − ads/afiliado/cupom − devolução estimada − custo fixo rateado = margem líquida ESTIMADA por venda',
      aviso: 'estimativa por regras — NÃO é lucro real conciliado',
    };
  }

  /* ---------- VISÃO FINANCEIRA + PONTO DE EQUILÍBRIO ---------- */
  function breakEven(params) {
    /* params: { custoFixoTotal, margemContribuicaoPct, margemPorPedido, realizado:{faturamento,pedidosPagos}, diasRestantes } */
    const faltas = [];
    if (!params.custoFixoTotal) faltas.push('custo fixo cadastrado');
    if (params.margemContribuicaoPct == null && params.margemPorPedido == null) faltas.push('margem de contribuição');
    if (!params.realizado || params.realizado.faturamento == null) faltas.push('dados de vendas do período');
    if (faltas.length) return { insuficiente: true, mensagem: 'Dados insuficientes para calcular ponto de equilíbrio.', faltando: faltas };
    const out = { custoFixoTotal: params.custoFixoTotal };
    if (params.margemContribuicaoPct != null) {
      out.faturamentoBE = round2(params.custoFixoTotal / (params.margemContribuicaoPct / 100));
      out.formulaFaturamento = `R$ ${params.custoFixoTotal} ÷ ${params.margemContribuicaoPct}% = R$ ${out.faturamentoBE}`;
      out.faltaFaturamento = round2(Math.max(0, out.faturamentoBE - params.realizado.faturamento));
    }
    if (params.margemPorPedido != null && params.margemPorPedido > 0) {
      out.pedidosBE = Math.ceil(params.custoFixoTotal / params.margemPorPedido);
      out.formulaPedidos = `R$ ${params.custoFixoTotal} ÷ R$ ${params.margemPorPedido}/pedido = ${out.pedidosBE} pedidos pagos`;
      out.faltaPedidos = Math.max(0, out.pedidosBE - (params.realizado.pedidosPagos || 0));
    }
    if (params.unidadeMargem) out.unidadesBE = Math.ceil(params.custoFixoTotal / params.unidadeMargem);
    if (params.diasRestantes && out.faltaFaturamento != null) {
      out.diasRestantes = params.diasRestantes;
      out.mediaDiariaNecessaria = round2(out.faltaFaturamento / params.diasRestantes);
    }
    out.realizado = params.realizado;
    out.atingido = out.faltaFaturamento === 0;
    return out;
  }

  function visaoFinanceira(biz, params) {
    /* params: { empresaId, canalId?, vendas: { faturamento, pedidosPagos, unidades, fonte, periodo }, diasRestantes } */
    const v = params.vendas || {};
    const fixos = biz.custosFixos.filter(c => c.status === 'Ativo' && c.empresaId === params.empresaId && (!params.canalId || !c.canalId || c.canalId === params.canalId));
    const custoFixoTotal = round2(fixos.reduce((a, c) => a + c.valorMensal, 0));
    /* custo variável estimado por regras ativas (% sobre faturamento + fixo por pedido) */
    const vars = biz.custosVariaveis.filter(c => c.status === 'Ativo' && (!c.empresaId || c.empresaId === params.empresaId));
    let custoVariavel = 0; const regrasUsadas = [];
    for (const c of vars) {
      if (c.percentual != null && c.base === 'Por faturamento' && v.faturamento) { custoVariavel += v.faturamento * c.percentual / 100; regrasUsadas.push(c.nome + ' (' + c.percentual + '% faturamento)'); }
      else if (c.valorFixo != null && c.base === 'Por pedido' && v.pedidosPagos) { custoVariavel += c.valorFixo * v.pedidosPagos; regrasUsadas.push(c.nome + ' (R$ ' + c.valorFixo + '/pedido)'); }
      else if (c.valorFixo != null && c.base === 'Por unidade' && v.unidades) { custoVariavel += c.valorFixo * v.unidades; regrasUsadas.push(c.nome + ' (R$ ' + c.valorFixo + '/unidade)'); }
    }
    custoVariavel = round2(custoVariavel);
    const margemContribuicao = v.faturamento != null ? round2(v.faturamento - custoVariavel) : null;
    const margemContribuicaoPct = v.faturamento ? round2((margemContribuicao / v.faturamento) * 100) : null;
    const rateio = calcularRateio(biz, { empresaId: params.empresaId, canalId: params.canalId, base: { pedidosPagos: v.pedidosPagos, faturamento: v.faturamento, unidades: v.unidades }, fonteBase: v.fonte, periodo: v.periodo });
    const be = breakEven({ custoFixoTotal, margemContribuicaoPct,
      margemPorPedido: margemContribuicao != null && v.pedidosPagos ? round2(margemContribuicao / v.pedidosPagos) : null,
      realizado: { faturamento: v.faturamento, pedidosPagos: v.pedidosPagos }, diasRestantes: params.diasRestantes });
    return {
      periodo: v.periodo || '—', empresaId: params.empresaId, canalId: params.canalId || 'todos',
      faturamentoBruto: v.faturamento ?? null, pedidosPagos: v.pedidosPagos ?? null,
      receitaLiquidaEstimada: v.faturamento != null ? round2(v.faturamento - custoVariavel) : null,
      custoVariavelEstimado: custoVariavel, custoFixoTotal,
      custoFixoAbsorvido: rateio.porPedido != null && v.pedidosPagos ? round2(Math.min(custoFixoTotal, rateio.porPedido * v.pedidosPagos)) : null,
      margemContribuicao, margemContribuicaoPct,
      margemLiquidaEstimada: margemContribuicao != null ? round2(margemContribuicao - custoFixoTotal) : null,
      lucroOperacionalEstimado: margemContribuicao != null ? round2(margemContribuicao - custoFixoTotal) : null,
      breakEven: be, rateio, regrasUsadas,
      origemDados: { vendas: v.fonte || 'não declarada', custos: 'cadastro manual do Centro de Custos', regras: regrasUsadas.length + ' regra(s) variável(is) aplicada(s)' },
      cobertura: (!fixos.length ? 'sem custo fixo cadastrado; ' : '') + (!vars.length ? 'sem custo variável cadastrado; ' : '') + (v.fonte ? 'vendas: ' + v.fonte : 'vendas sem fonte'),
      aviso: 'valores ESTIMADOS por regras — nunca apresentados como lucro real sem conciliação financeira',
    };
  }

  /* ---------- SIMULADOR DE PREÇO (interno; nunca altera anúncio) ---------- */
  function simularPreco(biz, params, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COST_SIMULATOR_USE')) return negar(opts.papel, 'COST_SIMULATOR_USE');
    const atual = economiaProduto(biz, Object.assign({}, params, { preco: params.precoAtual }));
    const simulado = economiaProduto(biz, Object.assign({}, params, { preco: params.precoNovo }));
    const sim = {
      id: 'sim' + (++biz.seq), em: HOJE, autor: opts.usuario || 'Marcos',
      produtoId: params.produtoId, marketplace: params.marketplace,
      precoAtual: params.precoAtual, precoNovo: params.precoNovo,
      margemContribuicaoAtual: atual.margemContribuicao, margemContribuicaoSimulada: simulado.margemContribuicao,
      margemLiquidaAtual: atual.margemLiquidaEstimada, margemLiquidaSimulada: simulado.margemLiquidaEstimada,
      precoMinimoSeguro: simulado.precoMinimoSeguro, precoRecomendado: simulado.precoRecomendado,
      riscoMargemNegativa: simulado.margemContribuicao < 0 || (simulado.margemLiquidaEstimada != null && simulado.margemLiquidaEstimada < 0),
      impactoBE: atual.margemContribuicao > 0 && simulado.margemContribuicao > 0
        ? round2(((atual.margemContribuicao / simulado.margemContribuicao) - 1) * 100) + '% na quantidade necessária para o mesmo resultado' : 'não calculável',
      externo: 'SIMULAÇÃO INTERNA — o preço real do anúncio NÃO é alterado',
    };
    return { ok: true, simulacao: sim, atual, simulado };
  }
  function salvarSimulacao(biz, sim, opts) {
    opts = opts || {};
    if (!canBiz(opts.papel || 'OWNER', 'COST_SIMULATOR_USE')) return negar(opts.papel, 'COST_SIMULATOR_USE');
    biz.simulacoes.push(sim);
    biz._audit('simulacao_salva', `${sim.produtoId}: R$ ${sim.precoAtual} → R$ ${sim.precoNovo} (interno)`, { usuario: opts.usuario });
    return { ok: true };
  }

  /* ---------- INSIGHTS FINANCEIROS (para a Central de Inteligência) ---------- */
  function insightsFinanceiros(biz, dados) {
    /* dados: { empresaId, vendas, porProduto: [{produtoId, nome, preco, faturamento, vendidos, marketplace, sku}], diasRestantes } */
    const out = [];
    const push = (nivel, titulo, fato, extra) => out.push(Object.assign({
      nivel, titulo, fato, agente: 'Analista Financeiro',
      fontes: 'Centro de Custos (cadastro manual) + vendas: ' + ((dados.vendas || {}).fonte || 'não declarada'),
      periodo: (dados.vendas || {}).periodo || '—', estimadoOuRealizado: 'ESTIMADO por regras',
      confianca: 'média — estimativa, não conciliação financeira',
      acoes: ['Abrir análise', 'Ver fontes', 'Criar missão', 'Silenciar com motivo'],
    }, extra || {}));
    const vf = visaoFinanceira(biz, { empresaId: dados.empresaId, vendas: dados.vendas, diasRestantes: dados.diasRestantes });
    if (vf.breakEven && !vf.breakEven.insuficiente && vf.breakEven.faltaPedidos > 0)
      push('ATENÇÃO', 'Faltam pedidos para o ponto de equilíbrio',
        `Faltam ${vf.breakEven.faltaPedidos} pedidos pagos para atingir o ponto de equilíbrio atual (${vf.breakEven.formulaPedidos})`,
        { regras: vf.rateio.explicacao, cobertura: vf.cobertura, hipotese: null, acao: 'acompanhar média diária necessária' });
    if (vf.breakEven && vf.breakEven.insuficiente)
      push('AGUARDANDO DADOS', 'Ponto de equilíbrio não calculável',
        'Dados insuficientes: falta ' + vf.breakEven.faltando.join(', ') + ' — nada será estimado sem base',
        { cobertura: 'insuficiente', acao: 'cadastrar custos fixos e regra de rateio no Centro de Custos' });
    for (const p of (dados.porProduto || [])) {
      const eco = economiaProduto(biz, { produtoId: p.produtoId, sku: p.sku, marketplace: p.marketplace, empresaId: dados.empresaId, preco: p.preco, base: { pedidosPagos: (dados.vendas || {}).pedidosPagos, faturamento: (dados.vendas || {}).faturamento, faturamentoItem: p.faturamento, unidadesItem: p.vendidos }, fonteBase: (dados.vendas || {}).fonte });
      if (eco.coberturaInsuficiente) continue; /* sem dado não há insight — nunca inventado */
      const meta = (custoProdutoVigente(biz, p.produtoId) || {}).margemMinimaPct ?? 10;
      if (p.vendidos > 0 && eco.margemLiquidaEstimadaPct != null && eco.margemLiquidaEstimadaPct < meta)
        push('ATENÇÃO', 'Vende bem, margem abaixo da meta',
          `"${p.nome}" vendeu ${p.vendidos} un., mas a margem líquida estimada (${eco.margemLiquidaEstimadaPct}%) ficou abaixo da meta (${meta}%)`,
          { regras: eco.linhas.filter(l => l.regra).map(l => l.item + ': ' + l.regra).join(' · '), cobertura: eco.cobertura,
            hipotese: 'comissão/cupom/frete subsidiado pressionam — hipótese, validar por canal', acao: 'simular preço ou renegociar custo' });
    }
    return out;
  }

  return { BIZ_PERMS, BIZ_PERMS_ALL, canBiz, TIPOS_CANAL, MODOS_ACESSO, FUNCOES, PERIODICIDADES, BASES_CALCULO,
    METODOS_RATEIO, CATS_FIXO, CATS_VARIAVEL, TIPOS_TAXA, NIVEIS_TAXA: NIVEIS_TAXA.map(n => n[0]), CAMPOS_CUSTO_PRODUTO,
    createBiz, createEmpresa, editEmpresa, temDados, desativarEmpresa, arquivarEmpresa, reativarEmpresa, excluirEmpresa,
    empresasVisiveis, addCanal, editCanal, statusCanal, addConta, connectOAuth, novaVigencia,
    addCustoFixo, addCustoVariavel, addTaxa, taxaAplicavel, addAdsRegra, custoAdsEfetivo, addRateio, calcularRateio,
    setProdutoCusto, custoProdutoVigente, custoProdutoHistorico, economiaProduto, breakEven, visaoFinanceira,
    simularPreco, salvarSimulacao, insightsFinanceiros };
}));
