/* =============================================================
   SPRINT 10.E.2.3 — Importação MULTIABAS real (Métricas Shopee)
   12 critérios de aceite: todas as abas lidas, blocos identificados,
   linha consolidada de período fora da série diária, pedidos não
   vazios, vendas não R$ 0, números brasileiros convertidos, produto
   no Catálogo, fontes em Tráfego/Afiliados/Ads, Mesa atualizada,
   dashboard com fonte/aba/período/granularidade, reimportação sem
   duplicar, valores reais de validação exatos.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8IMP = require('../../design/prototipo-v8/import-engine.js');
const V8FILE = require('../../design/prototipo-v8/file-reader.js');
const DATA = require('../../design/prototipo-v8/data.js');
const D = DATA.V8DATA || DATA;

const read = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const ESC = { groupId: 'g1', companyId: 'e1', cnpjId: 'c1', lojaId: 's1', contaId: 'acc-sh-1', marketplace: 'shopee', tipoDado: 'DADOS REAIS' };
const PER = { ini: '2026-06-04', fim: '2026-07-03' };

const engAplicado = () => {
  const eng = V8IMP.createEngine();
  const res = V8IMP.stage(eng, V8IMP.FIXTURES.metricasPrincipais(PER), ESC, { products: D.products });
  for (const b of res.batches) if (b.preview && b.preview.aplicavel) V8IMP.applyImportChain(eng, b.id, { products: D.products });
  return { eng, res };
};

/* ---------- 1 · números brasileiros convertidos corretamente ---------- */
test('1 · parseBrNumber/brNum: 335.392,51 → 335392.51 · 0,63% → 0.0063 · 1.375 → 1375', () => {
  assert.equal(V8FILE.parseBrNumber('335.392,51'), 335392.51);
  assert.equal(V8FILE.parseBrNumber('0,63%'), 0.0063);
  assert.equal(V8FILE.parseBrNumber('1.375'), 1375);
  assert.equal(V8FILE.parseBrNumber('115.043'), 115043);
  assert.equal(V8FILE.parseBrNumber('R$ 292.591,59'), 292591.59);
  assert.equal(V8FILE.parseBrNumber('-'), null);
  assert.equal(V8FILE.parseBrNumber(1375), 1375, 'número já numérico é preservado');
  assert.equal(V8IMP.brNum('9,30%'), 0.093, 'engine tem o mesmo parser (autossuficiente)');
});

/* ---------- 2 · segmentação de blocos: nunca "linha 1 = cabeçalho" ---------- */
test('2 · segmentBlocks separa título, cabeçalho e blocos independentes na mesma aba', () => {
  const matriz = [
    ['Pedido Feito'], [],
    ['Data', 'Vendas (BRL)', 'Pedidos'],
    ['04/06/2026-03/07/2026', '335.392,51', '1.375'],
    ['04/06/2026', '11.179,75', '46'], [],
    ['Fonte de Tráfego', 'Vendas', 'Cliques'],
    ['Card do Produto', '148.320,44', '38.410'],
  ];
  const bl = V8FILE.segmentBlocks(matriz);
  assert.equal(bl.length, 2, 'dois blocos independentes na mesma aba');
  assert.equal(bl[0].titulo, 'Pedido Feito', 'linha de título reconhecida e associada ao bloco');
  assert.deepEqual(bl[0].headers, ['Data', 'Vendas (BRL)', 'Pedidos']);
  assert.equal(bl[0].rows.length, 2, 'consolidada + diária no primeiro bloco');
  assert.equal(bl[1].headers[0], 'Fonte de Tráfego', 'segundo bloco tem cabeçalho próprio');
});

/* ---------- 3 · todas as abas lidas e todos os blocos identificados ---------- */
test('3 · arquivo multiabas: 8 abas lidas, blocos reconhecidos por tipo, campos preservados', () => {
  const eng = V8IMP.createEngine();
  const res = V8IMP.stage(eng, V8IMP.FIXTURES.metricasPrincipais(PER), ESC, { products: D.products });
  assert.ok(res.multi, 'entrou no caminho multiabas (não tabela plana)');
  assert.equal(res.resumo.abas, 8, 'todas as 8 abas lidas');
  assert.equal(res.resumo.blocos, 8, 'todos os blocos reconhecidos');
  assert.ok(res.resumo.porTipo.metricas > 0 && res.resumo.porTipo.fonte_trafego > 0 && res.resumo.porTipo.contrib_produto > 0,
    'blocos de métricas, fontes e produtos identificados');
  assert.ok(res.resumo.camposPreservados >= 17, 'campos preservados (nada descartado)');
});

/* ---------- 4 · detecção correta por aba (nunca DAILY_METRIC genérico) ---------- */
test('4 · Pedido Feito/Produto Pago → SHOPEE_METRICAS_DIARIAS; fontes e produtos com perfis próprios', () => {
  const f = V8IMP.FIXTURES.metricasPrincipais(PER);
  const det = n => V8IMP.detect({ abas: [{ nome: f.abas[n].nome, headers: f.abas[n].headers }] });
  assert.equal(det(0).perfil, 'SHOPEE_METRICAS_DIARIAS');
  assert.equal(det(0).destino, 'metricas');
  assert.equal(det(2).perfil, 'SHOPEE_TRAFFIC_SOURCE');
  assert.equal(det(4).perfil, 'SHOPEE_PRODUCT_CONTRIBUTION');
});

/* ---------- 5 · linha consolidada de período NÃO entra como dia ---------- */
test('5 · PERIOD_SUMMARY é agregada de período e nunca aparece na série diária', () => {
  const { eng } = engAplicado();
  const mv = V8IMP.metricasView(eng, {});
  const pf = mv.bases.find(b => b.base === 'pedido_feito');
  assert.equal(pf.dias, 30, 'apenas as 30 linhas diárias entram na série');
  assert.ok(pf.diario.every(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d.data))), 'toda linha diária é uma data única, nunca um intervalo');
  assert.equal(pf.periodo.granularidade, 'agregada de período (linha consolidada)', 'total vem da linha consolidada');
  const periodSnaps = eng.snapshots.filter(s => s.metric_type === 'metricas' && s.tipoLinha === 'PERIOD_SUMMARY');
  assert.ok(periodSnaps.length >= 2 && periodSnaps.every(s => s.data == null), 'linha de período salva sem data diária');
});

/* ---------- 6 · números de validação EXATOS (Pedido Feito) ---------- */
test('6 · Pedido Feito: R$ 335.392,51 · 1.375 pedidos · 115.043 visitantes · 0,63%', () => {
  const { eng } = engAplicado();
  const pf = V8IMP.metricasView(eng, {}).bases.find(b => b.base === 'pedido_feito');
  assert.equal(pf.totais.gross_sales_brl, 335392.51, 'vendas não ficam R$ 0,00');
  assert.equal(pf.totais.orders_created, 1375, 'pedidos não ficam vazios');
  assert.equal(pf.totais.visitors, 115043);
  assert.equal(pf.totais.order_conversion_rate, 0.0063, 'conversão BR 0,63% convertida');
  assert.equal(pf.fonte, 'metricas principais .xlsx');
  assert.equal(pf.aba, 'Pedido Feito');
  assert.deepEqual({ ini: pf.periodo.ini, fim: pf.periodo.fim }, { ini: '2026-06-04', fim: '2026-07-03' });
});

/* ---------- 7 · números de validação EXATOS (Produto Pago) ---------- */
test('7 · Produto Pago: R$ 292.591,59 · 1.211 pedidos · 115.043 visitantes · 0,56%', () => {
  const { eng } = engAplicado();
  const pp = V8IMP.metricasView(eng, {}).bases.find(b => b.base === 'produto_pago');
  assert.equal(pp.totais.gross_sales_brl, 292591.59);
  assert.equal(pp.totais.orders_created, 1211);
  assert.equal(pp.totais.visitors, 115043);
  assert.equal(pp.totais.order_conversion_rate, 0.0056);
  assert.equal(pp.aba, 'Produto Pago');
});

/* ---------- 8 · fontes em Tráfego/Afiliados/Ads ---------- */
test('8 · fontes de tráfego alimentam Tráfego, Afiliados e Ads (com origem)', () => {
  const { eng } = engAplicado();
  const tv = V8IMP.trafficSourcesView(eng, {});
  assert.ok(!tv.semDados);
  assert.ok(tv.fontes.length >= 7, 'fontes importadas');
  assert.ok(tv.afiliados.length >= 1, 'Afiliado classificado como afiliados');
  assert.ok(tv.ads.length >= 1, 'Anúncios classificado como ads');
  const card = tv.fontes.find(f => f.fonte === 'Card do Produto');
  assert.equal(card.sales, 148320.44, 'valor BR da fonte convertido');
  assert.equal(card.ctr, 0.093, 'CTR 9,30% vira fração');
  assert.ok(card.fonteArquivo && card.aba && card.periodo, 'fonte declara arquivo/aba/período');
});

/* ---------- 9 · dados de produto no Catálogo, vínculo incerto → revisão humana ---------- */
test('9 · contribuição por produto alimenta o Catálogo; vínculo incerto vai para revisão humana', () => {
  const { eng } = engAplicado();
  const pc = V8IMP.productContribView(eng, {});
  assert.ok(!pc.semDados);
  assert.ok(pc.produtos.length >= 5, 'produtos importados');
  const top = pc.produtos[0];
  assert.equal(top.produto, 'Quadro Paisagem 60x90 Premium');
  assert.equal(top.sales, 92410.5, 'venda BR do produto convertida');
  assert.ok(top.item_id && top.aba && top.fonteArquivo, 'produto declara ID/aba/fonte');
  assert.ok(pc.revisaoHumana.length >= 1, 'vínculo incerto não vincula sozinho — vai para revisão humana');
  const obs = eng.observations.filter(o => o.contribProduto);
  assert.ok(obs.length >= 1, 'observações de catálogo criadas com métricas reais');
  assert.ok(obs[0].vendasPagas > 0, 'venda do anúncio não é R$ 0 (métrica BR normalizada)');
});

/* ---------- 10 · Mesa de Inteligência atualizada com base nessa fonte ---------- */
test('10 · Mesa mostra Analista de Métricas Principais ANALISADO com números reais', () => {
  const { eng } = engAplicado();
  const m = V8IMP.mesaInsights(eng, {});
  const ag = m.agentes.find(a => a.nome === 'Analista de Métricas Principais');
  assert.ok(ag, 'agente de métricas existe');
  assert.equal(ag.status, 'ANALISADO', 'agente analisou a base real');
  assert.ok(m.insights.some(i => i.agente === 'Analista de Métricas Principais'), 'insight de métricas na Mesa');
  assert.ok(eng.impactos.some(i => i.indicadoresRecalculados.includes('Métricas Principais')), 'a cadeia declara Métricas Principais entre as áreas recalculadas');
});

/* ---------- 11 · dashboard com fonte, aba, período e granularidade ---------- */
test('11 · toda leitura carrega fonte, aba, período e granularidade', () => {
  const { eng } = engAplicado();
  const mv = V8IMP.metricasView(eng, {});
  for (const b of mv.bases) {
    assert.ok(b.fonte && b.aba, 'fonte e aba declaradas');
    assert.ok(b.periodo.ini && b.periodo.fim && b.periodo.granularidade, 'período e granularidade declarados');
  }
  const cad = V8IMP.applyImportChain; assert.ok(cad, 'cadeia disponível');
});

/* ---------- 12 · reimportação não duplica linhas ---------- */
test('12 · reimportar o mesmo arquivo não duplica snapshots (concilia, não soma)', () => {
  const { eng } = engAplicado();
  const antes = eng.snapshots.length;
  const totalAntes = V8IMP.metricasView(eng, {}).bases.find(b => b.base === 'pedido_feito').totais.gross_sales_brl;
  const res2 = V8IMP.stage(eng, V8IMP.FIXTURES.metricasPrincipais(PER), ESC, { products: D.products });
  for (const b of res2.batches) if (b && b.id && b.preview && b.preview.aplicavel) V8IMP.applyImportChain(eng, b.id, { products: D.products });
  assert.equal(eng.snapshots.length, antes, 'nenhum snapshot novo na reimportação idêntica');
  const totalDepois = V8IMP.metricasView(eng, {}).bases.find(b => b.base === 'pedido_feito').totais.gross_sales_brl;
  assert.equal(totalDepois, totalAntes, 'total não dobrou — importação concilia, não soma');
});

/* ---------- 13 · contrato de UI: modal multiabas + painéis reais ---------- */
test('13 · UI cablada: modal multiabas e painéis de métricas/fontes/produto reais', () => {
  const imp = read('importar.js');
  assert.ok(/Importar todas as abas reconhecidas/.test(imp), 'ação "Importar todas as abas" no modal');
  assert.ok(/Abas detectadas/.test(imp), 'modal lista abas detectadas');
  assert.ok(/Campos preservados/.test(imp), 'modal declara campos preservados');
  const cr = read('crescimento.js');
  assert.ok(/metricasView/.test(cr) && /trafficSourcesView/.test(cr) && /productContribView/.test(cr), 'Central consome os leitores reais');
  assert.ok(/dados importados reais/.test(cr), 'proveniência (fonte/aba/período/granularidade) exibida');
  const cat = read('catalogo.js');
  assert.ok(/productContribView/.test(cat), 'Catálogo mostra contribuição por produto real');
  /* anti-CRM (contrato permanente) */
  assert.ok(!/\bpipeline\b|\bCRM\b|\blead(s)?\b/i.test(read('import-engine.js')), 'sem CRM/pipeline/leads no motor');
});
