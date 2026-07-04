/* Kernel · Queue — processamento assíncrono (Bloco 02).
   Fila em memória com a MESMA interface que uma fila real (SQS/BullMQ)
   terá no futuro: enqueue, worker com concorrência, retry com backoff,
   dead-letter. Trocar a implementação não toca nenhum consumidor. */
'use strict';

class Queue {
  constructor(name, { concurrency = 8, maxAttempts = 3, backoffMs = 10, logger = null } = {}) {
    this.name = name;
    this.concurrency = concurrency;
    this.maxAttempts = maxAttempts;
    this.backoffMs = backoffMs;
    this.logger = logger;
    this.pending = [];
    this.active = 0;
    this.retryScheduled = 0; // jobs aguardando backoff — contam como "na fila"
    this.deadLetter = [];
    this.processed = 0;
    this.handler = null;
    this._idleResolvers = [];
    this._seq = 0;
  }

  process(handler) { this.handler = handler; this._drain(); }

  enqueue(type, data, opts = {}) {
    const job = { id: `${this.name}:${++this._seq}`, type, data,
                  attempts: 0, maxAttempts: opts.maxAttempts ?? this.maxAttempts, enqueuedAt: Date.now() };
    this.pending.push(job);
    this._drain();
    return job.id;
  }
  enqueueBulk(jobs) { return jobs.map(j => this.enqueue(j.type, j.data, j.opts || {})); }

  size() { return this.pending.length + this.active + this.retryScheduled; }

  /* aguarda a fila esvaziar — essencial para testes e para o shutdown limpo */
  onIdle() {
    if (this.size() === 0) return Promise.resolve();
    return new Promise(res => this._idleResolvers.push(res));
  }

  _drain() {
    if (!this.handler) return;
    while (this.active < this.concurrency && this.pending.length) {
      const job = this.pending.shift();
      this.active++;
      this._run(job);
    }
    if (this.size() === 0) {
      for (const res of this._idleResolvers.splice(0)) res();
    }
  }

  async _run(job) {
    job.attempts++;
    try {
      await this.handler(job);
      this.processed++;
    } catch (err) {
      if (job.attempts < job.maxAttempts) {
        const delay = this.backoffMs * Math.pow(2, job.attempts - 1);
        this.retryScheduled++;
        setTimeout(() => { this.retryScheduled--; this.pending.push(job); this._drain(); }, delay);
        if (this.logger) this.logger.warn('queue.retry', { queue: this.name, job: job.id, attempt: job.attempts });
      } else {
        this.deadLetter.push({ job, error: String(err && err.message || err) });
        if (this.logger) this.logger.error('queue.dead', { queue: this.name, job: job.id, error: String(err) });
      }
    } finally {
      this.active--;
      // microtask para não estourar pilha em lotes grandes
      queueMicrotask(() => this._drain());
    }
  }
}

module.exports = { Queue };
