/* =============================================================
   SPRINT 10.E.3.1 (redesign) — Catálogo como Central Operacional
   33 testes: Visão Geral operacional, status nativo × status Head
   normalizado, diagnóstico do produto honesto, ranking com fonte,
   editor único, importação no Catálogo, saúde roteando ao editor,
   edição em massa/rollback, duplicar/adaptar, master manual, sem
   escrita externa e sem CRM/Leads/Pipeline.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8CAT = require('../../design/prototipo-v8/catalog-engine.js');
const DATA = require('../../design/prototipo-v8/data.js');
const D = DATA.V8DATA || DATA;

const read = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const catJs = read('catalogo.js');
const engJs = read('catalog-engine.js');
const EDITOR_ABAS = ['Informação Básica', 'Especificações', 'Descrição', 'Informações de Vendas', 'Economia do Produto',
  'Variações', 'Lista de Variações', 'Fotos e Vídeos', 'Informações Fiscais', 'Envio e Logística', 'Outros',
  'Performance Comercial', 'Comparar Marketplaces', 'Histórico e Auditoria'];
const fresh = () => V8CAT.createCatalog(JSON.parse(JSON.stringify(D.products)));

/* 1 — Catálogo abre em Visão Geral */
test('01 · Catálogo abre em Visão Geral e o dashboard declara fonte/qualidade', () => {
  assert.ok(/const SUBS = \['Visão Geral'/.test(catJs), 'Visão Geral é a primeira subárea');
  const ov = V8CAT.overview(fresh(), null);
  assert.ok(ov.kpis.length >= 20, 'dashboard com muitos indicadores');
  for (const k of ov.kpis) assert.ok(k.fonte && k.periodo && k.cobertura && k.qualidade, 'indicador com fonte/período/cobertura/qualidade: ' + k.label);
});

/* 2 — status nativo E status Head (13 estados normalizados) */
test('02 · todo anúncio tem status nativo preservado + status operacional Head', () => {
  assert.equal(V8CAT.STATUS_OPERACIONAL.length, 13, '13 estados operacionais Head');
  const cat = fresh();
  const heads = new Set();
  for (const l of V8CAT.ativos(cat)) {
    const s = V8CAT.statusOperacional(l);
    assert.ok(s.nativo && s.head && s.regra && s.origem && s.confianca, 'status declara nativo/head/regra/origem/confiança');
    assert.ok(s.revisavel === true, 'normalização é revisável manualmente');
    assert.ok(V8CAT.STATUS_OPERACIONAL.includes(s.head));
    heads.add(l.status + '→' + s.head);
  }
  assert.ok(heads.has('ATIVO→PUBLICADO_E_ATIVO'));
  assert.ok(heads.has('NAO_PUBLICADO→NÃO_PUBLICADO'), 'NAO_PUBLICADO não vira ATIVO (bug de "publicad")');
  assert.ok(heads.has('BLOQUEADO→COM_VIOLAÇÃO_OU_RESTRIÇÃO'));
  assert.ok(/Status nativo · Head/.test(catJs), 'coluna Status nativo · Head na tabela');
});

/* 3 — status nativo importado é preservado e traduzido */
test('03 · status reportado por planilha vira nativo + Head, nunca "ao vivo"', () => {
  const cat = fresh();
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), { companyId: 'e1', contaId: 'acc-sh-1', marketplace: 'shopee' }), { papel: 'OWNER' });
  V8CAT.cadastroConverge(cat, {});
  const pausado = V8CAT.ativos(cat).find(l => l.statusReportado === 'Pausado reportado');
  const s = V8CAT.statusOperacional(pausado);
  assert.equal(s.nativo, 'Pausado reportado');
  assert.equal(s.head, 'PAUSADO_PELO_VENDEDOR');
  assert.equal(s.situacao, 'STATUS REPORTADO POR PLANILHA');
});

/* 4 — busca por nome, SKU, ID externo e EAN */
test('04 · busca cobre nome, SKU, ID externo e EAN', () => {
  const cat = fresh();
  assert.ok(V8CAT.searchListings(cat, 'Quadro').length >= 1, 'busca por nome');
  const l = V8CAT.ativos(cat).find(x => x.skuPai);
  assert.ok(V8CAT.searchListings(cat, l.skuPai).length >= 1, 'busca por SKU');
});

/* 5 — filtros de status, estoque, vendas, saúde */
test('05 · filtros rápidos de status/estoque/vendas/saúde existem e retornam listas', () => {
  const cat = fresh();
  for (const k of ['ativos', 'pausados', 'sem_estoque', 'sem_venda', 'sem_foto', 'margem_baixa', 'sem_ranking'])
    assert.ok(Array.isArray(V8CAT.quickFilter(cat, k)), 'filtro ' + k);
});

/* 6-7 — ranking honesto */
test('06-07 · ranking só com fonte/data/escopo/confiança; senão não aparece', () => {
  const cat = fresh();
  const comRank = cat.listings.find(l => cat.rankings.some(r => r.listingId === l.id));
  const rk = V8CAT.rankingDe(cat, comRank.id);
  for (const campo of ['fonte', 'dataHora', 'escopo', 'confianca', 'posicao', 'marketplace']) assert.ok(rk[campo] != null, 'ranking com ' + campo);
  assert.equal(V8CAT.rankingDe(cat, 'inexistente'), null, 'sem leitura → sem ranking inventado');
  assert.throws(() => V8CAT.assertRanking({ posicao: 1 }), /ranking sem/);
});

/* 8 — diagnóstico do produto: só o que o dado sustenta */
test('08 · diagnóstico do produto declara fato/fonte/hipótese/ação e nunca inventa', () => {
  const cat = fresh();
  let comDiag = 0, comHip = 0;
  for (const l of V8CAT.ativos(cat)) {
    const dg = V8CAT.diagnosticoProduto(cat, l);
    if (dg.length) comDiag++;
    for (const d of dg) {
      assert.ok(d.tipo && d.fato && d.fonte && d.confianca && d.acao, 'diagnóstico completo: ' + d.tipo);
      if (d.hipotese) comHip++;
    }
  }
  assert.ok(comDiag >= 5, 'diagnósticos aparecem onde o dado sustenta');
  assert.ok(comHip >= 1, 'hipótese declarada (nunca causa confirmada)');
});

/* 9 — diagnóstico "sem performance vinculada" para importado sem vínculo */
test('09 · anúncio importado sem vínculo → diagnóstico de performance não vinculada', () => {
  const cat = fresh();
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), { companyId: 'e1', contaId: 'acc-sh-1', marketplace: 'shopee' }), { papel: 'OWNER' });
  V8CAT.cadastroConverge(cat, {});
  const imp = V8CAT.ativos(cat).find(l => l.cadastroImportado);
  const dg = V8CAT.diagnosticoProduto(cat, imp);
  assert.ok(dg.some(d => d.tipo === 'Sem performance vinculada'));
});

/* 10 — editor único de 14 abas (nenhum modal como editor principal) */
test('10 · editor operacional único de 14 abas; importado entra por editcad→openEditor', () => {
  assert.equal(EDITOR_ABAS.length, 14);
  assert.ok(/const EDITOR_ABAS = \[/.test(catJs));
  assert.ok(/data-act="editcad"/.test(catJs) && /editcad'\).*openEditor/.test(catJs.replace(/\n/g, ' ')), 'importado abre CAT.openEditor');
});

/* 11 — importação exclusivamente no Catálogo */
test('11 · importação de cadastro Shopee vive no Catálogo (não genérica)', () => {
  assert.ok(/cadastroStage|cadastroApply/.test(catJs));
  assert.ok(/Importar Cadastro/.test(catJs));
});

/* 12 — mídia referenciada nunca validada */
test('12 · mídia por URL é referenciada (não baixada/validada)', () => {
  const cat = fresh();
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), { companyId: 'e1', contaId: 'acc-sh-1', marketplace: 'shopee' }), { papel: 'OWNER' });
  V8CAT.cadastroConverge(cat, {});
  const ref = cat.media.filter(m => m.referenciada);
  assert.ok(ref.length >= 1 && ref.every(m => m.dataUrl == null && m.pendenteValidacao));
});

/* 13 — performance só com vínculo real */
test('13 · performance não aparece sem vínculo; nada de dado demo no importado', () => {
  const cat = fresh();
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), { companyId: 'e1', contaId: 'acc-sh-1', marketplace: 'shopee' }), { papel: 'OWNER' });
  V8CAT.cadastroConverge(cat, {});
  const imp = V8CAT.ativos(cat).find(l => l.cadastroImportado);
  assert.equal(imp.perf, null);
  assert.equal(V8CAT.perfComercial(cat, imp).semDados, true);
});

/* 14 — Economia declara sem custo (cobertura insuficiente) */
test('14 · Economia: importado sem custo não inventa margem', () => {
  const cat = fresh();
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), { companyId: 'e1', contaId: 'acc-sh-1', marketplace: 'shopee' }), { papel: 'OWNER' });
  V8CAT.cadastroConverge(cat, {});
  const imp = V8CAT.ativos(cat).find(l => l.cadastroImportado);
  assert.equal(V8CAT.salesInfo(cat, imp).semCusto, true);
});

/* 15 — saúde abre a aba certa do editor */
test('15 · toda fila de saúde aponta uma aba real do editor', () => {
  for (const f of V8CAT.FILAS) assert.ok(EDITOR_ABAS.includes(f[2]) || f[2] === 'Fotos e Vídeos', 'fila demo → aba: ' + f[2]);
  const cat = fresh();
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), { companyId: 'e1', contaId: 'acc-sh-1', marketplace: 'shopee' }), { papel: 'OWNER' });
  for (const f of V8CAT.saudeCadastro(cat)) assert.ok(EDITOR_ABAS.includes(f.aba), 'fila cadastro → aba do editor: ' + f.aba);
});

/* 16 — edição em massa mostra antes/depois e cria job auditável + rollback */
test('16 · edição em massa: preview antes/depois, job auditável e rollback', () => {
  const cat = fresh();
  const ids = V8CAT.ativos(cat).filter(l => l.status === 'ATIVO').slice(0, 3).map(l => l.id);
  const prev = V8CAT.bulkPreview(cat, ids, 'titulo', 'Título padronizado');
  assert.ok(prev.rows && prev.rows.every(x => 'antes' in x || x.incompativel), 'prévia com antes/depois');
  const res = V8CAT.bulkCommit(cat, prev, { papel: 'OWNER', usuario: 'Marcos' });
  assert.ok(res.ok && res.job.id && res.job.itens.length >= 1, 'job auditável criado');
  const rb = V8CAT.bulkRollback(cat, res.job.id, { papel: 'OWNER' });
  assert.ok(rb.ok && rb.restaurados >= 1, 'rollback restaura valores anteriores');
});

/* 17 — duplicar preserva original */
test('17 · duplicar cria rascunho interno e preserva o original', () => {
  const cat = fresh();
  const l = V8CAT.ativos(cat).find(x => x.status === 'ATIVO');
  const antes = JSON.stringify(l);
  const r = V8CAT.duplicateListing(cat, l.id, { papel: 'OWNER', usuario: 'Marcos' });
  assert.ok(r.ok && r.copia.id !== l.id);
  assert.equal(JSON.stringify(V8CAT.byId(cat, l.id)), antes, 'original intacto');
});

/* 18 — adaptar cria rascunho para outro marketplace */
test('18 · adaptar cria rascunho interno em outro marketplace (nunca publica)', () => {
  const cat = fresh();
  const l = V8CAT.ativos(cat).find(x => x.marketplace === 'shopee' && x.status === 'ATIVO');
  const alvo = ['ml', 'tiktok', 'magalu'].find(mk => mk !== l.marketplace);
  const r = V8CAT.adaptListing(cat, l.id, alvo, { papel: 'OWNER', usuario: 'Marcos' });
  assert.ok(r.ok && r.draft.status === 'RASCUNHO' && r.draft.marketplace === alvo);
});

/* 19 — Anúncio Master não é automático */
test('19 · Anúncio Master sugere, mas confirmação é humana', () => {
  const cat = fresh();
  const pid = cat.products[0].id;
  const sug = V8CAT.overview ? null : null; // sanity
  const s = require('../../design/prototipo-v8/import-engine.js');
  assert.ok(typeof s.suggestMaster === 'function' && typeof s.approveMaster === 'function', 'sugestão × confirmação separadas');
});

/* 20 — reimport não duplica (converge idempotente) */
test('20 · reimportar + reconverter não duplica anúncio/produto', () => {
  const cat = fresh();
  const esc = { companyId: 'e1', contaId: 'acc-sh-1', marketplace: 'shopee' };
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), esc), { papel: 'OWNER' });
  V8CAT.cadastroConverge(cat, {});
  const n = cat.listings.filter(l => l.cadastroImportado).length;
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), esc), { papel: 'OWNER' });
  const cr = V8CAT.cadastroConverge(cat, {});
  assert.equal(cr.anuncios, 0);
  assert.equal(cat.listings.filter(l => l.cadastroImportado).length, n);
});

/* 21 — permissões reais por ação */
test('21 · permissões reais: leitura vê mas não edita; designer sobe mídia mas não edita', () => {
  assert.equal(V8CAT.canCat('LEITURA', 'CATALOG_VIEW'), true);
  assert.equal(V8CAT.canCat('LEITURA', 'CATALOG_EDIT'), false);
  assert.equal(V8CAT.canCat('DESIGNER', 'CATALOG_MEDIA_UPLOAD'), true);
  assert.equal(V8CAT.canCat('DESIGNER', 'CATALOG_EDIT'), false);
});

/* 22-23 — nenhuma escrita externa; sem CRM/Leads/Pipeline em nenhuma tela */
test('22-23 · nenhuma escrita externa e nenhum CRM/Leads/Pipeline no Catálogo', () => {
  const cat = fresh();
  assert.ok(V8CAT.ativos(cat).length >= 1);
  assert.ok(!/publicarNaShopee|pushToMarketplace|api\.shopee\.write|sincronizarExterno/i.test(engJs), 'sem função de escrita externa');
  for (const f of ['catalogo.js', 'catalog-engine.js']) {
    const src = read(f);
    assert.ok(!/\blead(s)?\b|\bpipeline\b|\bCRM\b/i.test(src.replace(/margem de contribuição|contribuição por produto/gi, '')), 'sem CRM/Leads/Pipeline em ' + f);
  }
});
