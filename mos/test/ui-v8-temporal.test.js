/* =============================================================
   SPRINT 10.E.2.5.2 — Modelo temporal + upsert + filtros por período.
   Todo dado ganha contexto temporal; o filtro global respeita a
   granularidade (agregado de 30 dias não vira dia falso); upsert real
   (insere novo, ignora idêntico, atualiza mudado, merge sem apagar).
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8IMP = require('../../design/prototipo-v8/import-engine.js');
const V8TIME = require('../../design/prototipo-v8/tempo-engine.js');
const src = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');

const ESC = { groupId: 'g1', companyId: 'c1', cnpjId: 'cn1', lojaId: 'l1', marketplace: 'shopee', contaId: 'conta-lider' };
const PER = { ini: '2026-06-05', fim: '2026-07-04' };
const H = '2026-07-05';
const imp = (eng, file) => { const res = V8IMP.stage(eng, file, ESC, {}); const bs = res.multi ? res.batches : [res]; for (const b of bs) if (b && b.id && b.preview && b.preview.aplicavel) V8IMP.applyImportChain(eng, b.id, {}); };

/* 3/4 — presets de período resolvem intervalos corretos */
test('03·04 · presets de período resolvem intervalos corretos', () => {
  assert.equal(V8TIME.PRESETS.length, 13, '13 presets (12 + custom)');
  assert.deepEqual([V8TIME.resolvePeriodo('hoje', { hoje: H }).ini, V8TIME.resolvePeriodo('hoje', { hoje: H }).fim], [H, H]);
  assert.equal(V8TIME.resolvePeriodo('7d', { hoje: H }).ini, '2026-06-29');
  assert.equal(V8TIME.resolvePeriodo('30d', { hoje: H }).ini, '2026-06-06');
  assert.equal(V8TIME.resolvePeriodo('ontem', { hoje: H }).ini, '2026-07-04');
  const c = V8TIME.resolvePeriodo('custom', { hoje: H, custom: { ini: '2026-01-01', fim: '2026-01-31' } });
  assert.deepEqual([c.ini, c.fim], ['2026-01-01', '2026-01-31']);
});

/* 9 — todo snapshot ganha campos temporais */
test('09 · snapshot recebe campos temporais (occurred_at/period/imported_at/confidence)', () => {
  const eng = V8IMP.createEngine();
  imp(eng, V8IMP.FIXTURES.inventoryFull('2026-07-05T10:00'));
  const est = eng.snapshots.find(s => s.metric_type === 'estoque');
  assert.ok(est.snapshot_at && est.imported_at && est.timezone === 'America/Sao_Paulo');
  assert.equal(est.granularidadeTemporal, 'SNAPSHOT');
  assert.equal(est.temporal_confidence, 'CONFIRMADA');
  imp(eng, V8IMP.FIXTURES.productPerformanceReal(PER));
  const perf = eng.snapshots.find(s => s.metric_type === 'performance_item');
  assert.equal(perf.granularidadeTemporal, 'RANGE_AGGREGATE');
  assert.ok(perf.period_start && perf.period_end);
});

/* 17-24 — filtro por período (respeita granularidade) */
test('17·33 · agregado de 30 dias NÃO é recortado em 7 dias (data não inventada)', () => {
  const eng = V8IMP.createEngine();
  imp(eng, V8IMP.FIXTURES.productPerformanceReal(PER));
  const perfSnaps = eng.snapshots.filter(s => s.metric_type === 'performance_item');
  const p7 = V8TIME.resolvePeriodo('7d', { hoje: H });
  const cob = V8TIME.coberturaTemporal(perfSnaps, p7);
  assert.equal(cob.status, 'DADO_SEM_DATA_EXATA', 'declara honesto, não inventa 7 dias');
  assert.match(cob.mensagem, /agregado/i);
});

test('19 · filtro por últimos 7 dias soma só o que cai no período (dado diário)', () => {
  const eng = V8IMP.createEngine();
  imp(eng, V8IMP.FIXTURES.metricasPrincipais({ ini: '2026-06-04', fim: '2026-07-03' }));
  const diarios = eng.snapshots.filter(s => s.metric_type === 'metricas' && s.granularidadeTemporal === 'DAILY');
  assert.ok(diarios.length > 0, 'há métricas diárias com data');
  const p7 = V8TIME.resolvePeriodo('7d', { hoje: '2026-07-03' });
  const dentro = V8TIME.filtrar(diarios, p7);
  assert.ok(dentro.length >= 1 && dentro.length < diarios.length, 'filtra um subconjunto pelo período');
  assert.ok(dentro.every(s => (V8TIME.dataEvento(s) || '').slice(0, 10) >= p7.ini), 'só dentro do período');
});

/* 34 — snapshot de estoque NUNCA é somado entre datas */
test('34 · estoque é snapshot — o atual é a última leitura, nunca a soma', () => {
  const eng = V8IMP.createEngine();
  imp(eng, V8IMP.FIXTURES.inventoryFull('2026-07-05T10:00'));
  const inv2 = V8IMP.FIXTURES.inventoryFull('2026-07-06T10:00'); inv2.abas[0].rows[0]['Sellable'] = 9;
  imp(eng, inv2);
  const sv = V8IMP.stockView(eng, { contaId: 'conta-lider' });
  const qp = sv.atual.find(s => s.sku === 'QP-6090' && s.armazem === 'Full');
  assert.equal(qp.disponivel, 9, 'atual = última leitura');
  assert.ok(qp.leituras >= 2, 'histórico preservado (não somado)');
});

/* 25/26 — reimportar o mesmo arquivo não duplica */
test('25·26 · reimportar o mesmo arquivo não duplica', () => {
  const eng = V8IMP.createEngine();
  imp(eng, V8IMP.FIXTURES.returnsReal(PER));
  const n1 = eng.snapshots.filter(s => s.metric_type === 'devolucoes').length;
  imp(eng, V8IMP.FIXTURES.returnsReal(PER));
  assert.equal(eng.snapshots.filter(s => s.metric_type === 'devolucoes').length, n1);
});

/* 30 — registro existente alterado ATUALIZA (versão preservada) */
test('30 · registro alterado é atualizado com versão preservada', () => {
  const eng = V8IMP.createEngine();
  imp(eng, V8IMP.FIXTURES.returnsReal(PER));
  const r2 = V8IMP.FIXTURES.returnsReal(PER); r2.abas[0].rows[0]['Quantia Total de Reembolsos'] = '999,99';
  imp(eng, r2);
  const ev = eng.snapshots.find(s => s.metric_type === 'devolucoes' && s.return_id === 'RET-260701-001');
  assert.equal(ev.raw['Quantia Total de Reembolsos'], '999,99', 'valor atualizado');
  assert.ok(ev.versoes.length >= 1, 'versão anterior preservada');
});

/* 36 — não apagar dado antigo ausente no novo arquivo (merge por campo) */
test('36 · campo antigo ausente no novo arquivo é preservado (merge, não apaga)', () => {
  const eng = V8IMP.createEngine();
  imp(eng, V8IMP.FIXTURES.returnsReal(PER));
  /* novo arquivo do mesmo evento SEM a coluna IMEI/Observações, com reembolso novo */
  const r2 = V8IMP.FIXTURES.returnsReal(PER);
  r2.abas[0].rows[0]['Quantia Total de Reembolsos'] = '250,00';
  delete r2.abas[0].rows[0]['Observações da Devolução'];
  imp(eng, r2);
  const ev = eng.snapshots.find(s => s.metric_type === 'devolucoes' && s.return_id === 'RET-260701-001');
  assert.equal(ev.raw['Quantia Total de Reembolsos'], '250,00', 'campo novo atualizado');
  assert.equal(ev.raw['Observações da Devolução'], 'Moldura trincada', 'campo antigo NÃO apagado');
});

/* 40 — consulta temporal traz valor + período + cobertura + confiança */
test('40 · queryTemporal traz valor, período, cobertura e confiança', () => {
  const eng = V8IMP.createEngine();
  imp(eng, V8IMP.FIXTURES.metricasPrincipais({ ini: '2026-06-04', fim: '2026-07-03' }));
  const diarios = eng.snapshots.filter(s => s.metric_type === 'metricas' && s.granularidadeTemporal === 'DAILY');
  const q = V8TIME.queryTemporal(diarios, V8TIME.resolvePeriodo('7d', { hoje: '2026-07-03' }), { contar: true });
  assert.ok(q.valor != null && q.periodo && q.timezone && q.cobertura && q.confianca, 'metadados completos');
});

/* 10/11/19 — persistência (protótipo) declarada via IndexedDB + hook automático */
test('10·11 · persistência de estado importado (IndexedDB) presente no protótipo', () => {
  const imj = src('importar.js');
  assert.match(imj, /indexedDB/);
  assert.match(imj, /IM\.persistir/);
  assert.match(imj, /IM\.restaurar/);
  assert.match(src('app.js'), /IMPORTAR\.restaurar\(\)/, 'restaura no boot');
});

/* 5/7 — RAW preservado; DERIVED não sobrescreve RAW (merge mantém original + versões) */
test('05·07 · RAW preservado; atualização versiona sem apagar o original', () => {
  const eng = V8IMP.createEngine();
  imp(eng, V8IMP.FIXTURES.returnsReal(PER));
  const r2 = V8IMP.FIXTURES.returnsReal(PER); r2.abas[0].rows[0]['Status da Devolução / Reembolso'] = 'Em análise';
  imp(eng, r2);
  const ev = eng.snapshots.find(s => s.metric_type === 'devolucoes' && s.return_id === 'RET-260701-001');
  assert.ok(ev.versoes.length >= 1 && ev.versoes[0].raw['Status da Devolução / Reembolso'] === 'Reembolso Concluído', 'RAW original na versão');
});

/* 43 — nenhuma escrita externa no motor temporal */
test('43 · motor temporal não faz escrita externa', () => {
  assert.ok(!/fetch\(|XMLHttpRequest|api\.shopee|publicar/i.test(src('tempo-engine.js')));
});
