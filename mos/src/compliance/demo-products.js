/* DEMO PRODUCTS (Sprint 10) — os 4 cenários do sprint, no formato
   canônico do Product Master. Dados DEMONSTRATIVOS da operação real de
   quadros/espelhos/personalizados — nunca apresentados como regra oficial.

   1. QDR-SER  — pronto com pequenos alertas (Mercado Livre);
   2. ESP-ORG  — bloqueado por ficha técnica incompleta (Shopee);
   3. QDR-NOME — personalizado com risco operacional de prazo (Shopee);
   4. KIT3-ABS — campeão na Shopee, margem melhor no ML, expansão
                 incompleta no Magalu (sem EAN) e possível no TikTok. */
(function (NS) {
'use strict';

const DEMO_PRODUCTS = [
  {
    master: { id: 'prd-qdr-ser', companyId: 'demo', name: 'Quadro Paisagem Serra 60x90 Moldura', sku: 'QDR-SER' },
    profile: {
      brand: 'Quadros & Cia', productType: 'quadro', condition: 'novo',
      description: 'Quadro decorativo Paisagem Serra 60x90 cm com moldura em pinus e impressão em canvas fosco.',
      techSheet: { material: 'canvas + pinus', acabamento: 'fosco', tema: 'paisagem' },
      weightG: 1400, packedWeightG: 2100,
      heightCm: 90, widthCm: 60, depthCm: 3, packedDims: { h: 96, w: 66, d: 8 },
      fragile: 0, specialPackaging: 'cantoneiras + plástico bolha',
      productionDays: 2, personalizationDays: 0, madeToOrder: 0, dailyCapacity: 20,
      basePrice: 189.0, cost: 121.0, minMarginPct: 20,
      ean: '7890000000017', origin: 'nacional', warranty: '90 dias contra defeito',
      fiscal: { ncm: '4911.91.00', origem: '0' }, returnPolicy: '7 dias arrependimento (CDC)',
    },
    assets: [
      { kind: 'image', role: 'main', url: 'img/qdr-ser-1.jpg', width: 1200, height: 1200, format: 'jpg', sizeKb: 320, position: 0 },
      { kind: 'image', role: 'gallery', url: 'img/qdr-ser-2.jpg', width: 1200, height: 900, format: 'jpg', sizeKb: 320, position: 1 },
      { kind: 'image', role: 'gallery', url: 'img/qdr-ser-3.jpg', width: 480, height: 480, format: 'jpg', sizeKb: 320, position: 2 },
    ],
    byPlatform: {
      mercado_livre: {
        title: 'Quadro Paisagem Serra 60x90 Moldura Pinus Canvas Fosco',
        categoryId: 'MLB1367', categoryStatus: 'CONFIRMED',
        attributes: { material: 'canvas + pinus', largura_cm: 60, altura_cm: 90 },
        price: 189.0, stock: 15,
      },
      magalu: {
        title: 'Quadro Paisagem Serra 60x90 com Moldura',
        attributes: { material: 'canvas + pinus', ean: '7890000000017' },
        price: 199.0, stock: 10,
      },
    },
  },
  {
    master: { id: 'prd-esp-org', companyId: 'demo', name: 'Espelho Decorativo Orgânico 70cm', sku: 'ESP-ORG' },
    profile: {
      brand: 'Quadros & Cia', productType: 'espelho', condition: 'novo',
      description: 'Espelho orgânico 70 cm com borda em MDF.',
      techSheet: {},                      // ficha técnica INCOMPLETA (cenário 2)
      weightG: 2600, packedWeightG: null, // peso embalado AUSENTE
      heightCm: 70, widthCm: 50, depthCm: 2, packedDims: null,
      fragile: 1, specialPackaging: null, // frágil SEM proteção declarada
      productionDays: 3, personalizationDays: 0, madeToOrder: 0, dailyCapacity: 8,
      basePrice: 219.0, cost: 142.0, minMarginPct: 20,
      ean: null, origin: 'nacional', warranty: null,
      fiscal: {}, returnPolicy: '7 dias arrependimento (CDC)',
    },
    assets: [
      { kind: 'image', role: 'main', url: 'img/esp-org-1.jpg', width: 1000, height: 1000, format: 'jpg', sizeKb: 320, position: 0 },
    ],
    byPlatform: {
      shopee: {
        title: 'Espelho Decorativo Orgânico 70cm Sala Hall',
        attributes: {},                    // atributo obrigatório (material) AUSENTE
        price: 219.0, stock: 18,
      },
    },
  },
  {
    master: { id: 'prd-qdr-nome', companyId: 'demo', name: 'Quadro Personalizado Nome Família', sku: 'QDR-NOME' },
    profile: {
      brand: 'Quadros & Cia', productType: 'quadro personalizado', condition: 'novo',
      description: 'Quadro personalizado com o nome da família, arte aprovada pelo cliente antes da produção.',
      techSheet: { material: 'canvas', acabamento: 'fosco' },
      weightG: 1100, packedWeightG: 1700,
      heightCm: 70, widthCm: 50, depthCm: 3, packedDims: { h: 76, w: 56, d: 8 },
      fragile: 0, specialPackaging: 'cantoneiras',
      productionDays: 4, personalizationDays: 8,   // prazo total 12 dias (cenário 3)
      madeToOrder: 1, dailyCapacity: 5,
      personalization: { fields: ['nome', 'frase'], requiresArtApproval: true, maxVariations: 3 },
      basePrice: 159.0, cost: 84.0, minMarginPct: 20,
      ean: null, origin: 'nacional', warranty: '90 dias contra defeito',
      fiscal: { ncm: '4911.91.00' }, returnPolicy: null,   // política de devolução INDEFINIDA
    },
    assets: [
      { kind: 'image', role: 'main', url: 'img/qdr-nome-1.jpg', width: 1080, height: 1080, format: 'jpg', sizeKb: 320, position: 0 },
      { kind: 'image', role: 'gallery', url: 'img/qdr-nome-2.jpg', width: 1080, height: 1080, format: 'jpg', sizeKb: 320, position: 1 },
      { kind: 'image', role: 'gallery', url: 'img/qdr-nome-3.jpg', width: 1080, height: 1080, format: 'jpg', sizeKb: 320, position: 2 },
    ],
    demand: { customPendingToday: 7 },     // 7 na fila p/ capacidade 5 (risco interno)
    byPlatform: {
      shopee: {
        title: 'Quadro Personalizado Nome da Família Canvas 50x70',
        categoryId: '100636', categoryStatus: 'CONFIRMED',
        attributes: { material: 'canvas' },
        price: 159.0, stock: 30,
      },
    },
  },
  {
    master: { id: 'prd-kit3-abs', companyId: 'demo', name: 'Kit 3 Quadros Sala Abstrato 60x90', sku: 'KIT3-ABS' },
    profile: {
      brand: 'Quadros & Cia', productType: 'kit quadros', condition: 'novo',
      description: 'Kit com 3 quadros abstratos 60x90 para sala, impressão em canvas com moldura.',
      techSheet: { material: 'canvas + pinus', tema: 'abstrato' },
      weightG: 3600, packedWeightG: 4900,
      heightCm: 90, widthCm: 60, depthCm: 9, packedDims: { h: 96, w: 66, d: 14 },
      fragile: 0, specialPackaging: 'cantoneiras + plástico bolha',
      productionDays: 2, personalizationDays: 0, madeToOrder: 0, dailyCapacity: 12,
      basePrice: 129.9, cost: 74.9, minMarginPct: 20,
      ean: null,                            // SEM EAN → bloqueia Magalu (cenário 4)
      origin: 'nacional', warranty: '90 dias contra defeito',
      fiscal: { ncm: '4911.91.00' }, returnPolicy: '7 dias arrependimento (CDC)',
    },
    assets: [
      { kind: 'image', role: 'main', url: 'img/kit3-1.jpg', width: 1200, height: 1200, format: 'jpg', sizeKb: 320, position: 0 },
      { kind: 'image', role: 'gallery', url: 'img/kit3-2.jpg', width: 1200, height: 1200, format: 'jpg', sizeKb: 320, position: 1 },
      { kind: 'image', role: 'gallery', url: 'img/kit3-3.jpg', width: 1200, height: 900, format: 'jpg', sizeKb: 320, position: 2 },
    ],
    byPlatform: {
      shopee: {
        title: 'Kit 3 Quadros Sala Abstrato 60x90 Canvas Moldura',
        categoryId: '100636', categoryStatus: 'CONFIRMED',
        attributes: { material: 'canvas + pinus' },
        price: 129.9, stock: 4,
      },
      mercado_livre: {
        title: 'Kit 3 Quadros Decorativos Sala Abstrato 60x90 Canvas',
        categoryId: 'MLB1367', categoryStatus: 'CONFIRMED',
        attributes: { material: 'canvas + pinus', largura_cm: 60, altura_cm: 90 },
        price: 149.9, stock: 22,
      },
      magalu: {
        title: 'Kit 3 Quadros Sala Abstrato 60x90',
        attributes: { material: 'canvas + pinus' },
        price: 159.9, stock: 12,
      },
      tiktok: {
        title: 'Kit 3 Quadros Abstratos p/ Sala 60x90',
        attributes: { material: 'canvas + pinus' },
        price: 139.9, stock: 12,
        content: {},                        // SEM vídeo ainda → alerta do canal
      },
    },
  },
];

NS.DEMO_PRODUCTS = DEMO_PRODUCTS;
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.HEADCOMPLIANCE = globalThis.HEADCOMPLIANCE || {}));
