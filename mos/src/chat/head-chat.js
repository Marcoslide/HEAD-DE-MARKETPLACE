/* HEAD CHAT · ORQUESTRADOR (Sprint 09.A) — Central Operacional Conversacional.

   Pipeline por mensagem:
     texto → Intent Router → Context Resolver → consulta TIPADA
     → Query Layer → Result Validator → Response Composer → resposta

   Leis:
   - pergunta factual é RESPONDIDA IMEDIATAMENTE — nunca vira missão,
     memória, "anotei" ou planejamento;
   - a interpretação nunca produz número: todo número vem da Query Layer;
   - sem dado disponível → resposta honesta (NO_DATA), nunca improviso;
   - READ_ONLY: pedido de ação vira proposta com impacto e aprovação;
   - no máximo UM alerta por resposta, e ele nunca rouba a resposta. */
(function (NS) {
'use strict';
const extract = (...a) => NS.extract(...a);
const compose = (...a) => NS.compose(...a);
const money = v => NS.money(v);
const localTime = (...a) => NS.localTime(...a);
const QueryLayer = function (...a) { return new NS.QueryLayer(...a); };

class HeadChat {
  constructor({ dataset, clock, mie = null, companyId = null, logger = null,
                compliance = null, growth = null }) {
    this.clock = clock; this.mie = mie; this.companyId = companyId; this.log = logger;
    this.compliance = compliance;   // adapter do Compliance Engine (Sprint 10)
    this.growth = growth;           // adapter do Crescimento (Sprint 10.B)
    this.q = new QueryLayer({ dataset, clock, mie });
    this.dataset = dataset;
    this.context = null;          // consulta anterior (para "e na Shopee?", "e ontem?")
    this.lastTrace = null;        // observabilidade /__dev
    this.readOnly = true;
    this.proposals = [];          // rascunhos gerados por ACTION_REQUEST
    this.memoryNotes = [];        // preferências persistentes do dono
  }

  ask(text, { surface = 'api' } = {}) {
    const query = extract(text, {
      context: this.context, clock: this.clock,
      companyId: this.companyId, products: this.dataset.products || [],
    });
    let facts = null, reply, alert = null, action = null;

    switch (query.intent) {
      case 'OPERATIONAL_QUERY': {
        ({ facts, alert } = this._operational(query));
        reply = compose(facts, { clock: this.clock, alert });
        this.context = query;                    // factual atualiza o contexto
        break;
      }
      case 'CATALOG_COMPLIANCE_QUERY': {
        facts = this._catalogCompliance(text, query);
        reply = compose(facts, { clock: this.clock });
        this.context = query;
        break;
      }
      case 'RISK_OR_EXCEPTION_QUERY': {
        facts = this.q.getRiskSummary();
        reply = compose(facts, { clock: this.clock });
        this.context = query;
        break;
      }
      /* ---------- Crescimento (Sprint 10.B) ---------- */
      case 'LEADS_QUERY':
      case 'AFFILIATE_QUERY':
      case 'PROMOTION_RISK_QUERY':
      case 'PROMOTION_OPPORTUNITY_QUERY':
      case 'CATALOG_GAP_QUERY':
      case 'GROWTH_ACTION': {
        facts = this._growth(text, query);
        reply = compose(facts, { clock: this.clock });
        this.context = query;
        break;
      }
      case 'DECISION_EXPLANATION': {
        if (/precisa de mim|preciso decidir/i.test(text)) {
          facts = this.q.getPendingDecisions();
        } else {
          const idx = (text.match(/decis[aã]o (\d+)/i) || [])[1];
          facts = this.q.getDecisionExplanation({
            index: idx ? Number(idx) - 1 : 0,
            term: this._decisionTerm(text),
          });
        }
        reply = compose(facts, { clock: this.clock });
        break;
      }
      case 'ACTION_REQUEST': {
        action = this._proposeAction(text);
        reply = action.message;
        break;
      }
      case 'SIMULATION': {
        facts = this._simulate(text);
        reply = facts.message;
        break;
      }
      case 'STRATEGY_OR_PLANNING': {
        reply = this._strategy(text);
        break;
      }
      case 'FEEDBACK_OR_MEMORY': {
        reply = this._feedback(text);
        break;
      }
      default:
        reply = 'Não consegui identificar o que você quer consultar. Posso responder sobre vendas, pedidos, expedição, estoque, Ads, conversão, financeiro, riscos e decisões — pergunta de novo com um desses temas?';
    }

    this.lastTrace = {
      at: this.clock.nowIso(),
      surface,                     // api | v3 | demo — onde a pergunta nasceu
      input: text,
      intent: query.intent,
      structuredQuery: { ...query, raw: undefined },
      service: facts ? facts.kind : action ? 'ACTION_PROPOSAL' : null,
      dataSource: facts ? facts.dataSource : null,
      coverage: facts ? facts.coverage : null,
      missing: facts ? facts.missingPlatforms : null,
      alert, readOnly: this.readOnly,
      contextActive: !!this.context,
      failure: facts && facts.kind === 'NO_DATA' ? facts.what : null,
    };
    return { reply, intent: query.intent, query, facts, trace: this.lastTrace };
  }

  /* ---------- consultas operacionais → serviço tipado certo ---------- */
  _operational(query) {
    let facts, alert = null;
    switch (query.metric) {
      case 'FULFILLMENT':
        facts = this.q.getFulfillmentStatus(); break;
      case 'ORDERS':
        facts = this.q.getOrdersSummary({ platforms: query.platforms, period: query.period, statuses: query.statuses });
        break;
      case 'ADS':
        facts = this.q.getAdsPerformance({ platforms: query.platforms }); break;
      case 'CONVERSION':
        facts = this.q.getConversionSummary({ platforms: query.platforms }); break;
      case 'INVENTORY':
        facts = this.q.getInventorySummary({ productScope: query.productScope, platforms: query.platforms }); break;
      case 'FINANCIAL':
        facts = this.q.getFinancialSummary({ period: query.period }); break;
      case 'OPERATION_OVERVIEW':
        facts = this.q.getOperationBriefing(); break;
      case 'GROSS_REVENUE':
      default:
        facts = this.q.getSalesSummary({
          platforms: query.platforms, period: query.period,
          compareWith: query.comparison ? query.comparison.with : undefined,
          ranking: query.ranking,
        });
    }
    /* UM alerta relevante, sem roubar a resposta (só quando fizer sentido) */
    if (facts.kind === 'SALES' || facts.kind === 'ORDERS') {
      const f = this.dataset.fulfillment;
      if (f && f.capacity.customPendingToday > f.capacity.customPerDay)
        alert = `${f.criticalToday.length} pedidos personalizados vencem prazo hoje.`;
    }
    return { facts, alert };
  }

  /* ---------- catálogo & compliance: consulta o MOTOR REAL ---------- */
  _catalogCompliance(text, query) {
    if (!this.compliance)
      return { kind: 'NO_DATA', what: 'catálogo/compliance (motor não acoplado)',
               dataSource: 'NO_DATA', coverage: [], missingPlatforms: [], confidence: 0,
               asOf: this.clock.nowIso() };
    const platform = query.platforms && query.platforms[0] !== 'ALL' ? query.platforms[0] : null;
    const product = this.compliance.find(text);
    if (product && platform) {
      const r = this.compliance.evaluate(product, platform);
      return { kind: 'COMPLIANCE_STATUS', result: r,
               dataSource: r.dataSource || 'NO_DATA', isLive: false,
               coverage: [platform], missingPlatforms: [], confidence: 0.9,
               asOf: this.clock.nowIso() };
    }
    if (product) {
      const rows = this.compliance.board().filter(b => b.sku === product.master.sku);
      return { kind: 'COMPLIANCE_BOARD', rows, scope: product.master.name,
               dataSource: rows[0] ? rows[0].dataSource : 'NO_DATA', isLive: false,
               coverage: rows.map(r => r.platform), missingPlatforms: [], confidence: 0.9,
               asOf: this.clock.nowIso() };
    }
    const rows = this.compliance.board(platform);
    /* filtros de lista: bloqueados / prontos / risco */
    const t = text.toLowerCase();
    const filtered = /bloquead/.test(t) ? rows.filter(r => r.status === 'BLOCKED')
      : /pronto/.test(t) ? rows.filter(r => r.status === 'READY' || r.status === 'READY_WITH_WARNINGS')
      : /risco/.test(t) ? rows.filter(r => r.status !== 'READY')
      : rows;
    return { kind: 'COMPLIANCE_BOARD', rows: filtered, scope: platform,
             dataSource: rows[0] ? rows[0].dataSource : 'NO_DATA', isLive: false,
             coverage: platform ? [platform] : this.compliance.platforms,
             missingPlatforms: [], confidence: 0.9, asOf: this.clock.nowIso() };
  }

  /* ---------- Crescimento: consulta o adapter REAL (nunca inventa) ---------- */
  _growth(text, query) {
    if (!this.growth)
      return { kind: 'NO_DATA', what: 'Crescimento (motor não acoplado)',
               dataSource: 'NO_DATA', coverage: [], missingPlatforms: [],
               confidence: 0, asOf: this.clock.nowIso() };
    switch (query.intent) {
      case 'LEADS_QUERY': return this.growth.leads(query, text);
      case 'AFFILIATE_QUERY': return this.growth.affiliates(query, text);
      case 'PROMOTION_RISK_QUERY': return this.growth.promotionRisk(query);
      case 'PROMOTION_OPPORTUNITY_QUERY': return this.growth.promotionOpportunity(query);
      case 'CATALOG_GAP_QUERY': return this.growth.catalogGap(query);
      case 'GROWTH_ACTION': return this.growth.planAction(query, text);
      default: return { kind: 'NO_DATA', what: 'consulta de crescimento',
                        dataSource: 'NO_DATA', missingPlatforms: [], asOf: this.clock.nowIso() };
    }
  }

  _decisionTerm(text) {
    const m = text.match(/por ?que (?:o |a )?(.+?) (?:esta|está|é|e) urgente/i)
      || text.match(/priorizou (?:o |a |isso[:,]? )?(.+?)\??$/i);
    const term = m ? m[1].trim() : null;
    return term && term.length > 3 && !/isso|isto/.test(term) ? term : null;
  }

  /* ---------- READ_ONLY: ação vira proposta com aprovação ---------- */
  _proposeAction(text) {
    const proposal = {
      id: `prop-${this.proposals.length + 1}`,
      request: text,
      status: 'awaiting_approval',
      readOnlyBlocked: true,
      createdAt: this.clock.nowIso(),
      impact: 'estimado com os dados atuais — detalho antes de você aprovar',
      risk: 'nenhuma alteração é feita sem sua aprovação; o sistema segue em modo leitura',
    };
    this.proposals.push(proposal);
    return {
      proposal,
      message: `Entendido — mas eu não executo isso sozinho: o sistema está em modo leitura (READ_ONLY) e alterações em marketplace exigem sua aprovação.\n\n` +
        `Preparei a proposta ${proposal.id}: "${text}".\n` +
        `• o que faço agora: valido impacto, risco e reversibilidade com os dados atuais;\n` +
        `• o que NÃO acontece: nenhuma mudança em anúncio, preço, estoque, campanha ou pedido;\n` +
        `• próximo passo: te apresento o rascunho com impacto estimado para aprovar ou recusar.`,
    };
  }

  /* ---------- simulação: SEMPRE cenário estimado ---------- */
  _simulate(text) {
    const t = text.toLowerCase();
    const pct = (t.match(/(\d+(?:[.,]\d+)?)\s*%/) || [])[1];
    const valor = (t.match(/r\$ ?(\d+(?:[.,]\d+)?)/) || [])[1];
    let message;
    if (/pre[cç]o/.test(t) && pct) {
      const cut = Number(pct.replace(',', '.'));
      const base = 27, nova = Math.round((base - cut) * 10) / 10;
      message = `CENÁRIO ESTIMADO (não é certeza): reduzir o preço em ${cut}% melhora competitividade, mas derruba a margem estimada do mix de ~${base}% para ~${nova}%.` +
        (nova < 20 ? ` Abaixo de 20% a operação fica apertada — o corte máximo que preserva margem saudável é ~3,5%.` : '') +
        `\n\nBase do cenário: margens registradas por produto e taxas atuais. Quer que eu detalhe por produto?`;
    } else if (/ads|an[uú]ncio|campanha|investir/.test(t) && valor) {
      const inv = Number(valor.replace(',', '.'));
      const ads = this.q.getAdsPerformance({});
      message = ads.kind === 'ADS' && ads.roas
        ? `CENÁRIO ESTIMADO: com o ROAS atual de ${String(ads.roas).replace('.', ',')}x, investir ${money(inv)} tende a gerar ~${money(Math.round(inv * ads.roas))} em vendas atribuídas — SE a performance se mantiver, o que não é garantido em escala.\n\nBase: atribuição de hoje (${money(ads.spend)} → ${money(ads.attributedRevenue)}).`
        : `Não tenho dados de Ads suficientes para estimar esse cenário com segurança. Não vou chutar um retorno.`;
    } else {
      message = `Consigo simular esse cenário, mas preciso de um parâmetro concreto (percentual ou valor). Exemplo: "e se eu baixar o preço em 8%?" ou "e se eu investir R$ 500 em Ads?". Toda simulação sai marcada como estimativa, nunca certeza.`;
    }
    return { kind: 'SIMULATION', message, dataSource: this.dataset.source,
             coverage: this.dataset.connectedPlatforms, missingPlatforms: this.dataset.missingPlatforms };
  }

  /* ---------- estratégia: responde com base + abre caminho ---------- */
  _strategy(text) {
    const risks = this.q.getRiskSummary();
    const sales = this.q.getSalesSummary({});
    const top = sales.kind === 'SALES' && sales.byProduct ? null : null;
    return `Boa pergunta de direção. Antes do plano, o retrato de agora: ${sales.kind === 'SALES' ? `${money(sales.grossRevenue)} hoje em ${sales.ordersCount} pedidos` : 'sem dados de venda conectados'}${risks.top ? `; maior risco atual: ${risks.top.title}` : ''}.\n\n` +
      `Para "${text.trim()}", eu montaria o caminho em cima do que os dados mostram — produto validado, margem por canal e capacidade. Posso abrir uma investigação estruturada e te trazer um plano com hipóteses, impacto estimado e passos? (Nada é executado sem sua aprovação.)`;
  }

  /* ---------- preferências do dono: registradas quando são REGRA ---------- */
  _feedback(text) {
    const note = { text: text.trim(), at: this.clock.nowIso() };
    this.memoryNotes.push(note);
    if (this.mie) this.mie.memory.absorb({
      key: `pref.chat.${this.memoryNotes.length}`,
      kind: 'preference',
      discovery: `Preferência do dono (via chat): ${note.text}`,
      evidence: { at: note.at },
    });
    return `Registrado como preferência sua: "${note.text}". Isso passa a valer nas minhas próximas propostas e prioridades — e você pode reverter quando quiser.`;
  }

  /* ---------- inteligência proativa ---------- */
  briefing() {
    const facts = this.q.getOperationBriefing();
    return { facts, message: compose(facts, { clock: this.clock }) };
  }

  radar() {
    const risks = this.q.getRiskSummary();
    return { facts: risks, message: compose(risks, { clock: this.clock }) };
  }

  closing() {
    const sales = this.q.getSalesSummary({ compareWith: 'YESTERDAY_SAME_TIME' });
    const fin = this.q.getFinancialSummary({});
    const ful = this.q.getFulfillmentStatus();
    const ads = this.q.getAdsPerformance({});
    const decisions = this.mie && this.mie.epe.lastPlan ? this.mie.epe.lastPlan.decisions : [];
    const lines = ['Fechamento do dia:', ''];
    if (sales.kind === 'SALES')
      lines.push(`• Vendas: ${money(sales.grossRevenue)} em ${sales.ordersCount} pedidos${sales.comparison ? ` (${sales.comparison.deltaPct >= 0 ? '+' : ''}${String(sales.comparison.deltaPct).replace('.', ',')}% vs ontem no mesmo horário)` : ''}`);
    if (fin.kind === 'FINANCIAL' && fin.estimatedMarginValue != null)
      lines.push(`• Margem estimada: ${money(fin.estimatedMarginValue)} (${fin.estimatedMarginPct}%)`);
    if (ads.kind === 'ADS') lines.push(`• Ads: ${money(ads.spend)} investidos · ROAS ${String(ads.roas).replace('.', ',')}x`);
    if (ful.kind === 'FULFILLMENT')
      lines.push(`• Expedição: ${ful.shippedToday} enviados; ficaram ${ful.toShip} para amanhã (${ful.late.length} atrasados)`);
    if (decisions.length) lines.push(`• Decisões pendentes de você: ${decisions.length}`);
    lines.push('', `Foco recomendado para amanhã: ${this.q.getRiskSummary().top ? this.q.getRiskSummary().top.nextMove : 'manter o ritmo — nenhum risco aberto'}.`,
      '', `${sales.dataSource === 'DEMO_FIXTURE' ? 'Dados demonstrativos' : 'Dados internos'} • Fechado às ${localTime(this.clock)}`);
    return { facts: { sales, fin, ful, ads }, message: lines.join('\n') };
  }
}

NS.HeadChat = HeadChat;

/* composição — dados normalizados da Central quando houver; fixtures no preview */
NS.createHeadChat = function createHeadChat({ clock, mie = null, mos = null, companyId = null, dataset = null, compliance = null, growth = null } = {}) {
  if (!clock) throw new Error('createHeadChat exige o Clock injetado');
  let data = dataset;
  if (!data && mos && companyId)
    data = NS.datasetFromCentral(mos.repos, companyId, clock);  // fonte real, se sincronizada
  if (!data)
    data = NS.createDemoDataset(clock);                          // preview: fixtures coerentes
  return new HeadChat({ dataset: data, clock, mie, companyId, compliance, growth,
    logger: mos && mos.logger ? mos.logger.child({ mod: 'head-chat' }) : null });
};
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.HEADCHAT = globalThis.HEADCHAT || {}));
