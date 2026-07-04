/* =============================================================
   Head de Marketplace — motor da experiência (Sprint 02)
   Sem frameworks: estado em memória + render por seção.
   ============================================================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  view: "home",
  decisions: DATA.decisions.map(d => ({ ...d, status: "pending" })),
  missions: {
    active: [...DATA.missions.active],
    waiting: [...DATA.missions.waiting],
    doneToday: [...DATA.missions.doneToday]
  },
  chatStarted: false,
  knowledgeFilter: "Tudo"
};

const pending = () => state.decisions.filter(d => d.status === "pending");

/* ---------------- Navegação ---------------- */
function go(v) {
  state.view = v;
  $$(".view").forEach(s => s.classList.remove("on"));
  $("#v-" + v).classList.add("on");
  $$("#nav button").forEach(b => b.classList.toggle("active", b.dataset.v === v));
  window.scrollTo({ top: 0 });
  if (v === "ia" && !state.chatStarted) startChat();
}
$$("#nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.v)));
$$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
const pulseBox = $("#pulseBox");
pulseBox.addEventListener("click", () => go("missoes"));
pulseBox.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("missoes"); } });

document.addEventListener("keydown", e => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault(); go("ia"); $("#composerInput").focus(); return;
  }
  if (typing) return;
  const map = { 1: "home", 2: "ia", 3: "produtos", 4: "missoes", 5: "conhecimento" };
  if (map[e.key]) go(map[e.key]);
});

/* ---------------- Toast do Head ---------------- */
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 4200);
}

/* ---------------- O Pulso ---------------- */
let actIdx = 0;
function renderPulse() {
  const n = pending().length;
  const box = $("#pulseBox"), dot = $("#pulseDot"), st = $("#pulseState");
  box.classList.toggle("waiting", n > 0);
  dot.classList.toggle("solid", n > 0);
  st.textContent = n > 0 ? "Aguardando sua decisão" : "Trabalhando agora";
  $("#pulseLink").textContent = state.missions.active.length + " missões ativas →";
}
function rotatePulse() {
  const msg = $("#pulseMsg");
  const next = () => {
    actIdx = (actIdx + 1) % DATA.activities.length;
    msg.textContent = DATA.activities[actIdx];
  };
  msg.textContent = DATA.activities[0];
  if (reduced) return;
  setInterval(() => {
    msg.classList.add("fade");
    setTimeout(() => { next(); msg.classList.remove("fade"); }, 500);
  }, 7000);
}

/* ---------------- Home: briefing ---------------- */
function renderBriefing() {
  const h = new Date().getHours();
  const sauda = h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  $("#greeting").textContent = `${sauda}, ${DATA.user}.`;
  const dias = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const d = new Date();
  $("#dateline").textContent = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} · seu briefing`;
  $("#worklist").innerHTML = DATA.worklist.map(([v, n, rest]) =>
    `<li><span class="tick">✓</span><span>${v} <b>${n.toLocaleString("pt-BR")}</b> ${rest}</span></li>`).join("");
  $("#keyfind").innerHTML = DATA.keyfind;
}

/* ---------------- Home: decisões ---------------- */
function decisionCard(d) {
  return `
  <article class="card" id="${d.id}">
    <div class="eyebrow"><span class="tag">${d.tag}</span><span>· ${d.product}</span><span class="mkt">${d.mkt}</span></div>
    <h3>${d.descoberta}</h3>
    <div class="drow"><span class="dlabel">Causa provável</span><p>${d.causa}</p></div>
    <div class="drow"><span class="dlabel">Proposta</span><p>${d.proposta}</p></div>
    <div class="meta-row">
      <span>Impacto estimado: <b>${d.impacto}</b></span>
      <span>Reversibilidade: ${d.reversibilidade}</span>
      <span>Confiança: ${d.confianca}</span>
    </div>
    <div class="actions" data-zone="actions">
      <button class="btn primary" onclick="decide('${d.id}','approve')">Aprovar</button>
      <button class="btn" onclick="decide('${d.id}','adjust')">Ajustar</button>
      <button class="btn" onclick="decide('${d.id}','refuse')">Recusar</button>
      <button class="btn ghost" onclick="decide('${d.id}','ask')">Perguntar</button>
    </div>
  </article>`;
}
function renderDecisions() {
  const box = $("#decisions");
  const list = pending();
  $("#decisionsTitle").textContent = `Aguardando sua decisão · ${list.length}`;
  if (!list.length) {
    box.innerHTML = `<div class="alldone"><p class="voice">Sem pendências. Tudo que dependia de você está encaminhado — eu cuido do resto e te chamo se algo importante surgir.</p></div>`;
  } else {
    box.innerHTML = list.map(decisionCard).join("");
  }
  const badge = $("#badgeHome");
  badge.style.display = list.length ? "" : "none";
  badge.textContent = list.length;
  renderPulse();
}

window.decide = function (id, action) {
  const d = state.decisions.find(x => x.id === id);
  const card = $("#" + id);
  if (!d || d.status !== "pending") return;

  if (action === "approve") {
    d.status = "approved";
    card.classList.add("approved");
    card.querySelector('[data-zone="actions"]').outerHTML =
      `<div class="note-ok">✓&ensp;Aprovado. Virou missão — publico a nova versão e volto com o resultado medido.</div>`;
    addMission({ ...d.missionOnApprove, fresh: true });
    state.missions.waiting = state.missions.waiting.filter(m => m.product !== d.product);
    toast(`Perfeito. Já estou executando — te trago o resultado medido do ${d.product} no briefing.`);
    setTimeout(() => { card.classList.add("gone"); setTimeout(renderDecisions, 380); }, 2100);
    renderMissions(); renderMini(); renderPulse();
  }

  if (action === "refuse") {
    card.querySelector('[data-zone="actions"]').innerHTML = `
      <span class="lbl" style="font-size:12.5px;color:var(--text-3)">Entendido. Por quê? (me ajuda a aprender)</span>
      <button class="btn" onclick="refuse('${id}','margem')">Margem apertada</button>
      <button class="btn" onclick="refuse('${id}','causa')">Não concordo com a causa</button>
      <button class="btn" onclick="refuse('${id}','depois')">Agora não</button>`;
  }

  if (action === "adjust" || action === "ask") {
    go("ia");
    askAboutDecision(d, action);
  }
};

window.refuse = function (id, motive) {
  const d = state.decisions.find(x => x.id === id);
  const card = $("#" + id);
  d.status = "refused";
  card.querySelector('[data-zone="actions"]').outerHTML =
    `<div class="note-muted">Registrado. Vou levar isso em conta nas próximas propostas.</div>`;
  toast("Anotei o motivo. É assim que eu aprendo o seu jeito de decidir.");
  setTimeout(() => { card.classList.add("gone"); setTimeout(renderDecisions, 380); }, 1800);
};

/* ---------------- Home: descobertas + andamento ---------------- */
function renderDiscoveries() {
  $("#discoveries").innerHTML = DATA.discoveries.map(x => `
    <article class="card">
      <div class="eyebrow"><span class="tag ${x.cls}">${x.type}</span></div>
      <h3 class="voice">${x.text}</h3>
      <div class="proof">${x.proof}</div>
    </article>`).join("");
}
function renderMini() {
  $("#miniMissions").innerHTML = state.missions.active.slice(0, 4).map(m =>
    `<div class="mini"><span class="dot"></span><span><b>${m.tag}</b> · ${m.product} — ${m.now}</span></div>`).join("");
}

/* ---------------- Produtos ---------------- */
function renderProducts() {
  $("#products").innerHTML = DATA.products.map(p => {
    const color = p.score >= 80 ? "var(--positive)" : p.score >= 50 ? "var(--amber)" : "var(--critical)";
    return `
    <article class="card prod">
      <div class="thumb">${p.emoji}</div>
      <div class="info">
        <div class="nameline"><span class="name">${p.name}</span><span class="mkt">${p.mkt}</span></div>
        <div class="stats"><span class="${p.convCls}">${p.conv}</span><span>${p.rank}</span></div>
        <div class="lastword">“${p.last}”</div>
        ${p.opp ? `<div class="opp">◆ ${p.opp}</div>` : ""}
      </div>
      <div class="ring" style="--p:${p.score};--c:${color}" title="Saúde ${p.score}/100"><b>${p.score}</b></div>
    </article>`;
  }).join("");
}

/* ---------------- Missões ---------------- */
function missionCard(m) {
  return `
  <article class="card mission${m.fresh ? " fresh" : ""}">
    <div class="eyebrow"><span class="tag">${m.tag}</span><span>· ${m.product}</span></div>
    <h3>${m.title}</h3>
    ${m.now ? `<div class="now"><span class="dot"></span><span>agora: ${m.now}</span></div>` : ""}
    ${m.log ? `<details><summary>diário de bordo</summary><div class="logbook">
      ${m.log.map(([t, s]) => `<div><time>${t}</time><span>${s}</span></div>`).join("")}
    </div></details>` : ""}
    ${m.origin ? `<div class="origin">${m.origin}</div>` : ""}
  </article>`;
}
function renderMissions() {
  const M = state.missions;
  $("#missionsActiveTitle").textContent = `Em andamento · ${M.active.length}`;
  $("#missionsActive").innerHTML = M.active.map(missionCard).join("");
  $("#missionsWaitingTitle").textContent = `Aguardando você · ${M.waiting.length}`;
  $("#missionsWaiting").innerHTML = M.waiting.length
    ? M.waiting.map(m => `
      <article class="card mission">
        <div class="eyebrow"><span class="tag">${m.tag}</span><span>· ${m.product}</span></div>
        <h3>${m.title}</h3>
        <div class="actions"><button class="btn primary" data-go="home" onclick="go('home')">Decidir agora</button></div>
      </article>`).join("")
    : `<div class="alldone"><p class="voice">Nada bloqueado em você. Sigo trabalhando.</p></div>`;
  $("#missionsDoneTitle").textContent = `Concluídas hoje · ${M.doneToday.length}`;
  $("#missionsDone").innerHTML = M.doneToday.map(m => `
    <article class="card done"><div class="done-h"><h3>${m.title}</h3><span class="res">${m.res}</span></div></article>`).join("");
  $("#badgeMissions").textContent = M.active.length;
}
function addMission(m) {
  state.missions.active.unshift(m);
  renderMissions(); renderMini(); renderPulse();
}

/* ---------------- Conhecimento ---------------- */
function renderKnowledgeCols() {
  $("#knowledgeCols").innerHTML = DATA.knowledgeCols.map(c =>
    `<button class="chip${c === state.knowledgeFilter ? " active" : ""}" onclick="filterKnowledge('${c}')">${c}</button>`).join("");
}
window.filterKnowledge = function (c) {
  state.knowledgeFilter = c;
  renderKnowledgeCols(); renderKnowledge();
};
function renderKnowledge() {
  const list = DATA.knowledge.filter(k => state.knowledgeFilter === "Tudo" || k.col === state.knowledgeFilter);
  $("#knowledge").innerHTML = list.map(k => `
    <article class="card know">
      <div class="eyebrow"><span class="tag pos">${k.col}</span></div>
      <h3>${k.text}</h3>
      <div class="proof">${k.proof}</div>
      <div class="actions">
        ${k.actions.map(a => `<button class="btn" onclick="toast('Boa. Abri uma missão para aplicar isso — te mostro o resultado.')">${a}</button>`).join("")}
        <button class="btn ghost" onclick="go('ia');askFree('Me explica melhor: ${k.text.replace(/'/g, "\\'")}')">Perguntar sobre isso</button>
      </div>
    </article>`).join("");
}

/* ---------------- Conversa ---------------- */
const chat = () => $("#chat");
function addUserMsg(text) {
  chat().insertAdjacentHTML("beforeend",
    `<div class="msg user"><div class="who">${DATA.user}</div><div class="bubble"></div></div>`);
  chat().lastElementChild.querySelector(".bubble").textContent = text;
  scrollChat();
}
function addHeadMsg(html, delay = 1100) {
  chat().insertAdjacentHTML("beforeend",
    `<div class="msg head"><div class="who">Head</div><div class="typing"><i></i><i></i><i></i></div></div>`);
  scrollChat();
  const node = chat().lastElementChild;
  setTimeout(() => {
    node.querySelector(".typing").outerHTML = html;
    scrollChat();
  }, reduced ? 0 : delay);
}
function scrollChat() {
  requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight }));
}
function startChat() {
  state.chatStarted = true;
  addHeadMsg(`<p class="say">Oi, ${DATA.user}. Estou por aqui — me pergunta qualquer coisa sobre a operação, ou me dá uma tarefa. O que eu puder executar sozinho, eu executo e te aviso.</p>`, 600);
  $("#suggest").innerHTML = DATA.suggestions.map(s =>
    `<button class="chip" onclick="askFree('${s.replace(/'/g, "\\'")}')">${s}</button>`).join("");
}

const diagCard = `
  <article class="card">
    <div class="eyebrow"><span class="tag">Diagnóstico</span><span>· Quadro Paisagem 60x90</span><span class="mkt">Mercado Livre</span></div>
    <h3>A conversão caiu 18% desde terça. Causa provável: ArteParede e DecorMax baixaram preço e melhoraram a imagem principal no mesmo dia.</h3>
    <div class="evidence">
      <span>Seu tráfego se manteve — o problema é conversão, não visibilidade</span>
      <span>Suas avaliações seguem superiores (4,8 vs 4,4)</span>
      <span>O ponto fraco do líder é embalagem — o seu ponto forte</span>
    </div>
    <div class="actions"><button class="btn primary" onclick="go('home')">Ver a proposta pronta na Home</button></div>
  </article>`;

const versionsCard = `
  <div class="versions">
    <article class="card"><h4>Versão A · Acabamento</h4><p>Título e fotos puxando “moldura reforçada” e close do acabamento — o elogio mais comum nas suas avaliações.</p><div class="actions"><button class="btn" onclick="chooseVersion('A')">Escolher esta</button></div></article>
    <article class="card"><h4>Versão B · Embalagem segura</h4><p>Terceira foto mostrando a embalagem protegida — ataca a objeção nº 1 da categoria (“medo de chegar quebrado”).</p><div class="actions"><button class="btn" onclick="chooseVersion('B')">Escolher esta</button></div></article>
    <article class="card"><h4>Versão C · Ambiente real</h4><p>Primeira foto ambientada em sala real — padrão vencedor nos seus testes anteriores (+19% de cliques).</p><div class="actions"><button class="btn" onclick="chooseVersion('C')">Escolher esta</button></div></article>
  </div>`;

window.chooseVersion = function (v) {
  addHeadMsg(`<p class="say">Fechado — vou publicar a Versão ${v} e deixar as outras duas guardadas. Acompanho a conversão e te conto o resultado no briefing.</p>`, 800);
  addMission({ tag: "Executando", product: "Quadro Paisagem 60x90",
    title: `Publicar a Versão ${v} e medir o efeito na conversão.`,
    now: "publicando…", origin: "origem: escolhida por você na conversa", fresh: true });
  toast(`Versão ${v} a caminho. Eu cuido do resto.`);
};

function reply(text) {
  const t = text.toLowerCase();
  if (t.includes("caíram") || t.includes("cairam") || t.includes("queda"))
    return `<p class="say">Investiguei agora. A queda está concentrada em um único produto — o resto da operação está estável. Olha o que encontrei:</p>${diagCard}`;
  if (t.includes("três versões") || t.includes("tres versoes") || t.includes("3 versões") || t.includes("3 versoes"))
    return `<p class="say">Criei três caminhos para o Quadro Paisagem 60x90, cada um atacando um ângulo diferente. Minha recomendação é a B — mas a decisão é sua:</p>${versionsCard}`;
  if (t.includes("faça um anúncio") || t.includes("faca um anuncio") || t.includes("anúncio para") || t.includes("anuncio para"))
    return { html: `<p class="say">Começando agora. Vou montar título, ficha técnica e fotos a partir do que já sei da categoria — e te trago para aprovar antes de publicar qualquer coisa.</p>`,
      mission: { tag: "Criando", product: "novo anúncio", title: "Montar anúncio completo: título, ficha técnica e fotos.", now: "pesquisando os títulos vencedores da categoria…", origin: "origem: pedido seu, pela conversa", fresh: true } };
  if (t.includes("concorrente"))
    return `<p class="say">O que mais me preocupa hoje é o <b>ArteParede</b>. Ele baixou 12% o preço e trocou a foto principal — mas tem um ponto fraco claro: 23% das reclamações dele são sobre embalagem, exatamente o seu ponto forte. É por isso que a minha proposta na Home reposiciona o seu anúncio em vez de cobrir o desconto.</p>`;
  if (t.includes("fazer hoje") || t.includes("devo fazer"))
    return `<p class="say">Duas coisas esperam você na Home: a resposta competitiva do Quadro Paisagem e o título novo do Kit 3 Quadros — juntas valem uns R$ 3.300/mês. O resto eu toco sozinho: 5 missões em andamento, nenhuma bloqueada. Começa pelas aprovações.</p><div class="actions" style="margin-top:14px"><button class="btn primary" onclick="go('home')">Ir para as decisões</button></div>`;
  return { html: `<p class="say">Anotei. Abri uma missão para isso e te trago o que encontrar no próximo briefing — se algo for urgente, te chamo antes.</p>`,
    mission: { tag: "Investigando", product: "pedido seu", title: text.charAt(0).toUpperCase() + text.slice(1), now: "começando agora…", origin: "origem: pedido seu, pela conversa", fresh: true } };
}

window.askFree = function (text) {
  if (!state.chatStarted) { state.chatStarted = true; $("#suggest").innerHTML = DATA.suggestions.map(s => `<button class="chip" onclick="askFree('${s.replace(/'/g, "\\'")}')">${s}</button>`).join(""); }
  go("ia");
  addUserMsg(text);
  const r = reply(text);
  if (typeof r === "string") addHeadMsg(r);
  else { addHeadMsg(r.html); if (r.mission) setTimeout(() => addMission(r.mission), reduced ? 0 : 1300); }
};

function askAboutDecision(d, action) {
  const q = action === "adjust" ? `Quero ajustar a proposta do ${d.product}.` : `Me explica melhor a proposta do ${d.product}.`;
  addUserMsg(q);
  if (action === "adjust")
    addHeadMsg(`<p class="say">Claro. O que você quer mudar — o foco da nova versão, a foto principal ou o texto? Me diz em uma frase e eu recalibro a proposta antes de você aprovar.</p>`);
  else
    addHeadMsg(`<p class="say">Vou abrir o raciocínio: ${d.causa} A saída mais óbvia seria cobrir o preço, mas isso corrói sua margem e vira leilão. ${d.proposta} Reversibilidade ${d.reversibilidade.toLowerCase()} Se em 7 dias a conversão não reagir, eu mesmo trago o plano B.</p>`);
}

const input = $("#composerInput");
$("#composerSend").addEventListener("click", send);
input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
function send() {
  const v = input.value.trim();
  if (!v) return;
  input.value = "";
  askFree(v);
}

/* ---------------- Boot ---------------- */
renderBriefing();
renderDecisions();
renderDiscoveries();
renderMini();
renderProducts();
renderMissions();
renderKnowledgeCols();
renderKnowledge();
renderPulse();
rotatePulse();
