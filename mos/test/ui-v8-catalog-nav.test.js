/* =============================================================
   SPRINT 10.E.3.2 — Navegação do Catálogo reduzida a 3 áreas
   (Visão Geral / Rascunhos / Marketplaces). Contrato: as áreas
   técnicas saem do MENU PRINCIPAL mas continuam existindo e
   acessíveis por contexto; nenhuma função/dado removido.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8', f), 'utf8');
const catJs = read('catalogo.js');

/* 1 — navegação principal = exatamente 3 áreas */
test('01 · MAIN_SUBS = Visão Geral, Rascunhos, Marketplaces (menu principal)', () => {
  assert.match(catJs, /const MAIN_SUBS = \['Visão Geral', 'Rascunhos', 'Marketplaces'\]/);
  /* o tab bar itera MAIN_SUBS, não a lista técnica completa */
  assert.match(catJs, /MAIN_SUBS\.map\(s =>/, 'tab bar usa MAIN_SUBS');
});

/* 2 — Catálogo abre em Visão Geral */
test('02 · Catálogo abre em Visão Geral', () => {
  assert.match(catJs, /sub: 'Visão Geral'/);
});

/* 3 — áreas técnicas NÃO estão no menu principal, mas seguem no dispatch (existem) */
test('03 · áreas técnicas saem do menu principal e continuam no sistema', () => {
  const tecnicas = ['Produtos Master', 'Anúncios', 'Variações', 'Fotos e Vídeos', 'Atributos e Especificações',
    'SKU e Vínculos', 'Anúncio Master', 'Importar Cadastro', 'Campos de Cadastro', 'Edição em Massa',
    'Duplicar e Adaptar', 'Saúde e Pendências', 'Comparar Marketplaces', 'Histórico e Versões', 'Fontes e Arquivos'];
  const mainBlock = catJs.match(/const MAIN_SUBS = \[[^\]]*\]/)[0];
  for (const t of tecnicas) {
    assert.ok(!mainBlock.includes(t), `técnica fora do menu principal: ${t}`);
    assert.ok(catJs.includes(`'${t}'`), `função/área ainda existe no sistema: ${t}`);
  }
  /* todas continuam com dispatch no body() */
  for (const t of tecnicas) assert.ok(new RegExp(`CAT\\.sub === '${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(catJs) || catJs.includes(`'${t}'`), 'reachable: ' + t);
});

/* 4 — Rascunhos tem subabas por origem */
test('04 · Rascunhos com subabas por origem (Loja/Shopee/ML/TikTok/Magalu/Outros)', () => {
  assert.match(catJs, /RASC_TABS/);
  for (const s of ['Rascunhos da Loja', 'Shopee', 'Mercado Livre', 'TikTok Shop', 'Magalu', 'Outros'])
    assert.ok(catJs.includes(`'${s}'`), 'subaba de rascunho: ' + s);
  assert.match(catJs, /function rascunhosHub/);
});

/* 5 — Marketplaces é um hub (picker + operação por marketplace) */
test('05 · Marketplaces: picker de plataformas + operação por marketplace', () => {
  assert.match(catJs, /function marketplacesHub/);
  assert.match(catJs, /const MKT_LIST = \[\['shopee'.*'ml'.*'tiktok'.*'magalu'/s);
  assert.match(catJs, /data-act="openmkt"/, 'abre operação do marketplace');
  assert.match(catJs, /data-act="backmkts"/, 'breadcrumb de volta ao picker');
});

/* 6 — status nativo × Head preservados (contrato do redesign continua) */
test('06 · status nativo e status Head permanecem no anúncio', () => {
  assert.match(catJs, /Status nativo · Head/);
  const eng = read('catalog-engine.js');
  assert.match(eng, /function statusOperacional/);
});

/* 7 — editor único de 14 abas preservado */
test('07 · editor operacional completo de 14 abas mantido', () => {
  assert.match(catJs, /const EDITOR_ABAS = \[/);
  const n = (catJs.match(/const EDITOR_ABAS = \[([^\]]*)\]/)[1].match(/'/g) || []).length / 2;
  assert.equal(n, 14, '14 abas do editor');
});

/* 8 — importação e saúde são contextuais (botões/ações), não menu principal */
test('08 · importar e pendências como ação contextual (não aba principal)', () => {
  const mainBlock = catJs.match(/const MAIN_SUBS = \[[^\]]*\]/)[0];
  assert.ok(!mainBlock.includes('Importar') && !mainBlock.includes('Saúde'), 'fora do menu principal');
  assert.match(catJs, /data-act="upcatshopee"/, 'importação como botão contextual');
  assert.match(catJs, /Ver Pendências|data-sub="Saúde e Pendências"/, 'pendências acessíveis por ação');
});

/* 9 — migração sem perda: renderers e dados intactos */
test('09 · nenhum renderer removido (migração é só de navegação)', () => {
  for (const fn of ['function visaoGeral', 'function anuncios', 'function produtos', 'function variacoes',
    'function midia', 'function importarCadastro', 'function camposCadastro', 'function edicaoMassa',
    'function duplicarAdaptar', 'function saude', 'function compararMkts', 'function historicoVersoes',
    'function fontesArquivos', 'function anuncioMaster', 'CAT.openEditor'])
    assert.ok(catJs.includes(fn), 'renderer preservado: ' + fn);
});

/* 10 — contexto técnico mostra volta à área principal + sem publicação externa */
test('10 · contexto técnico tem retorno à área principal; sem escrita externa', () => {
  assert.match(catJs, /CONTEXTUAIS/, 'lista de áreas contextuais');
  assert.match(catJs, /← \$\{UI\.esc\(abaAtiva\)\}/, 'botão de volta ao pai');
  assert.ok(!/publicarNaShopee|pushToMarketplace/i.test(catJs), 'nenhuma escrita externa');
});
