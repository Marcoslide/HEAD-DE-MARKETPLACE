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

  /* 10.P.3 — card estratégico (oportunidade/risco): título, motivo, fonte e
     ações (abrir detalhe · criar missão). Só mostra o que existe — sem inventar impacto. */
  function estrat(sig, it) {
    return `<div class="exec-li"><span class="sig ${sig}"></span>
      <div class="t"><b>${UI.esc(it.txt)}</b><span>${UI.esc(it.motivo)}${it.fonte ? ' · fonte: ' + UI.esc(it.fonte) : ''}</span></div>
      <div style="display:flex;gap:8px;flex:none">
        ${it.acao ? `<button class="linklike" data-act="open" data-ref="${it.acao}">abrir →</button>` : ''}
        <button class="linklike" data-act="open" data-ref="missao:" title="Transformar em missão de execução">criar missão →</button>
      </div></div>`;
  }

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
    const missoesExec = D.missoes.filter(m => m.status !== D.STATUS.AGUARDANDO_APROVACAO).slice(0, 4);
    const jobsCriticos = st.jobs.filter(j => j.status !== 'CONCLUÍDO (interno)');
    const audit = st.audit.slice(-6).reverse();
    const ticket = ped ? UI.brl(fat / ped) : '—';

    /* 10.P.3 — blocos estratégicos (máx. 3 cada), montados a partir do que existe */
    const oportunidades = [
      { txt: H.oportunidade.txt, motivo: 'maior oportunidade', fonte: D.STATUS.DADO_SIMULADO, acao: H.oportunidade.acao },
      ...H.melhorou.slice(0, 2).map(m => ({ txt: m.txt, motivo: 'melhorou', fonte: m.fonte, acao: m.acao })),
    ].slice(0, 3);
    const riscos = [
      { txt: H.risco.txt, motivo: 'maior risco', fonte: D.STATUS.DADO_SIMULADO, acao: H.risco.acao, nivel: 'neg' },
      ...H.operacoesEmRisco.map(o => ({ txt: o.txt, motivo: 'risco operacional', fonte: D.STATUS.DADO_SIMULADO, acao: o.ref, nivel: o.nivel || 'neg' })),
      ...H.piorou.map(m => ({ txt: m.txt, motivo: 'piorou', fonte: m.fonte, acao: m.acao, nivel: 'neg' })),
    ].slice(0, 3);

    UI.$('#v-home').innerHTML = `
      <div class="eyebrow">mesa estratégica da operação · ${UI.esc(D.meta.hoje)} · ${UI.esc(perLbl).toLowerCase()} · America/Sao_Paulo</div>
      <h1 class="h1">Mesa Estratégica</h1>
      <p class="voice" style="margin-top:6px;max-width:76ch">${UI.esc(H.resumo)}</p>

      <!-- BLOCO 1: RESULTADO DA OPERAÇÃO -->
      <div class="sect-h"><span class="h2">Resultado da operação · ${UI.esc(perLbl).toLowerCase()}</span>
        <span class="src" title="Lojas: ${UI.esc(lojasComDado.join(' · ') || 'nenhuma')}${lojasSemDado.length ? ' — SEM DADOS: ' + UI.esc(lojasSemDado.join(' · ')) : ''}">${lojasComDado.length} loja(s) · ${scopeDesc.cnpjs.length} CNPJ(s) · fonte: ${UI.esc(D.STATUS.DADO_SIMULADO)}${lojasSemDado.length ? ` · ${lojasSemDado.length} SEM DADOS fora da soma` : ''}</span></div>
      <div class="statusline">
        <div class="sl"><span class="k">faturamento aprovado</span><span class="v">${UI.brl(fat)}</span>
          <button data-act="open" data-ref="custos:">lucratividade →</button></div>
        <div class="sl"><span class="k">pedidos pagos</span><span class="v">${ped - npg}</span></div>
        <div class="sl"><span class="k">ticket médio</span><span class="v">${ticket}</span></div>
        <div class="sl"><span class="k">pedidos não pagos</span><span class="v neg">${npg}</span>${un ? ` <span class="delta down">${un.taxaNaoPago}%</span>` : ''}
          <button data-act="open" data-ref="crescimento:naopagos">ver perda →</button></div>
        <div class="sl"><span class="k">status geral</span><span class="v warn">${UI.esc(H.statusGeral)}</span></div>
        <div class="sl"><span class="k">margem / lucro</span><span class="v">estimado</span>
          <button data-act="open" data-ref="custos:" title="Cálculo com fórmula e fonte no Centro de Lucratividade">ponto de equilíbrio →</button></div>
      </div>

      <div class="cockpit">
        <!-- BLOCO 2 e 3: OPORTUNIDADE E RISCO -->
        <div class="panel">
          <div class="sect-h" style="margin-top:0"><span class="h2">Maior oportunidade de crescimento</span><span class="src">máx. 3 · onde vender mais</span></div>
          ${oportunidades.map(o => estrat('pos', o)).join('') || '<div class="empty">Sem oportunidade priorizada no período.</div>'}
          <div class="sect-h"><span class="h2">Maior perda ou risco</span><span class="src">máx. 3 · onde perde dinheiro</span></div>
          ${riscos.map(r => estrat(r.nivel || 'neg', r)).join('') || '<div class="empty">Sem risco priorizado no período.</div>'}
          <div class="sect-h"><span class="h2">Performance por loja</span><span class="src">por faturamento</span></div>
          ${porLoja.length ? porLoja.slice(0, 4).map((x, i) => `<div class="metric-row"><span class="lbl">${i + 1}º <button class="linklike" data-act="focoloja" data-loja="${x.lid}">${UI.esc(x.nome)}</button></span>
            <span class="val">${UI.brl(x.k.faturamento)}${x.k.deltaFaturamento != null ? ` <span class="delta ${x.k.deltaFaturamento >= 0 ? 'up' : 'down'}">${x.k.deltaFaturamento >= 0 ? '+' : ''}${x.k.deltaFaturamento}%</span>` : ''}</span></div>`).join('') : '<div class="empty">Sem dado de loja no recorte.</div>'}
        </div>

        <!-- BLOCO 4 e 5: DECISÕES E MISSÕES -->
        <div class="panel">
          <div class="sect-h" style="margin-top:0"><span class="h2">Decisões pendentes</span><span class="src">${decisoes.length} aguardando você</span></div>
          ${decisoes.length ? decisoes.map(d => `<div class="exec-li"><span class="sig warn"></span>
            <div class="t"><b>${UI.esc(d.titulo)}</b><span>${UI.esc(d.origem || 'decisão')} · ${UI.esc(d.status)}${d.reversivel ? ' · reversível' : ''}</span></div>
            <button class="linklike" data-act="open" data-ref="missao:${d.id}">decidir →</button></div>`).join('')
            : '<div class="exec-li"><span class="sig pos"></span><div class="t"><b>Nada aguardando decisão.</b><span>as decisões aparecem aqui com contexto, impacto e recomendação</span></div></div>'}
          <div class="sect-h"><span class="h2">Missões em execução</span><span class="src">o que a equipe faz agora</span></div>
          ${missoesExec.length ? missoesExec.map(m => `<div class="exec-li"><span class="sig ${m.status === D.STATUS.EM_REVISAO ? 'warn' : ''}"></span>
            <div class="t"><b>${UI.esc(m.titulo)}</b><span>${UI.esc(m.origem || 'missão')} · ${UI.esc(m.agora || m.status)}</span></div>
            <button class="linklike" data-act="open" data-ref="missao:${m.id}">acompanhar →</button></div>`).join('')
            : '<div class="exec-li"><span class="sig"></span><div class="t"><b>Nenhuma missão em execução.</b><span>missões nascem de insight, decisão, rotina ou comando</span></div></div>'}
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
          <div class="ctxcard"><div class="h"><b>Dados e importação</b><span class="src">qualidade e cobertura</span></div>
            ${(window.IMPORTAR && V8IMP.coverage(IMPORTAR.eng).length)
              ? V8IMP.coverage(IMPORTAR.eng).map(c => `<div class="ctxitem"><span>última importação · ${UI.esc((D.scope.lojas.find(s => s.id === c.lojaId) || {}).nome)}</span><span class="src">${c.ultima} · ${c.fontes.length} fonte(s) · ${c.conflitos ? c.conflitos + ' conflito(s)!' : 'sem conflito'}</span></div>`).join('')
              : '<div class="ctxitem"><span class="src">nenhuma importação aplicada — sem última importação a mostrar</span></div>'}
            ${(() => { /* 10.E.2.2 — base real ativa: dado importado substitui indicador demo equivalente */
              if (!window.IMPORTAR || !window.V8IMP.coberturaReal) return '';
              const cr = V8IMP.coberturaReal(IMPORTAR.eng);
              if (!cr.algum) return '';
              const st = V8IMP.orderStats(IMPORTAR.eng, {});
              const imp = V8IMP.lastImpact(IMPORTAR.eng);
              return `<div class="ctxitem"><span><span class="st pos plain">BASE REAL ATIVA</span> ${st.semDados ? '' : UI.brl(st.kpis.faturamentoAprovado) + ' · ' + st.kpis.pedidos + ' pedido(s) importado(s)'}</span>
                <span class="src">indicadores demo equivalentes desativados</span></div>
                ${imp ? `<div class="ctxitem"><span>o que mudou: ${imp.insightsNovos.length} insight(s) novo(s)</span><button class="linklike" data-act="open" data-ref="crescimento:">ver na Mesa →</button></div>` : ''}`;
            })()}
            <div class="ctxitem"><span class="src">sem fonte real: ${UI.esc(D.STATUS.DADO_SIMULADO)} rotulado</span><button class="linklike" data-act="open" data-ref="importar:">importar →</button></div>
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
