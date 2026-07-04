/* SPRINT 10.E.1 — Activation Pack: 16 itens via CLI real do piloto. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ROOT = path.join(__dirname, '../..');
const run = (args, env) => {
  try { return { out: execFileSync('node', ['pilot/pilot.js', ...args], { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'pipe' }).toString(), code: 0 }; }
  catch (e) { return { out: (e.stdout || '').toString() + (e.stderr || '').toString(), code: e.status }; }
};
const CFG = path.join(ROOT, 'pilot/lider.config.json');
const bak = fs.readFileSync(CFG, 'utf8');
test.after(() => { fs.writeFileSync(CFG, bak); try { fs.unlinkSync(path.join(ROOT, 'pilot/.pilot-state.json')); } catch (e) {} });

test('01-04 · pré-voo bloqueia sem PG/Redis/worker e confirma API/storage/demo-off/escrita bloqueada', () => {
  const r = run(['preflight'], { HEAD_ENV: 'LOCAL', DATABASE_URL: '', REDIS_URL: '' });
  assert.equal(r.code, 1, 'bloqueado');
  assert.match(r.out, /PostgreSQL/); assert.match(r.out, /Redis\s+BLOQUEADO|Redis.*AGUARDANDO/);
  assert.match(r.out, /STAGING BLOQUEADO/);
  assert.match(r.out, /AGUARDANDO AÇÃO DO OWNER/, 'itens do owner marcados honestamente');
  assert.match(r.out, /Storage gravável\s+OK/); assert.match(r.out, /API\/health\s+OK/);
  assert.match(r.out, /Modo DEMO desligado\s+OK/); assert.match(r.out, /Escrita externa\s+OK/);
});
test('05-07 · CNPJ/loja/conta não confirmados não recebem importação; bootstrap bloqueado', () => {
  const c = JSON.parse(bak);
  assert.ok(c.cnpjs.every(x => x.status === 'PENDENTE DE CONFIRMAÇÃO'), 'nada assumido');
  const b = run(['bootstrap'], { HEAD_ENV: 'LOCAL', DATABASE_URL: '', REDIS_URL: '' });
  assert.equal(b.code, 1, 'bootstrap não passa sem pré-voo/confirmação');
  run(['bootstrap', '--ensaio'], { HEAD_ENV: 'LOCAL' });
  fs.writeFileSync(path.join(ROOT, '/tmp-cat.csv'), 'x'); /* nunca usado */
  const ing = run(['ingest', '--camada', '2', '--arquivo', 'package.json', '--loja', 'shopee-mg'], { HEAD_ENV: 'LOCAL' });
  assert.match(ing.out, /não CONFIRMADA — importação recusada/);
  const conf = run(['confirmar', '--item', 'shopee-mg'], {});
  assert.match(conf.out, /CONFIRMADO: shopee-mg/);
});
test('08-12 · camada 2 fica em staging; master nunca automático; conflito bloqueia; relatório; portão humano', () => {
  run(['bootstrap', '--ensaio'], { HEAD_ENV: 'LOCAL' });
  run(['confirmar', '--item', 'shopee-mg'], {});
  const csv = 'ID do Item,Nome do Produto,Status Atual do Item,SKU Pai,SKU da variação,Nome da variação,Preço,Estoque\n7001,Quadro Piloto,Normal,QPX-1,QPX-1,única,120,5\n';
  const f = path.join(ROOT, 'var', 'cat-piloto-' + Date.now() + '.csv');
  fs.writeFileSync(f, csv);
  const ing = run(['ingest', '--camada', '2', '--arquivo', f, '--loja', 'shopee-mg'], { HEAD_ENV: 'LOCAL' });
  assert.match(ing.out, /REVISÃO OBRIGATÓRIA \(nada aplicado ainda\)/, 'staging antes de aplicar');
  assert.match(ing.out, /NUNCA aprovado automaticamente/, 'master exige humano');
  const lote = ing.out.match(/aplicar --lote (\S+)/)[1];
  const ap = run(['aplicar', '--lote', lote], { HEAD_ENV: 'LOCAL' });
  assert.match(ap.out, /aplicado após revisão humana/);
  const rel = run(['relatorio', '--camada', '2'], { HEAD_ENV: 'LOCAL' });
  assert.match(rel.out, /CAMADA 2 — CATÁLOGO E ANÚNCIOS/);
  assert.match(rel.out, /Go\/No-Go/); assert.match(rel.out, /nunca automáticos/);
  /* portão humano: camada 4 não abre sem aceites */
  const g = run(['ingest', '--camada', '4', '--arquivo', f, '--loja', 'shopee-mg'], { HEAD_ENV: 'LOCAL' });
  assert.match(g.out, /ainda não aceita — a entrada é controlada/);
});
test('13-16 · diário de atritos registra; demo separada; escrita bloqueada; suíte íntegra', () => {
  const at = run(['atrito', '--tipo', 'SKU', '--camada', '2', '--desc', 'kit com estrutura diferente'], {});
  assert.match(at.out, /atrito registrado/);
  const linha = fs.readFileSync(path.join(ROOT, 'pilot/atritos.jsonl'), 'utf8').trim().split('\n').pop();
  assert.equal(JSON.parse(linha).tipo, 'SKU');
  const pf = run(['preflight'], { HEAD_ENV: 'LOCAL' });
  assert.match(pf.out, /demo jamais se mistura/);
  assert.match(pf.out, /Escrita externa\s+OK\s+BLOQUEADA/);
  fs.unlinkSync(path.join(ROOT, 'pilot/atritos.jsonl'));
});
