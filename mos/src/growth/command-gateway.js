/* GATEWAY DE COMANDO (Sprint 10.B) — WhatsApp como controle remoto.

   Fluxo obrigatório do comando em massa:
   WhatsApp → identifica filtros e praça → RESUMO do que será feito →
   pede CONFIRMAÇÃO → job interno auditável (origem WHATSAPP_COMMAND) →
   o MESMO Adaptation Engine da tela → resultado no WhatsApp → detalhe
   no Catálogo.

   O WhatsApp NUNCA: publica, altera preço/estoque externo, ativa
   promoção externa ou cria anúncio real. Consultas seguem para a mesma
   Operational Query Layer (HeadChat). */
'use strict';

const PLATFORM_RX = [
  ['shopee', /shopee/], ['mercado_livre', /mercado ?livre|meli|\bml\b/],
  ['tiktok', /tik ?tok/], ['magalu', /magalu/],
];
const CONFIRM_RX = /^(sim|confirmo|confirmar|pode executar|confirmado)[.!]?$/i;
const norm = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

class GrowthCommandGateway {
  constructor({ repos, adaptation, jobs, promotions, permissions, clock,
                intake = null, dataCompletion = null, resolveUser = null }) {
    this.r = repos; this.adaptation = adaptation; this.jobs = jobs;
    this.promotions = promotions; this.permissions = permissions; this.clock = clock;
    this.intake = intake;               // criação de anúncio pela conversa
    this.dataCompletion = dataCompletion; // pendências de dado via WhatsApp
    /* telefone → usuário (admin da allowlist); padrão: dono da empresa */
    this.resolveUser = resolveUser || ((companyId) => {
      const u = this.r.user.db.get(
        `SELECT u.id FROM user u JOIN company c ON c.workspace_id = u.workspace_id
         WHERE c.id = ? ORDER BY u.id LIMIT 1`, companyId);
      return u ? u.id : null;
    });
  }

  _platform(t) {
    for (const [id, rx] of PLATFORM_RX) if (rx.test(t)) return id;
    return null;
  }

  /* devolve { reply } quando o gateway trata; null → segue para o chat */
  async handle({ companyId, from, text, kind = 'text', mediaId = null,
                 messageId = null }) {
    const t = norm(text);
    const userId = this.resolveUser(companyId, from);

    /* 0. FOTO/DOCUMENTO: inicia ou alimenta um intake de anúncio */
    if ((kind === 'image' || kind === 'document') && this.intake) {
      let row = this.r.productIntake.db.get(
        `SELECT * FROM product_intake WHERE company_id = ? AND responsible = ?
         AND origin = 'WHATSAPP_COMMAND' AND status LIKE 'AWAITING%' OR
         company_id = ? AND responsible = ? AND origin = 'WHATSAPP_COMMAND' AND status = 'NEW'
         ORDER BY id DESC LIMIT 1`, companyId, from, companyId, from);
      if (!row) {
        const s = this.intake.start({ companyId, userId,
          origin: 'WHATSAPP_COMMAND', text: text || '', messageId });
        if (s.mode === 'NEW_PRODUCT') {
          row = s.intake;
          this.r.productIntake.update(row.id, { responsible: from });
        }
      }
      const a = this.intake.attachAsset({ companyId,
        intakeId: row ? row.id : null, kind: 'UNCLASSIFIED',
        url: `whatsapp-media://${mediaId || messageId}`, uploadedBy: userId,
        origin: 'WHATSAPP_COMMAND', messageId, assetType: kind });
      const match = text ? this.intake.matchProduct(companyId, text) : [];
      const matchLine = match.length
        ? `Encontrei possível produto parecido no Catálogo: ${match[0].name}. Quer usar esse produto existente ou criar um novo? `
        : '';
      return { reply: `Recebi a foto (registrada com origem e hash — nada é usado sem revisão). ` +
        matchLine + (a.question || ''), assetId: a.asset.id,
        intakeId: row ? row.id : null };
    }

    /* 0b. LINK colado: Source Reference — nunca copiamos conteúdo */
    const urlMatch = (text || '').match(/https?:\/\/\S+/);
    if (urlMatch && this.intake && !/cria|criar|leva|faz/.test(t)) {
      const r = this.intake.registerLink({ companyId, url: urlMatch[0],
        origin: 'WHATSAPP_COMMAND', registeredBy: userId });
      return { reply: `Link registrado como referência (${r.reference.domain || 'domínio desconhecido'}). ` +
        `${r.question} Nunca copio imagem, descrição ou conteúdo de terceiros.`,
        referenceId: r.reference.id };
    }

    /* 1. confirmação de um job pendente deste administrador */
    if (CONFIRM_RX.test(t)) {
      const pending = this.jobs.pendingFor(companyId, from);
      if (!pending) {
        /* pode ser confirmação de resposta ambígua do Data Completion */
        if (this.dataCompletion) {
          const dc = await this.dataCompletion.answer({ companyId, from, text });
          if (dc.handled) return { reply: dc.reply, dataCompletion: true };
        }
        return { reply: 'Não há nenhuma ação aguardando sua confirmação.' };
      }
      this.jobs.confirm(pending.id, { userId });
      const result = await this.adaptation.execute(pending.id, { userId });
      const review = result.reviewOnly.length
        ? `\n${result.reviewOnly.length} rascunho(s) ficaram em revisão (margem não calculada).` : '';
      return { reply:
        `✔ Ação executada (job ${result.jobId}).\n` +
        `${result.succeeded} rascunho(s) interno(s) criado(s)` +
        `${result.failed ? `, ${result.failed} falhou(aram)` : ''}.${review}\n` +
        `Nada foi publicado no marketplace — revise e aprove na área Catálogo.`,
        jobId: result.jobId, executed: true };
    }

    /* 2. comando em massa: criar drafts com filtros */
    if (/\b(cria|criar|gera|gerar)\b.*(drafts?|rascunhos?)/.test(t)) {
      const targetPlatform = this._platform(t);
      if (!targetPlatform)
        return { reply: 'Para qual marketplace? (Shopee, Mercado Livre, TikTok Shop ou Magalu)' };
      const filters = {};
      const margin = t.match(/margem (?:acima de|maior que|>) ?(\d+(?:[.,]\d+)?)\s*%/);
      if (margin) filters.marginAbovePct = Number(margin[1].replace(',', '.'));
      const name = t.match(/dos (?:produtos |quadros |itens )?([a-z0-9 ]+?) com margem/)
        || t.match(/dos (?:quadros|produtos itens) ([a-z0-9x ]+)/);
      if (name && name[1] && !/produtos?$/.test(name[1].trim())) filters.nameContains = name[1].trim();

      const plan = this.adaptation.plan({ companyId, targetPlatform, filters });
      if (!plan.items.length)
        return { reply: `Nenhum produto atende aos filtros (${plan.skipped.length} fora por: ` +
          `${[...new Set(plan.skipped.map(s => s.reason))].slice(0, 3).join('; ') || 'sem produtos'}). Nada foi criado.` };

      const { job, requiresConfirmation } = this.adaptation.requestExecution({
        companyId, userId, origin: 'WHATSAPP_COMMAND', plan, requesterRef: from });
      if (!requiresConfirmation) {
        const result = await this.adaptation.execute(job.id, { userId });
        return { reply: `✔ 1 rascunho interno criado em ${targetPlatform} (job ${result.jobId}). ` +
          `Nada foi publicado — revise no Catálogo.`, jobId: job.id, executed: true };
      }
      const lines = plan.items.slice(0, 6).map(i =>
        `• ${i.sku} — ${i.name}${i.marginPct != null ? ` (margem ~${String(i.marginPct).replace('.', ',')}%)` : ' (margem a revisar)'}`);
      return { reply:
        `Vou criar ${plan.items.length} rascunho(s) interno(s) de anúncio em ${targetPlatform}:\n` +
        `${lines.join('\n')}${plan.items.length > 6 ? `\n… e mais ${plan.items.length - 6}` : ''}\n` +
        `${plan.skipped.length ? `${plan.skipped.length} produto(s) fora dos filtros.\n` : ''}` +
        `NENHUMA publicação externa acontece — só rascunhos para sua revisão no Catálogo.\n` +
        `Responda SIM para confirmar (job ${job.id}).`,
        jobId: job.id, awaitingConfirmation: true };
    }

    /* 3. promoção/campanha interna via comando */
    if (/\b(cria|criar)\b.*(promocao|campanha)/.test(t)) {
      const marketplace = this._platform(t) || 'shopee';
      const isCampaign = /campanha/.test(t);
      const pct = t.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (isCampaign) {
        const c = this.promotions.createCampaign({ companyId, userId,
          origin: 'WHATSAPP_COMMAND', name: `Campanha via WhatsApp ${this.clock.nowIso().slice(0, 10)}`,
          objective: text.trim() });
        return { reply: `✔ Campanha interna criada em rascunho (${c.id}). ` +
          `Defina alvos e objetivo na área Crescimento — nada foi ativado externamente.`,
          campaignId: c.id, executed: true };
      }
      const promo = this.promotions.create({ companyId, userId,
        origin: 'WHATSAPP_COMMAND', name: `Promoção via WhatsApp ${this.clock.nowIso().slice(0, 10)}`,
        marketplace, discountType: 'PCT',
        discountValue: pct ? Number(pct[1].replace(',', '.')) : 10, targets: [] });
      return { reply: `✔ Promoção interna criada em RASCUNHO (${promo.id}) para ${marketplace}` +
        `${pct ? ` com ${pct[1]}% de desconto` : ''}. Selecione os produtos e simule a margem ` +
        `na área Crescimento. NADA foi ativado no marketplace.`,
        promotionId: promo.id, executed: true };
    }

    /* 3b. criação de ANÚNCIO pela conversa (intake): produto existente → drafts
       por praça; produto desconhecido → intake com perguntas objetivas */
    if (this.intake && (/(cria|criar|faz|fazer)\w*\b.*(anuncio|na shopee|no mercado ?livre)/.test(t)
        || /quero anunciar/.test(t) || /leva (esse|este|o |esse )?.*(para|pra) (a |o )?(shopee|mercado ?livre|magalu|tik ?tok|todos)/.test(t))) {
      const marketplaces = /todos( os marketplaces| as pracas)?/.test(t)
        ? PLATFORM_RX.map(([id]) => id)
        : PLATFORM_RX.filter(([, rx]) => rx.test(t)).map(([id]) => id);
      const matches = this.intake.matchProduct(companyId, text);
      if (!matches.length) {
        const s = this.intake.start({ companyId, userId,
          origin: 'WHATSAPP_COMMAND', text, marketplaces, messageId });
        if (s.intake) this.r.productIntake.update(s.intake.id, { responsible: from });
        return { reply: 'Não encontrei esse produto no Catálogo. Vou tratar como produto NOVO ' +
          '(entrada provisória criada). Me manda as fotos do produto real e as informações: ' +
          'medidas, material, peso embalado, custo e quantidade disponível. Nada vira ficha ' +
          'definitiva sem sua revisão.', intakeId: s.intake ? s.intake.id : null };
      }
      if (!marketplaces.length)
        return { reply: `Encontrei ${matches[0].name} (${matches[0].sku}). Para qual marketplace devo preparar o rascunho?` };
      const product = matches[0];
      const r = await this.intake.createDrafts({ companyId, userId,
        origin: 'WHATSAPP_COMMAND', productId: product.id,
        marketplaces, requesterRef: from });
      /* pendências dos drafts viram DataRequests perguntáveis */
      let asked = null;
      if (this.dataCompletion) {
        const reqs = r.results.filter(x => x.draftId)
          .flatMap(x => this.dataCompletion.fromDraft(x.draftId));
        if (reqs.length) asked = await this.dataCompletion.ask(reqs.map(q => q.id),
          { channel: 'whatsapp', to: from });
      }
      const lines = r.results.map(x =>
        `- ${x.marketplace}: ${x.readiness}${x.pending.length ? ` (falta: ${x.pending.slice(0, 2).join('; ')})` : ''}`);
      return { reply: `Criei ${r.results.length} rascunho(s) interno(s) do ${product.name}:\n` +
        `${lines.join('\n')}\n` +
        `Nenhum anúncio foi publicado. Revise no Catálogo: ${r.results.map(x => x.openInCatalog).filter(Boolean).join(' · ')}` +
        (asked ? `\n\n${asked.question}` : ''),
        drafts: r.results, intake: false };
    }

    /* 4. escrita externa pedida explicitamente → recusa honesta */
    if (/\b(publica|publicar|ativa|ativar)\b.*(promocao|anuncio|campanha|ads)|\b(altera|alterar|muda|mudar)\b.*(preco|estoque)\b.*(shopee|mercado ?livre|tiktok|magalu)/.test(t))
      return { reply: 'Isso é uma ação EXTERNA no marketplace — eu não executo por WhatsApp. ' +
        'Preparei o caminho interno: revise e aprove na área correta (Catálogo/Crescimento/Conexões). ' +
        'Escrita externa continua bloqueada por READ_ONLY.' };

    /* 5. resposta de pendência do Data Completion (peso, material, medidas…) */
    if (this.dataCompletion) {
      const dc = await this.dataCompletion.answer({ companyId, from, text });
      if (dc.handled) return { reply: dc.reply, dataCompletion: true,
                               applied: dc.applied || [] };
    }

    return null;    // não é comando de ação → cai na Operational Query Layer
  }
}

module.exports = { GrowthCommandGateway };
