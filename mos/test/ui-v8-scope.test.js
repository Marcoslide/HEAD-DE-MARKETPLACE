/* =============================================================
   SPRINT 10.UI.2 — Operational Workbench multiempresa/multiCNPJ/
   multiloja. 29 testes obrigatórios sobre o Operational Scope
   Context (Grupo → Empresa → CNPJ → Loja → Conta), filtros por
   loja, visões salvas com isolamento, comparação entre lojas,
   ações em massa com escopo e ausência total de CRM.
   V8LOGIC é o MESMO arquivo que o navegador executa.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8DIR = path.join(__dirname, '../../design/prototipo-v8');
const { V8DATA, V8LOGIC } = require(path.join(V8DIR, 'data.js'));
const read = f => fs.readFileSync(path.join(V8DIR, f), 'utf8');
const appJs = read('app.js');
const catJs = read('catalogo.js');
const creJs = read('crescimento.js');
const opJs = read('operacao.js');
const misJs = read('missao.js');
const allUi = [appJs, read('home.js'), catJs, creJs, read('conexoes.js'), opJs, misJs, read('silencio.js'), read('conhecimento.js')].join('\n');

/* ---------- estrutura Grupo → Empresa → CNPJ → Loja → Conta ---------- */

test('01 · uma empresa pode ter múltiplos CNPJs', () => {
  const cnpjsE1 = V8LOGIC.cnpjsDe('e1');
  assert.ok(cnpjsE1.length >= 2, 'e1 tem Matriz e Filial');
  assert.deepEqual(cnpjsE1.map(c => c.nome).sort(), ['Filial SP', 'Matriz MG']);
  for (const c of cnpjsE1) assert.ok(c.doc.includes('simulado'), 'documento rotulado como simulado');
});

test('02 · um CNPJ pode ter múltiplas lojas (inclusive física)', () => {
  const lojasC1 = V8LOGIC.lojasDe({ empresa: 'e1', cnpj: 'c1' });
  assert.ok(lojasC1.length >= 4, 'Matriz MG tem 4 lojas');
  assert.ok(lojasC1.some(s => s.tipo === 'fisica'), 'loja física existe — loja não é sinônimo de marketplace');
  assert.ok(lojasC1.filter(s => s.marketplace === 'shopee').length >= 2, 'duas lojas Shopee no mesmo CNPJ');
});

test('03 · uma loja pode ter múltiplas contas de marketplace', () => {
  const contasS2 = V8DATA.scope.contas.filter(a => a.lojaId === 's2');
  assert.equal(contasS2.length, 2, 'loja ML tem conta principal + outlet');
  assert.ok(contasS2.every(a => a.marketplace === 'ml'));
});

test('04 · trocar grupo/empresa altera os CNPJs disponíveis', () => {
  assert.deepEqual(V8LOGIC.cnpjsDe('e1').map(c => c.id), ['c1', 'c2']);
  assert.deepEqual(V8LOGIC.cnpjsDe('e2').map(c => c.id), ['c3']);
  assert.deepEqual(V8LOGIC.cnpjsDe('e3'), [], 'empresa de grupo não autorizado não expõe CNPJs');
  assert.match(appJs, /if \(k === 'empresa'\) \{ UI\.ctx\.cnpj = ''; UI\.ctx\.loja = ''; UI\.ctx\.conta = ''; \}/, 'trocar empresa reseta filhos');
});

test('05 · trocar CNPJ altera as lojas disponíveis', () => {
  assert.equal(V8LOGIC.lojasDe({ empresa: 'e1', cnpj: 'c1' }).length, 4);
  assert.equal(V8LOGIC.lojasDe({ empresa: 'e1', cnpj: 'c2' }).length, 2);
  const ctx = { empresa: 'e1', cnpj: 'c2', loja: 's1' }; /* s1 é da c1 → órfã */
  V8LOGIC.normalizeCtx(ctx);
  assert.equal(ctx.loja, '', 'loja órfã é limpa ao trocar CNPJ');
});

test('06 · trocar loja altera as contas disponíveis', () => {
  assert.deepEqual(V8LOGIC.contasDe({ loja: 's2' }).map(a => a.id), ['acc-ml-1', 'acc-ml-1b']);
  assert.deepEqual(V8LOGIC.contasDe({ loja: 's1' }).map(a => a.id), ['acc-shp-1']);
  const ctx = { empresa: 'e1', loja: 's1', conta: 'acc-ml-1' };
  V8LOGIC.normalizeCtx(ctx);
  assert.equal(ctx.conta, '', 'conta órfã é limpa ao trocar loja');
});

/* ---------- o escopo filtra as áreas ---------- */

test('07 · contexto de loja filtra o Catálogo', () => {
  const st = V8LOGIC.createState();
  const s1 = V8LOGIC.globalFilter(st.products, { empresa: 'e1', loja: 's1' });
  assert.deepEqual(s1.map(p => p.sku).sort(), ['KIT3-SALA', 'POR-3D', 'QP-6090', 'QPN-FAM']);
  const s3 = V8LOGIC.globalFilter(st.products, { empresa: 'e1', loja: 's3' });
  assert.ok(s3.every(p => p.lojas.s3), 'loja física só mostra o que está nela');
  assert.match(catJs, /UI\.ctxProducts\(\)/, 'catálogo consome o escopo');
});

test('08 · contexto de loja/conta filtra Anúncios', () => {
  const st = V8LOGIC.createState();
  const contaOutlet = V8LOGIC.globalFilter(st.products, { empresa: 'e1', conta: 'acc-ml-1b' });
  assert.equal(contaOutlet.length, 0, 'conta outlet sem anúncios atribuídos → vazio honesto');
  const contaPrincipal = V8LOGIC.globalFilter(st.products, { empresa: 'e1', conta: 'acc-ml-1' });
  assert.ok(contaPrincipal.length >= 5, 'conta principal vê os anúncios dela');
  assert.match(catJs, /UI\.ctx\.marketplace \|\| CAT\.anuncioMkt/);
});

test('09 · contexto de loja filtra Crescimento (KPIs por loja)', () => {
  const k1 = V8LOGIC.lojaKpis('s1', '7d');
  const k4 = V8LOGIC.lojaKpis('s4', '7d');
  assert.ok(k1 && k4 && k1.faturamento !== k4.faturamento, 'duas Shopee do mesmo CNPJ têm números próprios');
  assert.equal(V8LOGIC.lojaKpis('s6', '7d'), null, 'Magalu sem integração → SEM DADOS, nunca inventado');
  assert.match(creJs, /L\.lojasDe\(\{ empresa: UI\.ctx\.empresa, cnpj: UI\.ctx\.cnpj \}\)/, 'crescimento recorta por escopo');
});

test('10 · contexto de loja filtra Missões', () => {
  assert.ok(V8DATA.missoes.every(m => m.lojaId), 'toda missão registra a loja');
  const s2 = V8DATA.missoes.filter(m => m.lojaId === 's2');
  const s1 = V8DATA.missoes.filter(m => m.lojaId === 's1');
  assert.ok(s2.length >= 3 && s1.length >= 1 && s2.length !== V8DATA.missoes.length);
  assert.match(misJs, /missoesDoEscopo/, 'render das missões usa o escopo');
});

test('11 · contexto de loja filtra Pedidos Não Pagos', () => {
  const s4 = V8LOGIC.unpaidByLoja({ loja: 's4' });
  assert.equal(s4.list.length, 2);
  assert.ok(s4.list.every(o => o.lojaId === 's4' && o.contaId === 'acc-shp-2'));
  const c1 = V8LOGIC.unpaidByLoja({ empresa: 'e1', cnpj: 'c1' });
  assert.ok(c1.list.length > s4.list.length, 'CNPJ agrega as lojas dele');
  assert.ok(!c1.list.some(o => o.lojaId === 's8'), 'loja de outra empresa não entra');
});

/* ---------- agregação transparente e isolamento ---------- */

test('12 · consolidado mostra QUAIS lojas entraram', () => {
  const d = V8LOGIC.scopeDescribe({ empresa: 'e1', cnpj: 'c1' });
  assert.equal(d.lojas.length, 4);
  assert.ok(d.lojas.includes('Loja Física Lagoa Santa'));
  assert.match(read('home.js'), /\$\{lojasComDado\.length\} loja\(s\)/, 'Home declara as lojas incluídas');
  assert.match(read('home.js'), /SEM DADOS fora da soma/, 'loja sem dado é declarada fora da soma');
});

test('13 · agregação mostra os CNPJs incluídos', () => {
  const d = V8LOGIC.scopeDescribe({ empresa: 'e1' });
  assert.deepEqual(d.cnpjs.sort(), ['Filial SP', 'Matriz MG']);
  assert.match(appJs, /scopeLineHtml/, 'linha de recorte disponível para as telas');
  assert.match(catJs, /UI\.scopeLineHtml\(\)/, 'catálogo mostra o recorte');
});

test('14 · dados de empresa sem permissão NUNCA vazam', () => {
  assert.equal(V8LOGIC.scopeAuthorized('e3'), false);
  assert.deepEqual(V8LOGIC.lojasDe({ empresa: 'e3' }), [], 'lojas de e3 invisíveis');
  assert.deepEqual(V8LOGIC.cnpjsDe('e3'), []);
  assert.equal(V8LOGIC.globalFilter(V8DATA.products, { empresa: 'e3' }).length, 0);
  assert.ok(!V8LOGIC.lojasDe({}).some(s => s.id === 's9'), 'mesmo sem filtro, loja do grupo externo não aparece');
  const cmp = V8LOGIC.compareLojas(['s1', 's9'], '7d');
  assert.equal(cmp.rows.length, 1, 'comparação descarta loja não autorizada');
  assert.equal(V8LOGIC.empresasDe('g2').length, 0, 'grupo não autorizado não lista empresas');
});

/* ---------- produto × loja ---------- */

test('15 · produto pode ter preço diferente por loja', () => {
  const p1 = V8DATA.products.find(p => p.id === 'p1');
  assert.notEqual(p1.lojas.s1.preco, p1.lojas.s2.preco);
  assert.notEqual(p1.lojas.s1.preco, p1.lojas.s4.preco, 'duas Shopee com preços próprios');
});

test('16 · produto pode ter estoque diferente por loja', () => {
  const p1 = V8DATA.products.find(p => p.id === 'p1');
  const estoques = [p1.lojas.s1.estoque, p1.lojas.s2.estoque, p1.lojas.s4.estoque, p1.lojas.s6.estoque];
  assert.ok(new Set(estoques).size >= 3, 'estoques independentes por loja');
  assert.equal(p1.lojas.s6.estoque, 0, 'estoque zerado numa loja não zera as outras');
});

test('17 · produto pode ter margem diferente por loja', () => {
  const p1 = V8DATA.products.find(p => p.id === 'p1');
  const m1 = V8LOGIC.margemLoja(p1, 's1'), m2 = V8LOGIC.margemLoja(p1, 's2');
  assert.ok(m1 != null && m2 != null && m1 !== m2);
  assert.equal(V8LOGIC.margemLoja(V8DATA.products.find(p => p.id === 'p10'), 's2'), null, 'sem preço → sem margem inventada');
});

test('18 · Product Master não sobrescreve dado de loja', () => {
  const st = V8LOGIC.createState();
  const p1 = st.products.find(p => p.id === 'p1');
  const antes = JSON.stringify(p1.lojas);
  V8LOGIC.editMaster(st, 'p1', 'titulo', 'Quadro Paisagem RENOMEADO');
  assert.equal(JSON.stringify(p1.lojas), antes, 'preço/estoque/prazo por loja intactos');
  assert.match(catJs, /Editar o master não sobrescreve nada daqui sem confirmação/, 'aviso na aba Lojas e Contas');
  assert.match(catJs, /Perfis específicos existem/, 'confirmação explícita continua no fluxo');
});

/* ---------- visões salvas ---------- */

test('19 · Saved View salva loja, CNPJ, conta, período, filtros e colunas', () => {
  const st = V8LOGIC.createState();
  const v = V8LOGIC.saveScopedView(st, {
    nome: 'Shopee Matriz MG · Bloqueados', empresaId: 'e1', tipo: 'empresa',
    escopo: { cnpj: 'c1', loja: 's1', conta: 'acc-shp-1', marketplace: 'shopee', periodo: '30d' },
    filtros: { comPendencia: true }, colunas: { categoria: false, custo: true, atualizacao: true },
    ordenacao: { key: 'margem', dir: 'desc' },
  });
  assert.equal(v.escopo.loja, 's1');
  assert.equal(v.escopo.cnpj, 'c1');
  assert.equal(v.escopo.periodo, '30d');
  assert.equal(v.filtros.comPendencia, true);
  assert.equal(v.colunas.categoria, false);
  assert.ok(st.audit.some(a => a.acao === 'view_salva'), 'salvar visão é auditado');
  assert.throws(() => V8LOGIC.saveScopedView(st, { nome: 'x', tipo: 'privada' }), /falta empresaId/);
});

test('20 · Saved View não vaza entre empresas', () => {
  const st = V8LOGIC.createState();
  V8LOGIC.saveScopedView(st, { nome: 'Visão da Líder', empresaId: 'e1', tipo: 'empresa', escopo: {}, filtros: {} });
  V8LOGIC.saveScopedView(st, { nome: 'Visão da Cozinha', empresaId: 'e2', tipo: 'empresa', escopo: {}, filtros: {} });
  assert.deepEqual(V8LOGIC.viewsFor(st, 'e1').map(v => v.nome), ['Visão da Líder']);
  assert.deepEqual(V8LOGIC.viewsFor(st, 'e2').map(v => v.nome), ['Visão da Cozinha']);
  V8LOGIC.saveScopedView(st, { nome: 'Privada do Marcos', empresaId: 'e1', tipo: 'privada', escopo: {}, filtros: {} });
  assert.equal(V8LOGIC.viewsFor(st, 'e1', 'OutraPessoa').length, 1, 'privada não aparece para outro usuário');
  assert.throws(() => V8LOGIC.saveScopedView(st, { nome: 'x', empresaId: 'e3', tipo: 'empresa' }), /fora do escopo autorizado/);
});

/* ---------- comparação entre lojas ---------- */

test('21 · comparação de lojas mostra período, origem e ranking', () => {
  const cmp = V8LOGIC.compareLojas(['s1', 's2', 's4'], '7d');
  assert.equal(cmp.periodo, '7d');
  assert.equal(cmp.origem, 'DADO SIMULADO');
  assert.equal(cmp.rows.length, 3);
  assert.equal(cmp.ranking[0], 's2', 'ML lidera faturamento no fixture');
  for (const r of cmp.rows) assert.ok(r.cnpj, 'cada linha carrega o CNPJ');
  assert.throws(() => V8LOGIC.compareLojas(['s1', 's2', 's4', 's5', 's7'], '7d'), /4 lojas/);
});

test('22 · comparação entre lojas incompatíveis gera aviso', () => {
  const cmp = V8LOGIC.compareLojas(['s1', 's3'], '7d'); /* marketplace × física */
  assert.ok(cmp.avisos.some(a => /física/.test(a)), 'aviso de comparabilidade física × digital');
  assert.equal(cmp.comparavel, false);
  const cmp2 = V8LOGIC.compareLojas(['s1', 's6'], '7d'); /* s6 sem dado */
  assert.ok(cmp2.avisos.some(a => /SEM DADOS/.test(a)), 'loja sem dado gera aviso e fica fora do ranking');
  assert.ok(!cmp2.ranking.includes('s6'));
  const ok = V8LOGIC.compareLojas(['s1', 's4'], '7d');
  assert.equal(ok.comparavel, true, 'duas Shopee no mesmo período são comparáveis sem aviso');
});

/* ---------- busca, bulk, jobs ---------- */

test('23 · busca global respeita empresa ativa e mostra contexto', () => {
  const st = V8LOGIC.createState();
  const e2 = V8LOGIC.globalSearch('quadro', st, { empresa: 'e2' });
  assert.equal(e2.filter(r => r.tipo === 'produto').length, 0, 'produto da e1 não aparece na e2');
  const e1 = V8LOGIC.globalSearch('diamonds', st, { empresa: 'e1' });
  assert.equal(e1[0].tipo, 'loja');
  assert.match(e1[0].sub, /Matriz MG · Líder/, 'resultado mostra CNPJ e empresa');
  const np = V8LOGIC.globalSearch('np7', st, { empresa: 'e1' });
  assert.ok(np.some(r => r.tipo === 'pedido não pago' && /Diamonds/.test(r.sub)), 'pedido não pago com loja no resultado');
  const conta = V8LOGIC.globalSearch('outlet', st, { empresa: 'e1' });
  assert.ok(conta.some(r => r.tipo === 'conta'), 'conta é pesquisável');
});

test('24 · ação em massa mostra lojas e CNPJs afetados antes de executar', () => {
  const st = V8LOGIC.createState();
  const r = V8LOGIC.bulkScopeSummary(st, ['p1', 'p2', 'p4'], { empresa: 'e1' });
  assert.ok(r.lojasAfetadas.length >= 5, 'lojas afetadas contadas');
  assert.deepEqual(r.cnpjsAfetados.sort(), ['Filial SP', 'Matriz MG'], '2 CNPJs afetados');
  assert.equal(r.itens, 3);
  assert.equal(r.elegiveis, 1, 'p2 e p4 têm pendência → só p1 elegível');
  assert.equal(r.bloqueados.length, 2);
  assert.ok(r.bloqueados.every(b => b.motivo), 'cada bloqueio tem motivo');
  assert.match(catJs, /Confirmar escopo da ação/, 'modal de confirmação antes de executar');
  assert.match(catJs, /CNPJs afetados/, 'modal lista CNPJs');
});

test('25 · job registra empresa, CNPJ, loja e conta', () => {
  const st = V8LOGIC.createState();
  const { job } = V8LOGIC.bulkAction(st, ['p1'], 'marcar_revisao', 'Marcos', { empresa: 'e1', loja: 's1' });
  assert.equal(job.escopo.empresa, 'Líder Comércio Digital LTDA');
  assert.deepEqual(job.escopo.lojas, ['Shopee Líder Molduras MG']);
  assert.deepEqual(job.escopo.cnpjs, ['Matriz MG']);
  assert.deepEqual(job.escopo.contas, ['acc-shp-1']);
  assert.ok(st.audit.some(a => a.acao === 'bulk_job' && /1 loja\(s\) · 1 CNPJ\(s\)/.test(a.detalhe)), 'auditoria carrega o escopo');
});

test('26 · pedido não pago é filtrável por loja, conta e marketplace', () => {
  assert.ok(V8DATA.crescimento.pedidosNaoPagos.every(o => o.lojaId && o.contaId), 'todo registro tem loja e conta');
  assert.equal(V8LOGIC.unpaidByLoja({ conta: 'acc-shp-2', empresa: 'e1' }).list.length, 2);
  assert.equal(V8LOGIC.unpaidByLoja({ empresa: 'e1', marketplace: 'shopee' }).list.length, 4);
  const porLoja = V8LOGIC.unpaidByLoja({ empresa: 'e1' }).porLoja;
  assert.ok(Object.keys(porLoja).length >= 3, 'concentração por loja calculada');
  assert.match(creJs, /Concentração por loja/, 'tela mostra o breakdown');
});

/* ---------- limpeza de CRM e segurança externa ---------- */

test('27 · não existe Lead, CRM ou Pipeline no produto', () => {
  assert.equal(V8DATA.crescimento.leads, undefined);
  assert.ok(!/\.leads\b|'Leads|>Leads</.test(allUi), 'nenhuma tela de leads');
  assert.ok(!/>Pipeline|'Pipeline'/.test(allUi), 'nenhum pipeline');
  assert.match(opJs, /não trabalha com leads nem pipeline/, 'comando de lead no chat é redirecionado');
  assert.match(opJs, /LEADS_QUERY/, 'intent legado interceptado explicitamente');
});

test('28 · nenhuma ação nova executa nada externamente', () => {
  const st = V8LOGIC.createState();
  for (const acao of V8LOGIC.EXTERNAL_ACTIONS)
    assert.equal(V8LOGIC.bulkAction(st, ['p1'], acao, 'M', { empresa: 'e1' }).blocked, true);
  assert.ok(!/publicado com sucesso/i.test(allUi));
  assert.match(catJs, /nada será publicado externamente/, 'modal de bulk declara a trava');
  /* comparar, exportar, focar loja: tudo interno */
  assert.ok(!/fetch\(|XMLHttpRequest/.test(allUi), 'zero chamadas externas na UI');
});

test('29 · contratos anteriores continuam válidos', () => {
  for (const fn of ['filterProducts', 'sortProducts', 'editMaster', 'editProfile', 'bulkAction',
    'publicationMatrix', 'saveView', 'loadView', 'margem', 'readiness', 'funnel', 'perfKpis',
    'unpaidStats', 'unpaidHypotheses', 'createExperiment', 'accelGate', 'compareLojas',
    'globalFilter', 'lojaKpis', 'scopeDescribe', 'advancedFilter'])
    assert.equal(typeof V8LOGIC[fn], 'function', 'API: ' + fn);
  /* filtros avançados profissionais: operadores mínimos presentes e funcionais */
  assert.ok(V8LOGIC.ADV_OPERATORS.length >= 20);
  const st = V8LOGIC.createState();
  const r = V8LOGIC.advancedFilter(st.products, [
    { campo: 'margem', operador: 'menor que', valor: 65 },
    { campo: 'pendencia', operador: 'com pendência', join: 'AND' },
  ]);
  assert.ok(r.length >= 2 && r.every(p => V8LOGIC.margem(p) < 65 && p.pendencias.length));
  const ou = V8LOGIC.advancedFilter(st.products, [
    { campo: 'categoria', operador: 'é igual a', valor: 'Iluminação' },
    { campo: 'categoria', operador: 'é igual a', valor: 'Escritório', join: 'OR' },
  ]);
  assert.equal(ou.length, 2, 'agrupamento OR funciona');
  const naLoja = V8LOGIC.advancedFilter(st.products, [{ campo: 'estoque', operador: 'menor que', valor: 5 }], { loja: 's1' });
  assert.ok(naLoja.some(p => p.id === 'p2'), 'regra usa o estoque DA LOJA no escopo');
});
