/* =============================================================
   v8 · ADMINISTRAÇÃO DA CONTA (10.V)
   Ativação · Equipe · Planos · Suporte — sobre a conta comercial
   (V8COM). Enforcement real de papéis; upgrade vira solicitação
   interna auditável; suporte com estados honestos.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA;
  const acc = () => UI.account;

  /* ---------------- ATIVAÇÃO ---------------- */
  function ativacao() {
    const a = acc();
    const check = V8COM.activationChecklist(a);
    const prog = V8COM.activationProgress(a);
    const CTA_REF = {
      'criar empresa no onboarding': 'ativacao:', 'adicionar CNPJ': 'ativacao:', 'adicionar loja': 'ativacao:',
      'convidar pessoa': 'equipe:', 'selecionar marketplaces': 'conexoes:', 'iniciar conexão de leitura': 'conexoes:',
      'importar ou criar produtos': 'catalogo:', 'revisar um produto': 'catalogo:', 'informar custo e preço': 'catalogo:',
      'preencher estoque por loja': 'catalogo:', 'criar rascunho interno': 'crescimento:', 'concluir uma missão': 'missao:',
      'abrir Crescimento · Resultados': 'crescimento:',
    };
    UI.$('#v-ativacao').innerHTML = `
      <div class="eyebrow">ativação · progresso da sua operação</div>
      <h1 class="h1">Ativação</h1>
      <p class="sub" style="margin-top:6px">O caminho entre criar a conta e operar de verdade — cada item diz o que destrava, quem é o responsável e o que está bloqueando.</p>
      <div class="panel sect" style="max-width:560px">
        <div class="sect-h" style="margin-top:0"><span class="h2">${prog.feitos} de ${prog.total} passos</span><span class="src">${prog.pct}% · ${UI.esc(a.status)}</span></div>
        <div class="actbar"><span style="width:${prog.pct}%"></span></div>
        <span class="src">modo: ${a.modo === 'DEMONSTRACAO' ? 'DEMONSTRAÇÃO (dados fictícios rotulados)' : 'OPERAÇÃO REAL'}</span>
      </div>
      <div class="tblwrap sect"><table class="tbl"><thead><tr>
        <th class="nosort">Passo</th><th class="nosort">Status</th><th class="nosort">Responsável</th><th class="nosort">Bloqueio</th><th class="nosort">Impacto</th><th class="nosort">Ação</th></tr></thead><tbody>
        ${check.map(c => `<tr>
          <td class="tmain">${UI.esc(c.item)}</td>
          <td>${c.feito ? '<span class="st pos">concluído</span>' : '<span class="st warn">pendente</span>'}</td>
          <td><span class="src">${UI.esc(c.responsavel)}</span></td>
          <td>${c.bloqueio ? `<span class="st neg plain">${UI.esc(c.bloqueio)}</span>` : '<span class="src">—</span>'}</td>
          <td><span class="src" title="Por que este passo importa">${UI.esc(c.impacto)}</span></td>
          <td>${c.feito ? '' : `<button class="btn sm" data-act="cta" data-ref="${CTA_REF[c.cta] || 'ativacao:'}" title="${UI.esc(c.cta)}">${UI.esc(c.cta)}</button>`}</td>
        </tr>`).join('')}
      </tbody></table></div>
      <div class="callout sect">Precisa de ajuda para ativar? <button class="linklike" data-act="assist">solicitar ativação assistida →</button> — vira solicitação interna com estado honesto (sem promessa de resposta em tempo real).</div>`;
    UI.$('#v-ativacao').onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'cta') UI.open(b.dataset.ref);
      else if (b.dataset.act === 'assist') {
        V8COM.createTicket(acc(), { tipo: 'ativação assistida', msg: 'Solicitada pelo checklist de ativação' });
        UI.toast('Solicitação de ativação assistida criada — acompanhe em Suporte.', 'ok');
        UI.go('suporte');
      }
    };
  }

  /* ---------------- EQUIPE ---------------- */
  function equipe() {
    const a = acc();
    const podeConvidar = V8COM.can(a.user.papel, 'convidar');
    const nomeEmp = id => (a.escopo.empresas.find(e => e.id === id) || { nome: id }).nome;
    UI.$('#v-equipe').innerHTML = `
      <div class="eyebrow">equipe · pessoas, papéis e escopo</div>
      <h1 class="h1">Equipe</h1>
      <p class="sub" style="margin-top:6px">Cada pessoa tem papel (o que pode fazer) e escopo (quais empresas, CNPJs e lojas vê). Permissão aqui é enforcement, não decoração.</p>
      <div class="fbar sect">
        ${podeConvidar ? `<button class="btn primary sm" data-act="convidar">convidar pessoa</button>` : `<button class="btn sm" disabled title="Seu papel (${UI.esc(a.user.papel)}) não pode convidar pessoas — peça a um ADMIN ou OWNER.">convidar pessoa</button>`}
        <span class="src">${1 + a.membros.length} membro(s) · ${a.convites.filter(c => c.status !== 'aceito' && c.status !== 'cancelado').length} convite(s) pendente(s)</span></div>
      <div class="tblwrap"><table class="tbl"><thead><tr>
        <th class="nosort">Pessoa</th><th class="nosort">Papel</th><th class="nosort">Escopo</th><th class="nosort">Última atividade</th><th class="nosort">Carga (missões)</th><th class="nosort">Status</th><th class="nosort">Ações</th></tr></thead><tbody>
        <tr><td class="tmain">${UI.esc(a.user.nome)} ${UI.esc(a.user.sobrenome)}<span class="tsub">${UI.esc(a.user.email)}</span></td>
          <td><span class="st info plain">OWNER</span></td><td><span class="src">tudo do grupo</span></td>
          <td><span class="src">${D.meta.hoje}</span></td><td>${D.missoes.length}</td><td><span class="st pos">ativo</span></td><td><span class="src">—</span></td></tr>
        ${a.membros.map(m => `<tr>
          <td class="tmain">${UI.esc(m.email)}</td>
          <td><span class="st info plain">${UI.esc(m.papel)}</span></td>
          <td><span class="src" title="Empresas: ${UI.esc((m.escopo.empresas || []).map(nomeEmp).join(', ') || 'todas')}">${(m.escopo.empresas || []).length || 'todas'} empresa(s) · ${(m.escopo.lojas || []).length || 'todas'} loja(s)</span></td>
          <td><span class="src">${m.ultimaAtividade}</span></td><td>${m.missoes}</td><td><span class="st pos">ativo</span></td>
          <td><span class="rowact">
            <button class="btn sm ghost" data-act="papel" data-id="${m.id}">editar papel</button>
            <button class="btn sm ghost" data-act="transferir" data-id="${m.id}">transferir missões</button>
            <button class="btn sm danger" data-act="remover" data-id="${m.id}">remover</button></span></td></tr>`).join('')}
        ${a.convites.filter(c => c.status !== 'aceito').map(c => `<tr>
          <td class="tmain">${UI.esc(c.email)}<span class="tsub">convite</span></td>
          <td><span class="st info plain">${UI.esc(c.papel)}</span></td>
          <td><span class="src">${c.escopo.empresas.length} empresa(s)</span></td>
          <td><span class="src">—</span></td><td>—</td>
          <td>${c.status === 'cancelado' ? '<span class="st">cancelado</span>' : `<span class="st warn">${UI.esc(c.status)}</span>`}</td>
          <td><span class="rowact">${c.status !== 'cancelado' ? `
            <button class="btn sm ghost" data-act="aceitar" data-id="${c.id}" title="simula o aceite do convidado (sem e-mail real neste modo)">simular aceite</button>
            <button class="btn sm ghost" data-act="reenviar" data-id="${c.id}">reenviar</button>
            <button class="btn sm ghost" data-act="cancelar" data-id="${c.id}">cancelar</button>` : ''}</span></td></tr>`).join('')}
      </tbody></table><div class="tfoot"><span>papéis: ${Object.keys(V8COM.ROLES).join(' · ')}</span></div></div>`;
    UI.$('#v-equipe').onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a2 = acc();
      if (b.dataset.act === 'convidar') openInvite();
      else if (b.dataset.act === 'aceitar') { V8COM.acceptInvite(a2, b.dataset.id); UI.toast('Convite aceito (simulado) — pessoa ativa na equipe.', 'ok'); equipe(); }
      else if (b.dataset.act === 'reenviar') { V8COM.resendInvite(a2, b.dataset.id); UI.toast('Convite reenviado.', 'ok'); equipe(); }
      else if (b.dataset.act === 'cancelar') { V8COM.cancelInvite(a2, b.dataset.id); UI.toast('Convite cancelado.', ''); equipe(); }
      else if (b.dataset.act === 'remover') { V8COM.removeAccess(a2, b.dataset.id); UI.toast('Acesso removido — auditado.', 'ok'); equipe(); }
      else if (b.dataset.act === 'transferir') { UI.toast('Transferência de responsabilidade registrada na trilha (simulado).', 'ok'); V8COM._audit(a2, 'missoes_transferidas', b.dataset.id); }
      else if (b.dataset.act === 'papel') {
        const m = a2.membros.find(x => x.id === b.dataset.id);
        UI.openModal(`<h3 class="h2">Editar papel · ${UI.esc(m.email)}</h3>
          <select class="select" id="rlSel" style="width:100%;margin-top:12px">${Object.keys(V8COM.ROLES).map(r => `<option ${m.papel === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
          <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn primary" id="rlOk">Salvar papel</button></div>`);
        UI.$('#rlOk').onclick = () => { V8COM.setRole(a2, m.id, UI.$('#rlSel').value); UI.closeModal(); UI.toast('Papel atualizado — auditado.', 'ok'); equipe(); };
      }
    };
  }

  function openInvite() {
    const a = acc();
    UI.openModal(`<h3 class="h2">Convidar pessoa</h3>
      <p class="sub" style="margin-top:4px">Papel define o que pode fazer; escopo define o que vê. Sem e-mail real neste modo.</p>
      <label style="display:block;margin-top:10px"><span class="eyebrow">E-mail</span><br><input class="input" id="ivEmail" style="width:100%;margin-top:3px" placeholder="pessoa@empresa.com.br"></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Papel</span><br><select class="select" id="ivPapel" style="width:100%;margin-top:3px">${Object.keys(V8COM.ROLES).filter(r => r !== 'OWNER').map(r => `<option>${r}</option>`).join('')}</select></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Escopo (empresas)</span><br><select class="select" id="ivEmp" style="width:100%;margin-top:3px">
        <option value="">todas as empresas do grupo</option>
        ${a.escopo.empresas.map(e => `<option value="${e.id}">${UI.esc(e.nome)}</option>`).join('')}</select></label>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="ivGo">Enviar convite</button></div>`);
    UI.$('#ivGo').onclick = () => {
      try {
        const emp = UI.$('#ivEmp').value;
        V8COM.invite(acc(), { email: UI.$('#ivEmail').value.trim(), papel: UI.$('#ivPapel').value, escopo: emp ? { empresas: [emp] } : null });
        UI.closeModal(); UI.toast('Convite criado e auditado.', 'ok'); equipe();
      } catch (err) { UI.toast(err.message, 'err'); }
    };
  }

  /* ---------------- PLANOS ---------------- */
  function planos() {
    const a = acc();
    const uso = V8COM.usage(a);
    const st = V8COM.trialStatus(a);
    const diasRest = V8COM.trialDaysLeft(a);
    const podePlano = V8COM.can(a.user.papel, 'alterarPlano');
    UI.$('#v-planos').innerHTML = `
      <div class="eyebrow">planos · uso e limites</div>
      <h1 class="h1">Planos</h1>
      <p class="sub" style="margin-top:6px">Sem cobrança real neste modo: upgrade cria uma <b>solicitação interna auditável</b>. Trial expirado limita o acesso mas <b>nunca apaga seus dados</b>.</p>

      <div class="grid3 sect">
        <div class="panel"><div class="eyebrow">plano atual</div><div class="h1" style="font-size:19px">${a.plano === 'TRIAL' ? 'Trial (base Pro)' : V8COM.PLANS[a.plano].nome}</div>
          ${a.plano === 'TRIAL' ? `${UI.stBadge(st === 'TRIAL ATIVO' ? 'EM PROCESSAMENTO' : st === 'TRIAL EXPIRANDO' ? 'AGUARDANDO APROVAÇÃO' : 'BLOQUEADO')}<span class="src" style="display:block;margin-top:6px">${diasRest} dia(s) restante(s) · expira em ${a.trial.expiraEm}</span>` : '<span class="st pos">ativo</span>'}</div>
        <div class="panel"><div class="eyebrow">uso atual</div>
          <div class="metric-row"><span class="lbl">Empresas · CNPJs · Lojas</span><span class="val">${uso.empresas} · ${uso.cnpjs} · ${uso.lojas}</span></div>
          <div class="metric-row"><span class="lbl">Usuários</span><span class="val">${uso.usuarios}</span></div>
          <div class="metric-row"><span class="lbl">Marketplaces</span><span class="val">${uso.marketplaces}</span></div></div>
        <div class="panel"><div class="eyebrow">histórico</div>
          ${a.planoHistorico.map(h => `<div class="metric-row"><span class="lbl">${h.plano}</span><span class="val src">${h.em} · ${UI.esc(h.origem)}</span></div>`).join('')}
          ${a.solicitacoes.filter(s => s.tipo === 'UPGRADE').map(s => `<div class="metric-row"><span class="lbl">pedido: ${s.plano}</span><span class="val">${UI.stBadge('EM REVISÃO')}</span></div>`).join('')}</div>
      </div>

      <div class="plangrid">
        ${Object.entries(V8COM.PLANS).map(([key, p]) => `
        <div class="plancard ${key === 'PRO' ? 'dest' : ''}">
          <span class="pnome">${p.nome}</span><span class="ppara">${UI.esc(p.para)}</span>
          <ul>
            <li>${p.limites.empresas} empresa(s) · ${p.limites.cnpjs} CNPJ(s) · ${p.limites.lojas} loja(s)</li>
            <li>${p.limites.usuarios} usuário(s) · ${p.limites.marketplaces} marketplace(s)</li>
            <li>catálogo até ${p.limites.catalogo} · ${p.limites.missoesMes} missões/mês</li>
            <li>inteligência ${p.recursos.inteligencia}</li>
            <li>integrações: ${p.recursos.integracoes}</li>
            <li>WhatsApp ${p.recursos.whatsapp ? 'incluído' : '—'} · auditoria ${p.recursos.auditoria ? 'incluída' : '—'}</li>
            <li>suporte ${p.recursos.suporte}</li>
            ${p.emBreve.length ? `<li><span class="st warn plain">em breve: ${p.emBreve.join(', ')}</span></li>` : ''}
          </ul>
          <span style="flex:1"></span>
          ${key === 'ENTERPRISE'
            ? `<button class="btn sm" data-act="enterprise">solicitar contato empresarial</button>`
            : podePlano
              ? `<button class="btn sm ${key === 'PRO' ? 'primary' : ''}" data-act="upgrade" data-plano="${key}">solicitar ${p.nome}</button>`
              : `<button class="btn sm" disabled title="Apenas OWNER pode alterar o plano — seu papel é ${UI.esc(a.user.papel)}.">solicitar ${p.nome}</button>`}
        </div>`).join('')}
      </div>
      <p class="src" style="margin-top:10px">Nenhum valor é cobrado neste modo; nenhum cartão é coletado. Assinatura real chega em sprint futuro com infraestrutura própria.</p>`;
    UI.$('#v-planos').onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'upgrade') {
        const s = V8COM.requestUpgrade(acc(), b.dataset.plano);
        UI.toast(`Solicitação ${s.id} criada (${s.plano}) · ${s.status} · ${s.cobranca}.`, 'ok');
        planos();
      } else if (b.dataset.act === 'enterprise') {
        V8COM.createTicket(acc(), { tipo: 'suporte', msg: 'Contato para plano Enterprise' });
        UI.toast('Solicitação de contato empresarial criada — acompanhe em Suporte.', 'ok');
      }
    };
  }

  /* ---------------- SUPORTE ---------------- */
  const SUP = { sub: 'Central de ajuda' };
  const GUIAS = [
    ['Estruturar grupo, empresa, CNPJ e lojas', 'ativacao:'], ['Importar ou criar o catálogo', 'catalogo:'],
    ['Entender pedidos não pagos', 'crescimento:naopagos'], ['Comparar lojas', 'crescimento:'],
    ['Convidar equipe com escopo', 'equipe:'], ['Conectar marketplace (leitura primeiro)', 'conexoes:'],
  ];
  const AJUDA = [
    ['O que o Head Marketplace faz?', 'Central de inteligência, operação, crescimento e decisão para quem vende em marketplaces — catálogo, anúncios, margem, riscos, oportunidades e expansão em vários CNPJs e lojas.'],
    ['Conectar marketplace publica algo?', 'Não. Conexão começa somente com leitura; escrita externa é permissão separada, bloqueada por padrão e liberada gate a gate com sua aprovação.'],
    ['O que acontece quando o trial expira?', 'O acesso fica limitado, mas nada é apagado. Seus dados ficam preservados e você pode solicitar um plano a qualquer momento.'],
    ['Dados demonstrativos se misturam aos meus?', 'Nunca. Demonstração é um modo explícito e rotulado; o sistema recusa anexar dado fictício a empresa real.'],
  ];
  function suporte() {
    const a = acc();
    const SUBS = ['Central de ajuda', 'Guias rápidos', 'Status de ativação', 'Solicitar', 'Histórico'];
    let body = '';
    if (SUP.sub === 'Central de ajuda') body = `<div class="faq panel">${AJUDA.map(([q, r]) => `<details><summary>${UI.esc(q)}</summary><p>${UI.esc(r)}</p></details>`).join('')}</div>`;
    else if (SUP.sub === 'Guias rápidos') body = `<div class="panel">${GUIAS.map(([g, ref]) => `<div class="exec-li"><span class="sig"></span><div class="t"><b>${UI.esc(g)}</b></div><button class="linklike" data-act="cta" data-ref="${ref}">abrir →</button></div>`).join('')}</div>`;
    else if (SUP.sub === 'Status de ativação') { const p = V8COM.activationProgress(a); body = `<div class="panel"><div class="sect-h" style="margin-top:0"><span class="h2">${p.feitos}/${p.total} passos (${p.pct}%)</span><button class="linklike" data-act="cta" data-ref="ativacao:">abrir checklist →</button></div><div class="actbar"><span style="width:${p.pct}%"></span></div></div>`; }
    else if (SUP.sub === 'Solicitar') body = `
      <div class="panel" style="max-width:560px">
        <label><span class="eyebrow">Tipo</span><br><select class="select" id="tkTipo" style="width:100%;margin-top:3px">${V8COM.TICKET_TIPOS.map(t => `<option>${t}</option>`).join('')}</select></label>
        <label style="display:block;margin-top:8px"><span class="eyebrow">Descrição</span><br><input class="input" id="tkMsg" style="width:100%;margin-top:3px" placeholder="descreva o que precisa"></label>
        <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn primary sm" data-act="ticket">criar solicitação</button></div>
        <p class="src" style="margin-top:8px">Sem promessa de resposta em tempo real neste modo — cada solicitação nasce como "solicitação criada" e muda de estado com honestidade.</p></div>`;
    else body = a.solicitacoes.length ? `<div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr>
        <th class="nosort">Solicitação</th><th class="nosort">Tipo</th><th class="nosort">Status</th><th class="nosort">Criada em</th></tr></thead><tbody>
        ${a.solicitacoes.slice().reverse().map(t => `<tr><td class="tmain">${t.id}<span class="tsub">${UI.esc(t.msg || t.plano || '')}</span></td>
          <td>${UI.esc(t.tipo)}</td><td>${UI.stBadge(t.status === 'solicitação criada' ? 'EM REVISÃO' : t.status)}<span class="tsub">${UI.esc(t.status)}</span></td><td><span class="src">${t.em}</span></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="panel"><div class="empty"><b>Nenhuma solicitação</b>Pedidos de suporte, ativação assistida, integração e treinamento aparecem aqui com estado honesto.</div></div>`;
    UI.$('#v-suporte').innerHTML = `
      <div class="eyebrow">suporte · ajuda e solicitações</div>
      <h1 class="h1">Suporte</h1>
      <div class="tabs" style="margin-top:14px">${SUBS.map(s => `<button class="tab ${SUP.sub === s ? 'on' : ''}" data-act="sub" data-sub="${s}">${s}</button>`).join('')}</div>
      <div style="margin-top:14px">${body}</div>`;
    UI.$('#v-suporte').onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'sub') { SUP.sub = b.dataset.sub; suporte(); }
      else if (b.dataset.act === 'cta') UI.open(b.dataset.ref);
      else if (b.dataset.act === 'ticket') {
        try {
          V8COM.createTicket(acc(), { tipo: UI.$('#tkTipo').value, msg: UI.$('#tkMsg').value.trim() });
          UI.toast('Solicitação criada — estado: "solicitação criada".', 'ok');
          SUP.sub = 'Histórico'; suporte();
        } catch (err) { UI.toast(err.message, 'err'); }
      }
    };
  }

  UI.renderers.ativacao = ativacao;
  UI.renderers.equipe = equipe;
  UI.renderers.planos = planos;
  UI.renderers.suporte = suporte;

  /* ---------- auto-teste (?admself=1) ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('admself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('ativacao');
      need(UI.$$('#v-ativacao tbody tr').length === 13, 'checklist com 13 passos');
      need(UI.$('#v-ativacao').textContent.includes('concluído'), 'passos concluídos marcados');
      UI.go('equipe');
      const nAntes = acc().convites.length;
      V8COM.invite(acc(), { email: 'novo@t.example', papel: 'LEITURA' });
      need(acc().convites.length === nAntes + 1, 'convite criado');
      UI.go('planos');
      need(UI.$('#v-planos').textContent.includes('dia(s) restante(s)'), 'trial mostra dias restantes');
      const nSol = acc().solicitacoes.length;
      UI.$('[data-act="upgrade"][data-plano="PRO"]').click();
      need(acc().solicitacoes.length === nSol + 1 && acc().solicitacoes[acc().solicitacoes.length - 1].cobranca.includes('nenhuma'), 'upgrade = solicitação sem cobrança');
      UI.go('suporte');
      SUP.sub = 'Solicitar'; suporte();
      UI.$('#tkMsg').value = 'teste headless';
      UI.$('[data-act="ticket"]').click();
      need(acc().solicitacoes.some(t => t.msg === 'teste headless' && t.status === 'solicitação criada'), 'ticket criado com estado honesto');
      document.body.dataset.admselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.admselfReady = 'fail: ' + e.message; }
  });
}());
