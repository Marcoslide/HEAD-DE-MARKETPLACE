/* =============================================================
   SPRINT 10.E.2.5.1 — CONTRATO TOTAL DE CAMPOS + VISUALIZAÇÃO
   COMPLETA DAS FONTES REAIS. Toda coluna entra, aparece e alimenta
   a Inteligência. Performance de Produtos, Devoluções e Estoque Full
   com todos os campos; motor de cruzamento por prioridade
   (marketplace + conta + item/variação/SKU/pedido/devolução).
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8IMP = require('../../design/prototipo-v8/import-engine.js');
const V8INT = require('../../design/prototipo-v8/inteligencia-engine.js');
const readSrc = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const crescJs = readSrc('crescimento.js');

const ESC = { groupId: 'g1', companyId: 'c1', cnpjId: 'cn1', lojaId: 'l1', marketplace: 'shopee', contaId: 'conta-lider' };
const PER = { ini: '2026-06-05', fim: '2026-07-04' };
const FILTRO = { contaId: 'conta-lider' };

function novoEng(withAll) {
  const eng = V8IMP.createEngine();
  const imp = file => { const res = V8IMP.stage(eng, file, ESC, {}); const bs = res.multi ? res.batches : [res]; for (const b of bs) if (b && b.id && b.preview && b.preview.aplicavel) V8IMP.applyImportChain(eng, b.id, {}); };
  if (withAll !== false) {
    imp(V8IMP.FIXTURES.productPerformanceReal(PER));
    imp(V8IMP.FIXTURES.returnsReal(PER));
    imp(V8IMP.FIXTURES.inventoryFull('2026-07-05T10:00'));
  }
  eng._imp = imp;
  return eng;
}

/* 1 — Performance recebe todos os campos listados */
test('01 · Performance de Produtos recebe todos os campos do contrato', () => {
  const eng = novoEng();
  const fc = V8IMP.fieldCatalog(eng).map(c => c.coluna);
  for (const col of V8INT.CONTRATOS['Performance de Produtos'].colunas)
    assert.ok(fc.includes(col), 'coluna recebida: ' + col);
});

/* 2 — ID do Item preservado e usado como chave prioritária */
test('02 · ID do Item preservado e é a chave prioritária', () => {
  const eng = novoEng();
  const pv = V8IMP.performanceItemView(eng, FILTRO);
  assert.ok(pv.itens.every(i => i.item_id), 'todo item tem ID do Item');
  const k = V8INT.crossKey(pv.itens[0]);
  assert.equal(k.nivel, 1, 'nível 1 = ID do Item (+ variação)');
});

/* 3 — ID da Variação preservado e usado como chave */
test('03 · ID da Variação preservado e entra na chave', () => {
  const eng = novoEng();
  const pv = V8IMP.performanceItemView(eng, FILTRO);
  const comVar = pv.itens.find(i => i.variacao_id);
  assert.ok(comVar, 'existe item com ID da Variação');
  assert.match(V8INT.crossKey(comVar).chave, /var\|/);
});

/* 4 — SKU Principal e SKU da Variação preservados */
test('04 · SKU Principal e SKU da Variação preservados', () => {
  const eng = novoEng();
  const pv = V8IMP.performanceItemView(eng, FILTRO);
  const it = pv.itens.find(i => i.sku_variacao);
  assert.ok(it.sku_pai && it.sku_variacao, 'SKU principal + variação presentes');
});

/* 5 — todos os campos de vendas aparecem */
test('05 · campos de vendas/pedidos presentes na fonte', () => {
  const eng = novoEng();
  const m = V8IMP.performanceItemView(eng, FILTRO).itens[0].metricas;
  for (const k of ['sales_placed_brl', 'sales_paid_brl', 'orders_placed', 'orders_paid', 'units_placed', 'units_paid', 'buyers_placed', 'buyers_paid', 'conv_placed', 'conv_paid'])
    assert.ok(m[k] != null, 'campo de venda: ' + k);
});

/* 6 — todos os campos de tráfego aparecem */
test('06 · campos de tráfego/descoberta presentes', () => {
  const eng = novoEng();
  const m = V8IMP.performanceItemView(eng, FILTRO).itens[0].metricas;
  for (const k of ['impressions', 'unique_impressions', 'clicks', 'unique_clicks', 'ctr', 'visitors', 'page_views', 'bounce_rate', 'search_clicks', 'likes'])
    assert.ok(m[k] != null, 'campo de tráfego: ' + k);
});

/* 7 — todos os campos de carrinho aparecem */
test('07 · campos de carrinho presentes', () => {
  const eng = novoEng();
  const m = V8IMP.performanceItemView(eng, FILTRO).itens[0].metricas;
  for (const k of ['cart_visitors', 'cart_units', 'cart_conversion']) assert.ok(m[k] != null, 'carrinho: ' + k);
});

/* 8 — funil usa apenas campos disponíveis */
test('08 · funil usa só etapas com dado', () => {
  const eng = novoEng();
  const it = V8IMP.performanceItemView(eng, FILTRO).itens[0];
  assert.ok(it.funil.length === 7, '7 etapas do funil');
  assert.ok(it.funil.every(f => (f.disponivel && f.valor != null) || (!f.disponivel && f.valor == null)), 'coerência disponível×valor');
});

/* 9 — campo ausente declara dados insuficientes (funil) */
test('09 · etapa ausente declara dados insuficientes', () => {
  const eng = novoEng(false);
  const file = V8IMP.FIXTURES.productPerformanceReal(PER);
  /* remove uma coluna de etapa para simular lacuna */
  file.abas[0].rows.forEach(r => { delete r['Unidades (Adicionar ao Carrinho)']; });
  eng._imp = null; const res = V8IMP.stage(eng, file, ESC, {}); const bs = res.multi ? res.batches : [res];
  for (const b of bs) if (b && b.id && b.preview && b.preview.aplicavel) V8IMP.applyImportChain(eng, b.id, {});
  const it = V8IMP.performanceItemView(eng, FILTRO).itens[0];
  const carr = it.funil.find(f => f.etapa === 'Adição ao carrinho');
  assert.equal(carr.disponivel, false, 'etapa carrinho sem dado é declarada indisponível');
  /* a UI renderiza "dados insuficientes" quando a etapa não está disponível */
  assert.match(crescJs, /dados insuficientes/);
});

/* 10 — Performance cruza com Catálogo/Estoque por SKU/ID */
test('10 · Performance cruza com outra fonte por ID/SKU', () => {
  const eng = novoEng();
  const mc = V8INT.motorCruzamento(eng, V8IMP, { listings: [] }, FILTRO);
  const cruzada = mc.entidades.find(e => e.performance && e.estoque);
  assert.ok(cruzada, 'existe entidade cruzando Performance × Estoque pelo mesmo SKU');
  assert.equal(cruzada.sku, '456102-40X60-MB');
});

/* 11 — Performance cruza variação por ID/SKU */
test('11 · cruzamento por variação usa ID/SKU, nunca nome', () => {
  const eng = novoEng();
  const mc = V8INT.motorCruzamento(eng, V8IMP, { listings: [] }, FILTRO);
  assert.ok(mc.entidades.every(e => e.sku), 'chave é sempre SKU (não nome)');
  assert.match(mc.nota, /Nome nunca vincula/i);
});

/* 12 — Devoluções carrega todos os campos reais */
test('12 · Devoluções recebe todos os campos do contrato', () => {
  const eng = novoEng();
  const fc = V8IMP.fieldCatalog(eng).map(c => c.coluna);
  for (const col of V8INT.CONTRATOS['Devoluções e Cancelamentos'].colunas)
    assert.ok(fc.includes(col), 'coluna de devolução: ' + col);
});

/* 13 — Devoluções mostra valor real de reembolso (nunca R$ 0 se há valor) */
test('13 · reembolso real, nunca R$ 0,00 quando há valor', () => {
  const eng = novoEng();
  const dv = V8IMP.devolucoesView(eng, FILTRO);
  assert.ok(dv.reembolsoTotal > 0, 'reembolso total > 0');
  assert.ok(dv.eventos.every(e => e.reembolso > 0), 'cada evento tem reembolso real');
});

/* 14 — Devoluções mostra período real */
test('14 · Devoluções declara período real do arquivo', () => {
  const eng = novoEng();
  const dv = V8IMP.devolucoesView(eng, FILTRO);
  assert.ok(dv.periodo && dv.periodo.ini, 'período não declarado seria falha');
});

/* 15 — devolução não cria pedido novo */
test('15 · devolução não cria pedido novo', () => {
  const eng = novoEng();
  const pedidos = eng.snapshots.filter(s => s.entidade === 'order');
  assert.equal(pedidos.length, 0, 'nenhum pedido criado a partir de devolução');
  const evs = eng.snapshots.filter(s => s.metric_type === 'devolucoes');
  assert.ok(evs.every(s => s.entidade === 'order_event'), 'devolução é order_event, não order');
});

/* 16 — evento de devolução não duplica na reimportação */
test('16 · reimportar devoluções não duplica (chave = ID da Devolução)', () => {
  const eng = novoEng();
  const antes = V8IMP.devolucoesView(eng, FILTRO).eventos.length;
  eng._imp(V8IMP.FIXTURES.returnsReal(PER));
  assert.equal(V8IMP.devolucoesView(eng, FILTRO).eventos.length, antes, 'idempotente');
});

/* 17 — Estoque Full carrega todos os campos */
test('17 · Estoque Full recebe todas as 22 colunas do contrato', () => {
  const eng = novoEng();
  const fc = V8IMP.fieldCatalog(eng).map(c => c.coluna);
  for (const col of V8INT.CONTRATOS['Estoque Full'].colunas)
    assert.ok(fc.includes(col), 'coluna de estoque: ' + col);
});

/* 18 — Estoque Full não soma snapshots */
test('18 · Estoque é snapshot — reimportar não soma', () => {
  const eng = novoEng();
  const sv1 = V8IMP.stockView(eng, FILTRO);
  const skuAntes = sv1.atual.find(s => s.sku === 'QP-6090');
  eng._imp(V8IMP.FIXTURES.inventoryFull('2026-07-05T10:00'));
  const sv2 = V8IMP.stockView(eng, FILTRO);
  assert.equal(sv2.atual.length, sv1.atual.length, 'não cria SKUs novos');
  assert.equal(sv2.atual.find(s => s.sku === 'QP-6090').disponivel, skuAntes.disponivel, 'valor estável, não somado');
});

/* 19 — Estoque Full mostra histórico por SKU e armazém */
test('19 · Estoque Full tem histórico de leituras', () => {
  const eng = novoEng();
  /* segunda leitura real: mesmo SKU/armazém, momento e valores diferentes (estoque mudou) */
  const inv2 = V8IMP.FIXTURES.inventoryFull('2026-07-06T10:00');
  inv2.abas[0].rows[0]['Sellable'] = 9; /* QP-6090 subiu de 4 → 9 numa nova contagem */
  eng._imp(inv2);
  const sv = V8IMP.stockView(eng, FILTRO);
  assert.ok(sv.historico.length >= sv.atual.length, 'histórico acumula leituras');
  const qp = sv.atual.find(s => s.sku === 'QP-6090' && s.armazem === 'Full');
  assert.ok(qp.leituras >= 2, 'SKU com 2+ leituras');
  assert.equal(qp.disponivel, 9, 'snapshot mais recente vira o atual');
});

/* 20 — Estoque Full cruza com performance por SKU */
test('20 · Estoque Full cruza com Performance por SKU', () => {
  const eng = novoEng();
  const mc = V8INT.motorCruzamento(eng, V8IMP, { listings: [] }, FILTRO);
  const e = mc.entidades.find(x => x.sku === '456102-40X60-MB');
  assert.ok(e && e.performance && e.estoque, 'SKU cruza estoque×performance');
});

/* 21 — Inteligência identifica variação de vendas posterior ao Full */
test('21 · Inteligência lê tendência de vendas no Full', () => {
  const eng = novoEng();
  const fi = V8INT.fullIntelligence(eng, V8IMP, FILTRO);
  assert.ok(!fi.semDados && fi.itens.length, 'há leitura sobre o Full');
  assert.ok(fi.itens.some(x => /Fato observado|Dados insuficientes/.test(x.leitura)), 'declara fato observado ou insuficiência');
});

/* 22 — Inteligência não declara causalidade sem evidência */
test('22 · nunca afirma causa sem evidência', () => {
  const eng = novoEng();
  const fi = V8INT.fullIntelligence(eng, V8IMP, FILTRO);
  assert.ok(fi.itens.every(x => x.temEvidenciaCausal === false), 'sem causa afirmada');
  assert.match(fi.nota, /não afirmamos|tendência observada, não causa/);
  /* nenhuma análise afirma "causou" como certeza */
  const an = V8INT.analises(eng, V8IMP, { listings: [] }, FILTRO);
  assert.ok(an.itens.every(a => !/causou|porque o full/i.test(a.fato)), 'fato nunca afirma causa');
});

/* 23 — todas as colunas ficam acessíveis em Campos Recebidos */
test('23 · Campos Recebidos lista toda coluna (nenhuma some)', () => {
  const eng = novoEng();
  const fc = V8IMP.fieldCatalog(eng);
  const todas = [].concat(V8INT.CONTRATOS['Performance de Produtos'].colunas, V8INT.CONTRATOS['Devoluções e Cancelamentos'].colunas, V8INT.CONTRATOS['Estoque Full'].colunas);
  const cols = fc.map(c => c.coluna);
  for (const c of todas) assert.ok(cols.includes(c), 'em Campos Recebidos: ' + c);
  /* cada coluna tem status declarado */
  assert.ok(fc.every(c => c.status), 'toda coluna tem status');
});

/* 24 — campo sem uso fica preservado e mapeável */
test('24 · campo sem mapa fica preservado (aguardando mapeamento), nunca descartado', () => {
  const eng = novoEng(false);
  const file = V8IMP.FIXTURES.returnsReal(PER);
  file.abas[0].headers.push('Coluna Nova Desconhecida');
  file.abas[0].rows[0]['Coluna Nova Desconhecida'] = 'valor-x';
  const res = V8IMP.stage(eng, file, ESC, {}); const bs = res.multi ? res.batches : [res];
  for (const b of bs) if (b && b.id && b.preview && b.preview.aplicavel) V8IMP.applyImportChain(eng, b.id, {});
  const nova = V8IMP.fieldCatalog(eng).find(c => c.coluna === 'Coluna Nova Desconhecida');
  assert.ok(nova, 'coluna desconhecida preservada');
  assert.equal(nova.status, 'aguardando mapeamento');
});

/* 25 — toda análise informa fonte, período, escopo e cobertura */
test('25 · toda análise traz fonte + campos + período + cobertura + confiança', () => {
  const eng = novoEng();
  const an = V8INT.analises(eng, V8IMP, { listings: [] }, FILTRO);
  assert.ok(an.itens.length, 'há análises');
  for (const a of an.itens) {
    assert.ok(a.fonte && a.campos && a.campos.length && a.cobertura && a.confianca, 'metadados completos: ' + a.tipo);
  }
});

/* 26 — dados reais removem fixture equivalente no mesmo escopo */
test('26 · cobertura real desativa demo equivalente', () => {
  const eng = novoEng();
  const cob = V8IMP.coberturaReal(eng);
  assert.ok(cob.performance && cob.devolucoes && cob.estoque, 'as três fontes marcam cobertura real');
});

/* 27 — nenhuma tela mostra dado demo no escopo real */
test('27 · sem dado demo quando há arquivo real (semArquivo declara honesto)', () => {
  const eng = novoEng(false);
  const pv = V8IMP.performanceItemView(eng, FILTRO);
  assert.ok(pv.semDados, 'sem arquivo → semDados, não demo');
  /* a UI mostra "SEM DADOS" + contrato, nunca números inventados */
  assert.match(crescJs, /SEM DADOS — nenhum arquivo/);
  assert.match(crescJs, /Nada é estimado nem preenchido com demo/);
});

/* 28 — reimportação não duplica dados (as três fontes) */
test('28 · reimportar as três fontes não duplica', () => {
  const eng = novoEng();
  const b = { p: V8IMP.performanceItemView(eng, FILTRO).itens.length, d: V8IMP.devolucoesView(eng, FILTRO).eventos.length, s: V8IMP.stockView(eng, FILTRO).atual.length };
  eng._imp(V8IMP.FIXTURES.productPerformanceReal(PER));
  eng._imp(V8IMP.FIXTURES.returnsReal(PER));
  eng._imp(V8IMP.FIXTURES.inventoryFull('2026-07-05T10:00'));
  const a = { p: V8IMP.performanceItemView(eng, FILTRO).itens.length, d: V8IMP.devolucoesView(eng, FILTRO).eventos.length, s: V8IMP.stockView(eng, FILTRO).atual.length };
  assert.deepEqual(a, b, 'contagens estáveis');
});

/* 29 — períodos sobrepostos atualizam em vez de somar (performance) */
test('29 · período sobreposto atualiza a performance, não soma', () => {
  const eng = novoEng();
  const antes = V8IMP.performanceItemView(eng, FILTRO).totais.sales_paid_brl;
  eng._imp(V8IMP.FIXTURES.productPerformanceReal(PER)); /* mesmo período */
  const depois = V8IMP.performanceItemView(eng, FILTRO).totais.sales_paid_brl;
  assert.equal(depois, antes, 'total não dobra na reimportação do mesmo período');
});

/* 30 — nenhuma escrita externa é disparada */
test('30 · nenhuma escrita externa no marketplace', () => {
  const eng = novoEng();
  const intJs = readSrc('inteligencia-engine.js');
  assert.ok(!/publicarNaShopee|pushToMarketplace|fetch\(|XMLHttpRequest/i.test(intJs), 'motor de inteligência não escreve fora');
  assert.ok(!/publicarNaShopee|pushToMarketplace/i.test(crescJs), 'Central não publica externamente');
});

/* 31 — estrutura de subabas e renderers presentes na UI */
test('31 · UI: três áreas com subabas + Campos Recebidos + Cruzamentos', () => {
  assert.match(crescJs, /CONTRATO_AREAS/);
  assert.match(crescJs, /function areaContratoTotal/);
  assert.match(crescJs, /function camposRecebidosPanel/);
  assert.match(crescJs, /function cruzamentosPanel/);
  for (const sub of ['Funil de Conversão', 'Tráfego e Descoberta', 'Carrinho', 'Vendas e Pedidos'])
    assert.ok(crescJs.includes(`'${sub}'`), 'subaba de performance: ' + sub);
  for (const sub of ['Eventos de Devolução', 'Reembolsos', 'Retorno ao Armazém'])
    assert.ok(crescJs.includes(`'${sub}'`), 'subaba de devoluções: ' + sub);
  for (const sub of ['Estoque por Armazém', 'Reposição', 'Cobertura e Velocidade', 'Estoque Crítico', 'Histórico de Snapshots'])
    assert.ok(crescJs.includes(`'${sub}'`), 'subaba de estoque: ' + sub);
  /* cabeçalho de área com caminho na Shopee + cobertura */
  assert.match(crescJs, /Caminho na Shopee/);
  assert.match(crescJs, /Cobertura:/);
});
