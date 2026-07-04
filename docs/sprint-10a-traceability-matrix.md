# Sprint 10.A — Matriz de Rastreabilidade das 30 Garantias

> Prova explícita: requisito → arquivo → nome exato do teste → novo/reaproveitado → resultado.
> Os 18 blocos novos de `mos/test/live.test.js` cobrem múltiplas garantias cada;
> 6 garantias têm cobertura REFORÇADA por testes já existentes (S09/S10/09.A).
> Rodada de referência: suíte completa **230/230 verdes** (74 MIE + 156 MOS).

| # | Requisito | Arquivo | Teste (nome exato) | Novo? | Resultado |
|---|---|---|---|---|---|
| 1 | Menu possui Conexões | `mos/test/live.test.js` | `v5: menu com Conexões e aviso de modo demonstração` | novo | ✅ |
| 2 | OAuth State único, expirável, uso único | `mos/test/live.test.js` | `OAuth state é de uso único, expira e callback inválido é bloqueado` | novo | ✅ |
| 3 | Callback inválido é bloqueado | `mos/test/live.test.js` | idem #2 (asserções `state-inexistente`, `já utilizado`, `expirado`) | novo | ✅ |
| 4 | Token não aparece em logs/frontend/HTML/fixture/Git | `mos/test/live.test.js` | `nenhum fragmento de token em logs, board, HTML v5 ou fixtures` | novo | ✅ |
| 4b | (reforço) | `mos/test/central.test.js` | `token em claro não aparece em nenhum log` | reaproveitado (S09) | ✅ |
| 5 | Refresh concorrente usa lock | `mos/test/live.test.js` | `refresh concorrente compartilha a renovação` | novo | ✅ |
| 5b | (reforço) | `mos/test/central.test.js` | `refresh concorrente compartilha a mesma renovação (lock single-flight)` | reaproveitado (S09) | ✅ |
| 6 | Conexões isoladas por empresa | `mos/test/live.test.js` | `empresa B não vê conexão nem conta da empresa A` | novo | ✅ |
| 6b | (reforço) | `mos/test/central.test.js` | `isolamento por empresa: dados e sinais não vazam entre empresas` | reaproveitado (S09) | ✅ |
| 7 | Dados reais e demo diferenciados | `mos/test/live.test.js` | `fonte demo e fonte real são rotuladas de forma distinta` | novo | ✅ |
| 7b | (reforço) | `mos/test/head-chat.test.js` | `mesmo contrato: DEMO_FIXTURE e NORMALIZED_INTERNAL_DATA` | reaproveitado (09.A) | ✅ |
| 8 | Webhook WhatsApp validado e deduplicado | `mos/test/live.test.js` | `webhook: verify token, assinatura HMAC e deduplicação` | novo | ✅ |
| 9 | WhatsApp não responde por padrão | `mos/test/live.test.js` | `WhatsApp não responde por padrão e respeita allowlist` (asserção `flag desligada → sem resposta`) | novo | ✅ |
| 10 | Resposta piloto só para allowlist | `mos/test/live.test.js` | idem #9 (asserção `fora da allowlist → sem resposta`) | novo | ✅ |
| 11 | READ_ONLY bloqueia escrita geral | `mos/test/live.test.js` | `escrita geral segue bloqueada em TODAS as praças` | novo | ✅ |
| 11b | (reforço) | `mos/test/central.test.js` | `READ_ONLY: toda operação de escrita falha em todos os conectores` | reaproveitado (S09) | ✅ |
| 12 | Piloto exige feature flag | `mos/test/live.test.js` | `piloto: cada gate bloqueia individualmente` (gate `FLAG/ENABLED`) | novo | ✅ |
| 13 | Piloto exige administrador | `mos/test/live.test.js` | idem #12 (gate `apenas administrador`) | novo | ✅ |
| 14 | Piloto exige OAuth real | `mos/test/live.test.js` | idem #12 (conexão revogada → gate `OAuth real`) | novo | ✅ |
| 15 | Piloto exige categoria oficial confirmada | `mos/test/live.test.js` | `piloto sem snapshot oficial de categoria fica em DRY_RUN com issue` | novo | ✅ |
| 16 | Piloto exige draft validado | `mos/test/live.test.js` | `draft com UNKNOWN/BLOCKER não passa do Dry Run` (asserção `READY_FOR_REVIEW`) | novo | ✅ |
| 17 | Piloto exige imagem aprovada por humano | `mos/test/live.test.js` | `piloto exige criativo com revisão humana aprovada` | novo | ✅ |
| 18 | Piloto exige Dry Run | `mos/test/live.test.js` | idem #12 (gate `estágio atual é … — exige READY_FOR_PILOT`) | novo | ✅ |
| 19 | Piloto exige frase explícita | `mos/test/live.test.js` | idem #12 (gate `confirmação textual incorreta`) | novo | ✅ |
| 20 | Piloto não dispara via Chat/WhatsApp | `mos/test/live.test.js` | idem #12 (gates `source: chat`/`whatsapp`) + `resposta do WhatsApp…` (comando → redireciona) | novo | ✅ |
| 21 | Idempotência impede anúncio duplicado | `mos/test/live.test.js` | `idempotência: um anúncio só; falha nunca gera retry automático` (writer chamado 1×) | novo | ✅ |
| 22 | Falha não gera retry automático | `mos/test/live.test.js` | idem #21 (asserções `failed`, `retry: manual apenas`, `calls === 0` após falha) | novo | ✅ |
| 23 | Shopee/TikTok/Magalu seguem sem escrita | `mos/test/live.test.js` | idem #11 (loop nas 4 praças) | novo | ✅ |
| 23b | (reforço) | `mos/test/compliance.test.js` | `READ_ONLY: supportsExternalPublish=false e escrita bloqueada em todos` | reaproveitado (S10) | ✅ |
| 24 | Criativo não gera sem Truth Pack suficiente | `mos/test/live.test.js` | `criativo: sem Truth Pack suficiente não gera; com, registra tudo` (INSUFFICIENT_PRODUCT_TRUTH) | novo | ✅ |
| 25 | Criativo registra assets e Truth Pack | `mos/test/live.test.js` | idem #24 (asserções `truth_pack_id`, `mustPreserve`, hashes) | novo | ✅ |
| 26 | Divergência (cor/kit/medida/moldura) bloqueia aprovação | `mos/test/live.test.js` | `divergência (cor/kit/moldura) bloqueia aprovação humana` | novo | ✅ |
| 27 | Regra UNKNOWN impede aprovação automática | `mos/test/live.test.js` | `draft com UNKNOWN/BLOCKER não passa do Dry Run` (issue `UNKNOWN`) | novo | ✅ |
| 27b | (reforço) | `mos/test/compliance.test.js` | `regra UNKNOWN não satisfeita → REVIEW_REQUIRED, nunca READY` | reaproveitado (S10) | ✅ |
| 28 | Imagem demo não é apresentada como real | `mos/test/live.test.js` | `sem flag/provider: briefing pronto, fila pendente, NENHUMA imagem` | novo | ✅ |
| 29 | Chat no WhatsApp usa o mesmo Query Layer | `mos/test/live.test.js` | `resposta do WhatsApp vem da Operational Query Layer (fonte + hora)` | novo | ✅ |
| 30 | Suíte completa existente permanece verde | todas as suítes | `node --test mie/test/*.test.js mos/test/*.test.js` → **230/230** | execução | ✅ |

**Resumo:** 30/30 garantias comprovadas — 29 em asserções de `mos/test/live.test.js`
(18 blocos novos, vários cobrindo mais de um requisito) + 6 reforços em testes
reaproveitados dos Sprints 09/10/09.A + a rodada completa da suíte (#30).
Nenhuma garantia depende de "está coberto" sem endereço.
