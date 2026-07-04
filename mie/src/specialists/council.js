/* SPECIALISTS ENGINE · Conselho (Sprint 06) — Constituição Art. 11.3.
   O Conselho recebe TODOS os pareceres e produz UMA posição consolidada
   que o Head assume — nunca a média (Art. 11.3), sempre um voto ponderado
   com pesos DINÂMICOS. Identifica concordâncias, conflitos e divergentes.

   O Conselho NÃO decide o destino (isso é do Motor de Priorização) nem
   executa (Art. 11.5). Ele consolida a inteligência dos especialistas e
   registra quem contribuiu — para o Learning creditar acertos depois. */
(function (NS) {
'use strict';

/* afinidade especialista×problema: quem entende mais de cada tipo de caso.
   Peso multiplicativo (default 1). Não é fixo no tempo — combina com o
   histórico de acertos do especialista (Memory). */
const AFFINITY = {
  sales_drop:        { conversion: 1.3, commercial: 1.2, competition: 1.2, financial: 1.1 },
  ctr_drop:          { conversion: 1.3, seo: 1.1 },
  ranking_drop:      { seo: 1.4, competition: 1.2 },
  stockout_risk:     { operations: 1.6 },
  stockout_critical: { operations: 1.7 },
  returns_spike:     { operations: 1.5 },
  review_wave:       { operations: 1.4, conversion: 1.1 },
  new_competitor:    { competition: 1.5 },
  competitor_surge:  { competition: 1.6 },
  sales_explosion:   { marketing: 1.4, operations: 1.3, financial: 1.2 },
  silent_decay:      { conversion: 1.2, marketing: 1.1, commercial: 1.1 },
  algorithm_change:  { seo: 1.3, competition: 1.1 },
};

/* pares de recomendações que se OPÕEM (para detectar conflito real) */
const OPPOSED = [
  ['price', 'reposition'],   // seguir o preço vs. defender pelo diferencial
  ['wait', 'reposition'], ['wait', 'creative'], ['wait', 'visibility'],
  ['stock', 'capture'],      // frear demanda vs. capturar onda
];
function areOpposed(a, b) {
  return OPPOSED.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

/* Peso dinâmico de um parecer (o "voto" do especialista):
   histórico de acertos × qualidade das evidências × confiança × afiniade. */
function buildWeigher(memory, { problemType } = {}) {
  const affinityRow = AFFINITY[problemType] || {};
  return function weightOf(p) {
    const accuracy = memory && memory.specialistAccuracy ? memory.specialistAccuracy(p.domain) : 1; // 0.5..1.5
    const evidenceQuality = Math.max(0.5, Math.min(1.2, (p.evidencias ? p.evidencias.length : 0) / 3 + 0.4));
    const confidenceFactor = 0.5 + (p.confidence || 0.5); // 0.5..1.5
    const affinity = affinityRow[p.domain] ?? 1;
    return accuracy * evidenceQuality * confidenceFactor * affinity;
  };
}

/* Deliberação: pareceres + função de peso → parecer consolidado. */
function deliberate(pareceres, { weightOf }) {
  const applicable = pareceres.filter(p => p.applicable && p.stance !== 'neutral');
  /* só especialistas com ação concreta votam em QUAL ação (financeiro/
     marketing-espera informam confiança e urgência, não o "o quê") */
  const voters = applicable.filter(p => NS._roster.ACTIONABLE.includes(p.recommendationType));

  const votes = new Map(); // recommendationType → { weight, domains, confSum }
  for (const p of voters) {
    const w = weightOf(p);
    const v = votes.get(p.recommendationType) || { weight: 0, domains: [], confSum: 0 };
    v.weight += w; v.domains.push(p.domain); v.confSum += p.confidence * w;
    votes.set(p.recommendationType, v);
  }

  const ranked = [...votes.entries()].sort((a, b) => b[1].weight - a[1].weight);
  const totalWeight = ranked.reduce((s, [, v]) => s + v.weight, 0) || 1;
  const winner = ranked[0] || null;

  /* concordâncias: quem votou na recomendação vencedora */
  const agreements = winner ? winner[1].domains.slice() : [];
  /* divergentes: especialistas aplicáveis que NÃO estão no grupo vencedor */
  const divergent = applicable
    .filter(p => !winner || !winner[1].domains.includes(p.domain))
    .map(p => ({ domain: p.domain, label: p.label, recommendationType: p.recommendationType, recomendacao: p.recomendacao }));
  /* conflitos: pares de votantes com recomendações que se opõem */
  const conflicts = [];
  for (let i = 0; i < voters.length; i++)
    for (let j = i + 1; j < voters.length; j++)
      if (areOpposed(voters[i].recommendationType, voters[j].recommendationType))
        conflicts.push({ a: voters[i].domain, b: voters[j].domain,
          about: `${voters[i].recommendationType} × ${voters[j].recommendationType}` });

  const consensusStrength = winner ? winner[1].weight / totalWeight : 0;
  const confidence = winner ? winner[1].confSum / winner[1].weight : 0;
  const urgencia = maxUrgency(applicable);

  const consolidated = {
    recomendacao: winner ? winner[0] : 'observe',
    diagnostico: synthesize(winner, agreements, applicable),
    confidence: Math.round(confidence * 100) / 100,
    confianca: confidence >= 0.75 ? 'alta' : confidence >= 0.5 ? 'média' : 'baixa',
    consensusStrength: Math.round(consensusStrength * 100) / 100,
    contributingDomains: agreements,
    urgencia,
    dissent: divergent,
  };

  return {
    pareceresCount: pareceres.length,
    applicableCount: applicable.length,
    agreements, conflicts, divergent,
    consensus: { recommendation: consolidated.recomendacao, confidence: consolidated.confidence, strength: consolidated.consensusStrength },
    consolidated,
  };
}

function synthesize(winner, agreements, applicable) {
  if (!winner) {
    const alerts = applicable.filter(p => p.stance === 'alert');
    if (!alerts.length) return 'Conselho sem alertas acionáveis: operação dentro do normal.';
    return `Conselho registra atenção (${alerts.map(p => p.domain).join(', ')}), mas sem ação concreta majoritária — manter observação.`;
  }
  const n = agreements.length;
  return `Concordância de ${n} especialista(s) (${agreements.join(', ')}) na recomendação "${winner[0]}".`;
}

function maxUrgency(pareceres) {
  const rank = { alta: 3, 'média': 2, baixa: 1 };
  let best = 'baixa';
  for (const p of pareceres) if ((rank[p.urgencia] || 1) > rank[best]) best = p.urgencia;
  return best;
}

NS._council = { deliberate, buildWeigher, AFFINITY };
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));
