/* CHAT ADAPTER (Sprint 10) — a ponte tipada entre o Head Chat e o
   Compliance Engine. UMD: o MESMO adaptador serve Node e o protótipo v4.

   O chat NUNCA inventa categoria ou regra: tudo que ele responde vem
   daqui — e daqui vem do motor + rule packs com fonte/versão/status. */
(function (NS) {
'use strict';

function createComplianceAdapter({ products, clock, rulePacks = NS.RULE_PACKS,
                                   internalRules = NS.INTERNAL_RULES } = {}) {
  if (!products || !clock) throw new Error('adapter exige products e clock');
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  return {
    platforms: Object.keys(rulePacks),
    products,

    /* acha o produto citado no texto (sku, prefixo do nome ou palavras).
       Ambíguo → null (a resposta vira visão de lista, nunca chute). */
    find(text) {
      const t = norm(text);
      const scored = products.map(p => {
        const name = norm(p.master.name);
        let score = 0;
        if (t.includes(norm(p.master.sku))) score += 3;
        if (t.includes(name.slice(0, 12))) score += 2;
        score += name.split(' ').filter(w => w.length > 3 && t.includes(w)).length;
        return { p, score };
      }).sort((a, b) => b.score - a.score);
      const [best, second] = scored;
      if (!best || best.score === 0) return null;
      if (best.score >= 2 && (!second || best.score > second.score)) return best.p;
      if (best.score === 1 && (!second || second.score === 0)) return best.p;
      return null;
    },

    evaluate(product, platform) {
      return NS.evaluate(product, platform, { rulePacks, internalRules, clock });
    },

    /* visão de lista: todos os produtos × praças (ou uma praça) */
    board(platform = null) {
      const out = [];
      for (const p of products) {
        const plats = platform ? [platform] : Object.keys(p.byPlatform || {});
        for (const plat of plats) {
          if (!rulePacks[plat]) continue;
          const r = NS.evaluate(p, plat, { rulePacks, internalRules, clock });
          const top = r.findings.find(f => f.severity === 'BLOCKER')
            || r.findings.find(f => f.severity === 'HIGH_RISK') || null;
          out.push({ sku: p.master.sku, name: p.master.name, platform: plat,
            status: r.status, topBlocker: top ? top.message : null,
            rulePackVersion: r.rulePackVersion, dataSource: r.dataSource });
        }
      }
      return out;
    },

    packInfo(platform) {
      const pack = rulePacks[platform];
      return pack ? { version: pack.version, verifiedAt: pack.verifiedAt,
                      dataSource: pack.dataSource } : null;
    },
  };
}

NS.createComplianceAdapter = createComplianceAdapter;
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.HEADCOMPLIANCE = globalThis.HEADCOMPLIANCE || {}));
