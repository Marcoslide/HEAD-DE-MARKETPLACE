/* =============================================================
   CRESCIMENTO — a mesa comercial (Sprint 10.B)

   Leads, afiliados, promoções, campanhas e resultados — tudo
   VINCULADO a produto, anúncio, marketplace, origem e margem.
   Dados 100% demonstrativos (HEADGROWTH.createDemoGrowthDataset);
   nenhum CRM, afiliado ou promoção externa está conectado, e a
   tela declara isso o tempo todo. Nenhuma escrita externa existe.
   ============================================================= */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const clock = MIE.createClock();
  const DS = HEADGROWTH.createDemoGrowthDataset(clock);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const money = v => `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  const dec = v => String(v).replace(".", ",");

  const SUBNAV = ["Visão Geral", "Leads e Oportunidades", "Afiliados",
                  "Promoções e Campanhas", "Resultados", "Pendências Comerciais"];
  let tab = 0;

  /* jobs internos criados por comando (WhatsApp/Chat) — aparecem AQUI e no Catálogo */
  const S = { jobs: [], approvals: [{ kind: "PROMOTION", what: "Promoção Demo ML — Serra (margem abaixo da mínima)", status: "PENDENTE" }],
              conflicts: [{ field: "base_price", manual: "R$ 205 (MANUAL)", sync: "R$ 189 (MARKETPLACE_SYNC)", product: "QDR-SER" }] };

  const demoChip = `<span class="gro-chip demo">demonstrativo</span>`;
  const srcChip = (t) => `<span class="gro-chip">${esc(t)}</span>`;

  /* ---------------- render ---------------- */
  function renderSubnav() {
    $("#groSubnav").innerHTML = SUBNAV.map((s, i) =>
      `<button class="op-tab${i === tab ? " on" : ""}" onclick="Crescimento.tab(${i})">${s}</button>`).join("");
    $("#groNote").textContent = "WhatsApp comanda · a tela edita, revisa e aprova · nada é ativado externamente";
  }

  function render() {
    renderSubnav();
    const el = $("#groContent");
    switch (tab) {
      case 0: el.innerHTML = overview(); break;
      case 1: el.innerHTML = leads(); break;
      case 2: el.innerHTML = affiliates(); break;
      case 3: el.innerHTML = promotions(); break;
      case 4: el.innerHTML = results(); break;
      case 5: el.innerHTML = pending(); break;
    }
  }

  function overview() {
    const today = DS.leads.filter(l => (l.enteredAt || "").slice(0, 10) === clock.today()).length;
    return `
      <div class="cat-overview">
        <div class="cell"><div class="n amber">${today}</div><div class="l">leads hoje (demo)</div></div>
        <div class="cell"><div class="n">${DS.leads.length}</div><div class="l">leads no funil (demo)</div></div>
        <div class="cell"><div class="n amber">${DS.followUpsDueToday.length}</div><div class="l">follow-ups vencem hoje</div></div>
        <div class="cell"><div class="n">${DS.affiliates.length}</div><div class="l">afiliados (importação manual)</div></div>
        <div class="cell"><div class="n amber">${DS.promotions.length}</div><div class="l">promoções em preparo</div></div>
        <div class="cell"><div class="n">${S.jobs.length}</div><div class="l">ações internas via comando</div></div>
      </div>
      <div class="section"><div class="section-h"><span class="eyebrow">Como esta mesa funciona</span></div>
        <article class="card"><h3 class="voice">WhatsApp é o controle remoto. O Catálogo é a mesa dos produtos e anúncios. O Crescimento é a mesa comercial. As Conexões ligam tudo ao mundo real.</h3>
        <p class="silence-note" style="margin-top:8px">Todo comando (WhatsApp ou chat) usa os MESMOS serviços desta tela, com origem registrada, confirmação para ações em massa e auditoria. Nenhuma promoção, preço ou anúncio é ativado externamente — escrita externa segue bloqueada.</p></article>
      </div>`;
  }

  function leads() {
    const rows = DS.leads.map(l => `
      <tr>
        <td><b>${esc(l.name)}</b> ${demoChip}</td>
        <td>${esc(l.origin)}</td>
        <td><span class="gro-status s-${l.status}">${l.status.replace(/_/g, " ")}</span></td>
        <td>${l.productSku ? `<a class="gro-link" onclick="Catalogo.open('${l.productSku}');go('catalogo')">${esc(l.productName || l.productSku)}</a>` : "—"}</td>
        <td>${l.marketplace ? esc(l.marketplace) : "—"}</td>
        <td>${l.affiliateName ? esc(l.affiliateName) : "—"}</td>
        <td>${l.estimatedValue ? money(l.estimatedValue) : "—"}</td>
        <td>${(l.enteredAt || "").slice(0, 10)}</td>
        <td>${l.lastInteractionAt ? l.lastInteractionAt.slice(11, 16) : "sem interação"}</td>
        <td class="gro-actions">
          <button class="gro-mini" onclick="Crescimento.act('follow-up agendado para ${esc(l.name)}')">follow-up</button>
          <button class="gro-mini" onclick="Crescimento.act('responsável atribuído a ${esc(l.name)}')">atribuir</button>
          <button class="gro-mini" onclick="Crescimento.act('observação registrada em ${esc(l.name)} (com auditoria)')">nota</button>
        </td>
      </tr>`).join("");
    return `
      <div class="section"><div class="section-h"><span class="eyebrow">Leads e Oportunidades</span>
        <span class="more">origens: WhatsApp · formulário · perguntas do marketplace · afiliado · importação</span></div>
        <p class="silence-note">Nenhum CRM externo conectado. Estes leads são DEMONSTRATIVOS — quando a operação real começar, você poderá criar manualmente ou importar (com fonte gravada). O número administrador do WhatsApp NUNCA se mistura com atendimento comercial.</p>
        <div class="gro-tools">
          <button class="btn" onclick="Crescimento.act('lead manual criado (dados registrados com origem MANUAL, histórico e auditoria)')">+ criar lead manualmente</button>
          <button class="btn" onclick="Crescimento.act('importação de CSV registrada como IMPORTACAO_MANUAL — dedup por telefone/e-mail aplicado')">importar lista</button>
        </div>
        <div class="gro-tablewrap"><table class="gro-table">
          <thead><tr><th>lead</th><th>origem</th><th>status</th><th>produto de interesse</th><th>praça</th><th>afiliado</th><th>valor est.</th><th>entrada</th><th>última interação</th><th>ações internas</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
        <p class="cat-src">Lead → produto → anúncio → marketplace → afiliado → campanha: tudo vinculado. Ações aqui são internas e auditáveis; nada toca o marketplace.</p>
      </div>`;
  }

  function affiliates() {
    const rows = DS.affiliates.map(a => `
      <tr>
        <td><b>${a.rank}. ${esc(a.name)}</b><br><span class="gro-dim">${esc(a.channel)} · ${esc(a.status)}</span></td>
        <td>${a.clicks}</td>
        <td>${a.orders}</td>
        <td>${money(a.revenue)}</td>
        <td>${dec(a.conversionRate)}%</td>
        <td>${money(a.avgTicket)}</td>
        <td>${money(a.commission.estimada)} <span class="gro-dim">estimada</span></td>
        <td>${Object.entries(a.byMarketplace).map(([m, v]) => `${m}: ${money(v)}`).join("<br>")}</td>
        <td>${srcChip(a.attribution.note)}</td>
      </tr>`).join("");
    return `
      <div class="section"><div class="section-h"><span class="eyebrow">Afiliados · Affiliate Intelligence</span>
        <span class="more">uma venda = um afiliado · clique nunca vira comissão sozinho</span></div>
        <p class="silence-note">DADOS IMPORTADOS MANUALMENTE (demonstração) — nenhuma integração de atribuição está conectada. Confiança marcada como ESTIMADA; comissões nascem estimadas e NUNCA viram pagamento real automaticamente.</p>
        <div class="gro-tablewrap"><table class="gro-table">
          <thead><tr><th>afiliado</th><th>cliques</th><th>pedidos</th><th>receita atrib.</th><th>conversão</th><th>ticket</th><th>comissão</th><th>por praça</th><th>fonte</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
        <div class="gro-tools">
          <button class="btn" onclick="Crescimento.act('resultado importado (fonte IMPORTACAO_MANUAL registrada; dupla atribuição bloqueada)')">importar resultados</button>
          <button class="btn" onclick="Crescimento.act('lote de comissões criado EM_REVISAO — pagar exige aprovação futura (ADMIN/FINANCEIRO)')">preparar lote de comissão</button>
        </div>
      </div>`;
  }

  function promotions() {
    const cards = DS.promotions.map(p => `
      <article class="card">
        <div class="eyebrow"><span class="tag ${p.reason ? "crit" : "pos"}">${p.status}</span> <span class="gro-dim">${esc(p.marketplace)} · entidade compartilhada com o Catálogo</span></div>
        <h3 class="voice">${esc(p.name)}</h3>
        <div class="gro-sim">
          <div><span>desconto</span><b>${p.discountPct}%</b></div>
          <div><span>margem simulada</span><b class="${p.marginPct < 15 ? "neg" : ""}">${dec(p.marginPct)}%</b></div>
          <div><span>preço mínimo</span><b>${money(p.minPrice)}</b></div>
          <div><span>limite de estoque</span><b>${p.capUnits}/${p.stock} un</b></div>
          <div><span>risco de ruptura</span><b>${esc(p.stockRisk.split(" — ")[0])}</b></div>
        </div>
        ${p.reason ? `<p class="cat-src" style="color:var(--warn,#e6b455)">EM REVISÃO: ${esc(p.reason)} — sem margem saudável, não avança.</p>` : ""}
        <div class="gro-tools">
          <button class="gro-mini" onclick="Catalogo.open('${p.targetSku}');go('catalogo')">ver produto no Catálogo →</button>
          <button class="gro-mini" onclick="Crescimento.act('simulação refeita: custo + embalagem + comissão + taxa + imposto + desconto + afiliado → margem')">recalcular margem</button>
          <button class="gro-mini" onclick="Crescimento.act('promoção aprovada INTERNAMENTE (registro de aprovação criado) — ainda não existe ativação externa')">aprovar internamente</button>
          <button class="gro-mini blocked" onclick="Crescimento.act('BLOQUEADO: ativar externamente é escrita no marketplace — proibida; estado máximo é AGUARDANDO_AUTORIZACAO_DE_ESCRITA')">ativar externamente ⃠</button>
        </div>
      </article>`).join("");
    return `
      <div class="section"><div class="section-h"><span class="eyebrow">Promoções e Campanhas</span>
        <span class="more">criar · simular · revisar · aprovar internamente — ativação externa: bloqueada</span></div>
        <p class="silence-note">A promoção é UMA entidade: o Catálogo a vê pelos produtos; aqui você vê estratégia, margem e risco. Nenhuma promoção é ativada externamente neste sprint.</p>
        ${cards}
      </div>`;
  }

  function results() {
    const row = (name, value, src, cov) => `
      <tr><td>${name}</td><td>${value}</td><td>${srcChip(src)}</td><td class="gro-dim">${cov}</td></tr>`;
    return `
      <div class="section"><div class="section-h"><span class="eyebrow">Resultados · números comerciais</span>
        <span class="more">todo número com período, fonte, cobertura e atualização</span></div>
        <div class="gro-tablewrap"><table class="gro-table">
          <thead><tr><th>métrica (julho)</th><th>valor</th><th>fonte</th><th>cobertura</th></tr></thead><tbody>
          ${row("Vendas por marketplace", "—", "SEM_DADO", "nenhuma praça sincronizada — conecte em Conexões")}
          ${row("Leads por origem", "4 (WhatsApp 1 · marketplace 1 · afiliado 1 · formulário 1)", "DEMONSTRATIVO", "leads demo rotulados; CRM não conectado")}
          ${row("Receita atribuída a afiliados", money(2650), "IMPORTADO", "importação manual — não é atribuição confirmada")}
          ${row("Comissões estimadas", money(265), "IMPORTADO", "estimadas — nenhum pagamento real")}
          ${row("Promoções em preparo", "2 (1 em revisão por margem)", "REAL", "registros internos desta operação")}
          ${row("Estoque comprometido em promoções", "40 un (limites internos)", "REAL", "limites definidos nas promoções internas")}
          ${row("ROI", "não calculado", "SEM_DADO", "exige custo e receita reais conectados — nunca estimado sem base")}
        </tbody></table></div>
      </div>`;
  }

  function pending() {
    const jobs = S.jobs.length ? S.jobs.map(j => `
      <article class="card"><div class="eyebrow"><span class="tag">${j.status}</span> <span class="gro-dim">origem: ${j.origin} · job interno auditável</span></div>
        <h3 class="voice">${esc(j.summary)}</h3>
        <p class="cat-src">${j.items.map(esc).join(" · ")} — nada publicado no marketplace.</p>
      </article>`).join("") :
      `<p class="silence-note">Nenhuma ação interna via comando ainda. Experimente na Operação: "Cria drafts shopee dos produtos com margem acima de 25%".</p>`;
    return `
      <div class="section"><div class="section-h"><span class="eyebrow">Pendências Comerciais</span></div>
        <article class="card"><div class="eyebrow"><span class="tag">FOLLOW-UPS DE HOJE</span></div>
          ${DS.followUpsDueToday.map(f => `<div class="op-line">• ${esc(f.leadName)} — ${esc(f.note)}</div>`).join("")}
        </article>
        <article class="card"><div class="eyebrow"><span class="tag">APROVAÇÕES PENDENTES</span></div>
          ${S.approvals.map(a => `<div class="op-line">• [${a.kind}] ${esc(a.what)} — decisor: gestor/admin</div>`).join("")}
        </article>
        <article class="card"><div class="eyebrow"><span class="tag">CONFLITO MANUAL × SYNC</span></div>
          ${S.conflicts.map(c => `<div class="op-line">• ${c.product} · campo ${c.field}: mantive ${esc(c.manual)}; sync trouxe ${esc(c.sync)} — sua revisão decide.</div>`).join("")}
        </article>
        <div class="section-h" style="margin-top:16px"><span class="eyebrow">Ações internas via comando (WhatsApp/Chat)</span></div>
        ${jobs}
      </div>`;
  }

  /* strip no CATÁLOGO: a ação comandada aparece na mesa de operação */
  function renderCatalogStrip() {
    const el = $("#catJobs");
    if (!el) return;
    el.innerHTML = S.jobs.length ? `
      <div class="cat-banner" style="margin-bottom:10px">AÇÕES INTERNAS RECENTES (via comando) — rascunhos aguardando sua revisão</div>
      ${S.jobs.map(j => `<article class="card"><div class="eyebrow"><span class="tag">${j.status}</span> <span class="gro-dim">origem: ${j.origin}</span></div>
        <h3 class="voice">${esc(j.summary)}</h3>
        <p class="cat-src">${j.items.map(esc).join(" · ")} · nada foi publicado — revise cada rascunho abaixo.</p></article>`).join("")}` : "";
  }

  /* ---------------- API ---------------- */
  const api = {
    tab(i) { tab = i; render(); },
    act(msg) { toast(`AÇÃO INTERNA (demonstração): ${msg}.`); },
    /* job interno vindo de comando (WhatsApp em Conexões, ou chat da Operação) */
    registerJob({ origin, summary, items }) {
      const job = { id: `job-demo-${S.jobs.length + 1}`, origin, summary, items, status: "DONE" };
      S.jobs.push(job);
      renderCatalogStrip();
      if (tab === 5 || tab === 0) render();
      const badge = $("#badgeGrowth"); if (badge) badge.textContent = S.jobs.length;
      return job;
    },
    confirmFromChat(platform, count) {
      api.registerJob({ origin: "CHAT_OPERACIONAL",
        summary: `${count} rascunho(s) interno(s) criado(s) em ${platform} — mesmo Adaptation Engine da tela`,
        items: ["QDR-SER v1", "QDR-NOME v1"].slice(0, count) });
      toast("Confirmado: rascunhos internos criados (job auditável). Veja no Catálogo — nada foi publicado.");
    },
    jobs: S.jobs,
  };
  window.Crescimento = api;

  render();

  /* validação headless (?groself=1): percorre as abas + um job via comando */
  if (location.search.includes("groself")) {
    go("crescimento");
    for (let i = 0; i < SUBNAV.length; i++) { tab = i; render(); }
    api.registerJob({ origin: "WHATSAPP_COMMAND",
      summary: "2 rascunhos internos criados em shopee (comando WhatsApp, confirmado com SIM)",
      items: ["QDR-SER v1", "QDR-NOME v1"] });
    tab = 5; render();
    document.body.dataset.growthReady = "ok";
  }
})();
