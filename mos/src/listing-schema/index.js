/* UNIVERSAL MARKETPLACE LISTING SCHEMA ENGINE (complemento 10.C).

   UM motor, quatro adapters (ML, Shopee, TikTok Shop, Magalu). O
   formulário NUNCA é fixo: é montado em camadas (universal → interno →
   tipo de produto → categoria folha → marketplace → conta → logística →
   variação → regra interna). Reuso: rule packs do S10 viram árvore
   PROVISIONAL_INTERNAL via importador; category_snapshot (10.A) promove
   a VERIFIED_ACCOUNT; faltas viram DataRequest (10.B). Regra provisória
   JAMAIS aprova publicação externa. */
'use strict';

const SCHEMA_STATUS = ['VERIFIED_OFFICIAL', 'VERIFIED_ACCOUNT',
  'PROVISIONAL_INTERNAL', 'STALE', 'UNKNOWN', 'ERROR'];
/* prioridade da fonte de verdade (1 vence 7) */
const SOURCE_PRIORITY = ['OFFICIAL_API', 'OFFICIAL_STORED_VALID', 'ACCOUNT_RULE',
  'INTERNAL_CONFIRMED', 'PROVISIONAL_INTERNAL', 'RID_SUGGESTION', 'DEMO'];

/* ---------- camada 1-3: campos universais / internos / por tipo ---------- */
const UNIVERSAL_FIELDS = [
  { fieldKey: 'title', label: 'Título', group: 'conteudo', dataType: 'string', required: true },
  { fieldKey: 'description', label: 'Descrição', group: 'conteudo', dataType: 'text', required: true },
  { fieldKey: 'images', label: 'Imagens', group: 'midia', dataType: 'image[]', required: true },
  { fieldKey: 'price', label: 'Preço', group: 'preco', dataType: 'money', required: true },
  { fieldKey: 'stock', label: 'Estoque/Capacidade', group: 'preco', dataType: 'int', required: true },
  { fieldKey: 'sku', label: 'SKU', group: 'basico', dataType: 'string', required: true },
  { fieldKey: 'condition', label: 'Condição', group: 'basico', dataType: 'enum',
    allowedValues: ['novo', 'usado'], required: true },
];
const INTERNAL_FIELDS = [
  { fieldKey: 'cost', label: 'Custo', group: 'interno', dataType: 'money', required: true,
    helpText: 'sem custo não há margem — draft fica em revisão' },
  { fieldKey: 'minMarginPct', label: 'Margem mínima', group: 'interno', dataType: 'pct', required: false },
];
const PRODUCT_TYPE_FIELDS = {
  quadro: [
    { fieldKey: 'material', label: 'Material', group: 'atributos', required: true },
    { fieldKey: 'tipoMoldura', label: 'Tipo de moldura', group: 'atributos', required: true },
    { fieldKey: 'corMoldura', label: 'Cor da moldura', group: 'atributos', required: false },
    { fieldKey: 'comVidro', label: 'Com vidro?', group: 'atributos', dataType: 'bool', required: true },
    { fieldKey: 'larguraCm', label: 'Largura (cm)', group: 'medidas', dataType: 'number', required: true },
    { fieldKey: 'alturaCm', label: 'Altura (cm)', group: 'medidas', dataType: 'number', required: true },
    { fieldKey: 'prontoPendurar', label: 'Pronto para pendurar', group: 'atributos', dataType: 'bool' },
  ],
  espelho: [
    { fieldKey: 'material', label: 'Material', group: 'atributos', required: true },
    { fieldKey: 'espessuraMm', label: 'Espessura (mm)', group: 'medidas', dataType: 'number', required: true },
    { fieldKey: 'larguraCm', label: 'Largura (cm)', group: 'medidas', dataType: 'number', required: true },
    { fieldKey: 'alturaCm', label: 'Altura (cm)', group: 'medidas', dataType: 'number', required: true },
  ],
  eletronico: [
    { fieldKey: 'voltagem', label: 'Voltagem', group: 'atributos', dataType: 'enum',
      allowedValues: ['110V', '220V', 'bivolt'], required: true },
    { fieldKey: 'potenciaW', label: 'Potência (W)', group: 'atributos', dataType: 'number', required: true },
    { fieldKey: 'modelo', label: 'Modelo', group: 'atributos', required: true },
    { fieldKey: 'marca', label: 'Marca', group: 'atributos', required: true },
    { fieldKey: 'homologacaoAnatel', label: 'Homologação/Certificação', group: 'compliance',
      conditionalRequired: true, conditionExpression: 'conectividade != nenhuma' },
    { fieldKey: 'garantiaMeses', label: 'Garantia (meses)', group: 'atributos', dataType: 'int', required: true },
  ],
};

/* ---------- adapters por marketplace (mesmo contrato) ---------- */
const RESOLVERS = {
  mercado_livre: {
    groups: ['produto', 'categoria', 'conteudo', 'midia', 'atributos', 'ficha',
             'variacoes', 'preco', 'fiscal', 'logistica', 'revisao'],
    categoryFields: {
      'MLB1367': [ // Quadros (PROVISIONAL do rule pack S10)
        { fieldKey: 'tema', label: 'Tema', group: 'ficha', required: false },
        { fieldKey: 'quantidadePecas', label: 'Quantidade de peças', group: 'ficha', dataType: 'int', required: true },
        { fieldKey: 'acabamento', label: 'Acabamento', group: 'ficha', required: true }],
      'MLB-ELET': [
        { fieldKey: 'conectividade', label: 'Conectividade', group: 'ficha', required: true },
        { fieldKey: 'alimentacao', label: 'Tipo de alimentação', group: 'ficha', required: true }],
      'MLB-ESP': [
        { fieldKey: 'formato', label: 'Formato', group: 'ficha', required: true }],
    },
    shippingMethods: ['mercado-envios-flex', 'mercado-envios-padrao', 'coleta'],
    fastMethods: ['mercado-envios-flex'],
  },
  shopee: {
    groups: ['basico', 'midia', 'categoria', 'especificacoes', 'variacoes', 'conteudo',
             'fiscal', 'logistica', 'prazo', 'personalizacao', 'preco', 'revisao'],
    categoryFields: {
      '100636': [
        { fieldKey: 'prazoPreparacaoDias', label: 'Prazo de preparação (dias)', group: 'prazo',
          dataType: 'int', required: true,
          conditionExpression: 'productionMode != READY_STOCK' },
        { fieldKey: 'instrucoesPersonalizacao', label: 'Instruções de personalização', group: 'personalizacao',
          conditionalRequired: true, conditionExpression: 'isPersonalized = true' },
        { fieldKey: 'ncm', label: 'NCM', group: 'fiscal', required: true }],
    },
    shippingMethods: ['shopee-xpress-rapido', 'shopee-padrao', 'retirada'],
    fastMethods: ['shopee-xpress-rapido'],
  },
  tiktok: {
    groups: ['categoria', 'atributos-produto', 'atributos-venda', 'midia', 'variacoes',
             'dimensoes', 'certificacoes', 'conteudo', 'revisao'],
    categoryFields: {
      'TTK-DECOR': [
        { fieldKey: 'atributoVenda', label: 'Atributo de venda (variação)', group: 'atributos-venda', required: true },
        { fieldKey: 'video', label: 'Vídeo do produto', group: 'midia', required: false,
          helpText: 'TikTok Shop é marketplace com regras próprias — não só canal de vídeo' },
        { fieldKey: 'certificacao', label: 'Certificação da categoria', group: 'certificacoes',
          conditionalRequired: true, conditionExpression: 'categoria exige' }],
    },
    shippingMethods: ['tiktok-logistics', 'seller-shipping'],
    fastMethods: ['tiktok-logistics'],
  },
  magalu: {
    groups: ['categoria', 'ficha-tecnica', 'sku', 'portfolio', 'preco', 'fiscal',
             'midia', 'variacoes', 'revisao'],
    categoryFields: {
      'MGL-DECOR': [
        { fieldKey: 'fichaTecnica.material', label: 'Ficha técnica: material', group: 'ficha-tecnica', required: true },
        { fieldKey: 'fichaTecnica.ean', label: 'EAN', group: 'ficha-tecnica', required: true },
        { fieldKey: 'portfolio', label: 'Portfólio', group: 'portfolio', required: true }],
    },
    shippingMethods: ['magalu-entregas', 'proprio'],
    fastMethods: ['magalu-entregas'],
  },
};

class ListingSchemaEngine {
  constructor({ repos, clock, dataCompletion = null }) {
    this.r = repos; this.clock = clock; this.dataCompletion = dataCompletion;
  }

  /* ---------- importador seguro do que JÁ existe (rule packs S10) ---------- */
  importRulePacks(rulePacks, { companyId = null } = {}) {
    let imported = 0, duplicates = 0;
    for (const pack of Object.values(rulePacks)) {
      for (const t of pack.taxonomy || []) {
        const existing = this.r.categoryTree.db.get(
          `SELECT id FROM marketplace_category_tree WHERE marketplace = ? AND category_id = ? AND source = 'PROVISIONAL_INTERNAL'`,
          pack.platform, t.categoryId);
        if (existing) { duplicates++; continue; }
        this.r.categoryTree.insert({ company_id: companyId, marketplace: pack.platform,
          category_id: t.categoryId, name: t.name || t.path || t.categoryId,
          path: t.path || t.name, is_leaf: 1, source: 'PROVISIONAL_INTERNAL',
          source_version: pack.version, fetched_at: this.clock.nowIso(),
          confidence: 'PROVISIONAL',
          audit_json: [{ event: 'imported', from: `rule-pack:${pack.version}`,
                         at: this.clock.nowIso() }] });
        imported++;
      }
    }
    this.r.audit.record('schema-engine', 'rulepacks_imported', { companyId,
      entity: 'marketplace_category_tree', entityId: 'import',
      detail: { imported, duplicates, note: 'PROVISIONAL_INTERNAL — nunca substitui regra oficial' } });
    return { imported, duplicates };
  }

  /* categoria oficial (snapshot 10.A) promove a árvore — oficial VENCE interna */
  promoteFromSnapshot(companyId, snapshotId) {
    const snap = this.r.categorySnapshot.byId(snapshotId);
    const official = snap.source === 'OFFICIAL_API' ? 'VERIFIED_OFFICIAL' : 'VERIFIED_ACCOUNT';
    const row = this.r.categoryTree.insert({ company_id: companyId,
      marketplace: snap.platform, category_id: snap.category_id,
      name: snap.category_path || snap.category_id, path: snap.category_path,
      is_leaf: 1, source: official, fetched_at: snap.fetched_at,
      raw_reference: snap.id, confidence: 'HIGH',
      audit_json: [{ event: 'promoted-from-snapshot', snapshotId }] });
    return row;
  }

  /* fonte vigente para uma categoria: oficial > conta > interna */
  categorySource(marketplace, categoryId) {
    const rows = this.r.categoryTree.db.all(
      `SELECT * FROM marketplace_category_tree WHERE marketplace = ? AND category_id = ?`,
      marketplace, categoryId);
    const rank = s => ['VERIFIED_OFFICIAL', 'VERIFIED_ACCOUNT', 'PROVISIONAL_INTERNAL'].indexOf(s);
    return rows.sort((a, b) => rank(a.source) - rank(b.source))[0] || null;
  }

  /* ---------- descoberta de categoria (sugere; NUNCA assume sem confiança) ---------- */
  discoverCategory({ companyId, marketplace, title = '', productType = null }) {
    const t = `${title} ${productType || ''}`.toLowerCase();
    const rows = this.r.categoryTree.db.all(
      `SELECT * FROM marketplace_category_tree WHERE marketplace = ? AND is_leaf = 1`, marketplace);
    const scored = rows.map(c => {
      const name = (c.path || c.name || '').toLowerCase();
      const hits = t.split(/\s+/).filter(w => w.length > 4 && name.includes(w)).length
        + (productType && name.includes(productType) ? 2 : 0);
      return { category: c, confidence: Math.min(0.95, 0.35 + hits * 0.28) };
    }).filter(x => x.confidence > 0.4).sort((a, b) => b.confidence - a.confidence);
    const best = scored[0] || null;
    return { suggestions: scored.slice(0, 3),
      requiresHumanConfirmation: !best || best.confidence < 0.9
        || best.category.source === 'PROVISIONAL_INTERNAL',
      message: scored.length > 1
        ? `Encontrei ${scored.length} categorias possíveis — recomendo "${best.category.path || best.category.name}". Confirma?`
        : best ? `Recomendo ${best.category.path || best.category.name} (confiança ${best.confidence.toFixed(2)}). A categoria requer confirmação humana antes de qualquer publicação.`
        : 'Nenhuma categoria conhecida — conecte a conta ou confirme manualmente.' };
  }

  /* ---------- o CORAÇÃO: schema dinâmico em camadas ---------- */
  buildSchema({ companyId, marketplace, categoryId, productType = null,
                operationalProfile = null, accountConnected = false }) {
    const resolver = RESOLVERS[marketplace];
    if (!resolver) throw new Error(`marketplace sem adapter: ${marketplace}`);
    const catSource = this.categorySource(marketplace, categoryId);
    const schemaStatus = catSource
      ? (catSource.source === 'VERIFIED_OFFICIAL' ? 'VERIFIED_OFFICIAL'
        : catSource.source === 'VERIFIED_ACCOUNT' ? 'VERIFIED_ACCOUNT'
        : 'PROVISIONAL_INTERNAL')
      : 'UNKNOWN';

    const layers = [];
    const push = (fields, layer, source) => fields.forEach(f =>
      layers.push({ ...f, layer, source }));
    push(UNIVERSAL_FIELDS, 'universal', 'CORE');
    push(INTERNAL_FIELDS, 'interno', 'INTERNAL_CONFIRMED');
    if (productType && PRODUCT_TYPE_FIELDS[productType])
      push(PRODUCT_TYPE_FIELDS[productType], 'tipo-produto', 'INTERNAL_CONFIRMED');
    const catFields = resolver.categoryFields[categoryId] || [];
    push(catFields, 'categoria-folha',
      schemaStatus === 'PROVISIONAL_INTERNAL' ? 'PROVISIONAL_INTERNAL'
        : schemaStatus === 'UNKNOWN' ? 'PROVISIONAL_INTERNAL' : 'OFFICIAL_STORED_VALID');

    /* camada de logística/operação: sob encomenda EXIGE campos extras */
    const op = operationalProfile || {};
    const madeToOrder = op.is_personalized || ['MADE_TO_ORDER', 'PERSONALIZED']
      .includes(op.production_mode);
    push([
      { fieldKey: 'packedWeightG', label: 'Peso embalado (g)', group: 'logistica',
        dataType: 'number', required: true },
      { fieldKey: 'packedDims', label: 'Dimensões da embalagem', group: 'logistica',
        dataType: 'dims', required: true }], 'logistica', 'INTERNAL_CONFIRMED');
    if (madeToOrder) push([
      { fieldKey: 'productionLeadTimeDays', label: 'Prazo de produção (dias)', group: 'prazo',
        dataType: 'int', required: true },
      { fieldKey: 'preparationTimeDays', label: 'Prazo de preparação (dias)', group: 'prazo',
        dataType: 'int', required: true },
      { fieldKey: 'dispatchPolicy', label: 'Política de despacho', group: 'prazo', required: true },
      { fieldKey: 'operationalCapacityPerDay', label: 'Capacidade/dia', group: 'prazo',
        dataType: 'int', required: true },
      { fieldKey: 'packagingProfile', label: 'Embalagem (proteção)', group: 'logistica', required: true }],
      'regra-interna:sob-encomenda', 'INTERNAL_CONFIRMED');

    /* dedupe por fieldKey (camada mais específica vence) */
    const seen = new Map();
    for (const f of layers) seen.set(f.fieldKey, f);
    const fields = [...seen.values()];

    /* snapshot persistido do schema usado */
    const schema = this.r.listingSchema.insert({ company_id: companyId,
      marketplace, category_id: categoryId, schema_status: schemaStatus,
      source: catSource ? catSource.source : 'UNKNOWN',
      source_version: catSource ? catSource.source_version : null,
      fetched_at: this.clock.nowIso(), fields_json: fields,
      logistics_rules_json: { methods: resolver.shippingMethods,
        fastMethods: resolver.fastMethods, madeToOrderBlocked: madeToOrder },
      audit_json: [{ event: 'built', layers: [...new Set(layers.map(l => l.layer))] }],
      created_at: this.clock.nowIso() });
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      this.r.schemaField.insert({ listing_schema_id: schema.id,
        field_key: f.fieldKey, label: f.label, field_group: f.group,
        data_type: f.dataType || 'string', required: f.required ? 1 : 0,
        conditional_required: f.conditionalRequired ? 1 : 0,
        condition_expression: f.conditionExpression || null,
        allowed_values_json: f.allowedValues || null, help_text: f.helpText || null,
        source: f.source, sort_order: i, created_at: this.clock.nowIso() });
    }
    return { schema, fields, groups: resolver.groups, schemaStatus,
      canApproveExternalPublish: ['VERIFIED_OFFICIAL', 'VERIFIED_ACCOUNT'].includes(schemaStatus),
      provisionalNote: schemaStatus === 'PROVISIONAL_INTERNAL' || schemaStatus === 'UNKNOWN'
        ? 'Regra interna/provisória — o rascunho interno é permitido, mas NÃO afirmamos que o marketplace aceitará; conecte a conta ou confirme antes de publicar.' : null };
  }

  /* ---------- validação dos valores contra o schema (readiness) ---------- */
  validate({ schema, values = {}, operationalProfile = null }) {
    const missing = [], invalid = [], ready = [];
    for (const f of schema.fields) {
      const v = values[f.fieldKey];
      if (f.required && (v == null || v === '')) { missing.push(f); continue; }
      if (v != null && f.allowedValues && !f.allowedValues.includes(v)) { invalid.push(f); continue; }
      if (v != null) ready.push(f.fieldKey);
    }
    /* faltas viram DataRequest contextual (10.B) quando possível */
    const dataRequests = [];
    if (this.dataCompletion && operationalProfile) {
      const MAP = { packedWeightG: 'pesoEmbalado', material: 'material',
        packagingProfile: 'embalagem', productionLeadTimeDays: 'prazo', cost: 'custo' };
      for (const f of missing) if (MAP[f.fieldKey]) {
        const r = this.dataCompletion.open({ companyId: operationalProfile.company_id,
          productId: operationalProfile.product_id, marketplace: schema.schema.marketplace,
          field: MAP[f.fieldKey], criticality: 'BLOCKER',
          motive: `campo obrigatório do schema ${schema.schema.marketplace}/${schema.schema.category_id}` });
        if (r.created) dataRequests.push(r.request);
      }
    }
    return { readiness: missing.length || invalid.length ? 'PENDENTE' : 'PRONTO',
      missing: missing.map(f => f.label), invalid: invalid.map(f => f.label),
      ready, dataRequests,
      externalPublishAllowed: false };   // rascunho interno SEMPRE; publicar nunca automático
  }
}

/* ---------- elegibilidade logística: bloqueio INTERNO automático ---------- */
class ShippingEligibilityEngine {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  evaluate({ companyId, productId = null, draftId = null, marketplace,
             operationalProfile = {}, packedWeightG = null, packedDims = null,
             accountConnected = false }) {
    const resolver = RESOLVERS[marketplace];
    const op = operationalProfile;
    const madeToOrder = op.is_personalized
      || ['MADE_TO_ORDER', 'PERSONALIZED'].includes(op.production_mode);
    const results = resolver.shippingMethods.map(method => {
      const reasons = [];
      let status = 'ELIGIBLE';
      const fast = resolver.fastMethods.includes(method);
      if (packedWeightG == null) { status = 'AWAITING_DATA'; reasons.push('peso embalado ausente'); }
      else if (packedDims == null) { status = 'AWAITING_DATA'; reasons.push('dimensões da embalagem ausentes'); }
      else {
        if (fast && madeToOrder) {
          status = op.is_personalized ? 'BLOCKED_BY_PERSONALIZATION' : 'BLOCKED_BY_LEAD_TIME';
          reasons.push(`modalidade rápida incompatível com produção sob demanda (prazo ${op.production_lead_time_days ?? '?'} dias)`);
        }
        if (status === 'ELIGIBLE' && fast && (op.production_lead_time_days ?? 0) > 2) {
          status = 'BLOCKED_BY_LEAD_TIME';
          reasons.push('despacho imediato exigido pela modalidade');
        }
        if (status === 'ELIGIBLE' && packedWeightG > 30000) {
          status = 'BLOCKED_BY_WEIGHT'; reasons.push('peso acima do limite da modalidade');
        }
        if (status === 'ELIGIBLE' && packedDims
            && Math.max(packedDims.h || 0, packedDims.w || 0, packedDims.d || 0) > 150) {
          status = 'BLOCKED_BY_DIMENSIONS'; reasons.push('dimensão acima do limite');
        }
        if (status === 'ELIGIBLE' && op.fragile && op.requires_special_packaging
            && !op.packaging_profile_id) {
          status = 'BLOCKED_BY_PACKAGING'; reasons.push('frágil sem perfil de embalagem definido');
        }
      }
      /* a confirmação OFICIAL só existe com conta conectada — nunca fingimos */
      const requiresConfirmation = status === 'ELIGIBLE' && !accountConnected;
      const finalStatus = requiresConfirmation ? 'AWAITING_ACCOUNT_CONFIRMATION' : status;
      const row = this.r.shippingEligibility.insert({ company_id: companyId,
        product_id: productId, listing_draft_id: draftId, marketplace,
        shipping_method: method, status: finalStatus, reasons_json: reasons,
        derived_from: 'regra-interna', requires_confirmation: requiresConfirmation ? 1 : 0,
        checked_at: this.clock.nowIso(),
        source: accountConnected ? 'ACCOUNT_RULE' : 'PROVISIONAL_INTERNAL',
        created_at: this.clock.nowIso() });
      return row;
    });
    return { methods: results,
      eligible: results.filter(m => m.status === 'ELIGIBLE').map(m => m.shipping_method),
      blocked: results.filter(m => /^BLOCKED/.test(m.status)),
      awaitingData: results.filter(m => m.status === 'AWAITING_DATA'),
      note: 'bloqueio interno automático; elegibilidade oficial só VERIFIED com conta conectada/confirmação humana' };
  }
}

/* ---------- perfil operacional (sob encomenda, personalização, capacidade) ---------- */
class OperationalProfileService {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }
  upsert(productId, companyId, fields) {
    const existing = this.r.operationalProfile.db.get(
      'SELECT id FROM product_operational_profile WHERE product_id = ?', productId);
    const madeToOrder = fields.isPersonalized
      || ['MADE_TO_ORDER', 'PERSONALIZED'].includes(fields.productionMode);
    const missing = [];
    if (madeToOrder) {
      if (fields.productionLeadTimeDays == null) missing.push('prazo de produção');
      if (fields.preparationTimeDays == null) missing.push('prazo de preparação');
      if (fields.operationalCapacityPerDay == null) missing.push('capacidade operacional/dia');
    }
    const row = { product_id: productId, company_id: companyId,
      product_type: fields.productType, is_personalized: fields.isPersonalized ? 1 : 0,
      production_mode: fields.productionMode || 'READY_STOCK',
      production_lead_time_days: fields.productionLeadTimeDays ?? null,
      preparation_time_days: fields.preparationTimeDays ?? null,
      dispatch_policy: fields.dispatchPolicy || null,
      operational_capacity_per_day: fields.operationalCapacityPerDay ?? null,
      requires_special_packaging: fields.requiresSpecialPackaging ? 1 : 0,
      packaging_profile_id: fields.packagingProfileId || null,
      fragile: fields.fragile ? 1 : 0, updated_at: this.clock.nowIso() };
    const saved = existing ? this.r.operationalProfile.update(existing.id, row)
      : this.r.operationalProfile.insert({ ...row, created_at: this.clock.nowIso() });
    return { profile: saved, madeToOrder, missingRequired: missing,
      complete: !missing.length };
  }
}

/* variações NUNCA herdam peso/prazo/logística automaticamente */
function variationSchema(baseFields) {
  return ['sku', 'price', 'stock', 'cost', 'packedWeightG', 'packedDims',
          'image', 'leadTimeDays', 'saleAttribute'].map(k => ({
    fieldKey: k, inherited: false,
    note: 'variação tem valores próprios — nada é herdado sem confirmação' }));
}

function createListingSchemaEngine({ mos, clock, dataCompletion = null }) {
  const engine = new ListingSchemaEngine({ repos: mos.repos, clock, dataCompletion });
  const shipping = new ShippingEligibilityEngine({ repos: mos.repos, clock });
  const operational = new OperationalProfileService({ repos: mos.repos, clock });
  return { engine, shipping, operational, variationSchema,
           RESOLVERS, SCHEMA_STATUS, SOURCE_PRIORITY };
}

module.exports = { createListingSchemaEngine, RESOLVERS, SCHEMA_STATUS };
