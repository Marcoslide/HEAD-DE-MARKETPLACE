/* DATA COMPLETION ENGINE (Sprint 10.B — complemento).

   Pendência não morre como alerta na tela: vira DataRequest auditável,
   pergunta objetiva (agrupada, com contexto e formato sugerido) para a
   PESSOA CERTA, interpreta a resposta natural, atualiza o campo certo
   com fonte e versão, revalida os drafts afetados e devolve o resultado.

   Regras: nunca perguntar o que já existe; nunca repetir pergunta
   aberta; resposta ambígua exige confirmação; "não sei/depois/cancelar"
   são respostas válidas; isolamento por empresa; nenhum segredo sai. */
'use strict';

/* campo → onde vive + como normalizar */
const FIELD_MAP = {
  pesoEmbalado: { column: 'packed_weight_g', label: 'peso embalado',
    format: 'em kg, por exemplo: `14,2 kg`', unit: 'g' },
  peso: { column: 'weight_g', label: 'peso do produto',
    format: 'em kg, por exemplo: `1,4 kg`', unit: 'g' },
  material: { json: 'tech_sheet_json', key: 'material', label: 'material principal',
    format: 'por exemplo: `vidro 4 mm`, `mdf`, `canvas`' },
  medidas: { columns: ['height_cm', 'width_cm', 'depth_cm'], label: 'medidas (A×L)',
    format: 'por exemplo: `170 por 70`' },
  custo: { column: 'cost', label: 'custo do produto',
    format: 'em reais, por exemplo: `79` ou `R$ 79,90`' },
  preco: { column: 'base_price', label: 'preço pretendido',
    format: 'em reais, por exemplo: `219`' },
  estoque: { marketplaceColumn: 'stock', label: 'quantidade disponível',
    format: 'por exemplo: `18 unidades`' },
  embalagem: { column: 'special_packaging', label: 'proteção da embalagem',
    format: 'por exemplo: `caixa reforçada com cantoneiras e isopor`' },
  prazo: { column: 'production_days', label: 'prazo de produção',
    format: 'em dias, por exemplo: `3 dias`' },
  ean: { column: 'ean', label: 'EAN', format: 'código de 13 dígitos' },
};

/* roteamento por tipo de informação → papel responsável */
const ROUTING = {
  pesoEmbalado: 'OPERADOR_CATALOGO', peso: 'OPERADOR_CATALOGO',
  medidas: 'OPERADOR_CATALOGO', embalagem: 'OPERADOR_CATALOGO',
  material: 'OPERADOR_CATALOGO', estoque: 'OPERADOR_CATALOGO',
  prazo: 'OPERADOR_CATALOGO',
  custo: 'FINANCEIRO', preco: 'GESTOR_MARKETPLACE',
  ean: 'GESTOR_MARKETPLACE', categoria: 'GESTOR_MARKETPLACE',
  atributo: 'GESTOR_MARKETPLACE', fotoOficial: 'OPERADOR_CATALOGO',
  aprovacaoImagem: 'GESTOR_MARKETPLACE',
};

const NUM_WORDS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20 };
const norm = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const numOf = s => {
  const m = String(s).replace(',', '.').match(/\d+(?:\.\d+)?/);
  if (m) return Number(m[0]);
  const w = norm(s).split(/\s+/).find(x => NUM_WORDS[x] != null);
  return w != null ? NUM_WORDS[w] : null;
};

class DataCompletionEngine {
  constructor({ repos, catalog, provenance, permissions, clock, bus,
                whatsappSend = null }) {
    this.r = repos; this.catalog = catalog; this.provenance = provenance;
    this.permissions = permissions; this.clock = clock; this.bus = bus;
    this.whatsappSend = whatsappSend;   // (to, text) → envia pela via oficial (ou outbox)
  }

  _hasValue(productId, field) {
    const map = FIELD_MAP[field];
    if (!map) return false;
    const p = this.r.productProfile.db.get(
      'SELECT * FROM product_profile WHERE product_id = ?', productId);
    if (!p) return false;
    if (map.column) return p[map.column] != null && p[map.column] !== '';
    if (map.json) return !!(JSON.parse(p[map.json] || '{}')[map.key]);
    if (map.columns) return map.columns.every(c => p[c] != null);
    return false;
  }

  /* ---------- 1. abrir pendência (com dedup e roteamento) ---------- */
  open({ companyId, productId, draftId = null, marketplace = null, field,
         motive = null, criticality = 'HIGH', rulePack = null, ruleSource = null }) {
    const map = FIELD_MAP[field];
    if (!map) throw new Error(`campo desconhecido para pendência: ${field}`);
    /* nunca perguntar o que já existe */
    if (this._hasValue(productId, field))
      return { created: false, reason: 'campo já preenchido no Product Master — pergunta não criada' };
    /* nunca repetir pergunta aberta */
    const existing = this.r.dataRequest.db.get(
      `SELECT id FROM data_request WHERE company_id = ? AND product_id = ? AND field = ?
       AND status IN ('OPEN','ASKED','ANSWERED','NEEDS_CONFIRMATION')`, companyId, productId, field);
    if (existing) return { created: false, reason: `pendência já aberta (${existing.id})`,
                           requestId: existing.id };

    const role = ROUTING[field] || null;
    const responsible = role ? this.r.userRole.db.get(
      `SELECT user_id FROM user_role WHERE company_id = ? AND role = ? LIMIT 1`,
      companyId, role) : null;
    /* sem responsável definido → administrador + UNASSIGNED */
    const admin = this.r.user.db.get(
      `SELECT u.id FROM user u JOIN company c ON c.workspace_id = u.workspace_id
       WHERE c.id = ? ORDER BY u.id LIMIT 1`, companyId);
    const req = this.r.dataRequest.insert({
      company_id: companyId, product_id: productId, listing_draft_id: draftId,
      marketplace, field, label: map.label,
      motive: motive || 'necessário para a ficha e validação do anúncio',
      criticality, rule_pack: rulePack, rule_source: ruleSource,
      status: 'OPEN', responsible_role: role,
      responsible_user: responsible ? responsible.user_id : (admin ? admin.id : null),
      unassigned: responsible ? 0 : 1,
      expected_format: map.format, audit_json: [],
      created_at: this.clock.nowIso() });
    this.r.audit.record('data-request', 'opened', { companyId, entity: 'data_request',
      entityId: req.id, detail: { field, productId, marketplace, criticality,
        role, unassigned: !responsible } });
    return { created: true, request: req };
  }

  /* abre pendências a partir dos findings de um draft (agrupáveis) */
  fromDraft(draftId) {
    const draft = this.r.listingDraft.byId(draftId);
    const findings = JSON.parse(draft.findings_json || '[]');
    const created = [];
    const FIELD_HINTS = [
      [/peso embalado/i, 'pesoEmbalado'], [/\bpeso\b/i, 'peso'],
      [/material/i, 'material'], [/medid|dimens|largura|altura/i, 'medidas'],
      [/custo/i, 'custo'], [/estoque|quantidade/i, 'estoque'],
      [/embalagem|prote[cç]/i, 'embalagem'], [/prazo/i, 'prazo'], [/ean|gtin/i, 'ean']];
    for (const f of findings) {
      if (!['BLOCKER', 'UNKNOWN', 'HIGH_RISK'].includes(f.severity)) continue;
      const hint = FIELD_HINTS.find(([rx]) => rx.test(f.message || ''));
      if (!hint) continue;
      const r = this.open({ companyId: draft.company_id, productId: draft.product_id,
        draftId, marketplace: draft.platform, field: hint[1],
        motive: f.message, criticality: f.severity === 'BLOCKER' ? 'BLOCKER' : 'HIGH',
        rulePack: draft.suggestions_source, ruleSource: f.ruleId || null });
      if (r.created) created.push(r.request);
    }
    return created;
  }

  /* ---------- 2. pergunta agrupada, com contexto e formato ---------- */
  buildQuestion(requestIds) {
    const reqs = requestIds.map(id => this.r.dataRequest.byId(id));
    if (!reqs.length) return null;
    const product = this.r.product.byId(reqs[0].product_id);
    const mp = reqs[0].marketplace;
    const ctx = `o rascunho ${mp || ''} do ${product.name}`.replace('  ', ' ');
    if (reqs.length === 1) {
      const r = reqs[0];
      return `Para liberar ${ctx}, preciso confirmar ${r.label}. ` +
        `${r.motive ? `Motivo: ${r.motive}. ` : ''}Pode responder ${r.expected_format}.`;
    }
    const lines = reqs.map((r, i) => `${i + 1}. ${r.label[0].toUpperCase()}${r.label.slice(1)}`);
    const example = reqs.map(r => {
      const ex = { pesoEmbalado: 'peso 14,2 kg', peso: 'peso 1,4 kg',
        material: 'material vidro 4 mm', medidas: 'mede 170 por 70',
        custo: 'custo R$ 79', preco: 'preço R$ 219', estoque: '18 unidades',
        embalagem: 'embalagem caixa reforçada com cantoneiras e isopor',
        prazo: 'prazo 3 dias', ean: 'ean 7890000000000' }[r.field];
      return ex || r.label;
    }).join(' | ');
    return `Para liberar ${ctx}, faltam:\n${lines.join('\n')}\n\nPode responder assim:\n\`${example}\`.`;
  }

  /* dispara a pergunta (WhatsApp oficial p/ allowlisted ou dashboard) */
  async ask(requestIds, { channel = 'dashboard', to = null } = {}) {
    const question = this.buildQuestion(requestIds);
    for (const id of requestIds) {
      this.r.dataRequest.update(id, { status: 'ASKED', channel,
        responsible_ref: to, question_text: question,
        asked_at: this.clock.nowIso() });
      const req = this.r.dataRequest.byId(id);
      this.r.audit.record('data-request', 'asked', { companyId: req.company_id,
        entity: 'data_request', entityId: id, detail: { channel, to } });
    }
    if (channel === 'whatsapp' && this.whatsappSend && to)
      await this.whatsappSend(to, question);
    return { question, asked: requestIds.length, channel };
  }

  /* pendências ASKED aguardando este respondente */
  pendingAskedFor(companyId, responderRef) {
    return this.r.dataRequest.db.all(
      `SELECT * FROM data_request WHERE company_id = ?
       AND status IN ('ASKED','NEEDS_CONFIRMATION')
       AND (responsible_ref = ? OR responsible_ref IS NULL AND channel = 'dashboard')
       ORDER BY CASE criticality WHEN 'BLOCKER' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END, id`,
      companyId, responderRef);
  }

  /* ---------- 3. interpretar resposta natural ---------- */
  interpret(text) {
    const t = norm(text);
    const out = [];
    /* segmentos "a | b | c" ou frases */
    const segs = t.split(/[|;]/).map(s => s.trim()).filter(Boolean);
    for (const seg of segs.length ? segs : [t]) {
      let m;
      if ((m = seg.match(/(?:peso(?: embalado)?\s*)?(\d+[.,]?\d*|\w+)\s*(kg|quilos?)\b/))) {
        const v = numOf(m[1]); if (v != null)
          out.push({ field: seg.includes('embalado') || !/produto/.test(seg) ? 'pesoEmbalado' : 'peso',
                     value: Math.round(v * 1000), display: `${String(v).replace('.', ',')} kg` });
      } else if ((m = seg.match(/(\d+[.,]?\d*)\s*g\b/)) && /peso/.test(seg)) {
        out.push({ field: 'pesoEmbalado', value: Math.round(numOf(m[1])), display: `${m[1]} g` });
      }
      if ((m = seg.match(/(?:material\s*)?(vidro|mdf|madeira|metal|canvas|acrilico|aluminio|pinus)(?:\s*(?:de\s*)?(\d+[.,]?\d*)\s*mm)?/))) {
        out.push({ field: 'material',
          value: m[2] ? `${m[1]} ${m[2].replace('.', ',')} mm` : m[1],
          display: m[2] ? `${m[1]} ${m[2]} mm` : m[1] });
      }
      if ((m = seg.match(/(?:mede\s*)?(\d+)\s*(?:x|por)\s*(\d+)(?:\s*(?:x|por)\s*(\d+))?/)) && /med|x|por/.test(seg)) {
        out.push({ field: 'medidas',
          value: { h: Number(m[1]), w: Number(m[2]), d: m[3] ? Number(m[3]) : null },
          display: `${m[1]}×${m[2]}${m[3] ? `×${m[3]}` : ''} cm` });
      }
      if ((m = seg.match(/kit com (\d+|\w+)/))) {
        const v = numOf(m[1]); if (v != null)
          out.push({ field: 'kit', value: v, display: `kit com ${v}` });
      }
      if ((m = seg.match(/(?:temos|estoque(?: de)?)\s*(\d+|\w+)(?:\s*unidades?)?/))
          || (m = seg.match(/(\d+)\s*unidades?/))) {
        const v = numOf(m[1]); if (v != null)
          out.push({ field: 'estoque', value: v, display: `${v} unidades` });
      }
      if ((m = seg.match(/(?:custa|custo(?: de)?)\s*r?\$?\s*(\d+[.,]?\d*)(?:\s*reais)?/))) {
        out.push({ field: 'custo', value: numOf(m[1]), display: `R$ ${m[1]}` });
      } else if ((m = seg.match(/(?:preco(?: de)?)\s*r?\$?\s*(\d+[.,]?\d*)/))) {
        out.push({ field: 'preco', value: numOf(m[1]), display: `R$ ${m[1]}` });
      }
      if ((m = seg.match(/embalagem\s+(.+)|(caixa reforcada[^.|]*|cantoneira[^.|]*|isopor[^.|]*)/))) {
        out.push({ field: 'embalagem', value: (m[1] || m[2]).trim(), display: (m[1] || m[2]).trim() });
      }
      if ((m = seg.match(/prazo(?: de)?\s*(\d+|\w+)\s*dias?|(\d+)\s*dias? de producao/))) {
        const v = numOf(m[1] || m[2]); if (v != null)
          out.push({ field: 'prazo', value: v, display: `${v} dias` });
      }
      if ((m = seg.match(/ean\s*(\d{8,14})/))) {
        out.push({ field: 'ean', value: m[1], display: m[1] });
      }
    }
    /* dedup por campo (primeira ocorrência vence) */
    const seen = new Set();
    return out.filter(x => !seen.has(x.field) && seen.add(x.field));
  }

  /* ---------- 4. resposta → campo certo + versão + revalidação ---------- */
  async answer({ companyId, from = null, text, answeredBy = null }) {
    const t = norm(text);
    const pending = this.pendingAskedFor(companyId, from);
    if (!pending.length)
      return { handled: false, reason: 'nenhuma pendência aguardando este respondente' };

    /* respostas de controle */
    if (/^(nao sei|não sei|verificar|depois)$/.test(t)) {
      for (const p of pending) this.r.dataRequest.update(p.id, {
        status: 'OPEN', audit_json: this._trail(p, { event: 'postponed', by: from }) });
      return { handled: true, control: 'postponed',
               reply: 'Sem problema — deixo as pendências abertas e volto a perguntar quando fizer sentido.' };
    }
    if (/^cancelar?$/.test(t)) {
      for (const p of pending) this.r.dataRequest.update(p.id, {
        status: 'CANCELLED', resolved_at: this.clock.nowIso(),
        audit_json: this._trail(p, { event: 'cancelled', by: from }) });
      return { handled: true, control: 'cancelled', reply: 'Pendências canceladas.' };
    }
    /* confirmação de resposta ambígua pendente */
    const needsConf = pending.find(p => p.status === 'NEEDS_CONFIRMATION');
    if (needsConf && /^(sim|certo|isso|confirmo|exato)[.!]?$/.test(t)) {
      const value = JSON.parse(needsConf.answer_normalized);
      const r = await this._apply(needsConf, value,
        { answeredBy: answeredBy || from, raw: text });
      return { handled: true, applied: [r],
        reply: `Confirmado — ${r.summary}. ` +
          (r.revalidation.drafts.length
            ? `Drafts revalidados (${r.revalidation.drafts.map(d => d.marketplace).join(', ')}). ` : '') +
          'Nenhum anúncio foi publicado.' };
    }

    const parsed = this.interpret(text);
    if (!parsed.length)
      return { handled: true,
        reply: `Não consegui mapear essa resposta para as pendências abertas (${pending.map(p => p.label).join(', ')}). ` +
          `Pode responder no formato sugerido? Ex.: ${pending[0].expected_format}` };

    const applied = [], ambiguous = [];
    for (const item of parsed) {
      const matches = pending.filter(p => p.field === item.field);
      if (!matches.length) continue;
      if (matches.length > 1) {
        /* mesma resposta serviria a mais de um produto → NUNCA assumir */
        const p = matches[0];
        const prod = this.r.product.byId(p.product_id);
        this.r.dataRequest.update(p.id, { status: 'NEEDS_CONFIRMATION',
          answer_raw: text, answer_normalized: JSON.stringify(item.value),
          confidence: 'AMBIGUA' });
        ambiguous.push(`Você está confirmando ${item.display} para ${p.label} do ${prod.name}, certo?`);
        continue;
      }
      const r = await this._apply(matches[0], item.value,
        { answeredBy: answeredBy || from, raw: text, display: item.display });
      applied.push(r);
    }
    if (!applied.length && ambiguous.length)
      return { handled: true, needsConfirmation: true, reply: ambiguous.join('\n') };

    const stillOpen = this.pendingAskedFor(companyId, from)
      .filter(p => p.status === 'ASKED');
    const lines = applied.map(a => a.summary);
    const reval = applied[0] ? applied[0].revalidation : null;
    let reply = `Atualizei: ${lines.join('; ')}.`;
    if (reval && reval.drafts.length) {
      const ready = reval.drafts.filter(d => d.readiness === 'pronto para revisão');
      reply += ready.length === reval.drafts.length
        ? ` Draft ${reval.drafts.map(d => d.marketplace).join(', ')} revalidado: pronto para revisão.`
        : ` Drafts revalidados. Ainda falta: ${reval.drafts.flatMap(d => d.pending).slice(0, 4).join('; ') || 'revisão humana'}.`;
    }
    if (stillOpen.length)
      reply += ` Pendências restantes: ${stillOpen.map(p => p.label).join(', ')}.`;
    reply += ' Nenhum anúncio foi publicado.';
    return { handled: true, applied, reply, ambiguous };
  }

  _trail(req, event) {
    const trail = JSON.parse(req.audit_json || '[]');
    trail.push({ ...event, at: this.clock.nowIso() });
    return trail;
  }

  async _apply(req, value, { answeredBy = null, raw = null, display = null } = {}) {
    const map = FIELD_MAP[req.field];
    const profile = this.r.productProfile.db.get(
      'SELECT * FROM product_profile WHERE product_id = ?', req.product_id);
    let previous = null;

    if (map.column) {
      previous = profile[map.column];
      this.provenance.setFields(req.product_id, { [map.column]: value },
        'WHATSAPP_COMMAND', { byUser: answeredBy });
    } else if (map.json) {
      const sheet = JSON.parse(profile[map.json] || '{}');
      previous = sheet[map.key];
      sheet[map.key] = value;
      this.provenance.setFields(req.product_id, { [map.json]: sheet },
        'WHATSAPP_COMMAND', { byUser: answeredBy });
    } else if (map.columns) {
      previous = map.columns.map(c => profile[c]).join('×');
      const patch = { height_cm: value.h, width_cm: value.w };
      if (value.d != null) patch.depth_cm = value.d;
      this.provenance.setFields(req.product_id, patch,
        'WHATSAPP_COMMAND', { byUser: answeredBy });
    } else if (map.marketplaceColumn) {
      /* estoque é por praça: NUNCA sobrescreve outra praça */
      const mp = req.marketplace;
      const row = this.r.marketplaceProfile.db.get(
        `SELECT * FROM marketplace_product_profile WHERE product_id = ? AND platform = ?`,
        req.product_id, mp);
      previous = row ? row.stock : null;
      if (row) this.r.marketplaceProfile.update(row.id, { stock: value,
        updated_at: this.clock.nowIso() });
      else this.r.marketplaceProfile.insert({ product_id: req.product_id,
        company_id: req.company_id, platform: mp, stock: value,
        updated_at: this.clock.nowIso() });
    }

    /* revalidar TODOS os drafts afetados — nova versão com valor novo */
    const drafts = this.r.listingDraft.db.all(
      `SELECT DISTINCT platform FROM listing_draft
       WHERE product_id = ? AND status != 'ARCHIVED'`, req.product_id);
    const revalidated = [];
    for (const { platform } of drafts) {
      const d = this.catalog.createDraft(req.product_id, platform);
      const findings = d.findings || [];
      revalidated.push({ marketplace: platform, draftId: d.id, version: d.version,
        status: d.status,
        readiness: d.status === 'READY_FOR_REVIEW' ? 'pronto para revisão'
          : findings.some(f => f.severity === 'BLOCKER') ? 'bloqueado' : 'em revisão',
        pending: findings.filter(f => ['BLOCKER', 'UNKNOWN'].includes(f.severity))
          .map(f => f.message).slice(0, 4) });
    }

    const updated = this.r.dataRequest.update(req.id, {
      status: 'RESOLVED', answer_raw: raw,
      answer_normalized: JSON.stringify(value),
      previous_value: previous != null ? String(previous) : null,
      confidence: 'ALTA', source: 'WHATSAPP_COMMAND', answered_by: answeredBy,
      answered_at: this.clock.nowIso(), resolved_at: this.clock.nowIso(),
      audit_json: this._trail(req, { event: 'answered', by: answeredBy,
        previous, value }) });
    this.r.audit.record('data-request', 'resolved', { companyId: req.company_id,
      entity: 'data_request', entityId: req.id,
      detail: { field: req.field, previous, value, by: answeredBy,
                revalidated: revalidated.length } });
    this.bus.emit('data_request.resolved', { requestId: req.id, field: req.field });
    return { request: updated,
      summary: `${req.label} → ${display || JSON.stringify(value)}`,
      revalidation: { drafts: revalidated } };
  }

  /* pendências para a tela (Catálogo/Pendências) */
  board(companyId, filters = {}) {
    let sql = 'SELECT * FROM data_request WHERE company_id = ?';
    const params = [companyId];
    if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
    if (filters.productId) { sql += ' AND product_id = ?'; params.push(filters.productId); }
    if (filters.marketplace) { sql += ' AND marketplace = ?'; params.push(filters.marketplace); }
    if (filters.criticality) { sql += ' AND criticality = ?'; params.push(filters.criticality); }
    return this.r.dataRequest.db.all(sql + ' ORDER BY id DESC', ...params);
  }
}

module.exports = { DataCompletionEngine, FIELD_MAP, ROUTING };
