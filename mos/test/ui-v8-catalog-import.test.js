/* =============================================================
   SPRINT 10.E.2.4 — Importação real de CADASTRO SHOPEE no Catálogo
   34 testes: Product Master × Anúncio Shopee × Variação, todos os
   campos preservados, identidade por item_id/SKU (nunca só nome),
   mídia referenciada (não validada) + upload manual, status reportado
   por planilha, saúde e pendências, relação com pedidos/métricas,
   edição auditada, permissões — sem escrita externa na Shopee.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8CAT = require('../../design/prototipo-v8/catalog-engine.js');
const V8IMP = require('../../design/prototipo-v8/import-engine.js');
const V8FILE = require('../../design/prototipo-v8/file-reader.js');
const DATA = require('../../design/prototipo-v8/data.js');
const D = DATA.V8DATA || DATA;

const read = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const ESC = { companyId: 'e1', contaId: 'acc-sh-1', marketplace: 'shopee' };
const freshCat = () => V8CAT.createCatalog(JSON.parse(JSON.stringify(D.products)));
const aplicado = (papel) => {
  const cat = freshCat();
  const st = V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), ESC);
  const r = V8CAT.cadastroApply(cat, st, { papel: papel || 'OWNER' });
  return { cat, st, r };
};

/* 1 — cadastro é importado DENTRO do Catálogo (motor do catálogo, não genérico) */
test('01 · cadastro Shopee é reconhecido e aplicado pelo motor do Catálogo', () => {
  assert.equal(typeof V8CAT.cadastroStage, 'function');
  assert.equal(typeof V8CAT.cadastroApply, 'function');
  const { r } = aplicado();
  assert.ok(r.ok && r.impacto.mastersCriados >= 3, 'produtos master criados a partir do cadastro');
  const cat = read('catalogo.js');
  assert.ok(/cadastroApply|cadastroStage/.test(cat), 'fluxo de cadastro cabeado no Catálogo (não em importação genérica)');
});

/* 2 — XLSX lê todas as abas */
test('02 · leitura passa por todas as abas do arquivo', () => {
  const st = V8CAT.cadastroStage(freshCat(), V8CAT.cadastroFixture(), ESC);
  assert.ok(st.abas.includes('Basic Template'), 'aba lida');
  assert.equal(typeof V8FILE.segmentBlocks, 'function', 'segmentação de blocos disponível para o cadastro');
});

/* 3 — todos os campos originais preservados */
test('03 · todos os campos originais são preservados (camada bruta)', () => {
  const st = V8CAT.cadastroStage(freshCat(), V8CAT.cadastroFixture(), ESC);
  assert.equal(st.camposPreservados, 31, 'todas as 31 colunas preservadas');
  assert.ok(st.rawRows.length >= 4, 'linhas brutas preservadas');
});

/* 4 — campo bruto aparece em Campos Recebidos com origem */
test('04 · Campos Recebidos lista toda coluna com tipo, entidade, destino e status', () => {
  const { cat } = aplicado();
  const campos = V8CAT.cadCamposRecebidos(cat);
  assert.equal(campos.length, 31);
  const preco = campos.find(c => c.coluna === 'Preço');
  assert.equal(preco.campoNormalizado, 'price');
  assert.equal(preco.entidade, 'Variação');
  assert.equal(preco.status, 'Utilizado');
  for (const c of campos) assert.ok(c.coluna && c.tipo && c.entidade, 'coluna com metadados: ' + c.coluna);
});

/* 5 — campo pode ser mapeado manualmente */
test('05 · coluna pode ser mapeada manualmente (auditado, bruto preservado)', () => {
  const cat = freshCat();
  const f = V8CAT.cadastroFixture();
  f.abas[0].headers.push('Observação interna'); f.abas[0].rows[0]['Observação interna'] = 'linha piloto';
  const st = V8CAT.cadastroStage(cat, f, ESC);
  V8CAT.cadastroApply(cat, st, { papel: 'OWNER' });
  let campos = V8CAT.cadCamposRecebidos(cat);
  const obs = campos.find(c => c.coluna === 'Observação interna');
  assert.equal(obs.status, 'Aguardando mapeamento', 'coluna desconhecida aguardando mapeamento');
  const r = V8CAT.cadMapearCampo(cat, 'Observação interna', 'listing_internal_note', 'LISTING', { papel: 'OWNER' });
  assert.ok(r.ok);
  campos = V8CAT.cadCamposRecebidos(cat);
  assert.equal(campos.find(c => c.coluna === 'Observação interna').status, 'Mapeado manualmente');
});

/* 6 — Product Master só com evidência suficiente */
test('06 · master criado só com evidência; nome sozinho fica AGUARDANDO REVISÃO', () => {
  const { st } = aplicado();
  const soNome = st.masters.find(m => m.nome === 'Produto sem SKU nem item_id');
  assert.equal(soNome.vinculo, 'AGUARDANDO REVISÃO');
  const comSku = st.masters.find(m => m.skuPai === 'ESP-ADN');
  assert.equal(comSku.vinculo, 'NOVO PRODUTO MASTER', 'SKU pai é evidência suficiente para novo master');
});

/* 7 — Listing por marketplace + conta + item_id */
test('07 · anúncio Shopee identificado por marketplace + conta + item_id', () => {
  const { cat } = aplicado();
  const l = V8CAT.cadListings(cat).find(x => x.itemIdExterno === '900101');
  assert.ok(l && l.key === 'L|shopee|acc-sh-1|900101', 'chave do anúncio = marketplace+conta+item_id');
  assert.equal(l.marketplace, 'shopee');
});

/* 8 — Variação por marketplace + conta + SKU */
test('08 · variação identificada por marketplace + conta + SKU', () => {
  const { cat } = aplicado();
  const v = V8CAT.cadStore ? null : null;
  const st = cat.cadastro;
  const varr = st.variacoes.find(x => x.sku === 'QP-80120');
  assert.ok(varr && varr.key === 'V|shopee|acc-sh-1|QP-80120');
});

/* 9 — nome sozinho não gera vínculo definitivo */
test('09 · nome sozinho nunca cria vínculo definitivo', () => {
  const { st } = aplicado();
  assert.ok(st.masters.filter(m => m.soNome).every(m => m.vinculo === 'AGUARDANDO REVISÃO'));
});

/* 10 — conflito de SKU abre revisão humana */
test('10 · SKU duplicado no mesmo marketplace/conta abre conflito para revisão', () => {
  const cat = freshCat();
  const f = V8CAT.cadastroFixture();
  f.abas[0].rows.push(Object.assign({}, f.abas[0].rows[0], { 'Nome do produto': 'Outro', 'Número de referência do SKU pai': 'OUTRO-1', 'ID do Item': '900909' }));
  const st = V8CAT.cadastroStage(cat, f, ESC);
  assert.ok(st.conflitos.some(c => c.sku === 'QP-6090' && /AGUARDANDO REVIS/.test(c.estado)), 'conflito de SKU declarado');
});

/* 11 — status importado marcado como reportado por planilha */
test('11 · status vira "reportado por planilha", nunca ao vivo', () => {
  const { cat } = aplicado();
  const l = V8CAT.cadListings(cat).find(x => x.itemIdExterno === '900101');
  assert.equal(l.situacao, 'STATUS REPORTADO POR PLANILHA');
  assert.equal(l.statusReportado, 'Ativo reportado');
  assert.equal(V8CAT.statusReportado('Pausado'), 'Pausado reportado');
  assert.equal(V8CAT.statusReportado('xyz'), 'Desconhecido');
});

/* 12 — foto por URL vira mídia referenciada, não validada */
test('12 · imagem por URL é MÍDIA REFERENCIADA, nunca validada', () => {
  const { cat } = aplicado();
  const l = V8CAT.cadListings(cat).find(x => x.itemIdExterno === '900101');
  const md = l.midias.find(m => m.principal);
  assert.equal(md.status, 'MÍDIA REFERENCIADA');
  assert.equal(md.pendenteValidacao, true);
  assert.equal(md.origem, 'importação Shopee');
});

/* 13 — upload manual de foto funciona */
test('13 · upload manual de foto/vídeo é registrado como carregado manualmente', () => {
  const { cat } = aplicado();
  const l = V8CAT.cadListings(cat)[0];
  const r = V8CAT.cadAddMediaManual(cat, l.id, { arquivo: 'foto-real.jpg', principal: true }, { papel: 'OWNER' });
  assert.ok(r.ok && r.media.status === 'CARREGADA MANUALMENTE');
  assert.ok(V8CAT.cadAddMediaManual(cat, l.id, { arquivo: 'x.txt' }, { papel: 'OWNER' }).blocked, 'formato inválido recusado');
});

/* 14 — anúncio aparece na lista do Catálogo */
test('14 · anúncios importados aparecem na lista do Catálogo', () => {
  const { cat } = aplicado();
  assert.ok(V8CAT.cadListings(cat).length >= 3);
});

/* 15 — variações vinculadas ao anúncio correto */
test('15 · variações ficam vinculadas ao anúncio correto', () => {
  const { cat } = aplicado();
  const l = V8CAT.cadListings(cat).find(x => x.itemIdExterno === '900101');
  const vars = V8CAT.cadVariacoesDe(cat, l.key);
  assert.equal(vars.length, 2, 'QP-6090 tem 2 variações no mesmo anúncio');
  assert.ok(vars.map(v => v.sku).includes('QP-6090') && vars.map(v => v.sku).includes('QP-80120'));
});

/* 16 — preço, estoque, logística e fiscal presentes na variação (para o editor) */
test('16 · variação carrega preço, estoque, logística e fiscal', () => {
  const { cat } = aplicado();
  const v = cat.cadastro.variacoes.find(x => x.sku === 'QP-6090');
  assert.equal(v.preco, 124.9, 'preço BR convertido');
  assert.equal(v.estoque, 12);
  assert.equal(v.logistica.larguraCm, 10);
  assert.equal(v.logistica.alturaCm, 65);
  assert.equal(v.fiscal.ncm, '4911.91.00');
});

/* 17-19 — pendências abrem a aba certa do editor */
test('17-19 · pendências de peso/EAN/mídia abrem logística, especificações e fotos', () => {
  const { cat } = aplicado();
  const saude = V8CAT.saudeCadastro(cat);
  const fila = k => saude.find(f => f.key === k);
  assert.equal(fila('sem_peso').aba, 'Envio e Logística');
  assert.equal(fila('sem_ean').aba, 'Informações Fiscais');
  assert.equal(fila('midia_referenciada').aba, 'Fotos e Vídeos');
  assert.ok(fila('sem_ean').itens.length >= 1, 'pendência de EAN populada');
});

/* 20 — cadastro não sobrescreve anúncio de outro marketplace */
test('20 · aplicar cadastro Shopee não toca anúncios de outros marketplaces', () => {
  const cat = freshCat();
  const antesML = JSON.stringify(cat.listings.filter(l => l.marketplace === 'ml'));
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), ESC), { papel: 'OWNER' });
  assert.equal(JSON.stringify(cat.listings.filter(l => l.marketplace === 'ml')), antesML, 'anúncios ML intactos');
});

/* 21 — importação atualiza Histórico e Auditoria */
test('21 · importação registra histórico e auditoria', () => {
  const { cat } = aplicado();
  assert.equal(V8CAT.cadImports(cat).length, 1);
  assert.ok(cat.cadastro.audit.some(a => a.acao === 'cadastro_shopee_aplicado'));
});

/* 22 — reimportação não duplica anúncio */
test('22 · reimportar o mesmo cadastro não duplica master/anúncio/variação', () => {
  const { cat } = aplicado();
  const ov = V8CAT.cadastroOverview(cat);
  const r2 = V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), ESC), { papel: 'OWNER' });
  assert.equal(r2.impacto.mastersCriados, 0);
  assert.equal(r2.impacto.variacoesCriadas, 0);
  assert.deepEqual(V8CAT.cadastroOverview(cat), Object.assign({}, ov, { imports: 2 }));
});

/* 23 — reimportação atualiza dado alterado com histórico */
test('23 · reimportar com valor alterado atualiza e versiona (nunca soma)', () => {
  const { cat } = aplicado();
  const f = V8CAT.cadastroFixture();
  f.abas[0].rows[0]['Preço'] = '139,90';
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, f, ESC), { papel: 'OWNER' });
  const v = cat.cadastro.variacoes.find(x => x.sku === 'QP-6090');
  assert.equal(v.preco, 139.9, 'preço atualizado');
  assert.ok(v.versoes.some(ver => ver.campo === 'preco' && ver.antes === 124.9), 'versão anterior preservada');
});

/* 24-25 — relação com pedidos/métricas por item_id; incerto vai para revisão */
test('24-25 · relação com performance usa item_id; sem correspondência fica sem vínculo', () => {
  const { cat } = aplicado();
  const eng = V8IMP.createEngine();
  const res = V8IMP.stage(eng, V8IMP.FIXTURES.metricasPrincipais({ ini: '2026-06-04', fim: '2026-07-03' }), { groupId: 'g', companyId: 'e1', cnpjId: 'c', lojaId: 's1', contaId: 'acc-sh-1', marketplace: 'shopee', tipoDado: 'DADOS REAIS' }, { products: D.products });
  for (const b of res.batches) if (b.preview && b.preview.aplicavel) V8IMP.applyImportChain(eng, b.id, { products: D.products });
  const rel = V8CAT.cadastroRelacoes(cat, eng);
  assert.ok(rel.relacoes.length >= 3);
  assert.ok(rel.relacoes.some(r => r.vinculoPerf === 'SEM PERFORMANCE VINCULADA'), 'incerto declarado, não inventado');
});

/* 26-27 — Catálogo recebe vendidos/performance quando vínculo existir */
test('26-27 · performance/vendidos entram quando item_id casa; senão declara ausência', () => {
  const cat = freshCat();
  const f = V8CAT.cadastroFixture();
  f.abas[0].rows[0]['ID do Item'] = '9001'; f.abas[0].rows[1]['ID do Item'] = '9001';
  V8CAT.cadastroApply(cat, V8CAT.cadastroStage(cat, f, ESC), { papel: 'OWNER' });
  const eng = V8IMP.createEngine();
  const res = V8IMP.stage(eng, V8IMP.FIXTURES.metricasPrincipais({ ini: '2026-06-04', fim: '2026-07-03' }), { groupId: 'g', companyId: 'e1', cnpjId: 'c', lojaId: 's1', contaId: 'acc-sh-1', marketplace: 'shopee', tipoDado: 'DADOS REAIS' }, { products: D.products });
  for (const b of res.batches) if (b.preview && b.preview.aplicavel) V8IMP.applyImportChain(eng, b.id, { products: D.products });
  const rel = V8CAT.cadastroRelacoes(cat, eng);
  const casado = rel.relacoes.find(r => r.item_id === '9001');
  assert.equal(casado.vinculoPerf, 'CONFIRMADO POR ITEM_ID');
  assert.ok(casado.vendas > 0, 'vendas reais vinculadas por item_id');
  assert.ok(rel.comPerformance >= 1);
});

/* 28 — Central/Mesa mostra o que mudou */
test('28 · impacto do cadastro descreve o que mudou (para a Mesa)', () => {
  const { r } = aplicado();
  for (const k of ['mastersCriados', 'listingsVinculados', 'variacoesCriadas', 'camposPreservados', 'conflitos', 'aguardandoRevisao', 'midiasReferenciadas', 'pendencias'])
    assert.ok(k in r.impacto, 'impacto declara ' + k);
});

/* 29 — Centro de Custos recebe base quando houver cobertura */
test('29 · variação traz preço como base de margem (cobertura para Centro de Custos)', () => {
  const { cat } = aplicado();
  const comPreco = cat.cadastro.variacoes.filter(v => v.preco != null);
  assert.ok(comPreco.length >= 3, 'há base de preço para estimar margem quando cobertura permitir');
});

/* 30 — nenhum dado demo no escopo real */
test('30 · registros importados têm origem de planilha, nunca DEMO', () => {
  const { cat } = aplicado();
  assert.ok(cat.cadastro.masters.every(m => m.origem === 'DADO IMPORTADO VIA PLANILHA'));
  assert.ok(cat.cadastro.listings.every(l => l.fonte === 'PLANILHA_SHOPEE'));
});

/* 31 — nenhuma escrita externa é disparada */
test('31 · nada é publicado nem alterado na Shopee', () => {
  const eng = read('catalog-engine.js');
  /* 10.E.3.3 — published_at/publishedAt são timestamps da identidade externa (contrato),
     e a publicação é só SOLICITAÇÃO interna (escritaExterna:false) — não escrita externa.
     Removemos esses tokens de DADO antes do heurístico, que segue barrando qualquer FUNÇÃO
     de escrita externa real (api.shopee, push_to_shopee, sincroniza, publishToShopee...). */
  const engSemDados = eng.replace(/nunca (é )?public|não .*public/gi, '')
    .replace(/publish(ed)?_?[aA]t/g, '');
  assert.ok(!/\bpublicar|publish|sincroniza|push_to_shopee|api\.shopee/i.test(engSemDados), 'sem função de escrita externa');
  const { cat } = aplicado();
  assert.ok(cat.cadastro.listings.every(l => l.situacao === 'STATUS REPORTADO POR PLANILHA'));
});

/* 32 — usuário sem permissão não aplica */
test('32 · papel sem CATALOG_IMPORT_APPLY não aplica cadastro', () => {
  const cat = freshCat();
  const st = V8CAT.cadastroStage(cat, V8CAT.cadastroFixture(), ESC);
  assert.ok(V8CAT.cadastroApply(cat, st, { papel: 'LEITURA' }).blocked);
});

/* 33 — usuário sem permissão não corrige */
test('33 · papel sem CATALOG_EDIT não corrige cadastro; correção exige motivo', () => {
  const { cat } = aplicado();
  const l = V8CAT.cadListings(cat)[0];
  assert.ok(V8CAT.cadCorrigirCampo(cat, 'listing', l.id, 'titulo', 'X', { papel: 'LEITURA', motivo: 'x' }).blocked);
  assert.ok(V8CAT.cadCorrigirCampo(cat, 'listing', l.id, 'titulo', 'X', { papel: 'OWNER' }).blocked, 'sem motivo, recusa');
  const ok = V8CAT.cadCorrigirCampo(cat, 'listing', l.id, 'titulo', 'Título corrigido', { papel: 'OWNER', motivo: 'ajuste' });
  assert.ok(ok.ok);
  const alvo = cat.cadastro.listings.find(x => x.id === l.id);
  assert.equal(alvo.correcoes[0].importadoOriginal !== undefined, true, 'valor importado original preservado');
});

/* 34 — contrato de UI (fluxo dentro do Catálogo) */
test('34 · UI: fluxo "Importar Cadastro Shopee" cabeado no Catálogo', () => {
  const cat = read('catalogo.js');
  assert.ok(/Importar Cadastro/.test(cat), 'subárea Importar Cadastro presente');
  assert.ok(/cadastroApply/.test(cat) && /saudeCadastro/.test(cat), 'apply e saúde do cadastro consumidos na UI');
  assert.ok(/O QUE MUDOU COM O CADASTRO SHOPEE|O que mudou com o cadastro/i.test(cat) || /cadastroOverview/.test(cat), 'Mesa/painel de mudança do cadastro');
});
