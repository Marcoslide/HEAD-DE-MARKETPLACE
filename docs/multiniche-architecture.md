# Arquitetura Multinicho e Multiempresa (Sprint 10.K.1)

> O Head Marketplace NÃO é um sistema de quadros/molduras/espelhos.
> Todos os exemplos são fixtures/demos — nunca regra universal (testado:
> nenhuma coluna de nicho existe nas entidades; perfis de eletrônico,
> moda e decoração convivem no mesmo motor).

PRODUCT_AGNOSTIC · CATEGORY_AWARE · MARKETPLACE_AWARE · COMPANY_AWARE ·
ACCOUNT_AWARE · OPERATION_AWARE · CUSTOMER_OUTCOME_AWARE. Tudo varia por
empresa, conta, praça, categoria raiz/folha, tipo de produto, perfil
logístico/fiscal, faixa de preço, margem, estágio e objetivo. Isolamento
por empresa testado em outcome profiles e playbooks privados.

Implementação: `mos/src/knowledge/strategy.js` · testes:
`mos/test/strategy-knowledge.test.js` (22 garantias).
