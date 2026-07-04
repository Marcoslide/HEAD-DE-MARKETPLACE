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
    /* performance agregada POR LOJA do escopo ativo — agregação sempre
       transparente: quantas lojas/CNPJs entraram e quem ficou de fora */
    const scopeDesc = L.scopeDescribe(UI.ctx);
    const lojasScope = UI.ctx.loja ? [UI.ctx.loja] : scopeDesc.lojaIds;
    let fat = 0, ped = 0, npg = 0, lojasComDado = [], lojasSemDado = [];
    const porLoja = [];
    for (const lid of lojasScope) {
      const k = L.lojaKpis(lid, per === 'hoje' ? '7d' : per);
      const nome = (D.scope.lojas.find(s => s.id === lid) || {}).nome;
      if (!k) { lojasSemDado.push(nome); continue; }
      lojasComDado.push(nome); fat += k.faturamento; ped += k.pedidos; npg += k.naoPagos;
      porLoja.push({ lid, nome, k });
    }
    porLoja.sort((a, b) => b.k.faturamento - a.k.faturamento);
    const emQueda = [...porLoja].filter(x => x.k.deltaFaturamento != null).sort((a, b) => a.k.deltaFaturamento - b.k.deltaFaturamento)[0];
    const emAlta = [...porLoja].filter(x => x.k.deltaFaturamento != null).sort((a, b) => b.k.deltaFaturamento - a.k.deltaFaturamento)[0];
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
          <button data-act="open" data-ref="crescimento:" title="${lojasComDado.length} loja(s) com dado · ${UI.esc(D.STATUS.DADO_SIMULADO)}">performance →</button></div>
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

        <!-- CENTRO DIREITO: performance por escopo e risco operacional -->
        <div class="panel">
          <div class="sect-h" style="margin-top:0"><span class="h2">Performance · ${UI.esc(perLbl).toLowerCase()}</span>
            <button class="linklike" data-act="open" data-ref="crescimento:">detalhe →</button></div>
          <p class="src" style="margin-bottom:6px" title="Lojas incluídas: ${UI.esc(lojasComDado.join(' · ') || 'nenhuma')}${lojasSemDado.length ? ' — SEM DADOS: ' + UI.esc(lojasSemDado.join(' · ')) : ''}">
            consolidado de <b>${lojasComDado.length} loja(s)</b> · ${scopeDesc.cnpjs.length} CNPJ(s) · ${scopeDesc.contas.length} conta(s) · ${UI.esc(scopeDesc.origem)}${lojasSemDado.length ? ` · ${lojasSemDado.length} loja(s) SEM DADOS fora da soma` : ''}</p>
          ${mrow('Pedidos criados', ped)}
          ${mrow('Pedidos não pagos', `<span class="num crit" style="font-size:13px">${npg}</span>`, un ? ` <span class="delta down">${un.taxaNaoPago}%</span>` : '')}
          ${mrow('Faturamento', UI.brl(fat))}
          ${porLoja.length > 1 ? `
          <div class="sect-h"><span class="h2">Ranking de lojas</span><span class="src">por faturamento</span></div>
          ${porLoja.slice(0, 4).map((x, i) => `<div class="metric-row"><span class="lbl">${i + 1}º <button class="linklike" data-act="focoloja" data-loja="${x.lid}">${UI.esc(x.nome)}</button></span>
            <span class="val">${UI.brl(x.k.faturamento)}${x.k.deltaFaturamento != null ? ` <span class="delta ${x.k.deltaFaturamento >= 0 ? 'up' : 'down'}">${x.k.deltaFaturamento >= 0 ? '+' : ''}${x.k.deltaFaturamento}%</span>` : ''}</span></div>`).join('')}
          ${emQueda && emQueda.k.deltaFaturamento < 0 ? mrow('Loja em queda', `<span class="num crit" style="font-size:12.5px">${UI.esc(emQueda.nome)}</span>`, ` <span class="delta down">${emQueda.k.deltaFaturamento}%</span>`) : ''}
          ${emAlta && emAlta.k.deltaFaturamento > 0 ? mrow('Loja em crescimento', `<span class="num good" style="font-size:12.5px">${UI.esc(emAlta.nome)}</span>`, ` <span class="delta up">+${emAlta.k.deltaFaturamento}%</span>`) : ''}` : ''}
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
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'open') UI.open(b.dataset.ref);
      else if (b.dataset.act === 'focoloja') {
        const s = D.scope.lojas.find(x => x.id === b.dataset.loja);
        const c = D.scope.cnpjs.find(x => x.id === s.cnpjId);
        UI.ctx.empresa = c.empresaId; UI.ctx.cnpj = c.id; UI.setCtx('loja', s.id);
      }
    };
  }

  UI.renderers.home = render;
}());
