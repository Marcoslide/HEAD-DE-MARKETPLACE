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
};
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));
