/* =============================================================
   SPRINT 10.UI — protótipo v8 (Head Marketplace OS · Product Experience)
   28 testes obrigatórios. A lógica testada aqui (V8LOGIC) é o MESMO
   arquivo que o navegador executa — não uma cópia.
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
const allJs = ['app.js', 'home.js', 'operacao.js', 'catalogo.js', 'crescimento.js',
  'conexoes.js', 'missao.js', 'silencio.js', 'conhecimento.js'].map(read).join('\n');

/* ---------- tema ---------- */

test('01 · dois temas nativos por tokens — nunca inversão', () => {
  assert.match(css, /:root\[data-theme="light"\]/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  for (const tok of ['--bg', '--ink', '--accent', '--pos', '--neg', '--warn', '--line']) {
    const re = new RegExp(tok + ':', 'g');
    assert.ok((css.match(re) || []).length >= 2, `token ${tok} definido nos dois temas`);
  }
  assert.ok(!/filter:\s*invert/.test(css), 'sem inversão de tema');
  assert.match(css, /color-scheme:light/); assert.match(css, /color-scheme:dark/);
});

test('02 · alternância de tema com preferência salva por usuário', () => {
  assert.match(appJs, /THEME_KEY = 'v8-theme:' \+ V8DATA\.meta\.usuario/);
  assert.match(appJs, /localStorage\.setItem\(THEME_KEY/);
  assert.match(appJs, /localStorage\.getItem\(THEME_KEY\)/);
  assert.match(appJs, /setAttribute\('data-theme'/);
  assert.match(appJs, /prefers-color-scheme: light/, 'sem preferência salva, segue o sistema');
});

/* ---------- navegação e contexto ---------- */

test('03 · menu 10.E.4: Pedidos, Central, Centro de Custos e Empresas e Operações', () => {
  /* 10.P.3 — menu reduzido a 6 áreas; toda view antiga segue como seção acessível pela sub-nav */
  for (const v of ['home', 'operacao', 'pedidos', 'catalogo', 'crescimento', 'seo', 'custos', 'empresas', 'conexoes', 'missao', 'silencio', 'conhecimento', 'importar'])
    assert.match(html, new RegExp(`id="v-${v}"`), `view ${v} preservada`);
  for (const nome of ['Início', 'Catálogo', 'Crescimento', 'Operação', 'Execução', 'Configurações'])
    assert.ok(html.includes(`<span>${nome}</span>`), `área do menu: ${nome}`);
  const nAreas = (html.match(/data-area="/g) || []).length;
  assert.equal(nAreas, 6, 'exatamente 6 áreas no menu principal');
  for (const k of ['inicio', 'catalogo', 'crescimento', 'operacao', 'execucao', 'config'])
    assert.match(html, new RegExp(`data-area="${k}"`), `área ${k} no menu`);
  assert.match(appJs, /UI\.renderers\[v\]\(sub\)/, 'cada navegação chama o renderer da área');
  assert.match(appJs, /renderSubnav/, 'sub-navegação contextual das 6 áreas');
  assert.match(appJs, /data-ref="importar:"/, 'botão global de Fontes e Histórico na barra');
});

test('04 · subáreas do Catálogo (Catalog & Listing Operating Center 10.E.3)', () => {
  const cat = read('catalogo.js');
  for (const s of ['Visão Geral', 'Produtos Master', 'Anúncios', 'Rascunhos', 'Ativos', 'Pausados', 'Não Publicados',
    'Em Revisão', 'Com Erro ou Bloqueio', 'Variações', 'Fotos e Vídeos', 'Atributos e Especificações',
    'SKU e Vínculos', 'Anúncio Master', 'Importar Cadastro', 'Edição em Massa', 'Duplicar e Adaptar',
    'Saúde e Pendências', 'Comparar Marketplaces', 'Histórico e Versões', 'Fontes e Arquivos'])
    assert.ok(cat.includes(`'${s}'`), `subárea ${s}`);
  assert.match(cat, /sub: 'Visão Geral'/, 'Catálogo abre em Visão Geral');
});

/* ---------- busca e filtros ---------- */

test('05 · busca busca (nome e SKU, case-insensitive)', () => {
  const r1 = V8LOGIC.filterProducts(V8DATA.products, { q: 'GARRAFA' });
  assert.equal(r1.length, 1); assert.equal(r1[0].sku, 'GAR-1L');
  const r2 = V8LOGIC.filterProducts(V8DATA.products, { q: 'kit3' });
  assert.equal(r2.length, 1); assert.equal(r2[0].id, 'p2');
  assert.equal(V8LOGIC.filterProducts(V8DATA.products, { q: 'inexistente-xyz' }).length, 0);
});

test('06 · filtros rápidos filtram de verdade', () => {
  const pend = V8LOGIC.filterProducts(V8DATA.products, { comPendencia: true });
  assert.ok(pend.length >= 5 && pend.every(p => p.pendencias.length > 0));
  const baixo = V8LOGIC.filterProducts(V8DATA.products, { estoqueMax: 10 });
  assert.ok(baixo.every(p => p.estoque <= 10));
  const mg = V8LOGIC.filterProducts(V8DATA.products, { margemMin: 60 });
  assert.ok(mg.length > 0 && mg.every(p => V8LOGIC.margem(p) >= 60));
});

test('07 · filtros avançados combinam entre si (E lógico)', () => {
  const r = V8LOGIC.filterProducts(V8DATA.products, {
    categoria: 'Decoração', tipo: 'PRONTA_ENTREGA', marketplace: 'ml', statusMkt: 'ATIVO',
  });
  assert.ok(r.length > 0);
  for (const p of r) {
    assert.equal(p.categoria, 'Decoração');
    assert.equal(p.tipo, 'PRONTA_ENTREGA');
    assert.equal(p.mkt.ml.status, 'ATIVO');
  }
  const combinado = V8LOGIC.filterProducts(V8DATA.products, { categoria: 'Decoração', comPendencia: true, q: 'espelho' });
  assert.equal(combinado.length, 1); assert.equal(combinado[0].id, 'p4');
});

test('08 · contagem de filtros ativos e limpeza', () => {
  assert.equal(V8LOGIC.activeFilterCount({}), 0);
  assert.equal(V8LOGIC.activeFilterCount({ q: 'a', categoria: 'Decoração', comPendencia: true, estoqueMax: 10 }), 4);
  assert.match(read('catalogo.js'), /data-act="f-clear"/, 'botão limpar filtros');
});

test('09 · visões salvas guardam e restauram filtros (cópia independente)', () => {
  const st = V8LOGIC.createState();
  const f = { categoria: 'Decoração', comPendencia: true };
  V8LOGIC.saveView(st, 'pendências decoração', f);
  f.categoria = 'MUDOU';
  const loaded = V8LOGIC.loadView(st, 'pendências decoração');
  assert.equal(loaded.categoria, 'Decoração', 'visão não é afetada por mutação posterior');
  loaded.comPendencia = false;
  assert.equal(V8LOGIC.loadView(st, 'pendências decoração').comPendencia, true, 'load devolve cópia');
  assert.equal(V8LOGIC.loadView(st, 'não existe'), null);
});

/* ---------- ordenação e seleção ---------- */

test('10 · ordenação por coluna, asc e desc, numérica e textual', () => {
  const byEstoque = V8LOGIC.sortProducts(V8DATA.products, 'estoque', 'desc');
  assert.equal(byEstoque[0].sku, 'CAN-ECO');
  const byNome = V8LOGIC.sortProducts(V8DATA.products, 'nome', 'asc');
  assert.ok(byNome[0].nome.localeCompare(byNome[byNome.length - 1].nome, 'pt-BR') < 0);
  const byMargem = V8LOGIC.sortProducts(V8DATA.products, 'margem', 'desc');
  assert.ok(V8LOGIC.margem(byMargem[0]) >= V8LOGIC.margem(byMargem[1]));
});

test('11 · seleção individual, múltipla e selecionar-todos-os-filtrados', () => {
  const st = V8LOGIC.createState();
  V8LOGIC.toggleSelect(st, 'p1');
  V8LOGIC.toggleSelect(st, 'p2');
  assert.equal(st.selection.size, 2);
  V8LOGIC.toggleSelect(st, 'p1');
  assert.equal(st.selection.size, 1, 'toggle remove');
  V8LOGIC.clearSelection(st);
  const filtrados = V8LOGIC.filterProducts(st.products, { comPendencia: true });
  V8LOGIC.selectAllFiltered(st, filtrados);
  assert.equal(st.selection.size, filtrados.length, 'seleciona SÓ os filtrados');
  assert.ok(!st.selection.has('p6'), 'produto fora do filtro não entra');
});

/* ---------- ações em massa ---------- */

test('12 · ação em massa vira job auditável, interno e reversível', () => {
  const st = V8LOGIC.createState();
  const r = V8LOGIC.bulkAction(st, ['p1', 'p2', 'p5'], 'marcar_revisao', 'Marcos');
  assert.ok(r.job, 'job criado');
  assert.equal(r.job.total, 3);
  assert.equal(r.job.tipo, 'AÇÃO INTERNA');
  assert.equal(r.job.reversivel, true);
  assert.ok(st.audit.some(a => a.acao === 'bulk_job' && a.detalhe.includes('3 itens')), 'trilha de auditoria');
  assert.ok(st.products.find(p => p.id === 'p1').pendencias.includes('marcado para revisão'), 'efeito real nos itens');
});

test('13 · publicação externa em massa é RECUSADA com razão clara', () => {
  const st = V8LOGIC.createState();
  for (const acao of V8LOGIC.EXTERNAL_ACTIONS) {
    const r = V8LOGIC.bulkAction(st, ['p1'], acao);
    assert.equal(r.blocked, true, acao + ' bloqueada');
    assert.match(r.reason, /ESCRITA EXTERNA BLOQUEADA/);
    assert.equal(r.job, undefined, 'nenhum job externo criado');
  }
  assert.ok(st.audit.some(a => a.acao === 'bulk_blocked'), 'recusa também é auditada');
  assert.ok(V8LOGIC.bulkAction(st, [], 'marcar_revisao').blocked, 'sem seleção → bloqueia');
});

/* ---------- edição versionada ---------- */

test('14 · editar o master gera versão com autor, origem e valor anterior', () => {
  const st = V8LOGIC.createState();
  const r = V8LOGIC.editMaster(st, 'p1', 'marca', 'Casa Demo Premium', 'Marcos');
  assert.equal(r.changed, true);
  assert.equal(r.version.antes, 'Casa Demo');
  assert.equal(r.version.depois, 'Casa Demo Premium');
  assert.equal(r.version.autor, 'Marcos');
  assert.equal(r.version.origem, 'AÇÃO INTERNA');
  assert.ok(r.version.impacto.rascunhosReavaliados >= 1, 'rascunhos reavaliados');
  assert.equal(V8LOGIC.editMaster(st, 'p1', 'marca', 'Casa Demo Premium').changed, false, 'sem mudança → sem versão');
  assert.equal(st.versions.length, 1);
});

test('15 · completar dado obrigatório resolve a pendência dependente', () => {
  const st = V8LOGIC.createState();
  const p4 = st.products.find(p => p.id === 'p4');
  assert.ok(p4.pendencias.includes('peso embalado ausente'));
  V8LOGIC.editMaster(st, 'p4', 'pesoEmbaladoKg', 4.2);
  assert.ok(!p4.pendencias.includes('peso embalado ausente'), 'pendência destravada');
  const p5 = st.products.find(p => p.id === 'p5');
  V8LOGIC.editMaster(st, 'p5', 'material', 'MDF laminado');
  assert.ok(!p5.pendencias.some(x => x.startsWith('ficha técnica incompleta')));
});

test('16 · editar o master NÃO sobrescreve perfis específicos por marketplace', () => {
  const st = V8LOGIC.createState();
  const p1 = st.products.find(p => p.id === 'p1');
  const tituloML = p1.mkt.ml.profile.titulo;
  const tituloShp = p1.mkt.shopee.profile.titulo;
  const r = V8LOGIC.editMaster(st, 'p1', 'titulo', 'Quadro Paisagem 60x90 NOVO');
  assert.deepEqual(r.perfisPreservados.sort(), ['ml', 'shopee'], 'canais com perfil próprio detectados');
  assert.equal(p1.mkt.ml.profile.titulo, tituloML, 'perfil ML intacto');
  assert.equal(p1.mkt.shopee.profile.titulo, tituloShp, 'perfil Shopee intacto');
  assert.equal(p1.master.titulo, 'Quadro Paisagem 60x90 NOVO', 'master atualizado');
});

test('17 · editar perfil da Shopee não altera Mercado Livre (nem o master)', () => {
  const st = V8LOGIC.createState();
  const p1 = st.products.find(p => p.id === 'p1');
  const mlAntes = JSON.stringify(p1.mkt.ml);
  const masterAntes = JSON.stringify(p1.master);
  V8LOGIC.editProfile(st, 'p1', 'shopee', 'titulo', 'Título Exclusivo Shopee');
  assert.equal(JSON.stringify(p1.mkt.ml), mlAntes, 'ML byte a byte igual');
  assert.equal(JSON.stringify(p1.master), masterAntes, 'master intacto');
  assert.equal(p1.mkt.shopee.profile.titulo, 'Título Exclusivo Shopee');
});

test('18 · edição de perfil por canal também é versionada e auditada', () => {
  const st = V8LOGIC.createState();
  const r = V8LOGIC.editProfile(st, 'p2', 'tiktok', 'titulo', 'Kit 3 Quadros TikTok Edition', 'Marcos');
  assert.equal(r.version.entidade, 'mkt_profile');
  assert.equal(r.version.marketplace, 'tiktok');
  assert.equal(r.version.antes, null);
  assert.ok(st.audit.some(a => a.acao === 'edit_profile' && a.detalhe.includes('[tiktok]')));
});

/* ---------- matriz de publicação e anúncios ---------- */

test('19 · matriz de publicação honesta por canal', () => {
  const p4 = V8DATA.products.find(p => p.id === 'p4');
  const m = V8LOGIC.publicationMatrix(p4);
  assert.equal(m.length, 4, 'sempre os 4 marketplaces');
  const shp = m.find(r => r.key === 'shopee');
  assert.equal(shp.status, 'BLOQUEADO');
  assert.match(shp.motivo, /sob encomenda/, 'bloqueio explica o motivo');
  const tt = m.find(r => r.key === 'tiktok');
  assert.equal(tt.podeRascunho, true, 'não publicado permite rascunho interno');
  assert.equal(tt.publicacaoExterna, 'ESCRITA EXTERNA BLOQUEADA');
});

test('20 · seletor de marketplace + abas de status filtram anúncios', () => {
  const ativosShopee = V8DATA.products.filter(p => p.mkt.shopee.status === 'ATIVO');
  const bloqueadosML = V8DATA.products.filter(p => p.mkt.ml.status === 'BLOQUEADO');
  assert.ok(ativosShopee.length >= 5);
  assert.equal(bloqueadosML.length, 1);
  assert.equal(bloqueadosML[0].sku, 'LUM-LED');
  const cat = read('catalogo.js');
  assert.match(cat, /data-act="anmkt"/, 'seletor de marketplace');
  assert.match(cat, /data-act="antab"/, 'abas de status');
});

test('21 · ranking só com contexto legítimo — nunca posição inventada', () => {
  for (const r of V8DATA.ranking) assert.ok(V8LOGIC.assertRankingLegit(r));
  assert.throws(() => V8LOGIC.assertRankingLegit({ marketplace: 'ML', palavra: 'x', posicao: 3 }),
    /falta (data|origem|confianca)/);
  assert.throws(() => V8LOGIC.assertRankingLegit({ palavra: 'x', posicao: 3, data: 'd', origem: 'o', confianca: 'c' }),
    /falta marketplace/);
  for (const r of V8DATA.ranking) {
    assert.equal(r.origem, 'DADO SIMULADO');
    assert.ok(r.comparacao && r.data, 'comparação e data presentes');
  }
  assert.match(read('catalogo.js'), /sem posição inventada/, 'ausência declarada na UI');
});

/* ---------- honestidade de estado ---------- */

test('22 · todo botão desabilitado tem razão explicável', () => {
  for (const kind of ['publicar_externo', 'sync', 'ranking_real', 'ads'])
    assert.ok(V8LOGIC.disabledReason(kind).length > 20, kind + ' tem razão');
  assert.match(V8LOGIC.disabledReason('publicar_externo'), /ESCRITA EXTERNA BLOQUEADA/);
  assert.match(V8LOGIC.disabledReason('ranking_real'), /nada será inventado/);
  /* estático: nenhum <button disabled> renderizado sem title com a razão */
  const disabledBtns = allJs.match(/<button[^>]*\bdisabled\b[^>]*>/g) || [];
  assert.ok(disabledBtns.length >= 3, 'há botões desabilitados no produto');
  for (const b of disabledBtns) assert.match(b, /title=/, 'disabled sempre acompanha title: ' + b);
});

test('23 · integração desconectada nunca parece ativa', () => {
  for (const c of V8DATA.conexoes) {
    assert.equal(c.status, 'AGUARDANDO CONEXÃO');
    assert.equal(c.ultimaSync, null, 'sem sync fingida');
    assert.equal(c.saude, null, 'sem saúde fingida');
  }
  const con = read('conexoes.js');
  assert.ok(!/stBadge\(['"]CONECTADO/.test(con), 'nenhum badge CONECTADO hardcoded');
  assert.match(con, /READ_ONLY por padrão/);
});

test('24 · dado demonstrativo é SEMPRE rotulado', () => {
  for (const p of V8DATA.products) assert.equal(p.origem, 'DADO SIMULADO');
  for (const o of V8DATA.crescimento.pedidosNaoPagos) assert.equal(o.origem, 'DADO SIMULADO');
  for (const o of V8DATA.crescimento.oportunidades) assert.ok(o.evidencia && o.confianca, 'oportunidade com evidência e confiança');
  assert.equal(V8DATA.crescimento.resultados['7d'].origem, 'DADO SIMULADO');
  assert.equal(V8DATA.meta.env, 'DEMONSTRAÇÃO');
  assert.match(html, /DADO SIMULADO · rotulado/, 'chip fixo na topbar');
  assert.match(html, /ESCRITA EXTERNA BLOQUEADA/, 'trava fixa na topbar');
});

test('25 · nenhuma publicação externa é simulada como concluída', () => {
  assert.ok(!/publicado com sucesso/i.test(allJs), 'sem sucesso externo fingido');
  assert.ok(!/publicado no (mercado livre|shopee|tiktok|magalu)/i.test(allJs));
  const st = V8LOGIC.createState();
  const r = V8LOGIC.bulkAction(st, ['p1'], 'gerar_rascunhos');
  assert.equal(r.job.status, 'CONCLUÍDO (interno)', 'conclusão sempre qualificada como interna');
  for (const m of V8DATA.missoes)
    assert.ok(!/conclu[íi]do$/i.test(m.status), 'missão nunca "concluída" sem qualificar execução externa');
});

test('26 · vocabulário canônico de status completo', () => {
  const S = V8DATA.STATUS;
  for (const s of ['PRODUÇÃO', 'STAGING', 'DEMONSTRAÇÃO', 'DADO REAL', 'DADO IMPORTADO', 'DADO SIMULADO',
    'SEM DADOS', 'AGUARDANDO CONEXÃO', 'AÇÃO INTERNA', 'ESCRITA EXTERNA BLOQUEADA',
    'EM PROCESSAMENTO', 'AGUARDANDO APROVAÇÃO', 'EM REVISÃO', 'BLOQUEADO', 'PRONTO PARA REVISÃO'])
    assert.ok(Object.values(S).includes(s), `status canônico: ${s}`);
});

/* ---------- números reais e composição ---------- */

test('27 · margem, readiness e badges são calculados, não decorativos', () => {
  const p1 = V8DATA.products.find(p => p.id === 'p1');
  assert.equal(V8LOGIC.margem(p1), 62.4, 'margem sobre preço base');
  assert.equal(V8LOGIC.margem(p1, 'shopee'), 60.8, 'margem por canal usa preço do canal');
  assert.equal(V8LOGIC.margem(V8DATA.products.find(p => p.id === 'p10'), 'ml'), null, 'sem preço → sem margem inventada');
  const p6 = V8DATA.products.find(p => p.id === 'p6');
  assert.equal(V8LOGIC.readiness(p6), 100);
  assert.ok(V8LOGIC.readiness(V8DATA.products.find(p => p.id === 'p12')) <= 50);
  const b = V8LOGIC.badgeCounts();
  assert.equal(b.catalogo, String(V8DATA.products.filter(p => p.pendencias.length).length));
  assert.equal(b.conexoes, '0/5');
});

test('28 · v8 compõe a camada compartilhada real — sem motor paralelo', () => {
  for (const src of ['mie/src/core/clock.js', 'mos/src/chat/head-chat.js',
    'mos/src/compliance/engine.js', 'mos/src/growth/demo-growth.js'])
    assert.ok(html.includes(src), `carrega ${src}`);
  const op = read('operacao.js');
  assert.match(op, /HEADCHAT\.createHeadChat/, 'chat da Operação é a camada dos testes');
  assert.match(op, /HEADCOMPLIANCE\.createComplianceAdapter/);
  assert.match(op, /HEADGROWTH\.createGrowthAdapter/);
  assert.ok(!/function interpret\(/.test(op), 'nenhum interpretador duplicado na UI');
  /* separação visual por tipo de informação */
  for (const s of ['FATO', 'EVIDÊNCIA', 'HIPÓTESE', 'PLAYBOOK', 'RECOMENDAÇÃO', 'RISCO', 'AÇÃO', 'DECISÃO PENDENTE', 'STATUS'])
    assert.ok(op.includes(`'${s}'`), `separador ${s}`);
});
