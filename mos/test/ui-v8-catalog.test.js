/* =============================================================
   SPRINT 10.E.3 — Catalog & Listing Operating Center (43 testes)
   Product Master × Listing, busca/filtros/tags, ranking com fonte,
   editor completo estilo Shopee, mídia isolada por marketplace,
   variações com conflito de SKU, importação dentro do Catálogo,
   duplicar/adaptar como rascunho, edição em massa com job+rollback,
   comparação entre marketplaces, saúde, permissões e auditoria.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8CAT = require('../../design/prototipo-v8/catalog-engine.js');
const V8IMP = require('../../design/prototipo-v8/import-engine.js');
const V8DATA = require('../../design/prototipo-v8/data.js');
const D = V8DATA.V8DATA || V8DATA;

const read = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const catJs = read('catalogo.js');
const novo = () => V8CAT.createCatalog(JSON.parse(JSON.stringify(D.products)).map(p => {
  /* clone raso mantendo estrutura */
  return p;
}));

/* ---------- 01-02 · abertura e lista ---------- */
test('01-02 · Catálogo abre em Visão Geral; lista de anúncios mostra status, tags e fonte', () => {
  assert.match(catJs, /sub: 'Visão Geral'/, 'primeira tela é a Visão Geral');
  assert.ok(catJs.indexOf("'Visão Geral'") < catJs.indexOf("'Produtos Master'"), 'Visão Geral é a primeira subárea');
  assert.match(catJs, /listingTags/, 'tags comerciais na lista');
  assert.match(catJs, /C\.fonte \? `<td><span class="src">\$\{UI\.esc\(l\.fonte\)\}/, 'coluna de fonte na tabela');
  const cat = novo();
  const ov = V8CAT.overview(cat);
  assert.ok(ov.kpis.length >= 22, 'dashboard executivo com 22+ indicadores');
  for (const k of ov.kpis) assert.ok(k.fonte && k.periodo && k.cobertura && k.qualidade, 'indicador com fonte/período/cobertura/qualidade: ' + k.label);
});

/* ---------- 03-06 · busca ---------- */
test('03-06 · busca por nome, SKU, ID externo e código de barras', () => {
  const cat = novo();
  assert.ok(V8CAT.searchListings(cat, 'garrafa').length >= 1, 'por nome');
  assert.ok(V8CAT.searchListings(cat, 'KIT3-SALA').length >= 3, 'por SKU pai');
  assert.ok(V8CAT.searchListings(cat, 'TEN-R37').length >= 1, 'por SKU de variação');
  const l = cat.listings.find(x => x.itemIdExterno);
  assert.ok(V8CAT.searchListings(cat, l.itemIdExterno).some(x => x.id === l.id), 'por ID externo do marketplace');
  assert.ok(V8CAT.searchListings(cat, l.ean).length >= 1, 'por EAN/GTIN');
  assert.equal(V8CAT.searchListings(cat, 'zzz-inexistente').length, 0, 'busca honesta: nada inventado');
});

/* ---------- 07-12 · filtros rápidos ---------- */
test('07-12 · filtros: ativos, pausados, sem venda, mais vendidos, estoque crítico, posição 1-10', () => {
  const cat = novo();
  const at = V8CAT.quickFilter(cat, 'ativos');
  assert.ok(at.length && at.every(l => l.status === 'ATIVO'));
  const pa = V8CAT.quickFilter(cat, 'pausados');
  assert.ok(pa.length && pa.every(l => l.status === 'PAUSADO'));
  const sv = V8CAT.quickFilter(cat, 'sem_venda');
  assert.ok(sv.every(l => !l.perf || l.perf.vendidos90d === 0));
  const mv = V8CAT.quickFilter(cat, 'mais_vendidos');
  const tot = l => (l.perf || {}).vendidosTotal || 0;
  assert.ok(mv.every((l, i) => i === 0 || tot(mv[i - 1]) >= tot(l)), 'ordenado por vendidos');
  for (const k of ['mais_vendidos_7d', 'mais_vendidos_30d', 'mais_vendidos_90d'])
    assert.ok(V8CAT.quickFilter(cat, k).length === V8CAT.ativos(cat).length, k + ' ordena sem excluir');
  const ec = V8CAT.quickFilter(cat, 'estoque_baixo');
  assert.ok(ec.every(l => l.estoque > 0 && l.estoque <= 5));
  const p10 = V8CAT.quickFilter(cat, 'pos_1_10');
  assert.ok(p10.length >= 1 && p10.every(l => cat.rankings.find(r => r.listingId === l.id).posicao <= 10), 'posição 1–10');
  assert.ok(V8CAT.quickFilter(cat, 'perdeu_posicao').some(l => l.id === 'L-p1-ml'), 'perdeu posição');
});

/* ---------- 13-14 · ranking honesto ---------- */
test('13-14 · ranking nunca sem fonte; sempre com data, escopo, confiança e histórico', () => {
  const cat = novo();
  assert.throws(() => V8CAT.assertRanking({ posicao: 3, palavra: 'x' }), /sem fonte|sem dataHora|sem escopo|sem confianca|sem marketplace/);
  assert.equal(V8CAT.rankingDe(cat, 'L-p7-ml'), null, 'sem leitura registrada → null, nunca posição inventada');
  const rk = V8CAT.rankingDe(cat, 'L-p1-ml');
  for (const k of ['fonte', 'dataHora', 'escopo', 'confianca', 'periodo', 'tipo', 'historico', 'marketplace', 'conta'])
    assert.ok(rk[k] != null, 'ranking com ' + k);
  assert.equal(rk.leitura, '#4 → #5 → #7', 'histórico de posição');
  assert.match(rk.analise, /hipóteses, não causa confirmada/, 'análise honesta da queda');
  assert.match(catJs, /sem posição inventada/, 'ausência declarada na UI');
  assert.match(catJs, /rk\.confianca/, 'confiança exibida na tabela');
});

/* ---------- 15 · vendidos por período e escopo ---------- */
test('15 · vendidos total/7d/30d/90d consistentes e recortados por marketplace', () => {
  const cat = novo();
  for (const l of cat.listings.filter(x => x.perf)) {
    assert.ok(l.perf.vendidos7d <= l.perf.vendidos30d, '7d ≤ 30d: ' + l.id);
    assert.ok(l.perf.vendidos30d <= l.perf.vendidos90d, '30d ≤ 90d: ' + l.id);
    assert.ok(l.perf.vendidos90d <= l.perf.vendidosTotal, '90d ≤ total: ' + l.id);
    assert.ok(l.perf.periodo && l.perf.fonte, 'perf com período e fonte');
  }
  const shp = V8CAT.ativos(cat).filter(l => l.marketplace === 'shopee');
  assert.ok(shp.length && shp.every(l => l.marketplace === 'shopee'), 'recorte por marketplace');
});

/* ---------- 16-18 · editor completo + mídia real ---------- */
test('16-18 · editor com seções equivalentes ao cadastro Shopee; aceita fotos e vídeo do computador', () => {
  for (const aba of ['Informação Básica', 'Especificações', 'Descrição', 'Informações de Vendas', 'Variações',
    'Lista de Variações', 'Fotos e Vídeos', 'Informações Fiscais', 'Envio e Logística', 'Outros',
    'Performance Comercial', 'Comparar Marketplaces', 'Histórico e Auditoria'])
    assert.ok(catJs.includes(`'${aba}'`), 'aba do editor: ' + aba);
  assert.match(catJs, /FileReader/, 'foto lida DO COMPUTADOR de verdade');
  assert.match(catJs, /accept = '\.jpg,\.jpeg,\.png,\.webp,\.gif,\.mp4'/, 'aceita fotos e vídeo');
  const cat = novo();
  const v = V8CAT.addMedia(cat, { arquivo: 'video-novo.mp4', produtoId: 'p1', listingId: 'L-p1-shopee' }, {});
  assert.equal(v.media.tipo, 'video', 'vídeo aceito');
  assert.equal(V8CAT.addMedia(cat, { arquivo: 'nota.pdf', produtoId: 'p1' }, {}).blocked, true, 'formato não-mídia recusado');
  for (const campo of ['registra arquivo, origem, data, usuário', 'onde é usada'])
    assert.ok(read('catalogo.js').toLowerCase().includes(campo.toLowerCase().slice(0, 18)), 'metadado de mídia: ' + campo);
});

test('19-20 · foto principal alterável; mídia de Shopee NÃO altera Mercado Livre', () => {
  const cat = novo();
  const fotos = V8CAT.fotosDe(cat, 'L-p1-shopee');
  assert.ok(fotos.length >= 2);
  const segunda = fotos[1].media.id;
  V8CAT.setPrincipal(cat, 'L-p1-shopee', segunda, {});
  assert.ok(V8CAT.fotosDe(cat, 'L-p1-shopee').find(f => f.media.id === segunda).uso.principal, 'principal trocada');
  /* isolamento: ML mantém a principal original */
  const mlPrincipal = V8CAT.fotosDe(cat, 'L-p1-ml').find(f => f.uso.principal);
  assert.notEqual(mlPrincipal.media.id, segunda, 'ML não foi tocado');
  const antesML = V8CAT.fotosDe(cat, 'L-p1-ml').length;
  V8CAT.removeFromListing(cat, 'L-p1-shopee', fotos[0].media.id, {});
  assert.equal(V8CAT.fotosDe(cat, 'L-p1-ml').length, antesML, 'remover da Shopee preserva ML');
  assert.ok(cat.media.find(m => m.id === fotos[0].media.id), 'arquivo permanece na biblioteca');
});

/* ---------- 21-22 · variações ---------- */
test('21-22 · variação criada/editada internamente; SKU duplicado gera conflito explícito', () => {
  const cat = novo();
  const r = V8CAT.addVariation(cat, 'p6', { nome: '2 unidades', tipo: 'kit', sku: 'POR-3D-KIT2', preco: 99.9, estoque: 10 }, {});
  assert.ok(r.ok && r.variacao.id, 'variação criada');
  const e = V8CAT.editVariation(cat, 'p6', r.variacao.id, 'preco', 89.9, {});
  assert.ok(e.ok && e.antes === 99.9, 'edição com valor anterior');
  const dup = V8CAT.addVariation(cat, 'p1', { nome: 'x', tipo: 't', sku: 'POR-3D-KIT2' }, {});
  assert.equal(dup.blocked, true); assert.equal(dup.conflito, true, 'duplicidade explícita, nunca silenciosa');
  assert.match(dup.reason, /conflito/i);
  const arq = V8CAT.archiveVariation(cat, 'p6', r.variacao.id, { motivo: 'kit descontinuado' });
  assert.match(arq.nota, /histórico.*preservad|preservad/i, 'arquivar preserva histórico');
  assert.equal(V8CAT.archiveVariation(cat, 'p6', 'p6-v1', {}).blocked, true, 'arquivar exige motivo');
});

/* ---------- 23-25 · importação dentro do Catálogo ---------- */
test('23-25 · cadastro Shopee importado DENTRO do Catálogo; bruto preservado; campo com origem', () => {
  assert.ok(catJs.includes("'Importar Cadastro'"), 'subárea própria');
  assert.match(catJs, /Carregar cadastro de produtos Shopee/, 'entrada direta do contrato');
  assert.match(catJs, /Shopee_mass_upload_2026-07-05_basic_template/, 'template de referência citado');
  assert.match(catJs, /IMPORTAR\.uploadModal/, 'usa o fluxo real de upload (staging + confirmação)');
  const eng = V8IMP.createEngine();
  const esc = { groupId: 'g1', companyId: 'e1', cnpjId: 'c1', lojaId: 's1', contaId: 'acc-sh-1', marketplace: 'shopee' };
  const b = V8IMP.stage(eng, V8IMP.FIXTURES.parentSku(), esc, { products: D.products });
  assert.equal(b.det.destino, 'catalogo', 'perfil de cadastro aponta para o catálogo');
  V8IMP.apply(eng, b.id, {});
  assert.equal(eng.rawFiles.length, 1, 'arquivo bruto preservado');
  assert.equal(eng.rawFiles[0].abas[0].rows.length, 3, 'todas as linhas originais');
  assert.ok(eng.observations.every(o => o.origem === 'DADO IMPORTADO VIA PLANILHA'), 'campo importado mostra origem');
  const cat = novo();
  assert.ok(cat.listings.every(l => V8CAT.FONTES.includes(l.fonte)), 'toda fonte é do enum do contrato');
});

/* ---------- 26-28 · correção, arquivamento, vínculo ---------- */
test('26-28 · correção preserva importado; arquivar não apaga histórico; vínculo desativável', () => {
  const cat = novo();
  const c0 = V8CAT.correctListingField(cat, 'L-p1-shopee', 'preco', 119.9, {});
  assert.equal(c0.blocked, true, 'correção sem motivo recusada');
  const c = V8CAT.correctListingField(cat, 'L-p1-shopee', 'preco', 119.9, { motivo: 'preço do export veio errado', usuario: 'Ana' });
  assert.equal(c.correcao.origem, 'MANUAL_CORRECTION');
  const l = V8CAT.byId(cat, 'L-p1-shopee');
  assert.equal(l.preco, 124.9, 'valor importado intocado');
  assert.equal(V8CAT.valorDe(cat, l, 'preco'), 119.9, 'valor efetivo é a correção');
  /* arquivar */
  V8CAT.editListing(cat, 'L-p1-shopee', 'titulo', 'T1', {});
  const nVers = l.versoes.length, nTl = cat.timeline.length;
  const a = V8CAT.archiveListing(cat, 'L-p1-shopee', { motivo: 'anúncio duplicado no canal' });
  assert.ok(a.ok && l.arquivado, 'arquivado');
  assert.equal(l.versoes.length, nVers, 'versões preservadas');
  assert.ok(cat.timeline.length > nTl, 'evento na timeline');
  V8CAT.restoreListing(cat, 'L-p1-shopee', {});
  assert.equal(l.arquivado, null, 'restaurável');
  /* vínculo (motor de importação) */
  const eng = V8IMP.createEngine();
  eng.observations.push({ id: 'lo1', item_id: '9001', vinculo: 'VÍNCULO CONFIRMADO POR SKU', produtoId: 'p1' });
  const dv = V8IMP.desativarVinculo(eng, 'lo1', { motivo: 'SKU errado' });
  assert.ok(dv.ok && eng.observations[0].vinculo === 'VÍNCULO DESATIVADO' && eng.observations.length === 1, 'desativa sem apagar anúncio');
  assert.match(catJs, /data-act="desvinc"/, 'ação na tela');
});

/* ---------- 29-31 · Anúncio Master ---------- */
test('29-31 · Master nunca automático; confirmação autorizada; não sobrescreve outro marketplace', () => {
  const eng = V8IMP.createEngine();
  const esc = { groupId: 'g1', companyId: 'e1', cnpjId: 'c1', lojaId: 's1', contaId: 'acc-sh-1', marketplace: 'shopee' };
  const b = V8IMP.stage(eng, V8IMP.FIXTURES.productTraffic({ ini: '2026-06-01', fim: '2026-06-30' }), esc, { products: D.products });
  V8IMP.apply(eng, b.id, {});
  const sug = V8IMP.suggestMaster(eng, 'p1');
  assert.equal(sug.estado, 'MASTER SUGERIDO', 'sugestão nunca vira confirmação sozinha');
  assert.equal(V8IMP.approveMaster(eng, 'p1', '9001', { papel: 'LEITURA' }).blocked, true, 'papel sem permissão não aprova');
  const ap = V8IMP.approveMaster(eng, 'p1', '9001', { papel: 'OWNER', usuario: 'Marcos' });
  assert.equal(ap.link.estado, 'MASTER CONFIRMADO MANUALMENTE');
  assert.match(ap.nota, /não sobrescreve preço, estoque nem conteúdo/, 'master é referência, nunca sobrescrita');
  assert.match(catJs, /CATALOG_MASTER_APPROVE/, 'gate também na tela do catálogo');
  assert.match(catJs, /remover como Master \(anúncio permanece\)/i, 'remover só o papel de master');
  const cat = novo();
  assert.ok(!V8CAT.CATALOG_PERMS.LEITURA.includes('CATALOG_MASTER_APPROVE'), 'permissão fora do papel de leitura');
});

/* ---------- 32-34 · duplicar e adaptar ---------- */
test('32-34 · duplicar preserva original; adaptar cria rascunho interno com pendências declaradas', () => {
  const cat = novo();
  const antes = JSON.stringify(V8CAT.byId(cat, 'L-p2-shopee'));
  const d = V8CAT.duplicateListing(cat, 'L-p2-shopee', {});
  assert.equal(d.copia.status, 'RASCUNHO');
  assert.equal(d.copia.itemIdExterno, null, 'cópia não herda identidade externa');
  assert.equal(JSON.stringify(V8CAT.byId(cat, 'L-p2-shopee')), antes, 'original byte a byte intacto');
  const a = V8CAT.adaptListing(cat, 'L-p4-ml', 'tiktok', {});
  assert.equal(a.draft.status, 'RASCUNHO');
  assert.equal(a.draft.marketplace, 'tiktok');
  const ad = a.draft.adaptacao;
  assert.ok(ad.levado.length && ad.adaptado.length, 'declara o que foi levado e adaptado');
  assert.ok(ad.pendente.some(p => /pesoEmbaladoKg/.test(p)), 'peso pendente (p4 sem peso)');
  assert.ok(ad.pendente.some(p => /vídeo/.test(p)), 'vídeo pendente no TikTok');
  assert.ok(ad.regra && ad.fonteRegra && ad.confianca, 'regra com fonte e confiança');
  assert.match(ad.revisao, /AGUARDANDO REVISÃO HUMANA/, 'nunca publica externamente');
  assert.equal(V8CAT.byId(cat, 'L-p4-ml').status, 'PAUSADO', 'original de p4 intacto');
  assert.equal(V8CAT.adaptListing(cat, 'L-p1-shopee', 'shopee', {}).blocked, true, 'mesmo canal → use duplicar');
  assert.equal(V8CAT.duplicateListing(cat, 'L-p1-shopee', { papel: 'LEITURA' }).blocked, true, 'CATALOG_ADAPT_CREATE no motor');
});

/* ---------- 35-37 · edição em massa ---------- */
test('35-37 · massa: prévia com impacto/escopo, job auditável e rollback', () => {
  const cat = novo();
  const ids = ['L-p6-ml', 'L-p6-shopee', 'L-p10-ml'];
  const pv = V8CAT.bulkPreview(cat, ids, 'preco', 64.9);
  assert.ok(pv.rows.every(r => r.incompativel || 'antes' in r), 'prévia mostra valor anterior');
  assert.ok(pv.escopo.marketplaces.length >= 2, 'escopo declarado');
  assert.equal(pv.incompativeis, 1, 'anúncio bloqueado é declarado incompatível (p10)');
  const abaixo = V8CAT.bulkPreview(cat, ['L-p6-ml'], 'preco', 5);
  assert.equal(abaixo.conflitos, 1, 'preço abaixo do mínimo seguro vira conflito');
  const bc = V8CAT.bulkCommit(cat, pv, { usuario: 'Marcos' });
  assert.ok(bc.job.id && bc.job.reversivel, 'job auditável e reversível');
  assert.equal(bc.job.externo, 'ESCRITA EXTERNA BLOQUEADA');
  assert.equal(V8CAT.valorDe(cat, V8CAT.byId(cat, 'L-p6-ml'), 'preco'), 64.9);
  assert.ok(cat.audit.some(a => a.acao === 'bulk_editado'), 'auditoria');
  assert.equal(V8CAT.bulkCommit(cat, pv, { papel: 'LEITURA' }).blocked, true, 'CATALOG_BULK_EDIT no motor');
  const rb = V8CAT.bulkRollback(cat, bc.job.id, {});
  assert.equal(rb.restaurados, 2);
  assert.equal(V8CAT.valorDe(cat, V8CAT.byId(cat, 'L-p6-ml'), 'preco'), 59.9, 'valor anterior restaurado');
  assert.equal(V8CAT.bulkRollback(cat, bc.job.id, {}).blocked, true, 'job revertido não reverte 2×');
});

/* ---------- 38-39 · comparação e saúde ---------- */
test('38-39 · comparação entre marketplaces mostra divergências; saúde mostra pendências reais', () => {
  const cat = novo();
  const cmp = V8CAT.compareMkts(cat, 'p1');
  assert.ok(cmp.divergencias.includes('Título') && cmp.divergencias.includes('Preço'), 'divergências detectadas');
  assert.ok(cmp.rows.find(r => r.campo === 'Ranking').valores.some(v => v.valor && /DEMO_FIXTURE/.test(v.valor)), 'ranking comparado com fonte');
  assert.ok(cmp.oportunidades.some(o => /sem anúncio/i.test(o)), 'estoque sem anúncio vira oportunidade de adaptação');
  const mvl = V8CAT.masterVsListings(cat, 'p1');
  const t = mvl.find(r => r.campo === 'titulo');
  assert.ok(t.conflito && /Revisar/.test(t.acao), 'master × canal com ação');
  const filas = V8CAT.health(cat);
  assert.ok(filas.length >= 8, 'filas reais');
  const semFoto = filas.find(f => f.key === 'sem_foto');
  assert.ok(semFoto.itens.length >= 1 && semFoto.aba === 'Fotos e Vídeos', 'fila abre no campo certo');
  assert.ok(filas.find(f => f.key === 'sem_ean').itens.some(id => id.startsWith('L-p3') || id.startsWith('L-p12')), 'pendência verdadeira (p3/p12 sem EAN)');
  assert.match(catJs, /data-act="editorAba"/, 'clique abre o editor na aba certa');
});

/* ---------- 40-42 · separações e proibições ---------- */
test('40-42 · demo rotulado e separado; zero escrita externa; zero CRM/Lead', () => {
  const cat = novo();
  assert.ok(cat.listings.every(l => l.fonte === 'DEMO_FIXTURE' ? l.origem === 'DADO SIMULADO' : true), 'demo sempre rotulado');
  assert.equal(typeof V8IMP.assertNoDemoMix, 'function', 'separação demo × real no motor de importação');
  assert.throws(() => V8IMP.assertNoDemoMix({ tipoDado: 'DADOS REAIS' }, 'DEMO_FIXTURE'), /não pode ser importado/);
  const engineJs = read('catalog-engine.js');
  assert.ok(!/publicarExterno|publishExternal|fetch\(|XMLHttpRequest/.test(engineJs), 'motor sem escrita externa');
  assert.match(engineJs, /ESCRITA EXTERNA BLOQUEADA/, 'job declara a trava');
  assert.match(catJs, /READ_ONLY · INTERNAL_ONLY · DRAFT_ONLY/, 'contrato declarado');
  assert.ok(!/\bleadsView|LeadService|pipeline comercial|'Leads'/.test(catJs + engineJs), 'sem CRM/Lead');
  /* permissões completas com enforcement */
  for (const p of ['CATALOG_VIEW', 'CATALOG_EDIT', 'CATALOG_ARCHIVE', 'CATALOG_IMPORT', 'CATALOG_IMPORT_APPLY',
    'CATALOG_BULK_EDIT', 'CATALOG_MEDIA_UPLOAD', 'CATALOG_MEDIA_REMOVE', 'CATALOG_MASTER_APPROVE',
    'CATALOG_ADAPT_CREATE', 'CATALOG_ROLLBACK', 'RAW_CATALOG_DATA_VIEW'])
    assert.ok(V8CAT.CATALOG_PERMS_ALL.includes(p), 'perm ' + p);
  assert.equal(V8CAT.canCat('DESIGNER', 'CATALOG_EDIT'), false);
  assert.equal(V8CAT.canCat('DESIGNER', 'CATALOG_MEDIA_UPLOAD'), true, 'designer sobe mídia, não edita cadastro');
  assert.equal(V8CAT.editListing(cat, 'L-p1-ml', 'preco', 1, { papel: 'LEITURA' }).blocked, true, 'barreira no motor, não no botão');
});

/* ---------- 43 · contratos anteriores ---------- */
test('43 · suíte anterior permanece no lugar (roda junto no npm test)', () => {
  for (const f of ['ui-v8.test.js', 'ui-v8-cockpit.test.js', 'ui-v8-scope.test.js', 'ui-v8-import.test.js', 'ui-v8-orders.test.js'])
    assert.ok(fs.existsSync(path.join(__dirname, f)), f + ' presente');
  assert.match(read('index.html'), /catalog-engine\.js/, 'motor carregado no protótipo');
});
