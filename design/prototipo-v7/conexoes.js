/* =============================================================
   CONEXÕES (Sprint 10.A) — apresentação dos estados REAIS do backend.

   Este protótipo roda standalone: os estados abaixo são uma SIMULAÇÃO
   demonstrativa dos mesmos estados que mos/src/live produz — e a página
   declara isso o tempo todo. Nenhuma conta é conectada, nenhuma mensagem
   é enviada e nenhum anúncio é criado a partir daqui.
   ============================================================= */
(function () {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const now = () => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  const PHRASE = "CRIAR ANÚNCIO PILOTO REAL";

  /* estados demonstrativos (mesma máquina de estados do backend) */
  const S = {
    whatsapp: { status: "SETUP_REQUIRED", verified: false, inbound: [], outbox: [], pilotReply: false },
    ml: { status: "AWAITING_OAUTH", account: null, lastSync: null, read: null, dryRun: null,
          confirmed: false, created: null, error: null },
    others: [
      { id: "shopee", name: "Shopee", status: "AWAITING_OAUTH", note: "estruturado e validado por fixtures — ativação pendente de credencial" },
      { id: "tiktok", name: "TikTok Shop", status: "AWAITING_CREDENTIALS", note: "exige aprovação de parceria — nada é fingido" },
      { id: "magalu", name: "Magalu Marketplace", status: "AWAITING_CREDENTIALS", note: "exige credenciamento no portal do desenvolvedor" },
    ],
  };
  const ST_LABEL = {
    NOT_CONNECTED: ["Não conectado", "muted"], SETUP_REQUIRED: ["Configuração necessária", "amber"],
    AWAITING_CREDENTIALS: ["Aguardando credenciais", "amber"], AWAITING_OAUTH: ["Aguardando OAuth", "amber"],
    CONNECTED_READ_ONLY: ["Conectado · leitura", "pos"], SYNCING: ["Sincronizando…", "amber"],
    CONNECTED: ["Conectado", "pos"], PILOT_WRITE_ENABLED: ["Piloto habilitado", "amber"],
    ERROR: ["Erro", "neg"], REVOKED: ["Revogado", "neg"],
    WHATSAPP_WEBHOOK_VERIFIED: ["Webhook validado", "pos"],
  };
  const pill = st => { const [l, c] = ST_LABEL[st] || [st, "muted"]; return `<span class="cat-pill ${c}">${l}</span>`; };

  /* ---------------- cards ---------------- */
  function render() {
    const wa = S.whatsapp, ml = S.ml;
    $("#connNote").textContent = "READ_ONLY por padrão · piloto exige confirmação explícita";
    $("#connCards").innerHTML = `
      <article class="conn-card">
        <h3>WhatsApp Business ${pill(wa.status)}</h3>
        <div class="conn-meta">
          <b>Empresa:</b> Quadros & Cia · <b>modo:</b> consulta operacional (nunca executa ação externa)<br>
          <b>Webhook:</b> ${wa.verified ? "validado ✓" : "aguardando validação"} ·
          <b>mensagens:</b> ${wa.inbound.length} · <b>piloto de resposta:</b> ${wa.pilotReply ? "ativo (allowlist)" : "desligado"}
        </div>
        ${wa.inbound.map(m => `<div class="conn-msg">📩 ${esc(m.from)}: "${esc(m.text)}"</div>`).join("")}
        ${wa.outbox.map(m => `<div class="conn-msg">🤖 Head: "${esc(m.slice(0, 120))}${m.length > 120 ? "…" : ""}"</div>`).join("")}
        <div class="conn-actions">
          ${!wa.verified ? `<button class="btn primary" onclick="Conexoes.waVerify()">Validar webhook (demo)</button>` : ""}
          ${wa.verified ? `<button class="btn" onclick="Conexoes.waMessage()">Simular mensagem do administrador</button>
            <button class="btn" onclick="Conexoes.waCommand()">Simular comando em massa (drafts)</button>` : ""}
        </div>
      </article>

      <article class="conn-card">
        <h3>Mercado Livre ${pill(ml.status)}</h3>
        <div class="conn-meta">
          ${ml.account ? `<b>Conta:</b> ${esc(ml.account)} · <b>token:</b> APP_…demo (mascarado)<br>` : "<b>Conta:</b> nenhuma — inicie o OAuth<br>"}
          ${ml.lastSync ? `<b>Última sincronização:</b> ${ml.lastSync} · <b>lidos:</b> ${ml.read.read} · <b>criados:</b> ${ml.read.created}<br>` : ""}
          <b>Modo:</b> leitura (READ_ONLY) · <b>escrita:</b> somente o piloto, sob confirmação explícita
          ${ml.error ? `<br><b style="color:#e06661">Erro:</b> ${esc(ml.error)}` : ""}
        </div>
        <div class="conn-actions">
          ${ml.status === "AWAITING_OAUTH" ? `<button class="btn primary" onclick="Conexoes.mlOAuth()">Conectar Mercado Livre (demo)</button>` : ""}
          ${ml.status === "CONNECTED_READ_ONLY" && !ml.dryRun ? `<button class="btn primary" onclick="Conexoes.pilotStart()">Preparar anúncio piloto</button>` : ""}
          ${ml.account ? `<button class="btn ghost" onclick="Conexoes.mlDetail()">Ver detalhes</button>` : ""}
        </div>
      </article>

      ${S.others.map(o => `
      <article class="conn-card">
        <h3>${esc(o.name)} ${pill(o.status)}</h3>
        <div class="conn-meta">${esc(o.note)} · <b>modo:</b> leitura quando ativado</div>
      </article>`).join("")}`;
    renderPilot();
  }

  /* ---------------- ações demo (rotuladas) ---------------- */
  const api = {
    waVerify() {
      S.whatsapp.verified = true; S.whatsapp.status = "WHATSAPP_WEBHOOK_VERIFIED";
      toast("Webhook do WhatsApp validado (demonstração) — hub.challenge devolvido.");
      render();
    },
    waMessage() {
      S.whatsapp.status = "CONNECTED"; S.whatsapp.pilotReply = true;
      S.whatsapp.inbound.push({ from: "+55 11 98888-7777 (admin)", text: "Quanto vendi hoje?" });
      /* a resposta vem da MESMA camada do chat (Operação) */
      const r = window.HeadOps ? HeadOps.chat.ask("Quanto vendi hoje?", { surface: "whatsapp" }) : null;
      S.whatsapp.outbox.push(r ? r.reply.split("\n")[0] + " — Dados demonstrativos • " + now() : "—");
      toast("Mensagem recebida via webhook (demo), deduplicada e respondida pela mesma Query Layer.");
      render();
    },
    /* WhatsApp como CONTROLE REMOTO (10.B): comando em massa → resumo →
       confirmação → job interno (MESMO Adaptation Engine) → aparece no Catálogo */
    waCommand() {
      S.whatsapp.status = "CONNECTED"; S.whatsapp.pilotReply = true;
      const cmd = "Cria drafts Shopee dos produtos com margem acima de 25%";
      S.whatsapp.inbound.push({ from: "+55 11 98888-7777 (admin)", text: cmd });
      const r = window.HeadOps ? HeadOps.chat.ask(cmd, { surface: "whatsapp" }) : null;
      S.whatsapp.outbox.push(r ? r.reply.split("\n")[0] + " Responda SIM para confirmar." : "—");
      S.whatsapp.inbound.push({ from: "+55 11 98888-7777 (admin)", text: "SIM" });
      const n = r && r.facts && r.facts.items ? r.facts.items.length : 2;
      window.Crescimento && Crescimento.registerJob({ origin: "WHATSAPP_COMMAND",
        summary: `${n} rascunho(s) interno(s) criados em shopee — comando WhatsApp confirmado com SIM`,
        items: (r && r.facts && r.facts.items ? r.facts.items.map(i => i.sku + " v1") : ["QDR-SER v1", "QDR-NOME v1"]) });
      S.whatsapp.outbox.push(`✔ ${n} rascunho(s) interno(s) criados (job auditável, origem WHATSAPP_COMMAND). Nada publicado — revise no Catálogo.`);
      toast("Comando em massa: confirmado via WhatsApp → job interno criado → resultado visível no Catálogo. Nenhuma escrita externa.");
      render();
    },
    mlOAuth() {
      S.ml.status = "SYNCING"; render();
      setTimeout(() => {
        S.ml.status = "CONNECTED_READ_ONLY";
        S.ml.account = "123456789 (QUADROSECIA)";
        S.ml.lastSync = now(); S.ml.read = { read: 2, created: 2 };
        toast("OAuth concluído (demonstração): state de uso único validado, tokens cifrados no backend, sync inicial em leitura.");
        render();
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600);
    },
    mlDetail() { toast("Detalhes: seller 123456789 · escopo leitura · credencial mascarada — segredos nunca chegam ao navegador."); },

    /* ---------- fluxo do PILOTO (6 etapas, tudo demo) ---------- */
    pilotStart() { S.ml.dryRun = { step: 1 }; render(); $("#pilotFlow").scrollIntoView({ behavior: "smooth" }); },
    pilotNext() { S.ml.dryRun.step++; render(); },
    pilotConfirmTyped(v) {
      S.ml.dryRun.typed = v;
      const btn = document.getElementById("pilotGo");
      if (btn) btn.disabled = v !== PHRASE;
    },
    pilotCreate() {
      if (S.ml.dryRun.typed !== PHRASE) return;
      S.ml.dryRun.step = 6;
      S.ml.created = { id: "MLB-PILOT-0001 (demonstração)", at: now() };
      toast("Anúncio piloto criado (DEMONSTRAÇÃO) — nenhuma conta real foi tocada.");
      render();
    },
  };
  window.Conexoes = api;

  function renderPilot() {
    const d = S.ml.dryRun;
    const box = $("#pilotFlow");
    if (!d) { box.style.display = "none"; return; }
    box.style.display = "";
    const steps = [
      ["Validar produto", "QDR-SER validado no Compliance Engine — READY_FOR_REVIEW, categoria MLB1367 com snapshot oficial (demo)"],
      ["Revisar imagens", "criativo MAIN_CLEAN com Truth Pack íntegro · validação automática sem divergência · revisão humana APROVADA"],
      ["Dry Run", "payload montado e validado — NENHUMA chamada externa neste estágio · hash a4882c…"],
      ["Revisar payload", "conta 123456789 · título · preço R$ 189 · estoque 15 · 3 imagens · atributos oficiais completos"],
      ["Confirmar criação real", null],
      ["Registrar resultado", S.ml.created ? `anúncio ${S.ml.created.id} criado às ${S.ml.created.at} · auditoria completa gravada` : "—"],
    ];
    box.innerHTML = `
      <div class="section-h"><span class="eyebrow">Anúncio piloto · Mercado Livre — uma única criação, sob confirmação forte</span></div>
      <div class="pilot-steps">
        ${steps.map(([t, note], i) => {
          const n = i + 1;
          const cls = n < d.step ? "done" : n === d.step ? "on" : "";
          return `<div class="pilot-step ${cls}"><div class="n">${n < d.step ? "✓" : n}</div>
            <div><b>${t}</b>${note && n <= d.step ? `<br><span style="color:var(--text-3)">${esc(note)}</span>` : ""}
            ${n === 5 && d.step === 5 ? `
              <div class="pilot-confirm">
                <b>Esta ação criará um anúncio real na conta Mercado Livre selecionada. Ela não é uma simulação.</b><br>
                (Neste protótipo, a criação é DEMONSTRATIVA — nenhuma conta existe.)<br>
                Digite exatamente <b>${PHRASE}</b> para liberar:
                <input id="pilotTyped" placeholder="${PHRASE}" oninput="Conexoes.pilotConfirmTyped(this.value)" autocomplete="off">
                <div class="conn-actions">
                  <button class="btn primary" id="pilotGo" disabled onclick="Conexoes.pilotCreate()">Criar anúncio piloto real no Mercado Livre</button>
                </div>
              </div>` : ""}
            </div></div>`;
        }).join("")}
      </div>
      ${d.step < 5 ? `<div class="conn-actions" style="margin-top:12px"><button class="btn primary" onclick="Conexoes.pilotNext()">Avançar etapa</button></div>` : ""}
      ${S.ml.created ? `<p class="cat-src" style="margin-top:12px">Idempotência: mesmo draft + mesma conta + mesmo hash nunca criam um segundo anúncio. Falha não gera retry automático.</p>` : ""}`;
  }

  render();

  /* validação headless (?conself=1): percorre os estados até o piloto */
  if (location.search.includes("conself")) {
    go("conexoes");
    api.waVerify(); api.waMessage(); api.mlOAuth();
    setTimeout(() => {
      api.pilotStart(); api.pilotNext(); api.pilotNext(); api.pilotNext(); api.pilotNext();
      api.pilotConfirmTyped(PHRASE);
      const btn = document.getElementById("pilotGo");
      if (btn) { btn.disabled = false; api.pilotCreate(); }
      document.body.dataset.connReady = "ok";
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 10 : 800);
  }
})();
