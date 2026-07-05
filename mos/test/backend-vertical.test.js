/* =============================================================
   SPRINT 10.E.2.5.3 — INTEGRAÇÃO REAL: Protótipo → API → MOS → Postgres.
   Vertical PERFORMANCE completa contra banco REAL (não IndexedDB, não
   fixture, não array em memória): upload → parse → apply → consulta via
   API. Prova que os dados SOBREVIVEM a uma instância nova do backend
   (equivale a outro navegador / relogin / novo frontend), que reimportar
   não duplica, que o filtro de período consulta o banco, e que a busca
   por Item ID / Variation ID / SKU funciona na base real.

   Este teste SÓ roda com Postgres real (HEAD_TEST_PG=postgres://...).
   Sem ele, é pulado — mantendo `npm test` verde onde não há banco.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const PG = process.env.HEAD_TEST_PG || (process.env.DATABASE_URL && /^postgres/.test(process.env.DATABASE_URL) ? process.env.DATABASE_URL : null);

if (!PG) {
  test('backend vertical (Postgres) — pulado: defina HEAD_TEST_PG=postgres://…', { skip: true }, () => {});
} else {
  process.env.DATABASE_URL = PG; /* força o driver Postgres */
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'head-bv-'));
  const { createApi } = require('../../apps/api/server.js');

  /* cliente HTTP mínimo com cookie de sessão */
  function client(server) {
    const port = server.address().port;
    let cookie = '';
    return function call(method, urlPath, body, headers) {
      return new Promise((resolve, reject) => {
        const isBuf = Buffer.isBuffer(body);
        const payload = body == null ? null : isBuf ? body : Buffer.from(JSON.stringify(body));
        const req = http.request({ host: '127.0.0.1', port, method, path: urlPath,
          headers: Object.assign({ 'content-type': isBuf ? 'application/octet-stream' : 'application/json',
            'content-length': payload ? payload.length : 0, cookie }, headers || {}) }, res => {
          const ch = []; res.on('data', c => ch.push(c));
          res.on('end', () => {
            const sc = res.headers['set-cookie']; if (sc) cookie = sc[0].split(';')[0];
            let out = {}; try { out = JSON.parse(Buffer.concat(ch).toString() || '{}'); } catch (e) { out = {}; }
            resolve({ status: res.statusCode, body: out });
          });
        });
        req.on('error', reject); if (payload) req.write(payload); req.end();
      });
    };
  }

  /* CSV de PERFORMANCE.PRODUTO com cabeçalhos reais Shopee (campos entre aspas) */
  const HEADERS = ['ID do Item', 'Produto', 'Status Atual do Item', 'ID da Variação', 'Nome da Variação', 'Status Atual da Variação',
    'SKU Principal', 'SKU da Variação', 'Impressão do Produto', 'Cliques Por Produto', 'CTR', 'Visitantes do Produto (Adicionar ao Carrinho)',
    'Unidades (Adicionar ao Carrinho)', 'Vendas (Pedido Realizado) (BRL)', 'Vendas (Pedido Pago) (BRL)', 'Pedido Feito', 'Produto Pago'];
  const ROW1 = ['20597021635', 'Kit 3 Quadros Dourados 40X60', 'Ativo', '189573432678', 'Moldura Branca', 'Ativo',
    '456102', '456102-40X60-MB', '5.071.863', '185.395', '3,66%', '9.850', '11.320', '272.982,45', '242.565,98', '1.150', '1.085'];
  const ROW2 = ['44411503612', 'Quadro Decorativo Grande', 'Ativo', '', '', '', '778211', '778211-UNICO',
    '840.220', '21.030', '2,50%', '980', '1.040', '18.640,00', '14.320,00', '64', '49'];
  const q = a => a.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',');
  const csv = (r1, r2) => [q(HEADERS), q(r1), q(r2)].join('\n');
  const PERIODO = { ini: '2026-06-05', fim: '2026-07-04' };

  /* boot de uma instância da API sobre o MESMO Postgres */
  const _apis = [];
  async function boot() {
    const api = createApi({ env: 'LOCAL', baseDir });
    _apis.push(api);
    await new Promise(r => api.server.listen(0, r));
    return api;
  }
  test.after(() => { for (const a of _apis) { try { a.server.close(); } catch (e) {} try { a.db.close(); } catch (e) {} } });

  /* jornada real até ter dados aplicados no banco; devolve escopo + credenciais */
  async function importarPerformance(api, email, csvText, escopoExistente) {
    const call = client(api.server);
    const senha = 'segredo-forte-123';
    await call('POST', '/auth/signup', { email, senha, nome: 'Marcos' });
    api.db.prepare('UPDATE users SET email_confirmado = 1 WHERE email = ?').run(email.toLowerCase()); /* confirma e-mail (entrega de e-mail não é o objeto do teste) */
    const login = await call('POST', '/auth/login', { email, senha });
    assert.equal(login.status, 200, 'login ok');
    let escopo = escopoExistente;
    if (!escopo) {
      const sc = await call('POST', '/scope', { grupo: 'Líder Group', empresa: 'Líder Comércio', loja: 'Loja MG', marketplace: 'shopee', conta: 'shopee-mg' });
      assert.equal(sc.status, 201, 'escopo criado');
      escopo = { groupId: sc.body.groupId, companyId: sc.body.companyId, storeId: sc.body.storeId, accountId: sc.body.accountId, marketplace: 'shopee' };
    }
    const buf = Buffer.from(csvText, 'utf8');
    const up = await call('POST', '/files', buf, { 'x-filename': 'PERFORMANCE.PRODUTO.csv', 'x-group-id': escopo.groupId,
      'x-company-id': escopo.companyId, 'x-store-id': escopo.storeId, 'x-account-id': escopo.accountId, 'content-type': 'text/csv' });
    assert.equal(up.status, 201, 'upload real ok (' + JSON.stringify(up.body) + ')');
    const imp = await call('POST', '/imports', { fileId: up.body.fileId, escopo, periodo: PERIODO });
    assert.equal(imp.status, 202, 'lote criado');
    /* processamento (o worker faria isto lendo a fila do banco) */
    const st = api.imports.stage({ batchId: imp.body.batchId, buffer: buf, filename: 'PERFORMANCE.PRODUTO.csv', periodo: PERIODO });
    if (st.aplicavel) api.imports.apply({ batchId: imp.body.batchId, usuario: login.body.userId });
    return { call, escopo, batchId: imp.body.batchId, stage: st };
  }

  const qstr = (escopo, extra) => '?' + new URLSearchParams(Object.assign({ group_id: escopo.groupId, company_id: escopo.companyId, marketplace: 'shopee', account_id: escopo.accountId }, extra || {})).toString();

  test('vertical PERFORMANCE: upload → Postgres → API, sem duplicar, com período e busca por ID/SKU', async () => {
    const api = await boot();
    const email = 'owner+' + Date.now() + '@lider.com';
    const { call, escopo, stage } = await importarPerformance(api, email, csv(ROW1, ROW2));
    assert.equal(stage.registros, 2, '2 linhas reais no staging');

    /* 1-2 · consulta a base real via API */
    const perf = await call('GET', '/intelligence/performance' + qstr(escopo));
    assert.equal(perf.status, 200);
    assert.equal(perf.body.itens.length, 2, 'linhas reais na Central via API');
    const it = perf.body.itens.find(x => x.item_id === '20597021635');
    assert.ok(it && it.sku_variacao === '456102-40X60-MB' && it.impressions === 5071863 && it.sales_paid_brl === 242565.98, 'valores reais parseados');

    /* 11 · busca por Item ID, Variation ID, SKU */
    assert.equal((await call('GET', '/intelligence/performance' + qstr(escopo, { item_id: '20597021635' }))).body.itens.length, 1, 'busca por Item ID');
    assert.equal((await call('GET', '/intelligence/performance' + qstr(escopo, { variation_id: '189573432678' }))).body.itens.length, 1, 'busca por Variation ID');
    assert.equal((await call('GET', '/intelligence/performance' + qstr(escopo, { sku: '778211' }))).body.itens.length, 1, 'busca por SKU');

    /* 10 · filtro de período consulta o banco: fonte agregada de 30d não vira 7d falso */
    const p7 = await call('GET', '/intelligence/performance' + qstr(escopo, { period_start: '2026-06-29', period_end: '2026-07-05' }));
    assert.equal(p7.body.cobertura, 'DADO_SEM_DATA_EXATA', 'agregado não é recortado em 7 dias (honesto)');

    /* 12-13 · reimportar o MESMO arquivo não duplica */
    await importarPerformance(api, email, csv(ROW1, ROW2), escopo);
    const perf2 = await call('GET', '/intelligence/performance' + qstr(escopo));
    assert.equal(perf2.body.itens.length, 2, 'reimport não duplica na base');

    api.server.close();
  });

  test('persistência REAL: instância nova do backend (outro navegador/relogin/novo frontend) vê os mesmos dados', async () => {
    const api = await boot();
    const email = 'persist+' + Date.now() + '@lider.com';
    const { escopo } = await importarPerformance(api, email, csv(ROW1, ROW2));
    api.server.close(); /* derruba o backend inteiro — nada fica em memória */

    /* nova instância da API sobre o MESMO Postgres = outra sessão/navegador/deploy */
    const api2 = await boot();
    const call2 = client(api2.server);
    await call2('POST', '/auth/signup', { email, senha: 'segredo-forte-123' }).catch(() => {});
    const login = await call2('POST', '/auth/login', { email, senha: 'segredo-forte-123' });
    assert.equal(login.status, 200, 'relogin ok');
    const perf = await call2('GET', '/intelligence/performance' + qstr(escopo));
    assert.equal(perf.status, 200);
    assert.equal(perf.body.itens.length, 2, 'os mesmos dados aparecem numa instância NOVA do backend');
    assert.equal(perf.body.itens.find(x => x.item_id === '20597021635').sales_paid_brl, 242565.98, 'valor real persistido no Postgres');
    api2.server.close();
  });

  test('nova versão do relatório: atualiza só o que mudou, sem apagar nem duplicar', async () => {
    const api = await boot();
    const email = 'upd+' + Date.now() + '@lider.com';
    const { call, escopo } = await importarPerformance(api, email, csv(ROW1, ROW2));
    /* nova versão: mesma chave natural (item+variação+período), venda paga mudou */
    const ROW1b = ROW1.slice(); ROW1b[14] = '300.000,00';
    await importarPerformance(api, email, csv(ROW1b, ROW2), escopo);
    const perf = await call('GET', '/intelligence/performance' + qstr(escopo));
    assert.equal(perf.body.itens.length, 2, 'sem duplicar');
    assert.equal(perf.body.itens.find(x => x.item_id === '20597021635').sales_paid_brl, 300000, 'valor atualizado');
    api.server.close();
  });

  test('endpoints de leitura do lote: preview, campos e detalhe (base real)', async () => {
    const api = await boot();
    const email = 'read+' + Date.now() + '@lider.com';
    const { call, escopo, batchId } = await importarPerformance(api, email, csv(ROW1, ROW2));
    const prev = await call('GET', '/imports/' + batchId + '/preview' + qstr(escopo));
    assert.ok(prev.body.preview.length === 2 && prev.body.preview[0].raw['ID do Item'], 'preview com linhas reais');
    const fields = await call('GET', '/imports/' + batchId + '/fields' + qstr(escopo));
    assert.ok(fields.body.totalColunas >= 17 && fields.body.campos.some(c => c.coluna === 'SKU da Variação'), 'campos recebidos');
    const det = await call('GET', '/imports/' + batchId + qstr(escopo));
    assert.equal(det.body.estado, 'APLICADO', 'lote aplicado no banco');
    api.server.close();
  });

  test('summary da inteligência conta registros reais por tipo no Postgres', async () => {
    const api = await boot();
    const email = 'sum+' + Date.now() + '@lider.com';
    const { call, escopo } = await importarPerformance(api, email, csv(ROW1, ROW2));
    const sum = await call('GET', '/intelligence/summary' + qstr(escopo));
    assert.ok(sum.body.total >= 2 && sum.body.porTipo.some(t => t.metric_type === 'performance_item'), 'summary por tipo');
    assert.match(sum.body.fonte, /Postgres/);
    api.server.close();
  });
}
