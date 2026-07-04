/* =============================================================
   v8 · GATE COMERCIAL (10.V) — landing → auth → onboarding → produto
   A landing É conectada ao produto: mesmo design system, mesmo tema,
   e o "print" do hero é o próprio produto renderizado. Sem cobrança,
   sem OAuth real, sem escrita externa. Senha nunca é armazenada.
   ============================================================= */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const GATE = window.GATE = { state: 'landing', ob: { etapa: 1, cnpjs: [], lojas: [], mkts: {}, convites: [] }, acc: null };

  /* ---------------- decisão de exibição ---------------- */
  function shouldShow(params) {
    if (params.get('landing') === '1' || params.get('tela')) return true;
    if (params.get('app') === '1') return false;
    for (const k of params.keys()) if (/self$/.test(k) || k === 'view') return false;
    try { if (localStorage.getItem('v8-visited')) return false; } catch (e) { /* sem storage */ }
    return true;
  }

  function enterApp(view) {
    try { localStorage.setItem('v8-visited', '1'); } catch (e) { /* sem storage */ }
    $('#gate').hidden = true;
    document.body.style.overflow = '';
    if (GATE.acc) UI.account = GATE.acc;
    UI.renderGbar(); UI.refreshBadges();
    UI.go(view || 'home');
  }

  /* ---------------- LANDING ---------------- */
  const PERFIS = ['Vende em ML, Shopee, TikTok Shop ou Magalu', 'Operação com vários CNPJs', 'Várias lojas e contas', 'Marca com catálogo grande', 'Sofre com bloqueio, margem e estoque', 'Head de marketplace', 'Gestor comercial', 'Gestor operacional', 'Diretor ou dono', 'Equipe de catálogo', 'Equipe de expansão', 'Loja física + digital'];
  const DORES = ['Produto publicado em uma loja e esquecido em outra', 'Margem deteriorando sem alerta', 'Anúncio bloqueado sem ninguém ver', 'Estoque acabando no meio da campanha', 'Pedidos não pagos crescendo em silêncio', 'Produto com potencial e sem tráfego', 'Campanha queimando margem', 'Dados espalhados em planilhas', 'Equipe sem responsável definido', 'Várias contas sem visão consolidada', 'Vários CNPJs sem controle central', 'Operação dependendo da memória do dono'];
  const FUNCS = [['Catálogo multiloja', 'um Product Master; estoque, preço e margem por loja'], ['Pedidos não pagos', 'a perda entre pedido criado e pagamento, isolada e explicada'], ['Oportunidades priorizadas', 'evidência, hipótese, impacto e responsável'], ['Missões e execução', 'quem faz, o quê, com trilha auditável'], ['Comparação entre lojas', 'até 4 lojas com aviso de comparabilidade'], ['Experimentos com ponto de parada', 'teste real, nunca achismo'], ['Inteligência explicável', 'playbooks com quando usar e quando NÃO usar'], ['Auditoria por escopo', 'empresa, CNPJ, loja e conta em cada ação']];

  function landing() {
    $('#gate').innerHTML = `
      <nav class="land-nav">
        <div class="mark">H</div><b>Head Marketplace OS</b>
        <span style="flex:1"></span>
        <button class="btn ghost sm" data-g="tela" data-v="login">Entrar</button>
        <button class="btn primary sm" data-g="tela" data-v="signup">Criar minha operação</button>
      </nav>
      <div class="land-wrap">
        <div class="land-hero">
          <span class="eyebrow">para empresas que vendem em marketplaces</span>
          <h1>Pare de administrar marketplaces no escuro.</h1>
          <p>Centralize catálogo, anúncios, margem, estoque, riscos, pedidos não pagos, oportunidades e execução — em vários marketplaces, empresas, CNPJs e lojas, com inteligência prática e rastreabilidade.</p>
          <div class="land-ctas">
            <button class="btn primary" data-g="tela" data-v="signup">Criar minha operação</button>
            <button class="btn" data-g="demo">Ver demonstração</button>
            <button class="btn ghost" data-g="especialista">Falar com especialista</button>
          </div>
        </div>

        <!-- visual do PRODUTO REAL (mesmo design system, não mockup) -->
        <div class="land-mock" aria-label="Visual do produto">
          <div class="lm-bar"><span class="env-pill">DEMONSTRAÇÃO</span><span>Grupo · Empresa · CNPJ · Loja · Conta · Período</span><span style="flex:1"></span><span class="chip chip-demo">DADO SIMULADO · rotulado</span></div>
          <div class="lm-body">
            <div>
              <div class="funrow"><span class="fl">Pedido criado</span><span class="fb"><span style="width:64%"></span></span><span class="fv">158</span></div>
              <div class="funrow loss"><span class="fl">Pedido não pago</span><span class="fb"><span style="width:19%"></span></span><span class="fv">47 · 29,7%</span></div>
              <div class="funrow"><span class="fl">Pagamento aprovado</span><span class="fb"><span style="width:45%"></span></span><span class="fv">111</span></div>
              <div class="metric-row"><span class="lbl">Loja em queda</span><span class="val" style="color:var(--neg)">Shopee Galeria Diamonds −21%</span></div>
              <div class="metric-row"><span class="lbl">Risco principal</span><span class="val">ruptura do item nº 1 em ~5 dias</span></div>
            </div>
            <div>
              <div class="metric-row"><span class="lbl">Decisão pendente</span><span class="st warn">AGUARDANDO APROVAÇÃO</span></div>
              <div class="metric-row"><span class="lbl">Margem por loja</span><span class="val">60,8% · 62,4% · 74,8%</span></div>
              <div class="metric-row"><span class="lbl">Escrita externa</span><span class="st neg">BLOQUEADA</span></div>
              <div class="metric-row"><span class="lbl">Auditoria</span><span class="st pos">cada ação com autor</span></div>
            </div>
          </div>
        </div>

        <section class="land-sect"><span class="eyebrow">o problema</span><h2 class="h1">O que quebra uma operação de marketplace</h2>
          <div class="land-grid">${DORES.map(d => `<div class="land-card"><p>— ${esc(d)}</p></div>`).join('')}</div></section>

        <section class="land-sect"><span class="eyebrow">a solução</span><h2 class="h1">Uma central de inteligência, operação, crescimento e decisão</h2>
          <div class="land-grid">${FUNCS.map(([t, d]) => `<div class="land-card"><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div></section>

        <section class="land-sect"><span class="eyebrow">como funciona</span><h2 class="h1">Da conta ao controle em 7 passos</h2>
          <div class="land-steps">
            ${['Crie seu grupo', 'Cadastre empresas, CNPJs e lojas', 'Adicione seus marketplaces e contas', 'Importe ou conecte dados (leitura primeiro)', 'O Head organiza riscos, oportunidades e pendências', 'Sua equipe executa missões com responsável', 'Você acompanha resultado, margem e expansão'].map(s => `<div class="land-step">${esc(s)}</div>`).join('')}
          </div></section>

        <section class="land-sect"><span class="eyebrow">multiempresa · multiCNPJ · multiloja</span><h2 class="h1">Feito para operações de verdade</h2>
          <div class="land-grid g2">
            <div class="land-card"><b>Escopo hierárquico</b><p>Grupo → Empresa → CNPJ → Loja → Conta. Selecionar um nível limita o seguinte; nenhuma soma esconde quem entrou nela.</p></div>
            <div class="land-card"><b>Isolamento real</b><p>Dados de uma empresa nunca vazam para outra. Visões salvas, jobs e auditoria respeitam o escopo — sempre.</p></div>
            <div class="land-card"><b>Segurança e controle</b><p>READ_ONLY por padrão. Conectar marketplace autoriza leitura; escrita externa é permissão separada, bloqueada até você aprovar gate a gate.</p></div>
            <div class="land-card"><b>Sem promessas mágicas</b><p>Nada de resultado garantido: o Head mostra fato, evidência e hipótese — e diz SEM DADOS quando não sabe.</p></div>
          </div></section>

        <section class="land-sect"><span class="eyebrow">para quem é</span><h2 class="h1">Casos de uso</h2>
          <div class="fbar" style="margin-top:14px">${PERFIS.map(p => `<span class="fchip">${esc(p)}</span>`).join('')}</div></section>

        <section class="land-sect"><span class="eyebrow">integrações</span><h2 class="h1">Marketplaces</h2>
          <div class="fbar" style="margin-top:14px">
            ${['Mercado Livre', 'Shopee', 'TikTok Shop', 'Magalu'].map(m => `<span class="fchip on">${m} · leitura</span>`).join('')}
            <span class="fchip">Amazon · em breve</span><span class="fchip">escrita gate a gate · em breve</span></div>
          <p class="src" style="margin-top:8px">Conectar não autoriza escrita externa. Leitura e escrita dependem de permissões separadas.</p></section>

        <section class="land-sect" id="landPlanos"><span class="eyebrow">planos</span><h2 class="h1">Comece no trial, cresça por etapa</h2>
          <div class="plangrid">
            ${Object.entries(V8COM.PLANS).map(([k, p]) => `
            <div class="plancard ${k === 'PRO' ? 'dest' : ''}">
              <span class="pnome">${p.nome}</span><span class="ppara">${esc(p.para)}</span>
              <ul><li>${p.limites.empresas} empresa(s) · ${p.limites.cnpjs} CNPJ(s) · ${p.limites.lojas} loja(s)</li>
              <li>${p.limites.usuarios} usuário(s) · ${p.limites.marketplaces} marketplace(s)</li>
              <li>inteligência ${p.recursos.inteligencia}</li><li>suporte ${p.recursos.suporte}</li>
              ${p.emBreve.length ? `<li><span class="st warn plain">em breve: ${p.emBreve.join(', ')}</span></li>` : ''}</ul>
              <span style="flex:1"></span>
              <button class="btn sm ${k === 'PRO' ? 'primary' : ''}" data-g="tela" data-v="signup">começar no trial de ${V8COM.TRIAL_DIAS} dias</button>
            </div>`).join('')}
          </div>
          <p class="src" style="margin-top:10px">Trial de ${V8COM.TRIAL_DIAS} dias, sem cartão. Ao expirar, o acesso fica limitado — seus dados nunca são apagados.</p></section>

        <section class="land-sect faq"><span class="eyebrow">faq</span><h2 class="h1">Perguntas diretas</h2>
          <details><summary>É um ERP ou um hub?</summary><p>Nenhum dos dois. É a central de inteligência, operação, crescimento e decisão que fica por cima do que você já usa — catálogo, margem, riscos, oportunidades e execução em um só lugar.</p></details>
          <details><summary>Vocês publicam anúncios automaticamente?</summary><p>Não. Publicação externa exige conexão oficial, regra confirmada e a sua aprovação. O padrão do sistema é leitura.</p></details>
          <details><summary>Funciona com vários CNPJs e lojas?</summary><p>Sim — esse é o coração do produto: Grupo → Empresa → CNPJ → Loja → Conta, com comparação entre lojas e auditoria por escopo.</p></details>
          <details><summary>E se eu ainda não vendo em marketplace?</summary><p>Você começa pelo catálogo e pela loja física, e conecta canais quando fizer sentido.</p></details>
        </section>

        <section class="land-sect" style="text-align:center;padding:40px 0">
          <h2 class="h1" style="font-size:26px">Monte sua operação em minutos.</h2>
          <div class="land-ctas" style="justify-content:center">
            <button class="btn primary" data-g="tela" data-v="signup">Criar minha operação</button>
            <button class="btn ghost" data-g="demo">Ver demonstração</button>
          </div>
          <p class="src" style="margin-top:14px">Sem cartão · sem publicação externa · dados demonstrativos sempre rotulados</p>
        </section>
      </div>`;
  }

  /* ---------------- AUTH ---------------- */
  function authCard(titulo, body, alt) {
    return `<div class="authwrap"><div class="authcard">
      <div style="display:flex;gap:9px;align-items:center;margin-bottom:14px"><div class="mark">H</div><b>Head Marketplace OS</b></div>
      <h2 class="h1">${titulo}</h2>${body}
      <div class="auth-alt">${alt || ''} · <button class="linklike" data-g="tela" data-v="landing">voltar à página inicial</button></div>
    </div></div>`;
  }
  const inp = (id, label, type, ph) => `<label><span class="eyebrow">${label}</span><input class="input" id="${id}" type="${type || 'text'}" placeholder="${ph || ''}"></label>`;

  const TELAS = {
    login: () => authCard('Entrar', `
      ${inp('lgEmail', 'E-mail', 'email')}${inp('lgSenha', 'Senha', 'password')}
      <button class="btn primary" data-g="login">Entrar</button>
      <button class="btn ghost" data-g="demo">entrar como demonstração</button>`,
      `<button class="linklike" data-g="tela" data-v="recover">esqueci a senha</button> · <button class="linklike" data-g="tela" data-v="signup">criar conta</button>`),
    signup: () => authCard('Criar conta', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${inp('suNome', 'Nome')}${inp('suSobrenome', 'Sobrenome')}</div>
      ${inp('suEmail', 'E-mail', 'email')}${inp('suTelefone', 'Telefone', 'tel', '+55 …')}${inp('suSenha', 'Senha', 'password')}
      ${inp('suEmpresa', 'Empresa principal')}
      <label><span class="eyebrow">País</span><select class="select" id="suPais"><option>Brasil</option><option>Portugal</option><option>Outro</option></select></label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12px"><input type="checkbox" id="suTermos" style="margin-top:2px"> Li e aceito os <b>Termos de Uso</b></label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:6px;font-size:12px"><input type="checkbox" id="suPriv" style="margin-top:2px"> Li e aceito a <b>Política de Privacidade</b></label>
      <button class="btn primary" data-g="signup">Criar conta e começar</button>
      <p class="src" style="margin-top:8px">Coletamos só o necessário. Sem cartão. Trial de ${V8COM.TRIAL_DIAS} dias.</p>`,
      `<button class="linklike" data-g="tela" data-v="login">já tenho conta</button>`),
    recover: () => authCard('Recuperar senha', `${inp('rcEmail', 'E-mail', 'email')}
      <button class="btn primary" data-g="recover">Enviar link de recuperação</button>
      <p class="src" style="margin-top:8px">Sem e-mail real neste modo — o fluxo continua na tela seguinte.</p>`,
      `<button class="linklike" data-g="tela" data-v="login">voltar ao login</button>`),
    redefinir: () => authCard('Redefinir senha', `${inp('rdSenha', 'Nova senha', 'password')}${inp('rdSenha2', 'Confirmar nova senha', 'password')}
      <button class="btn primary" data-g="redefinir">Salvar nova senha</button>`, ''),
    confirmar: () => authCard('Confirme seu e-mail', `<p class="sub" style="margin-top:6px">Enviamos um link de confirmação (simulado neste modo).</p>
      <button class="btn primary" data-g="tela" data-v="onboarding">Já confirmei — continuar</button>`, ''),
    convite: () => authCard('Você foi convidado', `<p class="sub" style="margin-top:6px">Convite para entrar como <b>CATÁLOGO</b> em <b>Líder Comércio Digital</b> (escopo: Matriz MG).</p>
      ${inp('cvNome', 'Seu nome')}${inp('cvSenha', 'Defina sua senha', 'password')}
      <button class="btn primary" data-g="aceitarConvite">Aceitar convite</button>`, ''),
    primeiro: () => authCard('Primeiro acesso', `<p class="sub" style="margin-top:6px">Bem-vindo! Vamos estruturar sua operação para o Head entender onde ajudar.</p>
      <button class="btn primary" data-g="tela" data-v="onboarding">Começar onboarding</button>`, ''),
    expirada: () => authCard('Sessão expirada', `<p class="sub" style="margin-top:6px">Por segurança, sua sessão foi encerrada. Entre novamente.</p>
      <button class="btn primary" data-g="tela" data-v="login">Entrar de novo</button>`, ''),
    negado: () => authCard('Acesso negado', `<p class="sub" style="margin-top:6px">Seu papel não tem acesso a este recurso. Peça a um ADMIN ou OWNER para ajustar seu escopo.</p>
      <button class="btn primary" data-g="tela" data-v="login">Voltar ao login</button>`, ''),
    suspensa: () => authCard('Conta suspensa', `<p class="sub" style="margin-top:6px">Esta conta está suspensa. Nenhum dado foi apagado. Fale com o suporte para reativar.</p>
      <button class="btn primary" data-g="tela" data-v="landing">Falar com suporte</button>`, ''),
    trialexp: () => authCard('Trial expirado', `<p class="sub" style="margin-top:6px">Seu período de teste terminou. O acesso está limitado, mas <b>todos os seus dados estão preservados</b>.</p>
      <button class="btn primary" data-g="demo">Ver planos e solicitar upgrade</button>`, ''),
  };

  /* ---------------- ONBOARDING (8 etapas) ---------------- */
  function obShell(titulo, sub, body, foot) {
    const et = GATE.ob.etapa;
    return `<div class="obwrap">
      <div style="display:flex;gap:9px;align-items:center"><div class="mark">H</div><b>Configurando sua operação</b><span style="flex:1"></span><span class="src">etapa ${et} de 8</span></div>
      <div class="obbar">${Array.from({ length: 8 }, (_, i) => `<span class="${i < et ? 'done' : ''}"></span>`).join('')}</div>
      <div class="obcard"><h2 class="h1" style="font-size:19px">${titulo}</h2><p class="sub" style="margin-top:4px">${sub}</p>${body}</div>
      <div class="obfoot">${foot}</div></div>`;
  }
  const obNext = (label, act) => `<button class="btn primary" data-g="${act || 'obNext'}">${label || 'Continuar'}</button>`;
  const obSkip = label => `<button class="btn ghost" data-g="obNext">${label}</button>`;

  function onboarding() {
    const o = GATE.ob;
    const acc = GATE.acc;
    let html = '';
    if (o.etapa === 1) html = obShell('Bem-vindo ao Head Marketplace', 'Vamos estruturar sua operação para o Head entender onde ajudar. Leva poucos minutos e nada aqui publica nada externamente.',
      `<div class="callout" style="margin-top:12px">Você pode pular etapas e completar depois pelo checklist de <b>Ativação</b>.</div>`,
      `<span></span>${obNext('Começar')}`);
    else if (o.etapa === 2) html = obShell('Grupo e empresa', 'Quem opera: o grupo organiza empresas; a empresa organiza CNPJs e lojas.', `
      ${inp('obGrupo', 'Nome do grupo', 'text', 'ex.: Líder Group')}
      ${inp('obEmpresa', 'Empresa', 'text', 'ex.: Líder Comércio Digital LTDA')}
      ${inp('obSegmento', 'Segmento principal', 'text', 'ex.: Casa e Decoração')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label><span class="eyebrow">País</span><select class="select" id="obPais"><option>Brasil</option><option>Outro</option></select></label>
        <label><span class="eyebrow">Porte aproximado</span><select class="select" id="obPorte"><option>1-9 pessoas</option><option>10-50</option><option>51-200</option><option>200+</option></select></label></div>
      <span class="eyebrow" style="display:block;margin-top:12px">Modelo de operação</span>
      <div class="obpick" id="obModelo">${['marketplace próprio', 'marca', 'distribuidor', 'revenda', 'fabricante', 'agência/parceiro', 'loja física + marketplace', 'outro'].map(m => `<button data-modelo="${m}">${m}</button>`).join('')}</div>`,
      `<span></span>${obNext('Criar grupo e empresa', 'obEmpresa')}`);
    else if (o.etapa === 3) html = obShell('CNPJs / entidades fiscais', 'Nenhum CNPJ precisa ser validado externamente agora — você pode pular e adicionar depois.', `
      ${o.cnpjs.map(c => `<div class="metric-row"><span class="lbl">${esc(c.nomeFantasia)} · ${esc(c.cidade)}/${esc(c.estado)}</span><span class="st pos">adicionado</span></div>`).join('')}
      ${inp('obNomeFiscal', 'Nome fiscal')}${inp('obFantasia', 'Nome fantasia', 'text', 'ex.: Matriz MG')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${inp('obEstado', 'Estado', 'text', 'MG')}${inp('obCidade', 'Cidade')}</div>
      <button class="btn sm" data-g="obAddCnpj" style="margin-top:10px">adicionar este CNPJ</button>`,
      `${obSkip('Pular por enquanto')}${obNext()}`);
    else if (o.etapa === 4) html = obShell('Lojas e unidades', 'Loja não é sinônimo de marketplace: cadastre também loja física, CD ou filial.', `
      ${o.lojas.map(l => `<div class="metric-row"><span class="lbl">${esc(l.nome)} · ${esc(l.tipo)}</span><span class="st pos">adicionada</span></div>`).join('')}
      ${inp('obLojaNome', 'Nome da loja', 'text', 'ex.: Shopee Líder Molduras MG')}
      <label><span class="eyebrow">Tipo</span><select class="select" id="obLojaTipo">${V8COM.TIPOS_LOJA.map(t => `<option>${t}</option>`).join('')}</select></label>
      ${inp('obLojaResp', 'Responsável (opcional)')}
      <button class="btn sm" data-g="obAddLoja" style="margin-top:10px">adicionar esta loja</button>`,
      `${obSkip('Pular por enquanto')}${obNext()}`);
    else if (o.etapa === 5) html = obShell('Marketplaces', 'Conectar NÃO autoriza escrita externa. A leitura e a escrita dependem de permissões separadas.', `
      ${V8COM.MARKETPLACES.map(m => `<div class="metric-row"><span class="lbl">${m}</span>
        <select class="select" data-mkt="${m}" style="font-size:11.5px">
          <option value="">—</option>${V8COM.ESTADOS_MKT.map(e2 => `<option ${o.mkts[m] === e2 ? 'selected' : ''}>${e2}</option>`).join('')}</select></div>`).join('')}`,
      `${obSkip('Decidir depois')}${obNext('Salvar marketplaces', 'obMkts')}`);
    else if (o.etapa === 6) html = obShell('Catálogo inicial', 'Como seus produtos entram no sistema. Dados demonstrativos são sempre rotulados e nunca se misturam à sua empresa real.', `
      <div class="obpick" id="obCat">${V8COM.CATALOGO_MODOS.map(m => `<button data-cat="${m}">${m}</button>`).join('')}</div>`,
      `<span></span>${obNext('Confirmar', 'obCatGo')}`);
    else if (o.etapa === 7) html = obShell('Convide sua equipe', 'Cada pessoa entra com papel e escopo — permissão aqui é enforcement de verdade.', `
      ${o.convites.map(c => `<div class="metric-row"><span class="lbl">${esc(c.email)}</span><span class="st info plain">${c.papel}</span></div>`).join('')}
      ${inp('obConvEmail', 'E-mail', 'email')}
      <label><span class="eyebrow">Papel</span><select class="select" id="obConvPapel">${Object.keys(V8COM.ROLES).filter(r => r !== 'OWNER').map(r => `<option>${r}</option>`).join('')}</select></label>
      <button class="btn sm" data-g="obAddConvite" style="margin-top:10px">convidar</button>`,
      `${obSkip('Convidar depois')}${obNext()}`);
    else {
      const fm = V8COM.firstMission(acc);
      html = obShell('Sua primeira missão', 'Com base no que você configurou, o melhor próximo passo é:', `
        <div class="callout" style="margin-top:12px"><b>${esc(fm.acao)}</b><br><span class="src">${esc(fm.motivo)}</span></div>
        <dl class="kv" style="margin-top:14px">
          <dt>Sua operação</dt><dd>${acc.escopo.empresas.length} empresa · ${acc.escopo.cnpjs.length} CNPJ(s) · ${acc.escopo.lojas.length} loja(s) · ${acc.convites.length} convite(s)</dd>
          <dt>Trial</dt><dd>${V8COM.TRIAL_DIAS} dias · sem cartão · dados preservados ao expirar</dd>
          <dt>Importante</dt><dd>Sua empresa real começa <b>vazia</b>; a navegação de demonstração usa dados fictícios <b>rotulados</b> — nunca misturados.</dd></dl>`,
        `<button class="btn" data-g="obFinishDemo">Explorar demonstração rotulada</button>
         <button class="btn primary" data-g="obFinish">Ir para minha Ativação</button>`);
    }
    $('#gate').innerHTML = html;
  }

  /* ---------------- controle ---------------- */
  function show(state) {
    GATE.state = state;
    $('#gate').hidden = false;
    document.body.style.overflow = 'hidden';
    if (state === 'landing') landing();
    else if (state === 'onboarding') onboarding();
    else if (TELAS[state]) $('#gate').innerHTML = TELAS[state]();
    else landing();
    $('#gate').scrollTop = 0;
  }

  function onClick(e) {
    const b = e.target.closest('[data-g],[data-modelo],[data-cat]');
    if (!b) return;
    if (b.dataset.modelo !== undefined) { GATE.ob.modelo = b.dataset.modelo; document.querySelectorAll('#obModelo button').forEach(x => x.classList.toggle('on', x === b)); return; }
    if (b.dataset.cat !== undefined) { GATE.ob.cat = b.dataset.cat; document.querySelectorAll('#obCat button').forEach(x => x.classList.toggle('on', x === b)); return; }
    const g = b.dataset.g;
    const val = id => ($('#' + id) || { value: '' }).value.trim();
    try {
      if (g === 'tela') show(b.dataset.v);
      else if (g === 'demo') { GATE.acc = null; enterApp('home'); UI.toast('Sessão de demonstração — todos os dados são fictícios e rotulados.', 'ok'); }
      else if (g === 'especialista') { UI.toast('Solicitação registrada — na versão comercial, um especialista entra em contato. (simulado)', 'ok'); }
      else if (g === 'login') {
        if (!val('lgEmail') || !val('lgSenha')) return UI.toast('Informe e-mail e senha.', 'err');
        enterApp('home'); UI.toast('Sessão iniciada (demonstração — sem backend de autenticação neste modo).', 'ok');
      }
      else if (g === 'recover') { UI.toast('Se o e-mail existir, o link foi "enviado" (simulado).', 'ok'); show('redefinir'); }
      else if (g === 'redefinir') {
        if (!val('rdSenha') || val('rdSenha') !== val('rdSenha2')) return UI.toast('As senhas precisam coincidir.', 'err');
        UI.toast('Senha redefinida (simulado).', 'ok'); show('login');
      }
      else if (g === 'aceitarConvite') { if (!val('cvNome') || !val('cvSenha')) return UI.toast('Complete nome e senha.', 'err'); enterApp('home'); UI.toast('Convite aceito — você entrou com papel CATÁLOGO (simulado).', 'ok'); }
      else if (g === 'signup') {
        GATE.acc = V8COM.createAccount({
          nome: val('suNome'), sobrenome: val('suSobrenome'), email: val('suEmail'), telefone: val('suTelefone'),
          senha: val('suSenha'), empresa: val('suEmpresa'), pais: val('suPais') || 'Brasil',
          aceiteTermos: $('#suTermos').checked, aceitePrivacidade: $('#suPriv').checked,
        });
        GATE.ob = { etapa: 1, cnpjs: [], lojas: [], mkts: {}, convites: [] };
        show('confirmar');
      }
      else if (g === 'obNext') { GATE.ob.etapa = Math.min(8, GATE.ob.etapa + 1); if (GATE.acc) GATE.acc.onboarding.etapa = GATE.ob.etapa; onboarding(); }
      else if (g === 'obEmpresa') {
        V8COM.obGrupoEmpresa(GATE.acc, { grupo: val('obGrupo'), empresa: val('obEmpresa'), segmento: val('obSegmento'), pais: val('obPais') || 'Brasil', porte: val('obPorte'), modelo: GATE.ob.modelo });
        GATE.ob.etapa = 3; onboarding();
      }
      else if (g === 'obAddCnpj') {
        const c = V8COM.obAddCnpj(GATE.acc, { nomeFiscal: val('obNomeFiscal'), nomeFantasia: val('obFantasia'), estado: val('obEstado'), cidade: val('obCidade') });
        GATE.ob.cnpjs.push(c); GATE.ob.etapa = 3; onboarding();
      }
      else if (g === 'obAddLoja') {
        const s = V8COM.obAddLoja(GATE.acc, { nome: val('obLojaNome'), tipo: val('obLojaTipo'), responsavel: val('obLojaResp') });
        GATE.ob.lojas.push(s); GATE.ob.etapa = 4; onboarding();
      }
      else if (g === 'obMkts') {
        const escolhas = [...document.querySelectorAll('[data-mkt]')].filter(s => s.value).map(s => ({ marketplace: s.dataset.mkt, estado: s.value }));
        V8COM.obSelectMarketplaces(GATE.acc, escolhas);
        GATE.ob.etapa = 6; onboarding();
      }
      else if (g === 'obCatGo') {
        V8COM.obCatalogo(GATE.acc, GATE.ob.cat || 'pular');
        GATE.ob.etapa = 7; onboarding();
      }
      else if (g === 'obAddConvite') {
        const c = V8COM.invite(GATE.acc, { email: val('obConvEmail'), papel: val('obConvPapel') });
        GATE.ob.convites.push(c); onboarding();
      }
      else if (g === 'obFinish' || g === 'obFinishDemo') {
        V8COM.obComplete(GATE.acc);
        if (g === 'obFinishDemo') V8COM.switchMode(GATE.acc, 'DEMONSTRACAO'); /* troca EXPLÍCITA */
        enterApp(g === 'obFinish' ? 'ativacao' : 'home');
        UI.toast(g === 'obFinishDemo'
          ? 'Você navega em DEMONSTRAÇÃO rotulada — sua empresa real segue separada e vazia.'
          : 'Operação criada. Este é o seu checklist de ativação.', 'ok');
      }
    } catch (err) { UI.toast(err.message, 'err'); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#gate').addEventListener('click', onClick);
    const params = new URLSearchParams(location.search);
    if (params.get('tela')) return show(params.get('tela'));
    if (shouldShow(params)) show('landing');

    /* ---------- auto-teste (?gateself=1) ---------- */
    if (params.get('gateself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      show('landing');
      need($('#gate').textContent.includes('Pare de administrar marketplaces no escuro'), 'hero presente');
      need($('#gate').textContent.includes('Starter') && $('#gate').textContent.includes('Enterprise'), 'planos na landing');
      document.querySelector('[data-g="tela"][data-v="signup"]').click();
      need(GATE.state === 'signup', 'landing leva ao cadastro');
      /* cadastro completo → onboarding */
      $('#suNome').value = 'Teste'; $('#suSobrenome').value = 'Silva'; $('#suEmail').value = 't@t.example';
      $('#suTelefone').value = '+55 31 9999'; $('#suSenha').value = 'x123'; $('#suEmpresa').value = 'Teste LTDA';
      $('#suTermos').checked = true; $('#suPriv').checked = true;
      document.querySelector('[data-g="signup"]').click();
      need(GATE.state === 'confirmar' && GATE.acc && GATE.acc.status === 'CONTA NOVA', 'cadastro cria conta');
      document.querySelector('[data-g="tela"][data-v="onboarding"]').click();
      document.querySelector('[data-g="obNext"]').click(); /* etapa 1 → 2 */
      $('#obGrupo').value = 'Grupo T'; $('#obEmpresa').value = 'Teste LTDA'; $('#obSegmento').value = 'Casa';
      document.querySelector('[data-modelo="marca"]').click();
      document.querySelector('[data-g="obEmpresa"]').click();
      need(GATE.acc.escopo.empresas.length === 1, 'onboarding cria empresa real');
      $('#obNomeFiscal').value = 'Teste LTDA'; $('#obFantasia').value = 'Matriz'; $('#obEstado').value = 'MG'; $('#obCidade').value = 'BH';
      document.querySelector('[data-g="obAddCnpj"]').click();
      document.querySelector('[data-g="obNext"]').click();
      $('#obLojaNome').value = 'Shopee Teste';
      document.querySelector('[data-g="obAddLoja"]').click();
      document.querySelector('[data-g="obNext"]').click();
      document.querySelector('[data-mkt="Shopee"]').value = 'conectar depois';
      document.querySelector('[data-g="obMkts"]').click();
      need(GATE.acc.marketplacesSel[0].escrita === 'ESCRITA EXTERNA BLOQUEADA', 'seleção de marketplace nunca habilita escrita');
      document.querySelector('[data-cat="pular"]').click();
      document.querySelector('[data-g="obCatGo"]').click();
      document.querySelector('[data-g="obNext"]').click(); /* pular convites */
      document.querySelector('[data-g="obFinish"]').click();
      need(UI.view === 'ativacao' && UI.account === GATE.acc, 'onboarding termina na Ativação com a conta real');
      need(document.querySelector('#gate').hidden, 'gate fecha ao entrar');
      document.body.dataset.gateselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.gateselfReady = 'fail: ' + e.message; }
  });
}());
