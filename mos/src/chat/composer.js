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
  DEMO_RULE_FIXTURE: 'Rule Pack Demo (regras demonstrativas — não são política oficial)',
  DEMO_GROWTH_FIXTURE: 'Dados demonstrativos de Crescimento — nenhum CRM ou afiliado real conectado',
  INTERNAL_RECORDS: 'Registros internos',
  IMPORTACAO_MANUAL: 'Dados importados manualmente',
  NO_DATA: 'Sem dados',
};
const READINESS_LABEL = {
  READY: 'validado contra as regras conhecidas — sem pendências',
  READY_WITH_WARNINGS: 'validado contra as regras conhecidas, com alertas',
  REVIEW_REQUIRED: 'exige REVISÃO antes de publicar',
  BLOCKED: 'BLOQUEADO — há impedimentos',
  INSUFFICIENT_DATA: 'dados insuficientes para validar',
  NOT_SUPPORTED: 'praça sem rule pack registrado',
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
    /* ---------- Catálogo & Compliance (Sprint 10) ---------- */
    case 'COMPLIANCE_STATUS': {
      const r = facts.result;
      lines.push(`${r.productName} — ${plat(r.platform)}: ${READINESS_LABEL[r.status] || r.status}.`);
      const blockers = r.findings.filter(f => f.severity === 'BLOCKER');
      const unknowns = r.findings.filter(f => f.severity === 'UNKNOWN');
      const risks = r.findings.filter(f => f.severity === 'HIGH_RISK');
      const warns = r.findings.filter(f => f.severity === 'WARNING');
      if (blockers.length) {
        lines.push('', 'Bloqueadores:');
        for (const f of blockers) lines.push(`• ${f.message}`);
      }
      if (unknowns.length) {
        lines.push('', 'Exigências não confirmadas (revisão necessária):');
        for (const f of unknowns) lines.push(`• ${f.message}`);
      }
      if (risks.length || warns.length) {
        lines.push('', 'Alertas:');
        for (const f of [...risks, ...warns].slice(0, 5))
          lines.push(`• ${f.message}${f.internal ? ' (regra interna da empresa, não da plataforma)' : ''}`);
      }
      if (r.category && !r.category.confirmed && r.category.suggestedCategory)
        lines.push('', `Categoria sugerida: ${r.category.suggestedCategory} (${r.category.categoryId}) — confiança ${r.category.confidence}${r.category.reviewRequired ? ' · requer confirmação humana' : ''}.`);
      if (r.missing.length) lines.push('', `Faltam: ${[...new Set(r.missing)].join('; ')}.`);
      lines.push('', `Validação baseada no rule pack ${r.rulePackVersion} • verificado em ${r.verifiedAt} • ${r.disclaimer}.`);
      break;
    }
    case 'COMPLIANCE_BOARD': {
      if (!facts.rows.length) { lines.push(`Nenhum produto ${facts.scope ? `para ${facts.scope}` : ''} nesse recorte.`); break; }
      lines.push(`Situação do catálogo${facts.scope ? ` — ${typeof facts.scope === 'string' && PLATFORM_LABEL[facts.scope] ? plat(facts.scope) : facts.scope}` : ''}:`, '');
      for (const b of facts.rows.slice(0, 10))
        lines.push(`• ${b.name} · ${plat(b.platform)}: ${READINESS_LABEL[b.status] || b.status}${b.topBlocker ? ` — ${b.topBlocker}` : ''}`);
      const packs = [...new Set(facts.rows.map(r => r.rulePackVersion))];
      lines.push('', `Validação baseada no(s) rule pack(s) ${packs.join(', ')} — nunca é aprovação oficial da plataforma.`);
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
    /* ---------- Crescimento (Sprint 10.B) ---------- */
    case 'LEADS_SUMMARY': {
      const r = facts.real, d = facts.demo;
      if (!r.total && !d.total) { lines.push('Nenhum lead registrado ainda. Você pode criar manualmente ou importar uma lista na área Crescimento — nenhum CRM externo está conectado.'); break; }
      if (!r.total && d.total) {
        lines.push(`Hoje chegaram ${d.today} lead(s) — todos DEMONSTRATIVOS (${d.unanswered} sem resposta). Nenhum lead real registrado; nenhum CRM externo conectado.`);
        const org = Object.entries(d.byOrigin).sort((a, b) => b[1] - a[1]);
        if (org.length) lines.push('', ...org.map(([o, n]) => `• ${o}: ${n}`));
        break;
      }
      if (r.total) {
        lines.push(`Você tem ${r.total} lead(s) registrados (${r.label}): ${r.today} chegaram hoje, ${r.unanswered} sem resposta.`);
        const org = Object.entries(r.byOrigin).sort((a, b) => b[1] - a[1]);
        if (org.length) lines.push('', ...org.map(([o, n]) => `• ${o}: ${n}`));
      }
      if (d.total) lines.push('', `Além disso, ${d.total} lead(s) DEMONSTRATIVOS (rotulados, nunca misturados aos reais).`);
      break;
    }
    case 'LEADS_LIST': {
      if (!facts.items.length) { lines.push(`Nenhum lead ${facts.scope || 'nesse recorte'}.`); break; }
      lines.push(`${facts.items.length} lead(s) ${facts.scope || ''}:`, '');
      for (const l of facts.items.slice(0, 8))
        lines.push(`• ${l.name} · ${l.origin}${l.productName ? ` · interesse: ${l.productName}` : ''} · ${l.status}${l.enteredAt ? ` · entrou ${l.enteredAt.slice(0, 10)}` : ''}`);
      break;
    }
    case 'FOLLOWUPS_DUE': {
      if (!facts.items.length) { lines.push('Nenhuma oportunidade precisa de follow-up hoje.'); break; }
      lines.push(`${facts.items.length} follow-up(s) vencem hoje:`, '');
      for (const f of facts.items.slice(0, 8))
        lines.push(`• ${f.leadName}${f.note ? ` — ${f.note}` : ''}`);
      break;
    }
    case 'AFFILIATE_PANEL': {
      if (!facts.partners.length) { lines.push('Nenhum afiliado cadastrado. Cadastre parceiros e importe resultados na área Crescimento — nenhuma atribuição é inventada.'); break; }
      lines.push(facts.view === 'RANKING' ? 'Seus afiliados por receita atribuída:' : 'Desempenho dos afiliados:', '');
      for (const a of facts.partners.slice(0, 6)) {
        lines.push(`${a.rank}. ${a.name}: ${money(a.revenue)} em ${a.orders} pedido(s)` +
          `${a.commission ? ` · comissão estimada ${money(a.commission.estimada + a.commission.pendente)}` : ''}` +
          ` · ${a.attribution.note}`);
        if (facts.view === 'BY_MARKETPLACE' && a.byMarketplace)
          for (const [mp, v] of Object.entries(a.byMarketplace)) lines.push(`   · ${plat(mp)}: ${money(v)}`);
      }
      lines.push('', 'Comissões são ESTIMADAS — nenhum pagamento real é criado automaticamente.');
      break;
    }
    case 'PROMOTION_RISK': {
      if (!facts.items.length) { lines.push('Nenhuma promoção está derrubando sua margem nas simulações atuais.'); break; }
      lines.push(`${facts.items.length} promoção(ões) com risco de margem:`, '');
      for (const p of facts.items.slice(0, 6))
        lines.push(`• ${p.name} (${plat(p.marketplace)}): ${p.marginPct != null ? `margem simulada ${dec(p.marginPct)}%` : `margem não computável — ${p.reason}`}`);
      lines.push('', 'Nada disso está ativo externamente — são promoções internas em preparação/revisão.');
      break;
    }
    case 'PROMOTION_OPPORTUNITY': {
      if (!facts.items.length) { lines.push('Nenhum produto de alto giro está sem promoção nesse recorte.'); break; }
      lines.push(`${facts.items.length} produto(s) de alto giro SEM promoção:`, '');
      for (const p of facts.items.slice(0, 6))
        lines.push(`• ${p.name}${p.orders ? ` — ${p.orders} pedidos no período` : ''}${p.marginPct != null ? ` · margem ~${dec(p.marginPct)}%` : ''}`);
      lines.push('', 'Posso preparar uma promoção interna para revisão — nada é ativado externamente.');
      break;
    }
    case 'CATALOG_GAP': {
      if (!facts.gap) { lines.push('Preciso de duas praças para comparar (ex.: "vendem na Shopee e não estão no Mercado Livre").'); break; }
      if (!facts.items.length) { lines.push(`Nenhum produto vende na ${plat(facts.gap.source)} sem presença na ${plat(facts.gap.target)}.`); break; }
      lines.push(`${facts.items.length} produto(s) vendem na ${plat(facts.gap.source)} e ainda não estão na ${plat(facts.gap.target)}:`, '');
      for (const p of facts.items.slice(0, 8))
        lines.push(`• ${p.sku} — ${p.name}${p.marginPct != null ? ` (margem estimada ${dec(p.marginPct)}% na ${plat(facts.gap.target)})` : ''}`);
      lines.push('', `Quer que eu crie os rascunhos internos para a ${plat(facts.gap.target)}? (nada é publicado sem sua revisão)`);
      break;
    }
    case 'GROWTH_ACTION_PLAN': {
      lines.push(facts.summaryText);
      if (facts.items && facts.items.length) {
        lines.push('');
        for (const i of facts.items.slice(0, 6))
          lines.push(`• ${i.sku} — ${i.name}${i.marginPct != null ? ` (margem ~${dec(i.marginPct)}%)` : ' (margem a revisar)'}`);
      }
      lines.push('', facts.requiresConfirmation
        ? 'Ação em massa: confirme para eu criar os registros INTERNOS — nada é publicado no marketplace.'
        : 'Registro interno criado — revise na área correspondente. Nada foi publicado no marketplace.');
      break;
    }
    /* ---------- RID / Head Intelligence OS (Sprint 10.C) ---------- */
    case 'INTERVENTION_ACK': {
      lines.push(facts.ack);
      break;
    }
    case 'RID_REPORT': {
      lines.push(...String(facts.text).split('\n'));
      if (facts.deduplicated) lines.push('', '(relatório de hoje já existia — não vou te mandar duas vezes)');
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
