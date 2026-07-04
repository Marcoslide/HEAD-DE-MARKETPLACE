/* Providers (Bloco 08) — arquitetura desacoplada para os marketplaces.
   REGRA ABSOLUTA: nenhuma comunicação externa nesta fase. Cada provider
   é contrato + adapter + mock. Quando as APIs oficiais chegarem, apenas
   os métodos _do* de cada adapter mudam — pipeline e serviços, não.

   Contrato (MarketplaceProvider):
     capabilities()                → o que a praça suporta
     adaptAttributes(listing)      → payload no formato da praça
     validate(listing)             → issues[] (bloqueantes e avisos)
     publish(payload)              → { externalId, status }        [simulado]
     update(externalId, payload)   → { status }                    [simulado]
     pause/resume(externalId)      → { status }                    [simulado]
     fetchStatus(externalId)       → { status, ranking }           [simulado] */
'use strict';
const { newId } = require('../kernel/id.js');

class MarketplaceProvider {
  constructor(name) { this.name = name; }
  capabilities() { return { titleMaxLen: 100, minImages: 1, video: false }; }

  /* validações comuns + específicas da praça */
  validate(listing) {
    const issues = [];
    const cap = this.capabilities();
    if (!listing.title || !listing.title.trim())
      issues.push({ level: 'error', rule: 'title_required', msg: 'título é obrigatório' });
    else if (listing.title.length > cap.titleMaxLen)
      issues.push({ level: 'error', rule: 'title_max', msg: `título excede ${cap.titleMaxLen} caracteres nesta praça` });
    if (!(listing.price > 0))
      issues.push({ level: 'error', rule: 'price_positive', msg: 'preço deve ser positivo' });
    const images = listing.images || [];
    if (images.length < cap.minImages)
      issues.push({ level: 'error', rule: 'min_images', msg: `mínimo de ${cap.minImages} imagem(ns)` });
    if (!listing.category)
      issues.push({ level: 'error', rule: 'category_required', msg: 'categoria é obrigatória' });
    issues.push(...this.validateSpecific(listing));
    return issues;
  }
  validateSpecific() { return []; }

  adaptAttributes(listing) {
    return { title: listing.title, price: listing.price,
             images: listing.images || [], category: listing.category,
             attributes: listing.attributes || {} };
  }

  /* ---- simulados (a fronteira que vira API real no futuro) ---- */
  publish() { return { externalId: newId(`ext_${this.name}`), status: 'published_simulated' }; }
  update() { return { status: 'updated_simulated' }; }
  pause() { return { status: 'paused_simulated' }; }
  resume() { return { status: 'active_simulated' }; }
  fetchStatus() { return { status: 'active_simulated', ranking: Math.ceil(Math.random() * 20) }; }
}

/* ---------- adapters por praça (regras REAIS de cada marketplace) ---------- */

class MercadoLivreProvider extends MarketplaceProvider {
  constructor() { super('mercado_livre'); }
  capabilities() { return { titleMaxLen: 60, minImages: 1, video: true }; }
  validateSpecific(l) {
    const issues = [];
    if (/frete gr[aá]tis/i.test(l.title || ''))
      issues.push({ level: 'error', rule: 'ml_no_shipping_in_title', msg: 'ML proíbe condições de frete no título' });
    if ((l.images || []).length < 3)
      issues.push({ level: 'warning', rule: 'ml_images_reco', msg: 'ML recomenda 3+ imagens para ranquear' });
    return issues;
  }
  adaptAttributes(l) {
    return { ...super.adaptAttributes(l), listing_type_id: 'gold_special', condition: 'new' };
  }
}

class ShopeeProvider extends MarketplaceProvider {
  constructor() { super('shopee'); }
  capabilities() { return { titleMaxLen: 100, minImages: 3, video: true }; }
  validateSpecific(l) {
    return (l.price && l.price < 5)
      ? [{ level: 'error', rule: 'shopee_min_price', msg: 'Shopee exige preço mínimo de R$ 5' }] : [];
  }
  adaptAttributes(l) {
    return { ...super.adaptAttributes(l), logistics: { cb_option: false }, wholesale: [] };
  }
}

class AmazonProvider extends MarketplaceProvider {
  constructor() { super('amazon'); }
  capabilities() { return { titleMaxLen: 200, minImages: 1, video: false }; }
  validateSpecific(l) {
    return (!l.attributes || !l.attributes.brand)
      ? [{ level: 'error', rule: 'amazon_brand_required', msg: 'Amazon exige atributo brand' }] : [];
  }
  adaptAttributes(l) {
    return { ...super.adaptAttributes(l), fulfillment: 'FBM', bullet_points: [] };
  }
}

class MagaluProvider extends MarketplaceProvider {
  constructor() { super('magalu'); }
  capabilities() { return { titleMaxLen: 100, minImages: 2, video: false }; }
  validateSpecific(l) {
    return (!l.attributes || !l.attributes.ean)
      ? [{ level: 'error', rule: 'magalu_ean_required', msg: 'Magalu exige EAN' }] : [];
  }
}

class TikTokProvider extends MarketplaceProvider {
  constructor() { super('tiktok'); }
  capabilities() { return { titleMaxLen: 80, minImages: 1, video: true }; }
  validateSpecific(l) {
    return (!l.video)
      ? [{ level: 'warning', rule: 'tiktok_video_reco', msg: 'TikTok Shop converte muito mais com vídeo' }] : [];
  }
}

function createProviderRegistry() {
  const providers = new Map();
  for (const P of [MercadoLivreProvider, ShopeeProvider, AmazonProvider, MagaluProvider, TikTokProvider]) {
    const p = new P();
    providers.set(p.name, p);
  }
  return {
    get(name) {
      const p = providers.get(name);
      if (!p) throw new Error('provider desconhecido: ' + name);
      return p;
    },
    names: () => [...providers.keys()],
  };
}

module.exports = { MarketplaceProvider, createProviderRegistry };
