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

const cmd = process.argv[2];
if (cmd === 'bootstrap') {
  const S = stack();
  const em = new Date().toISOString();
  const ins = (sql, ...p) => S.db.prepare(sql).run(...p);
  ins('INSERT INTO grupos(id,nome,criado_em) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING', CFG.grupo.id, CFG.grupo.nome, em);
  ins('INSERT INTO companies(id,group_id,nome,tipo_dado,criado_em) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
    CFG.empresa.id, CFG.grupo.id, CFG.empresa.nome, 'DADOS REAIS', em);
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
  const r = S.imports.apply({ batchId: b, usuario: 'piloto' });
  console.log(`✓ Camada ${camada} · ${apelido}: ${r.criados} criado(s), ${r.atualizados} atualizado(s), ${r.duplicadosEvitados} duplicado(s) evitado(s)`);
  console.log(`  lote ${b} — rollback disponível: tela Importar · Lotes ou API /imports/${b}/rollback`);
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
