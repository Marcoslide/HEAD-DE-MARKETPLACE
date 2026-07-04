/* STRATEGIC MARKETPLACE KNOWLEDGE EXPANSION (Sprint 10.K.1).

   Enriquecimento da inteligência EXISTENTE (10.K): Customer Outcome,
   Jobs-to-be-Done, playbooks estratégicos, ciclo de vida e funil.

   PRODUCT_AGNOSTIC por construção: quadros/espelhos/etc. são fixtures —
   nunca regra universal. Tudo varia por empresa, conta, praça, categoria,
   tipo de produto, margem e estágio. Playbook ≠ regra oficial; o Método
   R.E.A.L. segue playbook e jamais toca compliance técnico. Linguagem
   honesta sempre: "há indício de…", nunca fórmula garantida de algoritmo. */
'use strict';

const OUTCOME_STATUSES = ['DRAFT', 'SUGGESTED_BY_RID', 'CONFIRMED_INTERNAL',
  'TESTED_IN_MARKET', 'NEEDS_REVIEW', 'STALE'];
const LIFECYCLE_STAGES = ['IDEA', 'RESEARCH', 'VALIDATION', 'LAUNCH',
  'EARLY_TRACTION', 'GROWING', 'SCALING', 'CHAMPION', 'SATURATING',
  'DECLINING', 'REPOSITIONING', 'DISCONTINUED'];
const PLAYBOOK_CATEGORIES = ['Product Discovery', 'Product Validation',
  'Product Launch', 'Offer Design', 'Customer Outcome', 'Marketplace SEO',
  'Category Strategy', 'Listing Optimization', 'Image Strategy', 'Video Strategy',
  'Description Strategy', 'Conversion Optimization', 'Objection Handling',
  'Pricing Strategy', 'Margin Protection', 'Promotion Strategy', 'Ads Strategy',
  'Ranking Strategy', 'Affiliate Strategy', 'Creator Strategy',
  'Live Commerce Strategy', 'Kit and Bundle Strategy', 'Logistics Strategy',
  'Retention', 'Review Strategy', 'Reputation Strategy', 'Return Reduction',
  'Scaling Strategy', 'Saturation Strategy', 'Product Lifecycle',
  'Operational Readiness', 'Experiment Design', 'Method R.E.A.L.'];
const FUNNEL_STAGES = ['IMPRESSAO', 'CLIQUE', 'VISITA', 'CARRINHO', 'COMPRA',
  'PAGAMENTO', 'PREPARACAO', 'ENVIO', 'ENTREGA', 'AVALIACAO', 'RECOMPRA', 'INDICACAO'];

/* ---------- Customer Outcome Model + Jobs-to-be-Done ---------- */
class OutcomeProfileService {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  upsert({ companyId, productId, source, ...fields }) {
    if (!source) throw new Error('outcome profile exige fonte rastreável');
    if (fields.status && !OUTCOME_STATUSES.includes(fields.status))
      throw new Error(`status inválido: ${fields.status}`);
    const row = {
      company_id: companyId, product_id: productId,
      category_id: fields.categoryId ?? null, product_type: fields.productType ?? null,
      target_audience: fields.targetAudience ?? null,
      primary_customer_problem: fields.primaryCustomerProblem ?? null,
      secondary_problems_json: fields.secondaryProblems ?? [],
      desired_outcome: fields.desiredOutcome ?? null,
      functional_benefits_json: fields.functionalBenefits ?? [],
      emotional_benefits_json: fields.emotionalBenefits ?? [],
      social_benefits_json: fields.socialBenefits ?? [],
      daily_use_cases_json: fields.dailyUseCases ?? [],
      before_state: fields.beforeState ?? null, after_state: fields.afterState ?? null,
      purchase_triggers_json: fields.purchaseTriggers ?? [],
      objections_json: fields.objections ?? [],
      proof_points_json: fields.proofPoints ?? [],
      differentiation: fields.differentiation ?? null,
      usage_instructions: fields.usageInstructions ?? null,
      ideal_customer_context: fields.idealCustomerContext ?? null,
      unsuitable_customer_context: fields.unsuitableCustomerContext ?? null,
      risk_of_misunderstanding: fields.riskOfMisunderstanding ?? null,
      key_message: fields.keyMessage ?? null,
      transformation_statement: fields.transformationStatement ?? null,
      functional_job: fields.functionalJob ?? null,
      emotional_job: fields.emotionalJob ?? null,
      social_job: fields.socialJob ?? null,
      usage_moment: fields.usageMoment ?? null,
      usage_frequency: fields.usageFrequency ?? null,
      setup_required: fields.setupRequired ?? null,
      learning_curve: fields.learningCurve ?? null,
      installation_required: fields.installationRequired ? 1 : 0,
      compatibility_required: fields.compatibilityRequired ?? null,
      maintenance_required: fields.maintenanceRequired ?? null,
      usage_risk: fields.usageRisk ?? null,
      expected_customer_skill_level: fields.expectedCustomerSkillLevel ?? null,
      post_purchase_support_need: fields.postPurchaseSupportNeed ?? null,
      source, confidence: fields.confidence ?? 'PROVISIONAL',
      status: fields.status ?? 'DRAFT', updated_at: this.clock.nowIso(),
    };
    const existing = this.r.outcomeProfile.db.get(
      'SELECT id FROM product_outcome_profile WHERE company_id = ? AND product_id = ?',
      companyId, productId);
    const saved = existing ? this.r.outcomeProfile.update(existing.id, row)
      : this.r.outcomeProfile.insert({ ...row, created_at: this.clock.nowIso() });
    this.r.audit.record('outcome', existing ? 'updated' : 'created', { companyId,
      entity: 'product_outcome_profile', entityId: saved.id,
      detail: { productId, source, status: saved.status } });
    return saved;
  }

  get(companyId, productId) {
    return this.r.outcomeProfile.db.get(
      'SELECT * FROM product_outcome_profile WHERE company_id = ? AND product_id = ?',
      companyId, productId) || null;
  }
}

/* ---------- Playbooks estratégicos (nunca regra oficial) ---------- */
class PlaybookLibrary {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  add({ companyId = null, title, category, whenToUse, whenNotToUse, source,
        marketplaces = [], categories = [], productTypes = [], businessModels = [],
        lifecycleStages = [], priceRange = null, prerequisites = [],
        expectedBenefit = null, risk = null, actionSteps = [], requiredData = [],
        metrics = [], successCriteria = null, stopCriteria = null,
        impactOnMargin = null, impactOnOperation = null,
        confidence = 'PROVISIONAL', evidence = [], realMethodPrinciple = null }) {
    if (!PLAYBOOK_CATEGORIES.includes(category))
      throw new Error(`categoria de playbook inválida: ${category}`);
    if (!whenToUse || !whenNotToUse)
      throw new Error('playbook exige "quando usar" E "quando não usar"');
    if (!metrics.length || !risk)
      throw new Error('playbook estratégico exige métrica e risco declarados');
    if (confidence === 'VERIFIED_OFFICIAL')
      throw new Error('playbook é estratégia — nunca regra oficial de plataforma');
    const saved = this.r.playbook.insert({ company_id: companyId, title, category,
      applicable_marketplaces_json: marketplaces, applicable_categories_json: categories,
      applicable_product_types_json: productTypes,
      applicable_business_models_json: businessModels,
      applicable_lifecycle_stage_json: lifecycleStages,
      applicable_price_range: priceRange, when_to_use: whenToUse,
      when_not_to_use: whenNotToUse, prerequisites_json: prerequisites,
      expected_benefit: expectedBenefit, risk, action_steps_json: actionSteps,
      required_data_json: requiredData, metrics_json: metrics,
      success_criteria: successCriteria, stop_criteria: stopCriteria,
      impact_on_margin: impactOnMargin, impact_on_operation: impactOnOperation,
      confidence, source, evidence_json: evidence,
      linked_real_method_principle: realMethodPrinciple, status: 'ACTIVE',
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    this.r.audit.record('playbook', 'added', { companyId,
      entity: 'marketplace_playbook', entityId: saved.id,
      detail: { category, confidence, source } });
    return saved;
  }

  /* seleção contextual: praça/tipo/estágio filtram; vazio = aplicável a todos */
  select({ companyId = null, marketplace = null, productType = null, stage = null,
           category = null }) {
    const fits = (jsonList, v) => {
      if (!v) return true;
      const list = JSON.parse(jsonList || '[]');
      return !list.length || list.includes(v);
    };
    return this.r.playbook.db.all(
      `SELECT * FROM marketplace_playbook WHERE status = 'ACTIVE'
       AND (company_id IS NULL OR company_id = ?)`, companyId)
      .filter(p => fits(p.applicable_marketplaces_json, marketplace)
        && fits(p.applicable_product_types_json, productType)
        && fits(p.applicable_lifecycle_stage_json, stage)
        && (!category || p.category === category));
  }
}

/* ---------- Product Lifecycle Intelligence ---------- */
const STAGE_MOVES = {
  IDEA: ['pesquisar demanda', 'validar categoria', 'analisar concorrência',
    'estimar margem', 'definir proposta de valor'],
  RESEARCH: ['mapear concorrentes', 'levantar preço de mercado', 'testar interesse'],
  VALIDATION: ['validar margem real', 'confirmar operação', 'definir oferta mínima'],
  LAUNCH: ['criar oferta clara', 'validar imagem principal', 'testar título',
    'buscar primeiras conversões', 'monitorar devolução'],
  EARLY_TRACTION: ['consolidar avaliação', 'ajustar oferta pelo feedback'],
  GROWING: ['abrir novos marketplaces', 'testar Ads', 'testar kits',
    'ampliar variações', 'proteger margem'],
  SCALING: ['garantir capacidade', 'automatizar operação', 'proteger prazo'],
  CHAMPION: ['monitorar concorrência', 'proteger estoque', 'otimizar operação',
    'ampliar canais', 'evitar perda de reputação'],
  SATURATING: ['renovar criativo', 'revisar preço', 'criar kit',
    'testar reposicionamento', 'buscar nova audiência'],
  DECLINING: ['reduzir investimento', 'liquidar com margem controlada',
    'ajustar catálogo', 'substituir produto', 'aprender com o ciclo'],
  REPOSITIONING: ['redefinir oferta', 'testar novo público', 'medir contra baseline'],
  DISCONTINUED: ['encerrar anúncios internamente', 'registrar aprendizado do ciclo'],
};

class LifecycleService {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }
  setStage(companyId, productId, stage, { by = null } = {}) {
    if (!LIFECYCLE_STAGES.includes(stage)) throw new Error(`estágio inválido: ${stage}`);
    const existing = this.r.lifecycle.db.get(
      'SELECT * FROM product_lifecycle WHERE company_id = ? AND product_id = ?',
      companyId, productId);
    const history = existing ? JSON.parse(existing.history_json || '[]') : [];
    history.push({ stage, at: this.clock.nowIso(), by });
    const saved = existing
      ? this.r.lifecycle.update(existing.id, { stage, history_json: history,
          changed_by: by, updated_at: this.clock.nowIso() })
      : this.r.lifecycle.insert({ company_id: companyId, product_id: productId,
          stage, history_json: history, changed_by: by,
          created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    this.r.audit.record('lifecycle', 'stage_set', { companyId,
      entity: 'product_lifecycle', entityId: saved.id, detail: { productId, stage, by } });
    return saved;
  }
  get(companyId, productId) {
    return this.r.lifecycle.db.get(
      'SELECT * FROM product_lifecycle WHERE company_id = ? AND product_id = ?',
      companyId, productId) || null;
  }
  movesFor(stage) { return STAGE_MOVES[stage] || []; }
}

/* ---------- Funil de marketplace: diagnóstico por etapa ---------- */
function diagnoseFunnel({ impressions = null, clicks = null, visits = null,
                          orders = null, revenue = null, netMarginPct = null,
                          minMarginPct = null, returnsPct = null,
                          returnReasons = [] } = {}) {
  const findings = [];
  const hyp = (stage, fact, hypotheses) => findings.push({ stage, fact,
    hypotheses, kind: 'HIPOTESE',
    honest: 'há indício — precisa de teste/confirmação antes de concluir' });

  const ctr = impressions && clicks != null ? clicks / impressions : null;
  const conv = clicks && orders != null ? orders / clicks : null;
  if (impressions != null && impressions < 100)
    hyp('IMPRESSAO', `impressões baixas (${impressions})`,
      ['categoria errada', 'SEO fraco', 'anúncio novo', 'preço pouco competitivo',
       'ausência de campanha', 'pouca autoridade']);
  if (ctr != null && ctr < 0.02 && impressions >= 100)
    hyp('CLIQUE', `impressão alta com CTR baixo (${(ctr * 100).toFixed(1)}%)`,
      ['imagem principal', 'título', 'preço', 'frete', 'promessa pouco clara']);
  if (conv != null && conv < 0.02 && ctr != null && ctr >= 0.02)
    hyp('COMPRA', `CTR saudável com conversão baixa (${(conv * 100).toFixed(1)}%)`,
      ['preço', 'prazo', 'descrição', 'avaliação', 'variação', 'falta de confiança',
       'expectativa desalinhada', 'frete', 'estoque']);
  if (revenue != null && netMarginPct != null && minMarginPct != null
      && revenue > 0 && netMarginPct < minMarginPct)
    findings.push({ stage: 'PAGAMENTO', kind: 'ALERTA_RENTABILIDADE',
      fact: `venda existe (R$ ${revenue}) mas margem líquida ${netMarginPct}% < mínimo ${minMarginPct}%`,
      message: 'Esse produto vende, mas a margem líquida está abaixo do mínimo. ' +
        'O problema não é falta de demanda; é estrutura de rentabilidade.',
      hypotheses: ['Ads', 'desconto', 'frete subsidiado', 'comissão', 'devolução',
        'avaria', 'afiliado', 'preço inadequado'] });
  if (returnsPct != null && returnsPct > 0.06) {
    const expectation = returnReasons.filter(r =>
      /tamanho|medida|cor|diferente|esperava|compatib|uso|nao serve|não serve/i.test(r));
    const expectationShare = returnReasons.length
      ? expectation.length / returnReasons.length : 0;
    findings.push({ stage: 'ENTREGA', kind: 'HIPOTESE',
      fact: `devolução alta (${(returnsPct * 100).toFixed(1)}%)`,
      hypotheses: expectationShare >= 0.5
        ? ['expectativa mal gerida no anúncio (não defeito)']
        : ['produto', 'expectativa', 'anúncio', 'embalagem', 'entrega',
           'compatibilidade', 'instrução de uso'],
      message: expectationShare >= 0.5
        ? 'Há indício de que parte das devoluções não ocorre por falha do produto, ' +
          'mas porque o uso, dimensão ou compatibilidade não ficou claro no anúncio. ' +
          'Recomendo ajustar imagem, vídeo, FAQ e comparação de tamanho antes de mudar o produto.'
        : null });
  }
  return { stages: FUNNEL_STAGES, findings,
    separation: { FATO: findings.map(f => f.fact),
      HIPOTESE: findings.flatMap(f => f.hypotheses || []) } };
}

/* ---------- Strategy Advisor: cruza tudo antes de recomendar ---------- */
class StrategyAdvisor {
  constructor({ repos, outcomes, lifecycle, playbooks, clock }) {
    this.r = repos; this.outcomes = outcomes; this.lifecycle = lifecycle;
    this.playbooks = playbooks; this.clock = clock;
  }

  /* recomendação estratégica: outcome + estágio + margem + playbook,
     SEMPRE com métrica, risco e ponto de parada — linguagem honesta */
  recommend({ companyId, productId, marketplace = null, goal,
              funnel = null, marginOk = null }) {
    const outcome = this.outcomes.get(companyId, productId);
    const lc = this.lifecycle.get(companyId, productId);
    const stage = lc ? lc.stage : null;

    /* Ads NUNCA é recomendado sem base validada */
    if (goal === 'ads') {
      const conversionOk = funnel && funnel.findings
        && !funnel.findings.some(f => ['CLIQUE', 'COMPRA'].includes(f.stage));
      if (!outcome || marginOk === false || !conversionOk)
        return { recommended: false, goal,
          verdict: 'NAO_RECOMENDADO_AINDA',
          reason: 'Ads acelera oferta validada — não corrige produto, imagem fraca ou margem errada. ' +
            `Falta base: ${[!outcome && 'Customer Outcome não confirmado',
              marginOk === false && 'margem abaixo do mínimo',
              !conversionOk && 'conversão/CTR sem validação'].filter(Boolean).join('; ')}.`,
          nextStep: 'validar oferta, margem e conversão em escala orgânica primeiro' };
    }

    const picks = this.playbooks.select({ companyId, marketplace,
      productType: outcome ? outcome.product_type : null, stage });
    const playbook = picks[0] || null;
    const rec = {
      goal, stage, stageMoves: stage ? this.lifecycle.movesFor(stage) : [],
      outcomeUsed: !!outcome,
      outcomeSummary: outcome ? {
        transformation: outcome.transformation_statement,
        dailyUse: JSON.parse(outcome.daily_use_cases_json || '[]'),
        objections: JSON.parse(outcome.objections_json || '[]'),
        proofPoints: JSON.parse(outcome.proof_points_json || '[]') } : null,
      playbook: playbook ? { title: playbook.title, category: playbook.category,
        whenToUse: playbook.when_to_use, whenNotToUse: playbook.when_not_to_use,
        metrics: JSON.parse(playbook.metrics_json || '[]'),
        risk: playbook.risk, stopCriteria: playbook.stop_criteria,
        confidence: playbook.confidence } : null,
      separation: {
        FATO: outcome ? `perfil de outcome ${outcome.status}` : 'sem outcome profile',
        HIPOTESE: playbook ? `esse playbook costuma funcionar quando ${playbook.when_to_use}` : null,
        PLAYBOOK: playbook ? playbook.title : null,
        TESTE: 'vale testar em escala controlada antes de expandir',
        RECOMENDACAO: null, RISCO: playbook ? playbook.risk : null,
        METRICA: playbook ? JSON.parse(playbook.metrics_json || '[]') : [],
        PONTO_DE_PARADA: playbook ? playbook.stop_criteria : null,
      },
      honestLanguage: outcome
        ? `Há indício de que a comunicação deve vender a transformação ("${outcome.transformation_statement || outcome.desired_outcome}"), não só a especificação.`
        : 'Ainda não há dados suficientes para concluir — recomendo preencher o Customer Outcome Profile antes de investir em criativo/anúncio.',
      recommended: !!outcome,
      asOf: this.clock.nowIso(),
    };
    rec.separation.RECOMENDACAO = rec.honestLanguage;
    this.r.audit.record('strategy', 'recommended', { companyId,
      entity: 'product', entityId: productId,
      detail: { goal, stage, playbook: playbook ? playbook.id : null,
        outcomeUsed: rec.outcomeUsed } });
    return rec;
  }

  /* kit/bundle: só com margem + logística consideradas */
  recommendKit({ companyId, items = [] }) {
    const missing = [];
    for (const it of items) {
      if (it.marginPct == null) missing.push(`${it.sku}: margem`);
      if (it.packedWeightG == null) missing.push(`${it.sku}: peso/logística`);
    }
    if (missing.length)
      return { recommended: false,
        reason: `kit exige margem e logística de CADA item — falta: ${missing.join('; ')}` };
    const marginAvg = items.reduce((a, i) => a + i.marginPct, 0) / items.length;
    return { recommended: true,
      note: 'há indício de uso conjunto — validar transformação para o cliente e risco operacional',
      combinedMarginPct: Math.round(marginAvg * 10) / 10,
      metrics: ['conversão do kit', 'margem líquida do kit', 'devolução do kit'],
      stopCriteria: 'margem do kit abaixo do mínimo ou devolução acima do produto isolado' };
  }
}

/* ---------- carga seed MULTINICHO (fixtures — nunca regra universal) ---------- */
function seedStrategy(playbooks) {
  const seeds = [
    ['Imagem principal com benefício perceptível', 'Image Strategy',
      'CTR baixo com impressão saudável', 'imagem já validada por teste recente',
      ['CTR', 'conversão'], 'trocar imagem vencedora sem teste pode derrubar conversão',
      'reverter à imagem anterior se CTR cair por 7 dias', null],
    ['Lançamento controlado com preço de entrada', 'Product Launch',
      'produto novo sem histórico de conversão', 'produto com margem já no limite',
      ['conversão', 'margem líquida', 'devolução'],
      'preço de entrada pode virar prejuízo invisível se não tiver fim',
      'encerrar quando atingir N vendas/avaliações OU margem < mínimo', null],
    ['Kit complementar para elevar ticket', 'Kit and Bundle Strategy',
      'itens com uso conjunto comprovado e logística compatível',
      'itens frágeis com embalagens incompatíveis ou margens díspares',
      ['ticket médio', 'margem do kit', 'devolução'],
      'complexidade operacional e avaria', 'devolução do kit > item isolado', null],
    ['Renovar criativo em saturação', 'Saturation Strategy',
      'produto CHAMPION/SATURATING com CTR em queda', 'produto em lançamento',
      ['CTR', 'conversão', 'ranking'], 'renovação sem baseline confunde a leitura',
      'sem melhora de CTR em 14 dias → testar reposicionamento',
      'Retenção e Emoção (Método R.E.A.L.)'],
    ['Quebra de objeção na galeria e FAQ', 'Objection Handling',
      'devoluções/perguntas indicam expectativa desalinhada',
      'quando a causa é defeito real do produto',
      ['devolução', 'perguntas pré-venda', 'avaliação'],
      'excesso de avisos pode derrubar conversão',
      'sem queda de devolução em 30 dias → revisar produto',
      'Autoridade e Ação (Método R.E.A.L.)'],
    ['Vender transformação, não especificação', 'Customer Outcome',
      'anúncio descreve só ficha técnica', 'categoria exige linguagem técnica pura',
      ['CTR', 'conversão'], 'promessa além do produto vira devolução',
      'qualquer alegação sem prova → remover', 'Emoção (Método R.E.A.L.)'],
  ];
  let n = 0;
  for (const [title, category, whenToUse, whenNotToUse, metrics, risk, stop, real] of seeds) {
    playbooks.add({ title, category, whenToUse, whenNotToUse, metrics, risk,
      stopCriteria: stop, source: 'seed:PROVISIONAL_INTERNAL',
      confidence: 'PROVISIONAL', realMethodPrinciple: real });
    n++;
  }
  return { playbooks: n };
}

function createStrategy({ mos, clock }) {
  const outcomes = new OutcomeProfileService({ repos: mos.repos, clock });
  const playbooks = new PlaybookLibrary({ repos: mos.repos, clock });
  const lifecycle = new LifecycleService({ repos: mos.repos, clock });
  const advisor = new StrategyAdvisor({ repos: mos.repos, outcomes, lifecycle,
    playbooks, clock });
  return { outcomes, playbooks, lifecycle, advisor, diagnoseFunnel,
    seed: () => seedStrategy(playbooks),
    OUTCOME_STATUSES, LIFECYCLE_STAGES, PLAYBOOK_CATEGORIES, FUNNEL_STAGES };
}

module.exports = { createStrategy, diagnoseFunnel,
                   OUTCOME_STATUSES, LIFECYCLE_STAGES, PLAYBOOK_CATEGORIES };
