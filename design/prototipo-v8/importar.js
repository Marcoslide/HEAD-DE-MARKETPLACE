/* =============================================================
   v8 · IMPORTAR E SINCRONIZAR (10.I)
   Fluxo: origem → destino → escopo → arquivo → detecção → prévia
   e conciliação → staging → confirmação humana → job auditável.
   Nada é aplicado sem mostrar impacto. Nada soma duas vezes.
   Nunca publica nem altera nada fora do sistema.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA, L = V8LOGIC;
  const IM = window.IMPORTAR = {
    eng: V8IMP.createEngine(), sub: 'Nova importação',
    fluxo: { origem: 'Planilha', destino: 'Performance', lojaId: 's1', arquivo: null, batch: null },
  };
  const SUBS = ['Nova importação', 'Lotes e jobs', 'Vínculos SKU', 'Anúncio Master', 'Perfis de importação'];
  /* arquivos de exemplo (fixtures rotuladas) — sem upload real neste modo */
  const ARQS = [
    ['productTraffic', 'producttraffic_Product_Card.xlsx · performance por anúncio'],
    ['salesOverview', 'salesoverview_junho.xlsx · funil diário de vendas'],
    ['parentSku', 'mass_update_parent_sku.xlsx · catálogo/SKU'],
    ['promotion', 'promotionoverview.xlsx · promoções'],
    ['voucher', 'voucherreport.xlsx · cupons'],
    ['channelContribution', 'channel_contribution.xlsx · contribuição por canal'],
    ['desconhecido', 'relatorio_misterioso.xlsx · formato não mapeado'],
  ];
  const PER = { ini: '2026-06-04', fim: '2026-07-03' };
  const buildFile = key => key === 'salesOverview'
    ? V8IMP.FIXTURES.salesOverview({ ini: '2026-06-01', fim: '2026-06-30' }, ['2026-06-10', '2026-06-15', '2026-06-20'])
    : key === 'parentSku' || key === 'desconhecido' ? V8IMP.FIXTURES[key]() : V8IMP.FIXTURES[key](PER);
  const escopoAtual = () => {
    const loja = D.scope.lojas.find(s => s.id === IM.fluxo.lojaId);
    const cnpj = D.scope.cnpjs.find(c => c.id === loja.cnpjId);
    const conta = D.scope.contas.find(a => a.lojaId === loja.id);
    return { groupId: 'g1', companyId: cnpj ? cnpj.empresaId : UI.ctx.empresa, cnpjId: loja.cnpjId, lojaId: loja.id, contaId: conta ? conta.id : 'sem-conta', marketplace: loja.marketplace || 'shopee' };
  };

  function render(sub) {
    if (sub && SUBS.includes(sub)) IM.sub = sub;
    UI.$('#v-importar').innerHTML = `
      <div class="eyebrow">importar e sincronizar · porta de entrada de dados reais</div>
      <h1 class="h1">Importar e Sincronizar</h1>
      <p class="sub" style="margin-top:6px"><b>Importação não soma dados — concilia, atualiza, versiona e explica.</b> Cada arquivo é detectado, vinculado por SKU, conciliado contra o que já existe e aplicado só depois da sua confirmação.</p>
      <div class="tabs" style="margin-top:14px">${SUBS.map(s => `<button class="tab ${s === IM.sub ? 'on' : ''}" data-act="sub" data-sub="${s}">${s}${s === 'Lotes e jobs' ? `<span class="cnt">${IM.eng.batches.length}</span>` : s === 'Vínculos SKU' ? `<span class="cnt">${IM.eng.observations.length}</span>` : ''}</button>`).join('')}</div>
      <div id="impBody" style="margin-top:14px"></div>`;
    body();
    UI.$('#v-importar').onclick = onClick;
  }

  function body() {
    const el = UI.$('#impBody');
    if (IM.sub === 'Nova importação') el.innerHTML = nova();
    else if (IM.sub === 'Lotes e jobs') el.innerHTML = lotes();
    else if (IM.sub === 'Vínculos SKU') el.innerHTML = vinculos();
    else if (IM.sub === 'Anúncio Master') el.innerHTML = master();
    else el.innerHTML = perfis();
  }

  /* ---------------- nova importação (fluxo) ---------------- */
  function nova() {
    const f = IM.fluxo;
    const lojas = D.scope.lojas.filter(s => s.cnpjId !== 'c9');
    const pick = (label, opts, sel, act) => `<label style="display:block;margin-top:8px"><span class="eyebrow">${label}</span><br>
      <select class="select" data-act="${act}" style="width:100%;margin-top:3px">${opts.map(([v, l]) => `<option value="${v}" ${sel === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
    let previa = '';
    if (f.batch) {
      const b = f.batch, p = b.preview;
      previa = b.duplicado ? `<div class="err-state" style="margin-top:12px"><b>ARQUIVO JÁ IMPORTADO</b> — ${UI.esc(b.motivo)}</div>`
        : !p.aplicavel ? `<div class="callout" style="margin-top:12px;border-left-color:var(--warn)"><b>${UI.esc(p.perfil)}</b> · ${UI.esc(p.motivo || 'aguardando mapeamento manual')} ${b.estado === 'AGUARDANDO_MAPEAMENTO' ? '· este arquivo NÃO será aplicado sem mapeamento' : ''}</div>`
        : `<div class="panel" style="margin-top:12px">
          <div class="sect-h" style="margin-top:0"><span class="h2">Prévia e conciliação</span>${UI.stBadge(b.estado)}</div>
          <dl class="kv">
            <dt>Arquivo</dt><dd>${UI.esc(b.arquivo)} <span class="src">(${b.fp.file_hash})</span></dd>
            <dt>Tipo identificado</dt><dd>${UI.esc(p.perfil)} · confiança ${p.confianca ?? b.det.confianca}</dd>
            <dt>Marketplace · escopo</dt><dd>${UI.esc(p.marketplace)} · loja ${UI.esc((D.scope.lojas.find(s => s.id === b.escopo.lojaId) || {}).nome)} · conta ${UI.esc(b.escopo.contaId)}</dd>
            <dt>Período</dt><dd>${p.periodo ? p.periodo.ini + ' a ' + p.periodo.fim : 'não declarado'}</dd>
            <dt>Granularidade</dt><dd><span class="kbd">${p.granularidade}</span></dd>
            <dt>Registros</dt><dd>${p.registros}</dd>
            <dt>Vínculos por ID · por SKU</dt><dd>${p.vinculosPorId} · ${p.vinculosPorSku}</dd>
            <dt>Sugeridos por nome</dt><dd>${p.sugeridosPorNome} <span class="src">(baixa confiança — não vinculam sozinhos)</span></dd>
            <dt>Pendentes de revisão</dt><dd>${p.pendentesRevisao}</dd>
            <dt>Conflitos</dt><dd>${p.conflitos ? `<span class="st neg">${p.conflitos}</span>` : '0'}</dd>
            <dt>Já existentes</dt><dd>${p.jaExistem} <span class="src">(serão atualizados/ignorados — nunca somados)</span></dd>
            ${p.sobreposicao ? `<dt>Sobreposição</dt><dd><span class="st warn plain">${UI.esc(p.sobreposicao.aviso)}</span>${p.sobreposicao.intervaloSobreposto ? `<span class="tsub">intervalo sobreposto: ${p.sobreposicao.intervaloSobreposto.ini} a ${p.sobreposicao.intervaloSobreposto.fim}</span>` : ''}</dd>` : ''}
          </dl>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn primary sm" data-act="aplicar" data-id="${b.id}">Confirmar e aplicar (job auditável)</button>
            <button class="btn sm" data-act="sub" data-sub="Vínculos SKU">Revisar conflitos e vínculos</button>
            <button class="btn sm ghost" data-act="cancelar" data-id="${b.id}">Cancelar</button>
          </div>
          <p class="src" style="margin-top:8px">Nunca aplicamos automaticamente: você vê o impacto antes. Duplicados são evitados por chave natural + fingerprint.</p>
        </div>`;
    }
    return `
      <div class="grid2">
        <div class="panel">
          <div class="sect-h" style="margin-top:0"><span class="h2">1 · Origem, destino e escopo</span></div>
          ${pick('Origem', [['Planilha', 'Planilha (Shopee, ML, TikTok, Magalu)'], ['CSV', 'CSV customizado'], ['API', 'Marketplace conectado (futuro — leitura oficial)'], ['Manual', 'Importação manual']], f.origem, 'origem')}
          ${pick('Destino', [['Catálogo e anúncios', 'Catálogo e anúncios'], ['Performance', 'Performance'], ['Vendas e funil', 'Vendas e funil'], ['Promoções', 'Promoções'], ['Cupons', 'Cupons'], ['Atendimento', 'Atendimento'], ['Financeiro complementar', 'Financeiro complementar']], f.destino, 'destino')}
          ${pick('Loja / conta (escopo)', lojas.map(s => [s.id, s.nome + ' · ' + (D.scope.cnpjs.find(c => c.id === s.cnpjId) || {}).nome]), f.lojaId, 'loja')}
          <div class="sect-h"><span class="h2">2 · Arquivo</span><span class="src">exemplos rotulados — sem upload real neste modo</span></div>
          <div style="display:grid;gap:6px">${ARQS.map(([k, l]) => `<button class="obpick-btn fchip ${f.arquivo === k ? 'on' : ''}" style="text-align:left" data-act="arq" data-k="${k}">▤ ${l}</button>`).join('')}</div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn primary sm" data-act="detectar" ${f.arquivo ? '' : 'disabled title="Escolha um arquivo de exemplo primeiro."'}>3 · Enviar e detectar</button>
          </div>
        </div>
        <div>
          <div class="callout">O motor detecta <b>tipo de relatório, marketplace, período, granularidade e chaves</b> pela assinatura do cabeçalho — perfis configuráveis, nunca hardcode de uma empresa. Relatório agregado gera <span class="kbd">METRIC_SNAPSHOT</span>, nunca pedido individual.</div>
          <div class="ctxcard" style="margin-top:12px"><div class="h"><b>Cobertura atual</b><span class="src">por loja/conta</span></div>
            ${V8IMP.coverage(IM.eng).map(c => `<div class="ctxitem"><span>${UI.esc((D.scope.lojas.find(s => s.id === c.lojaId) || {}).nome)} · ${c.fontes.length} fonte(s)</span><span class="src">${c.ultima} · ${c.linhas} linha(s) · ${c.duplicadosEvitados} duplicado(s) evitado(s)</span></div>`).join('') || '<div class="ctxitem"><span class="src">nenhuma importação aplicada ainda</span></div>'}
          </div>
        </div>
      </div>
      ${previa}`;
  }

  /* ---------------- lotes e jobs ---------------- */
  function lotes() {
    if (!IM.eng.batches.length) return `<div class="panel"><div class="empty"><b>Nenhum lote</b>Toda importação vira job com origem, escopo, perfil, contagens e rollback.</div></div>`;
    return `<div class="tblwrap"><table class="tbl"><thead><tr>
      <th class="nosort">Lote</th><th class="nosort">Perfil</th><th class="nosort">Escopo</th><th class="nosort">Período</th><th class="nosort">Estado</th><th class="nosort">Resultado</th><th class="nosort"></th></tr></thead><tbody>
      ${IM.eng.batches.slice().reverse().map(b => `<tr>
        <td><span class="tmain">${b.id}</span><span class="tsub">${UI.esc(b.arquivo)} · ${UI.esc(b.enviadoPor)}</span></td>
        <td><span class="kbd">${b.det.perfil}</span><span class="tsub">mapper ${b.mappingVersion}</span></td>
        <td><span class="src">${UI.esc((D.scope.lojas.find(s => s.id === b.escopo.lojaId) || {}).nome || b.escopo.lojaId)} · ${b.escopo.contaId}</span></td>
        <td><span class="src">${b.periodo ? b.periodo.ini + '→' + b.periodo.fim : '—'}</span></td>
        <td>${UI.stBadge(b.estado)}</td>
        <td><span class="src">${b.aplicado ? `${b.aplicado.criados} criado(s) · ${b.aplicado.atualizados} atualizado(s) · ${b.aplicado.duplicadosEvitados} duplicado(s) evitado(s) · ${b.aplicado.conflitos} conflito(s)` : '—'}</span></td>
        <td><span class="rowact">${b.aplicado && b.estado !== 'REVERTIDO' ? `<button class="btn sm danger" data-act="rollback" data-id="${b.id}">rollback</button>` : ''}</span></td>
      </tr>`).join('')}
      </tbody></table><div class="tfoot"><span>rollback remove só os efeitos do lote; versões posteriores são preservadas</span></div></div>`;
  }

  /* ---------------- vínculos SKU ---------------- */
  function vinculos() {
    const obs = IM.eng.observations;
    if (!obs.length) return `<div class="panel"><div class="empty"><b>Nenhum listing observado</b>Importe catálogo ou performance para ver anúncios vinculados por SKU.</div></div>`;
    return `
      ${IM.eng.conflicts.filter(c => c.estado !== 'RESOLVIDO').length ? `<div class="err-state" style="margin-bottom:10px">${IM.eng.conflicts.filter(c => c.estado !== 'RESOLVIDO').length} conflito(s) de SKU aguardando revisão humana — nada foi vinculado automaticamente.</div>` : ''}
      <div class="tblwrap"><table class="tbl"><thead><tr>
      <th class="nosort">Anúncio observado</th><th class="nosort">SKU pai · variação</th><th class="nosort">Vínculo</th><th class="nosort">Product Master</th><th class="nosort">Vendas pagas</th><th class="nosort">Origem</th><th class="nosort"></th></tr></thead><tbody>
      ${obs.map(o => {
        const p = o.produtoId ? UI.state.products.find(x => x.id === o.produtoId) : null;
        const kind = /CONFIRMADO/.test(o.vinculo) ? 'pos' : /SUGERIDO/.test(o.vinculo) ? 'warn' : 'neg';
        return `<tr>
          <td><span class="tmain">${UI.esc(o.nome)}</span><span class="tsub">item ${o.item_id} · ${UI.esc(o.contaId)}</span></td>
          <td><span class="src">${o.skuPai || '—'} · ${o.skuVariacao || '—'}</span></td>
          <td><span class="st ${kind} plain">${UI.esc(o.vinculo)}</span></td>
          <td>${p ? `<button class="linklike" data-act="prod" data-id="${p.id}">${UI.esc(p.sku)}</button>` : '<span class="src">sem correspondência — candidato a novo master</span>'}</td>
          <td>${UI.brl(o.vendasPagas)}</td>
          <td><span class="src">${UI.esc(o.origem)}</span></td>
          <td><span class="rowact">${/SUGERIDO/.test(o.vinculo) && o.produtoId ? `
            <button class="btn sm" data-act="confirmar" data-id="${o.id}">confirmar vínculo</button>
            <button class="btn sm ghost" data-act="rejeitar" data-id="${o.id}">rejeitar</button>` : ''}</span></td>
        </tr>`;
      }).join('')}
      </tbody></table><div class="tfoot"><span>${obs.length} listing(s) · ordem de vínculo: ID → SKU variação → SKU pai → nome (só sugestão)</span></div></div>`;
  }

  /* ---------------- anúncio master ---------------- */
  function master() {
    const porProduto = {};
    for (const o of IM.eng.observations.filter(x => x.produtoId && /CONFIRMADO/.test(x.vinculo)))
      (porProduto[o.produtoId] = porProduto[o.produtoId] || []).push(o);
    const ids = Object.keys(porProduto);
    if (!ids.length) return `<div class="panel"><div class="empty"><b>Nenhum produto com anúncios vinculados</b>Confirme vínculos de SKU primeiro — o master exige vínculo confiável.</div></div>`;
    return `
      <div class="callout" style="margin-top:0">O Anúncio Master é <b>referência estratégica</b> (maior venda paga validada + saúde operacional). Ele <b>não sobrescreve</b> preço, estoque, título ou logística de nenhuma loja — pode apenas inspirar adaptação.</div>
      ${ids.map(pid => {
        const p = UI.state.products.find(x => x.id === pid);
        const sug = V8IMP.suggestMaster(IM.eng, pid);
        const link = IM.eng.masterLinks.find(l => l.produtoId === pid);
        return `<div class="ctxcard" style="margin-top:10px">
          <div class="h"><b>${UI.esc(p ? p.nome : pid)}</b><span class="st ${sug.estado === 'MASTER CONFIRMADO MANUALMENTE' ? 'pos' : sug.estado === 'MASTER BLOQUEADO POR CONFLITO' ? 'neg' : 'info'} plain">${UI.esc(sug.estado)}</span></div>
          ${(sug.ranking || []).map((r, i) => `<div class="ctxitem">
            <span>${i + 1}º · item ${r.item_id} ${link && link.itemId === r.item_id ? '<span class="st pos plain">MASTER</span>' : ''}</span>
            <span>${UI.brl(r.vendasPagas)} · conv ${r.conversao ?? '—'}% · CTR ${r.ctr ?? '—'}%
              <button class="linklike" data-act="aprovarMaster" data-pid="${pid}" data-item="${r.item_id}">definir como master</button></span></div>`).join('')}
          ${sug.motivo ? `<p class="src" style="margin-top:6px">${UI.esc(sug.motivo)}</p>` : ''}
        </div>`;
      }).join('')}`;
  }

  /* ---------------- perfis ---------------- */
  function perfis() {
    return `<div class="tblwrap"><table class="tbl"><thead><tr>
      <th class="nosort">Perfil</th><th class="nosort">Status</th><th class="nosort">Marketplace</th><th class="nosort">Granularidade</th><th class="nosort">Destino</th><th class="nosort">Assinatura (colunas-chave)</th></tr></thead><tbody>
      ${Object.entries(V8IMP.PROFILES).map(([nome, p]) => `<tr>
        <td><span class="kbd">${nome}</span></td>
        <td>${p.status === 'SUPPORTED' ? '<span class="st pos">SUPPORTED</span>' : p.status === 'PARTIALLY_SUPPORTED' ? '<span class="st warn">PARTIALLY</span>' : `<span class="st plain">${p.status}</span>`}</td>
        <td>${p.marketplace || '—'}</td><td><span class="src">${p.gran || 'custom'}</span></td><td>${p.destino}</td>
        <td><span class="src">${p.assinatura.slice(0, 3).join(' · ') || 'mapeamento manual'}</span></td>
      </tr>`).join('')}
      </tbody></table><div class="tfoot"><span>REFERENCE_ONLY nunca finge importar — o sistema declara o que ainda não entende</span></div></div>`;
  }

  /* ---------------- eventos ---------------- */
  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'sub') { IM.sub = b.dataset.sub; UI.$('#crumb').textContent = 'Importar · ' + IM.sub; render(IM.sub); }
    else if (act === 'arq') { IM.fluxo.arquivo = b.dataset.k; IM.fluxo.batch = null; body(); }
    else if (act === 'origem' || act === 'destino') { /* selects tratados no onchange */ }
    else if (act === 'detectar') {
      const file = buildFile(IM.fluxo.arquivo);
      IM.fluxo.batch = V8IMP.stage(IM.eng, file, escopoAtual(), { products: UI.state.products, usuario: D.meta.usuario });
      if (!IM.fluxo.batch.duplicado) UI.toast(`Detectado: ${IM.fluxo.batch.det.perfil} · ${IM.fluxo.batch.estado}`, IM.fluxo.batch.estado === 'CONFLITO_ENCONTRADO' ? 'err' : 'ok');
      body();
    }
    else if (act === 'aplicar') {
      const papel = (UI.account && UI.account.user.papel) || 'OWNER';
      const r = V8IMP.apply(IM.eng, b.dataset.id, { papel, usuario: D.meta.usuario });
      if (r.blocked) return UI.toast(r.reason, 'err');
      L._audit(UI.state, D.meta.usuario, 'import_aplicado', `${r.job.id} · ${r.job.det.perfil} · ${r.job.aplicado.criados} criado(s), ${r.job.aplicado.duplicadosEvitados} duplicado(s) evitado(s)`);
      UI.toast(`Lote ${r.job.id} ${r.job.estado}: ${r.job.aplicado.criados} criado(s), ${r.job.aplicado.atualizados} atualizado(s), ${r.job.aplicado.duplicadosEvitados} duplicado(s) evitado(s).`, 'ok');
      IM.fluxo.batch = null; IM.sub = 'Lotes e jobs'; render(IM.sub); UI.refreshBadges();
    }
    else if (act === 'cancelar') { const bt = IM.eng.batches.find(x => x.id === b.dataset.id); if (bt) bt.estado = 'CANCELADO'; IM.fluxo.batch = null; body(); }
    else if (act === 'rollback') {
      const r = V8IMP.rollback(IM.eng, b.dataset.id, { papel: (UI.account && UI.account.user.papel) || 'OWNER', usuario: D.meta.usuario });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.toast(`Rollback: ${r.removidos} removido(s), ${r.restaurados} restaurado(s), ${r.preservados} posterior(es) preservado(s).`, 'ok');
      body();
    }
    else if (act === 'confirmar') {
      const o = IM.eng.observations.find(x => x.id === b.dataset.id);
      o.vinculo = 'VÍNCULO CONFIRMADO POR SKU';
      V8IMP.hash && L._audit(UI.state, D.meta.usuario, 'vinculo_confirmado', `item ${o.item_id} → ${o.produtoId} (humano)`);
      UI.toast('Vínculo confirmado por revisão humana — auditado.', 'ok'); body();
    }
    else if (act === 'rejeitar') {
      const o = IM.eng.observations.find(x => x.id === b.dataset.id);
      o.produtoId = null; o.vinculo = 'SEM CORRESPONDÊNCIA';
      UI.toast('Sugestão rejeitada — item volta para a fila de candidatos.', ''); body();
    }
    else if (act === 'aprovarMaster') {
      const r = V8IMP.approveMaster(IM.eng, b.dataset.pid, b.dataset.item, { papel: (UI.account && UI.account.user.papel) || 'OWNER', usuario: D.meta.usuario });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.toast('Anúncio Master confirmado manualmente. ' + r.nota, 'ok'); body();
    }
    else if (act === 'prod') UI.open('catalogo:' + b.dataset.id);
  }
  UI.$('#v-importar') && (UI.$('#v-importar').onchange = e => {
    const s = e.target.closest('[data-act]');
    if (!s) return;
    if (s.dataset.act === 'loja') { IM.fluxo.lojaId = s.value; IM.fluxo.batch = null; body(); }
    else if (s.dataset.act === 'origem') IM.fluxo.origem = s.value;
    else if (s.dataset.act === 'destino') IM.fluxo.destino = s.value;
  });

  UI.renderers.importar = render;
  document.addEventListener('DOMContentLoaded', () => {
    const v = UI.$('#v-importar');
    if (v) v.addEventListener('change', e => {
      const s = e.target.closest('[data-act]');
      if (!s) return;
      if (s.dataset.act === 'loja') { IM.fluxo.lojaId = s.value; IM.fluxo.batch = null; body(); }
      else if (s.dataset.act === 'origem') IM.fluxo.origem = s.value;
      else if (s.dataset.act === 'destino') IM.fluxo.destino = s.value;
    });

    /* ---------- auto-teste (?impself=1) ---------- */
    if (new URLSearchParams(location.search).get('impself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('importar');
      /* fluxo completo: detectar → prévia → aplicar */
      IM.fluxo.arquivo = 'productTraffic'; body();
      UI.$('[data-act="detectar"]').click();
      need(IM.fluxo.batch && IM.fluxo.batch.det.perfil === 'SHOPEE_PRODUCT_TRAFFIC', 'detecção na tela');
      need(UI.$('#impBody').textContent.includes('Prévia e conciliação'), 'prévia visível antes de aplicar');
      UI.$('[data-act="aplicar"]').click();
      need(IM.eng.batches[0].estado.startsWith('APLICADO'), 'aplicação vira job');
      /* duplicado recusado na tela */
      IM.sub = 'Nova importação'; body();
      IM.fluxo.arquivo = 'productTraffic'; body();
      UI.$('[data-act="detectar"]').click();
      need(UI.$('#impBody').textContent.includes('ARQUIVO JÁ IMPORTADO'), 'duplicidade de arquivo na tela');
      /* desconhecido bloqueado */
      IM.fluxo.arquivo = 'desconhecido'; IM.fluxo.batch = null; body();
      UI.$('[data-act="detectar"]').click();
      need(UI.$('#impBody').textContent.includes('NÃO será aplicado sem mapeamento'), 'desconhecido não aplica');
      /* vínculos e master */
      IM.sub = 'Vínculos SKU'; body();
      need(UI.$$('#impBody tbody tr').length >= 4, 'listings observados');
      need(UI.$('#impBody').textContent.includes('VÍNCULO CONFIRMADO POR SKU'), 'vínculo por SKU na tela');
      IM.sub = 'Anúncio Master'; body();
      need(UI.$('#impBody').textContent.includes('MASTER'), 'tela de master');
      IM.sub = 'Perfis de importação'; body();
      need(UI.$('#impBody').textContent.includes('REFERENCE_ONLY'), 'perfis com status honesto');
      IM.sub = 'Nova importação'; IM.fluxo.batch = null; body();
      document.body.dataset.impselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e2) { document.body.dataset.impselfReady = 'fail: ' + e2.message; }
  });
}());
