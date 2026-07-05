/* =============================================================
   SPRINT 10.E.4 — Empresas, Canais e Centro de Custos (43 testes)
   Cadastro manual sem burocracia (CNPJ opcional), canais e contas
   nos filtros globais, OAuth só com empresa+canal, exclusão segura,
   custos com vigência, taxas com prioridade explicada, rateio
   explicável, economia por produto com fórmula, ponto de equilíbrio
   honesto, simulador interno e permissões no motor.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8BIZ = require('../../design/prototipo-v8/business-engine.js');
const DATA = require('../../design/prototipo-v8/data.js');
const D = DATA.V8DATA || DATA;

const read = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const empJs = read('empresas.js');
const cusJs = read('custos.js');
const scopeClone = () => JSON.parse(JSON.stringify(D.scope));
const novo = () => { const s = scopeClone(); return { biz: V8BIZ.createBiz(s), scope: s }; };

/* ---------- 01-08 · cadastro manual, filtros globais, multicanal ---------- */
test('01-04 · empresa manual com contatos; CNPJ opcional; entra no filtro global', () => {
  const { biz, scope } = novo();
  assert.equal(V8BIZ.createEmpresa(biz, { responsavelPrincipal: 'Ana' }, {}).blocked, true, 'nome obrigatório');
  assert.equal(V8BIZ.createEmpresa(biz, { nome: 'X' }, {}).blocked, true, 'responsável obrigatório');
  const r = V8BIZ.createEmpresa(biz, { nome: 'Molduras Norte', responsavelPrincipal: 'Paula', cnpj: null,
    telefone: '31 99999-0000', email: 'contato@norte.com', endereco: { cidade: 'Montes Claros', estado: 'MG' } }, {});
  assert.ok(r.ok, 'cadastro manual funciona');
  assert.equal(r.empresa.cnpj, null, 'CNPJ é OPCIONAL no cadastro inicial');
  assert.equal(r.empresa.telefone, '31 99999-0000');
  assert.ok(scope.empresas.some(e => e.nome === 'Molduras Norte'), 'empresa no filtro global automaticamente');
  V8BIZ.editEmpresa(biz, r.empresa.id, 'cnpj', '11.222.333/0001-44', { motivo: 'CNPJ chegou' });
  assert.ok(biz.audit.some(a => a.acao === 'empresa_editada' && a.antes === null), 'edição com antes/depois auditados');
});

test('05-10 · vários canais (Shopee+ML+física) na mesma empresa; canal no filtro; editar/desativar', () => {
  const { biz, scope } = novo();
  const r = V8BIZ.createEmpresa(biz, { nome: 'Multi Canal LTDA', responsavelPrincipal: 'Bruno' }, {});
  const c1 = V8BIZ.addCanal(biz, r.empresa.id, { nome: 'Shopee Multi', tipo: 'Shopee' }, {});
  const c2 = V8BIZ.addCanal(biz, r.empresa.id, { nome: 'ML Multi', tipo: 'Mercado Livre' }, {});
  const c3 = V8BIZ.addCanal(biz, r.empresa.id, { nome: 'Loja Física Centro', tipo: 'Loja Física' }, {});
  assert.ok(c1.ok && c2.ok && c3.ok, 'Shopee + Mercado Livre + loja física ao mesmo tempo');
  assert.equal(biz.canais.filter(c => c.empresaId === r.empresa.id).length, 3, 'empresa com vários canais');
  assert.ok(scope.lojas.some(l => l.nome === 'Shopee Multi'), 'canal aparece no filtro global');
  assert.equal(V8BIZ.addCanal(biz, r.empresa.id, { nome: 'Sem tipo' }, {}).blocked, true, 'tipo obrigatório');
  const ed = V8BIZ.editCanal(biz, c1.canal.id, 'nome', 'Shopee Multi MG', {});
  assert.ok(ed.ok && scope.lojas.some(l => l.nome === 'Shopee Multi MG'), 'edição reflete no filtro global');
  assert.equal(V8BIZ.statusCanal(biz, c2.canal.id, 'Desativado', {}).blocked, true, 'desativar exige motivo');
  assert.ok(V8BIZ.statusCanal(biz, c2.canal.id, 'Desativado', { motivo: 'pausa' }).ok, 'canal desativado');
});

/* ---------- 11-14 · exclusão segura e arquivamento ---------- */
test('11-14 · vazia exclui com confirmação; com dados só arquiva; arquivada some do padrão', () => {
  const { biz, scope } = novo();
  const r = V8BIZ.createEmpresa(biz, { nome: 'Vazia', responsavelPrincipal: 'X' }, {});
  assert.equal(V8BIZ.excluirEmpresa(biz, r.empresa.id, {}).blocked, true, 'exige confirmação');
  assert.ok(V8BIZ.excluirEmpresa(biz, r.empresa.id, { confirmado: true }).ok, 'vazia excluída');
  assert.ok(!scope.empresas.some(e => e.nome === 'Vazia'), 'saiu do filtro global');
  const bloq = V8BIZ.excluirEmpresa(biz, 'e1', { confirmado: true });
  assert.equal(bloq.blocked, true, 'empresa com dados NÃO pode ser apagada');
  assert.match(bloq.reason, /desative ou arquive/);
  assert.equal(V8BIZ.arquivarEmpresa(biz, 'e2', {}).blocked, true, 'arquivar exige motivo');
  V8BIZ.arquivarEmpresa(biz, 'e2', { motivo: 'fim de operação' });
  assert.ok(!V8BIZ.empresasVisiveis(biz).some(e => e.id === 'e2'), 'arquivada fora do filtro padrão');
  assert.ok(V8BIZ.empresasVisiveis(biz, { incluirArquivadas: true }).some(e => e.id === 'e2'), 'dados preservados');
  const re = V8BIZ.reativarEmpresa(biz, 'e2', {});
  assert.match(re.nota, /não|exigem/i, 'reativar não religa integrações externas');
});

/* ---------- 15-16 · OAuth com empresa e canal ---------- */
test('15-16 · OAuth exige empresa e canal; conta nasce vinculada ao canal certo; escrita bloqueada', () => {
  const { biz } = novo();
  assert.equal(V8BIZ.connectOAuth(biz, {}, {}).blocked, true, 'sem empresa');
  assert.match(V8BIZ.connectOAuth(biz, { empresaId: 'e1' }, {}).reason, /CANAL/, 'sem canal');
  const oa = V8BIZ.connectOAuth(biz, { empresaId: 'e1', canalId: 's1', marketplace: 'shopee' }, {});
  assert.ok(oa.ok);
  assert.equal(oa.conta.canalId, 's1', 'conta vinculada ao canal correto');
  assert.equal(oa.contexto.modo, 'Leitura');
  assert.equal(oa.contexto.escrita, 'Bloqueada');
  assert.match(oa.conta.modoAcesso, /AGUARDANDO AUTORIZAÇÃO/, 'nunca simulada como conectada');
  const errado = V8BIZ.connectOAuth(biz, { empresaId: 'e2', canalId: 's1' }, {});
  assert.equal(errado.blocked, true, 'canal de outra empresa recusado');
});

/* ---------- 17-21 · Centro de Custos separado; cadastros ---------- */
test('17-21 · área separada; custo fixo, variável, taxa por marketplace e por SKU', () => {
  /* 10.P.3 — menu reduzido a 6 áreas; Lucratividade e Empresas vivem nas sub-navegações */
  assert.match(read('index.html'), /data-area="crescimento"/, 'Crescimento no menu de áreas');
  assert.match(read('index.html'), /data-area="config"/, 'Configurações no menu de áreas');
  assert.match(read('app.js'), /label: 'Lucratividade', view: 'custos'/, 'Lucratividade na sub-nav de Crescimento');
  assert.match(read('app.js'), /label: 'Empresas e Operações', view: 'empresas'/, 'Empresas e Operações na sub-nav de Configurações');
  assert.ok(!cusJs.includes('Nova Empresa') && !empJs.includes('Adicionar Custo Fixo'), 'cadastro de empresa e custo NÃO se misturam');
  const { biz } = novo();
  const cf = V8BIZ.addCustoFixo(biz, { nome: 'Aluguel', categoria: 'Aluguel', valor: 10000, periodicidade: 'Mensal', inicio: '2026-07-01', empresaId: 'e1' }, {});
  assert.ok(cf.ok && cf.custo.valorMensal === 10000);
  assert.equal(V8BIZ.addCustoFixo(biz, { nome: 'X', categoria: 'Aluguel', valor: 1, periodicidade: 'Mensal', empresaId: 'e1' }, {}).blocked, true, 'campos obrigatórios');
  const cv = V8BIZ.addCustoVariavel(biz, { nome: 'Embalagem', categoria: 'Embalagem por pedido', valorFixo: 2.5, base: 'Por pedido', empresaId: 'e1' }, {});
  assert.ok(cv.ok);
  assert.ok(V8BIZ.addTaxa(biz, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Comissão percentual', percentual: 14 }, {}).ok, 'taxa por marketplace');
  assert.ok(V8BIZ.addTaxa(biz, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Comissão percentual', percentual: 11, sku: 'QP-6090' }, {}).ok, 'taxa por SKU');
  assert.equal(V8BIZ.addTaxa(biz, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Taxa de serviço' }, {}).blocked, true, 'taxa sem valor = taxa inventada → recusada');
});

/* ---------- 22-25 · prioridade e rateio explicado ---------- */
test('22 · regra específica de SKU vence a geral — e o sistema explica', () => {
  const { biz } = novo();
  V8BIZ.addTaxa(biz, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Comissão percentual', percentual: 14 }, {});
  V8BIZ.addTaxa(biz, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Comissão percentual', percentual: 11, sku: 'QP-6090' }, {});
  const sku = V8BIZ.taxaAplicavel(biz, 'Comissão percentual', { marketplace: 'shopee', empresaId: 'e1', sku: 'QP-6090' });
  assert.equal(sku.taxa.percentual, 11); assert.equal(sku.nivel, 'SKU específico');
  const geral = V8BIZ.taxaAplicavel(biz, 'Comissão percentual', { marketplace: 'shopee', empresaId: 'e1', sku: 'OUTRO' });
  assert.equal(geral.taxa.percentual, 14); assert.equal(geral.nivel, 'Empresa');
  assert.match(sku.explicacao, /regra usada: SKU específico/);
  const nada = V8BIZ.taxaAplicavel(biz, 'Taxa de antecipação', { marketplace: 'shopee', empresaId: 'e1' });
  assert.equal(nada.taxa, null); assert.match(nada.explicacao, /nunca inventa/);
});

test('23-25 · rateio por pedidos pagos e por faturamento, com regra informada (exemplos do contrato)', () => {
  const { biz } = novo();
  V8BIZ.addCustoFixo(biz, { nome: 'Fixos', categoria: 'Outros', valor: 10000, periodicidade: 'Mensal', inicio: '2026-07-01', empresaId: 'e1' }, {});
  const semRegra = V8BIZ.calcularRateio(biz, { empresaId: 'e1', base: { pedidosPagos: 1000 } });
  assert.ok(semRegra.semRegra, 'custo fixo NÃO é jogado automaticamente sem regra');
  V8BIZ.addRateio(biz, { nome: 'Padrão', metodo: 'Por pedidos pagos', empresaId: 'e1' }, {});
  const rp = V8BIZ.calcularRateio(biz, { empresaId: 'e1', base: { pedidosPagos: 1000 }, fonteBase: 'pedidos importados', periodo: 'junho' });
  assert.equal(rp.porPedido, 10, 'R$10.000 ÷ 1.000 = R$10/pedido');
  assert.match(rp.explicacao, /Por pedidos pagos.*R\$ 10\/pedido/, 'sistema informa a regra usada');
  assert.ok(rp.fonteBase && rp.periodo && rp.confianca, 'base, fonte, período e confiança declarados');
  V8BIZ.novaVigencia(biz, biz.rateios, biz.rateios[0].id, { metodo: 'Por faturamento' }, { motivo: 'novo critério' }, 'COST_RULE_EDIT');
  const rf = V8BIZ.calcularRateio(biz, { empresaId: 'e1', base: { faturamento: 100000, faturamentoItem: 5000 }, fonteBase: 'faturamento importado' });
  assert.equal(rf.valorItem, 500, 'produto com 5% do faturamento absorve R$500');
  assert.equal(rf.participacao, 5);
});

/* ---------- 26-32 · economia por produto ---------- */
test('26-31 · custo manual, embalagem, frete, comissão explicada, margens com fórmula', () => {
  const { biz } = novo();
  V8BIZ.addTaxa(biz, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Comissão percentual', percentual: 14 }, {});
  V8BIZ.addTaxa(biz, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Taxa fixa por venda', valorFixo: 4 }, {});
  V8BIZ.addCustoFixo(biz, { nome: 'Fixos', categoria: 'Outros', valor: 10000, periodicidade: 'Mensal', inicio: '2026-07-01', empresaId: 'e1' }, {});
  V8BIZ.addRateio(biz, { nome: 'R', metodo: 'Por pedidos pagos', empresaId: 'e1' }, {});
  V8BIZ.setProdutoCusto(biz, 'p1', { custoCompra: 48.9, embalagem: 3.5, freteSubsidiadoPct: 5, devolucaoEstimado: 1.2, margemMinimaPct: 15 }, {});
  const eco = V8BIZ.economiaProduto(biz, { produtoId: 'p1', sku: 'QP-6090', marketplace: 'shopee', empresaId: 'e1', preco: 124.9,
    base: { pedidosPagos: 1000, faturamento: 100000 }, fonteBase: 'pedidos importados' });
  assert.equal(eco.coberturaInsuficiente, false);
  const itens = Object.fromEntries(eco.linhas.map(l => [l.item, l]));
  assert.equal(itens['Custo individual do produto'].valor, 48.9, 'custo manual do produto');
  assert.equal(itens['Custo de embalagem'].valor, 3.5, 'embalagem');
  assert.ok(itens['Frete subsidiado'].valor > 6, 'participação de frete');
  assert.ok(itens['Comissão marketplace'].regra.includes('regra usada'), 'comissão mostra a regra aplicada');
  assert.equal(itens['Custo fixo rateado (por venda)'].valor, 10, 'rateio aplicado por pedido');
  assert.ok(eco.margemContribuicao > 0 && eco.margemContribuicaoPct > 0, 'margem de contribuição calculada');
  assert.ok(eco.margemLiquidaEstimada != null && eco.margemLiquidaEstimadaPct != null, 'margem líquida ESTIMADA calculada');
  assert.match(eco.formula, /margem líquida ESTIMADA/, 'fórmula visível');
  assert.ok(eco.linhas.every(l => l.fonte), 'toda linha tem fonte');
  assert.ok(eco.precoMinimoSeguro > 0 && eco.precoMinimoSeguro < 124.9, 'preço mínimo seguro coerente');
});

test('32 · sem dados suficientes → cobertura insuficiente declarada, nada estimado', () => {
  const { biz } = novo();
  const eco = V8BIZ.economiaProduto(biz, { produtoId: 'p99', marketplace: 'shopee', empresaId: 'e1', preco: 100, base: {} });
  assert.equal(eco.coberturaInsuficiente, true);
  assert.match(eco.cobertura, /INSUFICIENTE/);
  assert.ok(eco.faltando.some(f => /custo individual/.test(f)), 'diz exatamente o que falta');
  assert.equal(eco.margemLiquidaEstimada, null, 'sem margem inventada');
});

/* ---------- 33-34 · ponto de equilíbrio (exemplos do contrato) ---------- */
test('33-34 · PE em faturamento (40k) e em pedidos (250); insuficiente é declarado', () => {
  const be = V8BIZ.breakEven({ custoFixoTotal: 10000, margemContribuicaoPct: 25, margemPorPedido: 40,
    realizado: { faturamento: 30000, pedidosPagos: 167 }, diasRestantes: 10 });
  assert.equal(be.faturamentoBE, 40000, 'R$10.000 ÷ 25% = R$40.000');
  assert.equal(be.pedidosBE, 250, 'R$10.000 ÷ R$40 = 250 pedidos');
  assert.equal(be.faltaPedidos, 83, 'faltam 83 pedidos');
  assert.equal(be.mediaDiariaNecessaria, 1000, 'média diária necessária');
  assert.ok(be.formulaFaturamento && be.formulaPedidos, 'fórmulas visíveis');
  const insuf = V8BIZ.breakEven({ custoFixoTotal: 0 });
  assert.equal(insuf.insuficiente, true);
  assert.equal(insuf.mensagem, 'Dados insuficientes para calcular ponto de equilíbrio.');
  assert.ok(insuf.faltando.length >= 2, 'lista o que falta');
});

/* ---------- 35-36 · simulador interno ---------- */
test('35-36 · simulador só altera cenário interno; nunca o anúncio externo', () => {
  const { biz } = novo();
  V8BIZ.addTaxa(biz, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Comissão percentual', percentual: 14 }, {});
  V8BIZ.setProdutoCusto(biz, 'p1', { custoCompra: 48.9, embalagem: 3.5, margemMinimaPct: 15 }, {});
  const r = V8BIZ.simularPreco(biz, { produtoId: 'p1', sku: 'QP-6090', marketplace: 'shopee', empresaId: 'e1',
    precoAtual: 124.9, precoNovo: 139.9, base: {} }, {});
  assert.ok(r.ok);
  assert.ok(r.simulacao.margemContribuicaoSimulada > r.simulacao.margemContribuicaoAtual, 'cenário recalculado');
  assert.match(r.simulacao.externo, /NÃO é alterado/, 'anúncio externo intocado');
  assert.ok(!read('business-engine.js').match(/editListing|preco = params\.precoNovo.*listing/), 'motor não toca listing');
  V8BIZ.salvarSimulacao(biz, r.simulacao, {});
  assert.equal(biz.simulacoes.length, 1, 'simulação salva internamente');
  const baixo = V8BIZ.simularPreco(biz, { produtoId: 'p1', marketplace: 'shopee', empresaId: 'e1', precoAtual: 124.9, precoNovo: 30, base: {} }, {});
  assert.equal(baixo.simulacao.riscoMargemNegativa, true, 'risco de margem negativa detectado');
});

/* ---------- 37-38 · insights e prioridade de dado real ---------- */
test('37-38 · insight financeiro com fonte e regra; dado importado real vence estimativa', () => {
  const { biz } = novo();
  V8BIZ.addCustoFixo(biz, { nome: 'Fixos', categoria: 'Outros', valor: 10000, periodicidade: 'Mensal', inicio: '2026-07-01', empresaId: 'e1' }, {});
  V8BIZ.addRateio(biz, { nome: 'R', metodo: 'Por pedidos pagos', empresaId: 'e1' }, {});
  V8BIZ.addTaxa(biz, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Comissão percentual', percentual: 14 }, {});
  V8BIZ.addCustoVariavel(biz, { nome: 'CPV médio', categoria: 'Custo do produto', percentual: 75, base: 'Por faturamento', empresaId: 'e1' }, {});
  V8BIZ.setProdutoCusto(biz, 'p1', { custoCompra: 90, embalagem: 3.5, margemMinimaPct: 15 }, {});
  const ins = V8BIZ.insightsFinanceiros(biz, { empresaId: 'e1',
    vendas: { faturamento: 30000, pedidosPagos: 167, fonte: 'pedidos importados', periodo: 'junho' },
    porProduto: [{ produtoId: 'p1', nome: 'Quadro', sku: 'QP-6090', marketplace: 'shopee', preco: 124.9, faturamento: 5000, vendidos: 40 }], diasRestantes: 10 });
  assert.ok(ins.length >= 2, 'insights gerados');
  for (const i of ins) assert.ok(i.fontes && i.periodo && i.confianca && i.estimadoOuRealizado, 'fonte/período/confiança/estimado em cada insight');
  const beIns = ins.find(i => /ponto de equilíbrio/i.test(i.titulo + i.fato));
  assert.ok(beIns && /Faltam \d+ pedidos/.test(beIns.fato), 'insight de pedidos faltantes');
  const margem = ins.find(i => /margem abaixo da meta/.test(i.titulo));
  assert.ok(margem && margem.regras && /regra usada/.test(margem.regras), 'insight cita a regra de taxa usada');
  /* dado real prioritário */
  V8BIZ.addAdsRegra(biz, { tipo: 'Investimento mensal em Ads', percentual: 10, marketplace: 'shopee', empresaId: 'e1' }, {});
  const est = V8BIZ.custoAdsEfetivo(biz, { marketplace: 'shopee', produtoId: 'p1', faturamento: 100 }, null);
  assert.equal(est.estimado, true, 'sem importação: estimativa manual rotulada');
  const real = V8BIZ.custoAdsEfetivo(biz, { marketplace: 'shopee', produtoId: 'p1', faturamento: 100 }, { valor: 8.4, arquivo: 'ProductPerformance.csv' });
  assert.equal(real.estimado, false);
  assert.match(real.fonte, /DADO IMPORTADO/, 'importado real tem prioridade');
});

/* ---------- 39-40 · vigência e permissões ---------- */
test('39-40 · alterar custo preserva vigência; sem permissão não edita nada', () => {
  const { biz } = novo();
  V8BIZ.setProdutoCusto(biz, 'p1', { custoCompra: 48.9 }, {});
  V8BIZ.setProdutoCusto(biz, 'p1', { custoCompra: 52 }, {});
  const hist = V8BIZ.custoProdutoHistorico(biz, 'p1');
  assert.equal(hist.length, 1, 'vigência anterior preservada');
  assert.equal(hist[0].custoCompra, 48.9); assert.ok(hist[0].fimVigencia, 'com fim de vigência');
  assert.equal(V8BIZ.custoProdutoVigente(biz, 'p1').custoCompra, 52);
  const cf = V8BIZ.addCustoFixo(biz, { nome: 'Luz', categoria: 'Energia', valor: 800, periodicidade: 'Mensal', inicio: '2026-07-01', empresaId: 'e1' }, {});
  V8BIZ.novaVigencia(biz, biz.custosFixos, cf.custo.id, { valor: 900, valorMensal: 900 }, { motivo: 'reajuste' }, 'COST_RULE_EDIT');
  assert.ok(biz.custosFixos.find(c => c.id === cf.custo.id).fimVigencia, 'regra antiga encerrada, não apagada');
  /* permissões */
  for (const p of ['COMPANY_VIEW', 'COMPANY_CREATE', 'COMPANY_EDIT', 'COMPANY_ARCHIVE', 'COMPANY_DELETE_EMPTY',
    'CHANNEL_VIEW', 'CHANNEL_CREATE', 'CHANNEL_EDIT', 'CHANNEL_ARCHIVE', 'MARKETPLACE_ACCOUNT_CONNECT',
    'COST_CENTER_VIEW', 'COST_CENTER_EDIT', 'COST_CENTER_ARCHIVE', 'COST_RULE_CREATE', 'COST_RULE_EDIT',
    'COST_RULE_DELETE', 'COST_SIMULATOR_USE', 'COST_FINANCIAL_EXPORT', 'PRODUCT_COST_EDIT', 'BREAK_EVEN_VIEW', 'BREAK_EVEN_EDIT'])
    assert.ok(V8BIZ.BIZ_PERMS_ALL.includes(p), 'perm ' + p);
  assert.equal(V8BIZ.addCustoFixo(biz, { nome: 'x', categoria: 'Aluguel', valor: 1, periodicidade: 'Mensal', inicio: 'h', empresaId: 'e1' }, { papel: 'LEITURA' }).blocked, true, 'LEITURA não edita custo');
  assert.equal(V8BIZ.addRateio(biz, { nome: 'x', metodo: 'Por faturamento', empresaId: 'e1' }, { papel: 'EXPEDICAO' }).blocked, true, 'sem COST_RULE_CREATE');
  assert.equal(V8BIZ.connectOAuth(biz, { empresaId: 'e1', canalId: 's1' }, { papel: 'LEITURA' }).blocked, true, 'sem permissão não conecta OAuth');
  assert.equal(V8BIZ.arquivarEmpresa(biz, 'e1', { motivo: 'x', papel: 'CATALOGO' }).blocked, true, 'sem COMPANY_ARCHIVE');
  assert.equal(V8BIZ.canBiz('FINANCEIRO', 'COST_FINANCIAL_EXPORT'), true);
  assert.equal(V8BIZ.canBiz('LEITURA', 'COST_FINANCIAL_EXPORT'), false, 'export financeiro restrito');
});

/* ---------- 41-43 · proibições e integração ---------- */
test('41-43 · sem CRM/Lead; sem escrita externa; áreas registradas e integradas', () => {
  const engineJs = read('business-engine.js');
  assert.ok(!/\bleads?\b|pipeline comercial|CRM/i.test(engineJs.replace(/burocrátic\w+/g, '')), 'motor sem CRM/Lead');
  assert.ok(!/\bLeads\b|Pipeline/.test(empJs + cusJs), 'telas sem Lead/CRM');
  assert.ok(!/fetch\(|XMLHttpRequest/.test(engineJs), 'motor sem escrita externa');
  assert.match(engineJs, /ESCRITA EXTERNA BLOQUEADA/, 'trava declarada');
  assert.match(empJs, /UI\.renderers\.empresas = render/, 'área empresas registrada');
  assert.match(cusJs, /UI\.renderers\.custos = render/, 'área custos registrada');
  assert.match(read('app.js'), /custos: 'Lucratividade'/, 'NAMES no shell (Lucratividade)');
  assert.match(read('app.js'), /empresas: 'Empresas e Operações'/, 'NAMES no shell (Empresas)');
  assert.match(read('catalogo.js'), /'Economia do Produto'/, 'aba no editor do Catálogo');
  assert.match(read('crescimento.js'), /insightsFinanceiros/, 'Central usa o Centro de Custos como fonte');
  assert.match(cusJs, /vendasDoEscopo/, 'vendas com fonte declarada (importado > simulado)');
  assert.match(cusJs, /lucro real/i, 'aviso de estimativa presente');
  for (const f of ['ui-v8.test.js', 'ui-v8-orders.test.js', 'ui-v8-catalog.test.js'])
    assert.ok(fs.existsSync(path.join(__dirname, f)), f + ' presente — suíte anterior segue no npm test');
});
