/* =============================================================
   V8TIME — Motor Temporal (SPRINT 10.E.2.5.2)
   Todo dado importado ganha contexto temporal (occurred_at,
   snapshot_at, period_start/end, imported_at, temporal_confidence,
   granularidade, timezone). O filtro global de período resolve
   presets (hoje, 7d, 30d, mês, ano, custom), filtra por data
   respeitando a GRANULARIDADE (agregado de 30 dias não vira dia
   falso) e declara COBERTURA honesta. Nada de data inventada.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8TIME = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TZ = 'America/Sao_Paulo';
  const HOJE = '2026-07-05'; /* relógio fixo da operação (mesmo das demais engines) */

  /* ---------- aritmética de datas em ISO (sem depender de fuso do runtime) ---------- */
  const toDate = s => { const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const startOfWeek = s => { const d = toDate(s); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return iso(d); }; /* segunda-feira */
  const startOfMonth = s => iso(new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, 1)));
  const endOfMonth = s => iso(new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7), 0)));
  const addMonths = (s, n) => { const d = toDate(s); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };

  const PRESETS = [
    ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['esta_semana', 'Esta semana'], ['semana_passada', 'Semana passada'],
    ['7d', 'Últimos 7 dias'], ['15d', 'Últimos 15 dias'], ['30d', 'Últimos 30 dias'],
    ['este_mes', 'Este mês'], ['mes_passado', 'Mês passado'], ['3m', 'Últimos 3 meses'],
    ['este_ano', 'Este ano'], ['ano_passado', 'Último ano'], ['custom', 'Período personalizado'],
  ];
  const LABEL = Object.fromEntries(PRESETS);

  /* resolve um preset para {ini, fim, label, tz} (datas ISO inclusivas) */
  function resolvePeriodo(preset, opts) {
    opts = opts || {};
    const hoje = opts.hoje || HOJE;
    const tz = opts.tz || TZ;
    let ini, fim, label = LABEL[preset] || preset;
    switch (preset) {
      case 'hoje': ini = fim = hoje; break;
      case 'ontem': ini = fim = addDays(hoje, -1); break;
      case 'esta_semana': ini = startOfWeek(hoje); fim = hoje; break;
      case 'semana_passada': { const sw = startOfWeek(hoje); ini = addDays(sw, -7); fim = addDays(sw, -1); break; }
      case '7d': ini = addDays(hoje, -6); fim = hoje; break;
      case '15d': ini = addDays(hoje, -14); fim = hoje; break;
      case '30d': ini = addDays(hoje, -29); fim = hoje; break;
      case 'este_mes': ini = startOfMonth(hoje); fim = hoje; break;
      case 'mes_passado': { const pm = addMonths(hoje, -1); ini = startOfMonth(pm); fim = endOfMonth(pm); break; }
      case '3m': ini = addDays(hoje, -89); fim = hoje; break;
      case 'este_ano': ini = hoje.slice(0, 4) + '-01-01'; fim = hoje; break;
      case 'ano_passado': { const y = +hoje.slice(0, 4) - 1; ini = y + '-01-01'; fim = y + '-12-31'; break; }
      case 'custom': ini = (opts.custom && opts.custom.ini) || hoje; fim = (opts.custom && opts.custom.fim) || hoje; label = `Personalizado (${ini} a ${fim})`; break;
      default: ini = addDays(hoje, -6); fim = hoje; label = LABEL['7d'];
    }
    return { preset, ini, fim, label, tz, coberturaTexto: `${ini} 00:00 até ${fim} 23:59` };
  }

  /* granularidade temporal de um registro (a partir do que a engine já marca) */
  function granularidadeDe(rec) {
    if (rec.granularidadeTemporal) return rec.granularidadeTemporal;
    const g = rec.granularidade || '';
    if (rec.snapshot_at || g === 'STATE_SNAPSHOT') return 'SNAPSHOT';
    if (rec.occurred_at || rec.data) return 'DAILY';
    if (g === 'PERIOD_METRIC' || rec.tipoLinha === 'PERIOD_SUMMARY' || (rec.period_start && rec.period_end)) return 'RANGE_AGGREGATE';
    if (g === 'DAILY_METRIC') return 'DAILY';
    return 'UNKNOWN';
  }

  /* data efetiva do evento (occurred_at → data → snapshot_at → period_end) */
  const dataEvento = rec => rec.occurred_at || rec.data || rec.snapshot_at || rec.period_end || rec.periodo_fim || null;
  const dentro = (d, per) => d != null && d >= per.ini && d <= per.fim;

  /* pertence ao período? DAILY/SNAPSHOT por data exata; RANGE_AGGREGATE só se o
     filtro CONTÉM todo o intervalo do agregado (senão não é atribuível ao recorte). */
  function pertenceAoPeriodo(rec, per) {
    const gran = granularidadeDe(rec);
    if (gran === 'DAILY' || gran === 'SNAPSHOT') { const d = (dataEvento(rec) || '').slice(0, 10); return dentro(d, per); }
    if (gran === 'RANGE_AGGREGATE') {
      const ps = (rec.period_start || rec.periodo_ini || '').slice(0, 10), pe = (rec.period_end || rec.periodo_fim || '').slice(0, 10);
      if (!ps || !pe) return false;
      return ps >= per.ini && pe <= per.fim; /* só entra se o recorte cobre todo o agregado */
    }
    return false; /* UNKNOWN nunca é atribuído a um período preciso */
  }

  /* COBERTURA temporal honesta de um conjunto de registros num período */
  function coberturaTemporal(recs, per) {
    if (!recs.length) return { status: 'SEM_DADOS_NO_PERIODO', granularidade: 'UNKNOWN', mensagem: 'Nenhum dado importado neste recorte.' };
    const grans = new Set(recs.map(granularidadeDe));
    const dentroList = recs.filter(r => pertenceAoPeriodo(r, per));
    const agregadosForaDoDia = recs.filter(r => granularidadeDe(r) === 'RANGE_AGGREGATE' && !pertenceAoPeriodo(r, per));
    if (!dentroList.length && agregadosForaDoDia.length) {
      const a = agregadosForaDoDia[0];
      return { status: 'DADO_SEM_DATA_EXATA', granularidade: 'RANGE_AGGREGATE',
        mensagem: `A fonte importada é um agregado (${(a.period_start || a.periodo_ini || '?')} a ${(a.period_end || a.periodo_fim || '?')}), sem quebra diária — não é possível recortar exatamente ${per.ini} a ${per.fim}.` };
    }
    if (!dentroList.length) return { status: 'SEM_DADOS_NO_PERIODO', granularidade: [...grans][0] || 'UNKNOWN', mensagem: 'Nenhum registro cai dentro do período selecionado.' };
    const datas = dentroList.map(r => (dataEvento(r) || '').slice(0, 10)).filter(Boolean).sort();
    const completa = datas.length && datas[0] <= per.ini && datas[datas.length - 1] >= per.fim;
    return { status: completa ? 'COBERTURA_COMPLETA' : 'COBERTURA_PARCIAL',
      granularidade: grans.has('DAILY') ? 'DAILY' : grans.has('SNAPSHOT') ? 'SNAPSHOT' : [...grans][0],
      mensagem: completa ? `Cobertura completa para ${per.ini} a ${per.fim}.` : `Cobertura parcial: dados de ${datas[0] || '?'} a ${datas[datas.length - 1] || '?'}.`,
      registros: dentroList.length };
  }

  /* confiança temporal de UM registro */
  function temporalConfidence(rec) {
    if (rec.occurred_at || rec.data) return 'CONFIRMADA';
    if (rec.snapshot_at) return 'CONFIRMADA';
    if (rec.period_start && rec.period_end) return 'PARCIAL';
    return 'AUSENTE';
  }

  /* filtra uma lista de registros pelo período (respeitando granularidade) */
  const filtrar = (recs, per) => recs.filter(r => pertenceAoPeriodo(r, per));

  /* consulta temporal genérica: soma/conta uma métrica no período, com metadados */
  function queryTemporal(recs, per, opts) {
    opts = opts || {};
    const cob = coberturaTemporal(recs, per);
    const dentroList = filtrar(recs, per);
    let valor = null;
    if (opts.campo) valor = dentroList.reduce((a, r) => a + (Number((r.metricas || {})[opts.campo] ?? r[opts.campo]) || 0), 0);
    else if (opts.contar) valor = dentroList.length;
    const fontes = Array.from(new Set(dentroList.map(r => r.sourceFile || r.fonte).filter(Boolean)));
    return { valor, registros: dentroList.length, periodo: per, timezone: per.tz, cobertura: cob.status,
      coberturaMensagem: cob.mensagem, granularidade: cob.granularidade, fonte: fontes.join(' + ') || '—',
      confianca: cob.status === 'COBERTURA_COMPLETA' ? 'alta' : cob.status === 'COBERTURA_PARCIAL' ? 'média' : 'sem base' };
  }

  return { TZ, HOJE, PRESETS, LABEL, resolvePeriodo, granularidadeDe, dataEvento, pertenceAoPeriodo,
    coberturaTemporal, temporalConfidence, filtrar, queryTemporal,
    _util: { addDays, startOfWeek, startOfMonth, endOfMonth, addMonths } };
}));
