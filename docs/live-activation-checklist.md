# Checklist de Ativação Real — o que VOCÊ precisa providenciar

> Sprint 10.A. Esta lista traz **somente nomes e instruções** — nunca cole
> segredos no chat. Valores entram como **variáveis de ambiente** no
> servidor (ver nomes abaixo) e ficam fora do Git.

## Mercado Livre

1. **App de desenvolvedor**: crie em developers.mercadolivre.com.br
   (Minhas aplicações → Criar aplicação).
2. Anote do app: **Client ID** e **Client Secret**.
3. Configure no app a **Redirect URI HTTPS** apontando para o seu domínio:
   `https://SEU-DOMINIO/oauth/ml/callback`.
4. Defina a **conta de destino** (a conta vendedora que fará o login no OAuth).
5. Escolha o **produto do piloto** e confirme: preço, estoque, peso
   embalado, dimensões embaladas, fotos oficiais e dados fiscais
   necessários (o Catálogo/v5 mostra o que falta).

Variáveis de ambiente (nomes):
```
ML_CLIENT_ID
ML_CLIENT_SECRET
ML_REDIRECT_URI
```

## WhatsApp Business (via oficial — Meta)

1. **Conta Meta Business** verificada (business.facebook.com).
2. **App** no developers.facebook.com com o produto WhatsApp habilitado.
3. **Número comercial** dedicado (não use número pessoal).
4. Anote: **Phone Number ID** e **WABA ID** (painel do WhatsApp no app).
5. Gere o **token oficial** (System User token com escopo WhatsApp).
6. Configure o **webhook**: URL `https://SEU-DOMINIO/webhooks/whatsapp`,
   com **verify token** definido por você (o mesmo valor da variável).
7. Defina o **número do administrador** para a allowlist do piloto de
   resposta (formato E.164, ex.: 5511988887777).

Variáveis de ambiente (nomes):
```
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_WABA_ID
WHATSAPP_VERIFY_TOKEN
WHATSAPP_APP_SECRET
WHATSAPP_ADMIN_ALLOWLIST
```

## Infraestrutura

- **Domínio HTTPS** público (callbacks e webhooks exigem TLS válido).
- URLs a registrar: `/oauth/ml/callback` (ML) e `/webhooks/whatsapp` (Meta).
- **Chave do vault** de credenciais: `MOS_CREDENTIAL_KEY` (32 bytes hex).
- Geração de imagem (opcional, para os criativos): `CREATIVE_IMAGE_PROVIDER`
  e `CREATIVE_IMAGE_API_KEY`.
- Ambiente de teste: se o marketplace oferecer usuários/apps de teste,
  priorize-os no primeiro piloto.
- Logs e backups do banco ativos antes do piloto.

## Como subir o servidor (FASE 1)

```bash
cp .env.example .env        # preencha os valores NO SERVIDOR (fora do Git)
node mos/server.js          # porta em PORT (default 3000)
curl -fsS https://SEU-DOMINIO/health   # health check → {"ok":true,...}
```

O host público (Railway, Render, Fly.io, VPS com Caddy/Nginx…) termina o
TLS e repassa para a porta do processo. O corpo cru chega intacto ao
webhook (assinatura HMAC validada sobre o `rawBody`). URLs finais:
`https://SEU-DOMINIO/oauth/ml/callback` e
`https://SEU-DOMINIO/webhooks/whatsapp`.

As feature flags são ligadas NO SERVIDOR (nunca via HTTP público):

```bash
node mos/tools/flag.js list <companyId>
node mos/tools/flag.js set MERCADO_LIVRE_OAUTH_ENABLED <companyId> on
```

## Ordem de ativação sugerida

1. Definir variáveis → subir o servidor com HTTPS.
2. Conexões → WhatsApp: validar webhook (a Meta chama o GET de verificação).
3. Ligar `WHATSAPP_INBOUND_ENABLED` e testar mensagem do administrador.
4. Ligar `MERCADO_LIVRE_OAUTH_ENABLED` → Conectar Mercado Livre → autorizar.
5. Ligar `MERCADO_LIVRE_LIVE_READ_ENABLED` → conferir a primeira sincronização.
6. Confirmar categoria oficial do produto piloto (pós-OAuth, automático no Dry Run).
7. Aprovar criativos (revisão humana) e deixar o draft READY_FOR_REVIEW.
8. Ligar `MERCADO_LIVRE_PILOT_CREATE_LISTING_ENABLED` (empresa+conta+usuário).
9. Dry Run → revisar payload → digitar `CRIAR ANÚNCIO PILOTO REAL` → confirmar.
