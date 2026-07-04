/* CATALOG, RULE & COMPLIANCE ENGINE (Sprint 10) — ponto de entrada Node.
   No navegador (protótipo v4), carregar os MESMOS arquivos como <script>:
   _ns não é necessário — globalThis.HEADCOMPLIANCE. */
'use strict';
const NS = require('./_ns.js');
require('./rule-packs.js');
require('./engine.js');
require('./demo-products.js');
require('./chat-adapter.js');

module.exports = {
  RULE_PACKS: NS.RULE_PACKS,
  INTERNAL_RULES: NS.INTERNAL_RULES,
  DEMO_PRODUCTS: NS.DEMO_PRODUCTS,
  suggestCategory: NS.suggestCategory,
  resolveRequirements: NS.resolveRequirements,
  evaluate: NS.evaluate,
  buildDraft: NS.buildDraft,
  createComplianceAdapter: NS.createComplianceAdapter,
  SEVERITIES: NS.SEVERITIES,
  RESULTS: NS.RESULTS,
  NS,
};
