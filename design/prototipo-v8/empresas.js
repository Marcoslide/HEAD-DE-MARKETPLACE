/* =============================================================
   v8 · EMPRESAS E OPERAÇÕES (10.E.4)
   Cadastro manual simples: Empresa → Canais de Venda → Contas
   Marketplace. Sem burocracia: CNPJ é opcional para começar.
   Tudo que é cadastrado aqui entra automaticamente nos filtros
   globais. Desativar/arquivar preserva histórico; excluir só é
   possível para empresa vazia, com confirmação.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA;
  const EMP = window.EMPRESAS = { sub: 'Visão Geral' };
  const SUBS = ['Visão Geral', 'Empresas', 'Canais de Venda', 'Contas Marketplace', 'Integrações',
    'Equipe e Responsáveis', 'Arquivados', 'Histórico e Auditoria'];
  /* estado de negócio compartilhado (Empresas ↔ Centro de Custos ↔ Catálogo ↔ Central) */
  window.bizState = () => (window._v8biz || (window._v8biz = V8BIZ.createBiz(D.scope)));
  const biz = () => bizState();
  const papel = () => (UI.account && UI.account.user.papel) || D.meta.papel || 'ADMIN';
  const empNome = id => (biz().empresas.find(e => e.id === id) || { nome: id }).nome;

  function render(sub) {
    if (sub && SUBS.includes(sub)) EMP.sub = sub;
    UI.$('#v-empresas').innerHTML = `
      <div class="eyebrow">empresas e operações · estrutura simples: empresa → canal → conta</div>
      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:280px"><h1 class="h1">Empresas e Operações</h1>
        <p class="sub" style="margin-top:6px">Cadastre a empresa, os canais onde ela vende e as contas de marketplace — <b>sem exigir CNPJ para começar</b>. Tudo entra nos filtros globais na hora.</p></div>
        <button class="btn primary" data-act="nova">Nova Empresa</button>
      </div>
      <div class="tabs" style="margin-top:14px;flex-wrap:wrap">${SUBS.map(s => `<button class="tab ${s === EMP.sub ? 'on' : ''}" data-act="sub" data-sub="${s}">${s}</button>`).join('')}</div>
      <div id="empBody" style="margin-top:14px"></div>`;
    body();
    UI.$('#v-empresas').onclick = onClick;
  }

  function body() {
    const el = UI.$('#empBody');
    if (EMP.sub === 'Visão Geral') el.innerHTML = visaoGeral();
    else if (EMP.sub === 'Empresas') el.innerHTML = listaEmpresas(false);
    else if (EMP.sub === 'Canais de Venda') el.innerHTML = canais();
    else if (EMP.sub === 'Contas Marketplace') el.innerHTML = contas();
    else if (EMP.sub === 'Integrações') el.innerHTML = integracoes();
    else if (EMP.sub === 'Equipe e Responsáveis') el.innerHTML = equipe();
    else if (EMP.sub === 'Arquivados') el.innerHTML = arquivados();
    else el.innerHTML = historico();
    UI.refreshBadges();
  }

  function visaoGeral() {
    const B = biz();
    const ativas = B.empresas.filter(e => e.status === 'Ativa').length;
    const kpi = (label, valor, sub2) => `<div class="mesa-kpi" style="cursor:pointer" data-act="sub" data-sub="${sub2}" title="abrir ${sub2}">
      <span class="k">${label}</span><span class="v">${valor}</span><span class="f">clique para abrir</span></div>`;
    return `
      <div class="mesa-grid">
        ${kpi('Empresas ativas', ativas, 'Empresas')}
        ${kpi('Empresas desativadas', B.empresas.filter(e => e.status === 'Desativada').length, 'Arquivados')}
        ${kpi('Empresas arquivadas', B.empresas.filter(e => e.status === 'Arquivada').length, 'Arquivados')}
        ${kpi('Canais ativos', B.canais.filter(c => c.status === 'Ativo').length, 'Canais de Venda')}
        ${kpi('Contas conectadas', B.contas.filter(a => a.modoAcesso !== 'Sem conexão').length, 'Contas Marketplace')}
        ${kpi('Canais aguardando conexão', B.canais.filter(c => c.status === 'Ativo' && !B.contas.some(a => a.canalId === c.id && a.modoAcesso !== 'Sem conexão')).length, 'Integrações')}
        ${kpi('Canais sem importação', B.contas.filter(a => !a.ultimaImportacao && a.seed !== true).length, 'Contas Marketplace')}
        ${kpi('Sem Centro de Custos', B.empresas.filter(e => !B.custosFixos.some(c => c.empresaId === e.id)).length, 'Empresas')}
        ${kpi('Sem responsável', B.empresas.filter(e => !e.responsavelPrincipal).length, 'Empresas')}
        ${kpi('Dados incompletos', B.empresas.filter(e => !e.cnpj || !e.telefone).length, 'Empresas')}
      </div>
      <div class="callout" style="margin-top:12px">A estrutura visível é simples — <b>Empresa → Canal de Venda → Conta Marketplace</b>. CNPJ, endereço e dados fiscais são blocos opcionais que você completa quando quiser.</div>`;
  }

  function listaEmpresas(arquivadas) {
    const B = biz();
    const list = B.empresas.filter(e => arquivadas ? ['Arquivada', 'Desativada'].includes(e.status) : !['Arquivada', 'Desativada'].includes(e.status));
    if (!list.length) return `<div class="panel"><div class="empty"><b>${arquivadas ? 'Nada arquivado' : 'Nenhuma empresa'}</b>${arquivadas ? '' : 'Clique em <b>Nova Empresa</b> — só nome e responsável são obrigatórios.'}</div></div>`;
    return `<div class="tblwrap"><table class="tbl"><thead><tr>
      <th class="nosort"></th><th class="nosort">Empresa</th><th class="nosort">Responsável</th><th class="nosort">Contato</th>
      <th class="nosort">CNPJ</th><th class="nosort">Cidade/UF</th><th class="nosort">Canais</th><th class="nosort">Contas</th>
      <th class="nosort">Status</th><th class="nosort">Atualização</th><th class="nosort">Ações</th></tr></thead><tbody>
      ${list.map(e => {
        const nCh = B.canais.filter(c => c.empresaId === e.id && c.status === 'Ativo').length;
        const nAc = B.contas.filter(a => a.empresaId === e.id).length;
        return `<tr>
        <td><span class="thumb">${UI.esc((e.fantasia || e.nome)[0])}</span></td>
        <td><button class="tmain linklike" style="font-size:12.5px" data-act="abrir" data-id="${e.id}">${UI.esc(e.nome)}</button><span class="tsub">${UI.esc(e.fantasia || '—')}</span></td>
        <td>${UI.esc(e.responsavelPrincipal || '—')}</td>
        <td><span class="src">${UI.esc(e.telefone || '—')}</span><span class="tsub">${UI.esc(e.email || (e.contatos || {}).email || '—')}</span></td>
        <td><span class="src">${UI.esc(e.cnpj || 'sem CNPJ (opcional)')}</span></td>
        <td><span class="src">${UI.esc(e.cidade || (e.endereco || {}).cidade || '—')}/${UI.esc(e.estado || (e.endereco || {}).estado || '—')}</span></td>
        <td>${nCh}</td><td>${nAc}</td>
        <td>${UI.stBadge(e.status === 'Ativa' ? 'ATIVO' : e.status)}</td>
        <td><span class="src">${e.atualizadoEm}</span></td>
        <td><span class="rowact">
          <button class="btn sm ghost" data-act="abrir" data-id="${e.id}">abrir</button>
          <button class="btn sm ghost" data-act="addcanal" data-id="${e.id}">+ canal</button>
          ${arquivadas ? `<button class="btn sm" data-act="reativar" data-id="${e.id}">reativar</button>`
            : `<button class="btn sm ghost" data-act="desativar" data-id="${e.id}">desativar</button>
               <button class="btn sm ghost" data-act="arquivar" data-id="${e.id}">arquivar</button>
               <button class="btn sm danger" data-act="excluir" data-id="${e.id}">excluir</button>`}
        </span></td></tr>`;
      }).join('')}
      </tbody></table><div class="tfoot"><span>empresa com pedidos/catálogo/custos não pode ser apagada — só desativada ou arquivada (histórico preservado)</span></div></div>`;
  }

  function canais() {
    const B = biz();
    return `<div class="fbar" style="margin-top:0"><span class="src">um canal por lugar onde a empresa vende — Shopee, ML, TikTok, Magalu, loja física, site, WhatsApp…</span></div>
      ${B.empresas.filter(e => !['Arquivada', 'Desativada'].includes(e.status)).map(e => `
      <div class="panel" style="margin-top:10px"><div class="sect-h" style="margin-top:0"><span class="h2">${UI.esc(e.nome)}</span>
        <button class="btn sm primary" data-act="addcanal" data-id="${e.id}">Adicionar Canal de Venda</button></div>
      ${B.canais.filter(c => c.empresaId === e.id).map(c => `
        <div class="metric-row"><span class="lbl"><b>${UI.esc(c.nome)}</b> <span class="src">· ${UI.esc(c.tipo)}${c.responsavel ? ' · resp. ' + UI.esc(c.responsavel) : ''}</span></span>
        <span class="val">${UI.stBadge(c.status === 'Ativo' ? 'ATIVO' : c.status)}
          <button class="linklike" data-act="editcanal" data-id="${c.id}" style="margin-left:8px">editar</button>
          ${c.status === 'Ativo' ? `<button class="linklike" data-act="descanal" data-id="${c.id}">desativar</button>` : ''}
        </span></div>`).join('') || '<p class="src">nenhum canal ainda.</p>'}
      </div>`).join('')}`;
  }

  function contas() {
    const B = biz();
    return `<div class="callout" style="margin-top:0">Cada canal marketplace pode ter <b>uma ou mais contas</b> (ex.: Shopee Líder Molduras MG + Shopee Galeria Diamonds). Escrita externa: sempre bloqueada.</div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
        <th class="nosort">Conta</th><th class="nosort">Marketplace</th><th class="nosort">Canal vinculado</th><th class="nosort">Empresa</th>
        <th class="nosort">Modo de acesso</th><th class="nosort">Últ. importação</th><th class="nosort"></th></tr></thead><tbody>
      ${B.contas.map(a => {
        const c = B.canais.find(x => x.id === a.canalId) || {};
        return `<tr><td><span class="tmain">${UI.esc(a.nomeInterno || a.id)}</span><span class="tsub">${UI.esc(a.idExterno || 'sem ID externo')}</span></td>
        <td>${UI.esc(a.marketplace || '—')}</td>
        <td><span class="src">${UI.esc(c.nome || '—')}</span></td>
        <td><span class="src">${UI.esc(empNome(a.empresaId))}</span></td>
        <td><span class="src">${UI.esc(a.modoAcesso)}</span><span class="tsub">${UI.esc(a.escrita)}</span></td>
        <td><span class="src">${a.ultimaImportacao || '—'}</span></td>
        <td><span class="rowact"><button class="btn sm ghost" data-act="conectar" data-emp="${a.empresaId}" data-canal="${a.canalId}" data-conta="${a.id}">conectar</button></span></td></tr>`;
      }).join('')}
      </tbody></table></div>`;
  }

  function integracoes() {
    return `
      <div class="callout" style="margin-top:0"><b>OAuth exige empresa e canal definidos</b> — a conexão nasce no lugar certo, com escopo explícito: modo Leitura, escrita externa Bloqueada. Nada é simulado como conectado.</div>
      <div style="margin-top:12px"><button class="btn primary" data-act="conectar">Conectar Marketplace</button>
      <button class="btn ghost" data-act="goconx" style="margin-left:8px">ver Conexões →</button></div>
      <div class="sect-h"><span class="h2">Conexões registradas</span></div>
      ${biz().contas.filter(a => a.escopoConexao).map(a => `<div class="ctxcard" style="margin-top:8px">
        <div class="h"><b>${UI.esc(a.nomeInterno || a.id)}</b><span class="st warn plain">${UI.esc(a.modoAcesso.split(' — ')[0])}</span></div>
        <div class="ctxitem"><span>Empresa · canal</span><span class="src">${UI.esc(a.escopoConexao.empresa)} · ${UI.esc(a.escopoConexao.canal)}</span></div>
        <div class="ctxitem"><span>Marketplace · modo · escrita</span><span class="src">${UI.esc(a.escopoConexao.marketplace)} · ${UI.esc(a.escopoConexao.modo)} · ${UI.esc(a.escopoConexao.escrita)}</span></div>
      </div>`).join('') || '<p class="src">nenhuma conexão iniciada — importação manual continua disponível em cada área.</p>'}`;
  }

  function equipe() {
    const B = biz();
    return B.empresas.filter(e => !['Arquivada'].includes(e.status)).map(e => `
      <div class="panel" style="margin-top:10px"><div class="sect-h" style="margin-top:0"><span class="h2">${UI.esc(e.nome)}</span>
        <button class="btn sm" data-act="addresp" data-id="${e.id}">adicionar responsável</button></div>
      ${(e.responsaveis || []).map(r => `<div class="metric-row"><span class="lbl"><b>${UI.esc(r.nome)}</b> <span class="src">· ${UI.esc(r.funcao)}</span></span>
        <span class="val"><span class="src">${UI.esc(r.telefone || '—')} · ${UI.esc(r.email || '—')}</span> ${r.ativo === false ? '<span class="st plain">INATIVO</span>' : '<span class="st pos plain">ATIVO</span>'}</span></div>`).join('')}
      </div>`).join('');
  }

  const arquivados = () => listaEmpresas(true);

  function historico() {
    const B = biz();
    return `<div class="panel"><div class="sect-h" style="margin-top:0"><span class="h2">Histórico e auditoria</span><span class="src">${B.audit.length} registro(s) — usuário, data, antes/depois, motivo</span></div>
      ${B.audit.slice().reverse().slice(0, 40).map(a => `<div class="exec-li"><span class="sig"></span>
        <div class="t"><b>${UI.esc(a.acao)}</b><span>${UI.esc(a.detalhe)} · ${a.em} · ${UI.esc(a.usuario)}${a.motivo ? ' · motivo: ' + UI.esc(a.motivo) : ''}${a.impacto ? ' · ' + UI.esc(a.impacto) : ''}</span></div></div>`).join('')}</div>`;
  }

  /* ---------- drawer da empresa ---------- */
  function abrir(id) {
    const B = biz();
    const e = B.empresas.find(x => x.id === id);
    if (!e) return;
    const chs = B.canais.filter(c => c.empresaId === id);
    UI.openDrawer(`
      <div class="drawer-h"><div>
        <div class="eyebrow">empresa · ${UI.esc(e.status)} · desde ${e.criadoEm}</div>
        <h2 class="h1" style="font-size:18px">${UI.esc(e.nome)}</h2></div>
        <button class="btn ghost sm" onclick="UI.closeDrawer()">✕ fechar</button></div>
      <dl class="kv">
        <dt>Fantasia · segmento</dt><dd>${UI.esc(e.fantasia || '—')} · ${UI.esc(e.segmento || '—')}</dd>
        <dt>Responsável principal</dt><dd>${UI.esc(e.responsavelPrincipal || '—')}</dd>
        <dt>CNPJ</dt><dd>${UI.esc(e.cnpj || 'não informado — opcional; complete quando quiser')}</dd>
        <dt>Endereço</dt><dd>${UI.esc([(e.endereco || {}).rua, (e.endereco || {}).cidade || e.cidade, (e.endereco || {}).estado || e.estado].filter(Boolean).join(', ') || '—')}</dd>
        <dt>Contatos</dt><dd>${UI.esc(e.telefone || '—')} · ${UI.esc(e.email || (e.contatos || {}).email || '—')}</dd>
        <dt>Responsáveis</dt><dd>${(e.responsaveis || []).map(r => UI.esc(r.nome) + ' (' + UI.esc(r.funcao) + ')').join(' · ') || '—'}</dd>
      </dl>
      <div class="sect-h"><span class="h2">Canais desta empresa (${chs.length})</span></div>
      ${chs.map(c => `<div class="metric-row"><span class="lbl">${UI.esc(c.nome)} <span class="src">· ${UI.esc(c.tipo)}</span></span>
        <span class="val">${UI.stBadge(c.status === 'Ativo' ? 'ATIVO' : c.status)}</span></div>`).join('') || '<p class="src">nenhum canal.</p>'}
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn sm primary" data-act="editar" data-id="${e.id}">Editar empresa</button>
        <button class="btn sm" data-act="addcanal" data-id="${e.id}">Adicionar canal</button>
        <button class="btn sm" data-act="conectar" data-emp="${e.id}">Conectar marketplace</button>
        <button class="btn sm ghost" data-act="verhist" data-id="${e.id}">Ver histórico</button>
      </div>`);
    UI.$('#drawer').onclick = onClick;
  }

  /* ---------- formulário Nova Empresa (blocos) ---------- */
  function formEmpresa(e) {
    e = e || {};
    const inp = (id, label, val, ph) => `<label style="display:block;margin-top:8px"><span class="eyebrow">${label}</span><br>
      <input class="input" id="${id}" style="width:100%;margin-top:3px" value="${UI.esc(val ?? '')}" placeholder="${ph || ''}"></label>`;
    UI.openModal(`<div class="editor"><h3 class="h2">${e.id ? 'Editar empresa' : 'Nova Empresa'}</h3>
      <p class="sub" style="margin-top:4px">Só <b>nome</b> e <b>responsável</b> são obrigatórios — CNPJ, endereço e fiscal podem vir depois.</p>
      <div class="sect-h"><span class="h2">1 · Dados principais</span></div>
      ${inp('feNome', 'Nome da empresa *', e.nome)}${inp('feFant', 'Nome fantasia', e.fantasia)}
      ${inp('feSeg', 'Segmento', e.segmento, 'ex.: Casa e Decoração')}${inp('feResp', 'Responsável principal *', e.responsavelPrincipal)}
      <div class="sect-h"><span class="h2">2 · Dados legais e fiscais (opcionais)</span></div>
      ${inp('feCnpj', 'CNPJ (opcional)', e.cnpj, 'dá para operar sem — complete depois')}${inp('feRegime', 'Regime tributário', e.regimeTributario)}
      <div class="sect-h"><span class="h2">3 · Endereço</span></div>
      ${inp('feCidade', 'Cidade', e.cidade)}${inp('feUf', 'Estado', e.estado)}
      <div class="sect-h"><span class="h2">4 · Contatos</span></div>
      ${inp('feTel', 'Telefone principal', e.telefone)}${inp('feEmail', 'E-mail geral', e.email)}
      <div class="sect-h"><span class="h2">5 · Observações internas</span></div>
      ${inp('feObs', 'Observações da operação', (e.obs || {}).operacao)}
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="feOk">${e.id ? 'Salvar edição' : 'Criar empresa'}</button></div></div>`);
    UI.$('#feOk').onclick = () => {
      const g = id => UI.$('#' + id).value.trim() || null;
      const dados = { nome: g('feNome'), fantasia: g('feFant'), segmento: g('feSeg'), responsavelPrincipal: g('feResp'),
        cnpj: g('feCnpj'), regimeTributario: g('feRegime'), cidade: g('feCidade'), estado: g('feUf'),
        telefone: g('feTel'), email: g('feEmail'), obs: { operacao: g('feObs') } };
      if (e.id) {
        for (const [k, v] of Object.entries(dados)) if (k !== 'obs' && String(e[k] ?? '') !== String(v ?? ''))
          V8BIZ.editEmpresa(biz(), e.id, k, v, { usuario: D.meta.usuario, papel: papel(), motivo: 'edição pelo formulário' });
        UI.closeModal(); UI.toast('Empresa atualizada — cada campo alterado ficou na auditoria.', 'ok'); body(); return;
      }
      const r = V8BIZ.createEmpresa(biz(), dados, { usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.closeModal(); UI.renderGbar();
      UI.toast(`"${r.empresa.nome}" criada${r.empresa.cnpj ? '' : ' sem CNPJ (opcional)'} — já disponível nos filtros globais.`, 'ok');
      EMP.sub = 'Empresas'; body();
    };
  }

  function formCanal(empresaId) {
    UI.openModal(`<h3 class="h2">Adicionar Canal de Venda</h3>
      <p class="sub" style="margin-top:4px">Empresa: <b>${UI.esc(empNome(empresaId))}</b>. O canal entra nos filtros globais automaticamente.</p>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Nome do canal *</span><br><input class="input" id="fcNome" style="width:100%;margin-top:3px" placeholder="ex.: Shopee Líder Molduras MG"></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Tipo de canal *</span><br>
        <select class="select" id="fcTipo" style="width:100%;margin-top:3px">${V8BIZ.TIPOS_CANAL.map(t => `<option>${t}</option>`).join('')}</select></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Responsável do canal</span><br><input class="input" id="fcResp" style="width:100%;margin-top:3px"></label>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="fcOk">Criar canal</button></div>`);
    UI.$('#fcOk').onclick = () => {
      const r = V8BIZ.addCanal(biz(), empresaId, { nome: UI.$('#fcNome').value.trim(), tipo: UI.$('#fcTipo').value, responsavel: UI.$('#fcResp').value.trim() || null }, { usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.closeModal(); UI.renderGbar();
      UI.toast(`Canal "${r.canal.nome}" criado — já nos filtros globais.`, 'ok');
      EMP.sub = 'Canais de Venda'; body();
    };
  }

  function fluxoConectar(pre) {
    pre = pre || {};
    const B = biz();
    const emps = B.empresas.filter(e => e.status === 'Ativa' || e.status === 'Em configuração');
    UI.openModal(`<h3 class="h2">Conectar Marketplace</h3>
      <p class="sub" style="margin-top:4px">1 empresa → 2 canal → 3 marketplace → 4 conta → OAuth. <b>Sem empresa e canal definidos, nada é conectado.</b> Modo: Leitura · Escrita externa: Bloqueada.</p>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Empresa *</span><br>
        <select class="select" id="cxEmp" style="width:100%;margin-top:3px">${emps.map(e => `<option value="${e.id}" ${pre.emp === e.id ? 'selected' : ''}>${UI.esc(e.nome)}</option>`).join('')}</select></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Canal de venda *</span><br>
        <select class="select" id="cxCanal" style="width:100%;margin-top:3px"></select></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Marketplace</span><br>
        <select class="select" id="cxMkt" style="width:100%;margin-top:3px">${['shopee', 'ml', 'tiktok', 'magalu'].map(m => `<option>${m}</option>`).join('')}</select></label>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="cxOk">Iniciar OAuth (leitura)</button></div>`);
    const fill = () => {
      const eid = UI.$('#cxEmp').value;
      UI.$('#cxCanal').innerHTML = B.canais.filter(c => c.empresaId === eid && c.status !== 'Arquivado')
        .map(c => `<option value="${c.id}" ${pre.canal === c.id ? 'selected' : ''}>${UI.esc(c.nome)}</option>`).join('') || '<option value="">— crie um canal primeiro —</option>';
    };
    fill(); UI.$('#cxEmp').onchange = fill;
    UI.$('#cxOk').onclick = () => {
      const r = V8BIZ.connectOAuth(biz(), { empresaId: UI.$('#cxEmp').value, canalId: UI.$('#cxCanal').value || null, marketplace: UI.$('#cxMkt').value, contaId: pre.conta || null }, { usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.closeModal();
      UI.openModal(`<h3 class="h2">Conexão registrada — aguardando autorização real</h3>
        <dl class="kv" style="margin-top:8px">
          <dt>Empresa</dt><dd>${UI.esc(r.contexto.empresa)}</dd>
          <dt>Canal</dt><dd>${UI.esc(r.contexto.canal)}</dd>
          <dt>Marketplace</dt><dd>${UI.esc(r.contexto.marketplace)}</dd>
          <dt>Modo</dt><dd>${UI.esc(r.contexto.modo)}</dd>
          <dt>Escrita externa</dt><dd><span class="st neg plain">${UI.esc(r.contexto.escrita.toUpperCase())}</span></dd>
        </dl>
        <p class="src" style="margin-top:8px">${UI.esc(r.nota)}</p>
        <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" onclick="UI.closeModal()">entendi</button></div>`);
      EMP.sub = 'Integrações'; body();
    };
  }

  /* ---------- eventos ---------- */
  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (act === 'sub') { EMP.sub = b.dataset.sub; UI.$('#crumb').textContent = 'Empresas e Operações · ' + EMP.sub; render(EMP.sub); }
    else if (act === 'nova') formEmpresa();
    else if (act === 'abrir') abrir(id);
    else if (act === 'editar') { UI.closeDrawer(); formEmpresa(biz().empresas.find(x => x.id === id)); }
    else if (act === 'addcanal') { UI.closeDrawer(); formCanal(id); }
    else if (act === 'addresp') {
      UI.openModal(`<h3 class="h2">Adicionar responsável</h3>
        ${[['frNome', 'Nome'], ['frFunc', 'Função (' + V8BIZ.FUNCOES.slice(0, 4).join(', ') + '…)'], ['frTel', 'Telefone'], ['frEmail', 'E-mail']].map(([i, l]) => `<label style="display:block;margin-top:8px"><span class="eyebrow">${l}</span><br><input class="input" id="${i}" style="width:100%;margin-top:3px"></label>`).join('')}
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end"><button class="btn ghost" onclick="UI.closeModal()">cancelar</button><button class="btn primary" id="frOk">Adicionar</button></div>`);
      UI.$('#frOk').onclick = () => {
        const emp2 = biz().empresas.find(x => x.id === id);
        emp2.responsaveis.push({ nome: UI.$('#frNome').value.trim(), funcao: UI.$('#frFunc').value.trim() || 'Outro', telefone: UI.$('#frTel').value.trim() || null, email: UI.$('#frEmail').value.trim() || null, ativo: true });
        biz()._audit('responsavel_adicionado', emp2.nome + ' → ' + UI.$('#frNome').value.trim(), { usuario: D.meta.usuario });
        UI.closeModal(); UI.toast('Responsável adicionado.', 'ok'); body();
      };
    }
    else if (act === 'editcanal') {
      const c = biz().canais.find(x => x.id === id);
      UI.openModal(`<h3 class="h2">Editar canal · ${UI.esc(c.nome)}</h3>
        <label style="display:block;margin-top:8px"><span class="eyebrow">Nome</span><br><input class="input" id="ecNome" style="width:100%;margin-top:3px" value="${UI.esc(c.nome)}"></label>
        <label style="display:block;margin-top:8px"><span class="eyebrow">Responsável</span><br><input class="input" id="ecResp" style="width:100%;margin-top:3px" value="${UI.esc(c.responsavel || '')}"></label>
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end"><button class="btn ghost" onclick="UI.closeModal()">cancelar</button><button class="btn primary" id="ecOk">Salvar</button></div>`);
      UI.$('#ecOk').onclick = () => {
        for (const [campo, iid] of [['nome', 'ecNome'], ['responsavel', 'ecResp']]) {
          const v = UI.$('#' + iid).value.trim();
          if (v && v !== String(c[campo] ?? '')) V8BIZ.editCanal(biz(), id, campo, v, { usuario: D.meta.usuario, papel: papel() });
        }
        UI.closeModal(); UI.renderGbar(); UI.toast('Canal atualizado — auditado.', 'ok'); body();
      };
    }
    else if (act === 'descanal') pedirMotivo('Desativar canal', motivo => {
      const r = V8BIZ.statusCanal(biz(), id, 'Desativado', { motivo, usuario: D.meta.usuario, papel: papel() });
      r.blocked ? UI.toast(r.reason, 'err') : (UI.toast('Canal desativado — histórico preservado.', 'ok'), body());
    });
    else if (act === 'desativar') pedirMotivo('Desativar empresa', motivo => {
      const r = V8BIZ.desativarEmpresa(biz(), id, { motivo, usuario: D.meta.usuario, papel: papel() });
      r.blocked ? UI.toast(r.reason, 'err') : (UI.toast(r.nota, 'ok'), body());
    });
    else if (act === 'arquivar') pedirMotivo('Arquivar empresa', motivo => {
      const r = V8BIZ.arquivarEmpresa(biz(), id, { motivo, usuario: D.meta.usuario, papel: papel() });
      r.blocked ? UI.toast(r.reason, 'err') : (UI.toast('Arquivada — fora das listas, dados preservados.', 'ok'), body());
    });
    else if (act === 'reativar') {
      const r = V8BIZ.reativarEmpresa(biz(), id, { usuario: D.meta.usuario, papel: papel() });
      r.blocked ? UI.toast(r.reason, 'err') : (UI.toast(r.nota, 'ok'), body());
    }
    else if (act === 'excluir') {
      const nome = empNome(id);
      UI.openModal(`<h3 class="h2">Excluir empresa</h3>
        <p class="sub" style="margin-top:4px">Só empresa <b>sem</b> pedidos, catálogo, importações, custos ou histórico pode ser excluída definitivamente. Caso contrário, o sistema vai recusar e sugerir arquivar.</p>
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
          <button class="btn danger" id="exOk">Confirmar exclusão de "${UI.esc(nome)}"</button></div>`);
      UI.$('#exOk').onclick = () => {
        const r = V8BIZ.excluirEmpresa(biz(), id, { confirmado: true, usuario: D.meta.usuario, papel: papel() });
        UI.closeModal();
        r.blocked ? UI.toast(r.reason, 'err') : (UI.renderGbar(), UI.toast('Empresa vazia excluída — confirmado e auditado.', 'ok'));
        body();
      };
    }
    else if (act === 'conectar') fluxoConectar({ emp: b.dataset.emp, canal: b.dataset.canal, conta: b.dataset.conta });
    else if (act === 'goconx') UI.go('conexoes');
    else if (act === 'verhist') { UI.closeDrawer(); EMP.sub = 'Histórico e Auditoria'; render(EMP.sub); }
  }

  function pedirMotivo(titulo, cb) {
    UI.openModal(`<h3 class="h2">${titulo}</h3>
      <p class="sub" style="margin-top:4px">Motivo obrigatório — fica na auditoria. Dados e histórico são preservados.</p>
      <input class="input" id="pmMotivo" style="width:100%;margin-top:10px" placeholder="ex.: operação pausada neste trimestre">
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn danger" id="pmOk">Confirmar</button></div>`);
    UI.$('#pmOk').onclick = () => { const m = UI.$('#pmMotivo').value.trim(); UI.closeModal(); cb(m); };
  }

  UI.renderers.empresas = render;

  /* ---------- auto-teste (?empself=1) ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('empself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('empresas');
      need(EMP.sub === 'Visão Geral', 'abre na visão geral');
      const B = biz();
      /* cadastro manual sem CNPJ */
      const r = V8BIZ.createEmpresa(B, { nome: 'Empresa Self', responsavelPrincipal: 'Ana', telefone: '31 9', email: 'a@b.c' }, {});
      need(r.ok && !r.empresa.cnpj, 'empresa criada sem CNPJ (opcional)');
      need(D.scope.empresas.some(x => x.nome === 'Empresa Self'), 'empresa no filtro global');
      const c1 = V8BIZ.addCanal(B, r.empresa.id, { nome: 'Shopee Self', tipo: 'Shopee' }, {});
      const c2 = V8BIZ.addCanal(B, r.empresa.id, { nome: 'ML Self', tipo: 'Mercado Livre' }, {});
      const c3 = V8BIZ.addCanal(B, r.empresa.id, { nome: 'Física Self', tipo: 'Loja Física' }, {});
      need(c1.ok && c2.ok && c3.ok, 'Shopee + ML + física na mesma empresa');
      need(D.scope.lojas.some(l => l.nome === 'Shopee Self'), 'canal no filtro global');
      need(V8BIZ.connectOAuth(B, { empresaId: r.empresa.id }, {}).blocked, 'OAuth sem canal recusado');
      const oa = V8BIZ.connectOAuth(B, { empresaId: r.empresa.id, canalId: c1.canal.id, marketplace: 'shopee' }, {});
      need(oa.ok && oa.conta.canalId === c1.canal.id, 'conta vinculada ao canal certo');
      need(V8BIZ.excluirEmpresa(B, 'e1', { confirmado: true }).blocked, 'empresa com dados não apaga');
      V8BIZ.arquivarEmpresa(B, r.empresa.id, { motivo: 'self-test' });
      need(!V8BIZ.empresasVisiveis(B).some(x => x.id === r.empresa.id), 'arquivada some do filtro padrão');
      V8BIZ.reativarEmpresa(B, r.empresa.id, {});
      EMP.sub = 'Empresas'; body();
      need(UI.$('#empBody').textContent.includes('Empresa Self'), 'lista mostra a empresa');
      EMP.sub = 'Visão Geral'; body();
      document.body.dataset.empselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e2) { document.body.dataset.empselfReady = 'fail: ' + e2.message; }
  });
}());
