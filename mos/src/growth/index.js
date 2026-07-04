/* CRESCIMENTO (Sprint 10.B) — composição.

   createGrowth({ mos, clock, catalog, margin? }) monta a mesa comercial
   SOBRE a base existente: CatalogService (S10) para drafts, audit_log,
   bus e Clock. WhatsApp usa o gateway — o MESMO motor da tela, nunca
   uma automação paralela. */
'use strict';
const { PermissionService, ApprovalService, ROLES, PermissionError } = require('./permissions.js');
const { JobService, ACTION_ORIGINS, assertOrigin } = require('./jobs.js');
const { MarginService, computeMargin } = require('./margin.js');
const { ProvenanceService, FIELD_SOURCES } = require('./provenance.js');
const { AdaptationEngine } = require('./adaptation.js');
const { AffiliateService, AFFILIATE_STATUSES } = require('./affiliates.js');
const { PromotionService, PROMOTION_STATUSES, ExternalWriteError } = require('./promotions.js');
const { ResultsService } = require('./results.js');
const { IntakeService, INTAKE_ORIGINS } = require('./intake.js');
const { DataCompletionEngine, FIELD_MAP, ROUTING } = require('./data-completion.js');
const { GrowthCommandGateway } = require('./command-gateway.js');

function createGrowth({ mos, clock, catalog }) {
  if (!clock) throw new Error('createGrowth exige o Clock injetado');
  if (!catalog) throw new Error('createGrowth exige o CatalogService (S10) — nada paralelo');
  const { repos, bus } = mos;

  const permissions = new PermissionService({ repos });
  const approvals = new ApprovalService({ repos, permissions, clock });
  const jobs = new JobService({ repos, bus, clock });
  const margin = new MarginService({ repos, clock });
  const provenance = new ProvenanceService({ repos, clock });
  const adaptation = new AdaptationEngine({ repos, catalog, jobs, permissions,
    approvals, margin, bus, clock });
  const affiliates = new AffiliateService({ repos, permissions, approvals, clock, bus });
  const promotions = new PromotionService({ repos, margin, permissions, approvals, clock, bus });
  const results = new ResultsService({ repos, clock });
  const intake = new IntakeService({ repos, catalog, adaptation, permissions,
    jobs, bus, clock });
  const dataCompletion = new DataCompletionEngine({ repos, catalog, provenance,
    permissions, clock, bus });
  const gateway = new GrowthCommandGateway({ repos, adaptation, jobs, promotions,
    permissions, clock, intake, dataCompletion });

  return { permissions, approvals, jobs, margin, provenance, adaptation,
           affiliates, promotions, results, intake, dataCompletion, gateway };
}

module.exports = { createGrowth, ROLES, ACTION_ORIGINS, FIELD_SOURCES,
                   AFFILIATE_STATUSES,
                   PROMOTION_STATUSES, INTAKE_ORIGINS, FIELD_MAP, ROUTING,
                   PermissionError, ExternalWriteError,
                   assertOrigin, computeMargin };
