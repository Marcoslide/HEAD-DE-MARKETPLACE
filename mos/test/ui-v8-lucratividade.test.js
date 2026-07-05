/* =============================================================
   SPRINT 10.P.3 (Parte 1) — Centro de Lucratividade.
   Taxa fixa por FAIXA DE PREÇO + hierarquia de regras; contribuição
   por SKU + classificação; ponto de equilíbrio com projeção e
   cenários; perdas e vazamentos. Nada de taxa inventada; margem
   sempre com fórmula; estimativa nunca vira lucro real.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('../../design/prototipo-v8/lucro-engine.js');

/* 16 — taxa fixa por faixa de preço aplica a faixa correta */
test('16 · taxa fixa por faixa de preço aplica a faixa certa pelo preço real', () => {
  assert.equal(L.taxaPorFaixa(L.FAIXAS_EXEMPLO, 89.90).valor, 5);
  assert.equal(L.taxaPorFaixa(L.FAIXAS_EXEMPLO, 150).valor, 15);
  assert.equal(L.taxaPorFaixa(L.FAIXAS_EXEMPLO, 300).valor, 26);
  assert.equal(L.taxaPorFaixa([], 100).valor, null, 'sem tabela → declara ausência');
});

/* 17 — regra global/marketplace/conta/produto/SKU: mais específico vence e é declarado */
test('17 · hierarquia de regras: SKU vence marketplace vence global, e declara a regra vencedora', () => {
  const regras = [
    { nivel: 'global', escopo: {}, faixas: L.FAIXAS_EXEMPLO },
    { nivel: 'marketplace', escopo: { marketplace: 'shopee' }, valor: 20 },
    { nivel: 'sku', escopo: { sku: 'QP-6090' }, valor: 4 },
  ];
  assert.equal(L.resolverTaxaFixa(regras, { marketplace: 'shopee', preco: 150 }).regraVencedora, 'REGRA DO MARKETPLACE');
  const r = L.resolverTaxaFixa(regras, { marketplace: 'shopee', sku: 'QP-6090', preco: 150 });
  assert.equal(r.valor, 4);
  assert.equal(r.regraVencedora, 'REGRA DO SKU');
  /* só global (faixa) quando não há regra específica */
  assert.equal(L.resolverTaxaFixa([{ nivel: 'global', escopo: {}, faixas: L.FAIXAS_EXEMPLO }], { preco: 250 }).valor, 26);
});

/* nunca inventa taxa */
test('17b · sem regra aplicável, declara ausência (nunca inventa taxa)', () => {
  const r = L.resolverTaxaFixa([], { preco: 100 });
  assert.equal(r.valor, null);
  assert.match(r.motivo, /nunca inventa/);
});

/* 19 — produto/SKU com contribuição ao ponto de equilíbrio */
test('19 · contribuição por SKU com fórmula e classificação', () => {
  const c = L.contribuicaoSku({ preco: 237.27, custoProduto: 80, comissaoPct: 14, impostoPct: 7, taxaFixa: 26, embalagem: 5, adsRateado: 10, fixoRateado: 20, unidades30d: 40 });
  assert.ok(c.margemContribuicao > 0 && c.margemContribuicaoPct != null, 'contribuição com %');
  assert.ok(['ESCALAR', 'MANTER', 'REPRECIFICAR'].includes(c.classe));
  assert.match(c.formula, /contribuição/);
  assert.match(c.aviso, /não é lucro real/);
});

/* 20 — produto com margem negativa é alertado (CORRIGIR) */
test('20 · produto que vende abaixo do custo variável é CORRIGIR', () => {
  const c = L.contribuicaoSku({ preco: 60, custoProduto: 80, comissaoPct: 14, taxaFixa: 5, unidades30d: 30 });
  assert.ok(c.margemContribuicao < 0);
  assert.equal(c.classe, 'CORRIGIR');
});

/* SEM_DADOS quando falta base */
test('19b · sem custo/comissão, classe SEM_DADOS_SUFICIENTES (não inventa)', () => {
  const c = L.contribuicaoSku({ preco: 100 });
  assert.equal(c.classe, 'SEM_DADOS_SUFICIENTES');
  assert.ok(c.faltas.length >= 1);
});

/* carteira: quem ajuda a pagar a estrutura × quem consome */
test('19c · carteira separa quem ajuda o ponto de equilíbrio de quem prejudica', () => {
  const cart = L.contribuicaoCarteira([
    { sku: 'A', preco: 200, custoProduto: 60, comissaoPct: 14, impostoPct: 7, taxaFixa: 26, unidades30d: 50 },
    { sku: 'B', preco: 50, custoProduto: 70, comissaoPct: 14, taxaFixa: 5, unidades30d: 100 },
  ]);
  assert.equal(cart.ajudam.length, 1);
  assert.equal(cart.prejudicam.length, 1);
  assert.equal(cart.ajudam[0].sku, 'A');
  assert.ok(cart.prejudicam[0].contribuicaoTotal < 0);
});

/* 14 — ponto de equilíbrio com projeção, % atingido, data e tendência */
test('14 · projeção do ponto de equilíbrio: %, ritmo, data projetada, cenários, tendência', () => {
  const be = { custoFixoTotal: 20000, faturamentoBE: 57142.86, realizado: { faturamento: 27142.86, pedidosPagos: 120 } };
  const p = L.projecaoEquilibrio(be, { diaAtual: 10, diasNoMes: 30 });
  assert.ok(p.pctAtingido > 0 && p.pctAtingido < 100);
  assert.ok(p.ritmoDia > 0 && p.diaProjetadoBE > 10);
  assert.ok(['AVANÇANDO', 'AFASTANDO'].includes(p.tendencia));
  assert.ok(p.cenarios.pessimista < p.cenarios.atual && p.cenarios.atual < p.cenarios.otimista, 'cenários ordenados');
});

test('14b · projeção declara insuficiência sem ponto de equilíbrio', () => {
  assert.equal(L.projecaoEquilibrio({ insuficiente: true }).insuficiente, true);
});

/* 21 — devolução/perda aparece como vazamento com origem */
test('21 · perdas e vazamentos agregam por tipo com maior vazamento', () => {
  const p = L.perdas([{ tipo: 'Devoluções', valor: 1240, sku: 'A' }, { tipo: 'Ads sem retorno', valor: 800 }, { tipo: 'Devoluções', valor: 300, sku: 'B' }]);
  assert.equal(p.total, 2340);
  assert.equal(p.maiorVazamento.tipo, 'Devoluções');
  assert.equal(p.maiorVazamento.valor, 1540);
  assert.ok(p.porTipo[0].pct > p.porTipo[1].pct, 'ordenado por valor');
});

/* engine não faz escrita externa nem inventa lucro real */
test('P3 · engine honesto: sem escrita externa; estimativa nunca é lucro real', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../design/prototipo-v8/lucro-engine.js'), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|publicar|api\.shopee/i.test(src));
  assert.match(src, /NUNCA vira lucro real/i);
});
