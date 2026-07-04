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
                resolveUser = null }) {
    this.r = repos; this.adaptation = adaptation; this.jobs = jobs;
    this.promotions = promotions; this.permissions = permissions; this.clock = clock;
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
  async handle({ companyId, from, text }) {
    const t = norm(text);
    const userId = this.resolveUser(companyId, from);

    /* 1. confirmação de um job pendente deste administrador */
    if (CONFIRM_RX.test(t)) {
      const pending = this.jobs.pendingFor(companyId, from);
      if (!pending) return { reply: 'Não há nenhuma ação aguardando sua confirmação.' };
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

    /* 4. escrita externa pedida explicitamente → recusa honesta */
    if (/\b(publica|publicar|ativa|ativar)\b.*(promocao|anuncio|campanha|ads)|\b(altera|alterar|muda|mudar)\b.*(preco|estoque)\b.*(shopee|mercado ?livre|tiktok|magalu)/.test(t))
      return { reply: 'Isso é uma ação EXTERNA no marketplace — eu não executo por WhatsApp. ' +
        'Preparei o caminho interno: revise e aprove na área correta (Catálogo/Crescimento/Conexões). ' +
        'Escrita externa continua bloqueada por READ_ONLY.' };

    return null;    // não é comando de ação → cai na Operational Query Layer
  }
}

module.exports = { GrowthCommandGateway };
