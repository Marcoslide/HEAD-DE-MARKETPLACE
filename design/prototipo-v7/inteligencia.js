/* =============================================================
   HEAD INTELLIGENCE OS — v7 (Sprint 10.C)

   Demonstração fiel do RID evoluído: radar → diagnóstico (FATO ≠
   HIPÓTESE) → diálogo estratégico (a direção anterior do dono NUNCA
   é ignorada) → plano com microtarefas → intervenção monitorada →
   aprendizado → relatórios. Tudo simulado e declarado; nenhuma ação
   externa é executada.
   ============================================================= */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  const S = {
    dialogueStatus: "AWAITING_OWNER_DIRECTION",
    decision: null, plan: null, intervention: null, learning: null,
    weekly: false,
  };

  const CASE = {
    fato: "Devoluções do Espelho Orgânico 170x70 subiram de 4,1% para 9,8% em 14 dias.",
    evidencia: "62% dos motivos mencionam quebra, trinca, avaria ou embalagem.",
    hipotese: "A proteção lateral pode estar insuficiente.",
    confianca: "MÉDIA-ALTA",
    direcaoAnterior: "Crescer Shopee com preço mais agressivo (sua decisão de 20/06 — registrada em memória).",
    conflito: "Se mantivermos exatamente o mesmo caminho, seguimos faturando mais, com lucro menor e mais pressão na operação.",
  };

  /* ---------------- HOME: resumo executivo + pendências do RID ---------------- */
  function renderHome() {
    const el = $("#ridHome"); if (!el) return;
    el.innerHTML = `
      <article class="card" style="margin-top:14px">
        <div class="eyebrow"><span class="tag">Resumo do dia</span> <span class="gro-dim">Daily Executive Brief · fontes: radar DEMONSTRATIVO · vendas SEM_DADO · leads DEMONSTRATIVO</span></div>
        <div class="op-line">1. Shopee cresceu 12%, mas a margem caiu 4 pontos.</div>
        <div class="op-line">2. Devoluções do Espelho 170x70 aumentaram, com indício de avaria.</div>
        <div class="op-line">3. Há 8 produtos prontos para rascunho no Mercado Livre.</div>
        <div class="op-line">4. Dois afiliados concentram comissão alta com retorno baixo.</div>
        <div class="op-para" style="margin-top:8px"><b>Prioridades:</b> 1. validar embalagem do espelho · 2. revisar comissão de 2 afiliados · 3. aprovar 8 drafts</div>
        <div class="gro-tools">
          <button class="gro-mini" onclick="Inteligencia.toggleWeekly()">${S.weekly ? "ver resumo diário" : "ver Revisão semanal"}</button>
          <button class="gro-mini" onclick="toast('Resumo enviado ao WhatsApp do administrador (demonstração) com deep link painel://relatorios/rpt-demo-1. Nenhuma escrita externa.')">enviar no WhatsApp</button>
        </div>
        ${S.weekly ? `<div class="op-para" style="margin-top:10px"><b>Revisão semanal:</b> vendas SEM_DADO (nenhuma praça sincronizada) · leads/afiliados DEMONSTRATIVOS · 1 intervenção em monitoramento · 1 conflito estratégico ${S.decision ? "resolvido" : "aguardando você"} · plano da próxima semana: validar embalagem e expandir drafts ML.</div>` : ""}
      </article>
      ${S.dialogueStatus === "AWAITING_OWNER_DIRECTION" ? `
      <article class="card" style="border-color:var(--amber)">
        <div class="eyebrow"><span class="tag crit">CONFLITO ESTRATÉGICO AGUARDANDO VOCÊ</span></div>
        <h3 class="voice">Crescer Shopee com preço agressivo × margem em queda e avarias</h3>
        <p class="silence-note">Sua direção anterior está registrada; os dados novos criam conflito. Eu não sigo nenhum dos caminhos sem a sua decisão.</p>
        <button class="op-link" onclick="go('operacao');Inteligencia.dialogo()">abrir o diálogo na Operação →</button>
      </article>` : `
      <article class="card"><div class="eyebrow"><span class="tag pos">DECISÃO REGISTRADA</span></div>
        <div class="op-line">${esc(S.decision || "")} — executando SÓ o aprovado.</div></article>`}
      ${S.intervention ? `
      <article class="card"><div class="eyebrow"><span class="tag">INTERVENÇÃO EM MONITORAMENTO</span></div>
        <div class="op-line">Embalagem reforçada do Espelho 170x70 · linha de base 9,8% de avaria · observação de 14 dias · amostra atual: ${S.intervention.samples} pedidos ${S.intervention.samples >= 25 ? "→ tendência: 5,2% (IMPROVING)" : "→ ainda sem volume para concluir"}</div></article>` : ""}
      ${S.learning ? `
      <article class="card"><div class="eyebrow"><span class="tag pos">APRENDIZADO RECENTE</span></div>
        <div class="op-line">${esc(S.learning)}</div>
        <div class="gro-dim">reutilizável · confiança ALTA · origem: intervenção monitorada</div></article>` : ""}`;
  }

  /* ---------------- OPERAÇÃO: diálogo estratégico completo ---------------- */
  function head(html) {
    const box = $("#opChat");
    box.insertAdjacentHTML("beforeend",
      `<div class="msg head"><div class="who">Head</div><div class="reply">${html}</div></div>`);
    if (document.getElementById("v-operacao").classList.contains("on"))
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight }));
  }
  function user(t) {
    $("#opChat").insertAdjacentHTML("beforeend",
      `<div class="msg user"><div class="who">${esc(DATA.user)}</div><div class="bubble">${esc(t)}</div></div>`);
  }

  function dialogo() {
    go("operacao");
    head(`<div class="op-main">Marcos, preciso alinhar uma mudança de rota com você.</div>
      <div class="op-para"><b>Sua direção anterior:</b> ${esc(CASE.direcaoAnterior)}</div>
      <div class="op-para"><b>O que mudou:</b> margem caiu 4 pontos em 2 semanas; devoluções subiram nos itens promocionais; Ads mais caro.</div>
      <div class="op-line">• <b>FATO</b> — ${esc(CASE.fato)}</div>
      <div class="op-line">• <b>EVIDÊNCIA</b> — ${esc(CASE.evidencia)}</div>
      <div class="op-line">• <b>HIPÓTESE</b> — ${esc(CASE.hipotese)} (nunca tratada como fato)</div>
      <div class="op-line">• <b>CONFIANÇA</b> — ${esc(CASE.confianca)}</div>
      <div class="op-alert">${esc(CASE.conflito)}</div>
      <div class="op-para"><b>Vejo três opções:</b></div>
      <div class="op-line">1. Manter a estratégia atual e aceitar margem menor no curto prazo.</div>
      <div class="op-line">2. Ajustar a rota: preço agressivo só nos SKUs saudáveis; Ads nos rentáveis.</div>
      <div class="op-line">3. Teste controlado por 7 dias em 3 SKUs antes de mudar a linha.</div>
      <div class="op-para"><b>Minha recomendação técnica é a opção 3</b> — protege caixa, reduz risco e gera evidência antes de escalar. Como você quer seguir?</div>
      <div class="an-chips">
        <button class="gro-mini" onclick="Inteligencia.responder('SEGUIR')">Seguir recomendação do Head</button>
        <button class="gro-mini" onclick="Inteligencia.responder('MANTER')">Manter direção anterior</button>
        <button class="gro-mini" onclick="Inteligencia.responder('TESTE')">Fazer teste pequeno</button>
        <button class="gro-mini" onclick="Inteligencia.responder('ANALISE')">Pedir mais análise</button>
        <button class="gro-mini" onclick="Inteligencia.abrirPlano()">Abrir plano</button>
        <button class="gro-mini" onclick="Inteligencia.responder('TESTE')">Criar missão</button>
        <button class="gro-mini" onclick="Inteligencia.intervencao()">Registrar intervenção</button>
        <button class="gro-mini" onclick="toast('Pergunta enviada ao responsável no WhatsApp (demonstração): peso da nova embalagem e custo unitário.')">Perguntar responsável no WhatsApp</button>
      </div>`);
  }

  function responder(opt) {
    const map = {
      SEGUIR: ["Segue sua ideia.", "OWNER_APPROVED_RID_DIRECTION",
        "Registrado. Vou executar a opção 2/3 conforme o plano — e SÓ ela. Decisão gravada na memória estratégica; nada externo é executado."],
      MANTER: ["Mantém minha estratégia original.", "OWNER_KEPT_PREVIOUS_DIRECTION",
        "Registrado — sua direção prevalece. Sigo monitorando margem e devoluções e volto com dados novos se o risco crescer. Nada muda sem você."],
      TESTE: ["Faz um teste pequeno.", "OWNER_REQUESTED_TEST",
        "Perfeito. Criei o plano experimental: embalagem reforçada em lote controlado do Espelho 170x70, 7–14 dias de observação, métrica = devolução por avaria, ponto de parada definido. Virou missão com microtarefas — veja em A Missão."],
      ANALISE: ["Quero mais análise.", "OWNER_REQUESTED_MORE_ANALYSIS",
        "Certo — vou aprofundar: devolução por SKU/lote/transportadora e custo da embalagem reforçada. Trago o comparativo antes de qualquer mudança."],
    };
    const [text, status, reply] = map[opt];
    user(text);
    S.dialogueStatus = status;
    S.decision = `${status} — "${text}"`;
    if (opt === "TESTE" || opt === "SEGUIR") {
      S.plan = true;
      if (window.Crescimento) Crescimento.registerJob({ origin: "CHAT_OPERACIONAL",
        summary: "Plano experimental: embalagem reforçada do Espelho 170x70 (teste controlado)",
        items: ["ESP-ORG · lote de teste"] });
    }
    head(`<div class="op-main">${esc(reply)}</div>
      <div class="op-src">decisão registrada como memória estratégica · origem CHAT_OPERACIONAL · auditável · nenhuma ação externa</div>
      ${S.plan ? `<button class="op-link" onclick="go('missoes');Inteligencia.renderPlan()">ver plano e microtarefas →</button>` : ""}`);
    renderHome(); renderPlan(); renderMemory();
  }

  function intervencao() {
    user("Coloquei isopor extra, cantoneira reforçada e caixa dupla nos espelhos.");
    S.intervention = { samples: 5 };
    head(`<div class="op-main">Registrado como intervenção na embalagem do Espelho Orgânico 170x70, iniciada hoje às 14:20.</div>
      <div class="op-para">Vou comparar os próximos pedidos com a linha de base (9,8% de avaria) e acompanhar: devolução por avaria · reclamações · custo de embalagem · tempo de expedição · margem.</div>
      <div class="op-para"><b>Ainda não vou concluir se funcionou até existir volume suficiente.</b></div>
      <button class="op-link" onclick="Inteligencia.avancarMonitoramento()">simular 20 pedidos depois →</button>`);
    renderHome(); renderPlan();
  }

  function avancarMonitoramento() {
    S.intervention = { samples: 25 };
    S.learning = "Embalagem reforçada com cantoneiras reduz avaria de espelhos grandes (9,8% → 5,2% no lote observado).";
    head(`<div class="op-main">A nova embalagem reduziu a avaria de 9,8% para 5,2% nos pedidos observados. A amostra ainda é limitada, mas a tendência é positiva.</div>
      <div class="op-para">Recomendo expandir o protocolo para os demais espelhos grandes. Aprendizado registrado como REUTILIZÁVEL — vai influenciar recomendações semelhantes.</div>
      <div class="op-src">intervenção → resultado IMPROVING → aprendizado na memória única · nada externo executado</div>`);
    renderHome(); renderPlan(); renderMemory();
  }

  function abrirPlano() { go("missoes"); renderPlan(); }

  /* ---------------- A MISSÃO: plano + microtarefas + monitoramento ---------------- */
  function renderPlan() {
    const el = $("#ridPlan"); if (!el) return;
    if (!S.plan) { el.innerHTML = `<article class="card"><div class="eyebrow"><span class="tag">PLANO DO RID</span></div>
      <p class="silence-note">Nenhum plano de inteligência aberto ainda. Responda o diálogo estratégico na Operação — cada microtarefa nasce pequena e executável.</p></article>`; return; }
    const tasks = [
      ["Escolher o modelo de espelho mais crítico", true],
      ["Confirmar como a embalagem atual é feita", true],
      ["Definir material adicional (isopor + cantoneira)", !!S.intervention],
      ["Separar unidades para teste (lote controlado)", !!S.intervention],
      ["Enviar lote e monitorar avaria por 14 dias", !!(S.intervention && S.intervention.samples >= 25)],
    ];
    const doneN = tasks.filter(t => t[1]).length;
    el.innerHTML = `
      <article class="card" style="margin-bottom:14px">
        <div class="eyebrow"><span class="tag">INTELLIGENCE ACTION PLAN</span> <span class="gro-dim">origem: diálogo estratégico · status ${S.intervention ? "MONITORING" : "IN_EXECUTION"}</span></div>
        <h3 class="voice">Reduzir avaria dos espelhos grandes — teste controlado de embalagem</h3>
        <div class="op-line">objetivo: derrubar devolução por avaria de 9,8% para &lt;5% · prazo: 14 dias · responsável: produção/expedição</div>
        <div class="op-line">métrica de sucesso: devolução por avaria · linha de base: 9,8% · ponto de parada: custo de embalagem &gt; R$ 6/un</div>
        <div class="cat-group">Microtarefas (${doneN}/5) — cada microtarefa pequena e executável</div>
        ${tasks.map(([t, ok]) => `<div class="op-line">${ok ? "✓" : "○"} ${esc(t)}</div>`).join("")}
        ${S.intervention ? `<div class="cat-group">Intervenção em monitoramento</div>
          <div class="op-line">• "isopor extra + cantoneira + caixa dupla" · início hoje · ${S.intervention.samples} pedidos observados ${S.intervention.samples >= 25 ? "· avaria 9,8% → 5,2% (IMPROVING)" : "· sem volume para concluir (NOT_ENOUGH_DATA)"}</div>` : ""}
        ${S.learning ? `<div class="op-line" style="color:var(--positive)">✓ resultado: aprendizado registrado e reutilizável</div>` : ""}
        <p class="cat-src">plano → missão → microtarefas → intervenção → aprendizado · tudo interno e auditável · nenhuma escrita externa</p>
      </article>`;
  }

  /* ---------------- CONHECIMENTO: memórias com política ---------------- */
  function renderMemory() {
    const el = $("#ridMemory"); if (!el) return;
    const mems = [
      { cat: "STRATEGIC_DIRECTION", txt: CASE.direcaoAnterior, conf: "HIGH", src: "conversa 20/06", status: "ACTIVE" },
      ...(S.decision ? [{ cat: "DECISION", txt: `Diálogo "margem Shopee": ${S.decision}`, conf: "HIGH", src: "diálogo estratégico", status: "ACTIVE" }] : []),
      ...(S.learning ? [{ cat: "LEARNING", txt: S.learning, conf: "HIGH", src: "intervenção monitorada", status: "ACTIVE" }] : []),
      { cat: "HYPOTHESIS", txt: CASE.hipotese, conf: "MEDIUM", src: "diagnóstico de devoluções", status: "ACTIVE" },
    ];
    el.innerHTML = `<article class="card" style="margin-top:12px">
      <div class="eyebrow"><span class="tag">MEMÓRIA EMPRESARIAL VIVA</span> <span class="gro-dim">memória ÚNICA · validade e confiança por item · hipótese nunca vira fato</span></div>
      ${mems.map(m => `<div class="op-line" style="margin-top:8px">
        <span class="gro-chip">${m.cat}</span> ${esc(m.txt)}
        <div class="gro-dim">confiança ${m.conf} · origem: ${esc(m.src)} · ${m.status}
          <button class="gro-mini" onclick="toast('Memória marcada para revisão (demonstração) — pode ser corrigida, invalidada ou atualizada; nunca prevalece sobre dado novo.')">corrigir/invalidar</button></div>
      </div>`).join("")}
    </article>`;
  }

  window.Inteligencia = { dialogo, responder, intervencao, avancarMonitoramento,
    abrirPlano, renderPlan, renderMemory,
    toggleWeekly() { S.weekly = !S.weekly; renderHome(); } };

  renderHome(); renderPlan(); renderMemory();

  /* validação headless (?ridself=1): cenário 1 completo + relatórios */
  if (location.search.includes("ridself")) {
    dialogo(); responder("TESTE"); intervencao(); avancarMonitoramento();
    window.Inteligencia.toggleWeekly(); go("home");
    document.body.dataset.ridReady = "ok";
  }
})();
