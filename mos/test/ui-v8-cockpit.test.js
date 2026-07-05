/* =============================================================
   SPRINT 10.UI.1 — Cockpit 9.9 (refinamento do protótipo v8)
   25 testes obrigatórios: barra global de contexto, Home executiva,
   Crescimento sem CRM (performance, oportunidades, pedidos não
   pagos, experimentos, aceleração, expansão), Conexões corporativa,
   contraste e honestidade de estado. V8LOGIC é o MESMO arquivo que
   o navegador executa.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8DIR = path.join(__dirname, '../../design/prototipo-v8');
const { V8DATA, V8LOGIC } = require(path.join(V8DIR, 'data.js'));
const read = f => fs.readFileSync(path.join(V8DIR, f), 'utf8');
const html = read('index.html');
const css = read('styles.css');
const appJs = read('app.js');
const creJs = read('crescimento.js');
const conJs = read('conexoes.js');
const homeJs = read('home.js');
const catJs = read('catalogo.js');

/* ---------- barra global operacional ---------- */

test('01 · barra global altera o contexto das telas', () => {
  assert.match(html, /id="gbar"/);
  assert.match(appJs, /ctx: \{ grupo: 'g1', empresa: 'e1', cnpj: '', loja: '', marketplace: '', conta: '', periodo: '7d' \}/);
  assert.match(appJs, /setCtx\(k, v\)/);
  assert.match(appJs, /if \(UI\.renderers\[UI\.view\]\) UI\.renderers\[UI\.view\]\(\)/, 'mudar contexto refaz a tela ativa');
  /* a lógica que a barra usa muda de fato o conjunto de entidades */
  const todos = V8LOGIC.globalFilter(V8DATA.products, { empresa: 'e1' });
  const shopee = V8LOGIC.globalFilter(V8DATA.products, { empresa: 'e1', marketplace: 'shopee' });
  assert.ok(shopee.length < todos.length, 'marketplace ativo reduz o conjunto');
});

test('02 · empresa ativa altera as entidades exibidas', () => {
  const e1 = V8LOGIC.globalFilter(V8DATA.products, { empresa: 'e1' });
  const e2 = V8LOGIC.globalFilter(V8DATA.products, { empresa: 'e2' });
  assert.ok(e1.length > 0 && e2.length > 0);
  assert.notEqual(e1.length, e2.length);
  assert.equal(e1.length + e2.length, V8DATA.products.length, 'toda entidade pertence a exatamente uma empresa');
  assert.ok(e2.every(p => p.categoria === 'Casa e Cozinha'), 'e2 só vê o próprio catálogo');
  assert.equal(V8DATA.meta.empresas.length, 2);
});

test('03 · marketplace ativo filtra catálogo e anúncios', () => {
  const tk = V8LOGIC.globalFilter(V8DATA.products, { marketplace: 'tiktok' });
  assert.ok(tk.length > 0);
  for (const p of tk) assert.notEqual(p.mkt.tiktok.status, 'NAO_PUBLICADO');
  assert.match(catJs, /UI\.ctxProducts\(\)/, 'catálogo lê o contexto global');
  assert.match(catJs, /UI\.ctx\.marketplace \|\| CAT\.anuncioMkt/, 'anúncios seguem o marketplace global');
  assert.match(creJs, /UI\.ctx\.marketplace/, 'crescimento segue o marketplace global');
});

test('04 · período global altera os indicadores', () => {
  const k7 = V8LOGIC.perfKpis('ml', '7d');
  const k30 = V8LOGIC.perfKpis('ml', '30d');
  assert.ok(k7 && k30);
  assert.notEqual(k7.faturamento, k30.faturamento);
  assert.notEqual(k7.pedidos, k30.pedidos);
  assert.ok(k7.deltaFaturamento != null, '7d compara com período anterior');
  const r = V8DATA.crescimento.resultados;
  assert.ok(r.hoje.receita !== r['7d'].receita && r['7d'].receita !== r['30d'].receita);
});

test('05 · ambiente é visível na barra global', () => {
  assert.match(appJs, /env-pill/, 'pill de ambiente renderizada pela barra');
  assert.match(appJs, /V8DATA\.meta\.env/);
  assert.equal(V8DATA.meta.env, 'DEMONSTRAÇÃO');
  assert.match(html, /DADO SIMULADO · rotulado/, 'status da base fixo na barra');
});

test('06 · dados simulados continuam rotulados em todas as novas áreas', () => {
  for (const mk of ['ml', 'shopee', 'tiktok'])
    for (const per of ['hoje', '7d', '30d'])
      assert.equal(V8DATA.crescimento.performance[mk][per].origem, 'DADO SIMULADO', `funil ${mk}/${per}`);
  for (const o of V8DATA.crescimento.pedidosNaoPagos) assert.equal(o.origem, 'DADO SIMULADO');
  for (const x of V8DATA.crescimento.experimentos) assert.equal(x.origem, 'DADO SIMULADO');
  for (const pr of V8DATA.crescimento.aceleracao.promocoes) assert.equal(pr.origem, 'DADO SIMULADO');
});

/* ---------- crescimento sem CRM ---------- */

test('07 · Crescimento não possui Leads', () => {
  assert.equal(V8DATA.crescimento.leads, undefined, 'sem estrutura de leads nos dados');
  /* nenhuma estrutura funcional de lead (as únicas menções são a negação declarada) */
  assert.ok(!/\.leads\b/.test(creJs), 'sem acesso a dados de lead');
  assert.ok(!creJs.includes('Leads e Oportunidades'), 'subárea de leads removida');
  assert.ok(!/registrar follow-up|valorEstimado|canal do lead/i.test(creJs), 'sem mecânica de lead');
  for (const s of ['Mesa de Inteligência', 'Métricas Principais', 'Pedidos e Funil', 'Performance de Produtos',
    'Tráfego', 'Devoluções e Cancelamentos', 'Estoque Full', 'Afiliados', 'Chat e Atendimento',
    'Promoções e Cupons', 'Ads', 'Oportunidades', 'Experimentos', 'Aceleração', 'Expansão',
    'Resultados e Aprendizados', 'Fontes e Histórico'])
    assert.ok(creJs.includes(`'${s}'`), `subárea ${s}`);
});

test('08 · Crescimento não possui pipeline de CRM', () => {
  assert.ok(!/>Pipeline|'Pipeline/.test(creJs), 'sem tela de pipeline');
  assert.ok(!/'NOVO'|'NEGOCIAÇÃO'|'PROPOSTA'|'GANHO'|'PERDIDO'/.test(creJs), 'sem etapas de CRM');
  assert.ok(!/data-act="etapa"|data-act="fup"/.test(creJs), 'sem mecânica de funil comercial de agência');
  assert.equal(V8DATA.crescimento.pendenciasComerciais, undefined, 'sem pendências comerciais de CRM nos dados');
});

test('09 · pedido não pago é separado de pagamento aprovado', () => {
  const etapas = V8LOGIC.FUNIL_ETAPAS.map(e => e[1]);
  assert.ok(etapas.includes('Pedido criado') && etapas.includes('Pedido não pago') && etapas.includes('Pagamento aprovado'));
  const s = V8LOGIC.unpaidStats('shopee', '7d');
  assert.equal(s.naoPagos, 21);
  assert.equal(s.pedidosCriados, 58);
  assert.ok(Math.abs(s.taxaNaoPago + s.taxaAprovacao - 100) < 0.2, 'taxas complementares');
  assert.ok(s.valorPotencialPerdido > 0, 'valor potencial perdido calculado');
  const d = V8DATA.crescimento.performance.ml['7d'];
  assert.equal(d.aprovados + d.naoPagos, d.pedidosCriados, 'criado = aprovado + não pago');
});

test('10 · pedido não pago nunca gera causa inventada', () => {
  const semMotivo = V8DATA.crescimento.pedidosNaoPagos.find(o => !o.motivo);
  const hyps = V8LOGIC.unpaidHypotheses(semMotivo);
  assert.ok(hyps.every(h => ['HIPÓTESE', 'PONTO DE PARADA'].includes(h.tipo)), 'sem motivo → só hipóteses, nunca causa');
  assert.ok(hyps.some(h => /não conclusões/.test(h.txt)));
  const comMotivo = V8DATA.crescimento.pedidosNaoPagos.find(o => o.motivo);
  const hyps2 = V8LOGIC.unpaidHypotheses(comMotivo);
  assert.ok(hyps2.find(h => h.tipo === 'FATO').evidencia, 'FATO só com evidência registrada');
  assert.ok(hyps2.some(h => h.tipo === 'PONTO DE PARADA' && /nenhuma causa/.test(h.txt)));
  assert.match(creJs, /Sem recuperação automática, sem contato com comprador/, 'exclusões declaradas na própria tela');
  assert.match(creJs, /Contato com comprador não existe neste produto/, 'botão de contato desabilitado com razão');
});

test('11 · oportunidade abre a entidade correta', () => {
  for (const o of V8DATA.crescimento.oportunidades) {
    const p = V8DATA.products.find(x => x.id === o.produtoId);
    assert.ok(p, `entidade existe: ${o.produtoId}`);
    assert.ok(V8DATA.MKTS.some(m => m.key === o.marketplace), `marketplace válido: ${o.marketplace}`);
    for (const k of ['evidencia', 'hipotese', 'impacto', 'risco', 'prioridade', 'confianca', 'acao', 'responsavel', 'status'])
      assert.ok(o[k] !== undefined && o[k] !== '', `${o.id}.${k} presente`);
  }
  assert.match(creJs, /data-act="ent" data-id="\$\{o\.produtoId\}"/, 'linha abre a entidade');
  const st = V8LOGIC.createState();
  assert.ok(V8LOGIC.opportunityAction(st, 'o1', 'ignorar', '').blocked, 'ignorar sem motivo é recusado');
  const r = V8LOGIC.opportunityAction(st, 'o1', 'ignorar', 'fora da estratégia');
  assert.ok(r.ok && st.audit.some(a => a.acao === 'oportunidade_ignorada'), 'motivo auditado');
});

test('12 · experimento exige hipótese, métrica e ponto de parada', () => {
  const st = V8LOGIC.createState();
  const base = { tipo: 'preço', hipotese: 'h', alvo: 'p1', marketplace: 'ml', metricaPrimaria: 'conversão', pontoDeParada: 'margem < 45%', margemMinima: 45, responsavel: 'Marcos' };
  for (const k of ['hipotese', 'metricaPrimaria', 'pontoDeParada', 'margemMinima', 'responsavel']) {
    const spec = { ...base }; delete spec[k];
    assert.throws(() => V8LOGIC.createExperiment(st, spec), new RegExp('falta ' + k), 'recusa sem ' + k);
  }
  const x = V8LOGIC.createExperiment(st, base);
  assert.equal(x.execucaoExterna, 'ESCRITA EXTERNA BLOQUEADA', 'experimento nunca executa fora');
  assert.ok(st.audit.some(a => a.acao === 'experimento_criado'));
  for (const seed of V8DATA.crescimento.experimentos)
    for (const k of ['hipotese', 'metricaPrimaria', 'pontoDeParada', 'responsavel'])
      assert.ok(seed[k], `experimento seed ${seed.id} tem ${k}`);
});

test('13 · Ads exige margem e base mínima — nunca conserta produto ruim', () => {
  const p3 = V8DATA.products.find(p => p.id === 'p3'); /* pendência aberta */
  assert.equal(V8LOGIC.accelGate('ads', p3).allowed, false);
  assert.match(V8LOGIC.accelGate('ads', p3).motivo, /pendência/);
  const p12 = V8DATA.products.find(p => p.id === 'p12'); /* readiness baixo */
  assert.equal(V8LOGIC.accelGate('ads', p12).allowed, false);
  const margemRuim = { ...V8DATA.products.find(p => p.id === 'p6'), custo: 55, precoBase: 59.9, pendencias: [], mkt: V8DATA.products.find(p => p.id === 'p6').mkt, master: V8DATA.products.find(p => p.id === 'p6').master };
  assert.equal(V8LOGIC.accelGate('ads', margemRuim).allowed, false, 'margem ruim bloqueia Ads');
  assert.match(V8LOGIC.accelGate('ads', margemRuim).motivo, /não conserta margem ruim/);
  const p6 = V8DATA.products.find(p => p.id === 'p6');
  assert.equal(V8LOGIC.accelGate('ads', p6).allowed, true, 'base validada passa');
});

test('14 · promoção exige impacto em margem declarado', () => {
  for (const pr of V8DATA.crescimento.aceleracao.promocoes) {
    assert.ok(pr.margemAntes != null && pr.margemDepois != null && pr.margemMinima != null, pr.id + ' declara margens');
    const imp = V8LOGIC.promoImpact(pr);
    assert.ok(typeof imp.deltaMargem === 'number');
    assert.equal(imp.respeitaMinima, pr.margemDepois >= pr.margemMinima);
  }
  assert.equal(V8LOGIC.promoImpact({ margemAntes: 50, margemDepois: 40, margemMinima: 45 }).respeitaMinima, false);
  assert.match(creJs, /Recusado: a promoção violaria a margem mínima/, 'aprovação recusa violação de margem');
});

test('15 · kit cruza margem e logística', () => {
  const p4 = V8DATA.products.find(p => p.id === 'p4'); /* sem peso embalado */
  const g4 = V8LOGIC.accelGate('kit', p4);
  assert.equal(g4.allowed, false);
  assert.match(g4.motivo, /peso embalado|logística/);
  const p11 = V8DATA.products.find(p => p.id === 'p11');
  const g11 = V8LOGIC.accelGate('kit', p11);
  assert.equal(g11.allowed, true);
  assert.match(g11.motivo, /margem e logística/);
});

/* ---------- conexões corporativas ---------- */

test('16 · Conexões exibe leitura e escrita separadamente', () => {
  for (const c of V8DATA.conexoes) {
    assert.ok(c.leitura !== undefined && c.escrita !== undefined && c.leitura !== c.escrita, c.key + ': leitura ≠ escrita');
    assert.ok(c.oauth !== undefined && c.ambiente !== undefined && c.conta !== undefined, c.key + ': OAuth/ambiente/conta');
    assert.equal(c.ultimaSync, null, 'sem sync fingida');
    assert.equal(c.erro, null, 'sem erro fingido');
  }
  for (const col of ['OAuth', 'Leitura', 'Escrita', 'Última sync', 'Saúde', 'Erro', 'Flags'])
    assert.ok(conJs.includes('>' + col + '<'), 'coluna ' + col);
  assert.ok(!/class="mkt-cell"/.test(conJs), 'tabela corporativa, não grade de cards');
});

test('17 · drawer de conexão abre logs e permissões', () => {
  assert.match(conJs, /function openDrawer\(key\)/);
  for (const bloco of ['Permissões (leitura ≠ escrita)', 'Histórico de sincronização', 'Erros', 'Auditoria desta integração', 'Feature flags', 'Webhooks'])
    assert.ok(conJs.includes(bloco), 'drawer traz: ' + bloco);
  assert.match(conJs, /nenhum será simulado/, 'histórico vazio é honesto');
});

/* ---------- comportamento preservado ---------- */

test('18 · tabelas preservam filtros e seleção após abrir drawer', () => {
  /* openDrawer não toca nem em filtros nem em seleção */
  const fn = catJs.slice(catJs.indexOf('CAT.openDrawer = function'), catJs.indexOf('/* ---------------- eventos'));
  assert.ok(!/CAT\.filters\s*=/.test(fn), 'drawer não reseta filtros');
  assert.ok(!/clearSelection|selection\.clear/.test(fn), 'drawer não limpa seleção');
  assert.match(catJs, /filtros e seleção preservados após drawer/, 'coberto no auto-teste headless');
});

test('19 · Home abre risco e oportunidade corretos', () => {
  const H = V8DATA.home;
  const [, riscoId] = H.risco.acao.split(':');
  assert.ok(V8DATA.products.find(p => p.id === riscoId), 'risco aponta produto existente');
  const [areaOpp, oppId] = H.oportunidade.acao.split(':');
  assert.equal(areaOpp, 'crescimento');
  assert.ok(V8DATA.crescimento.oportunidades.find(o => o.id === oppId), 'oportunidade aponta entrada real da fila');
  assert.match(appJs, /CRESCIMENTO\.focus\(alvo\)/, 'open() sabe focar Crescimento');
  for (const o of H.operacoesEmRisco) assert.ok(o.ref.includes(':'), 'operação em risco é acionável');
});

test('20 · Home mostra atividade recente e estado da operação', () => {
  assert.match(homeJs, /Atividade recente/);
  assert.match(homeJs, /st\.audit\.slice\(-6\)/, 'atividade vem da trilha auditável real');
  for (const bloco of ['status geral', 'marketplace em atenção', 'prioridade do dia', 'decisões pendentes', 'jobs críticos', 'Respostas pendentes', 'Próximos passos', 'Operações em risco'])
    assert.ok(homeJs.includes(bloco), 'cockpit tem: ' + bloco);
  assert.match(homeJs, /statusline/, 'faixa de status no topo');
});

/* ---------- tipografia, contraste, temas ---------- */

test('21 · texto secundário mantém contraste mínimo adequado (WCAG AA)', () => {
  const tokens = theme => {
    const m = css.match(new RegExp(`:root\\[data-theme="${theme}"\\]\\{([\\s\\S]*?)\\}`));
    const out = {};
    for (const [, k, v] of m[1].matchAll(/(--[\w-]+):(#[0-9A-Fa-f]{6})/g)) out[k] = v;
    return out;
  };
  const lum = hex => {
    const c = [1, 3, 5].map(i => {
      let x = parseInt(hex.slice(i, i + 2), 16) / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  for (const th of ['light', 'dark']) {
    const t = tokens(th);
    assert.ok(ratio(t['--ink'], t['--bg']) >= 7, `${th}: texto principal ≥ 7:1`);
    assert.ok(ratio(t['--ink-2'], t['--bg']) >= 4.5, `${th}: texto secundário ≥ 4.5:1 (AA)`);
    assert.ok(ratio(t['--ink-3'], t['--bg']) >= 4.0, `${th}: labels ≥ 4.0:1`);
  }
});

test('22 · temas claro e escuro continuam íntegros (mesmo conjunto de tokens)', () => {
  const grab = theme => {
    const m = css.match(new RegExp(`:root\\[data-theme="${theme}"\\]\\{([\\s\\S]*?)\\}`));
    return [...m[1].matchAll(/(--[\w-]+):/g)].map(x => x[1]).sort();
  };
  assert.deepEqual(grab('light'), grab('dark'), 'todo token existe nos dois temas');
  assert.ok(!/filter:\s*invert/.test(css), 'sem inversão');
  assert.match(appJs, /localStorage\.setItem\(THEME_KEY/, 'preferência continua persistindo');
});

test('23 · nenhum botão novo fica sem comportamento', () => {
  const all = [appJs, homeJs, creJs, conJs, catJs].join('\n');
  const btns = all.match(/<button[^>]*>/g) || [];
  assert.ok(btns.length > 40, 'cobertura real de botões');
  for (const b of btns) {
    const ok = /data-act|data-gact|data-actcon|onclick=|data-col|data-mkt|id="/.test(b) || /disabled/.test(b);
    assert.ok(ok, 'botão sem comportamento declarado: ' + b);
    if (/\bdisabled\b/.test(b)) assert.match(b, /title=/, 'disabled sem razão: ' + b);
  }
});

test('24 · nenhuma ação nova cria publicação externa', () => {
  const st = V8LOGIC.createState();
  for (const acao of V8LOGIC.EXTERNAL_ACTIONS)
    assert.equal(V8LOGIC.bulkAction(st, ['p1'], acao).blocked, true, acao + ' segue bloqueada');
  const x = V8LOGIC.createExperiment(st, { tipo: 'preço', hipotese: 'h', alvo: 'p1', marketplace: 'ml', metricaPrimaria: 'm', pontoDeParada: 's', margemMinima: 45, responsavel: 'M' });
  assert.equal(x.execucaoExterna, 'ESCRITA EXTERNA BLOQUEADA');
  assert.ok(!/publicado com sucesso|publicado no marketplace/i.test([creJs, homeJs, conJs].join('')), 'sem sucesso externo fingido');
  assert.match(creJs, /ESCRITA_BLOQUEADA/, 'crescimento declara a trava');
  /* rascunhos criados pela Expansão são internos */
  assert.match(creJs, /status: D\.STATUS\.EM_REVISAO, nota: 'nasceu da Expansão/);
});

test('25 · contratos anteriores continuam válidos (API do v8 intacta)', () => {
  /* o arquivo de testes do 10.UI continua na suíte e a API que ele usa existe */
  assert.ok(fs.existsSync(path.join(__dirname, 'ui-v8.test.js')));
  for (const fn of ['filterProducts', 'sortProducts', 'editMaster', 'editProfile', 'bulkAction',
    'publicationMatrix', 'assertRankingLegit', 'disabledReason', 'saveView', 'loadView',
    'toggleSelect', 'selectAllFiltered', 'badgeCounts', 'margem', 'readiness'])
    assert.equal(typeof V8LOGIC[fn], 'function', 'API preservada: ' + fn);
  /* subáreas do Catálogo intactas */
  for (const s of ['Visão Geral', 'Produtos', 'Anúncios', 'Rascunhos e Revisões', 'Pendências', 'Promoções Relacionadas'])
    assert.ok(catJs.includes(`'${s}'`), `catálogo mantém ${s}`);
});
