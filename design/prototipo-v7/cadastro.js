/* =============================================================
   FORMULÁRIO INTELIGENTE — Universal Listing Schema Engine (10.C)

   O cadastro NUNCA é fixo: o schema muda por marketplace, categoria
   folha, tipo de produto e operação. Sob encomenda bloqueia logística
   incompatível pela regra INTERNA; a elegibilidade oficial só é
   confirmada pela conta conectada. MODO DEMONSTRAÇÃO — schemas e dados
   exibidos podem ser simulados. Nenhuma publicação externa foi executada.
   ============================================================= */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  const STEPS = ["Produto e categoria", "Conteúdo e mídia", "Atributos obrigatórios",
    "Variações", "Preço, estoque e margem", "Fiscal", "Envio, embalagem e logística",
    "Prazo e personalização", "Revisão final"];

  /* 5 cenários obrigatórios — schemas DIFERENTES, mesmo núcleo */
  const SCENARIOS = {
    "shopee-personalizado": {
      title: "Quadro Personalizado 80x120 — Shopee", schemaStatus: "REGRA_PROVISÓRIA",
      category: "Casa e Decoração > Quadros personalizados (100636 · PROVISIONAL)",
      fields: ["título", "categoria", "material", "tipo de moldura", "com vidro?",
        "variações", "preço", "estoque/capacidade", "NCM", "peso embalado",
        "dimensões da embalagem", "prazo de produção (5 dias)", "prazo de preparação",
        "política de despacho", "capacidade/dia", "embalagem (proteção)",
        "instruções de personalização"],
      logistics: [
        ["shopee-xpress-rapido", "BLOCKED_BY_PERSONALIZATION", "modalidade rápida incompatível com produção sob demanda (5 dias)"],
        ["shopee-padrao", "AGUARDANDO_CONFIRMAÇÃO", "elegibilidade oficial só com a conta conectada"],
        ["retirada", "AGUARDANDO_CONFIRMAÇÃO", "confirmar na conta"]],
      pend: ["peso embalado", "dimensões da embalagem", "tipo de moldura", "se possui vidro", "material principal"],
    },
    "ml-espelho": {
      title: "Espelho Orgânico 170x70 — Mercado Livre", schemaStatus: "REGRA_PROVISÓRIA",
      category: "Casa e Decoração > Espelhos (sugerida · confiança 0,91 · requer confirmação humana)",
      fields: ["título", "categoria folha", "material", "espessura (mm)", "largura", "altura",
        "formato", "preço", "estoque", "peso embalado", "dimensões da embalagem"],
      logistics: [
        ["mercado-envios-flex", "BLOCKED_BY_DIMENSIONS", "170 cm acima do limite da modalidade"],
        ["mercado-envios-padrao", "AGUARDANDO_CONFIRMAÇÃO", "confirmar elegibilidade na conta conectada"],
        ["coleta", "AGUARDANDO_CONFIRMAÇÃO", "confirmar na conta"]],
      pend: ["peso embalado", "espessura", "tipo de embalagem"],
    },
    "ml-eletronico": {
      title: "Luminária LED Inteligente (eletrônico fictício) — Mercado Livre", schemaStatus: "REGRA_PROVISÓRIA",
      category: "Eletrônicos > Iluminação inteligente (MLB-ELET · PROVISIONAL)",
      fields: ["título", "categoria", "voltagem (110V/220V/bivolt)", "potência (W)", "modelo",
        "marca", "conectividade", "tipo de alimentação", "homologação/certificação (condicional)",
        "garantia (meses)", "preço", "estoque", "peso embalado"],
      logistics: [
        ["mercado-envios-flex", "AGUARDANDO_CONFIRMAÇÃO", "produto leve — confirmar na conta"],
        ["mercado-envios-padrao", "AGUARDANDO_CONFIRMAÇÃO", "confirmar na conta"]],
      pend: ["voltagem", "homologação (Wi-Fi → certificação condicional)"],
      note: "Repare: schema TOTALMENTE diferente do quadro — mesmo motor, camadas diferentes.",
    },
    "tiktok-quadro": {
      title: "Kit 3 Quadros Sala — TikTok Shop", schemaStatus: "REGRA_PROVISÓRIA",
      category: "Home & Decor > Wall Art (TTK-DECOR · PROVISIONAL)",
      fields: ["categoria folha", "atributos de produto", "atributo de venda (variação)",
        "vídeo do produto (opcional)", "imagens", "dimensões", "certificação da categoria (condicional)",
        "variações", "preço", "estoque"],
      logistics: [
        ["tiktok-logistics", "AGUARDANDO_CONFIRMAÇÃO", "regras adicionais da categoria — confirmar na conta"],
        ["seller-shipping", "AGUARDANDO_CONFIRMAÇÃO", "confirmar na conta"]],
      pend: ["atributo de venda", "certificação (se exigida pela categoria)"],
      note: "TikTok Shop é marketplace pleno: categorias, atributos, variações e revisão — não só canal de vídeo.",
    },
    "magalu-quadro": {
      title: "Quadro Paisagem Serra — Magalu", schemaStatus: "REGRA_PROVISÓRIA",
      category: "Decoração > Quadros (MGL-DECOR · PROVISIONAL)",
      fields: ["categoria", "ficha técnica: material", "ficha técnica: EAN", "SKU", "portfólio",
        "preço", "estoque", "dados fiscais", "imagens", "descrição"],
      logistics: [
        ["magalu-entregas", "AGUARDANDO_CONFIRMAÇÃO", "confirmar elegibilidade no portal"],
        ["proprio", "AGUARDANDO_CONFIRMAÇÃO", "confirmar na conta"]],
      pend: ["EAN (nunca inventamos atributo de ficha técnica — vira pergunta)"],
      note: "Ficha técnica dinâmica por categoria: faltou dado → DataRequest, nunca invenção.",
    },
  };

  let current = "shopee-personalizado", answered = false;

  function render() {
    const host = $("#cadastroHost"); if (!host) return;
    const sc = SCENARIOS[current];
    const check = [
      ["título", "PRONTO"], ["imagens", "PRONTO"], ["categoria", "AGUARDANDO_CONFIRMAÇÃO"],
      ["atributos", answered ? "PRONTO" : "PENDENTE"],
      ["variações", "PRONTO"], ["preço · margem", "PRONTO"],
      ["peso · dimensões", answered ? "PRONTO" : "PENDENTE"],
      ["embalagem", answered ? "PRONTO" : "PENDENTE"], ["fiscal", "PENDENTE"],
      ["logística", "BLOQUEADO"], ["prazo · personalização", current === "shopee-personalizado" ? "PRONTO" : "NÃO_APLICÁVEL"],
      ["compliance", sc.schemaStatus], ["readiness", answered ? "PRONTO P/ REVISÃO" : "PENDENTE"]];
    host.innerHTML = `
      <div class="section-h flat" style="margin-top:14px"><span class="eyebrow">Formulário inteligente · ${esc(sc.title)}</span>
        <span class="more">o schema muda com o marketplace e a categoria folha</span></div>
      <div class="an-chips">${Object.entries(SCENARIOS).map(([k, v]) =>
        `<button class="op-tab${k === current ? " on" : ""}" onclick="Cadastro.open('${k}')">${esc(v.title.split(" — ")[1] || k)}${k === current ? "" : ""}</button>`).join("")}</div>
      <div class="gro-tablewrap" style="display:grid;grid-template-columns:2fr 1fr;gap:14px;border:0;overflow:visible">
        <article class="card">
          <div class="eyebrow"><span class="tag">${esc(sc.schemaStatus)}</span> <span class="gro-dim">${esc(sc.category)}</span></div>
          <div class="an-chips" style="margin-top:8px">${STEPS.map((s, i) =>
            `<span class="gro-chip${i < 3 ? " demo" : ""}">${i + 1}. ${s}</span>`).join("")}</div>
          <div class="cat-group">Campos deste schema (camadas: universal → interno → tipo → categoria folha → operação)</div>
          ${sc.fields.map(f => `<div class="op-line">• ${esc(f)}</div>`).join("")}
          ${sc.note ? `<p class="silence-note" style="margin-top:8px">${esc(sc.note)}</p>` : ""}
          <div class="cat-group">Envio, embalagem e logística — bloqueio interno automático</div>
          ${sc.logistics.map(([m, st, why]) => `<div class="op-line">${/^BLOCKED/.test(st) ? "✗" : "○"} <b>${esc(m)}</b> — <span class="${/^BLOCKED/.test(st) ? "gro-chip demo" : "gro-chip"}">${esc(st)}</span> <span class="gro-dim">${esc(why)}</span></div>`).join("")}
          <div class="cat-group">Pendências → Data Completion</div>
          ${answered
            ? `<div class="op-line" style="color:var(--positive)">✓ Resposta recebida via WhatsApp: <i>peso 7,2 kg | embalagem 90x130x8 cm | prazo 5 dias úteis | moldura madeira preta | sem vidro | MDF e impressão látex</i> — campos atualizados, schema revalidado.</div>`
            : `${sc.pend.map(p => `<div class="op-line">? ${esc(p)}</div>`).join("")}
               <div class="gro-tools"><button class="btn" onclick="Cadastro.ask()">Solicitar dados faltantes (WhatsApp)</button></div>`}
          <div class="gro-tools" style="margin-top:14px">
            <button class="gro-mini" onclick="toast('Product Intake salvo (entrada provisória).')">Salvar Product Intake</button>
            <button class="gro-mini" onclick="toast('Product Master salvo — verdade central do produto.')">Salvar Product Master</button>
            <button class="btn" onclick="toast('Salvar rascunho interno — nenhum anúncio será publicado externamente.')">Salvar rascunho interno</button>
            <button class="gro-mini" onclick="toast('Validação executada contra o schema desta categoria.')">Validar anúncio</button>
            <button class="gro-mini" onclick="toast('Margem recalculada com as taxas da praça.')">Recalcular margem</button>
            <button class="gro-mini" onclick="toast('Logística revalidada — bloqueios internos reaplicados.')">Revalidar logística</button>
            <button class="gro-mini blocked" onclick="toast('BLOQUEADO: publicar externamente exige conta conectada, regra oficial confirmada e aprovação — nunca é automático.')">Publicar externamente ⃠</button>
          </div>
          <p class="cat-src">Salvar rascunho interno — nenhum anúncio será publicado externamente. Regra provisória nunca aprova publicação.</p>
        </article>
        <article class="card">
          <div class="eyebrow"><span class="tag">CHECKLIST DE PRONTIDÃO</span></div>
          ${check.map(([i, st]) => `<div class="op-line" style="display:flex;justify-content:space-between;gap:8px"><span>${esc(i)}</span><span class="gro-chip${/PRONTO/.test(st) ? " demo" : ""}">${esc(st)}</span></div>`).join("")}
          <p class="cat-src" style="margin-top:10px">Estados: PRONTO · PENDENTE · BLOQUEADO · AGUARDANDO_CONFIRMAÇÃO · NÃO_APLICÁVEL · REGRA_PROVISÓRIA · REGRA_OFICIAL_CONFIRMADA. Variações têm peso, preço, estoque e prazo PRÓPRIOS — nada é herdado.</p>
        </article>
      </div>`;
  }

  const api = {
    open(k) { current = k; answered = false; render(); go("catalogo");
      const h = $("#cadastroHost"); if (h) h.scrollIntoView({ block: "start" }); },
    ask() {
      toast("Pergunta agrupada enviada no WhatsApp: \"Para concluir o draft, preciso confirmar: peso embalado; dimensões da embalagem; prazo; moldura; vidro; material. Pode responder assim: `peso 7,2 kg | embalagem 90x130x8 cm | prazo 5 dias úteis | moldura madeira preta | sem vidro | MDF e impressão látex`.\"");
      setTimeout(() => { answered = true; render();
        toast("Resposta interpretada → campos corretos atualizados (fonte WHATSAPP_COMMAND) → schema revalidado → checklist atualizado. Draft pronto para revisão; nenhuma publicação externa."); },
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 20 : 1200);
    },
  };
  window.Cadastro = api;

  /* host dentro do Catálogo (mesa de operação) */
  const cat = document.getElementById("v-catalogo");
  if (cat && !document.getElementById("cadastroHost")) {
    const div = document.createElement("div"); div.id = "cadastroHost";
    cat.appendChild(div);
  }
  render();

  /* validação headless (?cadself=1) */
  if (location.search.includes("cadself")) {
    api.open("ml-eletronico"); api.open("shopee-personalizado"); api.ask();
    setTimeout(() => { document.body.dataset.cadastroReady = answered ? "ok" : "pending"; }, 200);
  }
})();
