/* =============================================================
   MARKETPLACE INTELLIGENCE — subárea de Conhecimento (Sprint 10.K)
   Base viva: fonte, confiança, consequência e alternativa por regra.
   Consciência, não polícia: bloqueio só de ação externa irreversível.
   MODO DEMONSTRAÇÃO — registros simulados; nenhuma ação externa.
   ============================================================= */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const RECORDS = [
    { mp: "shopee", dom: "logística e prazo", conf: "PROVISIONAL", mode: "ASK_CONFIRMATION",
      t: "Sob encomenda × despacho rápido", src: "regra interna (seed) · verificada 04/07",
      msg: "Esse produto está marcado como sob encomenda (5 dias úteis). Posso manter o draft interno e calcular as modalidades compatíveis. Para ativar externamente, preciso confirmar a elegibilidade da conta e a regra atual da Shopee." },
    { mp: "shopee", dom: "cadastro e catálogo", conf: "PROVISIONAL", mode: "WARN",
      t: "Atributo material ausente", src: "regra interna (seed)",
      msg: "Essa ação pode aumentar risco de reprovação na Shopee porque falta o atributo material. Posso seguir preparando o rascunho interno e pedir esse dado agora. Publicação externa continua aguardando confirmação." },
    { mp: "mercado_livre", dom: "políticas e compliance", conf: "VERIFIED_OFFICIAL", mode: "REQUIRE_REVIEW",
      t: "Imagem com marca de terceiro", src: "Brand Protection · fonte oficial v2026-06",
      msg: "Essa imagem contém marca de terceiro não associada ao produto — risco de propriedade intelectual. Posso manter como referência interna; não recomendo como imagem principal." },
    { mp: "mercado_livre", dom: "cadastro e catálogo", conf: "VERIFIED_OFFICIAL", mode: "BLOCK_EXTERNAL_ACTION",
      t: "Publicar sem atributo obrigatório", src: "exigência de categoria · oficial",
      msg: "Não posso preparar publicação externa ainda: falta o atributo obrigatório e a confirmação da categoria. O draft interno foi salvo e já abri uma solicitação para coletar o dado faltante." },
    { mp: "tiktok", dom: "enforcement e risco", conf: "PROVISIONAL", mode: "INFO",
      t: "Reincidência escala penalidade", src: "regra interna (seed)",
      msg: "Infrações repetidas escalam para pausa, suspensão e banimento — conhecimento consultado antes de qualquer recomendação de risco." },
    { mp: "magalu", dom: "API e integrações", conf: "PROVISIONAL", mode: "SUGGEST",
      t: "OAuth, tokens e webhooks", src: "regra interna (seed)",
      msg: "Conhecimento de integração é distinto de regra de anúncio: escopos, refresh e limites de requisição têm política própria." },
    { mp: "mercado_livre", dom: "estratégia e performance", conf: "VERIFIED_INTERNAL", mode: "SUGGEST",
      t: "Método R.E.A.L. (playbook)", src: "playbook estratégico interno",
      msg: "Aplica-se a criativos, conversão, autoridade, emoção, retenção e ação — nunca substitui categoria, atributo, política, logística ou compliance." },
  ];
  let fMp = "todos", fMode = "todos";
  function render() {
    const el = $("#ridKnowledgeMkt"); if (!el) return;
    const rows = RECORDS.filter(r => (fMp === "todos" || r.mp === fMp)
      && (fMode === "todos" || r.mode === fMode));
    el.innerHTML = `<article class="card" style="margin-top:12px">
      <div class="eyebrow"><span class="tag">Marketplace Intelligence</span>
        <span class="gro-dim">base viva · fonte + confiança + consequência + alternativa · demonstração</span></div>
      <div class="an-chips">${["todos", "mercado_livre", "shopee", "tiktok", "magalu"].map(m =>
        `<button class="op-tab${m === fMp ? " on" : ""}" onclick="MktIntel.mp('${m}')">${m}</button>`).join("")}
        ${["todos", "WARN", "ASK_CONFIRMATION", "BLOCK_EXTERNAL_ACTION"].map(m =>
        `<button class="op-tab${m === fMode ? " on" : ""}" onclick="MktIntel.mode('${m}')">${m}</button>`).join("")}</div>
      ${rows.map(r => `<div class="op-line" style="margin-top:10px">
        <span class="gro-chip${r.conf === "VERIFIED_OFFICIAL" ? " demo" : ""}">${r.conf}</span>
        <span class="gro-chip">${r.mode}</span> <b>${esc(r.t)}</b> <span class="gro-dim">· ${r.mp} · ${esc(r.dom)}</span>
        <div class="gro-dim" style="margin:4px 0 2px">fonte: ${esc(r.src)}</div>
        <div class="op-para" style="font-size:12.5px">"${esc(r.msg)}"</div>
        <button class="gro-mini" onclick="toast('Regra marcada para revisão (fila de revisão do conhecimento).')">marcar para revisão</button>
        <button class="gro-mini" onclick="toast('Classificação interna corrigida — auditável; regra oficial nunca é sobrescrita.')">corrigir classificação</button>
      </div>`).join("") || '<p class="silence-note">nenhum registro neste filtro.</p>'}
      <div class="cat-group">Inteligência estratégica (10.K.1) — playbooks · Customer Outcome · ciclo de vida</div>
      <div class="op-line"><span class="gro-chip demo">PLAYBOOK</span> <b>Renovar criativo em saturação</b> <span class="gro-dim">· Saturation Strategy · Método R.E.A.L. (Retenção/Emoção)</span>
        <div class="gro-dim">quando usar: CHAMPION/SATURATING com CTR em queda · quando não usar: lançamento · métrica: CTR/conversão/ranking · ponto de parada: sem melhora em 14 dias → reposicionar</div></div>
      <div class="op-line"><span class="gro-chip demo">PLAYBOOK</span> <b>Vender transformação, não especificação</b> <span class="gro-dim">· Customer Outcome</span>
        <div class="gro-dim">quando usar: anúncio só com ficha técnica · quando não usar: categoria de linguagem técnica pura · risco: promessa sem prova vira devolução · ponto de parada: alegação sem prova → remover</div></div>
      <div class="op-line"><span class="gro-chip">OUTCOME</span> <b>Customer Outcome Profile</b>
        <div class="gro-dim">"o que muda na vida do cliente" · trabalho funcional/emocional/social · uso diário · objeções · provas — por empresa e por produto, multinicho (eletrônico ≠ moda ≠ decoração)</div></div>
      <div class="op-line"><span class="gro-chip">CICLO</span> <b>ciclo de vida do produto</b>
        <div class="gro-dim">IDEA → LAUNCH → GROWING → CHAMPION → SATURATING → DECLINING — o estágio ALTERA a recomendação do Head</div></div>
      <p class="cat-src">Action modes: INFO · SUGGEST · WARN · ASK_CONFIRMATION · REQUIRE_REVIEW · BLOCK_EXTERNAL_ACTION — bloqueio só de ação externa; análise, plano, rascunho interno e coleta de dados nunca são impedidos.</p>
    </article>`;
  }
  window.MktIntel = { mp(m) { fMp = m; render(); }, mode(m) { fMode = m; render(); } };
  const host = document.getElementById("ridMemory");
  if (host && !document.getElementById("ridKnowledgeMkt")) {
    const div = document.createElement("div"); div.id = "ridKnowledgeMkt";
    host.parentNode.insertBefore(div, host.nextSibling);
  }
  render();
  if (location.search.includes("mkself")) {
    window.MktIntel.mp("shopee"); window.MktIntel.mode("todos"); go("conhecimento");
    document.body.dataset.mktReady = "ok";
  }
})();
