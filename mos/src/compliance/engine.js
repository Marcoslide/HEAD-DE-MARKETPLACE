/* COMPLIANCE ENGINE (Sprint 10) — o cérebro de regras e catálogo.

   Product Master → perfil → regra por praça → categoria → requisitos →
   validação (9 categorias) → findings → readiness → checklist → rascunho.

   Leis:
   - a IA sugere/explica/organiza; as REGRAS vêm dos rule packs com fonte;
   - categoria/código NUNCA é inventado: só sai da taxonomia do pack;
   - regra UNKNOWN → REVIEW_REQUIRED (nunca READY);
   - regra PROVISIONAL nunca gera aprovação definitiva;
   - regra interna alerta, mas não finge ser bloqueio oficial da praça;
   - "aprovado pela plataforma" não existe — apenas "validado contra as
     regras conhecidas do rule pack X";
   - tudo READ_ONLY: o resultado vira diagnóstico/checklist/rascunho,
     jamais publicação. */
(function (NS) {
'use strict';

const SEVERITIES = ['BLOCKER', 'HIGH_RISK', 'WARNING', 'INFO', 'UNKNOWN'];
const RESULTS = ['READY', 'READY_WITH_WARNINGS', 'REVIEW_REQUIRED', 'BLOCKED',
                 'INSUFFICIENT_DATA', 'NOT_SUPPORTED'];

/* ---------------- CATEGORIZATION ENGINE ----------------
   Produto → sugestão de categoria + confiança + evidências + revisão.
   Nunca inventa: só devolve categorias que EXISTEM na taxonomia do pack. */
function suggestCategory(product, pack) {
  const text = [product.master.name, product.profile.productType,
    product.profile.description, JSON.stringify(product.profile.techSheet || {})]
    .join(' ').toLowerCase();
  const scored = pack.taxonomy.map(cat => {
    const hits = cat.keywords.filter(k => text.includes(k)).length;
    return { cat, hits };
  }).sort((a, b) => b.hits - a.hits);
  const top = scored[0];
  if (!top || top.hits === 0)
    return { platform: pack.platform, suggestedCategory: null, categoryId: null,
             confidence: 0, evidence: [], status: 'NO_MATCH',
             alternativeCategories: [], reviewRequired: true };
  const confidence = top.hits >= 2 ? 0.9 : 0.55;
  const status = confidence >= 0.75 ? 'MATCHED' : 'LOW_CONFIDENCE';
  return {
    platform: pack.platform,
    suggestedCategory: top.cat.path,
    categoryId: top.cat.categoryId,
    categoryName: top.cat.name,
    categoryStatus: top.cat.status,             // PROVISIONAL → código pendente de confirmação
    confidence, status,
    evidence: top.cat.keywords.filter(k => text.includes(k)).map(k => `termo "${k}" no produto`),
    alternativeCategories: scored.slice(1, 3).filter(s => s.hits > 0)
      .map(s => ({ categoryId: s.cat.categoryId, path: s.cat.path })),
    reviewRequired: status !== 'MATCHED' || top.cat.status !== 'VERIFIED',
    source: { sourceType: top.cat.sourceType, sourceReference: top.cat.sourceReference },
  };
}

/* ---------------- REQUIREMENT RESOLVER ----------------
   Une requisitos por camadas: global → categoria → tipo de produto →
   variação → logística → personalização → fiscal → regra interna. */
function resolveRequirements(pack, internalRules, product, categoryEntry) {
  const p = product.profile;
  const applicable = [];
  for (const r of pack.requirements) applicable.push({ ...r, rulePackVersion: pack.version, layer: r.scope });
  for (const r of internalRules) {
    if (r.appliesWhen === 'personalized' && !p.madeToOrder && !p.personalization) continue;
    if (r.appliesWhen === 'fragile' && !p.fragile) continue;
    applicable.push({ ...r, layer: 'internal' });
  }
  if (categoryEntry)
    for (const attr of categoryEntry.requiredAttributes || [])
      applicable.push({
        id: `${pack.platform}-cat-attr-${attr}`, scope: 'category',
        requirementType: 'REQUIRED_ATTRIBUTES', field: `attributes.${attr}`,
        operator: 'required', severity: 'BLOCKER',
        status: categoryEntry.status, confidence: 0.7,
        sourceType: categoryEntry.sourceType, sourceReference: categoryEntry.sourceReference,
        rulePackVersion: pack.version, layer: 'category',
      });
  return applicable;
}

/* ---------------- resolução de campos ---------------- */
function fieldValue(field, product, mp) {
  const p = product.profile, assets = product.assets || [];
  const images = assets.filter(a => a.kind === 'image');
  switch (field) {
    case 'title': return mp.title;
    case 'description': return p.description;
    case 'price': return mp.price ?? p.basePrice;
    case 'stock': return mp.stock;
    case 'derived.imageCount': return images.length;
    case 'derived.imageSizesKnown':
      return images.length && images.every(i => i.sizeKb != null) ? images : null;
    case 'derived.hasVideo': return assets.some(a => a.kind === 'video') || !!(mp.content && mp.content.videoUrl);
    case 'derived.marginPct': {
      const price = mp.price ?? p.basePrice;
      return price && p.cost ? Math.round(((price - p.cost) / price) * 1000) / 10 : null;
    }
    case 'derived.totalLeadDays': return (p.productionDays || 0) + (p.personalizationDays || 0);
    case 'derived.customDemandVsCapacity':
      return p.dailyCapacity ? (product.demand && product.demand.customPendingToday || 0) / p.dailyCapacity : null;
    case 'derived.productType': return p.productType;
    case 'profile.packedDims': return p.packedDims && p.packedDims.h && p.packedDims.w && p.packedDims.d ? p.packedDims : null;
    default: {
      if (field.startsWith('profile.')) return p[field.slice(8)];
      if (field.startsWith('attributes.')) return (mp.attributes || {})[field.slice(11)];
      return undefined;
    }
  }
}

const missingish = v => v == null || v === '' || (Array.isArray(v) && !v.length);

/* ---------------- avaliador genérico de uma regra ---------------- */
function evaluateRule(rule, product, mp) {
  if (rule.status === 'DEPRECATED' || rule.status === 'NOT_APPLICABLE') return null;

  const images = (product.assets || []).filter(a => a.kind === 'image');
  const v = fieldValue(rule.field, product, mp);

  /* regra UNKNOWN: a exigência não está confirmada. Se o dado JÁ satisfaz
     a exigência possível, a dúvida está coberta; se falta o dado, o
     produto exige revisão (finding UNKNOWN → REVIEW_REQUIRED, nunca READY). */
  if (rule.status === 'UNKNOWN') {
    const satisfied = rule.operator === 'required' || rule.operator === 'special'
      ? !missingish(v) && !(typeof v === 'object' && v && !Array.isArray(v) && !Object.keys(v).length)
      : false;
    return satisfied ? null : finding(rule, 'UNKNOWN',
      `${label(rule.field)}: essa exigência ainda não está confirmada para esta categoria — o produto exige revisão antes de publicação`);
  }
  switch (rule.operator) {
    case 'required':
      return missingish(v) ? finding(rule, rule.severity, `${label(rule.field)} não informado`) : null;
    case 'truthy':
      return v ? null : finding(rule, rule.severity, `${label(rule.field)} ausente`);
    case 'maxLength':
      if (missingish(v)) return finding(rule, rule.severity, `${label(rule.field)} ausente`);
      return String(v).length > rule.expectedValue
        ? finding(rule, rule.severity, `${label(rule.field)} excede ${rule.expectedValue} caracteres (${String(v).length})`) : null;
    case 'min':
      if (v == null) return finding(rule, rule.severity, `${label(rule.field)} não informado`);
      return v < rule.expectedValue
        ? finding(rule, rule.severity, `${label(rule.field)} (${v}) abaixo do mínimo ${rule.expectedValue}`) : null;
    case 'max':
      if (v == null) return null;
      return v > rule.expectedValue
        ? finding(rule, rule.severity, `${label(rule.field)} (${round1(v)}) acima do máximo ${rule.expectedValue}`) : null;
    case 'notMatches': {
      if (missingish(v)) return null;
      const rx = new RegExp(rule.expectedValue, 'i');
      return rx.test(String(v))
        ? finding(rule, rule.severity, `${label(rule.field)} contém termo não permitido (${String(v).match(rx)[0]})`) : null;
    }
    case 'minResolution': {
      const bad = images.filter(i => Math.min(i.width || 0, i.height || 0) < rule.expectedValue);
      return bad.length
        ? finding(rule, rule.severity, `${bad.length} imagem(ns) abaixo de ${rule.expectedValue}px no menor lado`) : null;
    }
    case 'ratioBetween': {
      const main = images.find(i => i.role === 'main') || images[0];
      if (!main || !main.width || !main.height) return null;
      const ratio = main.width / main.height;
      const [lo, hi] = rule.expectedValue;
      return (ratio < lo || ratio > hi)
        ? finding(rule, rule.severity, `imagem principal fora da proporção exigida (${round1(ratio)}:1)`) : null;
    }
    case 'categoryRequired': return null;   // tratado pelo resolver (uma regra por atributo)
    case 'special': return null;            // UNKNOWN specials já tratados acima
    default: return null;
  }
}

function finding(rule, severity, message) {
  return {
    id: `${rule.id}`,
    category: rule.requirementType,
    severity,
    field: rule.field,
    message,
    internal: rule.sourceType === 'INTERNAL_OPERATIONAL_RULE',
    rule: {
      id: rule.id, status: rule.status, confidence: rule.confidence,
      sourceType: rule.sourceType, sourceReference: rule.sourceReference,
      rulePackVersion: rule.rulePackVersion, verifiedAt: rule.verifiedAt || null,
    },
  };
}
const label = f => ({
  'title': 'título', 'description': 'descrição', 'price': 'preço', 'stock': 'estoque',
  'derived.imageCount': 'quantidade de imagens', 'derived.hasVideo': 'vídeo',
  'derived.marginPct': 'margem', 'derived.totalLeadDays': 'prazo total (produção + personalização)',
  'derived.customDemandVsCapacity': 'demanda de personalizados vs capacidade',
  'profile.packedWeightG': 'peso embalado', 'profile.packedDims': 'dimensões embaladas',
  'profile.condition': 'condição (novo/usado)', 'profile.ean': 'EAN/GTIN',
  'profile.brand': 'marca', 'profile.cost': 'custo', 'profile.returnPolicy': 'política de devolução',
  'profile.specialPackaging': 'proteção/embalagem especial',
}[f] || f.replace('attributes.', 'atributo obrigatório: ').replace('profile.', ''));
const round1 = v => Math.round(v * 10) / 10;

/* ---------------- imagens/assets extras (metadados) ---------------- */
function validateAssets(product, pack) {
  const out = [];
  const images = (product.assets || []).filter(a => a.kind === 'image');
  const meta = { requirementType: 'IMAGES_AND_ASSETS', rulePackVersion: pack.version,
    sourceType: 'INTERNAL_OPERATIONAL_RULE', status: 'VERIFIED', confidence: 1,
    sourceReference: 'validação de metadados de assets (regra interna)' };
  if (images.length && !images.some(i => i.role === 'main'))
    out.push(finding({ ...meta, id: 'asset-main-missing', field: 'assets.image' },
      'WARNING', 'nenhuma imagem marcada como principal'));
  for (const i of images) {
    if (i.hasWatermark)
      out.push(finding({ ...meta, id: 'asset-watermark', field: 'assets.image' },
        'HIGH_RISK', `imagem "${i.role || i.url || 'galeria'}" contém marca d'água declarada`));
    if (i.hasTextOverlay)
      out.push(finding({ ...meta, id: 'asset-text-overlay', field: 'assets.image' },
        'WARNING', 'imagem com texto excessivo declarado'));
  }
  return out;
}

/* ---------------- AVALIAÇÃO COMPLETA de (produto × praça) ---------------- */
function evaluate(product, platform, { rulePacks = NS.RULE_PACKS, internalRules = NS.INTERNAL_RULES, clock } = {}) {
  const executedAt = clock ? clock.nowIso() : null;
  const pack = rulePacks[platform];
  const base = { platform, productId: product.master.id, productName: product.master.name, executedAt };
  if (!pack)
    return { ...base, status: 'NOT_SUPPORTED', findings: [], missing: [],
             checklist: [], category: null, rulePackVersion: null, dataSource: null };

  const mp = (product.byPlatform && product.byPlatform[platform]) || {};

  /* dados mínimos para avaliar alguma coisa */
  if (!mp.title && !product.profile.basePrice && !(product.assets || []).length)
    return { ...base, status: 'INSUFFICIENT_DATA', findings: [], missing: ['perfil da praça inteiro'],
             checklist: [], category: null, rulePackVersion: pack.version, dataSource: pack.dataSource };

  /* 1. categoria: confirmada > sugerida (nunca inventada) */
  const suggestion = suggestCategory(product, pack);
  const confirmed = mp.categoryStatus === 'CONFIRMED' && mp.categoryId
    && pack.taxonomy.some(c => c.categoryId === mp.categoryId);
  const categoryEntry = pack.taxonomy.find(c =>
    c.categoryId === (confirmed ? mp.categoryId : suggestion.categoryId)) || null;

  const findings = [];
  if (!categoryEntry)
    findings.push(finding({ id: `${platform}-category-missing`, requirementType: 'CATEGORY',
      field: 'categoryId', severity: 'BLOCKER', status: 'VERIFIED', confidence: 1,
      sourceType: 'INTERNAL_OPERATIONAL_RULE', rulePackVersion: pack.version,
      sourceReference: 'sem categoria não há requisitos aplicáveis' },
      'BLOCKER', 'categoria ausente ou sem correspondência na taxonomia conhecida'));
  else {
    if (!confirmed && suggestion.status === 'LOW_CONFIDENCE')
      findings.push(finding({ id: `${platform}-category-low-confidence`, requirementType: 'CATEGORY',
        field: 'categoryId', severity: 'WARNING', status: 'VERIFIED', confidence: 1,
        sourceType: 'INTERNAL_OPERATIONAL_RULE', rulePackVersion: pack.version,
        sourceReference: 'sugestão automática com baixa confiança' },
        'WARNING', `categoria sugerida com baixa confiança (${suggestion.confidence}) — revisão humana necessária`));
    if (categoryEntry.status !== 'VERIFIED')
      findings.push(finding({ id: `${platform}-category-code-unconfirmed`, requirementType: 'CATEGORY',
        field: 'categoryId', severity: 'INFO', status: categoryEntry.status, confidence: 0.7,
        sourceType: categoryEntry.sourceType, sourceReference: categoryEntry.sourceReference,
        rulePackVersion: pack.version },
        'INFO', `código de categoria ${categoryEntry.categoryId} pendente de confirmação oficial`));
  }

  /* 2-9. requisitos por camadas → avaliador */
  const rules = resolveRequirements(pack, internalRules, product, categoryEntry);
  for (const rule of rules) {
    const f = evaluateRule(rule, product, mp);
    if (f) findings.push(f);
  }
  findings.push(...validateAssets(product, pack));

  /* readiness */
  const count = sev => findings.filter(f => f.severity === sev).length;
  const provisionalApplied = rules.filter(r => r.status === 'PROVISIONAL').length;
  const reviewRequired = (!confirmed && suggestion.reviewRequired) || count('UNKNOWN') > 0;
  let status;
  if (count('BLOCKER') > 0) status = 'BLOCKED';
  else if (reviewRequired) status = 'REVIEW_REQUIRED';
  else if (count('HIGH_RISK') + count('WARNING') > 0 || provisionalApplied > 0) status = 'READY_WITH_WARNINGS';
  else status = 'READY';

  const missing = findings
    .filter(f => /não informad|ausente|faltando/.test(f.message) && (f.severity === 'BLOCKER' || f.severity === 'HIGH_RISK'))
    .map(f => label(f.field));

  const checklist = buildChecklist({ findings, suggestion, confirmed, mp, product, status });

  return {
    ...base, status, findings, missing,
    category: { ...suggestion, confirmed: confirmed ? mp.categoryId : null,
                applied: categoryEntry ? categoryEntry.categoryId : null },
    checklist,
    rulePackVersion: pack.version, dataSource: pack.dataSource, verifiedAt: pack.verifiedAt,
    provisionalApplied, unknownFindings: count('UNKNOWN'),
    disclaimer: `validado contra as regras conhecidas do rule pack ${pack.version}` +
      (provisionalApplied ? ` — ${provisionalApplied} regra(s) provisória(s): não é aprovação oficial da plataforma` : ''),
  };
}

/* ---------------- MODO DE REVISÃO: checklist ---------------- */
function buildChecklist({ findings, suggestion, confirmed, mp, product, status }) {
  const has = (cat, sevs = ['BLOCKER', 'HIGH_RISK', 'WARNING', 'UNKNOWN']) =>
    findings.some(f => f.category === cat && sevs.includes(f.severity));
  return [
    { item: 'categoria confirmada', ok: !!confirmed },
    { item: 'atributos obrigatórios preenchidos', ok: !has('REQUIRED_ATTRIBUTES') },
    { item: 'título e descrição dentro das regras', ok: !has('TITLE_AND_DESCRIPTION') },
    { item: 'imagens válidas', ok: !has('IMAGES_AND_ASSETS', ['BLOCKER', 'HIGH_RISK']) },
    { item: 'peso e medidas preenchidos', ok: !has('LOGISTICS_AND_PACKAGING', ['BLOCKER']) },
    { item: 'preço e margem revisados', ok: !has('PRICE_AND_MARGIN') },
    { item: 'prazo validado', ok: !has('PERSONALIZATION', ['BLOCKER', 'HIGH_RISK']) },
    { item: 'dados fiscais e identificação revisados', ok: !has('FISCAL_AND_IDENTIFICATION') },
    { item: 'risco de bloqueio analisado', ok: !has('POLICY_AND_BAN_RISK', ['BLOCKER', 'HIGH_RISK']) },
    { item: 'regras desconhecidas revisadas', ok: !findings.some(f => f.severity === 'UNKNOWN') },
    { item: 'pronto para revisão humana', ok: status === 'READY' || status === 'READY_WITH_WARNINGS' },
  ];
}

/* ---------------- RASCUNHO INTERNO (nunca publicado) ---------------- */
function buildDraft(product, platform, result) {
  const mp = (product.byPlatform && product.byPlatform[platform]) || {};
  const p = product.profile;
  const status = result.status === 'BLOCKED' ? 'BLOCKED'
    : result.status === 'READY' || result.status === 'READY_WITH_WARNINGS' ? 'READY_FOR_REVIEW'
    : 'INCOMPLETE';
  return {
    platform,
    status,
    payload: {
      title: mp.title || product.master.name,
      categoryId: result.category && (result.category.confirmed || result.category.applied) || null,
      categoryPath: result.category && result.category.suggestedCategory || null,
      attributes: mp.attributes || {},
      description: p.description || null,
      images: (product.assets || []).filter(a => a.kind === 'image').map(a => ({ role: a.role, url: a.url })),
      priceSuggested: mp.price ?? p.basePrice ?? null,
      stockSuggested: mp.stock ?? null,
      leadTimeDays: (p.productionDays || 0) + (p.personalizationDays || 0) || null,
      logistics: { packedWeightG: p.packedWeightG || null, packedDims: p.packedDims || null },
      fiscal: { ean: p.ean || null, condition: p.condition || null, origin: p.origin || null,
                brand: p.brand || null, warranty: p.warranty || null },
    },
    findings: result.findings,
    checklist: result.checklist,
    suggestionsSource: `rule pack ${result.rulePackVersion} (${result.dataSource}) · verificado em ${result.verifiedAt}`,
    humanReview: null,             // campo de revisão humana — preenchido por gente
    readOnly: true,                // NADA disto publica em marketplace
  };
}

NS.suggestCategory = suggestCategory;
NS.resolveRequirements = resolveRequirements;
NS.evaluate = evaluate;
NS.buildDraft = buildDraft;
NS.SEVERITIES = SEVERITIES;
NS.RESULTS = RESULTS;
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.HEADCOMPLIANCE = globalThis.HEADCOMPLIANCE || {}));
