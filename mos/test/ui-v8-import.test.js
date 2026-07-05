/* =============================================================
   SPRINT 10.I — Import & Sync Engine (protótipo v8)
   39 itens obrigatórios: detecção por assinatura, vínculo por SKU,
   Anúncio Master, deduplicação, sobreposição de período, atribuição
   que explica (não soma), rollback por lote, permissões e escopo.
   V8IMP é o MESMO arquivo que o navegador executa.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8DIR = path.join(__dirname, '../../design/prototipo-v8');
const V8IMP = require(path.join(V8DIR, 'import-engine.js'));
const { V8DATA } = require(path.join(V8DIR, 'data.js'));
const read = f => fs.readFileSync(path.join(V8DIR, f), 'utf8');

const ESCOPO = { groupId: 'g1', companyId: 'e1', cnpjId: 'c1', lojaId: 's1', contaId: 'acc-shp-1', marketplace: 'shopee' };
const PER_JUN = { ini: '2026-06-04', fim: '2026-07-03' };
const DIAS = ['2026-06-10', '2026-06-15', '2026-06-20'];
const eng = () => V8IMP.createEngine();
const prods = () => JSON.parse(JSON.stringify(V8DATA.products));
const stageTraffic = (e, opts) => V8IMP.stage(e, V8IMP.FIXTURES.productTraffic(PER_JUN), ESCOPO, { products: prods(), ...opts });

/* ---------- 1-8 · detecção ---------- */

test('01-06 · detecta os relatórios Shopee por assinatura de cabeçalho', () => {
  const F = V8IMP.FIXTURES;
  assert.equal(V8IMP.detect(F.productTraffic(PER_JUN)).perfil, 'SHOPEE_PRODUCT_TRAFFIC');
  assert.equal(V8IMP.detect(F.salesOverview(PER_JUN, DIAS)).perfil, 'SHOPEE_SALES_OVERVIEW');
  assert.equal(V8IMP.detect(F.promotion(PER_JUN)).perfil, 'SHOPEE_PROMOTION_SUMMARY');
  assert.equal(V8IMP.detect(F.voucher(PER_JUN)).perfil, 'SHOPEE_VOUCHER');
  assert.equal(V8IMP.detect(F.parentSku()).perfil, 'SHOPEE_PARENT_SKU');
  assert.equal(V8IMP.detect(F.channelContribution(PER_JUN)).perfil, 'SHOPEE_CHANNEL_CONTRIBUTION');
  assert.equal(V8IMP.detect(F.productTraffic(PER_JUN)).granularidade, 'LISTING_METRIC');
  assert.equal(V8IMP.detect(F.salesOverview(PER_JUN, DIAS)).granularidade, 'DAILY_METRIC');
});

test('07-08 · relatório desconhecido vira UNKNOWN e NÃO é aplicado sem mapeamento', () => {
  const d = V8IMP.detect(V8IMP.FIXTURES.desconhecido());
  assert.equal(d.perfil, 'UNKNOWN');
  assert.equal(d.status, 'UNSUPPORTED');
  const e = eng();
  const b = V8IMP.stage(e, V8IMP.FIXTURES.desconhecido(), ESCOPO, {});
  assert.equal(b.estado, 'AGUARDANDO_MAPEAMENTO');
  assert.equal(b.preview.aplicavel, false);
  const r = V8IMP.apply(e, b.id, { papel: 'OWNER' });
  assert.equal(r.blocked, true, 'aplicar sem mapeamento é recusado');
  /* perfis honestos: REFERENCE_ONLY também não finge importar */
  const b2 = V8IMP.stage(e, { nome: 'fin.xlsx', sourceType: 'PLANILHA_SHOPEE', abas: [{ nome: 'x', headers: ['Comissão', 'Repasse'], rows: [{}] }] }, ESCOPO, {});
  assert.equal(b2.estado, 'BLOQUEADO');
  assert.match(b2.preview.motivo, /não finge importar/);
});

/* ---------- 9-13 · vínculo por SKU ---------- */

test('09-11 · staging vincula por SKU (pai/variação) e cria observações de listing', () => {
  const e = eng();
  const b = stageTraffic(e);
  assert.equal(b.preview.registros, 5);
  assert.equal(b.preview.vinculosPorSku, 3, '9001/9003 (QP-6090) e 9002 (KIT3-SALA) confirmados por SKU pai');
  V8IMP.apply(e, b.id, { papel: 'OWNER' });
  const obs9001 = e.observations.find(o => o.item_id === '9001');
  assert.equal(obs9001.produtoId, 'p1', 'listing observado vinculado ao Product Master existente');
  assert.equal(obs9001.vinculo, 'VÍNCULO CONFIRMADO POR SKU');
  /* ID externo tem prioridade quando o listing já é observado */
  const b2 = V8IMP.stage(e, V8IMP.FIXTURES.parentSku(), ESCOPO, { products: prods() });
  const linha = e.staging.find(s => s.batchId === b2.id && s.raw['ID do Item'] === '9002');
  assert.equal(linha.vinculo.estado, 'VÍNCULO CONFIRMADO POR ID', 'ordem obrigatória: ID vem antes de SKU');
  assert.equal(linha.vinculo.produtoId, 'p2');
  /* em engine novo (sem observação), o mesmo item vincula por SKU de variação */
  const eNovo = V8IMP.createEngine();
  const b3 = V8IMP.stage(eNovo, V8IMP.FIXTURES.parentSku(), ESCOPO, { products: prods() });
  const l3 = eNovo.staging.find(s => s.batchId === b3.id && s.raw['ID do Item'] === '9002');
  assert.equal(l3.vinculo.estado, 'VÍNCULO CONFIRMADO POR SKU');
  assert.equal(l3.vinculo.via, 'variação');
  /* nunca cria Product Master duplicado: item sem match vira observação candidata, não produto */
  const semMatch = e.observations.filter(o => !o.produtoId);
  assert.ok(semMatch.length >= 1, 'candidato aguarda revisão humana em vez de virar master duplicado');
});

test('12 · nome similar é apenas sugestão de baixa confiança', () => {
  const e = eng();
  const b = stageTraffic(e);
  const linha = e.staging.find(s => s.batchId === b.id && s.raw['ID do Item'] === '9004');
  assert.equal(linha.vinculo.estado, 'VÍNCULO SUGERIDO POR NOME');
  assert.equal(linha.vinculo.confianca, 'baixa');
  assert.match(linha.vinculo.motivo, /nunca vincula automaticamente/);
  V8IMP.apply(e, b.id, { papel: 'OWNER' });
  const obs = e.observations.find(o => o.item_id === '9004');
  assert.equal(obs.produtoId, 'p6', 'sugestão registrada');
  assert.equal(obs.vinculo, 'VÍNCULO SUGERIDO POR NOME', 'mas nunca promovida a confirmada sem humano');
});

test('13 · conflito de SKU bloqueia vínculo automático', () => {
  const e = eng();
  const conflitantes = prods();
  conflitantes.push({ ...conflitantes[0], id: 'p99', nome: 'Outro Produto', sku: 'DUP-1' });
  conflitantes.push({ ...conflitantes[1], id: 'p98', nome: 'Mais Outro', sku: 'DUP-1' });
  const b = V8IMP.stage(e, V8IMP.FIXTURES.productTraffic(PER_JUN), ESCOPO, { products: conflitantes });
  assert.equal(b.estado, 'CONFLITO_ENCONTRADO');
  assert.equal(b.preview.conflitos, 1, 'item 9005 (SKU DUP-1) em conflito');
  const r = V8IMP.apply(e, b.id, { papel: 'OWNER' });
  assert.equal(r.job.estado, 'APLICADO_PARCIALMENTE');
  assert.equal(r.job.aplicado.conflitos, 1, 'linha conflitante NUNCA aplicada automaticamente');
  assert.ok(e.conflicts.some(c => c.item_id === '9005' && c.estado === 'REVISÃO HUMANA NECESSÁRIA'));
});

/* ---------- 14-18 · Anúncio Master ---------- */

test('14-15 · Anúncio Master: sugestão por vendas pagas + aprovação manual', () => {
  const e = eng();
  V8IMP.apply(e, stageTraffic(e).id, { papel: 'OWNER' });
  const sug = V8IMP.suggestMaster(e, 'p1');
  assert.equal(sug.estado, 'MASTER SUGERIDO');
  assert.equal(sug.itemId, '9001', 'maior venda paga validada (4210 > 1890)');
  assert.equal(sug.ranking.length, 2);
  /* aprovação manual exige MASTER_LISTING_APPROVE (OWNER) */
  assert.equal(V8IMP.approveMaster(e, 'p1', '9003', { papel: 'ADMIN' }).blocked, true, 'ADMIN não aprova master');
  const ok = V8IMP.approveMaster(e, 'p1', '9003', { papel: 'OWNER', usuario: 'Marcos' });
  assert.equal(ok.link.estado, 'MASTER CONFIRMADO MANUALMENTE');
  assert.equal(ok.link.itemId, '9003', 'humano pode escolher diferente da sugestão');
  assert.match(ok.nota, /não sobrescreve preço, estoque nem conteúdo/);
});

test('16-18 · Anúncio Master não sobrescreve preço, estoque nem conteúdo de loja', () => {
  const e = eng();
  V8IMP.apply(e, stageTraffic(e).id, { papel: 'OWNER' });
  const antes = JSON.stringify(V8DATA.products.find(p => p.id === 'p1').lojas);
  V8IMP.suggestMaster(e, 'p1');
  V8IMP.approveMaster(e, 'p1', '9001', { papel: 'OWNER' });
  assert.equal(JSON.stringify(V8DATA.products.find(p => p.id === 'p1').lojas), antes, 'dados por loja intactos byte a byte');
  const src = read('import-engine.js');
  assert.ok(!/lojas\[[^\]]*\]\.(preco|estoque)\s*=/.test(src), 'não existe código que escreva preço/estoque de loja');
  assert.match(src, /referência estratégica/, 'papel do master declarado no código');
  /* master bloqueado quando há conflito aberto */
  const e2 = eng();
  const conflitantes = prods();
  conflitantes.push({ ...conflitantes[0], id: 'p99', sku: 'DUP-1' }, { ...conflitantes[1], id: 'p98', sku: 'DUP-1' });
  const b2 = V8IMP.stage(e2, V8IMP.FIXTURES.productTraffic(PER_JUN), ESCOPO, { products: conflitantes });
  V8IMP.apply(e2, b2.id, { papel: 'OWNER' });
  /* se um humano vincular o item conflitante, o master segue bloqueado até resolver */
  e2.observations.push({ id: 'lo-t', item_id: '9005', produtoId: 'p99', vinculo: 'VÍNCULO CONFIRMADO POR SKU', vendasPagas: 1, status: 'Normal', marketplace: 'shopee', contaId: 'acc-shp-1' });
  assert.equal(V8IMP.suggestMaster(e2, 'p99').estado, 'MASTER BLOQUEADO POR CONFLITO');
});

/* ---------- 19-23 · deduplicação e sobreposição ---------- */

test('19 · reimportar o MESMO arquivo não duplica nada', () => {
  const e = eng();
  const b1 = stageTraffic(e);
  V8IMP.apply(e, b1.id, { papel: 'OWNER' });
  const snapsAntes = e.snapshots.length;
  const b2 = stageTraffic(e);
  assert.equal(b2.duplicado, true);
  assert.match(b2.motivo, /ARQUIVO JÁ IMPORTADO/);
  assert.equal(e.snapshots.length, snapsAntes, 'zero registros novos');
  assert.ok(e.audit.some(a => a.acao === 'arquivo_duplicado_recusado'));
});

test('20 · mesmo período em arquivo novo ATUALIZA sem somar (versionando)', () => {
  const e = eng();
  const per = { ini: '2026-06-01', fim: '2026-06-30' };
  const f1 = V8IMP.FIXTURES.salesOverview(per, DIAS);
  V8IMP.apply(e, V8IMP.stage(e, f1, ESCOPO, {}).id, { papel: 'OWNER' });
  const receitaAntes = V8IMP.receitaConsolidada(e).receita;
  assert.equal(receitaAntes, 7500, '3 dias × 2500');
  /* arquivo corrigido: mesmo período, um dia alterado */
  const f2 = V8IMP.FIXTURES.salesOverview(per, DIAS);
  f2.nome = 'salesoverview_corrigido.xlsx';
  f2.abas[0].rows[1]['Vendas de Pedidos Pagos'] = 2600;
  const b2 = V8IMP.stage(e, f2, ESCOPO, {});
  assert.ok(b2.preview.jaExistem >= 3, 'conciliação enxerga as linhas existentes');
  const r = V8IMP.apply(e, b2.id, { papel: 'OWNER' });
  assert.equal(r.job.aplicado.atualizados, 1, 'só o dia alterado atualiza');
  assert.equal(r.job.aplicado.duplicadosEvitados, 2, 'idênticos são evitados');
  assert.equal(r.job.aplicado.criados, 0);
  assert.equal(V8IMP.receitaConsolidada(e).receita, 7600, 'atualizou (7500−2500+2600) — NUNCA somou de novo');
  const dia15 = e.snapshots.find(s => s.data === '2026-06-15');
  assert.equal(dia15.versoes.length, 1, 'versão anterior preservada');
});

test('21-22 · sobreposição de período identificada; métrica diária não duplica', () => {
  const e = eng();
  V8IMP.apply(e, V8IMP.stage(e, V8IMP.FIXTURES.salesOverview({ ini: '2026-06-01', fim: '2026-06-30' }, DIAS), ESCOPO, {}).id, { papel: 'OWNER' });
  /* nova janela 15/06→15/07 cobre 15 dias já importados */
  const f2 = V8IMP.FIXTURES.salesOverview({ ini: '2026-06-15', fim: '2026-07-15' }, ['2026-06-15', '2026-06-20', '2026-07-10']);
  f2.nome = 'salesoverview_julho.xlsx';
  const b2 = V8IMP.stage(e, f2, ESCOPO, {});
  assert.ok(b2.preview.sobreposicao, 'sobreposição detectada na prévia');
  assert.match(b2.preview.sobreposicao.aviso, /nunca somadas/);
  assert.equal(b2.preview.sobreposicao.intervaloSobreposto.ini, '2026-06-15');
  assert.equal(b2.preview.sobreposicao.intervaloSobreposto.fim, '2026-06-30');
  const r = V8IMP.apply(e, b2.id, { papel: 'OWNER' });
  assert.equal(r.job.aplicado.duplicadosEvitados, 2, 'dias 15 e 20 já existiam — não duplicam');
  assert.equal(r.job.aplicado.criados, 1, 'só 10/07 é novo');
  assert.equal(V8IMP.receitaConsolidada(e).receita, 10000, '4 dias distintos × 2500');
});

test('23 · métrica por período não soma com métrica diária sobreposta', () => {
  const e = eng();
  V8IMP.apply(e, V8IMP.stage(e, V8IMP.FIXTURES.salesOverview(PER_JUN, DIAS), ESCOPO, {}).id, { papel: 'OWNER' });
  const receita = V8IMP.receitaConsolidada(e).receita;
  /* traffic (LISTING_METRIC do mesmo período, com coluna Vendas) entra como métrica de anúncio */
  const b = stageTraffic(e);
  assert.ok(b.preview.sobreposicao, 'granularidade diferente no mesmo intervalo é avisada');
  V8IMP.apply(e, b.id, { papel: 'OWNER' });
  assert.equal(V8IMP.receitaConsolidada(e).receita, receita, 'receita consolidada NÃO muda com métrica de outra granularidade');
});

/* ---------- 24-26 · fontes complementares explicam, não duplicam ---------- */

test('24-26 · atribuição, promoção e financeiro explicam a receita — nunca somam', () => {
  const e = eng();
  V8IMP.apply(e, V8IMP.stage(e, V8IMP.FIXTURES.salesOverview(PER_JUN, DIAS), ESCOPO, {}).id, { papel: 'OWNER' });
  const receitaBase = V8IMP.receitaConsolidada(e).receita;
  V8IMP.apply(e, V8IMP.stage(e, V8IMP.FIXTURES.channelContribution(PER_JUN), ESCOPO, {}).id, { papel: 'OWNER' });
  V8IMP.apply(e, V8IMP.stage(e, V8IMP.FIXTURES.promotion(PER_JUN), ESCOPO, {}).id, { papel: 'OWNER' });
  V8IMP.apply(e, V8IMP.stage(e, V8IMP.FIXTURES.voucher(PER_JUN), ESCOPO, {}).id, { papel: 'OWNER' });
  const r = V8IMP.receitaConsolidada(e);
  assert.equal(r.receita, receitaBase, 'canal/promoção/cupom NÃO aumentam a receita total');
  assert.ok(r.explicacoes.length >= 3, 'mas aparecem como explicação');
  assert.match(r.nota, /nunca somam de novo/);
  for (const s of e.snapshots.filter(x => ['CHANNEL_ATTRIBUTION', 'PROMOTION_METRIC'].includes(x.granularidade)))
    assert.equal(s.explicativa, true, s.reportType + ' marcado como explicativo');
  /* financeiro é REFERENCE_ONLY nesta fase — nem entra */
  assert.equal(V8IMP.PROFILES.SHOPEE_FINANCIAL_REFERENCE.status, 'REFERENCE_ONLY');
});

/* ---------- 27-30 · escopo, isolamento e permissões ---------- */

test('27 · demo não se mistura com importado real (nas duas direções)', () => {
  assert.throws(() => V8IMP.assertNoDemoMix({ tipoDado: 'DADOS REAIS' }, 'DEMO_FIXTURE'), /separação demo × real/);
  assert.throws(() => V8IMP.assertNoDemoMix({ tipoDado: 'DEMO' }, 'PLANILHA_SHOPEE'), /árvore de demonstração/);
  assert.ok(V8IMP.assertNoDemoMix({ tipoDado: 'DADOS REAIS' }, 'PLANILHA_SHOPEE'));
  const e = eng();
  assert.throws(() => V8IMP.stage(e, { ...V8IMP.FIXTURES.productTraffic(PER_JUN), sourceType: 'DEMO_FIXTURE' }, { ...ESCOPO, tipoDado: 'DADOS REAIS' }, {}), /separação/);
});

test('28-29 · importação exige escopo completo e não vaza entre empresas', () => {
  const e = eng();
  assert.throws(() => V8IMP.stage(e, V8IMP.FIXTURES.productTraffic(PER_JUN), { companyId: 'e1' }, {}), /escopo incompleto/);
  V8IMP.apply(e, stageTraffic(e).id, { papel: 'OWNER' });
  for (const s of e.snapshots) {
    assert.equal(s.escopo.companyId, 'e1'); assert.equal(s.escopo.lojaId, 's1'); assert.equal(s.escopo.contaId, 'acc-shp-1');
  }
  assert.equal(V8IMP.receitaConsolidada(e, { contaId: 'acc-shp-3' }).receita, 0, 'outra conta não vê nada');
  const cov = V8IMP.coverage(e);
  assert.equal(cov.length, 1);
  assert.equal(cov[0].lojaId, 's1');
});

test('30 · usuário sem IMPORT_APPLY não aplica lote', () => {
  const e = eng();
  const b = stageTraffic(e);
  for (const papel of ['LEITURA', 'CATALOGO', 'GESTOR_OPERACIONAL', 'GESTOR_COMERCIAL', 'FINANCEIRO'])
    assert.equal(V8IMP.apply(e, b.id, { papel }).blocked, true, papel + ' não aplica');
  assert.ok(V8IMP.canImp('CATALOGO', 'IMPORT_CREATE'), 'catálogo importa (staging)');
  assert.ok(!V8IMP.canImp('LEITURA', 'IMPORT_CREATE'), 'leitura só vê');
  assert.ok(V8IMP.canImp('OWNER', 'IMPORT_ROLLBACK') && !V8IMP.canImp('ADMIN', 'IMPORT_ROLLBACK'), 'rollback é do OWNER');
  assert.ok(V8IMP.apply(e, b.id, { papel: 'HEAD_MARKETPLACE' }).job, 'head aplica');
});

/* ---------- 31-33 · jobs, auditoria e rollback ---------- */

test('31 · job registra origem, escopo, perfil, contagens e mapper', () => {
  const e = eng();
  const b = stageTraffic(e);
  V8IMP.apply(e, b.id, { papel: 'OWNER', usuario: 'Marcos' });
  assert.equal(b.escopo.lojaId, 's1'); assert.equal(b.escopo.contaId, 'acc-shp-1');
  assert.equal(b.det.perfil, 'SHOPEE_PRODUCT_TRAFFIC');
  assert.equal(b.mappingVersion, 'v1');
  assert.ok(b.fp.file_hash && b.fp.sheet_signature);
  assert.equal(b.aplicado.aprovadoPor, 'Marcos');
  assert.ok(b.aplicado.criados > 0);
  const ev = e.audit.find(a => a.acao === 'lote_aplicado');
  assert.ok(ev.escopo && ev.perfil === 'SHOPEE_PRODUCT_TRAFFIC' && ev.mappingVersion === 'v1');
  for (const est of ['ARQUIVO_ENVIADO', 'AGUARDANDO_REVISÃO', 'APLICADO', 'REVERTIDO', 'BLOQUEADO'])
    assert.ok(V8IMP.JOB_ESTADOS.includes(est));
});

test('32-33 · rollback remove só o lote certo e preserva importação posterior', () => {
  const e = eng();
  const per = { ini: '2026-06-01', fim: '2026-06-30' };
  const bA = V8IMP.stage(e, V8IMP.FIXTURES.salesOverview(per, DIAS), ESCOPO, {});
  V8IMP.apply(e, bA.id, { papel: 'OWNER' });
  /* lote B corrige o dia 15 */
  const f2 = V8IMP.FIXTURES.salesOverview(per, ['2026-06-15']);
  f2.nome = 'correcao.xlsx';
  f2.abas[0].rows[0]['Vendas de Pedidos Pagos'] = 9999;
  const bB = V8IMP.stage(e, f2, ESCOPO, {});
  V8IMP.apply(e, bB.id, { papel: 'OWNER' });
  /* cenário 1: rollback do lote POSTERIOR restaura a versão anterior */
  const rB = V8IMP.rollback(e, bB.id, { papel: 'OWNER' });
  assert.equal(rB.restaurados, 1, 'dia 15 volta à versão do lote A');
  assert.equal(+e.snapshots.find(s => s.data === '2026-06-15').raw['Vendas de Pedidos Pagos'], 2500);
  const rA = V8IMP.rollback(e, bA.id, { papel: 'OWNER' });
  assert.equal(rA.removidos, 3, 'agora só restam efeitos do lote A — todos removidos');
  assert.equal(e.batches.find(x => x.id === bA.id).estado, 'REVERTIDO');
  /* cenário 2: rollback do lote ANTERIOR preserva a versão mais nova */
  const e2 = eng();
  const cA = V8IMP.stage(e2, V8IMP.FIXTURES.salesOverview(per, DIAS), ESCOPO, {});
  V8IMP.apply(e2, cA.id, { papel: 'OWNER' });
  const f3 = V8IMP.FIXTURES.salesOverview(per, ['2026-06-15']);
  f3.nome = 'correcao2.xlsx';
  f3.abas[0].rows[0]['Vendas de Pedidos Pagos'] = 9999;
  const cB = V8IMP.stage(e2, f3, ESCOPO, {});
  V8IMP.apply(e2, cB.id, { papel: 'OWNER' });
  const rA2 = V8IMP.rollback(e2, cA.id, { papel: 'OWNER' });
  assert.equal(rA2.removidos, 2, 'dias 10 e 20 (só do lote anterior) removidos');
  assert.equal(rA2.preservados, 1, 'dia 15 preservado — atualizado por lote posterior');
  const dia15 = e2.snapshots.find(s => s.data === '2026-06-15');
  assert.ok(dia15 && dia15.batchId === cB.id && +dia15.raw['Vendas de Pedidos Pagos'] === 9999, 'versão mais nova intacta');
  assert.equal(V8IMP.rollback(e2, cB.id, { papel: 'ADMIN' }).blocked, true, 'ADMIN sem IMPORT_ROLLBACK');
});

/* ---------- 34-39 · integração com as telas e segurança ---------- */

test('34-36 · Crescimento, Catálogo e Home mostram fonte, vínculo e última importação', () => {
  const imp = read('importar.js');
  assert.match(imp, /Vínculos SKU/); assert.match(imp, /Anúncio Master/);
  assert.match(imp, /Perfis de importação/);
  assert.match(read('home.js'), /última importação/i, 'Home mostra última importação');
  assert.match(read('crescimento.js'), /coverage|cobertura/i, 'Crescimento declara cobertura importada');
  assert.match(read('catalogo.js'), /Anúncios importados|vínculo/i, 'Catálogo mostra vínculo de SKU');
  assert.match(read('conexoes.js'), /Importaç|importaç/, 'Conexões lista origens de importação');
  assert.match(read('admin.js'), /Importar catálogo|importação/i, 'Ativação inclui passos de importação');
  assert.match(read('index.html'), /id="v-importar"/, 'view Fontes e Dados presente');
  assert.match(read('app.js'), /label: 'Fontes e Importações', view: 'importar'/, 'Fontes e Importações no menu (Sistema)');
});

test('37 · nenhuma importação executa escrita externa', () => {
  const src = read('import-engine.js') + read('importar.js');
  assert.ok(!/fetch\(|XMLHttpRequest|publicar|pausar anúncio externo/i.test(src.replace(/nunca publica[^.]*\./gi, '')), 'zero chamada externa');
  assert.ok(!/scraping|puppeteer|selenium/i.test(src), 'zero scraping');
  assert.match(read('import-engine.js'), /IMPORTAÇÃO NÃO SOMA DADOS/, 'princípio central declarado');
});

test('38 · nada volta a usar Leads ou CRM', () => {
  const all = ['import-engine.js', 'importar.js'].map(read).join('');
  assert.ok(!/\blead(s)?\b|pipeline|CRM/i.test(all), 'zero lead/pipeline/CRM na importação');
  assert.ok(!V8IMP.GRANULARIDADES.includes('LEAD'), 'granularidades limpas');
});

test('39 · contratos anteriores preservados (API e fixtures rotuladas)', () => {
  assert.equal(V8IMP.FONTES.includes('DEMO_FIXTURE'), true);
  for (const [nome, p] of Object.entries(V8IMP.PROFILES))
    assert.ok(['SUPPORTED', 'PARTIALLY_SUPPORTED', 'REFERENCE_ONLY', 'UNSUPPORTED'].includes(p.status), nome + ' com status honesto');
  assert.ok(Object.keys(V8IMP.PROFILES).length >= 16, '16+ perfis');
  /* fixtures são referência de schema, não dados padrão de uma empresa */
  const src = read('import-engine.js');
  assert.ok(!/Líder Molduras|lider-molduras-mg.*hardcode/i.test(src.split('FIXTURES')[0]), 'nenhum hardcode de empresa no motor');
  assert.match(src, /nunca hardcode|nunca dados padrão/i);
  for (const g of ['TRANSACTIONAL', 'STATE_SNAPSHOT', 'DAILY_METRIC', 'PERIOD_METRIC', 'PROMOTION_METRIC', 'CHANNEL_ATTRIBUTION', 'FINANCIAL_SUMMARY', 'SERVICE_METRIC'])
    assert.ok(V8IMP.GRANULARIDADES.includes(g), 'granularidade: ' + g);
});
