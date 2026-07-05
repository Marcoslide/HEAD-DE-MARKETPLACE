/* =============================================================
   v8 · CRESCIMENTO › ORGÂNICO E SEO (10.P.3)
   Ajuda a melhorar ranking, visibilidade, CTR e conversão DENTRO
   do marketplace — sempre com FATO → HIPÓTESE → TESTE. Nunca alega
   conhecer o algoritmo do marketplace; nunca afirma causa sem
   evidência. Lê os anúncios reais do Catálogo (V8CAT); sem dado de
   performance, declara ausência e não inventa.
   ============================================================= */
(function () {
  'use strict';
  const SEO = window.SEO = { aba: 'Oportunidades de Ranking' };
  const ABAS = ['Oportunidades de Ranking', 'Problemas de Visibilidade', 'Testes e Melhorias'];
  const pct = v => v == null ? '—' : v + '%';

  /* completude de cadastro a partir do que existe no anúncio */
  function cadastro(cat, l) {
    const titulo = String(V8CAT.valorDe(cat, l, 'titulo') || V8CAT.valorDe(cat, l, 'nome') || '');
    const descricao = String(V8CAT.valorDe(cat, l, 'descricao') || '');
    const atributos = V8CAT.valorDe(cat, l, 'atributos') || V8CAT.valorDe(cat, l, 'ficha') || null;
    const nAtrib = atributos && typeof atributos === 'object' ? Object.keys(atributos).length : (Array.isArray(atributos) ? atributos.length : 0);
    const fotos = (window.CATALOGO && CATALOGO.eng) ? V8CAT.fotosDe(cat, l.id).length : 0;
    const faltas = [];
    if (titulo.length < 30) faltas.push('título curto (' + titulo.length + ' car.)');
    if (fotos < 3) faltas.push('poucas fotos (' + fotos + ')');
    if (nAtrib < 3) faltas.push('atributos incompletos (' + nAtrib + ')');
    if (descricao.length < 120) faltas.push('descrição curta');
    return { titulo, fotos, nAtrib, descricaoLen: descricao.length, faltas };
  }

  /* fato/hipótese/teste por anúncio — só métrica observada e ação mensurável */
  function analisar() {
    if (!window.CATALOGO || !CATALOGO.eng) return { oportunidades: [], problemas: [], testes: [], cobertura: 'SEM CATÁLOGO' };
    const cat = CATALOGO.eng();
    const listings = V8CAT.ativos(cat).slice(0, 60);
    const impres = listings.map(l => (l.perf && l.perf.impressoes) || 0).filter(x => x > 0).sort((a, b) => a - b);
    const medianaImp = impres.length ? impres[Math.floor(impres.length / 2)] : 0;
    const oportunidades = [], problemas = [], testes = [];
    let comDados = 0;
    for (const l of listings) {
      const pf = V8CAT.perfComercial(cat, l);
      const c = cadastro(cat, l);
      const nome = c.titulo || (V8CAT.prodOf ? '' : '') || l.skuPai || l.id;
      const mkt = l.mktNome || (l.marketplace || '');
      if (pf.semDados) continue;
      comDados++;
      const ctr = pf.ctr && pf.ctr.taxa, conv = pf.conversaoVisitas && pf.conversaoVisitas.taxa;
      const imp = pf.impressoes || 0, vend = pf.vendidos30d || 0;
      const perLabel = typeof pf.periodo === 'string' ? pf.periodo
        : (pf.periodo && (pf.periodo.label || pf.periodo.rotulo || pf.periodo.periodo)) || '30 dias';
      const base = { nome, mkt, sku: l.skuPai, itemId: l.itemId || l.externalId || null,
        fonte: pf.fonte || 'NORMALIZED', periodo: perLabel, cobertura: typeof pf.cobertura === 'string' ? pf.cobertura : 'parcial', confianca: typeof pf.confianca === 'string' ? pf.confianca : 'média' };

      /* OPORTUNIDADE: converte bem mas recebe pouca impressão */
      if (conv != null && conv >= 3 && imp > 0 && imp < medianaImp) {
        oportunidades.push(Object.assign({}, base,
          { fato: `Conversão de ${pct(conv)} com apenas ${imp.toLocaleString('pt-BR')} impressões (abaixo da mediana ${medianaImp.toLocaleString('pt-BR')}).`,
            hipotese: 'O anúncio converte, mas recebe pouca exposição — pode ganhar posição com cadastro mais forte e sinais de relevância.',
            teste: 'Reforçar título com termos de busca, completar atributos e acompanhar impressões por 14 dias.', impacto: 'Mais tráfego qualificado no mesmo anúncio que já converte.' }));
      } else if (vend >= 8 && c.faltas.length === 0) {
        oportunidades.push(Object.assign({}, base,
          { fato: `${vend} vendas em 30d com cadastro completo (título, fotos e atributos).`,
            hipotese: 'Anúncio saudável e completo — candidato a escalar exposição.',
            teste: 'Avaliar Ads/posição e replicar o padrão de cadastro em anúncios similares.', impacto: 'Escala sobre um anúncio já validado.' }));
      }

      /* PROBLEMA DE VISIBILIDADE: muita impressão e CTR baixo, ou CTR ok e conversão baixa, ou cadastro fraco */
      if (imp > Math.max(8000, medianaImp) && ctr != null && ctr < 0.8) {
        problemas.push(Object.assign({}, base,
          { fato: `${imp.toLocaleString('pt-BR')} impressões e CTR de ${pct(ctr)} (clique baixo para a exposição).`,
            hipotese: 'Imagem principal, título ou preço na vitrine podem estar reduzindo o clique. (Hipótese — não afirmamos causa.)',
            teste: 'Testar nova imagem principal e novo título; medir CTR antes/depois no mesmo período.', impacto: 'Recuperar clique de um anúncio que já tem exposição.' }));
      } else if (ctr != null && ctr >= 1 && conv != null && conv < 1.2) {
        problemas.push(Object.assign({}, base,
          { fato: `CTR de ${pct(ctr)} mas conversão de ${pct(conv)} (clica e não compra).`,
            hipotese: 'Preço, prazo, avaliações ou a página do anúncio podem estar travando a conversão.',
            teste: 'Revisar preço/frete e a descrição; testar uma variável por vez e medir conversão.', impacto: 'Converter tráfego que já chega.' }));
      } else if (c.faltas.length >= 2) {
        problemas.push(Object.assign({}, base,
          { fato: `Cadastro fraco: ${c.faltas.join(', ')}.`,
            hipotese: 'Cadastro incompleto tende a limitar visibilidade e clareza para o comprador.',
            teste: 'Completar título, fotos e atributos; acompanhar impressões e CTR depois.', impacto: 'Base de relevância antes de investir em tráfego.' }));
      }
    }
    /* TESTES = ações mensuráveis derivadas dos problemas e oportunidades (dedup por sku+teste) */
    const seen = new Set();
    for (const it of problemas.concat(oportunidades)) {
      const k = (it.sku || it.nome) + '|' + it.teste;
      if (seen.has(k)) continue; seen.add(k);
      testes.push({ nome: it.nome, mkt: it.mkt, sku: it.sku, acao: it.teste, origem: it.fato, impacto: it.impacto,
        fonte: it.fonte, periodo: it.periodo, confianca: it.confianca });
    }
    const cobertura = comDados === 0 ? 'SEM DADOS DE PERFORMANCE' : `${comDados} anúncio(s) com performance`;
    return { oportunidades, problemas, testes, cobertura, total: listings.length, comDados };
  }

  const fnt = b => `<span class="src">fonte: ${UI.esc(b.fonte)} · período: ${UI.esc(b.periodo)} · cobertura: ${UI.esc(b.cobertura || '—')} · confiança: ${UI.esc(b.confianca)}</span>`;

  function card(it) {
    return `<div class="panel" style="margin-top:10px">
      <div class="sect-h" style="margin-top:0"><span class="h2">${UI.esc(it.nome || it.sku || '—')}</span>
        <span class="src">${UI.esc(it.mkt || '')}${it.itemId ? ' · Item ' + UI.esc(String(it.itemId)) : ''}${it.sku ? ' · ' + UI.esc(it.sku) : ''}</span></div>
      <p style="margin:8px 0 2px"><span class="sep-line">FATO</span> ${UI.esc(it.fato)}</p>
      <p style="margin:2px 0"><span class="sep-line">HIPÓTESE</span> ${UI.esc(it.hipotese)}</p>
      <p style="margin:2px 0"><span class="sep-line">TESTE</span> ${UI.esc(it.teste)}</p>
      ${it.impacto ? `<p class="src" style="margin:4px 0 6px">impacto esperado: ${UI.esc(it.impacto)}</p>` : ''}
      ${fnt(it)}</div>`;
  }

  function render() {
    const el = document.querySelector('#v-seo'); if (!el) return;
    const a = analisar();
    const disclaimer = `<div class="callout" style="margin-top:0">O Head <b>não conhece o algoritmo</b> do marketplace. Aqui usamos <b>FATO</b> (métrica observada) → <b>HIPÓTESE</b> (fator possível) → <b>TESTE</b> (ação mensurável). Nenhuma causa é afirmada sem evidência.</div>`;
    const tabs = `<div class="tabs" style="margin-top:14px;flex-wrap:wrap">${ABAS.map(s =>
      `<button class="tab ${s === SEO.aba ? 'on' : ''}" data-act="seotab" data-sub="${s}">${s}<span class="cnt">${
        s === 'Oportunidades de Ranking' ? a.oportunidades.length : s === 'Problemas de Visibilidade' ? a.problemas.length : a.testes.length}</span></button>`).join('')}</div>`;
    let corpo;
    if (a.comDados === 0) {
      corpo = `<div class="panel"><div class="empty"><b>Sem dados de performance no escopo.</b>
        Importe o relatório de Performance/Tráfego do marketplace — o SEO só analisa com métrica de fonte, nunca estimada.</div></div>`;
    } else if (SEO.aba === 'Oportunidades de Ranking') {
      corpo = a.oportunidades.length ? a.oportunidades.map(card).join('') :
        `<div class="panel"><div class="empty">Nenhuma oportunidade clara de ranking no período — o painel só sobe o que tem evidência.</div></div>`;
    } else if (SEO.aba === 'Problemas de Visibilidade') {
      corpo = a.problemas.length ? a.problemas.map(card).join('') :
        `<div class="panel"><div class="empty">Nenhum problema de visibilidade destacado no período.</div></div>`;
    } else {
      corpo = a.testes.length ? `<div class="tblwrap"><table class="tbl"><thead><tr>
        <th class="nosort">Anúncio</th><th class="nosort">Ação de teste</th><th class="nosort">Origem (fato)</th><th class="nosort">Confiança</th></tr></thead><tbody>
        ${a.testes.map(t => `<tr><td class="tmain">${UI.esc(t.nome || t.sku || '—')}<span class="tsub">${UI.esc(t.mkt || '')}</span></td>
          <td>${UI.esc(t.acao)}</td><td><span class="src">${UI.esc(t.origem)}</span></td><td>${UI.esc(t.confianca)}</td></tr>`).join('')}
        </tbody></table></div><p class="src" style="margin-top:8px">Cada teste mede uma variável por vez; o resultado vira aprendizado em Execução › Conhecimento.</p>` :
        `<div class="panel"><div class="empty">Sem testes recomendados no período.</div></div>`;
    }
    el.innerHTML = `
      <div class="sect-h"><div><div class="eyebrow">CRESCIMENTO · ORGÂNICO E SEO</div>
        <h1 class="h1">Orgânico e SEO</h1>
        <p class="sub">Melhorar ranking, visibilidade, CTR e conversão dentro do marketplace — por evidência, não por achismo.</p></div>
        <span class="src">${UI.esc(a.cobertura)}</span></div>
      ${disclaimer}
      ${tabs}
      <div id="seoBody" style="margin-top:12px">${corpo}</div>`;
    el.querySelectorAll('[data-act="seotab"]').forEach(b => b.addEventListener('click', () => { SEO.aba = b.dataset.sub; render(); }));
  }

  UI.renderers.seo = render;
})();
