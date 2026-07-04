/* MARKETPLACE KNOWLEDGE & COMPLIANCE FOUNDATION (Sprint 10.K).

   Base VIVA de conhecimento (ML, Shopee, TikTok Shop, Magalu) que
   alimenta o RID, o Compliance, o Schema Engine, o Data Completion, o
   Shipping Eligibility, o Chat e o WhatsApp — SEM criar outro cérebro.

   Princípio: consciência, não polícia. Risco baixo → informa; moderado
   → alerta + alternativa; depende de confirmação → pergunta; crítico →
   bloqueia SOMENTE a ação externa irreversível (análise, plano, draft
   interno e coleta de dado seguem SEMPRE permitidos). */
'use strict';
const crypto = require('node:crypto');

const KNOWLEDGE_TYPES = ['OFFICIAL_PLATFORM_POLICY', 'OFFICIAL_API_DOCUMENTATION',
  'OFFICIAL_SELLER_GUIDE', 'OFFICIAL_CHANGELOG', 'OFFICIAL_CATEGORY_REQUIREMENT',
  'OFFICIAL_LOGISTICS_RULE', 'OFFICIAL_ENFORCEMENT_RULE', 'ACCOUNT_SPECIFIC_RULE',
  'ACCOUNT_SPECIFIC_ELIGIBILITY', 'INTERNAL_OPERATION_RULE', 'INTERNAL_PRODUCT_RULE',
  'INTERNAL_LOGISTICS_RULE', 'INTERNAL_MARGIN_RULE', 'STRATEGIC_PLAYBOOK',
  'REAL_METHOD_PLAYBOOK', 'OPERATIONAL_LEARNING', 'EXPERIMENT_RESULT',
  'PUBLIC_RESEARCH', 'PROVISIONAL_RULE', 'UNKNOWN_RULE',
  'MARKETPLACE_STRATEGIC_PLAYBOOK'];
const CONFIDENCE = ['VERIFIED_OFFICIAL', 'VERIFIED_ACCOUNT', 'VERIFIED_INTERNAL',
  'SUPPORTED_BY_EVIDENCE', 'PROVISIONAL', 'STALE', 'CONFLICTING', 'UNKNOWN', 'RETIRED'];
const ACTION_MODES = ['INFO', 'SUGGEST', 'WARN', 'ASK_CONFIRMATION',
  'REQUIRE_REVIEW', 'BLOCK_EXTERNAL_ACTION'];
const DOMAINS = ['api-integracoes', 'cadastro-catalogo', 'preco-estoque-promocao',
  'logistica-prazo', 'operacao-atendimento', 'politicas-compliance',
  'enforcement-risco', 'estrategia-performance'];
const MARKETPLACES = ['mercado_livre', 'shopee', 'tiktok', 'magalu'];
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 20);

class MarketplaceKnowledgeBase {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  /* ---------- fontes (oficiais primeiro; não-oficial = PUBLIC_RESEARCH) ---------- */
  registerSource({ marketplace, sourceType, title, url = null, version = null,
                   official = false, content = null }) {
    if (!official && !/PUBLIC_RESEARCH/.test(sourceType))
      throw new Error('fonte não oficial só entra como PUBLIC_RESEARCH — e rotulada');
    return this.r.knowledgeSource.insert({ marketplace, source_type: sourceType,
      title, source_url: url, source_version: version, official: official ? 1 : 0,
      fetched_at: this.clock.nowIso(), content_hash: content ? sha(content) : null,
      status: 'ACTIVE', created_at: this.clock.nowIso() });
  }

  /* ---------- registros (com detecção de duplicata/mudança/conflito) ---------- */
  addRecord({ companyId = null, marketplace, domain, title, summary = null,
              sourceId = null, knowledgeType, confidenceStatus,
              appliesToCategoryId = null, appliesToAccountId = null,
              appliesToProductType = null, severity = null, consequences = null,
              recommendedAction = null, alternatives = [], relatedRulePackId = null,
              rawEvidence = null }) {
    if (!MARKETPLACES.includes(marketplace)) throw new Error(`marketplace inválido: ${marketplace}`);
    if (!DOMAINS.includes(domain)) throw new Error(`domínio inválido: ${domain}`);
    if (!KNOWLEDGE_TYPES.includes(knowledgeType)) throw new Error(`tipo inválido: ${knowledgeType}`);
    if (!CONFIDENCE.includes(confidenceStatus)) throw new Error(`confiança inválida: ${confidenceStatus}`);
    /* oficial exige fonte com versão e data */
    if (/^OFFICIAL_/.test(knowledgeType)) {
      const src = sourceId ? this.r.knowledgeSource.maybeById(sourceId) : null;
      if (!src || !src.official || !src.source_version || !src.fetched_at)
        throw new Error('conhecimento OFICIAL exige fonte oficial com versão e data');
    }
    /* interna NUNCA sobrescreve oficial: mesmo assunto → registro paralelo + conflito */
    const existing = this.r.knowledgeRecord.db.get(
      `SELECT * FROM marketplace_knowledge_record WHERE marketplace = ? AND title = ?
       AND status = 'ACTIVE'`, marketplace, title);
    let conflict = null;
    if (existing) {
      const existingOfficial = /^VERIFIED_OFFICIAL$/.test(existing.confidence_status);
      const newOfficial = confidenceStatus === 'VERIFIED_OFFICIAL';
      if (existingOfficial && !newOfficial)
        throw new Error('regra interna não sobrescreve regra oficial — registre como paralela com outro título ou abra revisão');
      if (newOfficial && !existingOfficial) {
        /* oficial substitui interna: a antiga vira RETIRED (rastreável) */
        this.r.knowledgeRecord.update(existing.id, { status: 'SUPERSEDED',
          confidence_status: 'RETIRED', updated_at: this.clock.nowIso() });
      } else {
        conflict = this.r.knowledgeConflict.insert({ marketplace, subject: title,
          conflicting_record_ids_json: [existing.id], status: 'OPEN',
          conflict_description: 'novo registro com mesmo assunto e confiança equivalente',
          created_at: this.clock.nowIso() });
        this.r.knowledgeReview.insert({ marketplace, record_id: existing.id,
          reason: 'conflito de regras detectado', priority: 'HIGH',
          detected_at: this.clock.nowIso(), created_at: this.clock.nowIso() });
      }
    }
    const rec = this.r.knowledgeRecord.insert({ company_id: companyId, marketplace,
      domain, title, summary, source_id: sourceId, knowledge_type: knowledgeType,
      confidence_status: confidenceStatus, last_verified_at: this.clock.nowIso(),
      applies_to_category_id: appliesToCategoryId,
      applies_to_account_id: appliesToAccountId,
      applies_to_product_type: appliesToProductType,
      severity, consequences, recommended_action: recommendedAction,
      alternatives_json: alternatives, related_rule_pack_id: relatedRulePackId,
      raw_evidence: rawEvidence, status: 'ACTIVE',
      audit_json: [{ event: 'created', at: this.clock.nowIso(), conflict: !!conflict }],
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    this.r.audit.record('knowledge', 'record_added', { companyId,
      entity: 'marketplace_knowledge_record', entityId: rec.id,
      detail: { marketplace, domain, knowledgeType, confidenceStatus } });
    return { record: rec, conflict };
  }

  /* recall com prioridade (oficial > conta > interna > provisória) e isolamento */
  recall({ companyId = null, marketplace, domain = null, categoryId = null,
           accountId = null, includeRetired = false }) {
    let sql = `SELECT * FROM marketplace_knowledge_record WHERE marketplace = ?
      AND (company_id IS NULL OR company_id = ?)`;
    const params = [marketplace, companyId];
    if (domain) { sql += ' AND domain = ?'; params.push(domain); }
    if (categoryId) { sql += ' AND (applies_to_category_id IS NULL OR applies_to_category_id = ?)'; params.push(categoryId); }
    if (accountId) { sql += ' AND (applies_to_account_id IS NULL OR applies_to_account_id = ?)'; params.push(accountId); }
    else sql += ' AND applies_to_account_id IS NULL';
    const rank = c => CONFIDENCE.indexOf(c);
    return this.r.knowledgeRecord.db.all(sql, ...params)
      .filter(r => includeRetired || (r.status === 'ACTIVE'
        && !['RETIRED', 'STALE'].includes(r.confidence_status)))
      .sort((a, b) => rank(a.confidence_status) - rank(b.confidence_status));
  }

  markForReview(recordId, { reason, priority = 'MEDIUM' }) {
    const rec = this.r.knowledgeRecord.byId(recordId);
    return this.r.knowledgeReview.insert({ marketplace: rec.marketplace,
      record_id: recordId, reason, priority, detected_at: this.clock.nowIso(),
      created_at: this.clock.nowIso() });
  }

  /* ---------- pipeline de ingestão (versão, mudança, obsolescência) ---------- */
  ingest({ marketplace, sourceType, title, version, content, official = true }) {
    const hash = sha(content);
    const prev = this.r.knowledgeSource.db.get(
      `SELECT * FROM marketplace_knowledge_source WHERE marketplace = ? AND title = ?
       ORDER BY id DESC LIMIT 1`, marketplace, title);
    if (prev && prev.content_hash === hash)
      return { changed: false, duplicate: true, source: prev };
    const source = this.registerSource({ marketplace, sourceType, title,
      version, official, content });
    let changed = false;
    if (prev) {
      changed = true;
      this.r.knowledgeSource.update(prev.id, { status: 'SUPERSEDED' });
      /* mudança detectada → registros ligados vão para revisão como STALE */
      const linked = this.r.knowledgeRecord.db.all(
        'SELECT id FROM marketplace_knowledge_record WHERE source_id = ?', prev.id);
      for (const l of linked) {
        this.r.knowledgeRecord.update(l.id, { confidence_status: 'STALE',
          review_required_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
        this.r.knowledgeReview.insert({ marketplace, record_id: l.id,
          reason: `fonte "${title}" mudou (v${prev.source_version} → v${version})`,
          priority: 'HIGH', detected_at: this.clock.nowIso(),
          created_at: this.clock.nowIso() });
      }
    }
    return { changed, duplicate: false, source, previous: prev || null };
  }
}

/* ---------- avaliador de risco: ADVISE, não policiamento ---------- */
class ComplianceAdvisor {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  addRiskRule({ companyId = null, marketplace, domain, triggerCondition, riskLevel,
                actionMode, warningText, consequenceText = null,
                recommendedAlternative = null, resolutionPath = null,
                relatedKnowledgeRecordId = null, source = null,
                confidenceStatus = 'PROVISIONAL' }) {
    if (!ACTION_MODES.includes(actionMode)) throw new Error(`action mode inválido: ${actionMode}`);
    if (actionMode === 'BLOCK_EXTERNAL_ACTION') {
      for (const [k, v] of Object.entries({ motivo: warningText,
        consequência: consequenceText, 'caminho de resolução': resolutionPath,
        fonte: source, 'regra relacionada': relatedKnowledgeRecordId }))
        if (!v) throw new Error(`BLOCK_EXTERNAL_ACTION exige ${k}`);
    }
    return this.r.riskRule.insert({ company_id: companyId, marketplace, domain,
      trigger_condition: triggerCondition, risk_level: riskLevel,
      action_mode: actionMode, warning_text: warningText,
      consequence_text: consequenceText, recommended_alternative: recommendedAlternative,
      resolution_path: resolutionPath,
      related_knowledge_record_id: relatedKnowledgeRecordId, source,
      confidence_status: confidenceStatus,
      blocks_internal_draft: 0,               // draft interno NUNCA é bloqueado
      blocks_external_write: actionMode === 'BLOCK_EXTERNAL_ACTION' ? 1 : 0,
      created_at: this.clock.nowIso() });
  }

  /* aconselha uma intenção: PODE_SEGUIR / COM_ALERTA / PRECISA_CONFIRMACAO /
     BLOQUEAR_ACAO_EXTERNA — interno sempre pode seguir */
  advise({ companyId, marketplace, triggers = [], intent = 'internal' }) {
    const rules = this.r.riskRule.db.all(
      `SELECT * FROM marketplace_risk_rule WHERE marketplace = ?
       AND (company_id IS NULL OR company_id = ?)`, marketplace, companyId)
      .filter(r => triggers.includes(r.trigger_condition));
    const worst = m => rules.filter(r => r.action_mode === m);
    const blocked = worst('BLOCK_EXTERNAL_ACTION');
    const confirm = [...worst('ASK_CONFIRMATION'), ...worst('REQUIRE_REVIEW')];
    const warns = [...worst('WARN'), ...worst('SUGGEST'), ...worst('INFO')];

    let verdict;
    if (intent === 'external' && blocked.length) verdict = 'BLOQUEAR_ACAO_EXTERNA';
    else if (confirm.length || (blocked.length && intent !== 'external')) verdict = 'PRECISA_DE_CONFIRMACAO';
    else if (warns.length) verdict = 'PODE_SEGUIR_COM_ALERTA';
    else verdict = 'PODE_SEGUIR';

    const explain = r => ({ rule: r.trigger_condition, level: r.risk_level,
      warning: r.warning_text, consequence: r.consequence_text,
      alternative: r.recommended_alternative, resolutionPath: r.resolution_path,
      source: r.source, confidence: r.confidence_status });
    const result = { verdict,
      internalAllowed: true,       // análise/plano/draft/coleta SEMPRE seguem
      externalAllowed: verdict !== 'BLOQUEAR_ACAO_EXTERNA' && verdict !== 'PRECISA_DE_CONFIRMACAO',
      alerts: warns.map(explain), confirmations: confirm.map(explain),
      blocks: blocked.map(explain),
      message: this._compose(verdict, { warns, confirm, blocked }) };
    this.r.audit.record('knowledge', 'advised', { companyId,
      entity: 'marketplace_risk_rule', entityId: triggers.join(','),
      detail: { marketplace, verdict, intent } });
    return result;
  }

  _compose(verdict, { warns, confirm, blocked }) {
    if (verdict === 'BLOQUEAR_ACAO_EXTERNA') {
      const b = blocked[0];
      return `Não posso preparar a publicação externa ainda: ${b.warning_text}. ` +
        `Consequência: ${b.consequence_text}. Caminho: ${b.resolution_path}. ` +
        `O draft interno segue salvo e a coleta de dados continua.`;
    }
    if (verdict === 'PRECISA_DE_CONFIRMACAO') {
      const c = confirm[0] || blocked[0];
      return `Posso seguir com o trabalho interno. Antes da ação externa, preciso confirmar: ` +
        `${c.warning_text}${c.recommended_alternative ? ` Minha recomendação: ${c.recommended_alternative}.` : ''}`;
    }
    if (verdict === 'PODE_SEGUIR_COM_ALERTA') {
      const w = warns[0];
      return `Você pode seguir — mas atenção: ${w.warning_text}` +
        `${w.consequence_text ? ` (${w.consequence_text})` : ''}.` +
        `${w.recommended_alternative ? ` Alternativa: ${w.recommended_alternative}.` : ''} ` +
        `Não é bloqueio; a decisão fica clara para o responsável.`;
    }
    return 'Pode seguir — nenhuma regra relevante aponta risco confirmado.';
  }
}

/* ---------- carga mínima honesta (PROVISIONAL, rotulada) por praça ---------- */
function seedFoundation(kb, advisor, { clock }) {
  const mk = (marketplace, srcTitle) => kb.registerSource({ marketplace,
    sourceType: 'OFFICIAL_SELLER_GUIDE', title: srcTitle, version: 'seed-1',
    official: true, content: srcTitle });
  const out = { records: 0, rules: 0 };
  const add = (marketplace, domain, title, extra = {}) => {
    kb.addRecord({ marketplace, domain, title,
      knowledgeType: extra.knowledgeType || 'PROVISIONAL_RULE',
      confidenceStatus: extra.confidenceStatus || 'PROVISIONAL', ...extra });
    out.records++;
  };
  for (const mp of MARKETPLACES) {
    add(mp, 'api-integracoes', `${mp}: OAuth, tokens, escopos, webhooks e limites de requisição`,
      { summary: 'conhecimento de integração ≠ regra de anúncio; app pode ser suspenso por uso indevido' });
    add(mp, 'cadastro-catalogo', `${mp}: categoria folha define atributos obrigatórios e condicionais`);
    add(mp, 'logistica-prazo', `${mp}: produto sob encomenda é incompatível com modalidades de despacho imediato`);
    add(mp, 'politicas-compliance', `${mp}: imagem com marca de terceiro gera risco de propriedade intelectual`);
    add(mp, 'enforcement-risco', `${mp}: reincidência de infração escala para pausa, suspensão e banimento`);
  }
  /* Método R.E.A.L. — playbook estratégico; NUNCA substitui compliance */
  add('mercado_livre', 'estrategia-performance', 'Método R.E.A.L. — criativos, conversão, autoridade, emoção, retenção e ação',
    { knowledgeType: 'REAL_METHOD_PLAYBOOK', confidenceStatus: 'VERIFIED_INTERNAL',
      summary: 'playbook estratégico de comunicação/crescimento; não define categoria, atributo, política, logística ou requisito técnico' });

  const rules = [
    ['shopee', 'logistica-prazo', 'entrega-rapida-sob-encomenda', 'MODERATE', 'ASK_CONFIRMATION',
      'produto sob encomenda (prazo 5 dias) pode conflitar com modalidades de despacho rápido',
      'atraso sistemático gera pontos de penalidade e queda de reputação',
      'manter o draft interno e calcular modalidades compatíveis; confirmar elegibilidade na conta'],
    ['shopee', 'cadastro-catalogo', 'atributo-material-ausente', 'MODERATE', 'WARN',
      'falta o atributo material — risco de reprovação do anúncio na revisão',
      'anúncio pode ser reprovado ou pausado',
      'seguir preparando o rascunho interno e pedir o dado agora'],
    ['mercado_livre', 'politicas-compliance', 'imagem-marca-terceiro', 'HIGH', 'REQUIRE_REVIEW',
      'imagem contém marca de terceiro não associada ao produto',
      'questionamento de propriedade intelectual (Brand Protection)',
      'manter como referência interna; não usar como imagem principal'],
    ['mercado_livre', 'cadastro-catalogo', 'atributo-obrigatorio-ausente-publicacao', 'CRITICAL', 'BLOCK_EXTERNAL_ACTION',
      'falta atributo obrigatório e confirmação de categoria para publicar',
      'anúncio seria reprovado/removido e a conta pontuada',
      'coletar o dado faltante (DataRequest aberto) e confirmar categoria pós-OAuth'],
    ['shopee', 'preco-estoque-promocao', 'promocao-margem-abaixo-minimo', 'MODERATE', 'WARN',
      'a margem estimada ficaria abaixo do mínimo definido pela empresa',
      'risco financeiro — não é bloqueio de marketplace',
      'limitar o desconto ou selecionar apenas SKUs com margem saudável'],
  ];
  for (const [mp, domain, trig, level, mode, warn, cons, alt] of rules) {
    advisor.addRiskRule({ marketplace: mp, domain, triggerCondition: trig,
      riskLevel: level, actionMode: mode, warningText: warn, consequenceText: cons,
      recommendedAlternative: alt, resolutionPath: alt, source: 'seed:PROVISIONAL_INTERNAL',
      relatedKnowledgeRecordId: mode === 'BLOCK_EXTERNAL_ACTION' ? 'seed-rec' : null,
      confidenceStatus: 'PROVISIONAL' });
    out.rules++;
  }
  return out;
}

function createKnowledge({ mos, clock }) {
  const kb = new MarketplaceKnowledgeBase({ repos: mos.repos, clock });
  const advisor = new ComplianceAdvisor({ repos: mos.repos, clock });
  return { kb, advisor,
    seed: () => seedFoundation(kb, advisor, { clock }),
    KNOWLEDGE_TYPES, CONFIDENCE, ACTION_MODES, DOMAINS, MARKETPLACES };
}

module.exports = { createKnowledge, KNOWLEDGE_TYPES, CONFIDENCE, ACTION_MODES, DOMAINS };
