/* Configuração central do MIE — o único lugar de limiares e janelas.
   Nada de números mágicos espalhados: calibrar o cérebro é editar aqui
   (e, no futuro, deixar o Learning Engine calibrar sozinho). */
(function (NS) {
'use strict';

NS.CONFIG = {
  /* Observation */
  SOFT_Z: 2.0,               // desvio que abre investigação leve
  HARD_Z: 3.2,               // desvio que marca atenção
  WARMUP_DAYS: 21,           // aquecimento do "normal" (3 semanas p/ padrão semanal)
  DECAY_TRIGGER_PCT: -0.14,  // queda acumulada que caracteriza decadência silenciosa
  PLATFORM_WIDE_RATIO: 0.6,  // % de produtos afetados juntos = assinatura de plataforma
  STOCK_ATTENTION_DAYS: 10,  // cobertura de estoque que acende atenção
  STOCK_CRITICAL_DAYS: 4,    // cobertura que vira incidente

  /* Prioritization */
  THRESHOLD_RECOMMEND: 700,  // score mínimo para ocupar a mesa do dono
  LOW_CONFIDENCE_CAP: 500,   // teto de score com confiança baixa

  /* Execution / Learning */
  MEASUREMENT_WINDOW: 7,     // ciclos mínimos antes de concluir efeito (MIF 5.3)
  CALIBRATION_ALPHA: 0.4,    // EWMA da calibração de previsões
  PATTERN_ALPHA: 0.3,        // EWMA dos padrões (dia-da-semana, sazonalidade)

  /* Executive Planning Engine (Sprint 08) — prioridade executiva */
  EPE: {
    HIGH_IMPACT: 1500,       // R$/mês que qualifica "impacto alto"
    INTERRUPT_SCORE: 2500,   // score que, com urgência alta, justifica interromper
    APPROVE_SCORE: 700,      // score mínimo para pedir aprovação ao dono
    MISSION_SCORE: 260,      // score mínimo para virar missão autônoma
    OBSERVE_SCORE: 80,       // score mínimo para ficar em observação (senão IGNORAR)
    MIN_IMPACT: 100,         // abaixo disso não incomoda ninguém
    LOW_CONF_CAP: 500,       // teto de score com confiança baixa
    CAPACITY: { missions: 5, decisions: 2 }, // capacidade operacional do dia
    CONF_BY_LABEL: { alta: 0.85, 'média': 0.6, baixa: 0.3 },
  },
};
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));
