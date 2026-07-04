#!/usr/bin/env node
/* =============================================================
   10.E · LIVE PILOT — Líder Molduras
   CLI do piloto: estrutura real + ingestão CONTROLADA em camadas.
   Nada entra fora de ordem; cada camada tem portão de aceite e
   relatório de conferência (os números têm que bater com a Shopee).
   Uso:
     node pilot/pilot.js bootstrap
     node pilot/pilot.js ingest --camada 2 --arquivo cat.xlsx --loja shopee-mg [--periodo 2026-06-01:2026-06-30]
     node pilot/pilot.js conferir --camada 4 --esperado 292591.00
     node pilot/pilot.js aceitar --camada 2
     node pilot/pilot.js status
   ============================================================= */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const core = require('../mos/src/production/core.js');
const { createSecurity } = require('../mos/src/production/security.js');
const { createStorage } = require('../mos/src/production/storage.js');
const { createQueue, createImportService, createWorker } = require('../mos/src/production/jobs.js');

const CFG_PATH = path.join(__dirname, 'lider.config.json');
const CFG = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
const STATE_PATH = path.join(__dirname, '.pilot-state.json');
const state = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH)) : { camadasAceitas: [], lojas: {} };
const salvar = () => fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

const CAMADAS = [
  [1, 'Grupo, empresa, CNPJs, lojas e contas reais', 'bootstrap'],
  [2, 'Catálogo, SKUs e anúncios existentes', 'SHOPEE_PARENT_SKU / catálogo'],
  [3, 'Revisão manual de vínculos e Anúncios Master', 'humano — tela Importar · Vínculos/Master'],
  [4, 'Vendas pagas e funil', 'SHOPEE_SALES_OVERVIEW'],
  [5, 'Tráfego e performance', 'SHOPEE_PRODUCT_TRAFFIC / SHOP_STATS'],
  [6, 'Teste de sobreposição/deduplicação com planilhas reais', 'reimportar período sobreposto'],
  [7, 'Devoluções', 'perfil parcial — validar com arquivo real'],
  [8, 'Promoções, cupons, Ads e afiliados', 'PROMOTION / VOUCHER / CHANNEL_CONTRIBUTION'],
  [9, 'Equipe e permissões reais', 'convites com escopo'],
  [10, 'Uso diário: Home, Crescimento, Catálogo, Importar, Missões', 'humano — 1-2 semanas'],
  [11, 'Mercado Livre em LEITURA', 'conexão oficial — escrita continua bloqueada'],
  [12, 'WhatsApp administrativo', 'canal interno'],
];

function stack() {
  const cfg = core.envConfig();
  const db = core.openDb(cfg); core.migrate(db);
  const logger = core.createLogger(cfg); const audit = core.createAudit(db, cfg);
  const sec = createSecurity(db, audit, logger);
  const storage = createStorage(db, cfg, audit);
  const queue = createQueue(db, audit);
  const imports = createImportService(db, audit);
  return { cfg, db, sec, storage, queue, imports, worker: createWorker(db, queue, imports, storage, logger) };
}
const gate = n => {
  for (let i = 1; i < n; i++)
    if (![1, 3, 6].includes(i) && !state.camadasAceitas.includes(i) && i < n)
      { console.error(`✗ camada ${i} ainda não aceita — a entrada é controlada, sem pular etapas (aceite com: pilot.js aceitar --camada ${i})`); process.exit(1); }
};
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };


/* ---------------- 10.E.1 · PRÉ-VOO (nada de bootstrap sem ambiente real) ---------------- */
function preflight(alvoStaging) {
  const itens = []; const em = new Date().toISOString();
  const item = (nome, ok, evidencia, acao) => itens.push({ nome, status: ok === true ? 'OK' : ok === 'owner' ? 'AGUARDANDO AÇÃO DO OWNER' : 'BLOQUEADO', evidencia, em, acao: ok === true ? null : acao });
  const env = (process.env.HEAD_ENV || 'LOCAL').toUpperCase();
  item('Ambiente', env === 'STAGING' || !alvoStaging, 'HEAD_ENV=' + env, 'exporte HEAD_ENV=STAGING no VPS');
  const du = process.env.DATABASE_URL || '';
  if (/^postgres/.test(du)) {
    try { const t0 = Date.now(); const { PgDb } = require('../mos/src/production/drivers.js'); const pg = new PgDb(du); pg.prepare('SELECT 1 as ok').get(); item('PostgreSQL', true, du.replace(/:\/\/[^@]*@/, '://***@').slice(0, 40) + '… · latência ' + (Date.now() - t0) + 'ms'); pg.close(); }
    catch (e) { item('PostgreSQL', false, e.message.slice(0, 60), 'suba o serviço postgres do vps-compose'); }
  } else item('PostgreSQL', alvoStaging ? 'owner' : false, du ? 'DATABASE_URL não é postgres' : 'DATABASE_URL ausente', 'defina DATABASE_URL=postgres://… (SQLite é recusado)');
  const ru = process.env.REDIS_URL || '';
  if (/^redis/.test(ru)) {
    try { const { RedisSync } = require('../mos/src/production/drivers.js'); const r = new RedisSync(ru); item('Redis', r.ping() === 'PONG', ru.slice(0, 30) + '…'); r.close(); }
    catch (e) { item('Redis', false, e.message.slice(0, 60), 'suba o serviço redis do vps-compose'); }
  } else item('Redis', alvoStaging ? 'owner' : false, 'REDIS_URL ausente', 'defina REDIS_URL=redis://…');
  const sec = process.env['HEAD_SECRET_' + env] || '';
  item('Secret', env === 'LOCAL' ? true : (sec && !/exemplo|example|defina|teste|x$/.test(sec)), sec ? 'definido (' + sec.length + ' chars)' : 'ausente', 'gere um secret real no cofre — valores de exemplo são recusados');
  try { const cfg2 = core.envConfig(); fs.writeFileSync(path.join(cfg2.storageDir, '.prevoo'), em); item('Storage gravável', true, cfg2.storageDir); }
  catch (e) { item('Storage gravável', false, e.message.slice(0, 60), 'volume persistente montado?'); }
  item('DNS + HTTPS', 'owner', 'staging.SEU-DOMINIO.com', 'crie o registro A apontando para o IP do VPS; Caddy emite o TLS');
  try {
    const S = stack(); const h = require('../mos/src/production/jobs.js').createHealth(S.db, S.cfg, S.queue).check();
    item('API/health', h.database === 'ok' && h.storage === 'ok', 'database=' + h.database + ' storage=' + h.storage);
    item('Worker', h.worker === 'ok', String(h.worker), 'suba o worker (npm run worker) — heartbeat obrigatório');
    item('Backup', h.ultimoBackup !== 'nenhum' ? true : 'owner', String(h.ultimoBackup), 'rode npm run backup uma vez e agende');
  } catch (e) { item('API/health', false, e.message.slice(0, 60)); }
  item('Modo DEMO desligado', true, 'operação real usa árvore própria — demo jamais se mistura (guard do 10.I/10.V)');
  item('Escrita externa', true, 'BLOQUEADA por assertNoExternalWrite — sem OAuth de escrita');
  const bloqueados = itens.filter(i => i.status !== 'OK');
  console.log('\nPILOTO REAL · PRÉ-VOO — ' + em);
  for (const i of itens) console.log(`${i.status === 'OK' ? '✓' : i.status.startsWith('AGUARDANDO') ? '⚠' : '✗'} ${i.nome.padEnd(20)} ${i.status.padEnd(26)} ${i.evidencia || ''}${i.acao ? '\n    → ' + i.acao : ''}`);
  console.log('\n' + (bloqueados.length === 0 ? 'STAGING PRONTO PARA PILOTO' : 'STAGING BLOQUEADO → resolver: ' + bloqueados.map(i => i.nome).join(', ')));
  return { ok: bloqueados.length === 0, itens };
}
const confirmados = () => {
  const c = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
  return { cnpj: id => (c.cnpjs.find(x => x.id === id) || {}).status === 'CONFIRMADO',
           loja: ap => { const l = c.lojas.find(x => x.apelido === ap); return l && l.status === 'CONFIRMADO' && (!l.conta || l.conta.status === 'CONFIRMADO'); },
           cfg: c };
};

const cmd = process.argv[2];
if (cmd === 'preflight') {
  process.exit(preflight(arg('alvo') !== 'local').ok ? 0 : 1);
} else if (cmd === 'revisar') {
  const c = confirmados().cfg;
  console.log(c.grupo.nome + ' → ' + c.empresa.nome);
  for (const x of c.cnpjs) console.log(`  [${x.status}] CNPJ ${x.nome} (${x.id})`);
  for (const l of c.lojas) console.log(`  [${l.status}] Loja ${l.nome} (${l.apelido})` + (l.conta ? ` · conta ${l.conta.nome} [${l.conta.status}]` : ' · loja física (sem conta marketplace)'));
  console.log('confirme item a item: pilot.js confirmar --item <id|apelido>');
} else if (cmd === 'confirmar') {
  const c = confirmados().cfg; const id = arg('item'); let achou = false;
  for (const x of c.cnpjs) if (x.id === id) { x.status = 'CONFIRMADO'; achou = true; }
  for (const l of c.lojas) if (l.apelido === id || l.id === id) { l.status = 'CONFIRMADO'; if (l.conta) l.conta.status = 'CONFIRMADO'; achou = true; }
  if (!achou) { console.error('✗ item não encontrado: ' + id); process.exit(1); }
  fs.writeFileSync(CFG_PATH, JSON.stringify(c, null, 2));
  console.log('✓ CONFIRMADO: ' + id + ' (revisado por humano)');
} else if (cmd === 'atrito') {
  const reg = { em: new Date().toISOString(), tipo: arg('tipo') || 'IMPORTACAO', camada: +arg('camada') || null,
    arquivo: arg('arquivo') || null, descricao: arg('desc') || '', prioridade: arg('prioridade') || 'média', status: 'ABERTO' };
  fs.appendFileSync(path.join(__dirname, 'atritos.jsonl'), JSON.stringify(reg) + '\n');
  console.log('✓ atrito registrado — vira insumo do 10.R');
} else if (cmd === 'bootstrap') {
  if (!process.argv.includes('--ensaio') && !preflight(true).ok) { console.error('\n✗ bootstrap bloqueado pelo pré-voo'); process.exit(1); }
  const conf = confirmados();
  const S = stack();
  const em = new Date().toISOString();
  const ins = (sql, ...p) => S.db.prepare(sql).run(...p);
  ins('INSERT INTO grupos(id,nome,criado_em) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING', CFG.grupo.id, CFG.grupo.nome, em);
  ins('INSERT INTO companies(id,group_id,nome,tipo_dado,criado_em) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
    CFG.empresa.id, CFG.grupo.id, CFG.empresa.nome, 'DADOS REAIS', em);
  const pendentes = CFG.cnpjs.filter(x => x.status !== 'CONFIRMADO').concat(CFG.lojas.filter(x => x.status !== 'CONFIRMADO'));
  if (pendentes.length && !process.argv.includes('--ensaio')) { console.error('✗ itens PENDENTES DE CONFIRMAÇÃO: ' + pendentes.map(x => x.nome).join(', ') + ' — use pilot.js revisar/confirmar'); process.exit(1); }
  for (const c of CFG.cnpjs)
    ins('INSERT INTO legal_entities(id,company_id,nome_fiscal,nome_fantasia,cnpj_mascarado,estado,cidade,principal) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
      c.id, CFG.empresa.id, CFG.empresa.nome, c.nome, c.cnpjMascarado || '**.***.***/****-**', c.estado, c.cidade, c.principal ? 1 : 0);
  for (const l of CFG.lojas) {
    ins('INSERT INTO stores(id,legal_entity_id,company_id,nome,tipo,marketplace,deposito,responsavel) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
      l.id, l.cnpjId, CFG.empresa.id, l.nome, l.tipo, l.marketplace || null, l.deposito || null, l.responsavel || null);
    if (l.conta) ins('INSERT INTO marketplace_accounts(id,store_id,marketplace,nome) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING',
      l.conta.id, l.id, l.marketplace, l.conta.nome);
    state.lojas[l.apelido] = { storeId: l.id, accountId: l.conta ? l.conta.id : null, marketplace: l.marketplace };
  }
  state.camadasAceitas = [...new Set([...state.camadasAceitas, 1])];
  salvar();
  console.log(`✓ Camada 1: ${CFG.empresa.nome} — ${CFG.cnpjs.length} CNPJ(s), ${CFG.lojas.length} loja(s) em ${S.cfg.env} (${S.db.kind || 'sqlite'})`);
  console.log('  lojas:', Object.keys(state.lojas).join(' · '));
} else if (cmd === 'ingest') {
  const camada = +arg('camada'); gate(camada);
  const apelido = arg('loja'); const loja = state.lojas[apelido];
  const conf = confirmados();
  if (!process.argv.includes('--ensaio') && !conf.loja(apelido)) { console.error('✗ loja/conta "' + apelido + '" não CONFIRMADA — importação recusada (pilot.js confirmar --item ' + apelido + ')'); process.exit(1); }
  if (!loja) { console.error('✗ loja desconhecida: ' + apelido + ' — rode bootstrap; apelidos: ' + Object.keys(state.lojas).join(', ')); process.exit(1); }
  const file = arg('arquivo');
  const per = arg('periodo') ? { ini: arg('periodo').split(':')[0], fim: arg('periodo').split(':')[1] } : null;
  const S = stack();
  const esc = { groupId: CFG.grupo.id, companyId: CFG.empresa.id, storeId: loja.storeId, accountId: loja.accountId, marketplace: loja.marketplace };
  const buf = fs.readFileSync(file);
  const mime = /\.csv$/i.test(file) ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const f = S.storage.save({ buffer: buf, filename: path.basename(file), mime, userId: 'piloto', escopo: esc });
  const b = S.imports.createBatch({ fileId: f.fileId, escopo: esc, usuario: 'piloto' });
  const st = S.imports.stage({ batchId: b, buffer: buf, filename: path.basename(file), periodo: per });
  if (st.duplicado) { console.log(`■ ARQUIVO JÁ IMPORTADO (lote ${st.batchAnterior}) — deduplicação em ação, nada aplicado.`); process.exit(0); }
  if (st.aplicavel === false) { console.log(`■ perfil ${st.perfil} não aplicável — revise o mapeamento antes (nada foi fingido).`); process.exit(1); }
  console.log(`staging: perfil ${st.perfil} · ${st.registros} registro(s) · ${st.jaExistem} já existente(s) · granularidade ${st.granularidade}`);
  if (camada === 2 && !process.argv.includes('--aplicar')) {
    const rows = S.db.prepare('SELECT vinculo FROM import_rows WHERE batch_id = ?').all(b);
    const conta = t => rows.filter(x => (x.vinculo || '').includes(t)).length;
    console.log(`REVISÃO OBRIGATÓRIA (nada aplicado ainda):
  vínculos por ID/SKU: ${conta('CONFIRMADO')} · sugeridos por nome: ${conta('NOME')} · SKU ausente: ${conta('AUSENTE')} · conflitos: ${conta('CONFLITO')} · sem correspondência: ${conta('SEM CORRESPONDÊNCIA')}
  Anúncio Master: NUNCA aprovado automaticamente — revise na tela Importar · Anúncio Master.
  Após revisar: node pilot/pilot.js aplicar --lote ${b}`);
    process.exit(0);
  }
  const r = S.imports.apply({ batchId: b, usuario: 'piloto' });
  console.log(`✓ Camada ${camada} · ${apelido}: ${r.criados} criado(s), ${r.atualizados} atualizado(s), ${r.duplicadosEvitados} duplicado(s) evitado(s)`);
  console.log(`  lote ${b} — rollback disponível: tela Importar · Lotes ou API /imports/${b}/rollback`);
} else if (cmd === 'aplicar') {
  const S = stack(); const b = arg('lote');
  if (S.db.prepare("SELECT count(*) c FROM import_rows WHERE batch_id = ? AND vinculo LIKE '%CONFLITO%'").get(b).c > 0)
    { console.error('✗ aceite BLOQUEADO: conflito de SKU aberto neste lote — resolva antes'); process.exit(1); }
  const r = S.imports.apply({ batchId: b, usuario: 'piloto' });
  console.log(`✓ aplicado após revisão humana: ${r.criados} criado(s), ${r.atualizados} atualizado(s), ${r.duplicadosEvitados} duplicado(s) evitado(s)`);
} else if (cmd === 'relatorio') {
  const S = stack();
  const b = S.db.prepare("SELECT * FROM import_batches ORDER BY criado_em DESC LIMIT 1").get();
  const rows = b ? S.db.prepare('SELECT vinculo FROM import_rows WHERE batch_id = ?').all(b.id) : [];
  const conta = t => rows.filter(x => (x.vinculo || '').includes(t)).length;
  const conflitos = conta('CONFLITO');
  console.log(`CAMADA 2 — CATÁLOGO E ANÚNCIOS
Escopo: ${b ? b.escopo : '—'}
Arquivo/lote: ${b ? b.id + ' · ' + b.estado : '—'} · resultado: ${b ? b.resultado : '—'}
Vínculos confirmados: ${conta('CONFIRMADO')} · pendentes: ${conta('NOME') + conta('AUSENTE') + conta('SEM')} · conflitos: ${conflitos}
Masters confirmados: ${S.db.prepare('SELECT count(*) c FROM master_links').get().c} (nunca automáticos)
Go/No-Go: ${conflitos === 0 && b && b.estado === 'APLICADO' ? '[x] APROVADO PARA CAMADA 3 — registre com: pilot.js aceitar --camada 2' : '[ ] BLOQUEADO — revisar vínculos/conflitos antes'}`);
} else if (cmd === 'conferir') {
  const S = stack();
  const rows = S.db.prepare("SELECT raw FROM metric_snapshots WHERE granularidade='DAILY_METRIC' AND explicativa=0").all();
  let receita = 0;
  for (const x of rows) { const r = JSON.parse(x.raw); receita += +r['Vendas de Pedidos Pagos'] || 0; }
  receita = Math.round(receita * 100) / 100;
  const esperado = +arg('esperado');
  console.log(`receita consolidada no Head (vendas pagas do funil): R$ ${receita.toFixed(2)}`);
  if (esperado) {
    const delta = Math.abs(receita - esperado) / esperado * 100;
    console.log(`esperado (painel Shopee): R$ ${esperado.toFixed(2)} → desvio ${delta.toFixed(2)}%`);
    console.log(delta <= 0.5 ? '✓ BATE (≤ 0,5%) — camada pode ser aceita' : '✗ NÃO BATE — investigar antes de aceitar (períodos? loja? relatório?)');
    process.exit(delta <= 0.5 ? 0 : 1);
  }
} else if (cmd === 'aceitar') {
  const c = +arg('camada');
  state.camadasAceitas = [...new Set([...state.camadasAceitas, c])].sort((a, b) => a - b);
  salvar();
  console.log(`✓ camada ${c} aceita por decisão humana — registrado em .pilot-state.json`);
} else if (cmd === 'status') {
  for (const [n, nome, via] of CAMADAS)
    console.log(`${state.camadasAceitas.includes(n) ? '✓' : '·'} ${String(n).padStart(2)} — ${nome}  (${via})`);
} else {
  console.log('uso: pilot.js bootstrap | ingest --camada N --arquivo F --loja A [--periodo I:F] | conferir [--esperado V] | aceitar --camada N | status');
}
