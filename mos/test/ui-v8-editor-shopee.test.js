/* =============================================================
   SPRINT 10.E.3.4 — Fidelidade do editor de anúncio Shopee.
   O editor Shopee replica o Seller Center: 8 seções verticais e,
   sobretudo, Informações Fiscais com TODOS os campos reais da
   Shopee (nada de bloco fiscal reduzido). Valor importado
   preservado; obrigatório/opcional marcados; sem escrita externa.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const catJs = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v8/catalogo.js'), 'utf8');

/* 1 — editor Shopee vertical com as 8 seções */
test('01 · editor Shopee vertical com as 8 seções do Seller Center', () => {
  assert.match(catJs, /SHOPEE_SECOES/);
  for (const s of ['Informações Básicas', 'Especificações', 'Descrição', 'Informações de Vendas', 'Lista de Variações', 'Informações Fiscais', 'Envio', 'Outros'])
    assert.ok(catJs.includes(s), 'seção: ' + s);
});

/* 2 — Informações Fiscais com TODOS os campos reais da Shopee */
test('02 · Informações Fiscais tem todos os campos reais (nada de bloco reduzido)', () => {
  const fiscais = ['regimeFiscal', 'ncm', 'origemFiscal', 'cfopMesmoEstado', 'cfopDiferentesEstados', 'unidadeMedida',
    'cfopExportar', 'tributosTotal', 'pisCofinsCst', 'tipoOperacao', 'cest', 'exTipi', 'recopi', 'infoAdicionaisFiscal', 'controleFci', 'itemAgregavel'];
  for (const c of fiscais) assert.ok(catJs.includes(`'${c}'`), 'campo fiscal: ' + c);
  /* labels visíveis fiéis */
  for (const lbl of ['Regime Fiscal', 'CFOP Venda Mesmo Estado', 'CFOP Vendas Diferentes Estados', 'Unidade de Medida',
    'CFOP (Exportar)', '% total de tributos', 'PIS e COFINS CST', 'Tipo de Operação', 'EX TIPI', 'Nr. RECOPI',
    'Nr. de controle da FCI', 'Produto é um item agregável'])
    assert.ok(catJs.includes(lbl), 'label fiscal: ' + lbl);
});

/* 3 — Origem tem as opções reais da tabela ICMS (0..8) */
test('03 · Origem fiscal traz a tabela ICMS real (0 a 8)', () => {
  assert.match(catJs, /0 \(Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8\)/);
  assert.match(catJs, /Estrangeira - Importação direta/);
  assert.ok((catJs.match(/Estrangeira|Nacional, mercadoria/g) || []).length >= 5, 'várias origens ICMS');
});

/* 4 — obrigatório/opcional marcados + tooltips de ajuda */
test('04 · campos fiscais marcam obrigatório/opcional e têm ajuda', () => {
  /* obrigatoriedade e tooltip aplicados via opts { ob: true, ajuda } no esel/einp */
  assert.ok(/'Regime Fiscal'[\s\S]{0,140}ob: true/.test(catJs), 'Regime Fiscal obrigatório');
  assert.ok(/'NCM'[\s\S]{0,160}ob: true/.test(catJs), 'NCM obrigatório');
  assert.match(catJs, /ajuda: 'Nomenclatura Comum do Mercosul/);
  assert.match(catJs, /Opcional/); /* seção marcada como opcional no título Shopee */
  assert.match(catJs, /opts\.ob \? ' \*' : ''/); /* marcador de obrigatório no helper */
});

/* 5 — helpers de select e radio existem (fiel ao Seller Center) */
test('05 · editor tem select e radio fiéis (esel/erad)', () => {
  assert.match(catJs, /const esel = /);
  assert.match(catJs, /const erad = /);
});

/* 6 — valor importado preservado no select (option "(importado)") */
test('06 · select preserva valor importado que não está na lista', () => {
  assert.match(catJs, /\(importado\)/);
});

/* 7 — Especificações enriquecida com atributos reais */
test('07 · Especificações traz País de Origem, Garantia, Estilo, Tipo de armação', () => {
  for (const lbl of ['País de Origem', 'Duração da Garantia', 'Tipo de armação', 'Tipo de Garantia', 'Estilo', 'Comprimento', 'Largura'])
    assert.ok(catJs.includes(lbl), 'atributo: ' + lbl);
});

/* 8 — Envio com Taxa de Frete por transportadora + sob encomenda */
test('08 · Envio tem Taxa de Frete por transportadora e Sob encomenda', () => {
  assert.match(catJs, /Taxa de Frete/);
  for (const t of ['Shopee Xpress', 'Entrega pelo Comprador', 'Entrega Direta', 'Entrega Turbo'])
    assert.ok(catJs.includes(t), 'transportadora: ' + t);
  assert.match(catJs, /'sobEncomenda'/);
});

/* 9 — ações do editor: rascunho interno, versão Shopee, validar, publicar */
test('09 · ações do editor Shopee fiéis (rascunho/versão Shopee/validar/publicar)', () => {
  assert.match(catJs, /Salvar rascunho interno/);
  assert.match(catJs, /data-act="esaveshopee"/);
  assert.match(catJs, /Salvar versão Shopee/);
  assert.match(catJs, /data-act="evalidar"/);
  assert.match(catJs, /data-act="epublicar"/);
});

/* 10 — save lê select, radio e checkbox (não só input) */
test('10 · salvar lê select/radio/checkbox corretamente', () => {
  assert.match(catJs, /i\.type === 'radio' && !i\.checked/);
  assert.match(catJs, /i\.type === 'checkbox' \? i\.checked/);
});

/* 11 — nenhuma escrita externa disparada pelo editor */
test('11 · editor não dispara escrita externa', () => {
  assert.ok(!/fetch\(|XMLHttpRequest|api\.shopee|push_to_shopee/i.test(catJs), 'sem chamada externa');
});
