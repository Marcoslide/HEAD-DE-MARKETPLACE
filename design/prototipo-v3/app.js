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
}
$$("#nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.v)));
$$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
const pb = $("#pulseBox");
pb.addEventListener("click", () => go("missoes"));
pb.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("missoes"); } });
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); go("operacao"); $("#opInput").focus(); }
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
  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  // contexto temporal do plano (Sprint 08.1): quando o Head gerou este briefing
  $("#dateline").textContent = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} · plano gerado às ${hh}:${mm}`;
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
  if (action === "adjust" || action === "ask") {
    go("operacao");
    window.HeadOps.ask(action === "adjust"
      ? `Ajuste a proposta do ${d.product}`
      : `Por que você priorizou o ${d.product}?`);
  }
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

/* ---------------- Conversa ----------------
   A conversa vive na área OPERAÇÃO (chat-operacao.js), usando a camada
   compartilhada do Sprint 09.A (mos/src/chat). Nada de resposta
   hardcoded aqui — este arquivo cuida só do Plano do Dia. */

/* ---------------- boot ---------------- */
renderBriefing(); renderFunnel(); renderAttention(); renderDecisions();
renderMissions(); renderSilence(); renderPulse(); rotatePulse();
