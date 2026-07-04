/* RULE PACKS (Sprint 10) — as regras POR MARKETPLACE, com proveniência.

   PRINCÍPIO ABSOLUTO: nada aqui é inventado. Toda regra carrega fonte,
   versão, escopo, data de verificação e STATUS DE CONFIANÇA:

     VERIFIED     — documentação oficial amplamente conhecida e estável;
     PROVISIONAL  — regra plausível/observada, pendente de confirmação na
                    versão vigente da política — NUNCA gera aprovação
                    definitiva;
     UNKNOWN      — exigência não confirmada — TRAVA o READY
                    (REVIEW_REQUIRED);
     DEPRECATED / NOT_APPLICABLE.

   Fontes: OFFICIAL_PLATFORM_POLICY · OFFICIAL_SELLER_DOCUMENTATION ·
   OFFICIAL_API_DOCUMENTATION · INTERNAL_OPERATIONAL_RULE ·
   DEMO_RULE_FIXTURE · PUBLIC_RESEARCH_EVIDENCE.

   Regras demo NUNCA são apresentadas como política oficial. Regras
   internas (margem/prazo/capacidade) alertam, mas não fingem ser bloqueio
   da plataforma. Sem scraping: packs estruturados + referências.

   As validações por praça que JÁ existiam no Provider Registry (Sprint 08:
   título ML ≤ 60, preço mínimo Shopee, EAN Magalu, vídeo TikTok) foram
   REAPROVEITADAS como sementes destes packs — agora com proveniência. */
(function (NS) {
'use strict';

const R = (o) => ({ status: 'PROVISIONAL', confidence: 0.7, ...o });

/* -------------------- MERCADO LIVRE -------------------- */
const MERCADO_LIVRE = {
  platform: 'mercado_livre',
  version: 'ml-demo-1.2',
  verifiedAt: '2026-07-04',
  dataSource: 'DEMO_RULE_FIXTURE',   // o PACK é demo; regras individuais têm fonte própria
  taxonomy: [
    { categoryId: 'MLB1367', path: 'Casa, Móveis e Decoração > Decoração > Quadros',
      name: 'Quadros e Molduras', status: 'PROVISIONAL',
      sourceType: 'OFFICIAL_API_DOCUMENTATION',
      sourceReference: 'taxonomia pública via /categories — confirmar código vigente na API oficial',
      keywords: ['quadro', 'moldura', 'canvas', 'poster', 'painel', 'kit quadros'],
      requiredAttributes: ['material', 'largura_cm', 'altura_cm'],
      optionalAttributes: ['estilo', 'tema', 'acabamento'] },
    { categoryId: 'MLB6207', path: 'Casa, Móveis e Decoração > Decoração > Espelhos',
      name: 'Espelhos', status: 'PROVISIONAL',
      sourceType: 'OFFICIAL_API_DOCUMENTATION',
      sourceReference: 'taxonomia pública via /categories — confirmar código vigente',
      keywords: ['espelho', 'espelho decorativo', 'organico'],
      requiredAttributes: ['material', 'formato'],
      optionalAttributes: ['moldura'] },
  ],
  requirements: [
    R({ id: 'ml-title-max', scope: 'global', requirementType: 'TITLE_AND_DESCRIPTION',
        field: 'title', operator: 'maxLength', expectedValue: 60, severity: 'BLOCKER',
        status: 'VERIFIED', confidence: 0.95,
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'developers.mercadolivre.com.br — limite de título de item',
        notes: 'já validado pelo provider desde o Sprint 08' }),
    R({ id: 'ml-title-no-shipping', scope: 'global', requirementType: 'TITLE_AND_DESCRIPTION',
        field: 'title', operator: 'notMatches', expectedValue: 'frete gr[aá]tis|envio gr[aá]tis',
        severity: 'BLOCKER', status: 'VERIFIED', confidence: 0.9,
        sourceType: 'OFFICIAL_PLATFORM_POLICY',
        sourceReference: 'política de títulos — condições de frete não podem constar no título' }),
    R({ id: 'ml-images-min', scope: 'global', requirementType: 'IMAGES_AND_ASSETS',
        field: 'derived.imageCount', operator: 'min', expectedValue: 1, severity: 'BLOCKER',
        status: 'VERIFIED', confidence: 0.9,
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION', sourceReference: 'item exige ao menos 1 imagem' }),
    R({ id: 'ml-images-reco', scope: 'global', requirementType: 'IMAGES_AND_ASSETS',
        field: 'derived.imageCount', operator: 'min', expectedValue: 3, severity: 'WARNING',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'recomendação de 3+ imagens para ranqueamento' }),
    R({ id: 'ml-image-resolution', scope: 'global', requirementType: 'IMAGES_AND_ASSETS',
        field: 'assets.image', operator: 'minResolution', expectedValue: 500, severity: 'WARNING',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'resolução mínima recomendada 500px no menor lado' }),
    R({ id: 'ml-attrs-required', scope: 'category', requirementType: 'REQUIRED_ATTRIBUTES',
        field: 'attributes', operator: 'categoryRequired', severity: 'BLOCKER',
        sourceType: 'OFFICIAL_API_DOCUMENTATION',
        sourceReference: 'atributos obrigatórios por categoria via /categories/{id}/attributes' }),
    R({ id: 'ml-packed-weight', scope: 'logistics', requirementType: 'LOGISTICS_AND_PACKAGING',
        field: 'profile.packedWeightG', operator: 'required', severity: 'BLOCKER',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'peso embalado exigido para cálculo de frete (Mercado Envios)' }),
    R({ id: 'ml-packed-dims', scope: 'logistics', requirementType: 'LOGISTICS_AND_PACKAGING',
        field: 'profile.packedDims', operator: 'required', severity: 'BLOCKER',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'dimensões embaladas exigidas para Mercado Envios' }),
    R({ id: 'ml-condition', scope: 'fiscal', requirementType: 'FISCAL_AND_IDENTIFICATION',
        field: 'profile.condition', operator: 'required', severity: 'BLOCKER',
        status: 'VERIFIED', confidence: 0.9,
        sourceType: 'OFFICIAL_API_DOCUMENTATION', sourceReference: 'condition (new/used) é obrigatório no item' }),
    R({ id: 'ml-gtin-category', scope: 'fiscal', requirementType: 'FISCAL_AND_IDENTIFICATION',
        field: 'profile.ean', operator: 'required', severity: 'UNKNOWN',
        status: 'UNKNOWN', confidence: 0.3,
        sourceType: 'OFFICIAL_PLATFORM_POLICY',
        sourceReference: 'exigência de GTIN varia por categoria — NÃO confirmada para Quadros/Decoração',
        notes: 'enquanto não confirmada, o produto exige revisão antes de publicação' }),
    R({ id: 'ml-fiscal-info', scope: 'fiscal', requirementType: 'POLICY_AND_BAN_RISK',
        field: 'profile.fiscal', operator: 'special', severity: 'UNKNOWN',
        status: 'UNKNOWN', confidence: 0.3,
        sourceType: 'OFFICIAL_PLATFORM_POLICY',
        sourceReference: 'exigências fiscais/regulatórias por categoria — não confirmadas nesta versão do pack' }),
  ],
};

/* -------------------- SHOPEE -------------------- */
const SHOPEE = {
  platform: 'shopee',
  version: 'shp-demo-1.1',
  verifiedAt: '2026-07-04',
  dataSource: 'DEMO_RULE_FIXTURE',
  taxonomy: [
    { categoryId: '100636', path: 'Casa e Decoração > Decoração > Quadros e Molduras',
      name: 'Quadros e Molduras', status: 'PROVISIONAL',
      sourceType: 'OFFICIAL_API_DOCUMENTATION',
      sourceReference: 'get_category — confirmar id vigente na Open Platform',
      keywords: ['quadro', 'kit quadros', 'canvas', 'painel', 'moldura'],
      requiredAttributes: ['material'],
      optionalAttributes: ['estilo', 'dimensoes'] },
    { categoryId: '100637', path: 'Casa e Decoração > Decoração > Espelhos',
      name: 'Espelhos', status: 'PROVISIONAL',
      sourceType: 'OFFICIAL_API_DOCUMENTATION', sourceReference: 'get_category — confirmar id vigente',
      keywords: ['espelho', 'espelho decorativo'],
      requiredAttributes: ['material'], optionalAttributes: [] },
  ],
  requirements: [
    R({ id: 'shp-title-max', scope: 'global', requirementType: 'TITLE_AND_DESCRIPTION',
        field: 'title', operator: 'maxLength', expectedValue: 100, severity: 'BLOCKER',
        status: 'VERIFIED', confidence: 0.9,
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION', sourceReference: 'limite de título na Shopee BR' }),
    R({ id: 'shp-min-price', scope: 'global', requirementType: 'PRICE_AND_MARGIN',
        field: 'price', operator: 'min', expectedValue: 5, severity: 'BLOCKER',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'preço mínimo de listagem — semente do provider S08; confirmar valor vigente' }),
    R({ id: 'shp-images-min', scope: 'global', requirementType: 'IMAGES_AND_ASSETS',
        field: 'derived.imageCount', operator: 'min', expectedValue: 3, severity: 'BLOCKER',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'mínimo de imagens por anúncio — semente do provider S08' }),
    R({ id: 'shp-image-ratio', scope: 'global', requirementType: 'IMAGES_AND_ASSETS',
        field: 'assets.image', operator: 'ratioBetween', expectedValue: [0.99, 1.01], severity: 'WARNING',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'imagem principal quadrada (1:1) recomendada/exigida — confirmar por categoria' }),
    R({ id: 'shp-attrs-required', scope: 'category', requirementType: 'REQUIRED_ATTRIBUTES',
        field: 'attributes', operator: 'categoryRequired', severity: 'BLOCKER',
        sourceType: 'OFFICIAL_API_DOCUMENTATION', sourceReference: 'get_attributes por categoria' }),
    R({ id: 'shp-stock-required', scope: 'logistics', requirementType: 'LOGISTICS_AND_PACKAGING',
        field: 'stock', operator: 'min', expectedValue: 1, severity: 'BLOCKER',
        status: 'VERIFIED', confidence: 0.85,
        sourceType: 'OFFICIAL_API_DOCUMENTATION', sourceReference: 'estoque > 0 para item ativo' }),
    R({ id: 'shp-packed-weight', scope: 'logistics', requirementType: 'LOGISTICS_AND_PACKAGING',
        field: 'profile.packedWeightG', operator: 'required', severity: 'BLOCKER',
        sourceType: 'OFFICIAL_API_DOCUMENTATION', sourceReference: 'peso exigido para logística Shopee' }),
    R({ id: 'shp-dts-max', scope: 'personalization', requirementType: 'PERSONALIZATION',
        field: 'derived.totalLeadDays', operator: 'max', expectedValue: 10, severity: 'HIGH_RISK',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'DTS/pré-venda tem teto de dias de preparo — confirmar teto vigente por categoria' }),
    R({ id: 'shp-image-size-max', scope: 'global', requirementType: 'IMAGES_AND_ASSETS',
        field: 'derived.imageSizesKnown', operator: 'special', severity: 'UNKNOWN',
        status: 'UNKNOWN', confidence: 0.3,
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'tamanho máximo de arquivo por imagem — não confirmado nesta versão do pack' }),
  ],
};

/* -------------------- TIKTOK SHOP -------------------- */
const TIKTOK = {
  platform: 'tiktok',
  version: 'ttk-demo-0.9',
  verifiedAt: '2026-07-04',
  dataSource: 'DEMO_RULE_FIXTURE',
  taxonomy: [
    { categoryId: 'ttk-home-decor', path: 'Home & Living > Home Decor > Wall Decor',
      name: 'Wall Decor', status: 'PROVISIONAL',
      sourceType: 'OFFICIAL_API_DOCUMENTATION',
      sourceReference: 'category tree do Partner Center — exige parceria aprovada para confirmar',
      keywords: ['quadro', 'canvas', 'poster', 'wall', 'decor', 'kit quadros'],
      requiredAttributes: ['material'], optionalAttributes: ['estilo'] },
  ],
  requirements: [
    R({ id: 'ttk-title-max', scope: 'global', requirementType: 'TITLE_AND_DESCRIPTION',
        field: 'title', operator: 'maxLength', expectedValue: 80, severity: 'BLOCKER',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'limite de título — semente do provider S08; confirmar no Partner Center' }),
    R({ id: 'ttk-images-min', scope: 'global', requirementType: 'IMAGES_AND_ASSETS',
        field: 'derived.imageCount', operator: 'min', expectedValue: 1, severity: 'BLOCKER',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION', sourceReference: 'ao menos 1 imagem de produto' }),
    R({ id: 'ttk-video-reco', scope: 'global', requirementType: 'IMAGES_AND_ASSETS',
        field: 'derived.hasVideo', operator: 'truthy', severity: 'WARNING',
        sourceType: 'INTERNAL_OPERATIONAL_RULE',
        sourceReference: 'canal é orientado a conteúdo: vídeo converte mais (regra interna, semente S08)' }),
    R({ id: 'ttk-packed-weight', scope: 'logistics', requirementType: 'LOGISTICS_AND_PACKAGING',
        field: 'profile.packedWeightG', operator: 'required', severity: 'BLOCKER',
        sourceType: 'OFFICIAL_API_DOCUMENTATION', sourceReference: 'peso do pacote exigido no cadastro' }),
    R({ id: 'ttk-policy-claims', scope: 'global', requirementType: 'POLICY_AND_BAN_RISK',
        field: 'description', operator: 'notMatches',
        expectedValue: 'cura|milagre|aprovado pela anvisa|original de marca',
        severity: 'HIGH_RISK',
        sourceType: 'OFFICIAL_PLATFORM_POLICY',
        sourceReference: 'políticas de alegações proibidas — lista mínima; conjunto completo não confirmado' }),
    R({ id: 'ttk-restricted', scope: 'global', requirementType: 'POLICY_AND_BAN_RISK',
        field: 'derived.productType', operator: 'special', severity: 'UNKNOWN',
        status: 'UNKNOWN', confidence: 0.3,
        sourceType: 'OFFICIAL_PLATFORM_POLICY',
        sourceReference: 'lista de categorias restritas exige parceria aprovada — não confirmada' }),
  ],
};

/* -------------------- MAGALU -------------------- */
const MAGALU = {
  platform: 'magalu',
  version: 'mgl-demo-0.9',
  verifiedAt: '2026-07-04',
  dataSource: 'DEMO_RULE_FIXTURE',
  taxonomy: [
    { categoryId: 'mgl-decoracao-quadros', path: 'Decoração > Quadros e Painéis',
      name: 'Quadros e Painéis', status: 'PROVISIONAL',
      sourceType: 'OFFICIAL_API_DOCUMENTATION',
      sourceReference: 'árvore de categorias do portal — exige credenciamento para confirmar',
      keywords: ['quadro', 'painel', 'kit quadros', 'canvas'],
      requiredAttributes: ['material', 'ean'], optionalAttributes: [] },
  ],
  requirements: [
    R({ id: 'mgl-ean-required', scope: 'fiscal', requirementType: 'FISCAL_AND_IDENTIFICATION',
        field: 'profile.ean', operator: 'required', severity: 'BLOCKER',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION',
        sourceReference: 'EAN/GTIN obrigatório no catálogo — semente do provider S08; confirmar exceções' }),
    R({ id: 'mgl-brand-required', scope: 'fiscal', requirementType: 'FISCAL_AND_IDENTIFICATION',
        field: 'profile.brand', operator: 'required', severity: 'BLOCKER',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION', sourceReference: 'marca obrigatória no cadastro' }),
    R({ id: 'mgl-images-min', scope: 'global', requirementType: 'IMAGES_AND_ASSETS',
        field: 'derived.imageCount', operator: 'min', expectedValue: 2, severity: 'BLOCKER',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION', sourceReference: 'mínimo de imagens — semente S08' }),
    R({ id: 'mgl-packed-dims', scope: 'logistics', requirementType: 'LOGISTICS_AND_PACKAGING',
        field: 'profile.packedDims', operator: 'required', severity: 'BLOCKER',
        sourceType: 'OFFICIAL_SELLER_DOCUMENTATION', sourceReference: 'dimensões exigidas para frete' }),
    R({ id: 'mgl-fiscal-nf', scope: 'fiscal', requirementType: 'FISCAL_AND_IDENTIFICATION',
        field: 'profile.fiscal', operator: 'special', severity: 'UNKNOWN',
        status: 'UNKNOWN', confidence: 0.3,
        sourceType: 'OFFICIAL_PLATFORM_POLICY',
        sourceReference: 'exigências fiscais (NF/origem) por categoria — não confirmadas nesta versão' }),
  ],
};

/* -------------------- REGRAS INTERNAS (da EMPRESA, não da praça) --------------------
   Alertam sobre margem, prazo, capacidade e operação. NUNCA são
   apresentadas como bloqueio oficial de marketplace. */
const INTERNAL_RULES = [
  { id: 'int-min-margin', scope: 'internal', requirementType: 'PRICE_AND_MARGIN',
    field: 'derived.marginPct', operator: 'min', expectedValue: 20, severity: 'HIGH_RISK',
    status: 'VERIFIED', confidence: 1,
    sourceType: 'INTERNAL_OPERATIONAL_RULE',
    sourceReference: 'política interna: margem mínima de 20% para publicar',
    rulePackVersion: 'internal-1.0', verifiedAt: '2026-07-04' },
  { id: 'int-cost-required', scope: 'internal', requirementType: 'PRICE_AND_MARGIN',
    field: 'profile.cost', operator: 'required', severity: 'WARNING',
    status: 'VERIFIED', confidence: 1,
    sourceType: 'INTERNAL_OPERATIONAL_RULE',
    sourceReference: 'sem custo registrado não há cálculo de margem confiável',
    rulePackVersion: 'internal-1.0', verifiedAt: '2026-07-04' },
  { id: 'int-custom-capacity', scope: 'internal', requirementType: 'PERSONALIZATION',
    field: 'derived.customDemandVsCapacity', operator: 'max', expectedValue: 1, severity: 'HIGH_RISK',
    status: 'VERIFIED', confidence: 1,
    sourceType: 'INTERNAL_OPERATIONAL_RULE',
    sourceReference: 'demanda de personalizados não pode exceder a capacidade/dia da fábrica',
    rulePackVersion: 'internal-1.0', verifiedAt: '2026-07-04' },
  { id: 'int-custom-return-policy', scope: 'internal', requirementType: 'PERSONALIZATION',
    field: 'profile.returnPolicy', operator: 'required', severity: 'WARNING',
    status: 'VERIFIED', confidence: 1,
    sourceType: 'INTERNAL_OPERATIONAL_RULE',
    sourceReference: 'personalizado exige política de devolução definida antes de publicar',
    rulePackVersion: 'internal-1.0', verifiedAt: '2026-07-04',
    appliesWhen: 'personalized' },
  { id: 'int-fragile-packaging', scope: 'internal', requirementType: 'LOGISTICS_AND_PACKAGING',
    field: 'profile.specialPackaging', operator: 'required', severity: 'WARNING',
    status: 'VERIFIED', confidence: 1,
    sourceType: 'INTERNAL_OPERATIONAL_RULE',
    sourceReference: 'produto frágil (vidro/espelho) exige proteção declarada',
    rulePackVersion: 'internal-1.0', verifiedAt: '2026-07-04',
    appliesWhen: 'fragile' },
];

const RULE_PACKS = { mercado_livre: MERCADO_LIVRE, shopee: SHOPEE, tiktok: TIKTOK, magalu: MAGALU };

NS.RULE_PACKS = RULE_PACKS;
NS.INTERNAL_RULES = INTERNAL_RULES;
NS.RULE_STATUS = ['VERIFIED', 'PROVISIONAL', 'UNKNOWN', 'DEPRECATED', 'NOT_APPLICABLE'];
NS.SOURCE_TYPES = ['OFFICIAL_PLATFORM_POLICY', 'OFFICIAL_SELLER_DOCUMENTATION',
  'OFFICIAL_API_DOCUMENTATION', 'INTERNAL_OPERATIONAL_RULE', 'DEMO_RULE_FIXTURE',
  'PUBLIC_RESEARCH_EVIDENCE'];
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.HEADCOMPLIANCE = globalThis.HEADCOMPLIANCE || {}));
