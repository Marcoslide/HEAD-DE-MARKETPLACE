/* =============================================================
   SPRINT 10.E.2 — Pedidos + Central de Inteligência + fontes reais
   40 testes obrigatórios + 15 da Mesa de Inteligência (agrupados).
   Upload local REAL (XLSX/CSV/ZIP parseados de verdade), pedido
   único por marketplace+conta+ID, histórico de status, devolução
   cruzada por ID, estoque snapshot, correção/exclusão auditadas,
   permissões de dados com enforcement no motor e Mesa honesta.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const V8IMP = require('../../design/prototipo-v8/import-engine.js');
const V8FILE = require('../../design/prototipo-v8/file-reader.js');
const { buildXlsx } = require('../src/production/storage.js');

const read = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const html = read('index.html');
const pedJs = read('pedidos.js');
const creJs = read('crescimento.js');
const impJs = read('importar.js');

const ESC = { groupId: 'g1', companyId: 'e1', cnpjId: 'c1', lojaId: 's1', contaId: 'acc-sh-1', marketplace: 'shopee' };
const PER = { ini: '2026-06-01', fim: '2026-06-30' };
const engCom = (...fixtures) => {
  const eng = V8IMP.createEngine();
  for (const f of fixtures) {
    const r = V8IMP.stage(eng, f, ESC, { usuario: 'Marcos' });
    (r.zip ? r.batches : [r]).forEach(bt => !bt.duplicado && bt.preview && bt.preview.aplicavel && V8IMP.apply(eng, bt.id, {}));
  }
  return eng;
};

/* ---------- 01-04 · upload local real: validações ---------- */
test('01-04 · upload valida extensão, MIME e tamanho; input real na tela', () => {
  assert.equal(V8FILE.validateMeta('a.exe', 10, '').ok, false, 'extensão recusada');
  assert.equal(V8FILE.validateMeta('a.xlsx', 30 * 1024 * 1024, '').ok, false, '25MB é o teto');
  assert.equal(V8FILE.validateMeta('a.csv', 10, 'text/html').ok, false, 'MIME estranho recusado');
  assert.equal(V8FILE.validateMeta('Order.toship.xlsx', 1000, '').ok, true);
  assert.match(impJs, /type="file"/, 'input de arquivo REAL');
  assert.match(impJs, /accept="\.xlsx,\.xls,\.csv,\.zip"/, 'formatos aceitos declarados');
  assert.match(impJs, /Selecionar planilha do computador/, 'botão do contrato');
  assert.match(impJs, /ondrop/, 'drag-and-drop real');
});

/* ---------- 05-06 · XLSX e CSV parseados de verdade ---------- */
test('05 · XLSX real (OpenXML) é aberto e detectado — nada de botão decorativo', async () => {
  const headers = ['ID do pedido', 'Status do pedido', 'Data de criação do pedido', 'Valor Total', 'Cidade', 'UF'];
  const rows = [{ 'ID do pedido': 'X1', 'Status do pedido': 'Não pago', 'Data de criação do pedido': '2026-07-01', 'Valor Total': 100.5, 'Cidade': 'BH', 'UF': 'MG' }];
  const buf = buildXlsx(headers, rows);
  const f = await V8FILE.readLocalFile({ name: 'Order.x.xlsx', size: buf.length, type: '', arrayBuffer: async () => buf });
  assert.deepEqual(f.abas[0].headers, headers, 'todas as colunas lidas');
  assert.equal(f.abas[0].rows[0]['Valor Total'], 100.5, 'número tipado');
  assert.equal(V8IMP.detect(f).perfil, 'SHOPEE_ORDERS', 'assinatura detectada do arquivo real');
});

test('06 · CSV com ; aspas e vírgula é parseado', () => {
  const r = V8FILE.parseCsvText('Afiliado;Cliques;Comissão\n"a;b";10;5,5x\nc;20;3');
  assert.equal(r.headers.length, 3);
  assert.equal(r.rows[0]['Afiliado'], 'a;b', 'aspas respeitadas');
  assert.equal(r.rows[1]['Cliques'], 20, 'número tipado');
});

/* ---------- 07-08 · ZIP em staging e XLS honesto ---------- */
test('07 · ZIP é extraído NO STAGING; entrada não reconhecida é declarada, não fingida', async () => {
  const csv = 'Afiliado;Cliques;Vendas do Afiliado;Comissão\nana;10;100;5';
  const nameB = Buffer.from('rel/aff.csv'), dataB = Buffer.from(csv), crc = zlib.crc32(dataB);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(dataB.length, 18); lh.writeUInt32LE(dataB.length, 22); lh.writeUInt16LE(nameB.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(dataB.length, 20); cd.writeUInt32LE(dataB.length, 24); cd.writeUInt16LE(nameB.length, 28); cd.writeUInt32LE(0, 42);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(46 + nameB.length, 12); eocd.writeUInt32LE(30 + nameB.length + dataB.length, 16);
  const zip = Buffer.concat([lh, nameB, dataB, cd, nameB, eocd]);
  const f = await V8FILE.readLocalFile({ name: 'p.zip', size: zip.length, type: 'application/zip', arrayBuffer: async () => zip });
  assert.equal(f.zip, true);
  assert.equal(f.entries[0].abas[0].rows.length, 1, 'CSV interno aberto');
  /* engine: fixture de ZIP com entrada .txt */
  const eng = V8IMP.createEngine();
  const r = V8IMP.stage(eng, V8IMP.FIXTURES.returnZip(PER), ESC, {});
  assert.equal(r.zip, true);
  assert.equal(r.batches.length, 1, 'só planilha reconhecida vira lote');
  assert.equal(r.ignorados.length, 1, 'leiame.txt declarado como ignorado');
});

test('08 · XLS binário antigo: honestidade, nunca fingir importação', async () => {
  const f = await V8FILE.readLocalFile({ name: 'a.xls', size: 6, type: 'application/vnd.ms-excel', arrayBuffer: async () => Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0, 0]) });
  assert.equal(f.estado, 'AGUARDANDO_MAPEAMENTO');
  assert.match(f.erro, /exporte como XLSX ou CSV/);
});

/* ---------- 09-14 · pedido único, status e reimportação ---------- */
test('09-11 · perfil SHOPEE_ORDERS por assinatura; chave marketplace+conta+ID; escopo obrigatório', () => {
  const det = V8IMP.detect(V8IMP.FIXTURES.orders(PER));
  assert.equal(det.perfil, 'SHOPEE_ORDERS');
  assert.equal(det.granularidade, 'TRANSACTIONAL');
  assert.equal(V8IMP.naturalKey('TRANSACTIONAL', { metric_type: 'pedidos', marketplace: 'shopee', contaId: 'a1', external_order_id: '99' }), 'ord|shopee|a1|99');
  assert.throws(() => V8IMP.stage(V8IMP.createEngine(), V8IMP.FIXTURES.orders(PER), { companyId: 'e1' }, {}), /escopo incompleto/);
});

test('12-14 · reimportar atualiza status (pedido MUDA de aba), preserva histórico, nunca duplica nem soma', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER), V8IMP.FIXTURES.ordersV2({ ini: '2026-06-01', fim: '2026-07-05' }));
  const v = V8IMP.ordersView(eng, {});
  assert.equal(v.orders.length, 7, '6 + 1 novo — nenhum duplicado');
  const o3 = v.orders.find(o => o.id === '2606003');
  assert.deepEqual(o3.statusHistory.map(h => h.status), ['Em rota', 'Entregue'], 'histórico de status preservado');
  assert.equal(o3.tab, 'Concluídos', 'status novo move o pedido de aba');
  const b2 = eng.batches[1];
  assert.equal(b2.aplicado.duplicadosEvitados, 1, 'linha idêntica (2606004) evitada');
  assert.equal(b2.aplicado.criados, 1, 'só o pedido novo foi criado');
});

/* ---------- 15-17 · camada bruta e linhas com erro ---------- */
test('15-17 · linha sem chave vai para "linhas com erro"; camada bruta preserva TODAS as colunas', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER));
  assert.equal(eng.rawErrors.length, 1, 'linha sem ID não descartada em silêncio');
  assert.match(eng.rawErrors[0].motivo, /ID do pedido ausente/);
  const rf = eng.rawFiles[0];
  assert.equal(rf.abas[0].headers.length, V8IMP.FIXTURES.ordersHeaders.length, 'nenhuma coluna descartada');
  assert.equal(rf.abas[0].rows.length, 7, 'todas as linhas originais preservadas (incl. a com erro)');
  for (const acao of ['verbrutos', 'vermapa', 'vererros'])
    assert.ok(impJs.includes(`data-act="${acao}"`) || impJs.includes(acao), 'ação de camada bruta na UI: ' + acao);
  assert.match(impJs, /nenhuma coluna importada é descartada silenciosamente/i);
});

/* ---------- 18-20 · devoluções cruzadas por ID ---------- */
test('18-20 · evento cruza por ID (chave com tipo+evento); NUNCA cria pedido; órfão declarado', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER), V8IMP.FIXTURES.returnZip(PER));
  const v = V8IMP.ordersView(eng, {});
  assert.equal(v.orders.length, 6, 'devolução não criou pedido novo');
  const o4 = v.orders.find(o => o.id === '2606004');
  assert.equal(o4.eventos.length, 1);
  assert.equal(o4.eventos[0].tipo, 'Devolução');
  assert.equal(V8IMP.naturalKey('TRANSACTIONAL', { metric_type: 'devolucoes', marketplace: 'shopee', contaId: 'a', external_order_id: '1', tipo_evento: 'Devolução', event_id: 'RR-1' }), 'evt|shopee|a|1|Devolução|RR-1');
  assert.equal(v.eventosOrfaos.length, 1, 'evento do pedido 9999999 é órfão');
  assert.equal(v.eventosOrfaos[0].estado, 'SEM PEDIDO CORRESPONDENTE');
  assert.match(v.eventosOrfaos[0].nota, /nunca cria pedido/);
});

/* ---------- 21 · estoque snapshot ---------- */
test('21 · estoque: chave com armazém+SKU+momento; atual = leitura mais recente; histórico fica', () => {
  const eng = engCom(V8IMP.FIXTURES.inventory('2026-07-03 08:00'), V8IMP.FIXTURES.inventory('2026-07-04 08:00'));
  const sv = V8IMP.stockView(eng, {});
  assert.equal(sv.atual.length, 3, 'um registro atual por armazém+SKU');
  assert.equal(sv.historico.length, 6, 'duas leituras preservadas por SKU');
  assert.equal(sv.atual.find(s => s.sku === 'QP-6090').momento, '2026-07-04 08:00', 'mais recente vence');
  assert.equal(sv.atual.find(s => s.sku === 'QP-6090').leituras, 2);
});

/* ---------- 22-25 · métricas diárias, tráfego, afiliados, chat ---------- */
test('22 · métrica diária ATUALIZA, nunca soma (R$10.000 + R$10.500 não existe aqui)', () => {
  const eng = V8IMP.createEngine();
  const f1 = V8IMP.FIXTURES.salesOverview(PER, ['2026-06-10']);
  const b1 = V8IMP.stage(eng, f1, ESC, {}); V8IMP.apply(eng, b1.id, {});
  const f2 = V8IMP.FIXTURES.salesOverview({ ini: '2026-06-05', fim: '2026-06-15' }, ['2026-06-10']);
  f2.abas[0].rows[0]['Vendas de Pedidos Pagos'] = 10500; f2.nome = 'salesoverview_v2.xlsx';
  const b2 = V8IMP.stage(eng, f2, ESC, {}); V8IMP.apply(eng, b2.id, {});
  const dia = eng.snapshots.filter(s => s.data === '2026-06-10' && s.metric_type === 'funil');
  assert.equal(dia.length, 1, 'um registro por marketplace+conta+data+tipo');
  assert.equal(+dia[0].raw['Vendas de Pedidos Pagos'], 10500, 'atualizado, não somado');
  assert.equal(dia[0].versoes.length, 1, 'valor anterior versionado');
});

test('23-25 · tráfego é agregado por período; afiliados explicam sem duplicar; chat SUPPORTED só métricas', () => {
  assert.equal(V8IMP.PROFILES.SHOPEE_TRAFFIC_OVERVIEW.gran, 'PERIOD_METRIC');
  const eng = engCom(V8IMP.FIXTURES.salesOverview(PER, ['2026-06-10']), V8IMP.FIXTURES.affiliatesCsv(PER), V8IMP.FIXTURES.trafficOverview(PER), V8IMP.FIXTURES.chat());
  const rc = V8IMP.receitaConsolidada(eng, {});
  assert.equal(rc.receita, 2500, 'afiliado/atribuição não soma na receita');
  assert.ok(eng.snapshots.filter(s => s.metric_type === 'afiliados').every(s => s.explicativa), 'camada explicativa');
  assert.equal(V8IMP.PROFILES.SHOPEE_CHAT_FAQ.status, 'SUPPORTED', 'chat virou fonte real (só métricas)');
  assert.match(creJs, /não existe abertura diária|sem abertura diária/i, 'tráfego não inventa dado diário');
  assert.match(creJs, /nenhuma conversa privada|conversas privadas não aparecem/i, 'chat sem conversa privada');
});

/* ---------- 26 · conversão explícita ---------- */
test('26 · conversão NUNCA aparece sem fórmula e denominador', () => {
  const c = V8IMP.conversaoExplicita(4, 320, 'pedidos ÷ cliques');
  assert.equal(c.taxa, 1.25); assert.equal(c.denominador, 320); assert.match(c.formula, /÷/);
  const s = V8IMP.conversaoExplicita(4, null, 'pedidos ÷ cliques');
  assert.equal(s.taxa, null); assert.match(s.motivo, /denominador ausente/);
  assert.match(creJs, /conversaoExplicita/, 'UI usa o helper');
});

/* ---------- 27-28 · KPIs com fonte e análise geográfica protegida ---------- */
test('27 · dashboard de Pedidos: 15 KPIs com fonte, período, cobertura e qualidade', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER), V8IMP.FIXTURES.returnZip(PER));
  const st = V8IMP.orderStats(eng, {});
  for (const k of ['pedidos', 'naoPagos', 'aEnviar', 'enviados', 'concluidos', 'cancelados', 'devolucoes', 'falhasEntrega',
    'faturamentoAprovado', 'valorNaoPago', 'ticketMedio', 'unidades', 'cidades', 'estados', 'taxaCancelamento'])
    assert.ok(k in st.kpis, 'KPI ' + k);
  assert.equal(st.fontes.length, 1);
  assert.ok(st.fontes[0].arquivo && st.fontes[0].periodo && st.fontes[0].qualidade, 'fonte com arquivo, período e qualidade');
  assert.ok(st.cobertura.contas.includes('acc-sh-1'), 'cobertura declarada');
  const vazio = V8IMP.orderStats(V8IMP.createEngine(), {});
  assert.equal(vazio.semDados, true, 'sem fonte → SEM DADOS, nada inventado');
});

test('28 · cidades/estados: faturamento, ticket, produto top, prazo honesto; CEP protegido; comprador com permissão', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER), V8IMP.FIXTURES.returnZip(PER));
  const uf = V8IMP.geoStats(eng, {}, 'estado');
  const mg = uf.find(g => g.chave === 'MG');
  assert.ok(mg.pedidos >= 2 && mg.produtoTop, 'agregação por UF');
  const semPrazo = uf.find(g => g.prazoMedioDias == null);
  assert.match(semPrazo.prazoNota, /SEM DADOS/, 'prazo sem datas não é inventado');
  assert.equal(V8IMP.cepProtegido('31270901'), '31270-***', 'CEP nunca completo');
  const o = V8IMP.ordersView(eng, {}).orders[0];
  assert.match(o.cepParcial, /\*\*\*$/);
  assert.match(pedJs, /RAW_DATA_VIEW/, 'comprador atrás de permissão');
  assert.match(pedJs, /podeVerComprador/, 'gate aplicado na tela');
});

/* ---------- 29-31 · correção, exclusão, restauração ---------- */
test('29-30 · correção manual: motivo obrigatório, original preservado, MANUAL_CORRECTION, permissão no motor', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER));
  const key = V8IMP.ordersView(eng, {}).orders[0].key;
  assert.equal(V8IMP.correct(eng, key, 'Cidade', 'X', {}).blocked, true, 'sem motivo → recusada');
  assert.equal(V8IMP.correct(eng, key, 'Cidade', 'X', { motivo: 'm', papel: 'LEITURA' }).blocked, true, 'papel sem ORDER_EDIT_CORRECTION');
  const r = V8IMP.correct(eng, key, 'Cidade', 'Osasco', { motivo: 'CEP indica Osasco', usuario: 'Ana' });
  assert.equal(r.correcao.origem, 'MANUAL_CORRECTION');
  assert.ok(r.correcao.antes && r.correcao.depois && r.correcao.autor && r.correcao.em, 'antes/depois/autor/data');
  const rec = eng.snapshots.find(s => s.key === key);
  assert.notEqual(rec.raw['Cidade'], 'Osasco', 'original intocado');
  assert.equal(V8IMP.valorEfetivo(rec, 'Cidade'), 'Osasco', 'valor efetivo é a correção');
});

test('31 · excluir da análise mantém o bruto e é restaurável; KPIs respeitam a exclusão', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER));
  const key = V8IMP.ordersView(eng, {}).orders.find(o => o.id === '2606004').key;
  assert.equal(V8IMP.excludeFromAnalysis(eng, key, {}).blocked, true, 'motivo obrigatório');
  V8IMP.excludeFromAnalysis(eng, key, { motivo: 'pedido de teste' });
  assert.equal(V8IMP.ordersView(eng, {}).orders.length, 5, 'sai da análise');
  assert.ok(eng.snapshots.find(s => s.key === key), 'permanece na camada bruta');
  V8IMP.restaurar(eng, key, {});
  assert.equal(V8IMP.ordersView(eng, {}).orders.length, 6, 'restaurado');
  assert.ok(eng.audit.some(a => a.acao === 'excluido_da_analise') && eng.audit.some(a => a.acao === 'restaurado_na_analise'), 'trilha completa');
});

/* ---------- 32-34 · arquivar, vínculo, master ---------- */
test('32-34 · arquivar fonte não apaga; desativar vínculo e remover master preservam o anúncio', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER), V8IMP.FIXTURES.productTraffic(PER));
  const bid = eng.batches[0].id;
  assert.equal(V8IMP.archiveFile(eng, bid, {}).blocked, true, 'arquivar exige motivo');
  V8IMP.archiveFile(eng, bid, { motivo: 'substituído' });
  assert.ok(eng.batches[0].arquivado && eng.rawFiles.length === 2, 'arquivado sem apagar nada');
  assert.ok(!V8IMP.areaSources(eng, ['pedidos']).length, 'fonte arquivada sai das listas ativas');
  const obs = eng.observations[0];
  V8IMP.desativarVinculo(eng, obs.id, { motivo: 'vínculo errado' });
  assert.equal(obs.vinculo, 'VÍNCULO DESATIVADO');
  assert.ok(eng.observations.includes(obs), 'anúncio continua existindo');
  eng.masterLinks.push({ id: 'ml1', produtoId: 'p1', itemId: '9001', estado: 'MASTER CONFIRMADO MANUALMENTE' });
  V8IMP.removerMaster(eng, 'p1', { motivo: 'revisão' });
  const link = eng.masterLinks.find(l => l.produtoId === 'p1');
  assert.equal(link.estado, 'SEM MASTER DEFINIDO');
  assert.equal(link.historico.length, 1, 'histórico do master preservado');
});

/* ---------- 35-37 · rollback, permissões, tabela transversal ---------- */
test('35 · rollback do lote de pedidos preserva a versão aplicada por lote posterior', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER), V8IMP.FIXTURES.ordersV2({ ini: '2026-06-01', fim: '2026-07-05' }));
  const r = V8IMP.rollback(eng, eng.batches[0].id, {});
  assert.ok(r.preservados >= 2, 'atualizações do lote 2 não são apagadas');
  const v = V8IMP.ordersView(eng, {});
  assert.ok(v.orders.find(o => o.id === '2606003'), 'pedido atualizado pelo lote posterior sobrevive');
});

test('36 · permissões novas com enforcement no motor (nunca só botão visual)', () => {
  for (const p of ['DATA_SOURCE_VIEW', 'DATA_SOURCE_UPLOAD', 'DATA_SOURCE_EDIT_SCOPE', 'DATA_SOURCE_ARCHIVE',
    'DATA_SOURCE_ROLLBACK', 'RAW_DATA_VIEW', 'RAW_DATA_EXPORT', 'ORDER_EDIT_CORRECTION', 'ORDER_ARCHIVE',
    'PRODUCT_EDIT', 'MASTER_LINK_EDIT', 'METRIC_CORRECTION', 'INTELLIGENCE_VIEW'])
    assert.ok(V8IMP.DATA_PERMS_ALL.includes(p), 'perm ' + p);
  assert.equal(V8IMP.canData('LEITURA', 'ORDER_EDIT_CORRECTION'), false);
  assert.equal(V8IMP.canData('OWNER', 'MASTER_LINK_EDIT'), true);
  assert.equal(V8IMP.canData('DESIGNER', 'DATA_SOURCE_VIEW'), false);
  const eng = engCom(V8IMP.FIXTURES.orders(PER));
  assert.equal(V8IMP.archiveFile(eng, eng.batches[0].id, { motivo: 'm', papel: 'LEITURA' }).blocked, true, 'motor barra, não o botão');
});

test('37 · Fontes e Histórico: tabela transversal com colunas e ações do contrato', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER), V8IMP.FIXTURES.inventory('2026-07-04 08:00'));
  const rows = V8IMP.sourcesTable(eng);
  assert.equal(rows.length, 2);
  for (const c of ['fonte', 'areaDestino', 'arquivo', 'marketplace', 'lojaId', 'contaId', 'periodo', 'granularidade',
    'status', 'linhas', 'duplicidadesEvitadas', 'conflitos', 'ultimaAtualizacao', 'usuario', 'acoes'])
    assert.ok(c in rows[0], 'coluna ' + c);
  assert.ok(rows[0].acoes.includes('Rollback') && rows[0].acoes.includes('Arquivar'), 'ações presentes');
  assert.match(impJs, /'Fontes e Histórico'/, 'primeira aba da área');
  assert.match(impJs, /Fontes e Histórico de Dados/, 'área renomeada');
});

/* ---------- 38-39 · área Pedidos (10.F.2: tela oficial via API/Postgres) ---------- */
test('38 · área Pedidos: 12 abas, consome API, detalhe com 8 abas, honestidade de IDs', () => {
  for (const t of ['Todos', 'Pagos', 'Em Produção', 'Em Embalagem', 'Prontos', 'Enviados',
    'Entregues', 'Atrasados', 'Cancelados', 'Devolvidos', 'Não Pagos', 'Em Revisão'])
    assert.ok(pedJs.includes(`'${t}'`), 'aba ' + t);
  for (const d of ['Resumo', 'Itens e SKUs', 'Operação e Logística', 'Identidade Financeira', 'Conciliação', 'Devoluções e Reembolsos', 'Histórico', 'Inteligência Relacionada'])
    assert.ok(pedJs.includes(`'${d}'`), 'aba de detalhe ' + d);
  assert.match(pedJs, /V8API\.ordersList/, 'consome a API oficial de pedidos');
  assert.match(pedJs, /Atualizar dados desta área/, 'upload nasce na área');
  assert.match(pedJs, /IMPORTAR\.uploadModal/, 'usa o fluxo real de upload');
  assert.match(pedJs, /SEM DADOS/, 'estado vazio honesto');
  assert.match(pedJs, /AUSENTE_NA_FONTE/, 'Item ID/Variation ID honestos quando ausentes na fonte');
  assert.match(pedJs, /SELLER_SKU/, 'SKU como identidade real disponível');
  assert.match(pedJs, /SEM_DADOS_SUFICIENTES/, 'lucro sem custo confiável não é declarado');
  assert.match(pedJs, /marketplace \+ conta \+ ID/, 'identidade única declarada');
  assert.match(pedJs, /RAW_DATA_VIEW|podeVerComprador/, 'gate de comprador preservado');
});

test('39 · navegação nova: Pedidos no menu, Central de Inteligência, botão global de Fontes', () => {
  /* 10.P.4 — Pedidos, Central de Inteligência e Fontes são itens de menu de 1 clique */
  assert.match(html, /id="v-pedidos"/);
  assert.match(read('app.js'), /label: 'Pedidos', view: 'pedidos'/);
  assert.match(read('app.js'), /label: 'Central de Inteligência', view: 'crescimento'/);
  assert.match(read('app.js'), /label: 'Fontes e Importações', view: 'importar'/);
  assert.match(html, /file-reader\.js/, 'leitor real carregado');
  assert.match(html, /pedidos\.js/, 'área carregada');
  assert.match(read('app.js'), /pedidos: 'Pedidos'/, 'renderer registrado no shell');
  assert.match(pedJs, /UI\.renderers\.pedidos = render/);
});

/* ---------- MESA DE INTELIGÊNCIA (15) ---------- */
test('M1-M3 · Central abre na Mesa; visão geral com 13 indicadores com fonte; sem fonte → SEM DADOS', () => {
  assert.match(creJs, /sub: 'Mesa de Inteligência'/, 'abre na Mesa, não numa planilha');
  assert.ok(creJs.indexOf("'Mesa de Inteligência'") < creJs.indexOf("'Métricas Principais'"), 'Mesa é a primeira subárea');
  const m = V8IMP.mesaInsights(V8IMP.createEngine(), {});
  assert.equal(m.visaoGeral.length, 13, '13 indicadores');
  const semFonte = m.visaoGeral.filter(k => k.valor == null);
  assert.ok(semFonte.length >= 10, 'sem importação, quase tudo é SEM DADOS');
  for (const k of m.visaoGeral) assert.ok(k.fonte || k.sem, 'todo indicador declara fonte ou o motivo da ausência');
});

test('M4-M6 · 9 agentes; sem dado → AGUARDANDO DADOS com pedido de fonte; com dado → ANALISADO com fontes', () => {
  const vazio = V8IMP.mesaInsights(V8IMP.createEngine(), {});
  assert.equal(vazio.agentes.length, 9, '9 agentes (módulos de análise, incl. Métricas Principais)');
  assert.ok(vazio.agentes.every(a => ['AGUARDANDO DADOS', 'DADO INSUFICIENTE'].includes(a.status)), 'nenhum agente finge trabalho');
  assert.ok(vazio.agentes[0].acao && vazio.agentes[0].dadosFaltantes, 'declara o que falta e a ação');
  assert.equal(vazio.insights.length, 0, 'nenhuma análise sem dado real');
  const eng = engCom(V8IMP.FIXTURES.orders(PER), V8IMP.FIXTURES.ordersV2({ ini: '2026-06-01', fim: '2026-07-05' }));
  const m = V8IMP.mesaInsights(eng, {});
  const ped = m.agentes.find(a => a.nome === 'Analista de Pedidos');
  assert.equal(ped.status, 'ANALISADO');
  assert.ok(ped.fontes.length && ped.ultimaAnalise, 'fontes e última análise declaradas');
});

test('M7-M8 · status honestos: DADO CONFLITANTE (evento órfão) e COBERTURA PARCIAL (tráfego agregado)', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER), V8IMP.FIXTURES.returnZip(PER), V8IMP.FIXTURES.trafficOverview(PER));
  const m = V8IMP.mesaInsights(eng, {});
  assert.equal(m.agentes.find(a => a.nome === 'Analista de Devoluções').status, 'DADO CONFLITANTE');
  assert.equal(m.agentes.find(a => a.nome === 'Analista de Tráfego').status, 'COBERTURA PARCIAL');
  for (const st of m.agentes.map(a => a.status))
    assert.ok(V8IMP.AGENT_STATUS.includes(st), 'status do contrato: ' + st);
});

test('M9-M11 · fila priorizada; insight com fato/fonte/período/cobertura/confiança; causa nunca afirmada', () => {
  const eng = engCom(V8IMP.FIXTURES.orders(PER), V8IMP.FIXTURES.ordersV2({ ini: '2026-06-01', fim: '2026-07-05' }),
    V8IMP.FIXTURES.returnZip(PER), V8IMP.FIXTURES.inventory('2026-07-04 08:00'), V8IMP.FIXTURES.affiliatesCsv(PER));
  const m = V8IMP.mesaInsights(eng, {});
  assert.ok(m.insights.length >= 4, 'fila com insights reais');
  const ordem = m.insights.map(i => V8IMP.NIVEIS.indexOf(i.nivel));
  assert.ok(ordem.every((v, i) => i === 0 || ordem[i - 1] <= v), 'crítico primeiro');
  assert.equal(m.insights[0].nivel, 'CRÍTICO');
  for (const i of m.insights) {
    assert.ok(i.fato && i.fonte && i.periodo && i.cobertura && i.confianca, 'proveniência completa: ' + i.titulo);
    assert.ok(i.acoes.length >= 4, 'ações de decisão');
  }
  const comHipotese = m.insights.find(i => i.hipotese);
  assert.match(comHipotese.hipotese, /hipótese|nunca/i, 'hipótese declarada como hipótese');
  assert.match(creJs, /nunca é afirmada como causa|nunca afirmada como causa/, 'regra na UI');
});

test('M12-M14 · ações do insight na UI; cruzamentos declaram o que falta; silenciar exige motivo', () => {
  for (const a of ['Abrir análise', 'Ver fontes', 'Criar missão', 'Silenciar com motivo'])
    assert.ok(creJs.includes(a), 'ação ' + a);
  assert.match(creJs, /Silenciar sem motivo é recusado/, 'silêncio auditado');
  assert.match(creJs, /in-missao/, 'insight vira missão');
  const eng = engCom(V8IMP.FIXTURES.orders(PER));
  const m = V8IMP.mesaInsights(eng, {});
  assert.equal(m.cruzamentos.length, 8, '8 cruzamentos principais');
  const aguardando = m.cruzamentos.find(c => c.estado === 'AGUARDANDO DADOS');
  assert.ok(aguardando.faltam.length && /falta:/.test(aguardando.nota), 'declara exatamente a fonte que falta');
  const ok = m.cruzamentos.find(c => c.key === 'cidade-volume-prazo');
  assert.equal(ok.estado, 'ANALISADO', 'cruzamento com fonte roda');
});

/* ---------- 10.E.3.1 · CORREÇÃO CRÍTICA DO CLASSIFICADOR ----------
   Regressão real: Order.all.order_creation_date.20260604_20260704.xlsx
   foi classificado como SHOPEE_HOT_LISTING (REFERENCE_ONLY) por causa da
   coluna auxiliar "Hot Listing". Nunca mais: classificação por CONJUNTO
   de colunas, identificadores com peso, evidência mínima, prioridade,
   pontuação explicável e correção manual auditada. */
test('C1 · planilha de pedidos com coluna "Hot Listing" é SHOPEE_ORDERS, nunca REFERENCE_ONLY', () => {
  const d = V8IMP.detect(V8IMP.FIXTURES.ordersReal(PER));
  assert.equal(d.perfil, 'SHOPEE_ORDERS', 'perfil sugerido: PEDIDOS SHOPEE');
  assert.equal(d.destino, 'pedidos');
  assert.notEqual(d.status, 'REFERENCE_ONLY', 'nunca marcar como REFERENCE_ONLY');
  assert.equal(d.confiancaLabel, 'alta');
  for (const c of ['ID do pedido', 'Status do pedido', 'Data de criação do pedido', 'Número de referência SKU', 'Valor Total'])
    assert.ok(d.evidencias.includes(c), 'evidência ✓ ' + c);
  assert.ok(Array.isArray(d.pontuacao) && d.pontuacao[0].perfil === 'SHOPEE_ORDERS', 'pontuação explicável');
  assert.ok(!d.pontuacao.some(p => p.perfil === 'SHOPEE_HOT_LISTING'), 'Hot Listing fora da disputa com assinatura forte');
  /* aplicação nunca é impedida pela coluna auxiliar */
  const eng = engCom(V8IMP.FIXTURES.ordersReal(PER));
  assert.equal(eng.batches[0].estado, 'APLICADO');
  assert.equal(eng.batches[0].preview.perfilNome, 'Pedidos Shopee');
});

test('C2 · "Hot Listing" é campo auxiliar do pedido; perfil auxiliar só vale sem assinatura forte', () => {
  const eng = engCom(V8IMP.FIXTURES.ordersReal(PER));
  const o = V8IMP.ordersView(eng, {}).orders.find(x => x.id === '260620ABC001');
  assert.equal(o.hotListing, 'Sim', 'Hot Listing mapeado como campo do pedido');
  assert.equal(o.sku, 'QP-6090', 'Número de referência SKU mapeado');
  assert.equal(o.datas.pagamento, '2026-06-20 10:15', 'Hora do pagamento do pedido mapeada');
  assert.equal(o.datas.entrega, '2026-06-27', 'Domestic Delivered Date mapeada');
  assert.equal(o.rastreamento, 'BR123456789SP');
  assert.equal(o.frete, 18.9, 'Taxa de envio paga pelo comprador mapeada');
  assert.equal(o.totalGlobal, 143.8); assert.equal(o.cupom, 'JULHO10');
  assert.equal(o.taxas.comissao, 17.5); assert.equal(o.envio.metodo, 'Shopee Xpress');
  const o3 = V8IMP.ordersView(eng, {}).orders.find(x => x.id === '260628GHI003');
  assert.match(o3.cancelamentoMotivo, /desistiu/, 'Cancelar Motivo mapeado');
  assert.equal(o3.datas.cancelamento, '2026-06-29');
  assert.equal(eng.rawFiles[0].abas[0].headers.length, 37, 'TODAS as colunas na camada bruta');
  /* arquivo que é SÓ hot listing continua reconhecível (sem assinatura forte) */
  const dh = V8IMP.detect(V8IMP.FIXTURES.hotListingOnly());
  assert.equal(dh.perfil, 'SHOPEE_HOT_LISTING', 'auxiliar só vence sem perfil forte');
});

test('C3 · combinação mínima de evidências: "ID do pedido" sozinho não vira pedidos; devolução não vira pedidos', () => {
  const soId = V8IMP.detect({ abas: [{ nome: 'x', headers: ['ID do pedido', 'Coluna Qualquer'], rows: [] }] });
  assert.notEqual(soId.perfil, 'SHOPEE_ORDERS', 'uma coluna isolada nunca classifica');
  const dev = V8IMP.detect(V8IMP.FIXTURES.returnZip(PER).entries[0]);
  assert.equal(dev.perfil, 'SHOPEE_RETURN_REFUND', 'evento tem prioridade sobre pedidos quando ident de evento presente');
});

test('C4 · correção manual do tipo: prévia permite trocar, lote antigo cancelado, trilha auditada', () => {
  const eng = V8IMP.createEngine();
  const b = V8IMP.stage(eng, V8IMP.FIXTURES.hotListingOnly(), ESC, {});
  assert.equal(b.estado, 'BLOQUEADO', 'REFERENCE_ONLY continua honesto');
  const r = V8IMP.reclassify(eng, b.id, 'CUSTOM_CSV_MAPPING', { usuario: 'Marcos' });
  assert.ok(r.ok);
  assert.equal(r.batch.det.origemClassificacao, 'CORREÇÃO MANUAL DO TIPO');
  assert.equal(eng.batches[0].estado, 'CANCELADO', 'lote antigo cancelado, não apagado');
  assert.ok(eng.audit.some(a => a.acao === 'tipo_corrigido_manualmente'), 'troca auditada');
  assert.equal(V8IMP.reclassify(eng, r.batch.id, 'PERFIL_INEXISTENTE', {}).blocked, true);
  /* aplicado não reclassifica sem rollback */
  const eng2 = engCom(V8IMP.FIXTURES.orders(PER));
  assert.match(V8IMP.reclassify(eng2, eng2.batches[0].id, 'SHOPEE_ORDERS', {}).reason, /rollback/);
  /* UI: prévia com sugestão explicada e troca de tipo */
  assert.match(impJs, /Perfil sugerido/, 'prévia mostra o perfil sugerido');
  assert.match(impJs, /Por que foi identificado/, 'prévia explica as evidências');
  assert.match(impJs, /Alterar tipo de importação/, 'usuário pode corrigir o tipo');
  assert.match(impJs, /V8IMP\.reclassify/, 'troca usa o motor, não só a tela');
});

/* ---------- 40 / M15 · nada de proibido; suíte anterior segue verde ---------- */
test('40+M15 · NÃO CRIAR: sem CRM/leads, sem upload falso, sem exclusão sem auditoria, sem escrita externa', () => {
  const all = [pedJs, creJs, impJs, read('file-reader.js')].join('');
  assert.ok(!/\bleadsView|LeadService|pipeline de leads(?!\.)/i.test(pedJs + impJs), 'sem CRM');
  assert.ok(!/publicar automaticamente|escrita externa liberada/i.test(all), 'sem escrita externa');
  assert.match(impJs, /readLocalFile/, 'upload é real, não decorativo');
  const eng = engCom(V8IMP.FIXTURES.orders(PER));
  const key = V8IMP.ordersView(eng, {}).orders[0].key;
  V8IMP.excludeFromAnalysis(eng, key, { motivo: 'x' });
  assert.ok(eng.snapshots.find(s => s.key === key).raw, 'nenhuma exclusão apaga o bruto');
  assert.ok(eng.audit.length >= 3, 'trilha de auditoria viva');
  /* M15/40: as suítes anteriores rodam juntas no npm test — este arquivo não substitui nenhum contrato */
  assert.ok(fs.existsSync(path.join(__dirname, 'ui-v8-import.test.js')), 'contratos anteriores preservados');
});
