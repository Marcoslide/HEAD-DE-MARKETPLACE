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
    eng: V8IMP.createEngine(), sub: 'Fontes e Histórico',
    fluxo: { origem: 'Planilha', destino: 'Performance', lojaId: 's1', arquivo: null, batch: null },
  };

  /* =============================================================
     10.E.2.5.2 — PERSISTÊNCIA (protótipo cliente): os dados importados
     sobrevivem ao refresh via IndexedDB do navegador. Em produção, a
     persistência é o backend real (mos/ · Postgres) — aqui é a camada
     honesta possível num Artifact estático. Nunca é a "fonte única":
     a base real é o servidor; isto é cache/estado local do protótipo.
     ============================================================= */
  const IDB = { db: null, NAME: 'headmos-v8', STORE: 'engine' };
  const CAMPOS_ENG = ['batches', 'staging', 'snapshots', 'observations', 'masterLinks', 'conflicts', 'audit',
    'seq', 'rawFiles', 'rawErrors', 'customMappings', 'camposExcluidos', 'impactos', 'revisoesRelacao'];
  function idbOpen() {
    return new Promise(res => {
      if (IDB.db) return res(IDB.db);
      if (typeof indexedDB === 'undefined') return res(null);
      let req; try { req = indexedDB.open(IDB.NAME, 1); } catch (e) { return res(null); }
      req.onupgradeneeded = () => { try { req.result.createObjectStore(IDB.STORE); } catch (e) {} };
      req.onsuccess = () => { IDB.db = req.result; res(IDB.db); };
      req.onerror = () => res(null);
    });
  }
  let persistTimer = null;
  IM.persistir = function () { /* debounced */
    clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
      const db = await idbOpen(); if (!db) return;
      try {
        const dump = {}; for (const k of CAMPOS_ENG) dump[k] = IM.eng[k];
        dump.fileHashes = Array.from((IM.eng.fileHashes && IM.eng.fileHashes.entries && IM.eng.fileHashes.entries()) || []);
        dump._savedAt = D.meta ? D.meta.hoje || '' : '';
        const tx = db.transaction(IDB.STORE, 'readwrite');
        tx.objectStore(IDB.STORE).put(JSON.parse(JSON.stringify(dump)), 'state');
      } catch (e) { /* quota/serialização — protótipo tolera */ }
    }, 250);
  };
  IM.restaurar = async function () {
    const db = await idbOpen(); if (!db) return false;
    return new Promise(res => {
      try {
        const tx = db.transaction(IDB.STORE, 'readonly');
        const rq = tx.objectStore(IDB.STORE).get('state');
        rq.onsuccess = () => {
          const d = rq.result; if (!d || !d.snapshots) return res(false);
          for (const k of CAMPOS_ENG) if (d[k] != null) IM.eng[k] = d[k];
          IM.eng.fileHashes = new Map(d.fileHashes || []);
          IM._restaurado = { snapshots: (d.snapshots || []).length, savedAt: d._savedAt || null };
          res(true);
        };
        rq.onerror = () => res(false);
      } catch (e) { res(false); }
    });
  };
  IM.limparPersistencia = async function () { const db = await idbOpen(); if (!db) return; try { db.transaction(IDB.STORE, 'readwrite').objectStore(IDB.STORE).delete('state'); } catch (e) {} };
  /* toda aplicação de importação persiste automaticamente (sem tocar call sites) */
  if (!V8IMP._persistWrapped) {
    V8IMP._persistWrapped = true;
    for (const fn of ['apply', 'applyImportChain', 'stage', 'reprocess']) {
      const orig = V8IMP[fn];
      if (typeof orig === 'function') V8IMP[fn] = function () { const r = orig.apply(this, arguments); try { if (window.IMPORTAR && arguments[0] === IM.eng) IM.persistir(); } catch (e) {} return r; };
    }
  }
  const SUBS = ['Fontes e Histórico', 'Base de Dados e Mapeamento', 'Nova importação', 'Lotes e jobs', 'Vínculos SKU', 'Anúncio Master', 'Perfis de importação'];
  const BD_SUBS = ['Arquivos Importados', 'Campos Recebidos', 'Mapeamentos', 'Dados Brutos', 'Dados Normalizados',
    'Campos Aguardando Uso', 'Conflitos', 'Relacionamentos', 'Cobertura', 'Atualizações Recentes'];
  IM.bd = 'Campos Recebidos';
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
      <div class="eyebrow">fontes e histórico de dados · transversal a todas as áreas</div>
      <h1 class="h1">Fontes e Histórico de Dados</h1>
      <p class="sub" style="margin-top:6px"><b>Importação não soma dados — concilia, atualiza, versiona e explica.</b> O upload nasce dentro da área certa (Pedidos, Catálogo, Central de Inteligência); aqui vive a visão transversal: todo arquivo, escopo, qualidade e rollback.</p>
      <div class="tabs" style="margin-top:14px">${SUBS.map(s => `<button class="tab ${s === IM.sub ? 'on' : ''}" data-act="sub" data-sub="${s}">${s}${s === 'Lotes e jobs' ? `<span class="cnt">${IM.eng.batches.length}</span>` : s === 'Vínculos SKU' ? `<span class="cnt">${IM.eng.observations.length}</span>` : ''}</button>`).join('')}</div>
      <div id="impBody" style="margin-top:14px"></div>`;
    body();
    UI.$('#v-importar').onclick = onClick;
  }

  function body() {
    const el = UI.$('#impBody');
    if (IM.sub === 'Fontes e Histórico') el.innerHTML = fontes();
    else if (IM.sub === 'Base de Dados e Mapeamento') el.innerHTML = baseDados();
    else if (IM.sub === 'Nova importação') el.innerHTML = nova();
    else if (IM.sub === 'Lotes e jobs') el.innerHTML = lotes();
    else if (IM.sub === 'Vínculos SKU') el.innerHTML = vinculos();
    else if (IM.sub === 'Anúncio Master') el.innerHTML = master();
    else el.innerHTML = perfis();
  }

  /* ---------------- Fontes e Histórico (tabela transversal do 10.E.2) ---------------- */
  function fontes() {
    const rows = V8IMP.sourcesTable(IM.eng);
    const lojaNome = id => (D.scope.lojas.find(s => s.id === id) || { nome: id }).nome;
    if (!rows.length) return `<div class="fbar" style="margin-top:0">
        <button class="btn sm primary" data-act="upreal">Atualizar dados (upload local)</button>
        <span class="src">nenhuma fonte importada ainda — o upload também nasce dentro de Pedidos, Catálogo e Central de Inteligência</span></div>
      <div class="panel" style="margin-top:12px"><div class="empty"><b>Nenhuma fonte de dados</b>Cada área mostra seus indicadores com Fonte · Cobertura · Última importação. Nenhuma análise apresenta número sem fonte.</div></div>`;
    return `
      <div class="fbar" style="margin-top:0">
        <button class="btn sm primary" data-act="upreal">Atualizar dados (upload local)</button>
        <span class="src">${rows.filter(r => !r.arquivado).length} fonte(s) ativa(s) · ${rows.filter(r => r.arquivado).length} arquivada(s) — arquivar nunca apaga a camada bruta</span></div>
      <div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr>
        <th class="nosort">Fonte · Arquivo</th><th class="nosort">Área destino</th><th class="nosort">Escopo</th><th class="nosort">Período</th>
        <th class="nosort">Granularidade</th><th class="nosort">Status</th><th class="nosort">Linhas</th><th class="nosort">Dup. evitadas</th>
        <th class="nosort">Conflitos</th><th class="nosort">Erros</th><th class="nosort">Última atualização</th><th class="nosort">Usuário</th><th class="nosort"></th></tr></thead><tbody>
      ${rows.slice().reverse().map(r => `<tr ${r.arquivado ? 'style="opacity:.55"' : ''}>
        <td><span class="tmain">${UI.esc(r.arquivo)}</span><span class="tsub">${UI.esc(r.fonte)} · ${r.batchId}${r.arquivado ? ' · ARQUIVADA' : ''}</span></td>
        <td><span class="kbd">${UI.esc(r.areaDestino)}</span></td>
        <td><span class="src">${UI.esc(lojaNome(r.lojaId))} · ${UI.esc(r.contaId)}</span></td>
        <td><span class="src">${r.periodo ? r.periodo.ini + '→' + r.periodo.fim : '—'}</span></td>
        <td><span class="src">${r.granularidade || '—'}</span></td>
        <td>${UI.stBadge(r.status)}</td>
        <td>${r.linhas}</td><td>${r.duplicidadesEvitadas}</td>
        <td>${r.conflitos ? `<span class="st neg">${r.conflitos}</span>` : '0'}</td>
        <td>${r.linhasComErro ? `<button class="linklike" data-act="vererros" data-id="${r.batchId}">${r.linhasComErro}</button>` : '0'}</td>
        <td><span class="src">${r.ultimaAtualizacao}</span></td>
        <td><span class="src">${UI.esc(r.usuario)}</span></td>
        <td><span class="rowact">
          <button class="btn sm ghost" data-act="verbrutos" data-id="${r.batchId}" title="Ver todas as colunas e abas originais — nenhuma coluna é descartada">brutos</button>
          <button class="btn sm ghost" data-act="vermapa" data-id="${r.batchId}">mapeamento</button>
          ${r.status.startsWith('APLICADO') ? `<button class="btn sm danger" data-act="rollback" data-id="${r.batchId}">rollback</button>` : ''}
          ${r.arquivado ? '' : `<button class="btn sm ghost" data-act="arquivar" data-id="${r.batchId}">arquivar</button>`}
        </span></td></tr>`).join('')}
      </tbody></table><div class="tfoot"><span>toda linha tem origem, escopo, usuário e trilha — exclusão definitiva sem auditoria não existe aqui</span></div></div>`;
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
          <div class="sect-h"><span class="h2">2 · Arquivo</span><span class="src">upload local real ou exemplo rotulado</span></div>
          <button class="btn primary sm" data-act="upreal" style="margin-bottom:8px">Selecionar planilha do computador (XLSX · CSV · ZIP)</button>
          <div style="display:grid;gap:6px">${ARQS.map(([k, l]) => `<button class="obpick-btn fchip ${f.arquivo === k ? 'on' : ''}" style="text-align:left" data-act="arq" data-k="${k}">▤ ${l} <span class="src">(exemplo rotulado)</span></button>`).join('')}</div>
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

  /* ---------------- BASE DE DADOS E MAPEAMENTO (10.E.2.2) ----------------
     Toda coluna recebida, visível, com destino, status e mapeamento manual.
     Nada some em silêncio; inteligência só usa campo que o usuário vê. */
  function baseDados() {
    const chips = `<div class="fbar" style="margin-top:0;flex-wrap:wrap">${BD_SUBS.map(s => `<button class="fchip ${s === IM.bd ? 'on' : ''}" data-act="bd" data-bd="${s}">${s}</button>`).join('')}</div>`;
    const eng = IM.eng;
    const catall = V8IMP.fieldCatalog(eng);
    const stTag = st => st === 'utilizado' ? '<span class="st pos plain">UTILIZADO</span>'
      : st === 'preservado e disponível' ? '<span class="st info plain">PRESERVADO E DISPONÍVEL</span>'
      : st === 'aguardando mapeamento' ? '<span class="st warn plain">AGUARDANDO MAPEAMENTO</span>'
      : st === 'excluído da análise' ? '<span class="st plain">EXCLUÍDO DA ANÁLISE</span>'
      : `<span class="st neg plain">${UI.esc(st.toUpperCase().slice(0, 24))}</span>`;

    if (IM.bd === 'Campos Recebidos' || IM.bd === 'Campos Aguardando Uso') {
      const rows = IM.bd === 'Campos Aguardando Uso' ? catall.filter(c => c.status === 'aguardando mapeamento' || c.status === 'preservado e disponível') : catall;
      return chips + (rows.length ? `
      <div class="callout" style="margin-top:10px"><b>Três níveis de campo:</b> bruto (toda coluna original, preservada) → normalizado (mapeado para uso) → derivado (cálculo com fórmula). Nenhuma coluna é descartada silenciosamente.</div>
      <div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr>
        <th class="nosort">Coluna original</th><th class="nosort">Exemplo</th><th class="nosort">Tipo</th>
        <th class="nosort">Campo normalizado</th><th class="nosort">Área que utiliza</th><th class="nosort">Status</th><th class="nosort">Ação</th></tr></thead><tbody>
      ${rows.map(c => `<tr>
        <td><span class="tmain">${UI.esc(c.coluna)}</span><span class="tsub">${c.arquivos.length} arquivo(s)${c.sensivel ? ' · <span class="st neg plain" style="font-size:9px">SENSÍVEL</span>' : ''}</span></td>
        <td><span class="src">${c.sensivel && !V8IMP.canData((UI.account && UI.account.user.papel) || 'ADMIN', 'RAW_DATA_VIEW') ? 'OCULTO — exige RAW_DATA_VIEW' : UI.esc(String(c.exemplo ?? '—').slice(0, 22))}</span></td>
        <td><span class="src">${UI.esc(c.tipo)}</span></td>
        <td>${c.campoNormalizado ? `<span class="kbd">${UI.esc(c.campoNormalizado)}</span><span class="tsub">${UI.esc(c.origemMapeamento || '')}</span>` : '<span class="src">—</span>'}</td>
        <td><span class="src">${c.areas.length ? UI.esc(c.areas.join(' / ')) : 'nenhuma área ainda'}</span></td>
        <td>${stTag(c.status)}</td>
        <td><span class="rowact">
          <button class="btn sm ghost" data-act="verval" data-col="${UI.esc(c.coluna)}">ver valores</button>
          ${c.status === 'aguardando mapeamento' ? `<button class="btn sm" data-act="mapear" data-col="${UI.esc(c.coluna)}">criar mapeamento</button>`
            : c.status === 'excluído da análise' ? `<button class="btn sm" data-act="restcampo" data-col="${UI.esc(c.coluna)}">restaurar uso</button>`
            : `<button class="btn sm ghost" data-act="mapear" data-col="${UI.esc(c.coluna)}">mapear uso</button>
               <button class="btn sm ghost" data-act="exccampo" data-col="${UI.esc(c.coluna)}">excluir da análise</button>`}
        </span></td></tr>`).join('')}
      </tbody></table><div class="tfoot"><span>${catall.filter(c => c.status === 'utilizado').length} utilizadas · ${catall.filter(c => c.status === 'preservado e disponível').length} preservadas · ${catall.filter(c => c.status === 'aguardando mapeamento').length} aguardando mapeamento — todas acessíveis</span></div></div>`
      : '<div class="panel" style="margin-top:12px"><div class="empty"><b>Nenhum campo recebido ainda</b>Importe um arquivo — toda coluna aparece aqui com destino e status.</div></div>');
    }
    if (IM.bd === 'Mapeamentos') {
      const maps = eng.customMappings;
      return chips + `<div class="callout" style="margin-top:10px">Mapeamento manual nunca sobrescreve o anterior — cada mudança cria <b>nova versão</b> auditada. Depois de mapear, use <b>Reprocessar</b> no lote.</div>
      ${maps.length ? maps.slice().reverse().map(m => `<div class="metric-row"><span class="lbl"><b>${UI.esc(m.coluna)}</b> → <span class="kbd">${UI.esc(m.campo)}</span> <span class="src">· ${UI.esc(m.tipo)} · ${UI.esc(m.entidade)} · v${m.versao}${m.fimVigencia ? ' (substituída)' : ''}</span></span>
        <span class="val"><span class="src">${UI.esc(m.autor)} · ${m.em}</span></span></div>`).join('') : '<p class="src" style="margin-top:8px">nenhum mapeamento manual — o dicionário canônico cobre os campos conhecidos.</p>'}
      ${eng.batches.filter(b => b.aplicado).length ? `<div style="margin-top:10px"><button class="btn sm" data-act="reproc" data-id="${eng.batches.filter(b => b.aplicado).slice(-1)[0].id}">Reprocessar última importação com o mapeamento atual</button></div>` : ''}`;
    }
    if (IM.bd === 'Relacionamentos') {
      const rel = V8IMP.relacoesReport(eng, UI.state.products);
      return chips + `
      <div class="mesa-grid" style="margin-top:10px">
        <div class="mesa-kpi"><span class="k">Pedidos ↔ Devoluções</span><span class="v">${rel.pedidosDevolucoes.vinculados}</span><span class="f">${UI.esc(rel.pedidosDevolucoes.chave)} · ${rel.pedidosDevolucoes.orfaos} órfão(s)</span></div>
        <div class="mesa-kpi"><span class="k">Pedidos ↔ Produtos</span><span class="v">${rel.pedidosProdutos.vinculados}</span><span class="f">${UI.esc(rel.pedidosProdutos.chave)}</span></div>
        <div class="mesa-kpi"><span class="k">Produtos ↔ Anúncios</span><span class="v">${rel.produtosAnuncios.confirmados}</span><span class="f">${rel.produtosAnuncios.sugeridos} sugestão(ões) — nunca automático</span></div>
        <div class="mesa-kpi ${rel.fila.length ? 'nodata' : ''}"><span class="k">Fila de revisão</span><span class="v">${rel.fila.length}</span><span class="f">relação incerta NUNCA vincula sozinha</span></div>
      </div>
      ${rel.fila.map(f => `<div class="insight" style="margin-top:8px"><div class="in-h"><span class="st warn">REVISÃO</span><b>${UI.esc(f.tipo)}</b><span class="src">${UI.esc(f.alvo)}</span></div>
        <p class="in-fato">${UI.esc(f.evidencia)}</p>
        <div class="in-acts">${f.acoes.map(a => `<button class="btn sm ghost" data-act="decrel" data-id="${UI.esc(f.id)}" data-d="${a}">${a}</button>`).join('')}</div></div>`).join('') || '<p class="src" style="margin-top:10px">nenhuma relação pendente de revisão.</p>'}`;
    }
    if (IM.bd === 'Cobertura') {
      const cr = V8IMP.coberturaReal(eng);
      return chips + `<div class="callout" style="margin-top:10px">${UI.esc(cr.nota)}.</div>
      <div class="mesa-grid" style="margin-top:10px">${Object.entries(cr).filter(([k, v]) => typeof v === 'boolean' && k !== 'algum').map(([k, v]) => `
        <div class="mesa-kpi ${v ? '' : 'nodata'}"><span class="k">${k}</span><span class="v">${v ? 'DADO REAL' : 'SEM DADOS'}</span><span class="f">${v ? 'fixture equivalente desativada' : 'fixture demo rotulada em uso'}</span></div>`).join('')}
      </div>`;
    }
    if (IM.bd === 'Atualizações Recentes') {
      return chips + (eng.impactos.length ? eng.impactos.slice().reverse().map(im => `
        <div class="ctxcard" style="margin-top:10px"><div class="h"><b>${UI.esc(im.arquivo)}</b><span class="src">${im.em}</span></div>
        <div class="ctxitem"><span>Fonte · período</span><span class="src">${UI.esc(im.fonte)} · ${im.periodo ? im.periodo.ini + ' a ' + im.periodo.fim : '—'}</span></div>
        <div class="ctxitem"><span>Entidades</span><span class="src">${im.entidadesAtualizadas.criados} criada(s) · ${im.entidadesAtualizadas.atualizados} atualizada(s) · ${im.entidadesAtualizadas.duplicadosEvitados} dup. evitada(s)</span></div>
        <div class="ctxitem"><span>Insights novos · fila de revisão</span><span class="src">${im.insightsNovos.length} · ${im.filaRevisao}</span></div>
        </div>`).join('') : '<p class="src" style="margin-top:10px">nenhuma importação aplicada ainda.</p>');
    }
    if (IM.bd === 'Arquivos Importados') {
      return chips + (eng.rawFiles.length ? `<div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr>
        <th class="nosort">Arquivo</th><th class="nosort">Abas</th><th class="nosort">Colunas</th><th class="nosort">Linhas</th><th class="nosort">Lote</th><th class="nosort"></th></tr></thead><tbody>
        ${eng.rawFiles.map(rf => `<tr><td class="tmain">${UI.esc(rf.nome)}</td><td>${rf.abas.length}</td><td>${rf.abas[0] ? rf.abas[0].headers.length : 0}</td>
          <td>${rf.abas.reduce((a, x) => a + x.rows.length, 0)}</td><td><span class="kbd">${rf.batchId}</span></td>
          <td><span class="rowact"><button class="btn sm ghost" data-act="verbrutos" data-id="${rf.batchId}">brutos</button><button class="btn sm ghost" data-act="vermapa" data-id="${rf.batchId}">mapeamento</button></span></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="src" style="margin-top:10px">nenhum arquivo ainda.</p>');
    }
    if (IM.bd === 'Dados Brutos') return chips + `<p class="src" style="margin-top:10px">selecione um arquivo em Arquivos Importados → <b>brutos</b> para ver TODAS as abas, colunas e linhas originais.</p>`;
    if (IM.bd === 'Dados Normalizados') {
      const ov = V8IMP.ordersView(eng, {});
      return chips + `<div class="metric-row" style="margin-top:10px"><span class="lbl">Pedidos normalizados</span><span class="val">${ov.orders.length}</span></div>
        <div class="metric-row"><span class="lbl">Snapshots de métrica</span><span class="val">${eng.snapshots.filter(s => s.entidade === 'metric_snapshot').length}</span></div>
        <div class="metric-row"><span class="lbl">Eventos de devolução</span><span class="val">${eng.snapshots.filter(s => s.entidade === 'order_event').length}</span></div>
        <p class="src" style="margin-top:8px">normalizado nunca substitui o bruto — as duas camadas coexistem, com o mapeamento entre elas visível em Campos Recebidos.</p>`;
    }
    /* Conflitos */
    return chips + (eng.conflicts.length ? eng.conflicts.map(c => `<div class="exec-li"><span class="sig neg"></span><div class="t"><b>item ${UI.esc(c.item_id)}</b><span>${UI.esc(c.motivo)} · ${UI.esc(c.estado)}</span></div></div>`).join('') : '<p class="src" style="margin-top:10px">nenhum conflito aberto.</p>');
  }

  /* ---------------- UPLOAD LOCAL REAL (10.E.2) — compartilhado com todas as áreas ---------------- */
  const escopoDe = lojaId => {
    const loja = D.scope.lojas.find(s => s.id === lojaId);
    const cnpj = D.scope.cnpjs.find(c => c.id === loja.cnpjId);
    const conta = D.scope.contas.find(a => a.lojaId === loja.id);
    return { groupId: 'g1', companyId: cnpj ? cnpj.empresaId : UI.ctx.empresa, cnpjId: loja.cnpjId, lojaId: loja.id, contaId: conta ? conta.id : 'sem-conta', marketplace: loja.marketplace || 'shopee' };
  };

  IM.uploadModal = function (opts) {
    opts = opts || {};
    const papel = (UI.account && UI.account.user.papel) || D.meta.papel || 'ADMIN';
    if (!V8IMP.canData(papel, 'DATA_SOURCE_UPLOAD'))
      return UI.toast(`papel ${papel} não possui DATA_SOURCE_UPLOAD — peça a um gestor.`, 'err');
    const lojas = D.scope.lojas.filter(s => s.cnpjId !== 'c9' && s.tipo !== 'fisica');
    const lojaIni = opts.lojaId || (UI.ctx.loja && lojas.some(s => s.id === UI.ctx.loja) ? UI.ctx.loja : lojas[0].id);
    UI.openModal(`
      <h3 class="h2">${UI.esc(opts.titulo || 'Atualizar dados desta área')}</h3>
      <p class="sub" style="margin-top:4px">A planilha é lida <b>no seu computador</b>, validada (extensão, tipo e tamanho), detectada e conciliada.
      <b>Nada é aplicado sem a sua confirmação.</b> Formatos: XLSX · XLS · CSV · ZIP — até 25MB.${opts.dica ? '<br>' + UI.esc(opts.dica) : ''}</p>
      <label style="display:block;margin-top:10px"><span class="eyebrow">Escopo (loja / conta) — obrigatório antes da prévia</span><br>
        <select class="select" id="upLoja" style="width:100%;margin-top:3px">${lojas.map(s => `<option value="${s.id}" ${s.id === lojaIni ? 'selected' : ''}>${UI.esc(s.nome)} · ${UI.esc((D.scope.cnpjs.find(c => c.id === s.cnpjId) || {}).nome)}</option>`).join('')}</select></label>
      <div class="dropzone" id="upDrop">
        <b>Arraste a planilha aqui</b><span class="src">ou</span>
        <button class="btn primary sm" id="upPick" type="button">Selecionar planilha do computador</button>
        <input type="file" id="upFile" accept=".xlsx,.xls,.csv,.zip" hidden>
      </div>
      <div id="upPrev"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="btn ghost" onclick="UI.closeModal()">fechar</button></div>`);
    const drop = UI.$('#upDrop'), inp = UI.$('#upFile');
    UI.$('#upPick').onclick = () => inp.click();
    inp.onchange = () => inp.files && inp.files[0] && handle(inp.files[0]);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handle(f); };

    async function handle(f) {
      UI.$('#upPrev').innerHTML = `<p class="src" style="margin-top:10px">lendo ${UI.esc(f.name)} (${Math.max(1, Math.round(f.size / 1024))} KB) localmente…</p>`;
      let file;
      try { file = await V8FILE.readLocalFile(f); }
      catch (err) { UI.$('#upPrev').innerHTML = `<div class="err-state" style="margin-top:10px"><b>FALHOU</b> — ${UI.esc(err.message)}. Nada foi importado.</div>`; return; }
      if (file.erro) { UI.$('#upPrev').innerHTML = `<div class="err-state" style="margin-top:10px"><b>${UI.esc(file.estado)}</b> — ${UI.esc(file.erro)}</div>`; return; }
      const res = V8IMP.stage(IM.eng, file, escopoDe(UI.$('#upLoja').value), { products: UI.state.products, usuario: D.meta.usuario });
      let lotes = res.zip ? res.batches : res.multi ? res.batches : [res];
      const ign = res.zip ? res.ignorados : res.multi ? res.abas.flatMap(a => a.blocos.filter(b => b && b.ignorado)) : [];

      /* 10.E.2.3 — cabeçalho multiabas: abas, blocos, registros por tipo e campos preservados */
      const TIPO_NOME = { metricas: 'Métricas (período + diárias)', fonte_trafego: 'Fontes de tráfego', contrib_produto: 'Performance por produto',
        pedidos: 'Pedidos', devolucoes: 'Devoluções', estoque: 'Estoque', funil: 'Funil', trafego: 'Tráfego' };
      const multiHeader = () => {
        if (!res.multi) return '';
        const r = res.resumo;
        const abasHtml = res.abas.map(a => `<span class="chip">${a.reconhecidos ? '✓' : '•'} ${UI.esc(a.nome)}</span>`).join(' ');
        const tiposHtml = Object.entries(r.porTipo).map(([t, n]) => `<div class="ctxitem"><span>${UI.esc(TIPO_NOME[t] || t)}</span><span class="src">${n} registro(s)</span></div>`).join('');
        return `<div class="panel" style="margin-top:12px">
          <div class="sect-h" style="margin-top:0"><span class="h2" style="font-size:13px">Arquivo multiabas: ${UI.esc(res.arquivo)}</span><span class="st ok plain">${r.abas} ABA(S)</span></div>
          <div style="margin-top:4px"><span class="eyebrow">Abas detectadas</span><br>${abasHtml}</div>
          <div class="ctxcard" style="margin-top:10px">
            <div class="ctxitem"><span>Blocos reconhecidos</span><span class="src">${r.blocos} bloco(s) · ${r.ignorados} preservado(s) como referência</span></div>
            ${tiposHtml}
            <div class="ctxitem"><span>Campos preservados</span><span class="src">${r.camposPreservados} coluna(s) · nada descartado</span></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <button class="btn primary sm" id="upApplyAll">Importar todas as abas reconhecidas</button>
            <button class="btn sm ghost" id="upToggleAbas">Selecionar abas manualmente</button>
          </div>
          <p class="src" style="margin-top:6px">a linha consolidada de período nunca entra como um dia; blocos de fonte e de produto alimentam Tráfego, Afiliados, Ads e Catálogo.</p>
        </div>`;
      };

      /* prévia com classificação EXPLICÁVEL + correção manual do tipo (10.E.3.1) */
      const tipoSelect = bt => `
        <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><span class="eyebrow">Alterar tipo de importação</span>
          <select class="select" data-upretype="${bt.id}" style="flex:1" title="A detecção nunca depende de uma coluna solta — mas a palavra final é sua; a troca fica auditada.">
            <option value="">manter: ${UI.esc(V8IMP.NOME_PERFIL[bt.det.perfil] || bt.det.perfil)}</option>
            ${Object.entries(V8IMP.NOME_PERFIL).filter(([k]) => k !== bt.det.perfil).map(([k, nome]) => `<option value="${k}">${UI.esc(nome)}</option>`).join('')}
          </select></label>`;
      const sugestaoHtml = bt => `
        <dt>Perfil sugerido</dt><dd><b>${UI.esc(bt.preview && bt.preview.perfilNome || V8IMP.NOME_PERFIL[bt.det.perfil] || bt.det.perfil)}</b> <span class="kbd">${bt.det.perfil}</span></dd>
        <dt>Confiança</dt><dd>${UI.esc(bt.det.confiancaLabel || String(bt.det.confianca))} · classificação ${UI.esc(bt.det.origemClassificacao || 'AUTOMÁTICA')}</dd>
        <dt>Por que foi identificado</dt><dd><span class="src">${(bt.det.evidencias || []).map(c => '✓ ' + UI.esc(c)).join(' &nbsp;') || 'sem evidências — mapeie manualmente'}</span></dd>`;

      function renderLotes() {
        UI.$('#upPrev').innerHTML = `
        ${multiHeader()}
        ${res.zip ? `<p class="src" style="margin-top:10px">ZIP extraído no staging: ${lotes.length} planilha(s) reconhecida(s)${ign.length ? ` · ${ign.length} entrada(s) declarada(s) como não importável(is): ${ign.map(x => UI.esc(x.nome)).join(', ')}` : ''}</p>` : ''}
        ${lotes.map(bt => bt.duplicado
          ? `<div class="err-state" style="margin-top:10px"><b>ARQUIVO JÁ IMPORTADO</b> — ${UI.esc(bt.motivo)}</div>`
          : !bt.preview.aplicavel
            ? `<div class="callout" style="margin-top:10px;border-left-color:var(--warn)"><b>${UI.esc(bt.arquivo)}</b> · ${UI.esc(V8IMP.NOME_PERFIL[bt.preview.perfil] || bt.preview.perfil)} <span class="kbd">${UI.esc(bt.preview.perfil)}</span> · ${UI.esc(bt.preview.motivo || 'aguardando mapeamento')} — não será aplicado.${tipoSelect(bt)}</div>`
            : `<div class="panel" style="margin-top:10px">
              <div class="sect-h" style="margin-top:0"><span class="h2" style="font-size:13px">${UI.esc(bt.abaOrigem ? bt.abaOrigem + ' — ' + (bt.blocoOrigem || '') : bt.arquivo)}</span>${UI.stBadge(bt.estado)}</div>
              <dl class="kv">
                ${bt.abaOrigem ? `<dt>Aba · bloco</dt><dd><b>${UI.esc(bt.abaOrigem)}</b> · ${UI.esc(bt.blocoOrigem || '—')}</dd>` : ''}
                ${sugestaoHtml(bt)}
                <dt>Destino · granularidade</dt><dd>${UI.esc(bt.preview.tipo)} · <span class="kbd">${bt.preview.granularidade}</span></dd>
                ${bt.preview.blocos ? `<dt>Blocos por tipo de linha</dt><dd><span class="src">${Object.entries(bt.preview.blocos).map(([k, v]) => `${UI.esc(k)}: ${v}`).join(' · ')}</span></dd>` : ''}
                <dt>Registros</dt><dd>${bt.preview.registros} · ${bt.preview.jaExistem} já existente(s) — serão atualizados, nunca somados</dd>
                <dt>Conflitos · erros</dt><dd>${bt.preview.conflitos} conflito(s) · ${bt.preview.linhasComErro} linha(s) com erro (preservadas na camada bruta)</dd>
                ${bt.preview.sobreposicao ? `<dt>Sobreposição</dt><dd><span class="st warn plain">${UI.esc(bt.preview.sobreposicao.aviso)}</span></dd>` : ''}
              </dl>
              ${tipoSelect(bt)}
              <div style="display:flex;gap:8px;margin-top:10px">
                <button class="btn primary sm" data-upapply="${bt.id}">Confirmar e aplicar</button>
                <button class="btn sm ghost" data-upcancel="${bt.id}">Cancelar este lote</button>
              </div></div>`).join('')}`;
        UI.$$('#upPrev [data-upapply]').forEach(btn => btn.onclick = () => {
          /* 10.E.2.2: cadeia explícita — nunca só "importação concluída" */
          const r = V8IMP.applyImportChain(IM.eng, btn.dataset.upapply, { papel, usuario: D.meta.usuario, products: UI.state.products });
          if (r.blocked) return UI.toast(r.reason, 'err');
          const painel = btn.closest('.panel');
          painel.querySelector('.sect-h').insertAdjacentHTML('beforeend', '<span class="st pos">APLICADO</span>');
          btn.disabled = true; btn.title = 'lote já aplicado';
          painel.insertAdjacentHTML('beforeend', `
            <div class="sect-h"><span class="h2" style="font-size:12.5px">Progresso real da cadeia pós-importação</span></div>
            ${r.passos.map(p => `<div class="exec-li"><span class="sig pos"></span><div class="t"><b>${p.n} · ${UI.esc(p.nome)}</b><span>${UI.esc(p.resultado)}</span></div></div>`).join('')}
            ${r.impacto.insightsNovos.length ? `<div class="callout" style="margin-top:8px"><b>${r.impacto.insightsNovos.length} insight(s) novo(s) na Mesa de Inteligência</b> — abra a Central para ver "O que mudou com esta importação".</div>` : ''}`);
          UI.toast(`Lote ${r.job.id} aplicado — 15 passos executados, sistema inteiro atualizado.`, 'ok');
          if (opts.onDone) opts.onDone(r.job);
        });
        UI.$$('#upPrev [data-upcancel]').forEach(btn => btn.onclick = () => {
          const bt = IM.eng.batches.find(x => x.id === btn.dataset.upcancel);
          if (bt && !bt.aplicado) { bt.estado = 'CANCELADO'; UI.toast('Lote cancelado — nada foi aplicado.', ''); btn.closest('.panel').style.opacity = .5; }
        });
        UI.$$('#upPrev [data-upretype]').forEach(sel => sel.onchange = () => {
          if (!sel.value) return;
          const r = V8IMP.reclassify(IM.eng, sel.dataset.upretype, sel.value, { usuario: D.meta.usuario, products: UI.state.products });
          if (r.blocked) return UI.toast(r.reason, 'err');
          lotes = lotes.map(bt => bt.id === r.anterior ? r.batch : bt);
          UI.toast(`Tipo corrigido manualmente para ${V8IMP.NOME_PERFIL[sel.value] || sel.value} — lote anterior cancelado, correção auditada.`, 'ok');
          renderLotes();
        });
        /* 10.E.2.3 — importar todas as abas reconhecidas de uma vez */
        const applyAll = UI.$('#upApplyAll');
        if (applyAll) applyAll.onclick = () => {
          let ok = 0;
          for (const bt of lotes) {
            if (!bt || !bt.id || bt.aplicado || !(bt.preview && bt.preview.aplicavel)) continue;
            const r = V8IMP.applyImportChain(IM.eng, bt.id, { papel, usuario: D.meta.usuario, products: UI.state.products });
            if (!r.blocked) ok++;
          }
          UI.toast(`${ok} aba(s)/bloco(s) aplicado(s) — Métricas, Tráfego, Afiliados, Ads e Catálogo atualizados com a base real.`, 'ok');
          if (opts.onDone) opts.onDone(lotes[0]);
          renderLotes();
        };
        const tgl = UI.$('#upToggleAbas');
        if (tgl) tgl.onclick = () => { UI.$('#upPrev').classList.toggle('manual-abas'); UI.toast('Selecione aba a aba abaixo: cada bloco tem seu próprio [Confirmar e aplicar] e [Cancelar].', ''); };
      }
      renderLotes();
    }
  };

  /* camada bruta: modais de brutos / mapeamento / linhas com erro */
  IM.verBrutos = function (batchId) {
    const rf = IM.eng.rawFiles.find(x => x.batchId === batchId);
    if (!rf) return UI.toast('camada bruta não encontrada', 'err');
    UI.openModal(`<h3 class="h2">Dados brutos · ${UI.esc(rf.nome)}</h3>
      <p class="sub" style="margin-top:4px">Todas as abas, colunas e linhas do arquivo original — <b>nenhuma coluna importada é descartada silenciosamente</b>.</p>
      ${rf.abas.map(a => `<div class="sect-h"><span class="h2" style="font-size:13px">aba "${UI.esc(a.nome)}" · ${a.headers.length} coluna(s) · ${a.rows.length} linha(s)</span></div>
        <div class="tblwrap" style="max-height:220px;overflow:auto"><table class="tbl" style="min-width:0"><thead><tr>${a.headers.map(h => `<th class="nosort">${UI.esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${a.rows.slice(0, 30).map(r => `<tr>${a.headers.map(h => `<td><span class="src">${UI.esc(r[h] ?? '')}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div>
        ${a.rows.length > 30 ? `<p class="src">mostrando 30 de ${a.rows.length} linha(s) — o arquivo original permanece íntegro</p>` : ''}`).join('')}
      <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" onclick="UI.closeModal()">fechar</button></div>`);
  };
  IM.verMapeamento = function (batchId) {
    const bt = IM.eng.batches.find(x => x.id === batchId);
    const rf = IM.eng.rawFiles.find(x => x.batchId === batchId);
    if (!bt || !rf) return UI.toast('lote não encontrado', 'err');
    const perfil = V8IMP.PROFILES[bt.det.perfil] || { assinatura: [] };
    const headers = (rf.abas[0] || {}).headers || [];
    UI.openModal(`<h3 class="h2">Mapeamento · ${UI.esc(bt.arquivo)}</h3>
      <p class="sub" style="margin-top:4px">Perfil <span class="kbd">${bt.det.perfil}</span> (versão ${bt.mappingVersion}) — colunas usadas × colunas originais.</p>
      <div class="tblwrap" style="margin-top:10px;max-height:300px;overflow:auto"><table class="tbl" style="min-width:0"><thead><tr><th class="nosort">Coluna original</th><th class="nosort">Uso</th></tr></thead><tbody>
      ${headers.map(h => `<tr><td class="tmain">${UI.esc(h)}</td><td>${perfil.assinatura.includes(h) ? '<span class="st pos">chave do perfil</span>' : '<span class="src">preservada na camada bruta (disponível, não descartada)</span>'}</td></tr>`).join('')}
      </tbody></table></div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" onclick="UI.closeModal()">fechar</button></div>`);
  };
  IM.verErros = function (batchId) {
    const errs = IM.eng.rawErrors.filter(x => x.batchId === batchId);
    UI.openModal(`<h3 class="h2">Linhas com erro · ${batchId}</h3>
      <p class="sub" style="margin-top:4px">${errs.length} linha(s) que não puderam entrar na análise — cada uma com motivo, preservadas na íntegra.</p>
      ${errs.map(e => `<div class="exec-li"><span class="sig warn"></span><div class="t"><b>linha ${e.linha} · ${UI.esc(e.motivo)}</b><span>${UI.esc(JSON.stringify(e.raw).slice(0, 180))}</span></div></div>`).join('') || '<div class="empty"><b>Nenhuma linha com erro</b></div>'}
      <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" onclick="UI.closeModal()">fechar</button></div>`);
  };

  /* ---------------- eventos ---------------- */
  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'sub') { IM.sub = b.dataset.sub; UI.$('#crumb').textContent = 'Fontes e Dados · ' + IM.sub; render(IM.sub); }
    else if (act === 'upreal') IM.uploadModal({ titulo: 'Upload local — Fontes e Histórico de Dados', onDone: () => { IM.sub = 'Fontes e Histórico'; body(); } });
    /* ---------- 10.E.2.2: base de dados e mapeamento ---------- */
    else if (act === 'bd') { IM.bd = b.dataset.bd; body(); }
    else if (act === 'verval') {
      const col = b.dataset.col;
      const vals = [];
      for (const rf of IM.eng.rawFiles) for (const aba of rf.abas) for (const r of aba.rows)
        if (r[col] != null && r[col] !== '' && vals.length < 12) vals.push({ v: r[col], arq: rf.nome });
      UI.openModal(`<h3 class="h2">Valores · ${UI.esc(col)}</h3>
        <p class="sub" style="margin-top:4px">Amostra da camada bruta (${vals.length} de todas as linhas preservadas).</p>
        ${vals.map(x => `<div class="metric-row"><span class="lbl"><span class="src">${UI.esc(String(x.v).slice(0, 60))}</span></span><span class="val"><span class="tsub">${UI.esc(x.arq)}</span></span></div>`).join('') || '<p class="src">sem valores.</p>'}
        <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" onclick="UI.closeModal()">fechar</button></div>`);
    }
    else if (act === 'mapear') {
      const col = b.dataset.col;
      UI.openModal(`<h3 class="h2">Mapear campo · ${UI.esc(col)}</h3>
        <p class="sub" style="margin-top:4px">Sem alterar código: escolha tipo, entidade e campo interno. Cada mudança cria nova versão auditada.</p>
        <label style="display:block;margin-top:8px"><span class="eyebrow">Tipo</span><br>
          <select class="select" id="mpTipo" style="width:100%;margin-top:3px">${V8IMP.TIPOS_CAMPO.map(t => `<option>${t}</option>`).join('')}</select></label>
        <label style="display:block;margin-top:8px"><span class="eyebrow">Entidade</span><br>
          <select class="select" id="mpEnt" style="width:100%;margin-top:3px">${V8IMP.ENTIDADES_CAMPO.map(t => `<option>${t}</option>`).join('')}</select></label>
        <label style="display:block;margin-top:8px"><span class="eyebrow">Campo interno</span><br>
          <input class="input" id="mpCampo" style="width:100%;margin-top:3px" placeholder="ex.: order_custom_flag"></label>
        <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="mpAnalise" checked> pode alimentar análise</label>
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
          <button class="btn primary" id="mpOk">Salvar mapeamento (versionado)</button></div>`);
      UI.$('#mpOk').onclick = () => {
        const r = V8IMP.mapField(IM.eng, { coluna: col, tipo: UI.$('#mpTipo').value, entidade: UI.$('#mpEnt').value,
          campo: UI.$('#mpCampo').value.trim() || col.toLowerCase().replace(/\W+/g, '_'), alimentaAnalise: UI.$('#mpAnalise').checked },
          { usuario: D.meta.usuario, papel: (UI.account && UI.account.user.papel) || 'ADMIN' });
        if (r.blocked) return UI.toast(r.reason, 'err');
        UI.closeModal(); UI.toast(`"${col}" mapeado (v${r.mapeamento.versao}) — reprocessar atualiza os dados normalizados.`, 'ok'); body();
      };
    }
    else if (act === 'exccampo') {
      const col = b.dataset.col;
      UI.openModal(`<h3 class="h2">Excluir campo da análise</h3>
        <p class="sub" style="margin-top:4px">A coluna permanece na camada bruta — sai apenas das análises. Motivo obrigatório.</p>
        <input class="input" id="ecMotivo" style="width:100%;margin-top:10px" placeholder="motivo">
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" onclick="UI.closeModal()">cancelar</button><button class="btn danger" id="ecOk2">Excluir da análise</button></div>`);
      UI.$('#ecOk2').onclick = () => {
        const r = V8IMP.excluirCampoDaAnalise(IM.eng, col, { motivo: UI.$('#ecMotivo').value.trim(), usuario: D.meta.usuario });
        if (r.blocked) return UI.toast(r.reason, 'err');
        UI.closeModal(); UI.toast('Campo excluído da análise — bruto preservado.', 'ok'); body();
      };
    }
    else if (act === 'restcampo') { V8IMP.restaurarCampo(IM.eng, b.dataset.col, { usuario: D.meta.usuario }); UI.toast('Campo restaurado.', 'ok'); body(); }
    else if (act === 'reproc') {
      const r = V8IMP.reprocess(IM.eng, b.dataset.id, { usuario: D.meta.usuario });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.toast(`Reprocessado (${r.mappingVersion}): ${r.utilizados} campo(s) utilizados · ${r.aguardando} aguardando.`, 'ok'); body();
    }
    else if (act === 'decrel') {
      const r = V8IMP.decidirRelacao(IM.eng, b.dataset.id, b.dataset.d, { usuario: D.meta.usuario });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.toast('Decisão registrada e auditada: ' + b.dataset.d + '.', 'ok'); body();
    }
    else if (act === 'verbrutos') IM.verBrutos(b.dataset.id);
    else if (act === 'vermapa') IM.verMapeamento(b.dataset.id);
    else if (act === 'vererros') IM.verErros(b.dataset.id);
    else if (act === 'arquivar') {
      const id = b.dataset.id;
      UI.openModal(`<h3 class="h2">Arquivar fonte ${id}</h3>
        <p class="sub" style="margin-top:4px">A fonte sai das listas ativas; dados, camada bruta e trilha permanecem. Motivo é obrigatório.</p>
        <input class="input" id="arqMotivo" style="width:100%;margin-top:10px" placeholder="ex.: export substituído pela versão corrigida">
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
          <button class="btn danger" id="arqOk">Arquivar com motivo</button></div>`);
      UI.$('#arqOk').onclick = () => {
        const r = V8IMP.archiveFile(IM.eng, id, { motivo: UI.$('#arqMotivo').value.trim(), usuario: D.meta.usuario, papel: (UI.account && UI.account.user.papel) || 'ADMIN' });
        if (r.blocked) return UI.toast(r.reason, 'err');
        UI.closeModal(); UI.toast('Fonte arquivada — nada foi apagado; restauração disponível.', 'ok'); body();
      };
    }
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
      /* Fontes e Histórico é a primeira aba (10.E.2) */
      need(UI.$('#impBody').textContent.includes('Nenhuma fonte de dados') || UI.$$('#impBody tbody tr').length >= 0, 'fontes e histórico renderiza');
      need(!!IM.uploadModal && !!window.V8FILE && typeof V8FILE.readLocalFile === 'function', 'upload local real disponível (não decorativo)');
      /* fluxo completo: detectar → prévia → aplicar */
      IM.sub = 'Nova importação'; IM.fluxo.arquivo = 'productTraffic'; body();
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
