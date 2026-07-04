/* Infra · Database — node:sqlite (zero dependências).
   Um único ponto de acesso: migração, transações e prepared statements
   com cache. Repositórios NUNCA montam SQL de string de usuário. */
'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

class Database {
  constructor(file = ':memory:') {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA foreign_keys = ON');
    this._stmts = new Map();
  }
  migrate() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    this.db.exec(schema);
    /* Central de Marketplace (Sprint 09) — tabelas novas, tudo aditivo */
    const central = fs.readFileSync(path.join(__dirname, 'schema-central.sql'), 'utf8');
    this.db.exec(central);
    /* Catalog & Compliance (Sprint 10) — aditivo, lacunas reais apenas */
    const compliance = fs.readFileSync(path.join(__dirname, 'schema-compliance.sql'), 'utf8');
    this.db.exec(compliance);
    /* Conexões reais e piloto (Sprint 10.A) — aditivo */
    const live = fs.readFileSync(path.join(__dirname, 'schema-live.sql'), 'utf8');
    this.db.exec(live);
    /* Crescimento (Sprint 10.B) — leads, afiliados, promoções, jobs */
    const growth = fs.readFileSync(path.join(__dirname, 'schema-growth.sql'), 'utf8');
    this.db.exec(growth);
    this._addColumns('marketplace_connection', {
      account_id: 'TEXT', store_id: 'TEXT',
      auth_type: 'TEXT', read_only: 'INTEGER NOT NULL DEFAULT 1',
      connected_at: 'TEXT', revoked_at: 'TEXT',
    });
    /* proveniência por campo: MANUAL | IA | IMPORTACAO | MARKETPLACE_SYNC |
       WHATSAPP_COMMAND | SISTEMA — sync nunca apaga edição manual em silêncio */
    this._addColumns('product_profile', { field_sources_json: 'TEXT' });
    return this;
  }
  /* migração aditiva de colunas: só ALTER quando a coluna não existe */
  _addColumns(table, columns) {
    const existing = new Set(this.db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
    for (const [name, def] of Object.entries(columns))
      if (!existing.has(name)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
  }
  prepare(sql) {
    if (!this._stmts.has(sql)) this._stmts.set(sql, this.db.prepare(sql));
    return this._stmts.get(sql);
  }
  run(sql, ...params) { return this.prepare(sql).run(...params); }
  get(sql, ...params) { return this.prepare(sql).get(...params); }
  all(sql, ...params) { return this.prepare(sql).all(...params); }
  /* transação síncrona — essencial para lotes de milhares de anúncios */
  tx(fn) {
    this.db.exec('BEGIN');
    try { const r = fn(); this.db.exec('COMMIT'); return r; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  close() { this.db.close(); }
}

module.exports = { Database };
