/* =============================================================
   OPERAÇÃO — Central Operacional Conversacional (Sprint 09.A)

   Este arquivo é SÓ apresentação (UI). Nenhuma lógica de resposta,
   intenção, número ou regra vive aqui: tudo vem da camada compartilhada
   `mos/src/chat` (globalThis.HEADCHAT) — a MESMA usada pela API e pelos
   testes em Node. Fixtures agora; dados normalizados da Central depois.
   ============================================================= */
(function () {
  "use strict";

  /* Clock injetado (Sprint 08.1) — relógio do sistema, TZ da operação */
  const clock = MIE.createClock();

  /* Adaptador: o plano exibido na HOME é a MESMA fonte que o chat consulta
     para decisões — nenhuma segunda verdade. (Shape do EPE lastPlan.) */
  const planFromData = {
    generatedAtIso: clock.nowIso(),
    decisions: DATA.decisions.map(d => ({
      title: d.descoberta,
      level: (levelLabel[d.level] || d.level),
      score: d.breakdown.score,
      reason: d.proposta,
      impactMonthly: d.breakdown.impact,
      urgency: d.breakdown.urgency,
      confidence: d.breakdown.confidence,
      breakdown: {
        base: d.breakdown.base, mult: d.breakdown.mult, factors: d.breakdown.factors,
        riskOfWaiting: d.breakdown.riskWait, riskOfActingEarly: d.breakdown.riskEarly,
      },
      provenance: null,
    })),
    missions: [],
    silence: DATA.silence.map(s => ({ title: s.title, reason: s.reason })),
  };
  const mieLike = {
    epe: { lastPlan: planFromData, externalSignals: [] },
    memory: { absorb() {} },
    planDay: () => planFromData,
  };

  /* Compliance Engine (Sprint 10): o chat consulta o MESMO motor do Catálogo */
  const complianceAdapter = HEADCOMPLIANCE.createComplianceAdapter({
    products: HEADCOMPLIANCE.DEMO_PRODUCTS, clock });
  const chat = HEADCHAT.createHeadChat({ clock, mie: mieLike, compliance: complianceAdapter });

  /* ---------------- render ---------------- */
  const box = $("#opChat");
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  /* formata o texto da camada (apresentação apenas): destaca a resposta
     principal, pontos, alerta e o rodapé de fonte/hora/cobertura */
  function formatReply(text) {
    const lines = String(text).split("\n");
    const html = [];
    let first = true;
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) continue;
      const e = esc(l);
      if (/^Atenção:/.test(l)) html.push(`<div class="op-alert">${e}</div>`);
      else if (/Atualizado às|Fechado às|^Dados demonstrativos|^Dados internos|^Sem dados/.test(l))
        html.push(`<div class="op-src">${e}</div>`);
      else if (/^[•▸]/.test(l) || /^\d+\.\s/.test(l)) html.push(`<div class="op-line">${e}</div>`);
      else if (first) { html.push(`<div class="op-main">${e}</div>`); first = false; }
      else html.push(`<div class="op-para">${e}</div>`);
    }
    return `<div class="reply">${html.join("")}</div>`;
  }

  function addUser(t) {
    box.insertAdjacentHTML("beforeend",
      `<div class="msg user"><div class="who">${esc(DATA.user)}</div><div class="bubble"></div></div>`);
    box.lastElementChild.querySelector(".bubble").textContent = t;
    scrollDown();
  }

  function addHead(r, { instant = false } = {}) {
    let html = formatReply(r.reply);
    if (r.query && r.query.inherited)
      html = `<div class="op-ctx">↳ usei o contexto da pergunta anterior</div>` + html;
    /* ligação opcional com o Plano do Dia (nunca navegação forçada) */
    if (r.facts && (r.facts.kind === "PENDING_DECISIONS" || r.facts.kind === "DECISION_EXPLANATION"))
      html += `<button class="op-link" onclick="HeadOps.goPlan()">ver no Plano do Dia →</button>`;
    /* compliance → abre o produto correspondente no Catálogo (opcional) */
    if (r.facts && r.facts.kind === "COMPLIANCE_STATUS")
      html += `<button class="op-link" onclick="Catalogo.open('${r.facts.result.productId.replace('prd-', '').toUpperCase()}')">abrir no Catálogo →</button>`;
    if (r.intent === "ACTION_REQUEST")
      html = `<div class="op-ro">MODO LEITURA · proposta aguardando sua aprovação — nada foi alterado no marketplace</div>` + html;

    box.insertAdjacentHTML("beforeend",
      `<div class="msg head"><div class="who">Head</div><div class="typing"><i></i><i></i><i></i></div></div>`);
    scrollDown();
    const node = box.lastElementChild;
    const swap = () => { node.querySelector(".typing").outerHTML = html; scrollDown(); };
    if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) swap();
    else setTimeout(swap, 550);
  }

  function scrollDown() {
    /* só rola quando a Operação está visível — nunca mexe na Home */
    if (!document.getElementById("v-operacao").classList.contains("on")) return;
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight }));
  }

  /* ---------------- API da superfície ---------------- */
  function ask(text, opts = {}) {
    if (!text || !text.trim()) return;
    addUser(text.trim());
    const r = chat.ask(text.trim(), { surface: "v3" });   // a MESMA camada da API
    addHead(r, opts);
    return r;
  }
  function runCmd(kind, opts = {}) {
    const label = { briefing: "Briefing da manhã", radar: "Radar operacional", closing: "Fechamento do dia" }[kind];
    addUser(label);
    const r = chat[kind]();
    addHead({ reply: r.message, facts: r.facts, query: null, intent: "PROACTIVE" }, opts);
  }
  function goPlan() {
    go("home");
    const el = document.getElementById("decisions");
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2400); }
  }
  window.HeadOps = { ask, runCmd, goPlan, chat };

  /* ---------------- montagem ---------------- */
  const CHIPS = [
    "Quanto vendi hoje?", "Quantos pedidos faltam enviar?", "Como está minha operação?",
    "Quanto gastei de Ads?", "Como está minha conversão?", "O que está acabando?",
    "Onde estou perdendo dinheiro?", "Compare Shopee e Mercado Livre",
    "Qual decisão precisa de mim?", "Por que você priorizou isso?",
    "O que falta para publicar o espelho na Shopee?", "Quais itens estão bloqueados?",
  ];
  const SHORTCUTS = [
    ["Vendas", "Quanto vendi hoje?"], ["Pedidos", "Quantos pedidos eu fiz hoje?"],
    ["Expedição", "Quantos pedidos faltam enviar?"], ["Ads", "Quanto gastei de Ads?"],
    ["Estoque", "O que está acabando?"], ["Conversão", "Como está minha conversão?"],
    ["Risco", "Qual é meu maior risco hoje?"],
  ];
  $("#opSuggest").innerHTML = CHIPS.map(c =>
    `<button class="chip" onclick="HeadOps.ask('${c.replace(/'/g, "\\'")}')">${c}</button>`).join("");
  $("#opShortcuts").innerHTML = SHORTCUTS.map(([l, q]) =>
    `<button class="op-tab" onclick="HeadOps.ask('${q.replace(/'/g, "\\'")}')">${l}</button>`).join("");
  $$(".op-cmds .chip").forEach(b => b.addEventListener("click", () => HeadOps.runCmd(b.dataset.cmd)));

  const input = $("#opInput");
  $("#opSend").addEventListener("click", () => { const v = input.value.trim(); input.value = ""; ask(v); });
  input.addEventListener("keydown", e => { if (e.key === "Enter") { const v = input.value.trim(); input.value = ""; ask(v); } });

  /* Home → "Pergunte ao Head": navega para a Operação já respondendo */
  const homeInput = $("#askHeadInput");
  const goAsk = () => { const v = homeInput.value.trim(); homeInput.value = ""; go("operacao"); if (v) ask(v); else input.focus(); };
  $("#askHeadGo").addEventListener("click", goAsk);
  homeInput.addEventListener("keydown", e => { if (e.key === "Enter") goAsk(); });

  /* saudação inicial — convite, não recado */
  addHead({ reply: `Oi, ${DATA.user}. Esta é a sua Operação: pergunte qualquer coisa — vendas, pedidos, expedição, Ads, conversão, estoque, margem, riscos ou o porquê das minhas prioridades. Eu respondo na hora, com fonte e horário.`, intent: "WELCOME" }, { instant: true });

  /* validação headless (?chatself=1): roda um roteiro e marca o DOM */
  if (location.search.includes("chatself")) {
    go("operacao");
    ["Quanto vendi hoje?", "E na Shopee?", "Quantos pedidos faltam enviar?",
     "O que falta para publicar o espelho na Shopee?", "Quais itens estão bloqueados?",
     "Qual decisão precisa de mim?", "Baixe o preço do kit de quadros"]
      .forEach(q => ask(q, { instant: true }));
    runCmd("briefing", { instant: true });
    document.body.dataset.chatReady = "ok";
  }
})();
