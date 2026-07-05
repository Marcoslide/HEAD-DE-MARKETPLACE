/* =============================================================
   CONCILIAÇÃO FINANCEIRA — serviço oficial no Postgres (10.F.1 · Increment 2)
   Fonte oficial da conciliação. A tela consome a API; o cálculo de status
   vive AQUI, sobre o banco. Reaproveita o motor compartilhado V8CONC
   (normalização + classificação + regras) para não duplicar lógica.
   ============================================================= */
'use strict';
const crypto = require('node:crypto');
const V8CONC = require('../../../design/prototipo-v8/conciliacao-engine.js');

const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
const nowIso = () => new Date().toISOString();

/* localiza o cabeçalho real do relatório da carteira Shopee mesmo que haja
   linhas de preâmbulo (título, conta, resumo) antes dele. */
function localizarCabecalho(rows2d) {
  const alvo = V8CONC.SHOPEE_TX_HEADER;
  for (let i = 0; i < rows2d.length; i++) {
    const r = (rows2d[i] || []).map(c => String(c == null ? '' : c).trim());
    const bate = ['Data', 'Tipo de transação', 'ID do pedido', 'Valor'].every(h => r.includes(h));
    if (bate) return { headerRow: i, header: r };
  }
  return { headerRow: -1, header: alvo };
}

/* rows2d (matriz da planilha) → transações normalizadas V8CONC, com a linha
   de origem correta (offset pelo cabeçalho localizado). */
function parseWalletReport(rows2d, ctx) {
  const { headerRow, header } = localizarCabecalho(rows2d);
  if (headerRow < 0) return { transactions: [], headerRow, erro: 'cabeçalho "Detalhes da transação" não encontrado' };
  const dataRows = rows2d.slice(headerRow + 1).map(r => {
    const o = {}; header.forEach((h, i) => { o[h] = r[i]; }); return o;
  }).filter(o => o['Tipo de transação']);
  const transactions = V8CONC.normalizeShopeeWallet(dataRows, Object.assign({ baseRow: headerRow + 1 }, ctx));
  return { transactions, headerRow, headerLen: header.length };
}

function createReconciliation(db) {
  /* IDENTIDADE ESTÁVEL do movimento (para dedup/upsert): NÃO inclui valor nem
     status — são justamente os campos que podem mudar numa reimportação e devem
     ATUALIZAR a linha existente, não criar uma nova. A descrição entra por hash
     para separar movimentos distintos no mesmo segundo. */
  const dedupKey = t => ['ft', t.marketplace || '-', t.marketplace_account_id || '-', t.external_order_id || '-',
    t.transaction_subtype || '-', t.occurred_at || '-', t.direction, hash(t.descricao || '')].join('|');

  /* ---------- importação da carteira (dedup + upsert; nunca duplica nem apaga) ---------- */
  function importWallet(input) {
    const esc = input.escopo || {};
    const txns = input.transactions || [];
    let inserted = 0, updated = 0, unchanged = 0;
    const imported_at = nowIso();
    for (const t of txns) {
      const key = dedupKey(t);
      const id = 'ft_' + hash(key);
      const existing = db.prepare('SELECT financial_transaction_id, amount, status FROM financial_transaction WHERE dedup_key = ?').get(key);
      const norm = JSON.stringify(t);
      const raw = JSON.stringify(t.raw_payload || null);
      if (!existing) {
        db.prepare(`INSERT INTO financial_transaction(financial_transaction_id, company_id, marketplace, marketplace_account_id,
          external_order_id, transaction_type, transaction_subtype, direction, amount, currency, occurred_at, available_at,
          imported_at, source_file, source_sheet, source_row, raw_payload, normalized_payload, status, confidence, dedup_key, created_at, updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          id, esc.company_id || t.company_id || null, t.marketplace, esc.marketplace_account_id || t.marketplace_account_id || null,
          t.external_order_id, t.transaction_type, t.transaction_subtype, t.direction, t.amount, t.currency || 'BRL',
          t.occurred_at, t.available_at || null, imported_at, t.source_file || null, t.source_sheet || null, t.source_row || null,
          raw, norm, t.status || null, t.confidence || null, key, imported_at, imported_at);
        inserted++;
      } else if (existing.amount !== t.amount || existing.status !== (t.status || null)) {
        /* atualiza SOMENTE o que mudou; nunca apaga linha antiga */
        db.prepare('UPDATE financial_transaction SET amount = ?, status = ?, normalized_payload = ?, updated_at = ? WHERE dedup_key = ?')
          .run(t.amount, t.status || null, norm, imported_at, key);
        updated++;
      } else { unchanged++; }
    }
    return { inserted, updated, unchanged, total: txns.length };
  }

  /* ---------- importação de pedidos (semeia o caso com a expectativa) ---------- */
  function importOrders(input) {
    const esc = input.escopo || {};
    const orders = input.orders || [];
    let n = 0;
    for (const o of orders) {
      const mkt = o.marketplace || 'shopee', acc = o.marketplace_account_id || esc.marketplace_account_id;
      const rid = 'rc_' + hash([mkt, acc, o.external_order_id].join('|'));
      const exists = db.prepare('SELECT reconciliation_id FROM financial_reconciliation_case WHERE reconciliation_id = ?').get(rid);
      const ts = nowIso();
      if (!exists) {
        db.prepare(`INSERT INTO financial_reconciliation_case(reconciliation_id, company_id, marketplace, marketplace_account_id,
          internal_order_id, external_order_id, order_created_at, paid_at, delivered_at, reconciliation_status,
          gross_order_value, expected_net_value, received_net_value, audit_version, created_at, updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          rid, esc.company_id || null, mkt, acc, o.internal_order_id || null, o.external_order_id,
          o.order_created_at || null, o.paid_at || null, o.delivered_at || null, 'PENDENTE_DE_DADOS',
          o.gross_order_value != null ? o.gross_order_value : null, o.expected_net_value != null ? o.expected_net_value : null, 0, 0, ts, ts);
      } else {
        db.prepare('UPDATE financial_reconciliation_case SET gross_order_value = ?, expected_net_value = ?, paid_at = ?, delivered_at = ?, updated_at = ? WHERE reconciliation_id = ?')
          .run(o.gross_order_value != null ? o.gross_order_value : null, o.expected_net_value != null ? o.expected_net_value : null, o.paid_at || null, o.delivered_at || null, ts, rid);
      }
      n++;
    }
    return { orders: n };
  }

  function addRule(esc, r) {
    const id = r.rule_id || 'rule_' + hash([r.marketplace, r.marketplace_account_id, r.rule_name].join('|'));
    const ts = nowIso();
    const exists = db.prepare('SELECT rule_id FROM financial_reconciliation_rule WHERE rule_id = ?').get(id);
    if (exists) return id;
    db.prepare(`INSERT INTO financial_reconciliation_rule(rule_id, company_id, marketplace, marketplace_account_id, shipping_mode,
      rule_name, expected_release_days_min, expected_release_days_max, grace_days, priority, status, origin, created_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, esc.company_id || null, r.marketplace || null, r.marketplace_account_id || null, r.shipping_mode || null,
      r.rule_name, r.expected_release_days_min, r.expected_release_days_max, r.grace_days || 0, r.priority || 0,
      r.status || 'Ativo', r.origin || 'manual', ts, ts);
    return id;
  }

  function loadTxns(esc) {
    const cond = ['1=1'], args = [];
    if (esc.company_id) { cond.push('company_id = ?'); args.push(esc.company_id); }
    if (esc.marketplace) { cond.push('marketplace = ?'); args.push(esc.marketplace); }
    if (esc.marketplace_account_id) { cond.push('marketplace_account_id = ?'); args.push(esc.marketplace_account_id); }
    return db.prepare(`SELECT * FROM financial_transaction WHERE ${cond.join(' AND ')}`).all(...args)
      .map(r => Object.assign(JSON.parse(r.normalized_payload), { financial_transaction_id: r.financial_transaction_id }));
  }
  function loadRules(esc) {
    return db.prepare('SELECT * FROM financial_reconciliation_rule WHERE (company_id = ? OR company_id IS NULL)').all(esc.company_id || null)
      .map(r => ({ rule_id: r.rule_id, marketplace: r.marketplace, marketplace_account_id: r.marketplace_account_id,
        shipping_mode: r.shipping_mode, rule_name: r.rule_name, expected_release_days_min: r.expected_release_days_min,
        expected_release_days_max: r.expected_release_days_max, grace_days: r.grace_days, priority: r.priority, status: r.status }));
  }
  function loadOrders(esc) {
    const cond = ['expected_net_value IS NOT NULL OR gross_order_value IS NOT NULL'], args = [];
    let sql = 'SELECT * FROM financial_reconciliation_case WHERE (' + cond[0] + ')';
    if (esc.company_id) { sql += ' AND company_id = ?'; args.push(esc.company_id); }
    return db.prepare(sql).all(...args).map(r => ({
      external_order_id: r.external_order_id, marketplace: r.marketplace, marketplace_account_id: r.marketplace_account_id,
      internal_order_id: r.internal_order_id, order_created_at: r.order_created_at, paid_at: r.paid_at, delivered_at: r.delivered_at,
      gross_order_value: r.gross_order_value, expected_net_value: r.expected_net_value }));
  }

  /* ---------- roda a conciliação sobre o BANCO e persiste casos + eventos ---------- */
  function run(input) {
    const esc = input.escopo || {};
    const now = input.now || nowIso();
    const result = V8CONC.reconcile({ transactions: loadTxns(esc), orders: loadOrders(esc), rules: loadRules(esc), now, toleranciaCentavos: input.toleranciaCentavos });
    const ts = nowIso();
    let upserts = 0, eventos = 0;
    for (const c of result.cases) {
      const rid = 'rc_' + hash([c.marketplace, c.marketplace_account_id, c.external_order_id].join('|'));
      const prev = db.prepare('SELECT reconciliation_id, reconciliation_status, audit_version FROM financial_reconciliation_case WHERE reconciliation_id = ?').get(rid);
      const antigo = prev ? prev.reconciliation_status : null;
      if (!prev) {
        db.prepare(`INSERT INTO financial_reconciliation_case(reconciliation_id, company_id, marketplace, marketplace_account_id,
          internal_order_id, external_order_id, order_created_at, paid_at, delivered_at, expected_release_at,
          first_wallet_movement_at, last_wallet_movement_at, reconciliation_status, gross_order_value, expected_net_value,
          received_net_value, pending_net_value, difference_value, total_refund_value, total_adjustment_value, total_anticipation_value,
          confidence, source_coverage, audit_version, created_at, updated_at, reconciled_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          rid, esc.company_id || null, c.marketplace, c.marketplace_account_id, c.internal_order_id, c.external_order_id,
          c.order_created_at, c.paid_at, c.delivered_at, c.expected_release_at, c.first_wallet_movement_at, c.last_wallet_movement_at,
          c.reconciliation_status, c.gross_order_value, c.expected_net_value, c.received_net_value, c.pending_net_value, c.difference_value,
          c.total_refund_value, c.total_adjustment_value, c.total_anticipation_value, c.confidence, c.source_coverage, 1, ts, ts, ts);
      } else {
        db.prepare(`UPDATE financial_reconciliation_case SET reconciliation_status = ?, received_net_value = ?, pending_net_value = ?,
          difference_value = ?, total_refund_value = ?, total_adjustment_value = ?, total_anticipation_value = ?,
          first_wallet_movement_at = ?, last_wallet_movement_at = ?, expected_release_at = ?, source_coverage = ?, confidence = ?,
          audit_version = ?, updated_at = ?, reconciled_at = ? WHERE reconciliation_id = ?`).run(
          c.reconciliation_status, c.received_net_value, c.pending_net_value, c.difference_value, c.total_refund_value,
          c.total_adjustment_value, c.total_anticipation_value, c.first_wallet_movement_at, c.last_wallet_movement_at,
          c.expected_release_at, c.source_coverage, c.confidence, (prev.audit_version || 0) + 1, ts, ts, rid);
      }
      upserts++;
      if (antigo !== c.reconciliation_status) {
        db.prepare(`INSERT INTO financial_reconciliation_event(event_id, reconciliation_id, event_type, old_status, new_status,
          description, actor_type, actor_id, source, occurred_at, metadata) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
          'ev_' + hash(rid + ts + c.reconciliation_status + upserts), rid, antigo ? 'STATUS_CHANGE' : 'CASE_OPENED', antigo, c.reconciliation_status,
          `${c.reconciliation_status} · recebido ${c.received_net_value} · esperado ${c.expected_net_value == null ? '—' : c.expected_net_value}`,
          'system', 'reconciliation', 'run', ts, JSON.stringify({ source_coverage: c.source_coverage }));
        eventos++;
      }
      /* vincula os movimentos deste pedido ao caso (evita "? IS NULL" — Postgres não infere o tipo) */
      if (c.marketplace_account_id) {
        db.prepare('UPDATE financial_transaction SET reconciliation_id = ? WHERE external_order_id = ? AND marketplace = ? AND marketplace_account_id = ?')
          .run(rid, c.external_order_id, c.marketplace, c.marketplace_account_id);
      } else {
        db.prepare('UPDATE financial_transaction SET reconciliation_id = ? WHERE external_order_id = ? AND marketplace = ? AND marketplace_account_id IS NULL')
          .run(rid, c.external_order_id, c.marketplace);
      }
    }
    return { casos: upserts, eventos, movimentosSemPedido: result.movimentosSemPedido.length, tesouraria: result.tesouraria.length, resumo: result.resumo };
  }

  /* ---------- leituras (a tela consome estas) ---------- */
  const caseWhere = esc => {
    const cond = ['1=1'], args = [];
    if (esc.company_id) { cond.push('company_id = ?'); args.push(esc.company_id); }
    if (esc.marketplace) { cond.push('marketplace = ?'); args.push(esc.marketplace); }
    if (esc.marketplace_account_id) { cond.push('marketplace_account_id = ?'); args.push(esc.marketplace_account_id); }
    return { where: cond.join(' AND '), args };
  };
  function cases(esc, filtro) {
    const { where, args } = caseWhere(esc); let sql = `SELECT * FROM financial_reconciliation_case WHERE ${where}`;
    const a = args.slice();
    if (filtro && filtro.status) { sql += ' AND reconciliation_status = ?'; a.push(filtro.status); }
    if (filtro && filtro.order) { sql += ' AND external_order_id = ?'; a.push(filtro.order); }
    sql += ' ORDER BY updated_at DESC';
    return db.prepare(sql).all(...a);
  }
  function caseById(id) {
    const c = db.prepare('SELECT * FROM financial_reconciliation_case WHERE reconciliation_id = ?').get(id);
    if (!c) return null;
    const movimentos = db.prepare('SELECT * FROM financial_transaction WHERE reconciliation_id = ? ORDER BY occurred_at').all(id);
    const eventos = db.prepare('SELECT * FROM financial_reconciliation_event WHERE reconciliation_id = ? ORDER BY occurred_at').all(id);
    return Object.assign({}, c, { movimentos, eventos });
  }
  function movements(esc, filtro) {
    const { where, args } = (() => { const cond = ['1=1'], a = [];
      if (esc.company_id) { cond.push('company_id = ?'); a.push(esc.company_id); }
      if (esc.marketplace) { cond.push('marketplace = ?'); a.push(esc.marketplace); }
      return { where: cond.join(' AND '), args: a }; })();
    let sql = `SELECT * FROM financial_transaction WHERE ${where}`; const a = args.slice();
    if (filtro && filtro.type) { sql += ' AND transaction_type = ?'; a.push(filtro.type); }
    if (filtro && filtro.order) { sql += ' AND external_order_id = ?'; a.push(filtro.order); }
    if (filtro && filtro.semPedido) { sql += ' AND (external_order_id IS NULL)'; }
    sql += ' ORDER BY occurred_at DESC';
    return db.prepare(sql).all(...a);
  }
  function summary(esc) {
    const rows = cases(esc);
    const st = s => rows.filter(r => r.reconciliation_status === s);
    const soma = (rs, f) => Math.round(rs.reduce((x, r) => x + (r[f] || 0), 0) * 100) / 100;
    const mv = movements(esc);
    const somaTt = tt => Math.round(mv.filter(m => m.transaction_type === tt).reduce((x, m) => x + (m.amount || 0), 0) * 100) / 100;
    return {
      qtdCasos: rows.length,
      totalVendidoBruto: soma(rows, 'gross_order_value'),
      totalLiberadoCarteira: somaTt('SALE_RELEASE'),
      valorAguardandoLiberacao: soma(st('AGUARDANDO_LIBERACAO'), 'expected_net_value'),
      valorAtrasado: soma(st('SEM_MOVIMENTO_ENCONTRADO').concat(st('ATRASADO')), 'expected_net_value'),
      valorDivergente: Math.round(st('DIVERGENTE').reduce((x, r) => x + Math.abs(r.difference_value || 0), 0) * 100) / 100,
      valorReembolso: somaTt('REFUND'),
      totalAntecipacaoTaxa: somaTt('TAXA_ANTECIPACAO'),
      totalAntecipacaoResgate: somaTt('RESGATE_ANTECIPACAO'),
      qtdConciliados: st('CONCILIADO').length + st('COM_AJUSTE_POSTERIOR').length,
      qtdAguardando: st('AGUARDANDO_LIBERACAO').length,
      qtdAtrasados: st('SEM_MOVIMENTO_ENCONTRADO').length + st('ATRASADO').length,
      qtdDivergentes: st('DIVERGENTE').length,
      qtdParciais: st('RECEBIMENTO_PARCIAL').length,
      qtdRecebidoSemConferencia: st('RECEBIDO_SEM_CONFERENCIA').length,
      qtdMovimentosSemPedido: movements(esc, { semPedido: true }).filter(m => !V8CONC.TESOURARIA.has(m.transaction_type)).length,
      qtdTesouraria: mv.filter(m => V8CONC.TESOURARIA.has(m.transaction_type)).length,
      fonte: 'POSTGRES', gerado_em: nowIso(),
    };
  }
  function divergences(esc) { return cases(esc, { status: 'DIVERGENTE' }); }
  function projection(esc, now) {
    const rows = cases(esc);
    const result = { cases: rows.map(r => ({ reconciliation_status: r.reconciliation_status, expected_net_value: r.expected_net_value, expected_release_at: r.expected_release_at })) };
    return V8CONC.previsaoEntrada(result, now || nowIso());
  }

  return { parseWalletReport, localizarCabecalho, importWallet, importOrders, addRule, run,
    cases, caseById, movements, summary, divergences, projection };
}

module.exports = { createReconciliation, parseWalletReport, localizarCabecalho };
