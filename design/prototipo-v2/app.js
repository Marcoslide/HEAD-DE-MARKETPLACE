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
  const navKey = v === "produto" ? "produtos" : v;
  $$("#nav button").forEach(b => b.classList.toggle("active", b.dataset.v === navKey));
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

/* ---------------- Central (Produtos · Marketplaces · Anúncios) ---------------- */
const central = { tab: "produtos", search: "", filter: "all", page: 1, pageSize: 5 };

function centralData() {
  let items = DATA.products;
  if (central.filter === "atencao") items = items.filter(p => p.score < 70 || p.convCls === "down");
  else if (central.filter !== "all") items = items.filter(p => p.mkt === central.filter);
  if (central.search) {
    const q = central.search.toLowerCase();
    items = items.filter(p => p.name.toLowerCase().includes(q) ||
      p.listings.some(l => l.versions.some(v => v.title.toLowerCase().includes(q))));
  }
  return [...items].sort((x, y) => x.score - y.score); // atenção primeiro
}

function renderCentral() {
  const titles = { produtos: "Produtos · ordenados por atenção",
    marketplaces: "Marketplaces conectados", anuncios: "Anúncios · todas as praças" };
  $("#centralTitle").textContent = titles[central.tab];
  $$("#centralTabs .tab").forEach(t => t.classList.toggle("active", t.dataset.tab === central.tab));
  $$("#centralFilters .chip").forEach(c => c.classList.toggle("active", c.dataset.f === central.filter));

  if (central.tab === "marketplaces") return renderMarketplaces();
  if (central.tab === "anuncios") return renderListings();
  renderProductsTab();
}

function sparkline(values) {
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  return `<div class="spark" title="últimos 7 dias">` + values.map((v, i) =>
    `<i style="height:${6 + ((v - min) / range) * 20}px" class="${i === values.length - 1 ? "hot" : ""}"></i>`).join("") + `</div>`;
}

function renderProductsTab() {
  const all = centralData();
  const pages = Math.max(1, Math.ceil(all.length / central.pageSize));
  central.page = Math.min(central.page, pages);
  const slice = all.slice((central.page - 1) * central.pageSize, central.page * central.pageSize);
  $("#centralCount").textContent = `${all.length} produtos · ${DATA.products.reduce((s, p) => s + p.listings.length, 0)} anúncios`;
  $("#centralBody").innerHTML = slice.map(p => {
    const color = p.score >= 80 ? "var(--positive)" : p.score >= 50 ? "var(--amber)" : "var(--critical)";
    return `
    <article class="card prod" style="cursor:pointer" onclick="openProduct('${p.id}')">
      <div class="thumb">${p.emoji}</div>
      <div class="info">
        <div class="nameline"><span class="name">${p.name}</span><span class="mkt">${p.mkt}</span></div>
        <div class="stats"><span class="${p.convCls}">${p.conv}</span><span>${p.rank}</span></div>
        <div class="lastword">“${p.last}”</div>
        ${p.opp ? `<div class="opp">◆ ${p.opp}</div>` : ""}
      </div>
      ${sparkline(p.perf.conv)}
      <div class="ring" style="--p:${p.score};--c:${color}" title="Saúde ${p.score}/100"><b>${p.score}</b></div>
    </article>`;
  }).join("") || `<div class="alldone"><p class="voice">Nenhum produto com esse filtro.</p></div>`;
  $("#centralPager").innerHTML = pages > 1 ? `
    <button class="btn" ${central.page === 1 ? "disabled" : ""} onclick="centralPage(-1)">←</button>
    <span>página ${central.page} de ${pages}</span>
    <button class="btn" ${central.page === pages ? "disabled" : ""} onclick="centralPage(1)">→</button>` : "";
}
window.centralPage = d => { central.page += d; renderCentral(); };

function renderMarketplaces() {
  $("#centralCount").textContent = `${DATA.marketplaces.length} conexões`;
  $("#centralPager").innerHTML = "";
  $("#centralBody").innerHTML = DATA.marketplaces.map(m => `
    <article class="card mkt-card">
      <div class="eyebrow"><span class="tag pos">${m.status}</span></div>
      <h3 style="font-family:var(--sans);font-weight:600;font-size:16px">${m.name}</h3>
      <div class="stats-row">
        <span><b>${m.products}</b> produtos</span><span><b>${m.listings}</b> anúncios</span>
        <span>saúde média <b>${m.health}</b>/100</span>
      </div>
      <div class="lastword" style="margin-top:10px">“${m.note}”</div>
    </article>`).join("");
}

function renderListings() {
  let rows = DATA.products.flatMap(p => p.listings.map(l => ({ p, l })));
  if (central.filter !== "all" && central.filter !== "atencao")
    rows = rows.filter(r => r.l.mkt === central.filter);
  if (central.filter === "atencao") rows = rows.filter(r => r.l.health < 70 || r.l.status !== "ativo");
  if (central.search) {
    const q = central.search.toLowerCase();
    rows = rows.filter(r => r.p.name.toLowerCase().includes(q) ||
      r.l.versions.some(v => v.title.toLowerCase().includes(q)));
  }
  $("#centralCount").textContent = `${rows.length} anúncios`;
  $("#centralPager").innerHTML = "";
  $("#centralBody").innerHTML = rows.map(({ p, l }) => {
    const active = l.versions.find(v => v.active) || l.versions[0];
    return `
    <article class="card listing-row" style="cursor:pointer" onclick="openProduct('${p.id}')">
      <div class="thumb">${p.emoji}</div>
      <div class="info">
        <div class="nameline"><span class="name">${active.title}</span><span class="mkt">${l.mkt}</span>
          <span class="lstatus ${l.status}">${l.status}</span></div>
        <div class="stats"><span>R$ ${l.price}</span><span>#${l.ranking} na busca</span>
          <span>v${active.n} ativa · ${l.versions.length} versões</span>
          <span>${l.publications.length} publicações</span></div>
      </div>
      <div class="ring" style="--p:${l.health};--c:${l.health >= 80 ? "var(--positive)" : l.health >= 50 ? "var(--amber)" : "var(--critical)"}"><b>${l.health}</b></div>
    </article>`;
  }).join("") || `<div class="alldone"><p class="voice">Nenhum anúncio com esse filtro.</p></div>`;
}

/* ---------------- Central do Produto (Bloco 06) ---------------- */
window.openProduct = function (id) {
  const p = DATA.products.find(x => x.id === id);
  if (!p) return;
  const color = p.score >= 80 ? "var(--positive)" : p.score >= 50 ? "var(--amber)" : "var(--critical)";
  const decisions = state.decisions.filter(d => d.status === "pending" && p.name.startsWith(d.product.slice(0, 12)));
  const missions = state.missions.active.filter(m => p.name.includes(m.product) || m.product.includes(p.name.slice(0, 12)));
  $("#productDetail").innerHTML = `
    <div class="card prod" style="cursor:default">
      <div class="thumb">${p.emoji}</div>
      <div class="info">
        <div class="nameline"><span class="name" style="font-size:17px">${p.name}</span><span class="mkt">${p.mkt}</span></div>
        <div class="stats"><span class="${p.convCls}">${p.conv}</span><span>${p.rank}</span></div>
      </div>
      <div class="ring" style="--p:${p.score};--c:${color}"><b>${p.score}</b></div>
    </div>

    <div class="section"><div class="section-h"><span class="eyebrow">Resumo executivo</span></div>
      <p class="voice" style="font-size:16.5px;line-height:1.65;max-width:58ch">${p.resumo}</p></div>

    ${decisions.length ? `<div class="section"><div class="section-h"><span class="eyebrow">Decisões deste produto · ${decisions.length}</span></div>
      ${decisions.map(d => `<div class="card"><h3>${d.descoberta}</h3>
        <div class="actions"><button class="btn primary" onclick="go('home')">Decidir agora</button>
        <button class="btn ghost" onclick="askFree('Me explica melhor a proposta do ${p.name}.')">Perguntar sobre isso</button></div></div>`).join("")}</div>` : ""}

    <div class="section"><div class="section-h"><span class="eyebrow">Performance · 7 dias</span></div>
      <div class="detail-grid">
        <div class="card"><div class="kv"><b>Conversão</b><span>%</span></div>${sparkline(p.perf.conv)}
          <div class="kv" style="margin-top:8px">hoje <b>${p.perf.conv.at(-1)}%</b> · início <b>${p.perf.conv[0]}%</b></div></div>
        <div class="card"><div class="kv"><b>CTR</b><span>%</span></div>${sparkline(p.perf.ctr)}
          <div class="kv" style="margin-top:8px">hoje <b>${p.perf.ctr.at(-1)}%</b> · início <b>${p.perf.ctr[0]}%</b></div></div>
      </div></div>

    <div class="section"><div class="section-h"><span class="eyebrow">Anúncios e versões</span></div>
      ${p.listings.map(l => `<div class="card">
        <div class="eyebrow"><span class="mkt">${l.mkt}</span><span class="lstatus ${l.status}">${l.status}</span>
          <span style="margin-left:auto;font-variant-numeric:tabular-nums">R$ ${l.price} · #${l.ranking} · saúde ${l.health}</span></div>
        <div style="margin-top:12px">${l.versions.map(v => `
          <div class="vrow"><span class="vn">v${v.n}</span><span>${v.title}</span>
            <span style="color:var(--text-3);font-size:11.5px">· ${v.author === "head" ? "Head" : "você"} · ${v.reason}</span>
            <span class="vres">${v.active ? "● ativa · " : ""}${v.result}</span></div>`).join("")}</div>
        ${l.publications.length ? `<details style="margin-top:10px"><summary style="font-size:12px;color:var(--text-3);cursor:pointer">publicações simuladas (${l.publications.length})</summary>
          <div class="tl" style="margin-top:8px">${l.publications.map(pb => `<div><time>${pb.at}</time>${pb.action} — ${pb.outcome}</div>`).join("")}</div></details>` : ""}
      </div>`).join("")}</div>

    ${missions.length ? `<div class="section"><div class="section-h"><span class="eyebrow">Missões ativas · ${missions.length}</span></div>
      ${missions.map(m => `<div class="mini"><span class="dot"></span><span><b>${m.tag}</b> — ${m.title}</span></div>`).join("")}</div>` : ""}

    ${p.experiments.length ? `<div class="section"><div class="section-h"><span class="eyebrow">Experimentos</span></div>
      ${p.experiments.map(e => `<div class="card"><h3 style="font-size:15px">${e.name}</h3>
        <div class="kv" style="margin-top:8px"><b>variável:</b><span>${e.variable}</span></div>
        <div class="kv"><b>critério (definido antes):</b><span>${e.criteria}</span></div>
        <div class="kv"><b>estado:</b><span>${e.status}</span></div></div>`).join("")}</div>` : ""}

    <div class="section"><div class="section-h"><span class="eyebrow">Linha do tempo</span></div>
      <div class="tl">${p.timeline.map(t => `<div><time>${t.day}</time>${t.text}
        ${t.effect ? `<span class="fx"> → ${t.effect}</span>` : ""}</div>`).join("")}</div></div>

    ${p.learnings.length ? `<div class="section"><div class="section-h"><span class="eyebrow">Aprendizados deste produto</span></div>
      ${p.learnings.map(l => `<div class="mini"><span style="color:var(--amber)">◆</span><span>${l}</span></div>`).join("")}</div>` : ""}

    <div class="actions" style="margin-top:28px">
      <button class="btn ghost" onclick="askFree('Como está o ${p.name}?')">Perguntar sobre este produto</button>
    </div>`;
  go("produto");
};

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

/* ---------------- Central: eventos ---------------- */
$$("#centralTabs .tab").forEach(t => t.addEventListener("click", () => { central.tab = t.dataset.tab; central.page = 1; renderCentral(); }));
$$("#centralFilters .chip").forEach(c => c.addEventListener("click", () => { central.filter = c.dataset.f; central.page = 1; renderCentral(); }));
$("#centralSearch").addEventListener("input", e => { central.search = e.target.value.trim(); central.page = 1; renderCentral(); });
$("#backToProducts").addEventListener("click", () => go("produtos"));

/* ---------------- Boot ---------------- */
renderBriefing();
renderDecisions();
renderDiscoveries();
renderMini();
renderCentral();
renderMissions();
renderKnowledgeCols();
renderKnowledge();
renderPulse();
rotatePulse();
