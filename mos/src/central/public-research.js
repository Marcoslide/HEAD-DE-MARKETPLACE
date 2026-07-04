/* PESQUISA PÚBLICA DE MERCADO (Sprint 09) — fonte SEPARADA por construção.

   Entrada simples e rastreável para evidências públicas (busca na
   internet, anúncio público de concorrente, comparação de preço público).

   Leis:
   - NUNCA usa token ou credencial (este módulo nem recebe o
     CredentialProvider — separação por construção, não por disciplina);
   - NADA de Collector complexo, scraping ou automação de navegador;
   - toda evidência carrega sourceUrl + observedAt (Clock) — rastreável. */
'use strict';

class PublicResearch {
  constructor({ repos, bus, clock }) {
    this.r = repos; this.bus = bus; this.clock = clock;
  }

  /* registra uma evidência pública de mercado */
  record(companyId, { sourceUrl = null, platform = null, subject, findings = {}, confidence = 0.7, observedAt = null }) {
    if (!subject) throw new Error('evidência pública precisa de subject');
    const row = this.r.publicResearch.insert({
      company_id: companyId, source_type: 'PUBLIC_RESEARCH',
      source_url: sourceUrl, platform, subject,
      findings_json: findings, confidence,
      observed_at: observedAt || this.clock.nowIso(),
    });
    this.bus.emit('central.public_research', {
      id: row.id, companyId, sourceType: 'PUBLIC_RESEARCH',
      sourceUrl, platform, subject, findings, confidence, observedAt: row.observed_at,
    });
    return row;
  }

  ofCompany(companyId) {
    return this.r.publicResearch.db.all(
      'SELECT * FROM public_research_evidence WHERE company_id = ? ORDER BY observed_at', companyId);
  }
}

module.exports = { PublicResearch };
