/* HTTP · Router — REST sobre node:http, zero dependências (Bloco 04).
   - rotas declarativas com :params (a MESMA tabela alimenta o OpenAPI)
   - body JSON com limite, request-id, logs estruturados por requisição
   - tratamento GLOBAL de erros: AppError → status/código; resto → 500 */
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { AppError, ValidationError, NotFoundError } = require('../../kernel/errors.js');

const MAX_BODY = 1024 * 1024; // 1 MiB

class Router {
  constructor({ logger }) {
    this.routes = [];   // {method, path, regex, keys, summary, handler, schema}
    this.logger = logger;
  }

  add(method, path, { summary = '', schema = null, tags = [] } = {}, handler) {
    const keys = [];
    const regex = new RegExp('^' + path.replace(/:[^/]+/g, m => {
      keys.push(m.slice(1)); return '([^/]+)';
    }) + '$');
    this.routes.push({ method, path, regex, keys, summary, schema, tags, handler });
  }
  get(p, o, h) { this.add('GET', p, o, h); }
  post(p, o, h) { this.add('POST', p, o, h); }
  patch(p, o, h) { this.add('PATCH', p, o, h); }
  delete(p, o, h) { this.add('DELETE', p, o, h); }

  async dispatch(req, res) {
    const started = Date.now();
    const requestId = crypto.randomUUID().slice(0, 8);
    const url = new URL(req.url, 'http://internal');
    const log = this.logger.child({ requestId, method: req.method, path: url.pathname });

    try {
      const route = this.routes.find(r => r.method === req.method && r.regex.test(url.pathname));
      if (!route) throw new NotFoundError('rota', `${req.method} ${url.pathname}`);

      const params = {};
      const match = url.pathname.match(route.regex);
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]); });
      const query = Object.fromEntries(url.searchParams);
      const read = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readJson(req) : null;
      const body = read ? read.parsed : null;
      const rawBody = read ? read.raw : '';

      if (route.schema) validate(body || {}, route.schema);

      const result = await route.handler({ params, query, body, rawBody, headers: req.headers, requestId, log });
      if (result && result._html) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-request-id': requestId });
        res.end(result._html);
        log.info('request', { status: 200, ms: Date.now() - started });
        return;
      }
      const status = result && result._status ? result._status : 200;
      if (result && result._status) delete result._status;
      send(res, status, result ?? { ok: true }, requestId);
      log.info('request', { status, ms: Date.now() - started });
    } catch (err) {
      const isApp = err instanceof AppError;
      const status = isApp ? err.status : 500;
      const payload = isApp ? err.toJSON()
        : { error: 'internal_error', message: 'erro interno — registrado para investigação' };
      send(res, status, payload, requestId);
      (status >= 500 ? log.error : log.warn).call(log, 'request_error',
        { status, code: payload.error, message: err.message, ms: Date.now() - started });
    }
  }

  listen(port = 0) {
    const server = http.createServer((req, res) => this.dispatch(req, res));
    return new Promise(resolve => server.listen(port, () => resolve(server)));
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new ValidationError('corpo excede 1 MiB')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      const raw = Buffer.concat(chunks).toString('utf8');
      try { const parsed = JSON.parse(raw); resolve({ parsed, raw }); }
      catch { reject(new ValidationError('JSON inválido no corpo da requisição')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload, requestId) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'x-request-id': requestId,
  });
  res.end(body);
}

/* validador declarativo — schema = { campo: {type, required, enum, min, max, items} } */
function validate(data, schema) {
  const errors = [];
  for (const [field, rule] of Object.entries(schema)) {
    const v = data[field];
    if (v === undefined || v === null || v === '') {
      if (rule.required) errors.push(`${field}: obrigatório`);
      continue;
    }
    if (rule.type === 'string' && typeof v !== 'string') errors.push(`${field}: deve ser string`);
    if (rule.type === 'number' && typeof v !== 'number') errors.push(`${field}: deve ser número`);
    if (rule.type === 'array' && !Array.isArray(v)) errors.push(`${field}: deve ser lista`);
    if (rule.type === 'object' && (typeof v !== 'object' || Array.isArray(v))) errors.push(`${field}: deve ser objeto`);
    if (rule.enum && !rule.enum.includes(v)) errors.push(`${field}: deve ser um de ${rule.enum.join(', ')}`);
    if (rule.min !== undefined && v < rule.min) errors.push(`${field}: mínimo ${rule.min}`);
    if (rule.maxLen !== undefined && String(v).length > rule.maxLen) errors.push(`${field}: máximo ${rule.maxLen} caracteres`);
  }
  if (errors.length) throw new ValidationError('dados inválidos', errors);
}

module.exports = { Router, validate };
