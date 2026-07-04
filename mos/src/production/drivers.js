/* =============================================================
   HARDENING (10.D.1) · drivers reais
   PgDb: PostgreSQL de verdade atrás da MESMA interface prepare/run/
   get/all usada por todo o código (ponte síncrona via worker_threads
   + Atomics — o pool `pg` vive num worker; o main thread espera o
   resultado de forma síncrona). RedisSync: comandos Redis síncronos
   pela mesma ponte — fila distribuída, locks e heartbeat.
   LOCAL pode usar SQLite; STAGING/PRODUCTION exigem Postgres+Redis.
   ============================================================= */
'use strict';
const { Worker, MessageChannel, receiveMessageOnPort } = require('node:worker_threads');
const path = require('node:path');

const WORKER_SRC = `
const { workerData } = require('node:worker_threads');
const { createRequire } = require('node:module');
const req = createRequire(workerData.baseDir + '/package.json');
const port = workerData.port, sig = new Int32Array(workerData.sig);
let impl;
(async () => {
  if (workerData.kind === 'pg') {
    const { Pool } = req('pg');
    const pool = new Pool({ connectionString: workerData.url, max: 4 });
    impl = {
      query: async (sql, params) => { const r = await pool.query({ text: sql, values: params || [] }); return { rows: r.rows, rowCount: r.rowCount }; },
      exec: async (sql) => { await pool.query(sql); return { ok: true }; },
      end: async () => { await pool.end(); return { ok: true }; },
    };
  } else {
    const Redis = req('ioredis');
    const redis = new Redis(workerData.url, { lazyConnect: false, maxRetriesPerRequest: 2 });
    impl = {
      cmd: async (args) => redis.call(...args),
      end: async () => { redis.disconnect(); return { ok: true }; },
    };
  }
  port.on('message', async ({ method, args }) => {
    let out;
    try { out = { val: await impl[method](...args) }; }
    catch (e) { out = { err: e.message }; }
    port.postMessage(out);
    Atomics.store(sig, 0, 1); Atomics.notify(sig, 0);
  });
  port.postMessage({ ready: true });
  Atomics.store(sig, 0, 1); Atomics.notify(sig, 0);
})();
`;

function createBridge(kind, url) {
  const sab = new SharedArrayBuffer(4);
  const sig = new Int32Array(sab);
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(WORKER_SRC, {
    eval: true, workerData: { kind, url, sig: sab, port: port2, baseDir: path.join(__dirname, '../../..') },
    transferList: [port2],
  });
  worker.unref();
  const waitMsg = timeoutMs => {
    const r = Atomics.wait(sig, 0, 0, timeoutMs || 15000);
    Atomics.store(sig, 0, 0);
    if (r === 'timed-out') throw new Error(kind + ': tempo esgotado aguardando o driver');
    const m = receiveMessageOnPort(port1);
    if (!m) throw new Error(kind + ': resposta perdida do driver');
    return m.message;
  };
  const boot = waitMsg(20000);
  if (boot.err) throw new Error(kind + ' indisponível: ' + boot.err);
  return {
    call(method, ...args) {
      Atomics.store(sig, 0, 0);
      port1.postMessage({ method, args });
      const m = waitMsg();
      if (m.err) { const e = new Error(m.err); e.driver = kind; throw e; }
      return m.val;
    },
    close() { try { port1.postMessage({ method: 'end', args: [] }); } catch (e) { /* já fechado */ } worker.terminate(); },
  };
}

/* ---------------- PostgreSQL com a interface do node:sqlite ---------------- */
const toPg = sql => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };
const DDL_FIX = sql => sql
  .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'BIGSERIAL PRIMARY KEY')
  .replace(/PRAGMA[^;]*;/g, '');

class PgDb {
  constructor(url) { this.kind = 'postgres'; this.url = url; this.bridge = createBridge('pg', url); }
  exec(sql) { this.bridge.call('exec', DDL_FIX(sql)); }
  prepare(sql) {
    const text = toPg(sql);
    const b = this.bridge;
    return {
      run: (...p) => { const r = b.call('query', text, p); return { changes: r.rowCount }; },
      get: (...p) => b.call('query', text, p).rows[0],
      all: (...p) => b.call('query', text, p).rows,
    };
  }
  close() { this.bridge.close(); }
}

/* ---------------- Redis síncrono: fila distribuída + locks ---------------- */
class RedisSync {
  constructor(url) { this.kind = 'redis'; this.bridge = createBridge('redis', url); }
  cmd(...args) { return this.bridge.call('cmd', args.map(String)); }
  ping() { return this.cmd('PING'); }
  close() { this.bridge.close(); }
}

/* fila: Redis ordena e coordena; o banco continua o registro auditável */
function createRedisQueueDriver(redis, ns) {
  ns = ns || 'head';
  const Q = ns + ':queue', P = ns + ':processing';
  return {
    kind: 'redis',
    push(jobId) { redis.cmd('LPUSH', Q, jobId); },
    /* atômico entre N workers: LMOVE tira da fila e guarda em processing */
    pop() { return redis.cmd('LMOVE', Q, P, 'RIGHT', 'LEFT'); },
    ack(jobId) { redis.cmd('LREM', P, '0', jobId); },
    depth() { return +redis.cmd('LLEN', Q) + +redis.cmd('LLEN', P); },
    heartbeat(workerId) { redis.cmd('SET', ns + ':worker:' + workerId, new Date().toISOString(), 'EX', '180'); },
    workerAlive(workerId) { return !!redis.cmd('GET', ns + ':worker:' + workerId); },
    /* lock distribuído com dono e expiração — nunca bloqueia para sempre */
    acquireLock(key, owner, ttlMs) {
      return redis.cmd('SET', ns + ':lock:' + key, owner, 'NX', 'PX', String(ttlMs || 60000)) === 'OK';
    },
    releaseLock(key, owner) {
      const cur = redis.cmd('GET', ns + ':lock:' + key);
      if (cur === owner) { redis.cmd('DEL', ns + ':lock:' + key); return true; }
      return false; /* lock de outro dono (ou expirado e re-adquirido) — não solta */
    },
    lockOwner(key) { return redis.cmd('GET', ns + ':lock:' + key); },
  };
}

/* fallback em banco (LOCAL): mesma interface, lock com expiração persistida */
function createDbLockDriver(db) {
  return {
    kind: 'database',
    acquireLock(key, owner, ttlMs) {
      const now = Date.now();
      db.prepare('DELETE FROM locks WHERE expires_at_ms < ?').run(now);
      try {
        db.prepare('INSERT INTO locks(chave, owner, expires_at_ms) VALUES(?,?,?)').run(key, owner, now + (ttlMs || 60000));
        return true;
      } catch (e) { return false; }
    },
    releaseLock(key, owner) {
      return db.prepare('DELETE FROM locks WHERE chave = ? AND owner = ?').run(key, owner).changes > 0;
    },
    lockOwner(key) {
      const r = db.prepare('SELECT owner FROM locks WHERE chave = ? AND expires_at_ms >= ?').get(key, Date.now());
      return r ? r.owner : null;
    },
  };
}

module.exports = { PgDb, RedisSync, createRedisQueueDriver, createDbLockDriver, toPg };
