/* HEAD CHAT · INTÉRPRETE (Sprint 09.A) — linguagem natural → consulta TIPADA.

   TRAVA DO SPRINT: nenhuma resposta hardcoded por pergunta. O mecanismo é
   sempre: intenção classificada → filtros extraídos → consulta estruturada
   → camada de dados → fatos → composição. A IA/interpretação NUNCA produz
   número — só decide O QUE consultar.

   Tolerante a variações naturais, informais e com erro de português:
   normaliza acentos/caixa e casa por radicais, não por frases exatas. */
(function (NS) {
'use strict';

const norm = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/* ---------------- léxico (radicais, não frases) ---------------- */
const PLATFORMS = [
  { id: 'shopee', rx: /shopee|shope\b/ },
  { id: 'mercado_livre', rx: /mercado ?livre|meli\b|\bml\b|mercadolivre/ },
  { id: 'tiktok', rx: /tik ?tok/ },
  { id: 'magalu', rx: /magalu|magazine ?luiza/ },
];

const METRICS = [
  /* fulfillment ANTES de orders: "quantos pedidos faltam enviar" é expedição */
  { id: 'FULFILLMENT', rx: /enviar|embalar|embalag|expedi|coleta|despach|produzir|producao|dar tempo|prazo de envio|falta(m)? (enviar|embalar|produzir)/ },
  { id: 'ADS', rx: /\bads\b|patrocinad|campanha|investi|\broas\b|\bacos\b|\bcpa\b|queimou de anuncio|gastei de anuncio|gasto de anuncio|orcamento/ },
  { id: 'CONVERSION', rx: /convers|\bctr\b|funil|clique|checkout|viram e compraram|taxa de aprovacao/ },
  { id: 'INVENTORY', rx: /estoque|acabando|ruptura|vai faltar|quanto tenho d|cobertura/ },
  { id: 'FINANCIAL', rx: /lucro|margem|sobrou|taxa(s)? (paga|cobrada)|paguei de taxa|devoluc|liquid|deixando de vender/ },
  { id: 'ORDERS', rx: /pedido|vendas (eu )?tive|encomenda/ },
  { id: 'GROSS_REVENUE', rx: /vendi|vendeu|vendemos|fatur|receita|(quanto|qto|qnt) entrou|quanto deu|quanto fiz|quanto saiu|(como|quanto) foi de venda|como (estao|vao) as vendas/ },
  { id: 'OPERATION_OVERVIEW', rx: /como esta (minha|a) operacao|visao geral|resumo do dia|como estamos/ },
];

const PERIODS = [
  { type: 'SAME_TIME_YESTERDAY', rx: /mesmo horario de ontem/ },
  { type: 'YESTERDAY', rx: /\bontem\b/ },
  { type: 'LAST_WEEK', rx: /semana passada/ },
  { type: 'THIS_WEEK', rx: /est[ae] semana|nesta semana|na semana/ },
  { type: 'LAST_MONTH', rx: /mes passado/ },
  { type: 'THIS_MONTH', rx: /este mes|neste mes|no mes/ },
  { type: 'LAST_7_DAYS', rx: /ultimos 7 dias/ },
  { type: 'LAST_30_DAYS', rx: /ultimos 30 dias/ },
  { type: 'TODAY', rx: /\bhoje\b|ate agora|\bagora\b|\bhj\b/ },
];

const ORDER_STATUS = [
  { id: 'late', rx: /atrasad/ },
  { id: 'awaiting_pickup', rx: /coleta|esperando coleta/ },
  { id: 'shipped', rx: /enviad|despachad|despachei/ },
  { id: 'production', rx: /produca|produzir|em producao/ },
  { id: 'packaging', rx: /embalar|embalag/ },
  { id: 'cancelled', rx: /cancelad/ },
  { id: 'returned', rx: /devolvid/ },
  { id: 'to_ship', rx: /falta(m)? enviar|para enviar|abertos|pendente/ },
];

/* ---------------- classificação de intenção ---------------- */
const INTENTS = [
  { id: 'ACTION_REQUEST',
    rx: /^(baixe|baixa|abaixe|pause|pausa|publique|publica|aumente|aumenta|altere|altera|crie|cria|suba|sobe|reduza|reduz|desative|desativa|ative|ativa|cancele|cancela|envie para|mude|muda|reposicione|ajuste|ajusta)\b/ },
  { id: 'DECISION_EXPLANATION',
    rx: /qual decisao precisa de mim|decisao precisa de mim|o que preciso decidir|preciso decidir algo|por ?que voce (prioriz|nao me mostr|ignor)|por ?que (isso|iss[oa]) (entrou|esta urgente|e urgente)|raciocinio|mostra o raciocinio|o que voce ignorou|qual risco voce encontrou|por ?que .* (priorizad|urgente|no plano)/ },
  { id: 'SIMULATION',
    rx: /^e se\b|\be se eu\b|da para fazer promocao|se eu (aumentar|baixar|investir|aceitar|subir)/ },
  { id: 'STRATEGY_OR_PLANNING',
    rx: /como crescer|como vender mais|o que voce faria|quero melhorar|quais produtos devo|como escalar|estrategia/ },
  { id: 'FEEDBACK_OR_MEMORY',
    rx: /^nao quero\b|^priorize\b|^prefiro\b|minha equipe nao|nao trabalho|nao gosto de|nunca (baixe|faca)/ },
  { id: 'RISK_OR_EXCEPTION_QUERY',
    rx: /algo errado|maior risco|perdendo dinheiro|pode me dar problema|o que esta travando|preciso resolver agora|gargalo|desperdicio/ },
];

/* referência curta de acompanhamento: "e na shopee?", "e ontem?", "e por produto?" */
const FOLLOWUP_RX = /^e (n[oa]s? |em |por |os |as |sem |esse |essa |d[oe] )?/;

function classify(text) {
  const t = norm(text);
  for (const i of INTENTS) if (i.rx.test(t)) return i.id;
  /* pergunta factual com métrica reconhecível → OPERATIONAL_QUERY */
  if (METRICS.some(m => m.rx.test(t))) return 'OPERATIONAL_QUERY';
  /* follow-up curto herda a intenção operacional do contexto */
  if (FOLLOWUP_RX.test(t) && t.length <= 40) return 'OPERATIONAL_QUERY';
  return 'UNKNOWN';
}

/* ---------------- extração da consulta estruturada ---------------- */
function extract(text, { context = null, clock, companyId = null, products = [] } = {}) {
  const t = norm(text);
  const intent = classify(text);

  const platforms = PLATFORMS.filter(p => p.rx.test(t)).map(p => p.id);
  const period = PERIODS.find(p => p.rx.test(t)) || null;
  const statuses = ORDER_STATUS.filter(s => s.rx.test(t)).map(s => s.id);
  let metric = (METRICS.find(m => m.rx.test(t)) || {}).id || null;
  /* "quantos/quantas" pergunta CONTAGEM — pedidos, não dinheiro */
  if (/^quant[oa]s\b/.test(t) && metric === 'GROSS_REVENUE') metric = 'ORDERS';
  /* superlativos por dimensão */
  const ranking =
    /qual (marketplace|canal) (vendeu|esta) (mais|melhor)|onde estou vendendo mais/.test(t) ? 'BY_PLATFORM'
    : /qual (produto|anuncio) (vendeu|converte|vende) mais|qual produto tem mais margem|qual (produto|anuncio) esta (ruim|parado|acabando|critico)|clique e nao vende|gastando sem vender/.test(t) ? 'BY_PRODUCT'
    : null;
  const comparison =
    /compare hoje com ontem|hoje com ontem|comparado com ontem|acima de ontem/.test(t) ? { with: 'YESTERDAY_SAME_TIME' }
    : /compare shopee e mercado livre|shopee (vs|e) mercado livre/.test(t) ? { with: 'PLATFORMS' }
    : null;
  const productScope = products.find(p => t.includes(norm(p.name).slice(0, 14)) || (p.sku && t.includes(norm(p.sku)))) || null;

  const q = {
    intent,
    metric,
    aggregation: metric === 'ORDERS' ? 'COUNT' : 'SUM',
    companyId,
    platforms: platforms.length ? platforms : ['ALL'],
    stores: ['ALL'],
    productScope: productScope ? { sku: productScope.sku, name: productScope.name } : null,
    statuses: statuses.length ? statuses : null,
    period: period ? { type: period.type, timezone: clock.timezone } : null,
    ranking, comparison,
    asOf: clock.nowIso(),
    raw: text,
  };

  /* ---- Context Resolver: follow-ups herdam métrica/período/filtros ---- */
  const isFollowup = context && FOLLOWUP_RX.test(t) && t.length <= 40;
  if (isFollowup) {
    q.metric = metric || context.metric;
    q.aggregation = context.aggregation || q.aggregation;
    /* novo filtro explícito SOBRESCREVE; o resto é herdado */
    q.platforms = platforms.length ? platforms : context.platforms;
    q.period = period ? q.period : context.period;
    /* "e ontem?" vindo de um HOJE parcial compara hora-contra-hora:
       ontem até o MESMO horário (nunca dia parcial × dia inteiro) */
    if (period && period.type === 'YESTERDAY'
        && context.period && context.period.type === 'TODAY')
      q.period = { type: 'SAME_TIME_YESTERDAY', timezone: clock.timezone };
    q.statuses = statuses.length ? q.statuses : context.statuses;
    q.productScope = q.productScope || context.productScope;
    q.ranking = ranking || (/(por|cada) produto/.test(t) ? 'BY_PRODUCT' : context.ranking);
    q.inherited = true;
  }
  if (!q.period && (q.metric || q.intent === 'OPERATIONAL_QUERY'))
    q.period = { type: 'TODAY', timezone: clock.timezone };   // padrão operacional: hoje

  return q;
}

NS.classify = classify;
NS.extract = extract;
NS.norm = norm;
NS.PLATFORMS = PLATFORMS;
NS.METRICS = METRICS;
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.HEADCHAT = globalThis.HEADCHAT || {}));
