/* 10.E.2.5.3 — contrato do cliente da API oficial (V8API). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const V8API = require('../../design/prototipo-v8/api-client.js');

test('V8API expõe o contrato de import + inteligência', () => {
  for (const m of ['login', 'criarEscopo', 'upload', 'criarImport', 'aplicarImport', 'listarImports',
    'previewImport', 'camposImport', 'conflitosImport', 'performance', 'returns', 'inventory', 'orders', 'traffic', 'summary'])
    assert.equal(typeof V8API[m], 'function', 'método: ' + m);
});
test('V8API offline sem backend configurado (Artifact estático degrada honesto)', async () => {
  assert.equal(V8API.online(), false, 'sem window/base → offline');
  await assert.rejects(() => V8API.performance({ company_id: 'x' }), /OFFLINE/);
});
