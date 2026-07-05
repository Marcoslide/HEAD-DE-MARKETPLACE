/* =============================================================
   V8API — Cliente da API oficial (SPRINT 10.E.2.5.3)
   A FONTE OFICIAL da operação é: Postgres → API MOS → interface.
   Este cliente conversa com a API real (apps/api/server.js). Quando
   um backend está configurado (window.HEAD_API_BASE ou localStorage
   'head_api_base'), a Central e a importação consultam a API; o
   IndexedDB fica só como cache/preview/recuperação de sessão — nunca
   como fonte oficial. Num Artifact estático (sem backend) o cliente
   fica OFFLINE e a interface degrada para a base local rotulada.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8API = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function base() {
    if (typeof window === 'undefined') return null;
    if (window.HEAD_API_BASE) return String(window.HEAD_API_BASE).replace(/\/$/, '');
    try { const s = localStorage.getItem('head_api_base'); if (s) return s.replace(/\/$/, ''); } catch (e) {}
    return null;
  }
  const online = () => !!base();

  async function req(method, path, body, extraHeaders) {
    const b = base();
    if (!b) throw Object.assign(new Error('OFFLINE — sem backend configurado (fonte oficial ausente)'), { offline: true });
    const headers = Object.assign({ 'content-type': body instanceof Blob || body instanceof ArrayBuffer ? 'application/octet-stream' : 'application/json' }, extraHeaders || {});
    const res = await fetch(b + path, { method, credentials: 'include', headers,
      body: body == null ? undefined : (body instanceof Blob || body instanceof ArrayBuffer ? body : JSON.stringify(body)) });
    const txt = await res.text();
    let out = {}; try { out = txt ? JSON.parse(txt) : {}; } catch (e) { out = { raw: txt }; }
    if (!res.ok) throw Object.assign(new Error(out.erro || ('HTTP ' + res.status)), { status: res.status, body: out });
    return out;
  }

  const qs = ctx => '?' + new URLSearchParams(Object.fromEntries(Object.entries(ctx || {}).filter(([, v]) => v != null && v !== ''))).toString();

  return {
    base, online,
    setBase(url) { try { url ? localStorage.setItem('head_api_base', url) : localStorage.removeItem('head_api_base'); } catch (e) {} },
    /* auth + escopo */
    signup: b => req('POST', '/auth/signup', b),
    login: b => req('POST', '/auth/login', b),
    logout: () => req('POST', '/auth/logout'),
    criarEscopo: b => req('POST', '/scope', b),
    health: () => req('GET', '/health'),
    /* importação */
    upload: (buffer, meta) => req('POST', '/files', buffer, { 'x-filename': meta.filename, 'x-group-id': meta.groupId,
      'x-company-id': meta.companyId, 'x-store-id': meta.storeId, 'x-account-id': meta.accountId, 'content-type': meta.mime || 'application/octet-stream' }),
    criarImport: b => req('POST', '/imports', b),
    aplicarImport: (batchId, escopo) => req('POST', '/imports/' + batchId + '/apply', { escopo }),
    listarImports: ctx => req('GET', '/imports' + qs(ctx)),
    verImport: (id, ctx) => req('GET', '/imports/' + id + qs(ctx)),
    previewImport: (id, ctx) => req('GET', '/imports/' + id + '/preview' + qs(ctx)),
    camposImport: (id, ctx) => req('GET', '/imports/' + id + '/fields' + qs(ctx)),
    conflitosImport: (id, ctx) => req('GET', '/imports/' + id + '/conflicts' + qs(ctx)),
    job: id => req('GET', '/jobs/' + id),
    /* inteligência (fonte oficial = Postgres) */
    performance: ctx => req('GET', '/intelligence/performance' + qs(ctx)),
    returns: ctx => req('GET', '/intelligence/returns' + qs(ctx)),
    inventory: ctx => req('GET', '/intelligence/inventory' + qs(ctx)),
    orders: ctx => req('GET', '/intelligence/orders' + qs(ctx)),
    traffic: ctx => req('GET', '/intelligence/traffic' + qs(ctx)),
    summary: ctx => req('GET', '/intelligence/summary' + qs(ctx)),

    /* 10.F.1 — Conciliação Financeira: fonte oficial (Postgres via API). O
       status de conciliação é decidido no backend; a tela só consome. */
    reconSummary: ctx => req('GET', '/financial-reconciliation/summary' + qs(ctx)),
    reconCases: (ctx, filtro) => req('GET', '/financial-reconciliation/cases' + qs(Object.assign({}, ctx, filtro))),
    reconCase: id => req('GET', '/financial-reconciliation/cases/' + id),
    reconMovements: (ctx, filtro) => req('GET', '/financial-reconciliation/movements' + qs(Object.assign({}, ctx, filtro))),
    reconProjection: ctx => req('GET', '/financial-reconciliation/projection' + qs(ctx)),
    reconDivergences: ctx => req('GET', '/financial-reconciliation/divergences' + qs(ctx)),
  };
}));
