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
    return this;
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
