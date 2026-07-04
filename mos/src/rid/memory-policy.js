/* MEMÓRIA EMPRESARIAL VIVA (Sprint 10.C) — política sobre a MEMÓRIA ÚNICA.

   Não existe memória paralela: usamos a tabela `memory` (S02, mesma do
   MIE) com campos aditivos de política: categoria, fonte, confiança,
   validade, escopo, autor, status e relações. Antes de USAR uma memória
   o RID valida: ainda vale? mesma empresa? foi superada? era preferência
   ou regra? Nunca memória antiga como verdade absoluta. */
'use strict';

const CATEGORIES = ['DECISION', 'STRATEGIC_DIRECTION', 'USER_PREFERENCE',
  'OPERATIONAL_FACT', 'HYPOTHESIS', 'INTERVENTION', 'LEARNING', 'EXPERIMENT',
  'RISK_PATTERN', 'CUSTOMER_INSIGHT', 'MARKETPLACE_INSIGHT', 'TEAM_CAPABILITY',
  'PROCESS_RULE', 'TEMPORARY_CONTEXT'];

/* hierarquia de contexto: quem manda quando as fontes discordam */
const CONTEXT_HIERARCHY = [
  'SEGURANCA_E_PERMISSOES', 'DECISAO_EXPLICITA_DO_DONO_VALIDA',
  'DADOS_REAIS_RECENTES', 'APRENDIZADO_COMPROVADO', 'REGRA_INTERNA',
  'HISTORICO_DE_CONVERSA', 'DADOS_IMPORTADOS', 'HIPOTESE_NOVA',
  'DADO_DEMONSTRATIVO_ROTULADO'];

class MemoryPolicy {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  absorb({ companyId, category, key, discovery, source, confidence = 'MEDIUM',
           validUntil = null, scope = null, author = null, related = {},
           evidence = [] }) {
    if (!CATEGORIES.includes(category)) throw new Error(`categoria de memória inválida: ${category}`);
    if (!source) throw new Error('memória exige fonte rastreável');
    const legacyKind = category === 'USER_PREFERENCE' ? 'preference'
      : category === 'LEARNING' || category === 'INTERVENTION' ? 'strategy' : 'pattern';
    const existing = this.r.memory.db.get(
      'SELECT id FROM memory WHERE company_id = ? AND key = ?', companyId, key);
    const row = { company_id: companyId, key, kind: legacyKind, discovery,
      category, source, confidence, valid_until: validUntil, scope, author,
      status: 'ACTIVE', related_json: related, evidence_json: evidence,
      context_json: {}, updated_at: this.clock.nowIso() };
    const saved = existing ? this.r.memory.update(existing.id, row)
      : this.r.memory.insert(row);
    this.r.audit.record('rid-memory', 'absorbed', { companyId, entity: 'memory',
      entityId: saved.id, detail: { category, source, confidence } });
    return saved;
  }

  /* a memória só é USÁVEL se passar na política */
  usable(row, nowIso) {
    if (!row) return { ok: false, reason: 'inexistente' };
    if (row.status && row.status !== 'ACTIVE') return { ok: false, reason: `status ${row.status}` };
    if (row.valid_until && row.valid_until < nowIso) return { ok: false, reason: 'expirada' };
    return { ok: true };
  }

  recall({ companyId, category = null, topic = null, includeInvalid = false }) {
    let sql = 'SELECT * FROM memory WHERE company_id = ?';
    const params = [companyId];
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (topic) { sql += ' AND (discovery LIKE ? OR key LIKE ?)'; params.push(`%${topic}%`, `%${topic}%`); }
    sql += ' ORDER BY updated_at DESC';
    const now = this.clock.nowIso();
    return this.r.memory.db.all(sql, ...params)
      .map(m => ({ ...m, usable: this.usable(m, now) }))
      .filter(m => includeInvalid || m.usable.ok);
  }

  supersede(memoryId, { by = null, reason = null } = {}) {
    const m = this.r.memory.update(memoryId, { status: 'SUPERSEDED',
      updated_at: this.clock.nowIso() });
    this.r.audit.record('rid-memory', 'superseded', { companyId: m.company_id,
      entity: 'memory', entityId: memoryId, detail: { by, reason } });
    return m;
  }

  /* CONTEXTO CRUZADO antes de decidir: dados atuais + histórico + direção
     do dono + operação + aprendizados — em camadas com hierarquia clara */
  contextFor({ companyId, topic = null, currentData = {} }) {
    /* recall completo por categoria — o refinamento por tópico é feito
       palavra a palavra por quem decide (frase inteira nunca casaria) */
    const layer = cat => this.recall({ companyId, category: cat });
    const ownerDecisions = [...layer('DECISION'), ...layer('STRATEGIC_DIRECTION')];
    const learnings = [...layer('LEARNING'), ...layer('INTERVENTION')];
    return {
      hierarchy: CONTEXT_HIERARCHY,
      ownerDecisions,                                   // 2. decisões válidas do dono
      currentData,                                      // 3. dados reais recentes
      learnings,                                        // 4. aprendizado comprovado
      internalRules: layer('PROCESS_RULE'),             // 5. regras internas
      conversation: layer('TEMPORARY_CONTEXT'),         // 6. histórico de conversa
      hypotheses: layer('HYPOTHESIS'),                  // 8. hipóteses (nunca fato)
      preferences: layer('USER_PREFERENCE'),
      checkQuestion: 'Essa recomendação respeita os objetivos do dono, ' +
        'considera o que a empresa já aprendeu e é possível de executar agora?',
    };
  }
}

module.exports = { MemoryPolicy, CATEGORIES, CONTEXT_HIERARCHY };
