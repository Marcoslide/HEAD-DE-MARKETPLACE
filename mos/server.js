#!/usr/bin/env node
/* SERVIDOR DE PRODUÇÃO (Sprint 10.A — Modo Ativação Real).

   Uso:  node mos/server.js
   Composição da plataforma inteira com relógio REAL e transportes REAIS:
   MOS + Central (S09) + Catálogo/Compliance (S10) + Head Chat (09.A) +
   Conexões reais (10.A). Nenhuma arquitetura nova — só a montagem.

   Toda credencial entra por VARIÁVEL DE AMBIENTE (nomes em .env.example).
   Nada real é tocado sem: config presente + feature flag ligada + gates.
   READ_ONLY continua o padrão absoluto; a única escrita possível é o
   piloto (PilotService), atrás de todos os gates.

   Atrás de um proxy HTTPS (o host público): o proxy termina o TLS e
   repassa para PORT. O corpo cru (rawBody) é preservado pelo router —
   necessário para a assinatura HMAC do webhook do WhatsApp. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createMOS } = require('./src/index.js');
const { createCentral } = require('./src/central/index.js');
const { CatalogService } = require('./src/catalog/catalog-service.js');
const { createGrowth } = require('./src/growth/index.js');
const { createRID } = require('./src/rid/index.js');
const { createLive } = require('./src/live/index.js');
const { createHeadChat } = require('./src/chat/index.js');
const { MLAuthHttp } = require('./src/live/ml-live.js');
const { createApi } = require('./src/interfaces/http/api.js');
const MIE = require('../mie/src/index.js');

const env = k => (process.env[k] && process.env[k].trim()) || null;

async function main() {
  /* relógio REAL (Sprint 08.1 — nenhuma outra fonte de tempo) */
  const clock = MIE.systemClock;

  /* banco persistente — NUNCA :memory: em produção */
  const dbFile = env('MOS_DB_FILE') || './data/mos.db';
  fs.mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true });
  const mos = createMOS({ dbFile, logLevel: env('MOS_LOG_LEVEL') || 'info' });

  /* avisos honestos de configuração (sem imprimir nenhum valor) */
  const warn = [];
  if (!env('MOS_CREDENTIAL_KEY'))
    warn.push('MOS_CREDENTIAL_KEY ausente — vault usando chave de desenvolvimento; defina antes de conectar contas reais');
  const mlMissing = ['ML_CLIENT_ID', 'ML_CLIENT_SECRET', 'ML_REDIRECT_URI'].filter(k => !env(k));
  const waMissing = ['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET',
    'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_WABA_ID', 'WHATSAPP_ACCESS_TOKEN'].filter(k => !env(k));
  if (mlMissing.length) warn.push(`OAuth Mercado Livre aguardando: ${mlMissing.join(', ')}`);
  if (waMissing.length) warn.push(`WhatsApp oficial aguardando: ${waMissing.join(', ')}`);

  /* transporte de leitura REAL: o mesmo contrato da Central (S09).
     O objeto é resolvido depois que o live monta o MLLiveTransport —
     os conectores só o usam quando uma conexão real sincroniza. */
  const liveRef = { transport: null };
  const transport = {
    kind: 'http',
    fetch: (...a) => liveRef.transport.fetch(...a),
    validate: (...a) => liveRef.transport.validate(...a),
  };
  const mlAuthHttp = mlMissing.length ? null : new MLAuthHttp({
    clientId: env('ML_CLIENT_ID'), clientSecret: env('ML_CLIENT_SECRET'),
    redirectUri: env('ML_REDIRECT_URI') });

  const central = createCentral({ mos, clock, transport,
    authTransport: mlAuthHttp, credentialKey: env('MOS_CREDENTIAL_KEY') });
  const catalog = new CatalogService({ repos: mos.repos, bus: mos.bus,
    providers: mos.providers, clock, logger: mos.logger });
  /* Crescimento (10.B): leads, afiliados, promoções + gateway de comando —
     o WhatsApp usa o MESMO Adaptation Engine da tela */
  const growth = createGrowth({ mos, clock, catalog });
  /* Head Intelligence OS (10.C): o RID orquestra o Growth — nada paralelo */
  const rid = createRID({ mos, clock, growth });
  growth.gateway.ridHook = rid.whatsappHook;

  const live = createLive({
    mos, clock, credentials: central.credentials,
    orchestrator: central.orchestrator, catalog,
    chatFactory: cid => createHeadChat({ clock, mos, companyId: cid }),
    /* config vem TODA do ambiente (os módulos leem process.env pelos
       mesmos nomes) — nunca de arquivo no Git */
    transports: { commandGateway: growth.gateway,
                  ...(mlAuthHttp ? { mlAuthHttp } : {}) },
  });
  liveRef.transport = live.mlTransport;

  const api = createApi(mos, {
    dev: env('MOS_DEV') === '1',          // observabilidade só quando pedida
    live,
    chat: null,
  });

  const port = Number(env('PORT')) || 3000;
  const server = await api.listen(port);
  const base = env('PUBLIC_BASE_URL') || `http://localhost:${port}`;

  mos.logger.info('server.started', { port, dbFile });
  console.log('─'.repeat(72));
  console.log('  Marketplace Operating System — servidor no ar (READ_ONLY padrão)');
  console.log(`  porta local : ${port}`);
  console.log(`  health check: curl -fsS ${base}/health`);
  console.log(`  callback ML : ${base}/oauth/ml/callback`);
  console.log(`  webhook WA  : ${base}/webhooks/whatsapp`);
  for (const w of warn) console.log(`  ⚠ ${w}`);
  console.log('  Flags: todas nascem DESLIGADAS (ordem em docs/live-activation-checklist.md)');
  console.log('─'.repeat(72));
  return server;
}

main().catch(err => { console.error('falha ao subir o servidor:', err.message); process.exit(1); });
