/* =============================================================
   SPRINT 10.E.2.2 — Data Foundation + Intelligence Activation
   34 testes: todos os campos preservados e visíveis, mapeamento
   manual auditado, relacionamentos com fila de revisão, cadeia
   explícita pós-importação atualizando Pedidos/Catálogo/Central/
   Home/Silêncio/Conhecimento/Custos, hierarquia de evidência
   (real > demo), agentes declarando fontes/campos e permissões.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8IMP = require('../../design/prototipo-v8/import-engine.js');
const DATA = require('../../design/prototipo-v8/data.js');
const D = DATA.V8DATA || DATA;

const read = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const impJs = read('importar.js');
const ESC = { groupId: 'g1', companyId: 'e1', cnpjId: 'c1', lojaId: 's1', contaId: 'acc-sh-1', marketplace: 'shopee' };
const PER = { ini: '2026-06-04', fim: '2026-07-04' };

const comMisterio = () => {
  const f = V8IMP.FIXTURES.ordersReal(PER);
  f.abas[0].headers = [...f.abas[0].headers, 'Campo Misterioso X'];
  f.abas[0].rows[0]['Campo Misterioso X'] = 'valor-abc';
  return f;
};
const engAplicado = () => {
  const eng = V8IMP.createEngine();
  const b = V8IMP.stage(eng, comMisterio(), ESC, {});
  const r = V8IMP.applyImportChain(eng, b.id, { products: D.products });
  return { eng, b, r };
};

/* ---------- 01-04 · campos preservados e visíveis ---------- */
test('01-04 · toda coluna preservada e visível, com origem; desconhecido = aguardando mapeamento', () => {
  const { eng } = engAplicado();
  const cat = V8IMP.fieldCatalog(eng);
  assert.equal(cat.length, 38, 'TODAS as colunas (37 + desconhecida) no catálogo de campos');
  for (const c of cat) assert.ok(c.coluna && c.arquivos.length && c.status, 'coluna com origem e status: ' + c.coluna);
  const id = cat.find(c => c.coluna === 'ID do pedido');
  assert.equal(id.campoNormalizado, 'order_id');
  assert.deepEqual(id.areas, ['Pedidos', 'Devoluções', 'Central'], 'origem/uso de cada campo declarados');
  assert.equal(id.origemMapeamento, 'DICIONÁRIO CANÔNICO');
  const hot = cat.find(c => c.coluna === 'Hot Listing');
  assert.equal(hot.campoNormalizado, 'order_hot_listing_flag');
  assert.equal(hot.status, 'preservado e disponível', 'auxiliar preservado, não descartado');
  const mist = cat.find(c => c.coluna === 'Campo Misterioso X');
  assert.equal(mist.status, 'aguardando mapeamento', 'campo desconhecido declarado');
  assert.equal(mist.exemplo, 'valor-abc', 'exemplo de valor visível');
  assert.match(impJs, /Campos Recebidos/, 'tela de Campos Recebidos');
  assert.match(impJs, /Base de Dados e Mapeamento/, 'área obrigatória em Fontes e Dados');
});

/* ---------- 05-06 · mapeamento manual + reprocesso ---------- */
test('05-06 · mapeamento manual auditado e versionado; reprocessar atualiza normalizados', () => {
  const { eng, b } = engAplicado();
  assert.equal(V8IMP.mapField(eng, { coluna: 'Campo Misterioso X', tipo: 'Texto', entidade: 'Pedido', campo: 'x' }, { papel: 'LEITURA' }).blocked, true, 'FIELD_MAPPING_EDIT no motor');
  assert.equal(V8IMP.mapField(eng, { coluna: 'X', tipo: 'TipoInvalido', entidade: 'Pedido', campo: 'x' }, {}).blocked, true, 'tipo validado');
  const m1 = V8IMP.mapField(eng, { coluna: 'Campo Misterioso X', tipo: 'Texto', entidade: 'Pedido', campo: 'order_custom_x' }, { usuario: 'Marcos' });
  assert.equal(m1.mapeamento.versao, 1);
  assert.equal(V8IMP.fieldCatalog(eng).find(c => c.coluna === 'Campo Misterioso X').status, 'utilizado', 'mapeado vira utilizado');
  const m2 = V8IMP.mapField(eng, { coluna: 'Campo Misterioso X', tipo: 'Campo auxiliar', entidade: 'Pedido', campo: 'order_custom_x' }, {});
  assert.equal(m2.mapeamento.versao, 2, 'nova versão, nunca sobrescrita');
  assert.ok(m2.anterior.fimVigencia, 'versão anterior preservada com fim de vigência');
  assert.ok(eng.audit.some(a => a.acao === 'campo_mapeado'), 'auditado');
  const rp = V8IMP.reprocess(eng, b.id, { usuario: 'Marcos' });
  assert.ok(rp.ok && rp.mappingVersion === 'v2' && rp.aguardando === 0, 'reprocesso atualiza e conta os campos');
  assert.equal(V8IMP.reprocess(eng, b.id, { papel: 'LEITURA' }).blocked, true, 'IMPORT_REPROCESS no motor');
});

/* ---------- 07-09 · relacionamentos ---------- */
test('07-09 · pedido↔devolução por ID; SKU↔produto só com evidência; relação incerta vai para revisão', () => {
  const eng = V8IMP.createEngine();
  const b1 = V8IMP.stage(eng, V8IMP.FIXTURES.orders(PER), ESC, {});
  V8IMP.applyImportChain(eng, b1.id, { products: D.products });
  const z = V8IMP.stage(eng, V8IMP.FIXTURES.returnZip(PER), ESC, {});
  z.batches.forEach(bt => V8IMP.apply(eng, bt.id, {}));
  const rel = V8IMP.relacoesReport(eng, D.products);
  assert.ok(rel.pedidosDevolucoes.vinculados >= 3, 'devoluções cruzadas pelo ID correto');
  assert.equal(rel.pedidosDevolucoes.chave, 'marketplace + conta + ID do pedido');
  assert.ok(rel.pedidosProdutos.vinculados >= 3, 'SKU→produto com evidência (QP-6090/KIT3-SALA existem)');
  assert.ok(rel.pedidosProdutos.semProduto.includes('ESP-ADN') || rel.pedidosProdutos.semProduto.includes('PR-3D'), 'SKU sem produto NÃO vincula sozinho');
  assert.ok(rel.fila.length >= 1, 'relação incerta entra em fila de revisão');
  const item = rel.fila[0];
  assert.ok(item.evidencia && item.acoes.length >= 2, 'fila mostra evidências e ações');
  V8IMP.decidirRelacao(eng, item.id, 'ignorar', { usuario: 'Marcos' });
  assert.equal(V8IMP.relacoesReport(eng, D.products).fila.length, rel.fila.length - 1, 'decisão tira da fila');
  assert.ok(eng.audit.some(a => a.acao === 'relacao_decidida'), 'decisão auditada');
});

/* ---------- 10-16 · cadeia explícita atualiza o sistema ---------- */
test('10-16 · pipeline de 15 passos atualiza Pedidos, Catálogo, Central, Home, Silêncio, Conhecimento e Custos', () => {
  const { eng, r } = engAplicado();
  assert.equal(r.passos.length, 15, 'cadeia explícita, nunca só "concluída"');
  const nomes = r.passos.map(p => p.nome);
  for (const n of ['Arquivo bruto persistido', 'Mapeamento aplicado', 'Dados normalizados', 'Entidades relacionadas',
    'Duplicidades reconciliadas', 'Cobertura atualizada', 'Dashboards recalculados', 'Agentes reprocessados',
    'Home atualizada', 'Mesa de Inteligência atualizada', 'Silêncio atualizado', 'Conhecimento atualizado', 'Histórico registrado'])
    assert.ok(nomes.includes(n), 'passo: ' + n);
  assert.ok(r.passos.every(p => p.resultado && p.resultado.length > 3), 'progresso REAL em cada passo');
  /* 10: Pedidos */
  assert.equal(V8IMP.ordersView(eng, {}).orders.length, 3, 'Pedidos atualizados');
  /* 12: Central */
  const mesa = V8IMP.mesaInsights(eng, {});
  assert.equal(mesa.agentes.find(a => a.nome === 'Analista de Pedidos').status, 'ANALISADO', 'Central reprocessada');
  /* 13: Home (cobertura real ativa) */
  assert.equal(V8IMP.coberturaReal(eng).pedidos, true, 'Home tem base real ativa');
  assert.match(read('home.js'), /BASE REAL ATIVA/, 'Home mostra a base real');
  /* 14: Silêncio */
  assert.ok(V8IMP.sinaisSilencio(eng).length >= 1, 'Silêncio recebe sinais avaliados');
  assert.match(read('silencio.js'), /sinaisSilencio/, 'tela do Silêncio consome');
  /* 15: Conhecimento */
  const fatos = V8IMP.fatosConhecimento(eng);
  assert.ok(fatos.length >= 1 && fatos[0].versaoDados, 'Conhecimento guarda fatos com versão de dados');
  assert.match(read('conhecimento.js'), /fatosConhecimento/, 'tela do Conhecimento consome');
  /* 16: Custos (vendas importadas viram base) */
  assert.match(read('custos.js'), /orderStats/, 'Centro de Custos usa pedidos importados como vendas');
  /* impacto registrado */
  assert.ok(r.impacto.fonte === 'Pedidos Shopee' && r.impacto.indicadoresRecalculados.includes('Pedidos'), 'impacto por área');
  assert.equal(V8IMP.lastImpact(eng).batchId, r.impacto.batchId);
  assert.match(read('crescimento.js'), /O que mudou com esta importação/, 'Mesa mostra o que mudou');
});

/* ---------- 17-18 · insights com proveniência e fato × hipótese ---------- */
test('17-18 · insight mostra fonte/período/cobertura e separa FATO de HIPÓTESE', () => {
  const eng = V8IMP.createEngine();
  const b = V8IMP.stage(eng, V8IMP.FIXTURES.orders(PER), ESC, {});
  V8IMP.applyImportChain(eng, b.id, {});
  const m = V8IMP.mesaInsights(eng, {});
  assert.ok(m.insights.length >= 1);
  for (const i of m.insights) {
    assert.ok(i.fato && i.fonte && i.periodo && i.cobertura && i.confianca, 'proveniência completa: ' + i.titulo);
    if (i.hipotese) assert.notEqual(i.fato, i.hipotese, 'fato ≠ hipótese');
  }
  const comHip = m.insights.find(i => i.hipotese);
  assert.ok(comHip, 'hipótese existe e é declarada como hipótese');
  assert.match(comHip.hipotese, /hipótese/i);
});

/* ---------- 19-20 · hierarquia de evidência (real > demo) ---------- */
test('19-20 · dado real substitui fixture equivalente; demo nunca contamina análise real', () => {
  const eng = V8IMP.createEngine();
  assert.equal(V8IMP.coberturaReal(eng).pedidos, false, 'sem importação: fixture demo rotulada');
  const b = V8IMP.stage(eng, V8IMP.FIXTURES.orders(PER), ESC, {});
  V8IMP.applyImportChain(eng, b.id, {});
  const cr = V8IMP.coberturaReal(eng);
  assert.equal(cr.pedidos, true);
  assert.match(cr.nota, /demo equivalente é desativado/, 'contrato de substituição');
  /* mesa usa o dado real nos KPIs */
  const kv = V8IMP.mesaInsights(eng, {}).visaoGeral.find(k => k.label === 'Pedidos importados');
  assert.equal(kv.valor, 6, 'visão geral com dado real');
  assert.match(kv.fonte, /Order\./, 'fonte real declarada');
  /* separação demo × real permanece absoluta no motor */
  assert.throws(() => V8IMP.assertNoDemoMix({ tipoDado: 'DADOS REAIS' }, 'DEMO_FIXTURE'), /não pode ser importado/);
  assert.match(read('custos.js'), /real:\s*true/, 'custos marca origem real × simulada');
});

/* ---------- 21-22 · dashboards com cobertura e campos usados ---------- */
test('21-22 · dashboard mostra cobertura e campos usados', () => {
  const pedJs = read('pedidos.js');
  assert.match(pedJs, /Período coberto/, 'cobertura no dashboard de Pedidos');
  assert.match(pedJs, /Campos usados/, 'campos usados visíveis no dashboard');
  assert.match(pedJs, /fieldCatalog/, 'lidos do catálogo de campos real');
  const { eng } = engAplicado();
  const st = V8IMP.orderStats(eng, {});
  assert.ok(st.fontes[0].periodo && st.fontes[0].escopo, 'fonte com período e escopo');
});

/* ---------- 23-26 · cadastro Shopee no Catálogo ---------- */
test('23-26 · cadastro Shopee no Catálogo: campos preservados, Master × Anúncio × Variação, sem sobrescrever outro canal', () => {
  const catJs = read('catalogo.js');
  assert.ok(catJs.includes("'Importar Cadastro'") && catJs.includes("'Campos de Cadastro'"), 'áreas dentro do Catálogo');
  assert.match(catJs, /CATALOG_RAW_FIELDS_VIEW/, 'campos brutos atrás de permissão');
  assert.match(catJs, /Product Master.*Anúncio Shopee.*Variação|destinoDe/s, 'separação por destino');
  const eng = V8IMP.createEngine();
  const b = V8IMP.stage(eng, V8IMP.FIXTURES.parentSku(), ESC, { products: D.products });
  V8IMP.applyImportChain(eng, b.id, { products: D.products });
  const cat = V8IMP.fieldCatalog(eng);
  assert.equal(cat.length, 8, 'todos os campos do template preservados');
  assert.equal(cat.find(c => c.coluna === 'SKU Pai').entidade, 'Produto Master', 'SKU Pai → Product Master');
  assert.equal(cat.find(c => c.coluna === 'SKU da variação').entidade, 'Variação', 'variação separada');
  assert.equal(cat.find(c => c.coluna === 'ID do Item').entidade, 'Anúncio', 'ID externo → Anúncio');
  /* nunca sobrescreve outro marketplace: staging respeita escopo shopee */
  assert.ok(eng.staging.every(s => s.marketplace === 'shopee'), 'importação presa ao canal do escopo');
});

/* ---------- 27-30 · auditoria, sensível, agentes ---------- */
test('27-30 · alteração manual auditada; campo sensível com permissão; agente declara fontes/campos e limitações', () => {
  const { eng } = engAplicado();
  V8IMP.mapField(eng, { coluna: 'Campo Misterioso X', tipo: 'Texto', entidade: 'Pedido', campo: 'x1' }, { usuario: 'Ana' });
  const a = eng.audit.find(x => x.acao === 'campo_mapeado');
  assert.ok(a && /v1/.test(a.detalhe), 'mapeamento auditado com versão');
  /* sensível */
  const cep = V8IMP.fieldCatalog(eng).find(c => c.coluna === 'CEP');
  assert.equal(cep.sensivel, true, 'CEP marcado sensível');
  assert.match(impJs, /RAW_DATA_VIEW/, 'exemplo de valor sensível atrás de permissão na tela');
  /* agentes */
  const m = V8IMP.mesaInsights(eng, {});
  const ped = m.agentes.find(x => x.nome === 'Analista de Pedidos');
  assert.ok(ped.fontes.length && ped.campos.includes('ID do pedido') && ped.periodo && ped.escopo && ped.cobertura, 'agente declara fontes, campos, período, escopo e cobertura');
  const sem = m.agentes.find(x => x.status === 'AGUARDANDO DADOS');
  assert.ok(sem.dadosFaltantes && /declara a limitação/.test(sem.confianca), 'sem dado suficiente o agente declara limitação');
});

/* ---------- 31-34 · dedup, honestidade causal, sem escrita externa ---------- */
test('31-34 · reimportação não duplica; sem causa confirmada inventada; zero escrita externa; suíte anterior no lugar', () => {
  const { eng } = engAplicado();
  const b2 = V8IMP.stage(eng, comMisterio(), ESC, {});
  assert.equal(b2.duplicado, true, 'mesmo arquivo bloqueado por fingerprint');
  const engineJs = read('import-engine.js');
  assert.match(engineJs, /hipótese, nunca causa afirmada|não causa confirmada|nunca afirmada como causa/, 'causalidade nunca afirmada sem evidência');
  assert.ok(!/fetch\(|XMLHttpRequest/.test(engineJs), 'motor sem chamadas externas');
  for (const p of ['FIELD_MAPPING_EDIT', 'IMPORT_REPROCESS', 'INTELLIGENCE_SOURCE_VIEW', 'INTELLIGENCE_RULE_EDIT', 'PRODUCT_IMPORT_APPLY', 'CATALOG_RAW_FIELDS_VIEW'])
    assert.ok(V8IMP.DATA_PERMS_ALL.includes(p), 'perm ' + p);
  for (const f of ['ui-v8.test.js', 'ui-v8-orders.test.js', 'ui-v8-catalog.test.js', 'ui-v8-business.test.js'])
    assert.ok(fs.existsSync(path.join(__dirname, f)), f + ' presente');
});
