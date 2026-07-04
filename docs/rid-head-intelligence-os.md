# RID → Head Intelligence OS (Sprint 10.C)

> O RID (Intent Router → Context Resolver → Query Layer → Composer) é o
> núcleo ÚNICO. O 10.C não criou outro chat, cérebro, memória ou fluxo:
> `createRID({ mos, clock, growth })` liga radar → diagnóstico → diálogo
> → plano → intervenção → aprendizado → relatórios SOBRE o 10.B.

## Como rodar
```bash
node --test mos/test/rid.test.js    # 16 testes (35 garantias)
design/prototipo-v7/index.html      # experiência principal (demo declarada)
```

## Mapa de reaproveitamento
- **Chat**: intents novos (INTERVENTION_REPORT, REPORT_REQUEST) na MESMA
  cadeia; adapter `rid` igual a compliance/growth.
- **WhatsApp**: `gateway.ridHook` — diálogo, intervenção e relatório no
  gateway do 10.B; escrita externa continua recusada.
- **Memória**: tabela `memory` (S02) com campos aditivos de política —
  categorias, fonte, confiança, validade, escopo, status.
- **Missões**: plano aprovado vira `mission` (repo S02).
- **Radar**: consome Growth (promoções/leads/pendências) + observações;
  sinais relevantes alimentam o EPE (executionScope INTERNAL_ONLY).
- **Auditoria/permissões/isolamento**: os mesmos do 10.B, em tudo.

## Fluxo oficial
Radar identifica → diagnóstico cruza dados (FATO ≠ HIPÓTESE, causalidade
só com evidência) → memória e decisões anteriores consultadas → conflito
com direção do dono abre StrategicDialogue → IntelligenceActionPlan →
missão + microtarefas → intervenção registrada e monitorada (linha de
base, período, honestidade sem volume) → aprendizado reutilizável →
relatórios diário/semanal (dedup anti-spam, fontes declaradas).

## Autonomia com limites
O Head lidera o diagnóstico/estratégia/planos; o dono decide objetivos,
limites, risco e ações irreversíveis. Conflito nunca é engolido nem
atropelado: diálogo com decisão anterior + evidência nova + alternativas
+ recomendação técnica + pergunta clara. Executa SÓ o aprovado.
