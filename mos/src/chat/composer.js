/* HEAD CHAT · RESPONSE COMPOSER (Sprint 09.A)

   Fatos estruturados → resposta do Head: humana, direta, empresarial.
   Formato: resposta principal → detalhe curto → comparação → NO MÁXIMO um
   alerta → rodapé (fonte · atualização · cobertura).

   Regra de ouro: este módulo NÃO cria números — só formata os que vieram
   da Query Layer. Sem fato = resposta honesta de ausência de dado. */
(function (NS) {
'use strict';
const localTime = (...a) => NS.localTime(...a);

const PLATFORM_LABEL = {
  shopee: 'Shopee', mercado_livre: 'Mercado Livre', tiktok: 'TikTok Shop', magalu: 'Magalu',
};
const SOURCE_LABEL = {
  DEMO_FIXTURE: 'Dados demonstrativos',
  NORMALIZED_INTERNAL_DATA: 'Dados internos normalizados',
  LIVE_MARKETPLACE_DATA: 'Dados ao vivo das integrações',
  PUBLIC_RESEARCH: 'Pesquisa pública de mercado',
  NO_DATA: 'Sem dados',
};
const dec = v => String(v).replace('.', ',');
const money = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const plat = p => PLATFORM_LABEL[p] || p;

function footer(facts, clock) {
  const parts = [SOURCE_LABEL[facts.dataSource] || facts.dataSource,
                 `Atualizado às ${localTime(clock)}`];
  if (facts.missingPlatforms && facts.missingPlatforms.length)
    parts.push(`${facts.missingPlatforms.map(plat).join(', ')} sem dados conectados`);
  return parts.join(' • ');
}

function noData(facts, clock) {
  return `Eu ainda não tenho dados suficientes para responder isso com segurança` +
    `${facts.what ? ` (${facts.what})` : ''}. ` +
    `Neste ambiente${facts.missingPlatforms && facts.missingPlatforms.length
      ? `, ${facts.missingPlatforms.map(plat).join(' e ')} não estão sincronizados`
      : ', a fonte necessária não está sincronizada'}. Não vou inventar um número.`;
}

function compose(facts, { clock, alert = null, question = null } = {}) {
  if (!facts || facts.kind === 'NO_DATA') return noData(facts || {}, clock);
  const lines = [];

  switch (facts.kind) {
    case 'SALES': {
      const scope = Object.keys(facts.byPlatform).length === 1
        ? ` na ${plat(Object.keys(facts.byPlatform)[0])}` : '';
      lines.push(`${facts.period.type === 'TODAY' ? 'Até agora, você' : `Em ${facts.period.label}, você`}` +
        ` faturou ${money(facts.grossRevenue)}${scope}, em ${facts.ordersCount} pedidos aprovados` +
        `${facts.ticketAvg ? ` (ticket médio ${money(facts.ticketAvg)})` : ''}.`);
      if (Object.keys(facts.byPlatform).length > 1) {
        lines.push('');
        for (const [p, v] of Object.entries(facts.byPlatform).sort((a, b) => b[1] - a[1]))
          lines.push(`• ${plat(p)}: ${money(v)}`);
        for (const p of facts.missingPlatforms) lines.push(`• ${plat(p)}: sem dados conectados`);
      }
      if (facts.byProduct && facts.byProduct.length) {
        lines.push('', `Produto que mais vendeu: ${facts.byProduct[0].name} (${money(facts.byProduct[0].revenue)} em ${facts.byProduct[0].orders} pedidos).`);
      }
      if (facts.comparison) {
        const c = facts.comparison;
        lines.push('', `Isso está ${dec(Math.abs(c.deltaPct))}% ${c.deltaPct >= 0 ? 'acima' : 'abaixo'} de ${c.label} (${money(c.value)}).`);
      }
      if (facts.requestedButMissing.length)
        lines.push('', `Sem dados de ${facts.requestedButMissing.map(plat).join(', ')} — canal não conectado.`);
      break;
    }
    case 'ORDERS': {
      const op = facts.operational;
      lines.push(`${facts.period.type === 'TODAY' ? 'Hoje' : `Em ${facts.period.label},`} entraram ${facts.received} pedidos.`);
      if (op) lines.push(`Desses e da fila anterior: ${op.shippedToday} já enviados, ${op.toShip} ainda em operação` +
        ` (${op.stages.production} em produção, ${op.stages.packaging} em embalagem, ${op.stages.ready} prontos, ${op.awaitingPickup} aguardando coleta).`);
      if (op && facts.statusFilter && facts.statusFilter.includes('late'))
        lines.push(`Atrasados agora: ${op.late}.`);
      break;
    }
    case 'FULFILLMENT': {
      lines.push(`Você tem ${facts.toShip} pedidos para enviar hoje.`, '',
        `• ${facts.stages.production} em produção`,
        `• ${facts.stages.packaging} aguardando embalagem`,
        `• ${facts.stages.ready} prontos para expedição`,
        `• ${facts.stages.awaiting_pickup} aguardando coleta`,
        `• ${facts.criticalToday.length} críticos por prazo (vencem hoje)`);
      lines.push('', facts.willFit
        ? `A capacidade restante (${facts.capacity.remainingToday}) cobre a fila de hoje.`
        : `A capacidade restante estimada é de ${facts.capacity.remainingToday} pedidos — há risco de atraso em ${facts.atRisk} itens${facts.customAtRisk ? `, incluindo ${facts.customAtRisk} personalizados além da capacidade do dia` : ''}.`);
      if (facts.late.length)
        lines.push(`Já atrasados: ${facts.late.map(o => `${o.id} (${plat(o.platform)}, ${o.hoursLate}h)`).join('; ')}.`);
      break;
    }
    case 'INVENTORY': {
      if (facts.productScope && facts.items.length) {
        for (const i of facts.items)
          lines.push(`${i.name} na ${plat(i.platform)}: ${i.available} disponíveis, ${i.reserved} reservados, ${i.inProduction} em produção` +
            `${i.coverageDays != null ? ` — cobertura de ~${dec(i.coverageDays)} dias no ritmo atual` : ''}.`);
      } else if (facts.critical.length) {
        lines.push(`${facts.critical.length} item(ns) em nível crítico de estoque:`, '');
        for (const i of facts.critical)
          lines.push(`• ${i.name} (${plat(i.platform)}): ${i.available} un — ~${dec(i.coverageDays)} dias de cobertura`);
        const ok = facts.items.filter(i => !i.critical);
        if (ok.length) lines.push('', `Os demais ${ok.length} itens monitorados estão com cobertura confortável.`);
      } else {
        lines.push('Nenhum item em nível crítico. Posições atuais:', '');
        for (const i of facts.items.slice(0, 6))
          lines.push(`• ${i.name} (${plat(i.platform)}): ${i.available} disponíveis${i.coverageDays != null ? ` (~${dec(i.coverageDays)} dias)` : ''}`);
      }
      break;
    }
    case 'ADS': {
      lines.push(`Hoje você investiu ${money(facts.spend)} em Ads e gerou ${money(facts.attributedRevenue)} em vendas atribuídas.`, '',
        `• ROAS: ${dec(facts.roas)}x (faturamento atribuído ÷ investimento)`,
        `• ACOS: ${dec(facts.acosPct)}%`,
        `• Pedidos atribuídos: ${facts.attributedOrders}${facts.cpa ? ` (CPA ${money(facts.cpa)})` : ''}`);
      if (facts.wasteful.length)
        lines.push('', `A campanha ${facts.wasteful[0].name.split(' — ')[0]} consumiu ${money(facts.wasteful[0].spend)} e ainda não gerou pedido.`);
      lines.push('', `Base: ${facts.basis}.`);
      break;
    }
    case 'CONVERSION': {
      const partes = facts.rows.map(r =>
        `${dec(r.convVisitPct)}% ${r.platform === 'mercado_livre' ? 'no' : 'na'} ${plat(r.platform)} (${r.convBasis})`);
      lines.push(`Sua conversão de visita para pedido hoje: ${partes.join(' e ')}.`);
      const dropped = facts.rows.find(r => r.ctrDropped);
      if (dropped)
        lines.push('', `Na ${plat(dropped.platform)}, o CTR caiu de ${dec(dropped.prev.ctrPct)}% para ${dec(dropped.ctrPct)}% (${dropped.ctrBasis}). O problema começou ANTES da compra: menos gente está clicando nos anúncios.`);
      break;
    }
    case 'FINANCIAL': {
      lines.push(`Hoje: ${money(facts.grossRevenue)} de faturamento aprovado, ${money(facts.feesPaid)} em taxas das plataformas, ${money(facts.adsSpend)} em Ads e ${money(facts.returnsLost)} perdidos em devolução.`);
      if (facts.estimatedMarginValue != null)
        lines.push('', `Margem estimada do dia: ~${money(facts.estimatedMarginValue)} (${facts.estimatedMarginPct}% do faturamento, já descontando Ads).`);
      lines.push('', `Importante: ${facts.caveat}.`);
      break;
    }
    case 'RISKS': {
      if (!facts.risks.length) { lines.push('Nenhum risco relevante aberto agora. Operação dentro do normal.'); break; }
      const top = facts.top;
      lines.push(`Seu maior risco hoje é ${top.area}.`, '', top.title + '.');
      if (top.nextMove) lines.push('', `Próximo movimento recomendado: ${top.nextMove}.`);
      const rest = facts.risks.slice(1, 4);
      if (rest.length) {
        lines.push('', 'Também no radar:');
        for (const r of rest) lines.push(`• [${r.area}] ${r.title}`);
      }
      break;
    }
    case 'DECISION_EXPLANATION': {
      lines.push(`"${facts.title}" — nível ${facts.level}.`, '',
        `Por quê: ${facts.reason}.`,
        `• impacto estimado: ${money(facts.impactMonthly)}/mês`,
        `• urgência: ${facts.urgency} · confiança: ${facts.confidence}`,
        `• score executivo: ${facts.score} (base ${facts.breakdown.base} × fatores ${facts.breakdown.factors.map(f => `${f[0]} ×${f[1]}`).join(', ')})`,
        `• risco de esperar: ${facts.breakdown.riskOfWaiting} · risco de agir cedo: ${facts.breakdown.riskOfActingEarly}`);
      if (facts.provenance)
        lines.push(`• origem: ${plat(facts.provenance.platform)} · entidade ${facts.provenance.entityId} · evento ${facts.provenance.eventId}`);
      lines.push('', `Plano gerado em ${facts.planGeneratedAt}.`);
      break;
    }
    case 'PENDING_DECISIONS': {
      if (!facts.items.length) { lines.push('Nenhuma decisão esperando você agora. Eu cuido do resto.'); break; }
      lines.push(`${facts.items.length} decis${facts.items.length > 1 ? 'ões esperam' : 'ão espera'} você hoje:`, '');
      facts.items.forEach((d, i) =>
        lines.push(`${i + 1}. ${d.title}`,
          `   ${d.level}${d.impactMonthly ? ` · impacto ~${money(d.impactMonthly)}/mês` : ''} · score ${d.score}`));
      lines.push('', 'Elas estão priorizadas no seu Plano do Dia — posso explicar o raciocínio de qualquer uma.');
      break;
    }
    case 'BRIEFING': {
      const s = facts.sales, f = facts.fulfillment, r = facts.risks;
      lines.push('Bom dia. Situação até agora:', '');
      if (s && s.kind === 'SALES') {
        lines.push(`• Vendas: ${money(s.grossRevenue)} em ${s.ordersCount} pedidos` +
          (s.comparison ? ` (${s.comparison.deltaPct >= 0 ? '+' : ''}${s.comparison.deltaPct}% vs ontem no mesmo horário)` : ''));
      }
      if (f && f.kind === 'FULFILLMENT')
        lines.push(`• Expedição: ${f.toShip} a enviar (${f.criticalToday.length} críticos por prazo); capacidade restante ${f.capacity.remainingToday}`);
      if (facts.inventory && facts.inventory.critical && facts.inventory.critical.length)
        lines.push(`• Estoque crítico: ${facts.inventory.critical.map(i => i.name).join(', ')}`);
      if (facts.ads && facts.ads.kind === 'ADS')
        lines.push(`• Ads: ${money(facts.ads.spend)} investidos, ROAS ${dec(facts.ads.roas)}x${facts.ads.wasteful.length ? ` (1 campanha gastando sem vender)` : ''}`);
      if (r && r.top) lines.push('', `Maior risco: ${r.top.title}.`);
      if (facts.decisions && facts.decisions.length)
        lines.push('', `Decisões aguardando você: ${facts.decisions.length}.`);
      break;
    }
    default:
      return noData({ what: 'esse tipo de consulta' }, clock);
  }

  /* NO MÁXIMO um alerta — e ele nunca substitui a resposta */
  if (alert) lines.push('', `Atenção: ${alert}`);
  lines.push('', footer(facts, clock));
  return lines.join('\n');
}

NS.compose = compose;
NS.footer = footer;
NS.noData = noData;
NS.money = money;
NS.PLATFORM_LABEL = PLATFORM_LABEL;
NS.SOURCE_LABEL = SOURCE_LABEL;
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.HEADCHAT = globalThis.HEADCHAT || {}));
