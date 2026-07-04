/* =============================================================
   CRIAR ANÚNCIO PELA CONVERSA — Operação (Sprint 10.B, complemento)

   A conversa inicia o trabalho; o Catálogo organiza, corrige e
   acompanha. Demonstração fiel do fluxo real (IntakeService):
   produto existente → marketplace → pendências → draft interno →
   Abrir no Catálogo. Fotos e links registram origem/uso — foto de
   referência NUNCA vira oficial; link NUNCA é copiado. Nada é
   publicado em marketplace algum.
   ============================================================= */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const box = () => $("#opChat");

  const S = { product: null, marketplace: null, photos: [], links: [], step: null };
  const PRODUCTS = [
    { sku: "ESP-ORG", name: "Espelho Decorativo Orgânico 70cm", missing: ["peso embalado", "material confirmado", "mín. 3 imagens (tem 1)"] },
    { sku: "QDR-SER", name: "Quadro Paisagem Serra 60x90 Moldura", missing: [] },
    { sku: "QDR-NOME", name: "Quadro Personalizado Nome Família", missing: ["prazo total acima do máximo Shopee"] },
    { sku: "KIT3-ABS", name: "Kit 3 Quadros Sala Abstrato 60x90", missing: ["EAN/GTIN"] },
  ];

  function head(html) {
    box().insertAdjacentHTML("beforeend",
      `<div class="msg head"><div class="who">Head</div><div class="reply">${html}</div></div>`);
    if (document.getElementById("v-operacao").classList.contains("on"))
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight }));
  }
  function user(t) {
    box().insertAdjacentHTML("beforeend",
      `<div class="msg user"><div class="who">${esc(DATA.user)}</div><div class="bubble">${esc(t)}</div></div>`);
  }
  const chips = arr => `<div class="an-chips">${arr.map(([label, fn]) =>
    `<button class="gro-mini" onclick="${fn}">${esc(label)}</button>`).join("")}</div>`;

  /* ---------------- fluxo guiado ---------------- */
  function start() {
    go("operacao");
    user("Criar anúncio");
    head(`<div class="op-main">Você quer anunciar um produto que já existe ou começar um produto novo?</div>` +
      chips([["Selecionar produto do catálogo", "Anuncio.pickProduct()"],
             ["Enviar fotos", "Anuncio.addPhoto(4)"],
             ["Colar link", "Anuncio.addLink()"],
             ["Digitar informações", "Anuncio.freeText()"],
             ["Continuar conversa livre", "Anuncio.free()"]]));
  }

  function pickProduct() {
    head(`<div class="op-main">Estes são os produtos do Catálogo — qual deles?</div>` +
      chips(PRODUCTS.map(p => [`${p.sku} — ${p.name}`, `Anuncio.selProduct('${p.sku}')`])));
  }

  function selProduct(sku) {
    S.product = PRODUCTS.find(p => p.sku === sku);
    user(`Leva o ${S.product.name} (${sku})`);
    head(`<div class="op-main">Encontrei <b>${esc(S.product.name)}</b> — SKU ${sku}. Vou adaptar usando a ficha central, imagens oficiais e as regras da praça escolhida.</div>` +
      `<div class="op-para">Para qual marketplace?</div>` +
      chips([["Shopee", "Anuncio.selMarketplace('Shopee')"],
             ["Mercado Livre", "Anuncio.selMarketplace('Mercado Livre')"],
             ["Magalu", "Anuncio.selMarketplace('Magalu')"],
             ["Shopee e Mercado Livre", "Anuncio.selMarketplace('Shopee e Mercado Livre')"]]));
  }

  function selMarketplace(mp) {
    S.marketplace = mp;
    user(mp);
    const miss = S.product ? S.product.missing : [];
    head(`<div class="op-main">Plano: rascunho interno de <b>${esc(S.product ? S.product.name : "produto")}</b> em <b>${esc(mp)}</b>, com rule pack da praça e validação de compliance.</div>` +
      (miss.length
        ? `<div class="op-alert">Antes de ficar pronto, faltam confirmar: ${esc(miss.join(" · "))}.</div>`
        : `<div class="op-para">Nenhuma pendência conhecida — o draft deve sair pronto para revisão.</div>`) +
      chips([["Criar rascunho", "Anuncio.createDraft()"]]));
  }

  function createDraft() {
    if (!S.product || !S.marketplace) { pickProduct(); return; }
    user("Criar rascunho");
    const multi = /e/.test(S.marketplace) && /Mercado/.test(S.marketplace) && /Shopee/.test(S.marketplace);
    const miss = S.product.missing;
    const lines = multi
      ? `<div class="op-line">• Mercado Livre: ${S.product.sku === "ESP-ORG" ? "pronto para revisão" : "pronto para revisão"}</div>` +
        `<div class="op-line">• Shopee: ${miss.length ? `em revisão (falta: ${esc(miss.slice(0, 2).join("; "))})` : "pronto para revisão"}</div>`
      : `<div class="op-line">• ${esc(S.marketplace)}: ${miss.length ? `aguardando ${esc(miss[0])} e revisão` : "pronto para revisão"}</div>`;
    head(`<div class="op-main">Rascunho ${esc(S.marketplace)} criado.</div>` + lines +
      (miss.length ? `<div class="op-para">Status: <b>Rascunho Shopee criado. Aguardando correção de ${esc(miss[0])} e revisão antes de publicação.</b></div>` : "") +
      `<div class="op-src">Job interno auditável · origem DASHBOARD_OPERATION · nenhum anúncio foi publicado</div>` +
      `<button class="op-link" onclick="Catalogo.open('${S.product.sku}');go('catalogo')">Abrir no Catálogo →</button>`);
    if (window.Crescimento) Crescimento.registerJob({ origin: "DASHBOARD_OPERATION",
      summary: `Rascunho ${S.marketplace} do ${S.product.name} criado pela conversa`,
      items: [`${S.product.sku} v1`] });
    toast("Draft interno criado pela conversa — revise no Catálogo. NADA foi publicado.");
  }

  /* ---------------- fotos, links, arquivos ---------------- */
  function addPhoto(n) {
    user(n > 1 ? `Enviando ${n} fotos` : "Enviando 1 foto");
    S.photos.push(...Array.from({ length: n }, (_, i) => `foto-${S.photos.length + i + 1}.jpg`));
    head(`<div class="op-main">Recebi ${n} foto(s) — registradas com origem, autor, data e hash. Nada entra no anúncio sem revisão.</div>` +
      `<div class="an-photos">${S.photos.slice(-n).map(f => `<div class="an-photo"><b>▦</b>${esc(f)}</div>`).join("")}</div>` +
      `<div class="op-para">Essas fotos são do <b>produto real</b> que será vendido ou apenas <b>referência</b>?</div>` +
      chips([["São do produto real", "Anuncio.photoKind('OFFICIAL')"],
             ["São só referência", "Anuncio.photoKind('REFERENCE')"]]));
  }

  function photoKind(kind) {
    user(kind === "OFFICIAL" ? "São do produto real" : "São só referência");
    head(kind === "OFFICIAL"
      ? `<div class="op-main">Perfeito — viram candidatas a <b>assets oficiais</b> (revisão humana pendente) e alimentam o Product Truth Pack. Eu nunca invento cor, medida, kit, acabamento ou embalagem: o que faltar, eu pergunto.</div>`
      : `<div class="op-main">Registradas como <b>referência</b> — ficam fora do anúncio e do Truth Pack, sempre. Foto de referência nunca vira foto oficial.</div>`);
  }

  function addLink() {
    user("Colando link: https://exemplo-marketplace.com/espelho-organico-grande");
    head(`<div class="op-main">Link registrado como <b>Source Reference</b> (domínio identificado). Eu nunca copio imagem, descrição ou conteúdo de terceiros.</div>` +
      `<div class="op-para">Como devo usar este link?</div>` +
      chips([["É anúncio próprio", "Anuncio.linkPurpose('próprio')"],
             ["Só referência/inspiração", "Anuncio.linkPurpose('referência')"],
             ["É concorrente", "Anuncio.linkPurpose('concorrente')"]]));
  }

  function linkPurpose(p) {
    user(p);
    head(p === "concorrente"
      ? `<div class="op-main">Uso apenas como referência estratégica: registro insights permitidos, mas descrição, imagens e marca <b>nunca são copiadas</b>, e o produto real precisa ser confirmado antes de qualquer draft.</div>`
      : p === "próprio"
        ? `<div class="op-main">Com a conta conectada (Conexões), posso importar os dados via integração oficial — preservando a origem e pedindo sua revisão antes de sobrescrever qualquer dado manual.</div>`
        : `<div class="op-main">Registrado como inspiração. Sigo com a ficha central como única verdade do produto.</div>`);
  }

  function addFile() {
    user("Enviando arquivo: medidas-espelho.pdf");
    head(`<div class="op-main">Arquivo registrado (origem, autor e hash). Se contiver medidas ou ficha técnica, uso como fonte — marcada como IMPORTACAO — depois da sua revisão.</div>`);
  }

  function pickMarketplace() {
    if (!S.product) { pickProduct(); return; }
    selMarketplace("Shopee");
  }
  function freeText() {
    user("Espelho orgânico 170x70, vidro 4mm");
    head(`<div class="op-main">Produto novo? Criei uma <b>entrada provisória</b> (Product Intake). Para virar ficha sem inventar dados, preciso de: fotos oficiais, medidas, material, peso embalado, custo e quantidade. Pergunto só o que faltar.</div>`);
  }
  function free() { head(`<div class="op-main">Certo — me diga o produto ou mande fotos/link quando quiser começar.</div>`); }

  window.Anuncio = { start, pickProduct, selProduct, selMarketplace, createDraft,
    addPhoto, photoKind, addLink, linkPurpose, addFile, pickMarketplace, freeText, free };
  const btn = $("#anStart");
  if (btn) btn.addEventListener("click", start);

  /* validação headless (?anself=1): percorre o fluxo completo */
  if (location.search.includes("anself")) {
    go("operacao");
    start(); pickProduct(); selProduct("ESP-ORG"); selMarketplace("Shopee");
    createDraft(); addPhoto(2); photoKind("REFERENCE"); addLink(); linkPurpose("concorrente");
    document.body.dataset.anuncioReady = "ok";
  }
})();
