/* =============================================================
   SPRINT 10.E.3.3 — CATÁLOGO OPERACIONAL COMPLETO
   Matriz da Loja → Rascunho → Mídia real → Validação → Aprovação
   → Publicação controlada → Identidade externa (Item ID + SKU) →
   SKU como chave de inteligência + criativos + experimentos.
   Testes de motor + contrato de fonte; interações (arrastar, preview,
   mobile, console) são cobertas no headless v8-validate-operacional.js.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8DATA = require('../../design/prototipo-v8/data.js').V8DATA;
const V8CAT = require('../../design/prototipo-v8/catalog-engine.js');
const src = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const catJs = src('catalogo.js');
const engJs = src('catalog-engine.js');

const freshCat = () => V8CAT.createCatalog(JSON.parse(JSON.stringify(V8DATA.products)));
const primeiro = cat => cat.listings[0];

/* 1/2 — Matriz da Loja existe; rascunho de marketplace vinculado à Matriz */
test('01·02 · Matriz da Loja é a verdade interna e vincula rascunhos', () => {
  const cat = freshCat();
  const l = primeiro(cat);
  const mz = V8CAT.matrizDaLoja(cat, l.produtoId);
  assert.ok(mz && mz.skuPai && mz.variacoesInternas.length, 'Matriz com SKU pai e variações');
  const draft = V8CAT.duplicateListing(cat, l.id, {}).copia;
  const mz2 = V8CAT.matrizDaLoja(cat, l.produtoId);
  assert.ok(mz2.rascunhos.some(r => r.id === draft.id), 'rascunho aparece na Matriz');
  assert.match(mz.nota, /verdade interna/);
});

/* 3 — rascunho não é anúncio ativo */
test('03 · rascunho não conta como anúncio ativo', () => {
  const cat = freshCat();
  const draft = V8CAT.duplicateListing(cat, primeiro(cat).id, {}).copia;
  assert.ok(draft.interno, 'duplicado é interno (rascunho)');
  assert.ok(!['ATIVO', 'PAUSADO'].includes(draft.status), 'rascunho não é status ativo');
});

/* 4/5 — mídia real com preview persistido (dataUrl) */
test('04·05 · upload de mídia guarda dataUrl real (preview), não só nome', () => {
  const cat = freshCat(); const l = primeiro(cat);
  const r = V8CAT.addMediaReal(cat, { produtoId: l.produtoId, listingId: l.id, arquivo: 'a.png', dataUrl: 'data:image/png;base64,AAA', dims: '1200x1200', origem: 'DASHBOARD_MANUAL' });
  assert.ok(r.ok && r.media.dataUrl && /^data:/.test(r.media.dataUrl), 'preview persistido como dataUrl');
});

/* 6 — foto persiste no modelo após adicionar (base para "persiste após refresh") */
test('06 · foto adicionada permanece na galeria do anúncio', () => {
  const cat = freshCat(); const l = primeiro(cat);
  const antes = V8CAT.fotosDe(cat, l.id).length;
  V8CAT.addMediaReal(cat, { produtoId: l.produtoId, listingId: l.id, arquivo: 'b.png', dataUrl: 'data:image/png;base64,BBB' });
  assert.equal(V8CAT.fotosDe(cat, l.id).length, antes + 1);
});

/* 7 — foto registra origem, hash, ordem, SKU e vínculo */
test('07 · mídia registra origem, hash, ordem e SKU', () => {
  const cat = freshCat(); const l = primeiro(cat);
  const r = V8CAT.addMediaReal(cat, { produtoId: l.produtoId, listingId: l.id, arquivo: 'c.png', dataUrl: 'data:image/png;base64,CCC', origem: 'WHATSAPP_COMMAND', skuVariacao: l.skuPai });
  const uso = r.media.usos.find(u => u.listingId === l.id);
  assert.ok(r.media.hash && r.media.origem === 'WHATSAPP_COMMAND' && uso && uso.posicao != null && r.media.skuVariacao === l.skuPai);
});

/* 8/9 — arrastar reordena e persiste */
test('08·09 · reordenar fotos persiste a nova ordem', () => {
  const cat = freshCat(); const l = primeiro(cat);
  const nova = V8CAT.addMediaReal(cat, { produtoId: l.produtoId, listingId: l.id, arquivo: 'd.png', dataUrl: 'data:image/png;base64,DDD' }).media;
  const r = V8CAT.reorderMedia(cat, l.id, nova.id, 0, {});
  assert.ok(r.ok);
  assert.equal(V8CAT.fotosDe(cat, l.id)[0].media.id, nova.id, 'foto movida para primeira posição');
});

/* 10/11 — imagem principal + vira capa (primeira posição) */
test('10·11 · definir imagem principal e refletir como capa', () => {
  const cat = freshCat(); const l = primeiro(cat);
  const fotos = V8CAT.fotosDe(cat, l.id);
  const alvo = fotos[fotos.length - 1].media.id;
  V8CAT.setPrincipal(cat, l.id, alvo, {});
  assert.ok(V8CAT.fotosDe(cat, l.id).find(f => f.media.id === alvo).uso.principal, 'principal marcada');
  V8CAT.reorderMedia(cat, l.id, alvo, 0, {});
  assert.ok(V8CAT.fotosDe(cat, l.id)[0].uso.principal, 'primeira posição vira capa');
});

/* 12 — duplicidade detectada por hash */
test('12 · mídia idêntica (hash) não duplica silenciosamente', () => {
  const cat = freshCat(); const l = primeiro(cat);
  V8CAT.addMediaReal(cat, { produtoId: l.produtoId, listingId: l.id, arquivo: 'e.png', dataUrl: 'data:image/png;base64,EEE' });
  const dup = V8CAT.addMediaReal(cat, { produtoId: l.produtoId, listingId: l.id, arquivo: 'e2.png', dataUrl: 'data:image/png;base64,EEE' });
  assert.ok(dup.duplicada === true, 'dedup por hash');
});

/* 15 — foto vinculada à variação e ao SKU */
test('15 · mídia pode ser vinculada a SKU/variação', () => {
  const cat = freshCat(); const l = primeiro(cat);
  const m = V8CAT.addMediaReal(cat, { produtoId: l.produtoId, listingId: l.id, arquivo: 'f.png', dataUrl: 'data:image/png;base64,FFF' }).media;
  assert.ok(V8CAT.vincularMediaSku(cat, m.id, 'SKU-VAR-1', {}).ok);
  assert.equal(cat.media.find(x => x.id === m.id).skuVariacao, 'SKU-VAR-1');
});

/* 16/17 — editor Shopee em formato vertical com 8 seções */
test('16·17 · editor Shopee vertical com as 8 seções do Seller Center', () => {
  assert.match(catJs, /EDITOR_SHOPEE|SHOPEE_SECOES/);
  for (const s of ['Informações Básicas', 'Especificações', 'Descrição', 'Informações de Vendas', 'Lista de Variações', 'Informações Fiscais', 'Envio', 'Outros'])
    assert.ok(catJs.includes(s), 'seção Shopee: ' + s);
});

/* 18/19 — Shopee Item ID aparece e permanece após edição */
test('18·19 · Item ID externo persiste na identidade após editar', () => {
  const cat = freshCat();
  const l = cat.listings.find(x => x.itemIdExterno);
  const idAntes = V8CAT.identidadeExterna(cat, l).external_listing_id;
  V8CAT.editListing(cat, l.id, 'titulo', 'Novo título', { usuario: 'Marcos' });
  assert.equal(V8CAT.identidadeExterna(cat, l).external_listing_id, idAntes, 'Item ID não muda ao editar campo');
});

/* 20/21 — Variation ID e SKUs persistem por variação */
test('20·21 · Variation ID e SKUs ficam na identidade externa', () => {
  const cat = freshCat(); const l = primeiro(cat);
  l.variationIdExterno = '555'; l.sellerSku = 'SELLER-1'; l.variationSku = 'VAR-1';
  const id = V8CAT.identidadeExterna(cat, l);
  assert.equal(id.external_variation_id, '555');
  assert.equal(id.seller_sku, 'SELLER-1');
  assert.equal(id.variation_sku, 'VAR-1');
});

/* 22/23 — performance cruza por Item ID; por SKU quando não há Item ID */
test('22·23 · SKU dossiê cruza por Item ID e cai para SKU sem Item ID', () => {
  const cat = freshCat();
  const comId = cat.listings.find(l => l.itemIdExterno);
  const d1 = V8CAT.skuDossie(cat, comId.skuPai, { performance: [{ sku_pai: comId.skuPai, conta: 'a' }] });
  assert.equal(d1.chaveUsada, 'Item ID + SKU');
  const semId = freshCat(); const l2 = semId.listings.find(l => !l.itemIdExterno) || semId.listings[0];
  l2.itemIdExterno = null;
  const d2 = V8CAT.skuDossie(semId, l2.skuPai, { performance: [{ sku_variacao: l2.skuPai, conta: 'a' }] });
  assert.ok(d2.performance.length === 1, 'cruza por SKU quando não há Item ID');
});

/* 24 — estoque cruza por SKU */
test('24 · Estoque Full cruza com anúncio por SKU', () => {
  const cat = freshCat(); const l = primeiro(cat);
  const d = V8CAT.skuDossie(cat, l.skuPai, { estoque: [{ sku_variacao: l.skuPai, conta: 'a', sellable: 5 }] });
  assert.equal(d.estoque.length, 1);
});

/* 28/29 — mesmo SKU por marketplace separado + comparação; contas não somam */
test('28·29 · mesmo SKU comparável entre marketplaces, contas separadas', () => {
  const cat = freshCat(); const l = primeiro(cat);
  const d = V8CAT.skuDossie(cat, l.skuPai, { performance: [{ sku_pai: l.skuPai, conta: 'shp-mg' }, { sku_pai: l.skuPai, conta: 'ml-sp' }] });
  assert.ok(d.marketplaces.length >= 1, 'lista marketplaces do SKU');
  assert.ok(d.multiConta === true && /não são somados|NÃO são somados/i.test(d.nota), 'contas diferentes não somam sem avisar');
});

/* 30/31 — criativos ficam ligados ao SKU; histórico ligado ao SKU */
test('30·31 · criativos vinculam por SKU (nunca só nome)', () => {
  const cat = freshCat(); const l = primeiro(cat);
  assert.ok(V8CAT.addCreative(cat, { tipo: 'foto', marketplace: 'shopee' }, {}).blocked, 'sem SKU é recusado');
  const r = V8CAT.addCreative(cat, { sku: l.skuPai, tipo: 'foto', marketplace: 'shopee', metricaAvaliacao: 3 }, {});
  assert.ok(r.ok && V8CAT.criativosDoSku(cat, l.skuPai).length === 1);
});

/* 32/33 — experimento registra hipótese/período/métricas; nunca vencedor sem evidência */
test('32·33 · experimento honesto: sem amostra/período/cobertura não vira vencedor', () => {
  const cat = freshCat(); const l = primeiro(cat);
  assert.ok(V8CAT.criarExperimento(cat, { sku: l.skuPai, metricaPrincipal: 'CTR' }, {}).blocked, 'sem hipótese recusa');
  const e = V8CAT.criarExperimento(cat, { sku: l.skuPai, hipotese: 'foto B', metricaPrincipal: 'CTR' }, {}).experimento;
  const av = V8CAT.avaliarExperimento(cat, e.experiment_id, { vencedorClaro: true, amostraSuficiente: false, periodoSuficiente: true, coberturaSuficiente: true }, {});
  assert.equal(av.experimento.status, 'INCONCLUSIVO', 'sem amostra não declara vencedor');
  const av2 = V8CAT.avaliarExperimento(cat, e.experiment_id, { vencedorClaro: true, amostraSuficiente: true, periodoSuficiente: true, coberturaSuficiente: true, vencedor: 'B' }, {});
  assert.equal(av2.experimento.status, 'VENCEDOR_CONFIRMADO');
});

/* 34/35 — publicação exige confirmação + Empresa/Canal/Marketplace/Conta */
test('34·35 · publicação bloqueada sem confirmação e sem escopo completo', () => {
  const cat = freshCat();
  const draft = V8CAT.duplicateListing(cat, primeiro(cat).id, {}).copia;
  const r = V8CAT.solicitarPublicacao(cat, draft.id, { confirmacaoExplicita: false });
  assert.ok(r.blocked && /confirmação explícita/.test(r.faltas.join(',')), 'exige confirmação');
  assert.ok(r.faltas.some(f => /Empresa\/Canal/.test(f)), 'exige escopo completo');
});

/* 36/37 — publicação salva IDs externos só no retorno oficial; ativo só após retorno */
test('36·37 · anúncio só entra em ativo após retorno oficial (IDs salvos)', () => {
  const cat = freshCat();
  const draft = V8CAT.duplicateListing(cat, primeiro(cat).id, {}).copia;
  const pub = V8CAT.solicitarPublicacao(cat, draft.id, { empresa: 'L', canal: 'C', conta: 'x', validado: true, confirmacaoExplicita: true, integracaoAutorizada: true });
  assert.ok(pub.ok && pub.pedido.escritaExterna === false, 'só solicitação interna, sem escrita externa');
  assert.equal(draft.lifecycle, 'PUBLICACAO_SOLICITADA');
  assert.ok(!['ATIVO'].includes(draft.status), 'ainda não ativo antes do retorno');
  const ret = V8CAT.registrarRetornoOficial(cat, draft.id, { aceito: true, externalListingId: '999', externalVariationId: '998', sellerSku: 'S1' }, {});
  assert.ok(ret.ativo && draft.itemIdExterno === '999' && draft.variationIdExterno === '998' && draft.lifecycle === 'PUBLICADO_E_ATIVO');
});

/* 38 — conflito entre Item ID e SKU: identidade declara confiança/origem */
test('38 · identidade externa declara confiança e origem do vínculo', () => {
  const cat = freshCat(); const l = primeiro(cat);
  l.itemIdExterno = null;
  const id = V8CAT.identidadeExterna(cat, l);
  assert.match(id.identity_confidence, /SKU|nome/i);
  assert.ok(['SKU', 'NOME', 'ID_EXTERNO'].includes(id.identity_origin));
});

/* 39/40/41 — filtros recolhidos + chips só de ativos + colunas em seletor (UI) */
test('39·40·41 · filtros recolhidos, chips de ativos e seletor de colunas na UI', () => {
  assert.match(catJs, /Filtros|filtros recolh/i);
  assert.match(catJs, /chip/i);
  assert.match(catJs, /Colunas|colSel|seletor de colunas/i);
});

/* 43 — nenhuma escrita externa é disparada */
test('43 · publicação nunca escreve externamente (só solicitação interna)', () => {
  assert.ok(!/api\.shopee|push_to_shopee|fetch\(|XMLHttpRequest|sincroniza/i.test(engJs.replace(/publish(ed)?_?[aA]t/g, '')), 'sem chamada de escrita externa');
  assert.match(engJs, /escritaExterna: false/);
});

/* P2-A — WhatsApp: "Criar anúncio deste produto na Shopee" cria/vincula Matriz + Rascunho + SKU + pendências */
test('P2 · WhatsApp cria rascunho vinculado à Matriz com SKU e pendências', () => {
  const cat = freshCat(); const p = cat.products[0];
  const r = V8CAT.criarAnuncioComando(cat, 'Criar anúncio deste produto na Shopee', { produtoId: p.id });
  assert.ok(r.ok && r.marketplace === 'Shopee' && r.sku === p.sku && r.draftId, 'rascunho criado com SKU');
  assert.ok(Array.isArray(r.pendencias), 'lista de pendências');
  const draft = cat.listings.find(l => l.id === r.draftId);
  assert.ok(draft.interno && /RASCUNHO|AGUARDANDO/.test(draft.lifecycle), 'rascunho, não ativo');
});

/* P2-B — comando ambíguo (sem marketplace) pede confirmação */
test('P2 · comando sem marketplace pede confirmação', () => {
  const cat = freshCat();
  const r = V8CAT.criarAnuncioComando(cat, 'Criar anúncio deste produto', { produtoId: cat.products[0].id });
  assert.ok(r.precisaConfirmar && /marketplace/i.test(r.pergunta));
});

/* P2-C — foto via WhatsApp entra no anúncio certo por SKU, origem WHATSAPP_COMMAND */
test('P2 · foto por WhatsApp vincula por SKU com origem WHATSAPP_COMMAND', () => {
  const cat = freshCat();
  const l = cat.listings.find(x => x.marketplace === 'shopee');
  const r = V8CAT.anexarFotoComando(cat, `Coloque essa foto no anúncio ${l.skuPai} da Shopee`, { arquivo: 'w.jpg', dataUrl: 'data:image/png;base64,AAA' }, {});
  assert.ok(r.ok && r.via === 'SKU', 'vinculada por SKU');
  assert.ok(cat.media.some(m => m.origem === 'WHATSAPP_COMMAND' && m.usos.some(u => u.listingId === l.id)));
});

/* P2-D — comando de foto ambíguo pede confirmação por Item ID/SKU */
test('P2 · foto por WhatsApp ambígua pede confirmação', () => {
  const cat = freshCat();
  const r = V8CAT.anexarFotoComando(cat, 'Coloque essa foto no anúncio Quadro', {}, {});
  assert.ok(r.precisaConfirmar && (r.candidatos || []).length > 1);
});

/* P2-E — adaptar criativo vencedor entre marketplaces é PROPOSTA, nunca vencedor às cegas */
test('P2 · adaptar criativo entre marketplaces é proposta com teste', () => {
  const cat = freshCat(); const l = cat.listings[0];
  assert.ok(V8CAT.adaptarCriativoVencedor(cat, l.skuPai, 'ml', {}).blocked, 'sem base comparável, não adapta');
  V8CAT.addCreative(cat, { sku: l.skuPai, tipo: 'foto', metricaAvaliacao: 3.4, marketplace: 'shopee' }, {});
  V8CAT.addCreative(cat, { sku: l.skuPai, tipo: 'foto', metricaAvaliacao: 2.1, marketplace: 'shopee' }, {});
  const r = V8CAT.adaptarCriativoVencedor(cat, l.skuPai, 'ml', {});
  assert.ok(r.ok && r.criativo.status === 'PROPOSTO' && /PROPOSTA/i.test(r.nota));
});

/* P2-F — Marketplaces: filtros recolhidos por padrão + toolbar compacta + WhatsApp */
test('P2 · Marketplaces com filtros recolhidos, toolbar compacta e criação por WhatsApp', () => {
  assert.match(catJs, /filtrosOpen: false/);
  assert.match(catJs, /data-act="anfilt"/);
  for (const b of ['data-act="ancols"', 'data-act="anord"', 'data-act="anacoes"']) assert.ok(catJs.includes(b), 'toolbar: ' + b);
  assert.match(catJs, /data-act="whatscriar"/, 'criar por WhatsApp');
  assert.match(catJs, /function sidePanelShopee/, 'painel lateral do editor Shopee');
});

/* 45 — estrutura das 3 áreas do Catálogo preservada + estados de ciclo de vida */
test('45 · 3 áreas do Catálogo mantidas; 16 estados de ciclo de vida', () => {
  assert.match(catJs, /const MAIN_SUBS = \['Visão Geral', 'Rascunhos', 'Marketplaces'\]/);
  assert.equal(V8CAT.LIFECYCLE.length, 16, '16 estados rastreáveis');
  assert.ok(V8CAT.LIFECYCLE.includes('PUBLICACAO_SOLICITADA') && V8CAT.LIFECYCLE.includes('PUBLICADO_E_ATIVO'));
});
