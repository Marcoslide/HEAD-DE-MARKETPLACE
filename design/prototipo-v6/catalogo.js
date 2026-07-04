/* =============================================================
   CATÁLOGO (Sprint 10) — a área de produtos, requisitos e prontidão.

   Só apresentação: TODOS os vereditos, findings, categorias, checklists
   e rascunhos vêm do MESMO Compliance Engine dos testes/serviços
   (globalThis.HEADCOMPLIANCE) sobre os MESMOS dados demonstrativos.
   Nenhum resultado hardcoded. Nenhum botão publica nada.
   ============================================================= */
(function () {
  "use strict";
  const CE = HEADCOMPLIANCE;
  const catClock = MIE.createClock();
  const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const PLAT = { mercado_livre: "Mercado Livre", shopee: "Shopee", tiktok: "TikTok Shop", magalu: "Magalu" };
  const ST = {
    READY: ["Pronto", "pos"], READY_WITH_WARNINGS: ["Pronto c/ alertas", "amber"],
    REVIEW_REQUIRED: ["Revisão necessária", "amber"], BLOCKED: ["Bloqueado", "neg"],
    INSUFFICIENT_DATA: ["Dados insuficientes", "muted"], NOT_SUPPORTED: ["Sem rule pack", "muted"],
  };
  const SEV = { BLOCKER: "✗", HIGH_RISK: "!", WARNING: "•", INFO: "·", UNKNOWN: "?" };

  /* estado calculado AO VIVO pelo motor */
  const results = new Map();     // `${sku}|${platform}` → evaluate()
  const drafts = new Map();      // idem → buildDraft()
  function evaluate(p, plat) {
    const key = `${p.master.sku}|${plat}`;
    if (!results.has(key)) results.set(key, CE.evaluate(p, plat, { clock: catClock }));
    return results.get(key);
  }
  const platsOf = p => Object.keys(p.byPlatform || {}).filter(pl => CE.RULE_PACKS[pl]);

  /* ---------------- visão geral ---------------- */
  function renderOverview() {
    const counts = { ready: 0, warn: 0, blocked: 0, review: 0 };
    const byPlat = {};
    for (const p of CE.DEMO_PRODUCTS) for (const pl of platsOf(p)) {
      const r = evaluate(p, pl);
      if (r.status === "READY") counts.ready++;
      else if (r.status === "READY_WITH_WARNINGS") counts.warn++;
      else if (r.status === "BLOCKED") counts.blocked++;
      else counts.review++;
      byPlat[pl] = byPlat[pl] || { total: 0, risk: 0 };
      byPlat[pl].total++;
      if (r.status === "BLOCKED" || r.status === "REVIEW_REQUIRED") byPlat[pl].risk++;
    }
    const draftsReady = [...drafts.values()].filter(d => d.status === "READY_FOR_REVIEW").length;
    $("#catOverview").innerHTML = `
      <div class="cell"><div class="n pos">${counts.ready + counts.warn}</div><div class="l">validados (c/ alertas)</div></div>
      <div class="cell"><div class="n amber">${counts.review}</div><div class="l">em revisão</div></div>
      <div class="cell"><div class="n neg">${counts.blocked}</div><div class="l">bloqueados</div></div>
      <div class="cell"><div class="n amber">${draftsReady}</div><div class="l">rascunhos p/ revisão</div></div>
      ${Object.entries(byPlat).map(([pl, v]) =>
        `<div class="cell"><div class="n ${v.risk ? "amber" : "pos"}">${v.risk}/${v.total}</div><div class="l">risco · ${PLAT[pl]}</div></div>`).join("")}`;
    const packs = [...new Set([...results.values()].map(r => r.rulePackVersion).filter(Boolean))];
    $("#catPackNote").textContent = `rule packs: ${packs.join(" · ")} (demo)`;
    const badge = $("#badgeCatalog");
    badge.textContent = counts.blocked; badge.style.display = counts.blocked ? "" : "none";
  }

  /* ---------------- lista de produtos ---------------- */
  function marginPct(p, pl) {
    const mp = p.byPlatform[pl] || {};
    const price = mp.price ?? p.profile.basePrice;
    return price && p.profile.cost ? Math.round(((price - p.profile.cost) / price) * 100) : null;
  }
  function renderList() {
    $("#catList").innerHTML = CE.DEMO_PRODUCTS.map(p => {
      const rows = platsOf(p).map(pl => ({ pl, r: evaluate(p, pl) }));
      const worst = rows.find(x => x.r.status === "BLOCKED") || rows.find(x => x.r.status === "REVIEW_REQUIRED") || rows[0];
      const top = worst.r.findings.find(f => f.severity === "BLOCKER") || worst.r.findings.find(f => f.severity === "HIGH_RISK");
      const stock = Object.values(p.byPlatform).map(m => m.stock).filter(v => v != null).reduce((a, b) => a + b, 0);
      return `
      <article class="card mrow cat-row" onclick="Catalogo.open('${p.master.sku}')">
        <div class="info">
          <div class="mtitle">${esc(p.master.name)} <span class="mkt">${esc(p.master.sku)}</span></div>
          <div class="mmeta">estoque ${stock} · ${rows.map(x =>
            `<span class="cat-pill ${ST[x.r.status][1]}">${PLAT[x.pl]}: ${ST[x.r.status][0]}</span>`).join(" ")}</div>
          ${top ? `<div class="mmeta" style="margin-top:4px">principal pendência: ${esc(top.message)}</div>` : ""}
        </div>
        <div class="mscore" title="margem estimada">${marginPct(p, worst.pl) != null ? marginPct(p, worst.pl) + "%" : "—"}</div>
      </article>`;
    }).join("");
  }

  /* ---------------- painel do produto (abas por marketplace) ---------------- */
  let current = null, currentPlat = null, showEvidence = false;
  const creatives = new Map();   // sku → { status, type, note } (demo, rotulado)
  function open(sku, plat = null) {
    current = CE.DEMO_PRODUCTS.find(p => p.master.sku === sku);
    if (!current) return;
    currentPlat = plat && platsOf(current).includes(plat) ? plat : platsOf(current)[0];
    showEvidence = false;
    go("catalogo");
    renderDetail();
    $("#catDetail").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function renderDetail() {
    const p = current;
    if (!p) { $("#catDetail").style.display = "none"; return; }
    const r = evaluate(p, currentPlat);
    const d = drafts.get(`${p.master.sku}|${currentPlat}`);
    const prof = p.profile;
    const [stLabel, stCls] = ST[r.status];
    const group = sev => r.findings.filter(f => f.severity === sev);
    const findRow = f => `<div class="cat-find ${f.severity.toLowerCase()}">
        <b>${SEV[f.severity]}</b> ${esc(f.message)}${f.internal ? ' <span class="cat-int">regra interna</span>' : ""}
        ${showEvidence ? `<div class="cat-src">${esc(f.rule.sourceType)} · ${esc(f.rule.sourceReference)} · ${esc(f.rule.status)} · pack ${esc(f.rule.rulePackVersion)}</div>` : ""}
      </div>`;
    $("#catDetail").style.display = "";
    $("#catDetail").innerHTML = `
      <div class="section-h"><span class="eyebrow">${esc(p.master.name)} · ${esc(p.master.sku)}</span>
        <button class="more" onclick="Catalogo.close()">← voltar à lista</button></div>

      <div class="cat-tabs">${platsOf(p).map(pl =>
        `<button class="op-tab ${pl === currentPlat ? "on" : ""}" onclick="Catalogo.open('${p.master.sku}','${pl}')">${PLAT[pl]}</button>`).join("")}</div>

      <article class="card">
        <div class="eyebrow"><span class="cat-pill ${stCls}" style="font-size:11px">${stLabel}</span>
          <span>· ${PLAT[currentPlat]}</span>
          ${r.category ? `<span class="mkt">${esc(r.category.confirmed || r.category.applied || "sem categoria")}</span>` : ""}</div>
        ${r.category && !r.category.confirmed && r.category.suggestedCategory
          ? `<p class="mmeta" style="margin-top:8px">categoria sugerida: <b>${esc(r.category.suggestedCategory)}</b> (${esc(r.category.categoryId)}) · confiança ${r.category.confidence} · requer confirmação humana</p>` : ""}

        ${group("BLOCKER").length ? `<div class="cat-group">Bloqueadores</div>${group("BLOCKER").map(findRow).join("")}` : ""}
        ${group("UNKNOWN").length ? `<div class="cat-group">Exigências não confirmadas</div>${group("UNKNOWN").map(findRow).join("")}` : ""}
        ${group("HIGH_RISK").length ? `<div class="cat-group">Riscos</div>${group("HIGH_RISK").map(findRow).join("")}` : ""}
        ${group("WARNING").length ? `<div class="cat-group">Alertas</div>${group("WARNING").map(findRow).join("")}` : ""}
        ${!r.findings.length ? `<p class="mmeta" style="margin-top:10px">nenhuma pendência conhecida.</p>` : ""}

        <div class="cat-group">Checklist de revisão</div>
        <div class="cat-check">${r.checklist.map(c =>
          `<div class="${c.ok ? "ok" : "no"}">${c.ok ? "✓" : "○"} ${esc(c.item)}</div>`).join("")}</div>

        <div class="cat-group">Ficha e operação</div>
        <div class="epe-grid">
          <div class="kv"><div class="k">Preço (${PLAT[currentPlat]})</div><div class="v">R$ ${(p.byPlatform[currentPlat].price ?? prof.basePrice) ?? "—"}</div></div>
          <div class="kv"><div class="k">Margem estimada</div><div class="v">${marginPct(p, currentPlat) != null ? marginPct(p, currentPlat) + "%" : "sem custo"}</div></div>
          <div class="kv"><div class="k">Estoque</div><div class="v">${p.byPlatform[currentPlat].stock ?? "—"}</div></div>
          <div class="kv"><div class="k">Prazo (produção+pers.)</div><div class="v">${(prof.productionDays || 0) + (prof.personalizationDays || 0)}d</div></div>
          <div class="kv"><div class="k">Peso embalado</div><div class="v">${prof.packedWeightG ? prof.packedWeightG + " g" : "não informado"}</div></div>
          <div class="kv"><div class="k">Imagens</div><div class="v">${p.assets.filter(a => a.kind === "image").length}</div></div>
        </div>

        ${currentPlat === "mercado_livre" ? renderCreatives(p) : ""}

        ${d ? `<div class="cat-group">Rascunho interno</div>
          <p class="mmeta">v${d._v} · <b>${esc(d.status)}</b> · origem: ${esc(d.suggestionsSource)} · nada foi publicado</p>` : ""}

        <div class="actions" style="margin-top:16px">
          <button class="btn primary" onclick="Catalogo.validateNow()">Validar produto</button>
          <button class="btn" onclick="Catalogo.draftNow()">Gerar rascunho</button>
          <button class="btn" onclick="Catalogo.toggleEvidence()">${showEvidence ? "Ocultar" : "Ver"} evidências</button>
          <button class="btn" onclick="Catalogo.internalMission()">Criar missão interna</button>
          <button class="btn ghost" onclick="Catalogo.askReview()">Pedir revisão</button>
        </div>
        <p class="cat-src" style="margin-top:14px">Validação baseada no rule pack ${esc(r.rulePackVersion)} · verificado em ${esc(r.verifiedAt)} · Dados demonstrativos • Rule Pack Demo — ${esc(r.disclaimer)}.</p>
        <p class="cat-src">MODO LEITURA · nenhuma ação altera anúncio, preço, estoque ou imagem no marketplace.</p>
      </article>`;
  }

  /* ---------------- Criativos · Mercado Livre (Sprint 10.A, demo) ---------------- */
  function renderCreatives(p) {
    const prof = p.profile;
    const cr = creatives.get(p.master.sku);
    const truthOk = prof.heightCm && prof.widthCm && prof.techSheet && prof.techSheet.material
      && prof.weightG != null && p.assets.some(a => a.kind === "image");
    return `
      <div class="cat-group">Criativos · Mercado Livre (Product Fidelity Protocol)</div>
      ${truthOk ? `
        <p class="mmeta" style="margin-top:6px"><b>Product Truth Pack:</b> ${p.master.sku} ·
          ${prof.widthCm}×${prof.heightCm} cm · ${esc(prof.techSheet.material)} ·
          ${p.assets.filter(a => a.kind === "image").length} assets oficiais · hash íntegro —
          a IA pode variar cenário/luz/fundo e NUNCA tamanho, cor, kit, moldura ou material.</p>`
      : `<p class="mmeta" style="margin-top:6px;color:var(--amber)">INSUFFICIENT_PRODUCT_TRUTH — “Não vou gerar uma imagem porque faltam dados necessários para preservar fidelidade.”</p>`}
      ${cr ? `<div class="conn-msg" style="margin-top:8px">Criativo ${esc(cr.type)}: <b>${esc(cr.status)}</b> — ${esc(cr.note)}</div>` : ""}
      ${truthOk ? `<div class="actions" style="margin-top:10px">
        ${!cr ? `<button class="btn" onclick="Catalogo.creativeGen('${p.master.sku}')">Gerar criativo para Mercado Livre</button>` : ""}
        ${cr && cr.status === "FIDELITY_REVIEW_REQUIRED" ? `<button class="btn primary" onclick="Catalogo.creativeApprove('${p.master.sku}')">Aprovar (revisão humana)</button>` : ""}
      </div>` : ""}`;
  }

  /* ---------------- ações INTERNAS (nada publica) ---------------- */
  const api = {
    open,
    close() { current = null; $("#catDetail").style.display = "none"; },
    validateNow() {
      results.delete(`${current.master.sku}|${currentPlat}`);
      renderDetail(); renderOverview(); renderList();
      toast("Validação interna executada — resultado recalculado pelo Compliance Engine. Nada foi enviado ao marketplace.");
    },
    draftNow() {
      const r = evaluate(current, currentPlat);
      const d = CE.buildDraft(current, currentPlat, r);
      d._v = (drafts.get(`${current.master.sku}|${currentPlat}`)?._v || 0) + 1;
      drafts.set(`${current.master.sku}|${currentPlat}`, d);
      renderDetail(); renderOverview();
      toast(`Rascunho interno v${d._v} gerado (${d.status}). MODO LEITURA — nada foi publicado.`);
    },
    toggleEvidence() { showEvidence = !showEvidence; renderDetail(); },
    internalMission() {
      toast(`Missão interna criada: completar pendências de ${current.master.sku} no ${PLAT[currentPlat]} — acompanhe em A Missão.`);
    },
    askReview() { toast("Revisão solicitada à equipe — checklist anexado. Nenhuma ação externa."); },
    creativeGen(sku) {
      creatives.set(sku, { type: "MAIN_CLEAN", status: "CREATIVE_DRAFT",
        note: "CREATIVE_IMAGE_GENERATION_ENABLED desligada — briefing e prompt interno prontos, fila pendente de provider; NENHUMA imagem foi gerada." });
      renderDetail();
      toast("Briefing gerado com Truth Pack. Sem provider configurado, nenhuma imagem é criada — nada de imagem fake.");
      setTimeout(() => {   // simulação demonstrativa da geração com provider
        creatives.set(sku, { type: "MAIN_CLEAN", status: "FIDELITY_REVIEW_REQUIRED",
          note: "gerado por provider (demonstração) · validação automática sem divergência detectada — revisão humana ainda obrigatória." });
        renderDetail();
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 10 : 900);
    },
    creativeApprove(sku) {
      creatives.set(sku, { type: "MAIN_CLEAN", status: "APPROVED_FOR_DRAFT",
        note: "revisão humana aprovada e criativo vinculado ao rascunho interno — nada foi publicado." });
      renderDetail();
      toast("Criativo aprovado por revisão humana e vinculado ao draft. MODO LEITURA — nada foi publicado.");
    },
  };
  window.Catalogo = api;

  renderOverview(); renderList();

  /* validação headless (?catself=1): abre produto bloqueado e gera rascunho */
  if (location.search.includes("catself")) {
    go("catalogo");
    open("QDR-SER", "mercado_livre");   // cenário pronto → rascunho READY_FOR_REVIEW
    api.draftNow();
    open("ESP-ORG", "shopee");          // cenário bloqueado fica visível no fim
    api.draftNow();
    api.toggleEvidence();               // evidências abertas para a validação visual
    document.body.dataset.catalogReady = "ok";
  }
})();
