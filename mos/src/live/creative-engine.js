/* CREATIVE INTELLIGENCE ENGINE v1 (Sprint 10.A) — SOMENTE Mercado Livre.

   PRODUCT FIDELITY PROTOCOL: antes de qualquer geração nasce um Product
   Truth Pack IMUTÁVEL (fatos + hashes). A IA pode variar cenário, luz,
   ambiente, sombra, enquadramento, composição e fundo — e NUNCA pode
   mudar tamanho, proporção, quantidade, kit, formato, cor, moldura,
   espessura, material, acabamento, vidro, LED, arte, textura, acessórios,
   embalagem, logotipo ou itens inclusos.

   Geração real: provider por variável de ambiente + flag
   CREATIVE_IMAGE_GENERATION_ENABLED (default OFF). Sem provider → gera
   briefing + prompt interno + fila pendente; NUNCA exibe imagem fake
   como se tivesse sido gerada. Revisão humana é SEMPRE obrigatória. */
'use strict';
const crypto = require('node:crypto');

const CREATIVE_TYPES = [
  'MAIN_CLEAN',           // imagem principal limpa
  'AMBIENT',              // imagem de ambiente
  'FINISH_DETAIL',        // detalhe de acabamento
  'SIZE_PROPORTION',      // tamanho e proporção
  'KIT_COMPOSITION',      // kit/composição
  'PACKAGING_PROTECTION', // embalagem e proteção
  'OBJECTION_BREAKER',    // quebra de objeção
  'VISUAL_BENEFIT',       // benefício visual
];

const IMMUTABLE_FACTS = ['dimensions', 'kitQuantity', 'color', 'material', 'finish',
  'frame', 'thickness', 'glass', 'led', 'art', 'accessories', 'packaging', 'includedItems'];

const sha = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

class CreativeEngine {
  constructor({ repos, catalog, flags, clock, queue = null, providers = null, config = {}, logger = null }) {
    this.r = repos; this.catalog = catalog; this.flags = flags; this.clock = clock;
    this.queue = queue; this.log = logger;
    this.cfg = {
      provider: config.provider ?? process.env.CREATIVE_IMAGE_PROVIDER ?? null,
      apiKey: config.apiKey ?? process.env.CREATIVE_IMAGE_API_KEY ?? null,
    };
    this.providers = providers || new Map();   // name → { kind, generate(briefing) }
  }
  registerProvider(name, impl) { this.providers.set(name, impl); }
  providerReady() { return !!(this.cfg.provider && this.providers.has(this.cfg.provider)); }

  /* ---------- Product Truth Pack (imutável, com hash) ---------- */
  buildTruthPack(productId) {
    const c = this.catalog.assemble(productId);
    const p = c.profile;
    const missing = [];
    if (!p.heightCm || !p.widthCm) missing.push('medidas (altura/largura)');
    if (!p.techSheet || !p.techSheet.material) missing.push('material');
    if (!(c.assets || []).some(a => a.kind === 'image')) missing.push('assets oficiais (imagens)');
    if (p.weightG == null) missing.push('peso');
    if (missing.length)
      return { ok: false, status: 'INSUFFICIENT_PRODUCT_TRUTH', missing,
               message: 'Não vou gerar uma imagem porque faltam dados necessários para preservar fidelidade: ' + missing.join('; ') + '.' };
    const pack = {
      productId, sku: c.master.sku, name: c.master.name,
      variations: p.personalization ? p.personalization.fields : [],
      kitQuantity: /kit (\d+)|(\d+) quadros/i.test(c.master.name)
        ? Number((c.master.name.match(/kit (\d+)/i) || c.master.name.match(/(\d+) quadros/i))[1]) : 1,
      dimensions: { heightCm: p.heightCm, widthCm: p.widthCm, depthCm: p.depthCm },
      weightG: p.weightG,
      color: p.techSheet.cor || null,
      material: p.techSheet.material,
      finish: p.techSheet.acabamento || null,
      frame: /moldura/i.test(c.master.name + ' ' + (p.description || '')) ? 'com moldura' : null,
      thickness: p.depthCm ? `${p.depthCm} cm` : null,
      glass: /vidro/i.test(p.description || '') || null,
      led: /led/i.test(p.description || '') || null,
      art: p.techSheet.tema || null,
      accessories: [], packaging: p.specialPackaging || null,
      includedItems: [], restrictions: [],
      officialAssets: (c.assets || []).filter(a => a.kind === 'image')
        .map(a => ({ role: a.role, url: a.url, width: a.width, height: a.height })),
    };
    const row = this.r.truthPack.insert({
      product_id: productId, company_id: c.master.companyId,
      version: (this.r.truthPack.db.get(
        'SELECT COALESCE(MAX(version),0) v FROM product_truth_pack WHERE product_id = ?', productId).v) + 1,
      pack_json: pack, assets_hash: sha(pack.officialAssets), profile_hash: sha(p),
      created_at: this.clock.nowIso(),
    });
    return { ok: true, id: row.id, version: row.version, pack,
             assetsHash: row.assets_hash, profileHash: row.profile_hash };
  }

  /* ---------- briefing estruturado (o que preserva × o que varia) ---------- */
  buildBriefing(pack, creativeType) {
    return {
      creativeType, platform: 'mercado_livre',
      objective: {
        MAIN_CLEAN: 'imagem principal em fundo neutro, produto fiel e centralizado',
        AMBIENT: 'produto aplicado em ambiente realista de sala/quarto',
        FINISH_DETAIL: 'close no acabamento/moldura reais',
        SIZE_PROPORTION: 'comunicar o tamanho real com referência visual honesta',
        KIT_COMPOSITION: 'mostrar o kit completo com a quantidade EXATA',
        PACKAGING_PROTECTION: 'mostrar a embalagem/proteção real',
        OBJECTION_BREAKER: 'responder a objeção recorrente sem promessa indevida',
        VISUAL_BENEFIT: 'benefício visual do produto no espaço',
      }[creativeType],
      mustPreserve: Object.fromEntries(IMMUTABLE_FACTS
        .map(k => [k, pack[k]]).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))),
      mayVary: ['cenário', 'iluminação', 'ambiente', 'sombra', 'enquadramento', 'composição', 'fundo'],
      referenceAssets: pack.officialAssets,
      forbidden: ['texto de promessa', 'logotipo distorcido', 'produto extra', 'acessório inexistente'],
    };
  }

  /* ---------- criação do criativo (geração real só com flag + provider) ---------- */
  createCreative({ productId, companyId, platform, creativeType, sourceAssetIds = [] }) {
    if (platform !== 'mercado_livre')
      throw new Error('Creative Engine v1 é exclusivo do Mercado Livre — não expandir agora');
    if (!CREATIVE_TYPES.includes(creativeType))
      throw new Error(`tipo de criativo desconhecido: ${creativeType}`);
    const tp = this.buildTruthPack(productId);
    if (!tp.ok) return tp;                          // INSUFFICIENT_PRODUCT_TRUTH

    const briefing = this.buildBriefing(tp.pack, creativeType);
    const flagOn = this.flags.isEnabled('CREATIVE_IMAGE_GENERATION_ENABLED', { companyId });
    const canGenerate = flagOn && this.providerReady();

    const row = this.r.creativeAsset.insert({
      product_id: productId, company_id: companyId, platform,
      creative_type: creativeType, truth_pack_id: tp.id,
      source_asset_ids: sourceAssetIds, briefing_json: briefing,
      status: 'CREATIVE_DRAFT',
      provider: canGenerate ? this.cfg.provider : null,
      generation_job: canGenerate ? 'queued' : 'pending-provider',
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso(),
    });
    return {
      ok: true, id: row.id, status: row.status, truthPackId: tp.id, briefing,
      generation: canGenerate
        ? { queued: true, provider: this.cfg.provider }
        : { queued: false, reason: flagOn
            ? 'nenhum provider de imagem configurado (CREATIVE_IMAGE_PROVIDER/CREATIVE_IMAGE_API_KEY) — briefing e prompt interno prontos, fila pendente'
            : 'CREATIVE_IMAGE_GENERATION_ENABLED desligada — briefing pronto; nenhuma imagem foi gerada' },
    };
  }

  /* geração real por job — registra provider/modelo/timestamp; sem retry com resultado */
  async generate(creativeId) {
    const c = this.r.creativeAsset.byId(creativeId);
    if (c.image_url) throw new Error('criativo já tem resultado — retry só é seguro sem resultado');
    if (!this.providerReady()) throw new Error('provider de imagem não configurado');
    const provider = this.providers.get(this.cfg.provider);
    const briefing = JSON.parse(c.briefing_json);
    const result = await provider.generate(briefing);   // { imageUrl, model, cost?, metadata? }
    this.r.creativeAsset.update(creativeId, {
      image_url: result.imageUrl, model: result.model || null,
      generation_job: 'done', status: 'FIDELITY_REVIEW_REQUIRED',
      fidelity_json: this._fidelity(briefing, result),
      updated_at: this.clock.nowIso(),
    });
    return this.r.creativeAsset.byId(creativeId);
  }

  /* validação de fidelidade: metadados declarados × Truth Pack.
     NUNCA afirma "100% fiel" — divergência bloqueia; sem divergência,
     revisão humana continua obrigatória. */
  _fidelity(briefing, result) {
    const declared = result.metadata || {};
    const divergences = [];
    const must = briefing.mustPreserve;
    const checks = [
      ['color', 'cor divergente'], ['kitQuantity', 'quantidade incorreta'],
      ['frame', 'moldura errada'], ['material', 'material alterado'],
      ['dimensions', 'proporção/tamanho divergente'], ['art', 'arte diferente'],
      ['packaging', 'embalagem incorreta'],
    ];
    for (const [k, label] of checks)
      if (must[k] != null && declared[k] != null
          && JSON.stringify(declared[k]) !== JSON.stringify(must[k]))
        divergences.push({ fact: k, label, expected: must[k], got: declared[k] });
    if (declared.extraProducts) divergences.push({ fact: 'extra', label: 'produto extra na cena' });
    if (declared.promiseText) divergences.push({ fact: 'text', label: 'promessa indevida em texto' });
    return {
      checkedAt: this.clock.nowIso(),
      divergences,
      verdict: divergences.length ? 'FIDELITY_FAILED'
        : 'Validação automática sem divergência detectada. Revisão humana ainda obrigatória.',
    };
  }

  /* revisão humana — SEMPRE obrigatória antes de uso em anúncio real */
  humanReview(creativeId, { approved, reviewer, note = null }) {
    const c = this.r.creativeAsset.byId(creativeId);
    const fidelity = JSON.parse(c.fidelity_json || '{}');
    if (fidelity.divergences && fidelity.divergences.length && approved)
      throw new Error(`aprovação bloqueada: divergência de fidelidade detectada (${fidelity.divergences.map(d => d.label).join('; ')})`);
    if (!c.image_url && approved)
      throw new Error('aprovação bloqueada: não existe imagem gerada para revisar');
    return this.r.creativeAsset.update(creativeId, {
      status: approved ? 'APPROVED_FOR_DRAFT' : 'REJECTED',
      human_review: JSON.stringify({ approved, reviewer, note, at: this.clock.nowIso() }),
      updated_at: this.clock.nowIso(),
    });
  }

  attachToDraft(creativeId, draftId) {
    const c = this.r.creativeAsset.byId(creativeId);
    if (c.status !== 'APPROVED_FOR_DRAFT')
      throw new Error('só criativos APPROVED_FOR_DRAFT (com revisão humana) entram no rascunho');
    return this.r.creativeAsset.update(creativeId, { draft_id: draftId, updated_at: this.clock.nowIso() });
  }
}

module.exports = { CreativeEngine, CREATIVE_TYPES, IMMUTABLE_FACTS };
