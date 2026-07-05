/* =============================================================
   SPRINT 10.E.3.1 — Convergência do cadastro importado para o
   EDITOR OPERACIONAL COMPLETO de 14 abas (sem tela paralela).
   31 testes: anúncio importado vira listing/produto de 1ª classe,
   campos caem na aba certa, mídia referenciada ≠ validada,
   performance só com vínculo, edição auditada, permissões.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8CAT = require('../../design/prototipo-v8/catalog-engine.js');
const V8IMP = require('../../design/prototipo-v8/import-engine.js');
const DATA = require('../../design/prototipo-v8/data.js');
const D = DATA.V8DATA || DATA;

const read = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const ESC = { companyId: 'e1', contaId: 'acc-sh-1', marketplace: 'shopee' };
const EDITOR_ABAS = ['Informação Básica', 'Especificações', 'Descrição', 'Informações de Vendas', 'Economia do Produto',
  'Variações', 'Lista de Variações', 'Fotos e Vídeos', 'Informações Fiscais', 'Envio e Logística', 'Outros',
  'Performance Comercial', 'Comparar Marketplaces', 'Histórico e Auditoria'];

function perfEng() {
  const eng = V8IMP.createEngine();
  const res = V8IMP.stage(eng, V8IMP.FIXTURES.metricasPrincipais({ ini: '2026-06-04', fim: '2026-07-03' }),
    { groupId: 'g', companyId: 'e1', cnpjId: 'c', lojaId: 's1', contaId: 'acc-sh-1', marketplace: 'shopee', tipoDado: 'DADOS REAIS' }, { products: D.products });
  for (const b of res.batches) if (b.preview && b.preview.aplicavel) V8IMP.applyImportChain(eng, b.id, { products: D.products });
  return eng;
}
function setup(opts) {
  opts = opts || {};
  const cat = V8CAT.createCatalog(JSON.parse(JSON.stringify(D.products)));
  const f = V8CAT.cadastroFixture();
  if (opts.itemMatch) { f.abas[0].rows[0]['ID do Item'] = '9001'; f.abas[0].rows[1]['ID do Item'] = '9001'; }
  if (opts.extra) { f.abas[0].headers.push('Campo Extra X'); f.abas[0].rows[0]['Campo Extra X'] = 'valor-abc'; }
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, f, ESC), { papel: 'OWNER' });
  const eng = opts.perf ? perfEng() : null;
  const cr = V8CAT.cadastroConverge(cat, { eng });
  return { cat, cr, eng };
}
/* listing CONVERGIDO (o que o editor completo enxerga: cat.listings, com produtoId/overrides) */
const impListing = cat => { const raw = cat.cadastro.listings.find(x => x.itemIdExterno === '900101'); return V8CAT.byId(cat, raw.id); };

/* 1-2 — abre o MESMO editor (listing/produto de 1ª classe) e roteamento é editcad→openEditor */
test('01-02 · anúncio importado é listing/produto de 1ª classe e roteia para o editor completo', () => {
  const { cat } = setup();
  const l = impListing(cat);
  assert.ok(V8CAT.byId(cat, l.id), 'byId encontra o anúncio importado (mesmo lst do editor)');
  assert.ok(V8CAT.prodOf(cat, l), 'prodOf encontra o Product Master do anúncio importado');
  const ui = read('catalogo.js');
  assert.ok(/act === 'editcad'\)[^]*?CAT\.openEditor/.test(ui) || /editcad'\) \{ ensureConverged\(\); CAT\.openEditor/.test(ui), 'Editar anúncio importado chama CAT.openEditor (editor completo)');
  assert.ok(/Editar anúncio/.test(ui), 'botão "Editar anúncio" na lista');
});

/* 3 — Informação Básica com dados importados */
test('03 · Informação Básica traz título, marca e proveniência', () => {
  const { cat } = setup();
  const l = impListing(cat);
  assert.equal(V8CAT.valorDe(cat, l, 'titulo'), 'Quadro Paisagem 60x90 Premium');
  assert.equal(V8CAT.valorDe(cat, l, 'marca'), 'Líder Molduras');
  assert.equal(l.situacao, 'STATUS REPORTADO POR PLANILHA');
  assert.ok(l.cadastroRef && l.cadastroRef.arquivo && l.cadastroRef.aba, 'proveniência (arquivo/aba) disponível');
});

/* 4 — Especificações recebem atributos importados */
test('04 · Especificações trazem marca/material/NCM importados', () => {
  const { cat } = setup();
  const l = impListing(cat);
  assert.equal(V8CAT.valorDe(cat, l, 'material'), 'Canvas');
  assert.equal(V8CAT.valorDe(cat, l, 'ncm'), '4911.91.00');
});

/* 5 — Descrição importada */
test('05 · Descrição recebe conteúdo importado', () => {
  const { cat } = setup();
  const p = V8CAT.prodOf(cat, impListing(cat));
  assert.equal(p.master.descricao, 'Quadro decorativo em canvas');
});

/* 6 — Informações de Vendas: preço, estoque, SKU */
test('06 · Vendas trazem preço, estoque e SKU pai importados', () => {
  const { cat } = setup();
  const l = impListing(cat);
  assert.equal(V8CAT.valorDe(cat, l, 'preco'), 124.9);
  assert.equal(l.estoque, 21, 'estoque somado das variações (12+9)');
  assert.equal(l.skuPai, 'QP-6090');
});

/* 7-8 — Variações no editor + lista com SKU/preço */
test('07-08 · variações aparecem no editor vinculadas ao anúncio', () => {
  const { cat } = setup();
  const p = V8CAT.prodOf(cat, impListing(cat));
  assert.equal(p.variacoes.length, 2);
  assert.deepEqual(p.variacoes.map(v => v.sku).sort(), ['QP-6090', 'QP-80120']);
  assert.equal(p.variacoes.find(v => v.sku === 'QP-6090').preco, 124.9);
});

/* 9 — mídia referenciada não é validada */
test('09 · mídia por URL entra como referenciada (não validada) na biblioteca', () => {
  const { cat } = setup();
  const l = impListing(cat);
  const fotos = V8CAT.fotosDe(cat, l.id);
  assert.ok(fotos.length >= 1);
  assert.ok(fotos.every(x => x.media.referenciada === true && x.media.pendenteValidacao === true), 'referenciada + pendente de validação');
  assert.ok(fotos.every(x => x.media.dataUrl == null), 'nunca finge estar baixada');
});

/* 10 — upload manual continua funcionando */
test('10 · upload manual de mídia continua funcionando (CARREGADA MANUALMENTE)', () => {
  const { cat } = setup();
  const r = V8CAT.cadAddMediaManual(cat, cadRawListing(cat).id, { arquivo: 'real.jpg' }, { papel: 'OWNER' });
  assert.ok(r.ok && r.media.status === 'CARREGADA MANUALMENTE');
});
function cadRawListing(cat) { return cat.cadastro.listings.find(x => x.itemIdExterno === '900101'); }

/* 11-12 — Fiscal e Logística recebem dados */
test('11-12 · Fiscal recebe EAN/NCM e Logística recebe peso/dimensões', () => {
  const { cat } = setup();
  const l = impListing(cat);
  assert.equal(V8CAT.valorDe(cat, l, 'ean'), '7890001112223');
  assert.equal(V8CAT.valorDe(cat, l, 'ncm'), '4911.91.00');
  assert.equal(V8CAT.valorDe(cat, l, 'pesoEmbaladoKg'), 1.5);
  assert.equal(V8CAT.valorDe(cat, l, 'alturaCm'), 65);
  assert.equal(V8CAT.valorDe(cat, l, 'larguraCm'), 10);
});

/* 13-14 — campos desconhecidos em Outros + mapeáveis */
test('13-14 · campo desconhecido fica em Outros e pode ser mapeado', () => {
  const { cat } = setup({ extra: true });
  const l = impListing(cat);
  assert.ok(l.camposExtras.some(c => c.coluna === 'Campo Extra X'), 'campo extra preservado no anúncio');
  const r = V8CAT.cadMapearCampo(cat, 'Campo Extra X', 'listing_custom', 'LISTING', { papel: 'OWNER' });
  assert.ok(r.ok);
});

/* 15 — performance só com vínculo confirmado */
test('15 · performance só aparece com vínculo por item_id; senão declara ausência', () => {
  const semMatch = setup({ perf: true });
  assert.equal(V8CAT.perfComercial(semMatch.cat, impListing(semMatch.cat)).semDados, true, 'sem match de item_id → sem performance');
  const comMatch = setup({ perf: true, itemMatch: true });
  const l = V8CAT.cadListings(comMatch.cat).find(x => x.itemIdExterno === '9001');
  const pc = V8CAT.perfComercial(comMatch.cat, V8CAT.byId(comMatch.cat, l.id));
  assert.ok(!pc.semDados && pc.faturamento > 0, 'com item_id igual → performance real vinculada');
});

/* 16 / 30 — nenhum dado demo/fictício em anúncio importado */
test('16-30 · anúncio importado nunca usa dado demo; performance sem vínculo fica vazia', () => {
  const { cat } = setup();
  const l = impListing(cat);
  assert.equal(V8CAT.prodOf(cat, l).origem, 'DADO IMPORTADO VIA PLANILHA');
  assert.equal(l.fonte, 'PLANILHA_SHOPEE');
  assert.equal(l.perf, null, 'sem performance inventada quando não há vínculo');
});

/* 17-18 — Economia usa custo por SKU; sem custo declara cobertura insuficiente */
test('17-18 · Economia: sem custo cadastrado, margem não é inventada (semCusto)', () => {
  const { cat } = setup();
  const si = V8CAT.salesInfo(cat, impListing(cat));
  assert.equal(si.semCusto, true);
  assert.equal(si.margemLiquida, null, 'margem não é inventada sem custo');
  assert.equal(si.precoMinimoSeguro, null);
});

/* 19 — histórico acessível no listing convergido */
test('19 · histórico/versões acessíveis no anúncio convergido', () => {
  const { cat } = setup();
  const l = impListing(cat);
  assert.ok(Array.isArray(l.versoes) && Array.isArray(l.correcoes), 'listing tem trilha de versões e correções');
  assert.doesNotThrow(() => V8CAT.versionsCompare(cat, l.id));
});

/* 20 — cada pendência abre uma aba REAL do editor */
test('20 · toda fila de pendência aponta uma aba existente do editor de 14 abas', () => {
  const { cat } = setup();
  const filas = V8CAT.saudeCadastro(cat);
  for (const f of filas) assert.ok(EDITOR_ABAS.includes(f.aba), `fila ${f.key} → aba do editor (${f.aba})`);
  assert.equal(filas.find(f => f.key === 'sem_ean').aba, 'Informações Fiscais');
  assert.equal(filas.find(f => f.key === 'sem_peso').aba, 'Envio e Logística');
  assert.equal(filas.find(f => f.key === 'sem_custo').aba, 'Economia do Produto');
});

/* 21-22 — edição manual preserva importado e exige motivo */
test('21-22 · correção manual preserva valor importado e exige motivo', () => {
  const { cat } = setup();
  const raw = cadRawListing(cat);
  assert.ok(V8CAT.cadCorrigirCampo(cat, 'listing', raw.id, 'titulo', 'Novo', { papel: 'OWNER' }).blocked, 'sem motivo, recusa');
  const ok = V8CAT.cadCorrigirCampo(cat, 'listing', raw.id, 'titulo', 'Novo título', { papel: 'OWNER', motivo: 'ajuste' });
  assert.ok(ok.ok);
  assert.equal(raw.correcoes[0].importadoOriginal, 'Quadro Paisagem 60x90 Premium', 'original importado preservado');
});

/* 23 — não sobrescreve outro marketplace */
test('23 · convergência cria só anúncio Shopee; ML/TikTok/Magalu intactos', () => {
  const cat = V8CAT.createCatalog(JSON.parse(JSON.stringify(D.products)));
  const antesOutros = JSON.stringify(cat.listings.filter(l => l.marketplace !== 'shopee'));
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), ESC), { papel: 'OWNER' });
  V8CAT.cadastroConverge(cat, {});
  assert.equal(JSON.stringify(cat.listings.filter(l => l.marketplace !== 'shopee')), antesOutros, 'outros marketplaces intactos');
  assert.ok(cat.listings.some(l => l.cadastroImportado && l.marketplace === 'shopee'));
});

/* 24-26 — permissões reais */
test('24-26 · permissões: leitura não edita; designer sobe mídia mas não edita preço/fiscal', () => {
  const { cat } = setup();
  const raw = cadRawListing(cat);
  assert.ok(V8CAT.cadCorrigirCampo(cat, 'listing', raw.id, 'titulo', 'X', { papel: 'LEITURA', motivo: 'x' }).blocked, 'leitura não corrige');
  assert.equal(V8CAT.canCat('DESIGNER', 'CATALOG_MEDIA_UPLOAD'), true, 'designer pode subir mídia');
  assert.equal(V8CAT.canCat('DESIGNER', 'CATALOG_EDIT'), false, 'designer não altera preço/fiscal');
  assert.equal(V8CAT.canCat('LEITURA', 'CATALOG_EDIT'), false);
});

/* 27 — reimportação atualiza sem duplicar (converge idempotente) */
test('27 · reimportar + reconverter não duplica anúncio/produto', () => {
  const { cat } = setup();
  const nL = cat.listings.filter(l => l.cadastroImportado).length;
  const nP = cat.products.filter(p => p.importado).length;
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), ESC), { papel: 'OWNER' });
  const cr2 = V8CAT.cadastroConverge(cat, {});
  assert.equal(cr2.produtos, 0); assert.equal(cr2.anuncios, 0);
  assert.equal(cat.listings.filter(l => l.cadastroImportado).length, nL, 'nenhum anúncio duplicado');
  assert.equal(cat.products.filter(p => p.importado).length, nP, 'nenhum produto duplicado');
});

/* 28 — todos os campos preservados continuam acessíveis */
test('28 · todos os campos recebidos continuam acessíveis (Campos Recebidos + Outros)', () => {
  const { cat } = setup({ extra: true });
  assert.equal(V8CAT.cadCamposRecebidos(cat).length, 32, '31 + coluna extra preservadas');
  assert.ok(impListing(cat).camposExtras.length >= 1, 'coluna extra acessível no editor (Outros)');
});

/* 29 / 31 — nenhuma escrita externa; contrato de UI */
test('29-31 · nenhuma ação externa; UI converge no editor único (não modal como principal)', () => {
  const { cat } = setup();
  assert.ok(V8CAT.cadListings(cat).every(l => l.situacao === 'STATUS REPORTADO POR PLANILHA'));
  const ui = read('catalogo.js');
  assert.ok(/ensureConverged\(\)/.test(ui), 'converge garantido antes de renderizar o Catálogo');
  assert.ok(/Editar anúncio.*data-act="editcad"/.test(ui.replace(/\n/g, ' ')) || /data-act="editcad"/.test(ui), 'lista abre o editor completo');
  const eng = read('catalog-engine.js');
  assert.ok(!/publicar\(|pushToShopee|api\.shopee|sincronizarShopee/i.test(eng), 'sem escrita externa na Shopee');
});
