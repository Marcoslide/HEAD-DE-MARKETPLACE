/* =============================================================
   v8 · OPERAÇÃO — mesa de comando
   Zona 1: conversa e comandos (HEADCHAT — a MESMA camada dos testes
   Node; nenhuma resposta inventada aqui). Zona 2: contexto ativo,
   decisões, ações executadas e jobs. Separação visual por tipo:
   FATO · EVIDÊNCIA · HIPÓTESE · PLAYBOOK · RECOMENDAÇÃO · RISCO · AÇÃO.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA, L = V8LOGIC;
  const clock = MIE.createClock();

  const complianceAdapter = HEADCOMPLIANCE.createComplianceAdapter({ products: HEADCOMPLIANCE.DEMO_PRODUCTS, clock });
  const growthAdapter = HEADGROWTH.createGrowthAdapter(HEADGROWTH.createDemoGrowthDataset(clock), clock);
  const chat = HEADCHAT.createHeadChat({ clock, compliance: complianceAdapter, growth: growthAdapter });

  const OP = window.OPERACAO = { log: [] };
  const SEPS = ['FATO', 'EVIDÊNCIA', 'HIPÓTESE', 'PLAYBOOK', 'RECOMENDAÇÃO', 'RISCO', 'AÇÃO', 'DECISÃO PENDENTE', 'STATUS', 'TESTE', 'MÉTRICA', 'PONTO DE PARADA'];

  /* marca blocos tipados na resposta (apresentação apenas) */
  function fmt(text) {
    return String(text).split('\n').map(ln => {
      const m = ln.match(/^\s*(?:\[)?([A-ZÀ-Ü ]{3,22})(?:\]|:)\s*(.*)$/);
      if (m && SEPS.includes(m[1].trim()))
        return `<span class="sep-line">${UI.esc(m[1].trim())}</span>${UI.esc(m[2])}`;
      return UI.esc(ln);
    }).join('<br>');
  }

  function push(kind, html, meta) { OP.log.push({ kind, html, meta }); }

  function ask(q) {
    push('u', UI.esc(q));
    let r;
    try { r = chat.ask(q); } catch (e) { r = { reply: 'Não consegui responder: ' + e.message, intent: 'ERRO' }; }
    /* 10.UI.2 — limpeza de CRM: este produto não trabalha com leads/pipeline.
       Comando de lead é respondido com o redirecionamento honesto. */
    if (r.intent === 'LEADS_QUERY' || /\blead(s)?\b|pipeline comercial/i.test(q)) {
      r = { reply: 'FATO: este produto não trabalha com leads nem pipeline de CRM.\nSTATUS: parceiros comerciais (afiliados, creators) vivem em Crescimento · Aceleração; oportunidades de venda vivem em Crescimento · Oportunidades.', intent: 'SEM_CRM' };
    }
    push('h', fmt(r.reply), `${r.intent || 'RESPOSTA'} · ${D.STATUS.DADO_SIMULADO} · ${clock.nowIso().slice(11, 16)}`);
    paint();
  }

  /* ---------- ações rápidas (todas fazem algo real e interno) ---------- */
  const QACTS = [
    ['criar_anuncio', 'criar anúncio'], ['add_midia', 'adicionar foto/link/arquivo'],
    ['sel_produto', 'selecionar produto'], ['sel_mkt', 'escolher marketplace'],
    ['criar_missao', 'criar missão'], ['intervencao', 'registrar intervenção manual'],
    ['solicitar_dado', 'solicitar dado faltante'], ['whatsapp', 'perguntar via WhatsApp'],
  ];

  function runQuick(key) {
    const p = OP.produto ? UI.state.products.find(x => x.id === OP.produto) : null;
    if (key === 'sel_produto') {
      UI.openModal(`<h3 class="h2">Selecionar produto do contexto</h3>
        <select class="select" id="qpSel" style="width:100%;margin-top:12px">
          ${UI.state.products.map(x => `<option value="${x.id}" ${OP.produto === x.id ? 'selected' : ''}>${UI.esc(x.nome)} (${x.sku})</option>`).join('')}</select>
        <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn primary" id="qpOk">Usar no contexto</button></div>`);
      UI.$('#qpOk').onclick = () => { OP.produto = UI.$('#qpSel').value; UI.closeModal(); UI.toast('Produto no contexto da mesa.', 'ok'); paint(); };
    } else if (key === 'sel_mkt') {
      UI.openModal(`<h3 class="h2">Escolher marketplace do contexto</h3>
        <div class="fbar" style="margin-top:12px">${D.MKTS.map(m => `<button class="fchip ${OP.mkt === m.key ? 'on' : ''}" data-mkt="${m.key}">${m.nome}</button>`).join('')}</div>`);
      UI.$$('#modal [data-mkt]').forEach(b => b.onclick = () => { OP.mkt = b.dataset.mkt; UI.closeModal(); UI.toast('Marketplace no contexto.', 'ok'); paint(); });
    } else if (key === 'criar_anuncio') {
      if (!p || !OP.mkt) return UI.toast('Antes: selecione produto e marketplace no contexto.', 'err');
      CATALOGO.drafts.push({ id: 'op-d' + (CATALOGO.drafts.length + 1), produtoId: p.id, mkt: OP.mkt, status: D.STATUS.EM_REVISAO, nota: 'nasceu da conversa na Operação' });
      L._audit(UI.state, 'Marcos', 'draft_criado', `${p.sku} → ${OP.mkt} (via Operação)`);
      push('h', `<span class="sep-line">AÇÃO</span>Rascunho interno criado: <b>${UI.esc(p.nome)}</b> → ${D.MKTS.find(m => m.key === OP.mkt).nome}.<br><span class="sep-line">STATUS</span>${D.STATUS.EM_REVISAO} · publicação externa segue ${D.STATUS.ESCRITA_BLOQUEADA}.`, D.STATUS.ACAO_INTERNA);
      UI.toast('Rascunho criado — veja em Catálogo · Rascunhos e Revisões.', 'ok'); paint();
    } else if (key === 'add_midia') {
      if (!p) return UI.toast('Selecione um produto no contexto primeiro.', 'err');
      L._audit(UI.state, 'Marcos', 'midia_anexada', `evidência anexada a ${p.sku} (simulado)`);
      push('h', `<span class="sep-line">EVIDÊNCIA</span>Mídia anexada ao ${UI.esc(p.nome)} e registrada com origem. (simulado — sem upload real neste modo)`, D.STATUS.ACAO_INTERNA);
      paint();
    } else if (key === 'criar_missao') {
      const t = p ? `Acompanhar ${p.nome}` : 'Missão criada da mesa de comando';
      D.missoes.push({ id: 'm' + (D.missoes.length + 1), titulo: t, status: D.STATUS.EM_PROCESSAMENTO, tipo: D.STATUS.ACAO_INTERNA, agora: 'criada agora na Operação', origem: 'mesa de comando', reversivel: true });
      L._audit(UI.state, 'Marcos', 'missao_criada', t);
      push('h', `<span class="sep-line">AÇÃO</span>Missão criada: <b>${UI.esc(t)}</b>. Acompanhe em <b>A Missão</b>.`, D.STATUS.ACAO_INTERNA);
      UI.refreshBadges(); paint();
    } else if (key === 'intervencao') {
      UI.openModal(`<h3 class="h2">Registrar intervenção manual</h3>
        <p class="sub" style="margin-top:4px">O que você fez por fora fica registrado — o Head considera isso nas análises.</p>
        <input class="input" id="ivTxt" style="width:100%;margin-top:10px" placeholder="ex.: alterei o preço direto no painel do ML">
        <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn primary" id="ivOk">Registrar</button></div>`);
      UI.$('#ivOk').onclick = () => {
        const t = UI.$('#ivTxt').value.trim(); if (!t) return;
        L._audit(UI.state, 'Marcos', 'intervencao_manual', t);
        UI.closeModal();
        push('h', `<span class="sep-line">FATO</span>Intervenção registrada: “${UI.esc(t)}”.<br><span class="sep-line">STATUS</span>Vou tratar esse dado como manual até a próxima sincronização oficial.`, 'intervenção · ' + D.STATUS.ACAO_INTERNA);
        paint();
      };
    } else if (key === 'solicitar_dado') {
      const alvo = p || UI.state.products.find(x => x.pendencias.length);
      if (!alvo) return UI.toast('Nenhuma pendência de dado aberta.', 'ok');
      L._audit(UI.state, 'Head', 'dado_solicitado', `${alvo.sku}: ${alvo.pendencias[0] || 'dado faltante'}`);
      push('h', `<span class="sep-line">AÇÃO</span>Solicitação criada para <b>${UI.esc(alvo.nome)}</b>: ${UI.esc(alvo.pendencias[0] || 'dado faltante')}.<br><span class="sep-line">STATUS</span>Entrou na fila do Data Completion — pergunto via WhatsApp quando o canal estiver conectado (${D.STATUS.AGUARDANDO_CONEXAO}).`, D.STATUS.ACAO_INTERNA);
      paint();
    } else if (key === 'whatsapp') {
      push('h', `<span class="sep-line">STATUS</span>WhatsApp está ${D.STATUS.AGUARDANDO_CONEXAO} — nada foi enviado. Quando conectar, esta pergunta sai pelo seu número com o mesmo motor desta mesa.`, 'controle remoto · honesto');
      paint();
    }
  }

  /* ---------- render ---------- */
  function paint() {
    const p = OP.produto ? UI.state.products.find(x => x.id === OP.produto) : null;
    const audit = UI.state.audit.slice(-6).reverse();
    UI.$('#v-operacao').innerHTML = `
      <div class="eyebrow">operação · mesa de comando</div>
      <h1 class="h1">Operação</h1>
      <p class="sub" style="margin-top:6px">Converse, comande e acompanhe. Respostas vêm da mesma camada dos testes — com fonte, hora e cobertura; sem números inventados.</p>

      <div class="op-grid sect">
        <div>
          <div class="panel" style="padding:14px 16px">
            <div class="chatlog" id="opLog">
              ${OP.log.length ? OP.log.map(m => m.kind === 'u'
                ? `<div class="msg-u">${m.html}</div>`
                : `<div class="msg-h"><div class="who">HEAD</div><div class="body">${m.html}</div>${m.meta ? `<div class="meta">${UI.esc(m.meta)}</div>` : ''}</div>`).join('')
              : `<div class="empty"><b>Mesa pronta</b>Pergunte sobre margem, leads, pendências, promoções — ou use as ações rápidas abaixo.</div>`}
            </div>
            <div class="composer">
              <div class="composer-box">
                <input id="opIn" placeholder="Pergunte ou comande… ex.: qual a margem do kit 3 quadros?" aria-label="Comando">
                <button class="btn primary sm" data-act="send">enviar</button>
              </div>
              <div class="qacts">${QACTS.map(([k, l]) => `<button class="qact" data-act="q" data-q="${k}">${l}</button>`).join('')}</div>
            </div>
          </div>
        </div>

        <aside class="ctxpanel">
          <div class="ctxcard"><div class="h"><b>Contexto ativo</b><span class="src">${D.STATUS.DADO_SIMULADO}</span></div>
            <div class="ctxitem"><span>Produto</span><b>${p ? UI.esc(p.nome) : '— nenhum'}</b></div>
            <div class="ctxitem"><span>Marketplace</span><b>${OP.mkt ? D.MKTS.find(m => m.key === OP.mkt).nome : '— nenhum'}</b></div>
            <div class="ctxitem"><span>Escrita externa</span>${UI.stBadge(D.STATUS.ESCRITA_BLOQUEADA)}</div>
          </div>
          <div class="ctxcard"><div class="h"><b>Decisões pendentes</b></div>
            ${D.missoes.filter(m => m.status === D.STATUS.AGUARDANDO_APROVACAO).map(m => `<div class="ctxitem"><span>${UI.esc(m.titulo)}</span><button class="linklike" data-act="gomissao">decidir →</button></div>`).join('') || '<div class="ctxitem"><span>nenhuma agora</span></div>'}
          </div>
          <div class="ctxcard"><div class="h"><b>Jobs</b></div>
            ${UI.state.jobs.slice(-3).reverse().map(j => `<div class="ctxitem"><span>${j.id} · ${UI.esc(j.acao)} (${j.total})</span>${UI.stBadge(j.status)}</div>`).join('') || '<div class="ctxitem"><span>nenhum job executado</span></div>'}
          </div>
          <div class="ctxcard"><div class="h"><b>Ações executadas</b><span class="src">auditadas</span></div>
            ${audit.map(a => `<div class="ctxitem"><span>${UI.esc(a.detalhe)}</span><span class="src">${UI.esc(a.actor)}</span></div>`).join('') || '<div class="ctxitem"><span>nada ainda — tudo que fizer aparece aqui</span></div>'}
          </div>
        </aside>
      </div>`;

    const log = UI.$('#opLog'); if (log) log.scrollTop = log.scrollHeight;
    UI.$('#v-operacao').onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'send') { const i = UI.$('#opIn'); if (i.value.trim()) { ask(i.value.trim()); } }
      else if (b.dataset.act === 'q') runQuick(b.dataset.q);
      else if (b.dataset.act === 'gomissao') UI.go('missao');
    };
    UI.$('#v-operacao').onkeydown = e => {
      if (e.target.id === 'opIn' && e.key === 'Enter' && e.target.value.trim()) ask(e.target.value.trim());
    };
  }

  UI.renderers.operacao = paint;

  /* ---------- auto-teste (?opself=1) ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('opself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('operacao');
      ask('Quantos leads chegaram hoje?');
      need(OP.log.length >= 2 && OP.log[OP.log.length - 1].kind === 'h', 'chat responde');
      OP.produto = 'p7'; OP.mkt = 'tiktok';
      const nDrafts = CATALOGO.drafts.length;
      runQuick('criar_anuncio');
      need(CATALOGO.drafts.length === nDrafts + 1, 'ação rápida cria rascunho real');
      need(UI.state.audit.some(a => a.acao === 'draft_criado'), 'rascunho auditado');
      runQuick('whatsapp');
      need(OP.log[OP.log.length - 1].html.includes('AGUARDANDO CONEXÃO'), 'whatsapp honesto');
      document.body.dataset.opselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.opselfReady = 'fail: ' + e.message; }
  });
}());
