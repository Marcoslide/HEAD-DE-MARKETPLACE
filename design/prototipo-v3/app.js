/* =============================================================
   Head de Marketplace — v3 (Sprint 08 · Plano do Dia do EPE)
   Estado vivo: aprovar/recusar muda contadores, cria missão, registra
   histórico e reduz prioridade de decisões semelhantes. Sem frameworks.
   ============================================================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  decisions: DATA.decisions.map(d => ({ ...d, status: "pending" })),
  missions: [...DATA.missions],
  funnel: { ...DATA.funnel },
  history: [],
  refusedTypes: new Set(),
  chatStarted: false,
};
const levelClass = { interrupt: "interrupt", approve: "approve", auto: "auto", mission: "mission", observe: "observe", ignore: "ignore" };
const levelLabel = {
  interrupt: "Interromper", approve: "Pedir aprovação", auto: "Executar auto",
  mission: "Criar missão", observe: "Observar", ignore: "Ignorar",
};

/* ---------------- navegação ---------------- */
function go(v) {
  $$(".view").forEach(s => s.classList.remove("on"));
  $("#v-" + v).classList.add("on");
  $$("#nav button").forEach(b => b.classList.toggle("active", b.dataset.v === v));
  window.scrollTo({ top: 0 });
  if (v === "ia" && !state.chatStarted) startChat();
}
$$("#nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.v)));
$$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
const pb = $("#pulseBox");
pb.addEventListener("click", () => go("missoes"));
pb.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("missoes"); } });
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); go("ia"); $("#composerInput").focus(); }
});

/* ---------------- toast ---------------- */
let toastTimer;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 4200); }

/* ---------------- Pulso ---------------- */
let ai = 0;
function renderPulse() {
  const pend = state.decisions.filter(d => d.status === "pending").length;
  $("#pulseBox").classList.toggle("waiting", pend > 0);
  $("#pulseDot").classList.toggle("solid", pend > 0);
  $("#pulseState").textContent = pend > 0 ? "Aguardando sua decisão" : "Trabalhando agora";
  $("#pulseLink").textContent = state.missions.length + " missões ativas →";
}
function rotatePulse() {
  const msg = $("#pulseMsg"); msg.textContent = DATA.activities[0];
  if (reduced) return;
  setInterval(() => { msg.classList.add("fade"); setTimeout(() => { ai = (ai + 1) % DATA.activities.length; msg.textContent = DATA.activities[ai]; msg.classList.remove("fade"); }, 500); }, 7000);
}

/* ---------------- Home: briefing + funil ---------------- */
function renderBriefing() {
  const h = new Date().getHours();
  const s = h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  $("#greeting").textContent = `${s}, ${DATA.user}.`;
  const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const d = new Date();
  $("#dateline").textContent = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} · plano do dia`;
  $("#lede").textContent = DATA.briefing.lede;
  $("#signature").textContent = DATA.briefing.signature;
}
function renderFunnel() {
  const f = state.funnel;
  const cells = [
    ["signalsFound", "sinais encontrados", ""],
    ["signalsIgnored", "ignorados", "muted"],
    ["investigated", "investigados", "amber"],
    ["missionsCreated", "missões criadas", "amber"],
    ["resolved", "resolvidos", "pos"],
    ["decisionsForOwner", "para você", "amber"],
  ];
  $("#funnel").innerHTML = cells.map(([k, l, cls]) =>
    `<div class="cell"><div class="n ${cls}" id="fn-${k}">${f[k].toLocaleString("pt-BR")}</div><div class="l">${l}</div></div>`).join("");
  $("#funnelNote").textContent = `De ${f.signalsFound} sinais, decidi que só ${f.decisionsForOwner} merecem você hoje. O resto eu filtrei, investiguei ou resolvi.`;
}

/* ---------------- Home: atenção ---------------- */
function renderAttention() {
  $("#attention").innerHTML = DATA.attention.map((a, i) => `
    <div class="item"><div class="rank">${i + 1}</div>
      <div class="txt">${a.txt} <span class="level ${a.level}">${levelLabel[a.level]}</span><br>
        <span class="why">${a.why}</span></div></div>`).join("");
}

/* ---------------- Home: decisões priorizadas ---------------- */
function decisionCard(d) {
  const b = d.breakdown;
  return `
  <article class="card" id="${d.id}">
    <div class="eyebrow"><span class="level ${d.level}">${levelLabel[d.level]}</span>
      <span class="tag">${d.tag}</span><span>· ${d.product}</span><span class="mkt">${d.mkt}</span></div>
    <h3>${d.descoberta}</h3>
    <div class="drow"><span class="dlabel">Causa provável</span><p>${d.causa}</p></div>
    <div class="drow"><span class="dlabel">Proposta</span><p>${d.proposta}</p></div>
    <div class="meta-row"><span>Impacto: <b>~R$ ${b.impact.toLocaleString("pt-BR")}/mês</b></span>
      <span>Reversibilidade: ${d.reversibilidade}</span><span>Confiança: ${d.confianca}</span></div>

    <details class="epe-panel">
      <summary>Como o EPE priorizou (score ${b.score})</summary>
      <div class="epe-grid">
        <div class="kv"><div class="k">Impacto</div><div class="v">R$ ${b.impact.toLocaleString("pt-BR")}</div></div>
        <div class="kv"><div class="k">Urgência</div><div class="v">${b.urgency}</div></div>
        <div class="kv"><div class="k">Confiança</div><div class="v">${b.confidence}</div></div>
        <div class="kv"><div class="k">Esforço</div><div class="v">${b.effort}</div></div>
        <div class="kv"><div class="k">Risco de esperar</div><div class="v">${b.riskWait}</div></div>
        <div class="kv"><div class="k">Risco de agir cedo</div><div class="v" style="font-size:11px">${b.riskEarly}</div></div>
      </div>
      <div class="epe-formula">score = impacto × confiança × urgência ÷ esforço, ajustado por:
        ${b.factors.map(f => `<b>${f[0]}</b> ×${f[1]}`).join(" · ")}</div>
      <div class="epe-score"><span>score executivo final:</span><span class="big">${b.score}</span></div>
    </details>

    <div class="actions" data-zone="actions">
      <button class="btn primary" onclick="decide('${d.id}','approve')">Aprovar</button>
      <button class="btn" onclick="decide('${d.id}','adjust')">Ajustar</button>
      <button class="btn" onclick="decide('${d.id}','refuse')">Recusar</button>
      <button class="btn ghost" onclick="decide('${d.id}','ask')">Perguntar</button>
    </div>
    <div class="note-ok" style="display:none"></div>
  </article>`;
}
function renderDecisions() {
  const pend = state.decisions.filter(d => d.status === "pending");
  $("#decisionsTitle").textContent = `Aguardando sua decisão · ${pend.length}`;
  $("#decisions").innerHTML = pend.length
    ? pend.map(decisionCard).join("")
    : `<div class="alldone"><p class="voice">Sem pendências. O EPE não deixou nada escapar — e nada que valesse a sua atenção. Eu cuido do resto.</p></div>`;
  const badge = $("#badgeHome"); badge.style.display = pend.length ? "" : "none"; badge.textContent = pend.length;
  renderPulse();
}

window.decide = function (id, action) {
  const d = state.decisions.find(x => x.id === id);
  const card = $("#" + id);
  if (!d || d.status !== "pending") return;

  if (action === "approve") {
    d.status = "approved";
    card.classList.add("approved");
    card.querySelector('[data-zone="actions"]').style.display = "none";
    const note = card.querySelector(".note-ok");
    note.style.display = "flex";
    note.textContent = "✓  Aprovado. Virou missão — executo e volto com o resultado medido.";
    // cria missão + atualiza contadores + histórico
    state.missions.unshift({ title: d.missionOnApprove.title + " · " + d.product, score: d.breakdown.score, level: "mission", now: d.missionOnApprove.now });
    state.funnel.missionsCreated += 1;
    state.funnel.decisionsForOwner = Math.max(0, state.funnel.decisionsForOwner - 1);
    logHistory(`Aprovou "${d.tag}" (${d.product}) → virou missão`);
    toast(`Perfeito. Já estou executando — te trago o resultado do ${d.product} no briefing.`);
    setTimeout(() => { card.classList.add("gone"); setTimeout(finishResolve, 360); }, 2000);
    bumpFunnel(); renderMissions(); renderPulse();
  }

  if (action === "refuse") {
    card.querySelector('[data-zone="actions"]').innerHTML = `
      <span style="font-size:12.5px;color:var(--text-3)">Entendido. Por quê? (me ajuda a aprender)</span>
      <button class="btn" onclick="refuse('${id}','margem')">Margem apertada</button>
      <button class="btn" onclick="refuse('${id}','causa')">Não concordo com a causa</button>
      <button class="btn" onclick="refuse('${id}','depois')">Agora não</button>`;
  }
  if (action === "adjust" || action === "ask") { go("ia"); askAbout(d, action); }
};

window.refuse = function (id, motive) {
  const d = state.decisions.find(x => x.id === id);
  const card = $("#" + id);
  d.status = "refused";
  state.refusedTypes.add(d.tag);
  card.querySelector('[data-zone="actions"]').outerHTML =
    `<div class="note-muted">Registrado como aprendizado. Vou baixar a prioridade de propostas parecidas.</div>`;
  state.funnel.decisionsForOwner = Math.max(0, state.funnel.decisionsForOwner - 1);
  logHistory(`Recusou "${d.tag}" (${motive}) → aprendizado registrado`);
  // reduz visualmente a prioridade de decisões semelhantes ainda pendentes
  reduceSimilar(d.tag);
  toast("Anotei o motivo. O EPE vai considerar isso — propostas semelhantes perdem prioridade.");
  setTimeout(() => { card.classList.add("gone"); setTimeout(finishResolve, 360); }, 2000);
  bumpFunnel();
};

function reduceSimilar(tag) {
  for (const d of state.decisions) {
    if (d.status === "pending" && d.tag === tag) {
      d.breakdown.score = Math.round(d.breakdown.score * 0.6);
      const el = $("#" + d.id);
      if (el) { const s = el.querySelector(".epe-score .big"); if (s) s.textContent = d.breakdown.score; }
    }
  }
}
function finishResolve() { renderDecisions(); }
function bumpFunnel() {
  const f = state.funnel;
  $("#fn-missionsCreated").textContent = f.missionsCreated;
  $("#fn-decisionsForOwner").textContent = f.decisionsForOwner;
  $("#funnelNote").textContent = `De ${f.signalsFound} sinais, ${f.decisionsForOwner} ainda esperam você. O resto eu toco.`;
}
function logHistory(txt) {
  const t = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  state.history.unshift({ t, txt });
  const box = $("#history");
  if (state.history.length === 1) box.innerHTML = "";
  box.insertAdjacentHTML("afterbegin", `<div><time>${t}</time>${txt}</div>`);
}

/* ---------------- Missões / Silêncio ---------------- */
function renderMissions() {
  $("#missionsCount").textContent = `${state.missions.length} ativas`;
  $("#badgeMissions").textContent = state.missions.length;
  $("#missions").innerHTML = state.missions.map(m => `
    <article class="card mrow">
      <span class="level ${m.level}">${levelLabel[m.level]}</span>
      <div class="info"><div class="mtitle">${m.title}</div><div class="mmeta">${m.now}</div></div>
      <div class="mscore" title="prioridade executiva">${m.score}</div>
    </article>`).join("");
}
function renderSilence() {
  const row = s => `<div class="silence-row"><span class="st">${s.title}</span><span class="sr">${s.reason}</span></div>`;
  $("#silencePreview").innerHTML = DATA.silence.slice(0, 3).map(row).join("");
  $("#silenceFull").innerHTML = DATA.silence.map(row).join("");
}

/* ---------------- Conversa ---------------- */
function addUser(t) { $("#chat").insertAdjacentHTML("beforeend", `<div class="msg user"><div class="who">${DATA.user}</div><div class="bubble"></div></div>`); $("#chat").lastElementChild.querySelector(".bubble").textContent = t; scroll(); }
function addHead(html, delay = 1000) {
  $("#chat").insertAdjacentHTML("beforeend", `<div class="msg head"><div class="who">Head</div><div class="typing"><i></i><i></i><i></i></div></div>`);
  scroll(); const node = $("#chat").lastElementChild;
  setTimeout(() => { node.querySelector(".typing").outerHTML = html; scroll(); }, reduced ? 0 : delay);
}
function scroll() { requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight })); }
function startChat() {
  state.chatStarted = true;
  addHead(`<p class="say">Oi, ${DATA.user}. Posso te explicar por que priorizei o que priorizei hoje — ou por que ignorei alguma coisa. É só perguntar.</p>`, 500);
  $("#suggest").innerHTML = DATA.suggestions.map(s => `<button class="chip" onclick="askFree('${s.replace(/'/g, "\\'")}')">${s}</button>`).join("");
}
window.askFree = function (t) {
  if (!state.chatStarted) startChat();
  go("ia"); addUser(t);
  const q = t.toLowerCase();
  if (q.includes("priorizou") && q.includes("paisagem"))
    addHead(`<p class="say">Score executivo 6863 — o mais alto de hoje. Impacto de ~R$ 5.900/mês, urgência alta (janela curta: os concorrentes acabaram de cortar preço) e um precedente no grafo: reposicionar já funcionou nesta categoria. Impacto × confiança × urgência, com bônus de janela e de aprendizado anterior. Por isso interrompi, em vez de deixar para o briefing.</p>`);
  else if (q.includes("ignorou") || q.includes("não te"))
    addHead(`<p class="say">Segurei 302 sinais. Os principais: a flutuação de CTR do Espelho (ruído, conversão estável), o corte de 2% do GoldFrame (impacto baixo demais) e uma tendência ainda sem confiança suficiente. Nenhum merecia sua atenção — mas está tudo auditável na aba Silêncio.</p>`);
  else if (q.includes("raciocínio") || q.includes("decisão 1") || q.includes("decisao 1"))
    addHead(`<p class="say">Abra "Como o EPE priorizou" no card da decisão 1: você vê impacto, urgência, confiança, esforço, risco de esperar e o score final — a fórmula inteira, sem caixa-preta.</p>`);
  else if (q.includes("operação") || q.includes("como está"))
    addHead(`<p class="say">Sob controle. 8 missões rodando, 5 já resolvidas hoje, e só 2 decisões precisaram de você — uma já é urgente (Quadro Paisagem). Comece por ela.</p>`);
  else addHead(`<p class="say">Anotei. Levo isso em conta na próxima rodada de priorização e te trago no briefing.</p>`);
};
function askAbout(d, action) {
  addUser(action === "adjust" ? `Quero ajustar a proposta do ${d.product}.` : `Me explica melhor a decisão do ${d.product}.`);
  addHead(action === "adjust"
    ? `<p class="say">Claro. O que muda — o foco, a foto ou o texto? Recalibro e recoloco na fila, já reordenada pelo EPE.</p>`
    : `<p class="say">${d.causa} Score ${d.breakdown.score}: ${d.breakdown.factors.map(f => f[0]).join(", ")}. É por isso que ficou no topo. Reversível — se em 7 dias não reagir, trago o plano B.</p>`);
}
const input = $("#composerInput");
$("#composerSend").addEventListener("click", send);
input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
function send() { const v = input.value.trim(); if (!v) return; input.value = ""; askFree(v); }

/* ---------------- boot ---------------- */
renderBriefing(); renderFunnel(); renderAttention(); renderDecisions();
renderMissions(); renderSilence(); renderPulse(); rotatePulse();
