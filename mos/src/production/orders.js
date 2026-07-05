/* =============================================================
   PEDIDOS — serviço oficial no Postgres (10.F.2)
   Importa pedidos reais, resolve identidade dos itens, calcula expectativa
   e rentabilidade, e CRUZA com a carteira: ao importar um pedido, cria/atualiza
   o financial_reconciliation_case e re-concilia — tirando os casos de
   RECEBIDO_SEM_CONFERENCIA quando o pedido correspondente chega.
   Carteira = verdade; pedido + regra = expectativa. Reusa V8PED + reconciliação.
   ============================================================= */
'use strict';
const crypto = require('node:crypto');
const V8PED = require('../../../design/prototipo-v8/pedidos-engine.js');
const { createReconciliation } = require('./reconciliation.js');

const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
const nowIso = () => new Date().toISOString();
const r2 = n => n == null ? null : Math.round(n * 100) / 100;

function createOrders(db) {
  const recon = createReconciliation(db);

  /* IDENTIDADE ESTÁVEL — nunca inclui status/valor/datas (campos mutáveis) */
  const orderKey = o => ['ord', o.marketplace || '-', o.marketplace_account_id || '-', o.external_order_id].join('|');
  const itemKey = (o, it, i) => ['oi', o.marketplace || '-', o.marketplace_account_id || '-', o.external_order_id,
    it.external_listing_id || it.external_variation_id || it.seller_sku || ('idx' + i)].join('|');

  function parseOrdersReport(rows2d, ctx) { return V8PED.parseOrders(rows2d, ctx); }

  /* importa pedidos (upsert idempotente, update-only, RAW preservado) */
  function importOrders(input) {
    const esc = input.escopo || {};
    const orders = input.orders || [];
    const ts = nowIso();
    let insertedO = 0, updatedO = 0, insertedI = 0, updatedI = 0, review = 0;
    for (const o of orders) {
      const ok = orderKey(o);
      const oid = 'ord_' + hash(ok);
      const exp = V8PED.expectativaFinanceira(o, (input.taxas && input.taxas[o.marketplace]) || input.taxas || {});
      const existing = db.prepare('SELECT internal_order_id, audit_version FROM orders WHERE dedup_key = ?').get(ok);
      if (!existing) {
        db.prepare(`INSERT INTO orders(internal_order_id, company_id, marketplace, marketplace_account_id, external_order_id,
          order_status, order_created_at, paid_at, delivered_at, buyer_city, buyer_state, buyer_shipping_paid,
          gross_products_value, currency, expected_net_value, source, source_file, source_sheet, source_row,
          raw_payload, normalized_payload, dedup_key, audit_version, created_at, updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          oid, esc.company_id || o.company_id || null, o.marketplace, esc.marketplace_account_id || o.marketplace_account_id || null,
          o.external_order_id, o.order_status, o.order_created_at, o.paid_at, o.delivered_at, o.buyer_city, o.buyer_state,
          r2(o.buyer_shipping_paid), r2(o.gross_products_value), o.currency || 'BRL', exp.expected_net_value,
          'IMPORT', o.source_file, o.source_sheet, o.source_first_row, JSON.stringify(o.raw_rows || null), JSON.stringify(o),
          ok, 1, ts, ts);
        insertedO++;
      } else {
        /* atualiza SÓ o que mudou; nunca apaga campo antigo ausente na nova planilha */
        db.prepare(`UPDATE orders SET order_status = COALESCE(?, order_status), paid_at = COALESCE(?, paid_at),
          delivered_at = COALESCE(?, delivered_at), gross_products_value = COALESCE(?, gross_products_value),
          expected_net_value = COALESCE(?, expected_net_value), normalized_payload = ?, audit_version = ?, updated_at = ?
          WHERE dedup_key = ?`).run(o.order_status || null, o.paid_at || null, o.delivered_at || null,
          o.gross_products_value != null ? r2(o.gross_products_value) : null, exp.expected_net_value, JSON.stringify(o),
          (existing.audit_version || 0) + 1, ts, ok);
        updatedO++;
      }
      /* itens */
      (o.items || []).forEach((it, i) => {
        const ik = itemKey(o, it, i);
        const iid = 'oi_' + hash(ik);
        const ident = V8PED.identidadeItem(it, input.catalogoIndex);
        if (ident.needs_review) review++;
        const ie = db.prepare('SELECT order_item_id FROM order_item WHERE dedup_key = ?').get(ik);
        if (!ie) {
          db.prepare(`INSERT INTO order_item(order_item_id, internal_order_id, company_id, marketplace, marketplace_account_id,
            external_order_id, external_listing_id, external_variation_id, seller_sku, gtin_ean, product_name_original,
            quantity, unit_price, gross_item_value, product_master_id, identity_confidence, identity_origin, needs_review,
            source, raw_payload, dedup_key, created_at, updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
            iid, oid, esc.company_id || null, o.marketplace, esc.marketplace_account_id || null, o.external_order_id,
            it.external_listing_id, it.external_variation_id, it.seller_sku, it.gtin_ean, it.product_name_original,
            r2(it.quantity), r2(it.unit_price), r2(it.gross_item_value), ident.product_master_id, ident.identity_confidence,
            ident.identity_origin, ident.needs_review ? 1 : 0, 'IMPORT', JSON.stringify(it.raw || null), ik, ts, ts);
          insertedI++;
        } else {
          db.prepare('UPDATE order_item SET quantity = COALESCE(?, quantity), gross_item_value = COALESCE(?, gross_item_value), identity_origin = ?, identity_confidence = ?, needs_review = ?, updated_at = ? WHERE dedup_key = ?')
            .run(it.quantity != null ? r2(it.quantity) : null, it.gross_item_value != null ? r2(it.gross_item_value) : null, ident.identity_origin, ident.identity_confidence, ident.needs_review ? 1 : 0, ts, ik);
          updatedI++;
        }
      });
      /* evento */
      db.prepare('INSERT INTO order_event(event_id, internal_order_id, event_type, new_status, occurred_at, source, actor_type, actor_id, metadata, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run('oe_' + hash(oid + ts + (insertedO + updatedO)), oid, existing ? 'ORDER_UPDATED' : 'ORDER_IMPORTED', o.order_status || null, ts, 'import', 'system', 'orders', JSON.stringify({ file: o.source_file }), ts);
    }
    /* semeia a expectativa nos casos de conciliação e re-concilia */
    recon.importOrders({ escopo: esc, orders: orders.map(o => ({
      external_order_id: o.external_order_id, marketplace: o.marketplace, marketplace_account_id: esc.marketplace_account_id || o.marketplace_account_id,
      internal_order_id: 'ord_' + hash(orderKey(o)), gross_order_value: r2(o.gross_products_value),
      expected_net_value: V8PED.expectativaFinanceira(o, input.taxas || {}).expected_net_value,
      paid_at: o.paid_at, delivered_at: o.delivered_at })) });
    const rr = recon.run({ escopo: esc, now: input.now });
    return { insertedOrders: insertedO, updatedOrders: updatedO, insertedItems: insertedI, updatedItems: updatedI, needsReview: review, reconciliation: rr };
  }

  /* ---------- leituras (a tela consome a API) ---------- */
  const scopeWhere = esc => {
    const cond = ['1=1'], args = [];
    if (esc.company_id) { cond.push('company_id = ?'); args.push(esc.company_id); }
    if (esc.marketplace) { cond.push('marketplace = ?'); args.push(esc.marketplace); }
    if (esc.marketplace_account_id) { cond.push('marketplace_account_id = ?'); args.push(esc.marketplace_account_id); }
    return { where: cond.join(' AND '), args };
  };
  function list(esc, filtro) {
    const { where, args } = scopeWhere(esc); let sql = `SELECT * FROM orders WHERE ${where}`; const a = args.slice();
    if (filtro && filtro.status) { sql += ' AND order_status = ?'; a.push(filtro.status); }
    if (filtro && filtro.order) { sql += ' AND external_order_id = ?'; a.push(filtro.order); }
    /* busca por SKU/Item ID/Variation ID via itens */
    if (filtro && (filtro.sku || filtro.item_id || filtro.variation_id)) {
      const col = filtro.item_id ? 'external_listing_id' : filtro.variation_id ? 'external_variation_id' : 'seller_sku';
      const v = filtro.item_id || filtro.variation_id || filtro.sku;
      sql += ` AND external_order_id IN (SELECT external_order_id FROM order_item WHERE ${col} = ?)`; a.push(String(v));
    }
    sql += ' ORDER BY order_created_at DESC';
    return db.prepare(sql).all(...a);
  }
  function items(externalOrderId) { return db.prepare('SELECT * FROM order_item WHERE external_order_id = ? ORDER BY seller_sku').all(externalOrderId); }
  function events(internalOrderId) { return db.prepare('SELECT * FROM order_event WHERE internal_order_id = ? ORDER BY occurred_at').all(internalOrderId); }
  function byId(id) {
    const o = db.prepare('SELECT * FROM orders WHERE internal_order_id = ? OR external_order_id = ?').get(id, id);
    if (!o) return null;
    return Object.assign({}, o, { items: items(o.external_order_id), events: events(o.internal_order_id) });
  }
  /* identidade financeira do pedido: expectativa (pedido) × confirmado (carteira/caso) */
  function financialIdentity(id) {
    const o = db.prepare('SELECT * FROM orders WHERE internal_order_id = ? OR external_order_id = ?').get(id, id);
    if (!o) return null;
    const rid = 'rc_' + hash([o.marketplace, o.marketplace_account_id, o.external_order_id].join('|'));
    const caso = recon.caseById(rid);
    return {
      external_order_id: o.external_order_id, gross_products_value: o.gross_products_value,
      expected_net_value: o.expected_net_value,
      received_net_value: caso ? caso.received_net_value : 0,
      difference_value: caso ? caso.difference_value : null,
      reconciliation_status: caso ? caso.reconciliation_status : 'SEM_CASO',
      movimentos: caso ? caso.movimentos : [], eventos: caso ? caso.eventos : [],
      nota: 'valor esperado vem do pedido + regra; valor recebido vem da carteira (verdade).',
    };
  }
  function reconciliation(id) { return financialIdentity(id); }
  function itemScope(esc) {
    const cond = ['1=1'], args = [];
    if (esc.company_id) { cond.push('company_id = ?'); args.push(esc.company_id); }
    if (esc.marketplace) { cond.push('marketplace = ?'); args.push(esc.marketplace); }
    return { where: cond.join(' AND '), args };
  }
  function profitability(esc, custosPorSku) {
    const s = itemScope(esc);
    const rows = db.prepare(`SELECT * FROM order_item WHERE ${s.where}`).all(...s.args);
    return rows.map(it => {
      const custos = (custosPorSku && custosPorSku[it.seller_sku]) || {};
      const rent = V8PED.rentabilidadeItem(it, custos);
      return { external_order_id: it.external_order_id, seller_sku: it.seller_sku, quantity: it.quantity,
        gross_item_value: it.gross_item_value, classe: rent.classe, margemContribuicaoPct: rent.margemContribuicaoPct != null ? rent.margemContribuicaoPct : null,
        identity_origin: it.identity_origin, needs_review: it.needs_review };
    });
  }
  function summary(esc) {
    const rows = list(esc);
    const st = s => rows.filter(o => new RegExp(s, 'i').test(o.order_status || ''));
    const soma = (rs, f) => r2(rs.reduce((x, o) => x + (o[f] || 0), 0));
    const s = itemScope(esc);
    const itens = db.prepare(`SELECT count(*) c FROM order_item WHERE ${s.where}`).get(...s.args);
    const review = db.prepare(`SELECT count(*) c FROM order_item WHERE needs_review = 1 AND ${s.where}`).get(...s.args);
    return {
      qtdPedidos: rows.length, qtdItens: Number(itens.c), qtdItensRevisao: Number(review.c),
      totalVendidoBruto: soma(rows, 'gross_products_value'), totalEsperado: soma(rows, 'expected_net_value'),
      cancelados: st('cancel').length, devolvidos: st('devolv|return').length, concluidos: st('conclu|complete').length,
      fonte: 'POSTGRES', gerado_em: nowIso(),
    };
  }
  function unreconciled(esc) {
    return recon.cases(esc, { status: 'RECEBIDO_SEM_CONFERENCIA' });
  }

  return { parseOrdersReport, importOrders, list, items, events, byId, financialIdentity, reconciliation, profitability, summary, unreconciled };
}

module.exports = { createOrders };
