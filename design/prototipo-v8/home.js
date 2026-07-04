/* =============================================================
   v8 · HOME — cockpit executivo (10.UI.1)
   Não é relatório: é mesa de decisão. Topo = estado da operação;
   centro = risco/oportunidade e performance; lateral = atividade.
   Cada linha abre o detalhe correspondente.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA, L = V8LOGIC, H = D.home;

  function li(sig, b, s, ref, label) {
    return `<div class="exec-li"><span class="sig ${sig}"></span>
      <div class="t"><b>${UI.esc(b)}</b><span>${UI.esc(s)}</span></div>
      ${ref ? `<button class="linklike" data-act="open" data-ref="${ref}">${label || 'abrir'} →</button>` : ''}</div>`;
  }
  const mrow = (lbl, val, extra) => `<div class="metric-row"><span class="lbl">${lbl}</span><span class="val">${val}${extra || ''}</span></div>`;

  function render() {
    const st = UI.state;
    const per = UI.ctx.periodo;
    const perLbl = D.PERIODOS.find(p => p[0] === per)[1];
    /* performance agregada dos canais com dado no período ativo */
    let fat = 0, ped = 0, npg = 0, canaisComDado = 0;
    for (const mk of D.MKTS) {
      const k = L.perfKpis(mk.key, per);
      if (!k) continue;
      canaisComDado++; fat += k.faturamento; ped += k.pedidos; npg += k.naoPagos;
    }
    const un = L.unpaidStats(null, per === 'hoje' ? '7d' : per);
    const decisoes = D.missoes.filter(m => m.status === D.STATUS.AGUARDANDO_APROVACAO);
    const jobsCriticos = st.jobs.filter(j => j.status !== 'CONCLUÍDO (interno)');
    const audit = st.audit.slice(-6).reverse();

    UI.$('#v-home').innerHTML = `
      <div class="eyebrow">mesa executiva · ${UI.esc(D.meta.hoje)} · ${UI.esc(perLbl).toLowerCase()}</div>
      <h1 class="h1">Bom dia, ${UI.esc(D.meta.usuario)}.</h1>
      <p class="voice" style="margin-top:6px;max-width:76ch">${UI.esc(H.resumo)}</p>

      <!-- TOPO: estado da operação em uma linha -->
      <div class="statusline">
        <div class="sl"><span class="k">status geral</span><span class="v warn">${UI.esc(H.statusGeral)}</span></div>
        <div class="sl"><span class="k">marketplace em atenção</span><span class="v neg">${UI.esc(H.mktAtencao.nome)}</span>
          <button data-act="open" data-ref="crescimento:naopagos" title="${UI.esc(H.mktAtencao.motivo)}">ver motivo →</button></div>
        <div class="sl"><span class="k">prioridade do dia</span><span class="v" title="${UI.esc(H.prioridadeDoDia)}">${UI.esc(H.prioridadeDoDia)}</span></div>
        <div class="sl"><span class="k">decisões pendentes</span><span class="v ${decisoes.length ? 'warn' : 'pos'}">${decisoes.length}</span>
          ${decisoes.length ? `<button data-act="open" data-ref="missao:${decisoes[0].id}">decidir →</button>` : ''}</div>
        <div class="sl"><span class="k">jobs críticos</span><span class="v">${jobsCriticos.length}</span>
          <button data-act="open" data-ref="operacao:">mesa de comando →</button></div>
        <div class="sl"><span class="k">faturamento · ${UI.esc(perLbl).toLowerCase()}</span>
          <span class="v">${UI.brl(fat)}</span>
          <button data-act="open" data-ref="crescimento:" title="${canaisComDado} canais com dado · ${UI.esc(D.STATUS.DADO_SIMULADO)}">performance →</button></div>
      </div>

      <div class="cockpit">
        <!-- CENTRO ESQUERDO: risco, oportunidade, movimento, missão -->
        <div class="panel">
          <div class="sect-h" style="margin-top:0"><span class="h2">O que pede você agora</span></div>
          ${li('neg', H.risco.txt, 'risco principal', H.risco.acao, 'ver produto')}
          ${li('pos', H.oportunidade.txt, 'oportunidade principal', H.oportunidade.acao, 'abrir')}
          ${li('warn', H.decisaoPendente.txt, H.decisaoPendente.status, H.decisaoPendente.acao, 'decidir')}
          ${li('warn', H.missaoAndamento.txt, H.missaoAndamento.status, H.missaoAndamento.acao, 'acompanhar')}
          <div class="sect-h"><span class="h2">O que mudou desde ontem</span><span class="src">${UI.esc(D.STATUS.DADO_SIMULADO)}</span></div>
          ${H.melhorou.map(m => li('pos', m.txt, 'melhorou · ' + m.fonte, m.acao, 'abrir')).join('')}
          ${H.piorou.map(m => li('neg', m.txt, 'piorou · ' + m.fonte, m.acao, 'abrir')).join('')}
        </div>

        <!-- CENTRO DIREITO: performance e risco operacional -->
        <div class="panel">
          <div class="sect-h" style="margin-top:0"><span class="h2">Performance · ${UI.esc(perLbl).toLowerCase()}</span>
            <button class="linklike" data-act="open" data-ref="crescimento:">detalhe →</button></div>
          ${mrow('Pedidos criados', ped)}
          ${mrow('Pedidos não pagos', `<span class="num crit" style="font-size:13px">${npg}</span>`, un ? ` <span class="delta down">${un.taxaNaoPago}%</span>` : '')}
          ${mrow('Faturamento', UI.brl(fat))}
          ${mrow('Canais com dado', canaisComDado + ' de ' + D.MKTS.length, ` <span class="src">Magalu: ${UI.esc(D.STATUS.SEM_DADOS)}</span>`)}
          <div class="sect-h"><span class="h2">Operações em risco</span></div>
          ${H.operacoesEmRisco.map(o => li(o.nivel, o.txt, 'risco operacional', o.ref, 'abrir')).join('')}
          ${li('', H.intervencao.txt, H.intervencao.fonte, H.intervencao.acao, 'ver anúncio')}
        </div>

        <!-- LATERAL: atividade, pendências, próximos passos -->
        <aside class="rail" style="display:flex;flex-direction:column;gap:14px">
          <div class="ctxcard"><div class="h"><b>Respostas pendentes</b></div>
            ${H.respostasPendentes.map(r => `<div class="ctxitem"><span>${UI.esc(r.txt)}</span><button class="linklike" data-act="open" data-ref="${r.ref}">→</button></div>`).join('')}
          </div>
          <div class="ctxcard"><div class="h"><b>Status por marketplace</b><span class="src">0/4 conectados</span></div>
            ${D.conexoes.filter(c => c.key !== 'whatsapp').map(c => `<div class="ctxitem"><span>${UI.esc(c.nome)}</span>${UI.stBadge(c.status)}</div>`).join('')}
            <div class="ctxitem"><span class="src">escrita externa</span><button class="linklike" data-act="open" data-ref="conexoes:">conectar →</button></div>
          </div>
          <div class="ctxcard"><div class="h"><b>Atividade recente</b><span class="src">auditada</span></div>
            ${audit.length ? audit.map(a => `<div class="ctxitem"><span>${UI.esc(a.detalhe)}</span><span class="src">${UI.esc(a.actor)}</span></div>`).join('')
              : '<div class="ctxitem"><span class="src">nada ainda nesta sessão — cada edição, job e decisão aparece aqui com autor</span></div>'}
          </div>
          <div class="ctxcard"><div class="h"><b>Próximos passos</b></div>
            ${H.proximosPassos.map(p => `<div class="ctxitem"><span>${UI.esc(p.txt)}</span><button class="linklike" data-act="open" data-ref="${p.ref}">→</button></div>`).join('')}
          </div>
        </aside>
      </div>`;

    UI.$('#v-home').onclick = e => {
      const b = e.target.closest('[data-act="open"]');
      if (b) UI.open(b.dataset.ref);
    };
  }

  UI.renderers.home = render;
}());
