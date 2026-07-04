/* HTTP · API interna (Bloco 04) — controllers + DTOs + OpenAPI.
   Nenhuma API externa: esta é a superfície interna da plataforma,
   consumida pela Camada de Experiência e pelo painel de observabilidade.
   DTOs em camelCase; linhas do banco em snake_case nunca vazam cruas. */
'use strict';
const { Router } = require('./router.js');
const { mountObservability } = require('./observability.js');

/* ---------- DTOs ---------- */
const dto = {
  listing: r => ({
    id: r.id, productId: r.product_id, connectionId: r.connection_id,
    title: r.title, price: r.price, status: r.status,
    healthScore: r.health_score, ranking: r.ranking,
    activeVersionId: r.active_version_id, updatedAt: r.updated_at,
  }),
  version: r => ({
    id: r.id, listingId: r.listing_id, number: r.number, title: r.title,
    description: r.description, price: r.price, author: r.author,
    reason: r.reason, images: JSON.parse(r.images_json || '[]'),
    result: r.result_json ? JSON.parse(r.result_json) : null, createdAt: r.created_at,
  }),
  decision: r => ({
    id: r.id, companyId: r.company_id, productId: r.product_id, title: r.title,
    discovery: r.discovery, probableCause: r.probable_cause,
    proposal: JSON.parse(r.proposal_json), impact: { min: r.impact_min, max: r.impact_max },
    confidence: r.confidence, reversibility: r.reversibility, class: r.class,
    status: r.status, refusalMotive: r.refusal_motive, createdAt: r.created_at,
  }),
  mission: r => ({
    id: r.id, companyId: r.company_id, productId: r.product_id,
    decisionId: r.decision_id, kind: r.kind, title: r.title, status: r.status,
    origin: r.origin, log: JSON.parse(r.log_json || '[]'), result: r.result,
  }),
  memory: r => ({
    id: r.id, key: r.key, kind: r.kind, discovery: r.discovery,
    strength: r.strength, needsRevalidation: !!r.needs_revalidation,
  }),
  product: r => ({ id: r.id, companyId: r.company_id, name: r.name, sku: r.sku }),
};

/* ---------- rotas ---------- */
function createApi(mos, { dev = true, mie = null } = {}) {
  const router = new Router({ logger: mos.logger.child({ mod: 'http' }) });
  const { services, repos } = mos;
  if (dev) mountObservability(router, mos, { mie });

  router.get('/health', { summary: 'Saúde da plataforma', tags: ['sistema'] },
    () => ({ ok: true, uptime: process.uptime() }));

  router.post('/workspaces/bootstrap', {
    summary: 'Cria workspace + usuário + empresa + conexões simuladas',
    tags: ['workspace'],
    schema: {
      workspaceName: { type: 'string', required: true, maxLen: 120 },
      email: { type: 'string', required: true, maxLen: 200 },
      companyName: { type: 'string', required: true, maxLen: 120 },
      marketplaces: { type: 'array' },
    },
  }, ({ body }) => {
    const r = services.workspace.bootstrap(body);
    return { _status: 201, workspaceId: r.workspace.id, companyId: r.company.id,
             userId: r.user.id, connectionIds: r.connections.map(c => c.id) };
  });

  router.post('/companies/:companyId/products', {
    summary: 'Cria produto', tags: ['catálogo'],
    schema: { name: { type: 'string', required: true, maxLen: 200 } },
  }, ({ params, body }) => ({ _status: 201, ...dto.product(services.catalog.createProduct(params.companyId, body)) }));

  router.post('/companies/:companyId/connections/:connectionId/listings/import', {
    summary: 'Importa anúncios em massa (transação única)', tags: ['catálogo'],
    schema: { items: { type: 'array', required: true } },
  }, ({ params, body }) => {
    const r = services.catalog.importListings(params.companyId, params.connectionId, body.items);
    return { _status: 201, imported: r.count };
  });

  router.get('/companies/:companyId/listings', {
    summary: 'Lista anúncios (paginação keyset: ?after=&limit=&status=)', tags: ['catálogo'],
  }, ({ params, query }) => {
    const page = services.catalog.listListings(params.companyId, {
      after: query.after || '', limit: Number(query.limit) || 50, status: query.status || null });
    return { items: page.items.map(dto.listing), nextCursor: page.nextCursor };
  });

  router.get('/listings/:listingId', { summary: 'Detalhe do anúncio', tags: ['catálogo'] },
    ({ params }) => dto.listing(repos.listing.byId(params.listingId)));

  router.get('/listings/:listingId/versions', { summary: 'Versões do anúncio', tags: ['catálogo'] },
    ({ params }) => ({ items: repos.version.byListing(params.listingId).map(dto.version) }));

  router.post('/listings/:listingId/versions', {
    summary: 'Cria nova versão (sempre reversível)', tags: ['catálogo'],
    schema: { title: { type: 'string' }, price: { type: 'number', min: 0 }, reason: { type: 'string', maxLen: 300 } },
  }, ({ params, body }) => ({ _status: 201, ...dto.version(services.catalog.createVersion(params.listingId, body)) }));

  router.post('/listings/:listingId/versions/:versionId/restore', {
    summary: 'Restaura uma versão anterior', tags: ['catálogo'],
  }, ({ params }) => dto.version(services.catalog.restoreVersion(params.listingId, params.versionId)));

  router.get('/companies/:companyId/decisions', {
    summary: 'Fila de decisões pendentes (somente decisões — Art. 19)', tags: ['decisões'],
  }, ({ params }) => ({ items: services.decision.pending(params.companyId).map(dto.decision) }));

  router.post('/companies/:companyId/decisions', {
    summary: 'Registra decisão vinda do MIE (pacote completo)', tags: ['decisões'],
    schema: {
      title: { type: 'string', required: true, maxLen: 200 },
      discovery: { type: 'string', required: true },
      proposal: { type: 'object', required: true },
      confidence: { enum: ['alta', 'média', 'baixa'] },
      class: { enum: ['A', 'B', 'C'] },
    },
  }, ({ params, body }) => ({ _status: 201, ...dto.decision(services.decision.create(params.companyId, body)) }));

  router.post('/decisions/:decisionId/approve', {
    summary: 'Aprova: vira missão + plano com previsão (Fluxo 007)', tags: ['decisões'],
  }, ({ params }) => {
    const r = services.decision.approve(params.decisionId);
    return { decision: dto.decision(r.decision), missionId: r.mission.id, planId: r.plan.id };
  });

  router.post('/decisions/:decisionId/refuse', {
    summary: 'Recusa com motivo — vira preferência na memória (Art. 18)', tags: ['decisões'],
    schema: { motive: { type: 'string', maxLen: 200 } },
  }, ({ params, body }) => dto.decision(services.decision.refuse(params.decisionId, body && body.motive)));

  router.get('/companies/:companyId/missions', { summary: 'Missões da empresa', tags: ['missões'] },
    ({ params, query }) => {
      const page = repos.mission.page({
        where: 'WHERE company_id = ?', params: [params.companyId],
        after: query.after || '', limit: Number(query.limit) || 50 });
      return { items: page.items.map(dto.mission), nextCursor: page.nextCursor };
    });

  router.get('/companies/:companyId/memory', {
    summary: 'Biblioteca viva (?kind=&minStrength=)', tags: ['memória'],
  }, ({ params, query }) => ({
    items: (query.kind
      ? repos.memory.byKind(params.companyId, query.kind, Number(query.minStrength) || 1)
      : repos.memory.page({ where: 'WHERE company_id = ?', params: [params.companyId], limit: 200 }).items
    ).map(dto.memory),
  }));

  router.get('/audit', { summary: 'Trilha de auditoria (caixa-preta)', tags: ['sistema'] },
    ({ query }) => ({ items: repos.audit.tail(Number(query.limit) || 50) }));

  router.get('/openapi.json', { summary: 'Especificação OpenAPI 3 desta API', tags: ['sistema'] },
    () => openapi(router));

  return router;
}

/* ---------- OpenAPI 3 gerado da tabela de rotas ---------- */
function openapi(router) {
  const paths = {};
  for (const r of router.routes) {
    const p = r.path.replace(/:([^/]+)/g, '{$1}');
    paths[p] = paths[p] || {};
    paths[p][r.method.toLowerCase()] = {
      summary: r.summary, tags: r.tags,
      parameters: r.keys.map(k => ({ name: k, in: 'path', required: true, schema: { type: 'string' } })),
      ...(r.schema ? { requestBody: { required: true, content: { 'application/json': {
        schema: { type: 'object',
          required: Object.entries(r.schema).filter(([, v]) => v.required).map(([k]) => k),
          properties: Object.fromEntries(Object.entries(r.schema).map(([k, v]) =>
            [k, { type: v.type || 'string', ...(v.enum ? { enum: v.enum } : {}) }])) },
      } } } } : {}),
      responses: { 200: { description: 'OK' }, 400: { description: 'Validação' },
                   404: { description: 'Não encontrado' }, 500: { description: 'Erro interno' } },
    };
  }
  return {
    openapi: '3.0.3',
    info: { title: 'Marketplace Operating System — API interna', version: '1.0.0',
            description: 'Superfície interna da plataforma. Nenhuma API externa é consumida.' },
    paths,
  };
}

module.exports = { createApi, dto };
