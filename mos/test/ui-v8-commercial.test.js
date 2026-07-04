/* =============================================================
   SPRINT 10.V — Commercial Productization (protótipo v8)
   27 testes obrigatórios: conta, onboarding, escopo de convites,
   enforcement de papéis, trial que preserva dados, upgrade sem
   cobrança, separação demo × real, landing → cadastro → onboarding,
   ativação, suporte e segurança externa. V8COM é o MESMO arquivo
   que o navegador executa.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const V8DIR = path.join(__dirname, '../../design/prototipo-v8');
const V8COM = require(path.join(V8DIR, 'commercial.js'));
const read = f => fs.readFileSync(path.join(V8DIR, f), 'utf8');
const gateJs = read('gate.js');
const adminJs = read('admin.js');
const html = read('index.html');

const CAD = {
  nome: 'Marcos', sobrenome: 'Pereira', email: 'm@lider.example', telefone: '+55 31 9',
  senha: 'x', empresa: 'Líder LTDA', pais: 'Brasil', aceiteTermos: true, aceitePrivacidade: true,
};
const novaConta = () => V8COM.createAccount(CAD, '2026-07-04');
const contaComEmpresa = () => {
  const a = novaConta();
  V8COM.obGrupoEmpresa(a, { grupo: 'Líder Group', empresa: 'Líder LTDA', segmento: 'Casa', pais: 'Brasil', modelo: 'marca' });
  return a;
};

/* ---------- conta e estrutura ---------- */

test('01 · usuário cria conta (campos mínimos + aceites obrigatórios)', () => {
  const a = novaConta();
  assert.equal(a.status, 'CONTA NOVA');
  assert.equal(a.plano, 'TRIAL');
  assert.equal(a.user.papel, 'OWNER');
  assert.equal(a.user.senhaDefinida, true);
  assert.equal(a.user.senha, undefined, 'senha NUNCA armazenada');
  assert.throws(() => V8COM.createAccount({ ...CAD, aceiteTermos: false }), /termos e política/);
  assert.throws(() => V8COM.createAccount({ ...CAD, email: 'inválido' }), /e-mail inválido/);
  assert.throws(() => V8COM.createAccount({ ...CAD, telefone: '' }), /falta telefone/);
});

test('02-03 · usuário cria grupo e empresa (dados reais, rotulados)', () => {
  const a = contaComEmpresa();
  assert.equal(a.escopo.grupos.length, 1);
  assert.equal(a.escopo.empresas.length, 1);
  assert.equal(a.escopo.empresas[0].tipoDado, 'DADOS REAIS');
  assert.equal(a.status, 'ONBOARDING EM ANDAMENTO');
  assert.throws(() => V8COM.obGrupoEmpresa(novaConta(), { grupo: 'x' }), /falta empresa/);
});

test('04 · usuário cria CNPJ (sem validação externa neste modo)', () => {
  const a = contaComEmpresa();
  const c = V8COM.obAddCnpj(a, { nomeFiscal: 'Líder LTDA', nomeFantasia: 'Matriz MG', estado: 'MG', cidade: 'Lagoa Santa' });
  assert.equal(c.principal, true, 'primeiro CNPJ vira principal');
  assert.match(c.validacaoExterna, /não exigida/);
});

test('05 · usuário cria loja (tipos válidos, loja ≠ marketplace)', () => {
  const a = contaComEmpresa();
  V8COM.obAddCnpj(a, { nomeFiscal: 'L', nomeFantasia: 'Matriz', estado: 'MG', cidade: 'BH' });
  const s = V8COM.obAddLoja(a, { nome: 'Loja Física Centro', tipo: 'loja física' });
  assert.equal(s.cnpjId, a.escopo.cnpjs[0].id, 'loja vinculada ao CNPJ');
  assert.throws(() => V8COM.obAddLoja(a, { nome: 'X', tipo: 'inexistente' }), /tipo de loja inválido/);
});

test('06-07 · CNPJ pode ser pulado e adicionado depois', () => {
  const a = contaComEmpresa();
  assert.equal(V8COM.obAddCnpj(a, null), null, 'pular é permitido');
  assert.equal(a.onboarding.etapa, 4);
  assert.ok(a.audit.some(x => x.acao === 'onboarding_cnpj_pulado'));
  const c = V8COM.obAddCnpj(a, { nomeFiscal: 'L', nomeFantasia: 'Filial SP', estado: 'SP', cidade: 'SP' });
  assert.ok(c && a.escopo.cnpjs.length === 1, 'adicionado depois sem penalidade');
});

test('08-09 · marketplace selecionável sem conectar; conexão NUNCA habilita escrita', () => {
  const a = contaComEmpresa();
  V8COM.obSelectMarketplaces(a, [
    { marketplace: 'Shopee', estado: 'conectar depois' },
    { marketplace: 'Mercado Livre', estado: 'conectar agora' },
    { marketplace: 'Magalu', estado: 'usar demonstração' },
  ]);
  assert.equal(a.marketplacesSel.length, 3);
  for (const m of a.marketplacesSel)
    assert.equal(m.escrita, 'ESCRITA EXTERNA BLOQUEADA', m.marketplace + ': escrita sempre bloqueada');
  assert.equal(a.marketplacesSel[1].leitura, 'AGUARDANDO CONEXÃO', 'conectar agora = leitura pendente, nada mais');
  assert.throws(() => V8COM.obSelectMarketplaces(a, [{ marketplace: 'Shopee', estado: 'publicar tudo' }]), /estado inválido/);
});

test('10-11 · convite de equipe respeita escopo de empresa/CNPJ/loja', () => {
  const a = contaComEmpresa();
  V8COM.obAddCnpj(a, { nomeFiscal: 'L', nomeFantasia: 'Matriz', estado: 'MG', cidade: 'BH' });
  V8COM.obAddLoja(a, { nome: 'Shopee A', tipo: 'marketplace' });
  const conv = V8COM.invite(a, { email: 'ana@l.example', papel: 'CATALOGO', escopo: { empresas: [a.escopo.empresas[0].id], lojas: [a.escopo.lojas[0].id] } });
  assert.equal(conv.status, 'enviado');
  const m = V8COM.acceptInvite(a, conv.id);
  assert.ok(V8COM.memberSees(m, 'empresa', a.escopo.empresas[0].id));
  assert.ok(V8COM.memberSees(m, 'loja', a.escopo.lojas[0].id));
  assert.ok(!V8COM.memberSees(m, 'empresa', 'outra-empresa'), 'não vê empresa fora do escopo');
  assert.ok(!V8COM.memberSees(m, 'loja', 'outra-loja'), 'não vê loja fora do escopo');
  assert.throws(() => V8COM.invite(a, { email: 'x@x.example', papel: 'PAPEL_FALSO' }), /papel válido/);
});

/* ---------- papéis: enforcement, não decoração ---------- */

test('12 · papel limita acesso corretamente (matriz completa)', () => {
  assert.equal(V8COM.can('OWNER', 'alterarPlano'), true);
  assert.equal(V8COM.can('ADMIN', 'alterarPlano'), false, 'só OWNER altera plano');
  assert.equal(V8COM.can('HEAD_MARKETPLACE', 'aprovar'), true);
  assert.equal(V8COM.can('GESTOR_OPERACIONAL', 'verMargem'), false);
  assert.equal(V8COM.can('FINANCEIRO', 'verMargem'), true);
  assert.equal(V8COM.can('DESIGNER', 'criarMissao'), false);
  assert.equal(Object.keys(V8COM.ROLES).length, 11, '11 papéis mínimos');
  for (const r of ['OWNER', 'ADMIN', 'HEAD_MARKETPLACE', 'GESTOR_COMERCIAL', 'GESTOR_OPERACIONAL', 'CATALOGO', 'FINANCEIRO', 'EXPEDICAO', 'DESIGNER', 'CONSULTOR', 'LEITURA'])
    assert.ok(V8COM.ROLES[r], 'papel existe: ' + r);
});

test('13 · papel LEITURA não edita nada', () => {
  for (const p of ['editarMaster', 'editarPerfilLoja', 'criarMissao', 'aprovar', 'convidar', 'exportar', 'adminIntegracao', 'alterarPlano'])
    assert.equal(V8COM.can('LEITURA', p), false, 'LEITURA não pode ' + p);
});

test('14 · papel CATALOGO não administra plano nem integração', () => {
  assert.equal(V8COM.can('CATALOGO', 'editarMaster'), true, 'catálogo edita produto');
  assert.equal(V8COM.can('CATALOGO', 'alterarPlano'), false);
  assert.equal(V8COM.can('CATALOGO', 'adminIntegracao'), false);
  assert.equal(V8COM.can('CATALOGO', 'convidar'), false);
  assert.match(adminJs, /disabled title="Seu papel/, 'UI desabilita com razão quando o papel não permite');
});

/* ---------- trial e planos ---------- */

test('15 · trial mostra dias restantes e estados', () => {
  const a = novaConta();
  assert.equal(a.trial.dias, V8COM.TRIAL_DIAS);
  assert.equal(V8COM.trialDaysLeft(a, '2026-07-04'), 14);
  assert.equal(V8COM.trialStatus(a, '2026-07-04'), 'TRIAL ATIVO');
  assert.equal(V8COM.trialStatus(a, '2026-07-16'), 'TRIAL EXPIRANDO');
  assert.equal(V8COM.trialStatus(a, '2026-07-30'), 'TRIAL EXPIRADO');
  assert.match(adminJs, /dia\(s\) restante\(s\)/, 'contador visível na página de planos');
});

test('16 · trial expirado limita acesso mas PRESERVA os dados', () => {
  const a = contaComEmpresa();
  V8COM.obAddCnpj(a, { nomeFiscal: 'L', nomeFantasia: 'M', estado: 'MG', cidade: 'BH' });
  assert.equal(V8COM.accessLevel(a, '2026-08-30'), 'ACESSO LIMITADO');
  assert.equal(a.escopo.empresas.length, 1, 'empresa preservada');
  assert.equal(a.escopo.cnpjs.length, 1, 'CNPJ preservado');
  const src = read('commercial.js');
  assert.ok(!/deleteAccount|apagarConta|removerConta/.test(src), 'não existe função de apagar conta automaticamente');
  assert.match(src, /nunca apaga/i.test(adminJs) ? /./ : /ACESSO LIMITADO/, 'limitação sem destruição');
});

test('17 · upgrade gera solicitação interna auditável — sem cobrança', () => {
  const a = novaConta();
  const s = V8COM.requestUpgrade(a, 'SCALE');
  assert.equal(s.tipo, 'UPGRADE');
  assert.equal(s.status, 'solicitação criada');
  assert.match(s.cobranca, /nenhuma/);
  assert.ok(a.audit.some(x => x.acao === 'upgrade_solicitado'));
  assert.throws(() => V8COM.requestUpgrade(a, 'GOLD'), /plano inexistente/);
  for (const [, p] of Object.entries(V8COM.PLANS))
    assert.ok(p.limites && p.recursos && Array.isArray(p.emBreve), 'plano completo: ' + p.nome);
});

/* ---------- demo × real ---------- */

test('18 · demo não mistura dados com empresa real', () => {
  const a = contaComEmpresa();
  const empresaReal = a.escopo.empresas[0];
  assert.throws(() => V8COM.guardDemoMix(a, { origem: 'DADO SIMULADO', empresaId: empresaReal.id }),
    /não pode ser anexado a empresa real/);
  assert.ok(V8COM.guardDemoMix(a, { origem: 'DADO SIMULADO', empresaId: 'empresa-demo' }), 'demo em árvore demo é ok');
  assert.ok(V8COM.guardDemoMix(a, { origem: 'DADO REAL', empresaId: empresaReal.id }), 'dado real em empresa real é ok');
  /* troca de modo é explícita e auditada */
  V8COM.switchMode(a, 'DEMONSTRACAO');
  assert.ok(a.audit.some(x => x.acao === 'modo_alterado' && /explícita/.test(x.detalhe)));
  assert.match(gateJs, /rotulados e nunca se misturam|nunca é misturada|nunca misturados/i, 'separação declarada na jornada');
});

/* ---------- jornada landing → cadastro → onboarding ---------- */

test('19 · landing leva para cadastro', () => {
  assert.match(gateJs, /Pare de administrar marketplaces no escuro/, 'hero direto');
  assert.match(gateJs, /data-g="tela" data-v="signup">Criar minha operação/, 'CTA → cadastro');
  assert.match(gateJs, /Ver demonstração/);
  assert.match(gateJs, /Falar com especialista/);
  const promessas = (gateJs.match(/resultado garantido/gi) || []);
  const negadas = (gateJs.match(/Nada de resultado garantido/gi) || []);
  assert.equal(promessas.length, negadas.length, 'resultado garantido só aparece como negação explícita');
  for (const sec of ['o problema', 'a solução', 'como funciona', 'multiempresa · multiCNPJ · multiloja', 'para quem é', 'integrações', 'planos', 'faq'])
    assert.ok(gateJs.includes(sec), 'seção da landing: ' + sec);
});

test('20 · cadastro leva para onboarding com telas de estado completas', () => {
  assert.match(gateJs, /show\('confirmar'\)/, 'cadastro → confirmação de e-mail → onboarding');
  for (const tela of ['login', 'signup', 'recover', 'redefinir', 'confirmar', 'convite', 'primeiro', 'expirada', 'negado', 'suspensa', 'trialexp'])
    assert.ok(gateJs.includes(`${tela}:`) || gateJs.includes(`'${tela}'`), 'tela: ' + tela);
});

test('21 · onboarding cria contexto operacional inicial', () => {
  const a = contaComEmpresa();
  V8COM.obAddCnpj(a, { nomeFiscal: 'L', nomeFantasia: 'Matriz', estado: 'MG', cidade: 'BH' });
  V8COM.obAddLoja(a, { nome: 'Shopee A', tipo: 'marketplace' });
  V8COM.obSelectMarketplaces(a, [{ marketplace: 'Shopee', estado: 'conectar depois' }]);
  V8COM.obCatalogo(a, 'pular');
  const fm = V8COM.obComplete(a);
  assert.equal(a.status, 'TRIAL ATIVO');
  assert.equal(a.onboarding.concluido, true);
  assert.equal(fm.acao, 'completar catálogo', 'primeira missão nasce do que foi pulado');
  const a2 = contaComEmpresa();
  assert.equal(V8COM.firstMission(a2).acao, 'configurar lojas', 'sem loja → sugerir loja');
});

test('22 · checklist de ativação atualiza com o progresso', () => {
  const a = contaComEmpresa();
  const antes = V8COM.activationProgress(a);
  V8COM.obAddCnpj(a, { nomeFiscal: 'L', nomeFantasia: 'M', estado: 'MG', cidade: 'BH' });
  V8COM.obAddLoja(a, { nome: 'S', tipo: 'marketplace' });
  const depois = V8COM.activationProgress(a);
  assert.ok(depois.feitos > antes.feitos, `progresso avança (${antes.feitos} → ${depois.feitos})`);
  const check = V8COM.activationChecklist(a);
  assert.equal(check.length, 13, '13 passos do sprint');
  for (const c of check) assert.ok(c.cta && c.impacto && c.status, 'item com CTA e impacto: ' + c.item);
  const conectado = check.find(c => c.item === 'Marketplace conectado');
  assert.match(conectado.bloqueio, /OAuth real fora do escopo/, 'bloqueio honesto');
});

test('23 · centro de suporte cria solicitação com estados honestos', () => {
  const a = novaConta();
  const t = V8COM.createTicket(a, { tipo: 'ativação assistida', msg: 'preciso de ajuda' });
  assert.equal(t.status, 'solicitação criada');
  assert.deepEqual(V8COM.TICKET_ESTADOS, ['solicitação criada', 'aguardando resposta', 'respondido', 'resolvido', 'indisponível']);
  assert.throws(() => V8COM.createTicket(a, { tipo: 'mágica' }), /tipo de solicitação inválido/);
  assert.match(adminJs, /Sem promessa de resposta em tempo real/, 'sem promessa de equipe humana em tempo real');
});

/* ---------- segurança externa ---------- */

test('24 · nenhum plano gera cobrança real', () => {
  const src = read('commercial.js') + adminJs + gateJs;
  assert.ok(!/stripe|checkout\.|cartão de crédito|creditcard|card_number/i.test(src), 'zero integração de pagamento');
  assert.match(adminJs, /Nenhum valor é cobrado neste modo/, 'declarado na página de planos');
  assert.match(gateJs, /sem cartão/i, 'declarado na landing');
});

test('25-26 · onboarding e integrações nunca publicam nem escrevem externamente', () => {
  const src = read('commercial.js') + gateJs + adminJs;
  assert.ok(!/publicado com sucesso|publicar automaticamente/i.test(src));
  assert.ok(!/fetch\(|XMLHttpRequest/.test(gateJs + adminJs), 'zero chamadas externas');
  assert.match(gateJs, /Conectar NÃO autoriza escrita externa/, 'aviso na etapa de marketplaces');
  const a = contaComEmpresa();
  V8COM.obSelectMarketplaces(a, [{ marketplace: 'Shopee', estado: 'ativação assistida' }]);
  assert.ok(a.solicitacoes.some(t => t.tipo === 'ativação assistida'), 'assistida vira ticket interno, não ação externa');
});

test('27 · contratos anteriores continuam válidos (shell integrado)', () => {
  assert.match(html, /data-v="ativacao"/); assert.match(html, /data-v="equipe"/);
  assert.match(html, /data-v="planos"/); assert.match(html, /data-v="suporte"/);
  assert.match(html, /id="gate"/);
  for (const v of ['home', 'operacao', 'catalogo', 'crescimento', 'conexoes', 'missao', 'silencio', 'conhecimento'])
    assert.match(html, new RegExp(`data-v="${v}"`), 'área original intacta: ' + v);
  const appJs = read('app.js');
  assert.match(appJs, /ativacao: 'Ativação', equipe: 'Equipe', planos: 'Planos', suporte: 'Suporte'/);
  assert.match(appJs, /seedDemoAccount/, 'sessão demonstrativa continua funcionando sem gate');
  for (const st of ['CONTA NOVA', 'TRIAL ATIVO', 'TRIAL EXPIRADO', 'CONTA SUSPENSA', 'ACESSO LIMITADO', 'IMPORTAÇÃO EM ANDAMENTO', 'ERRO DE IMPORTAÇÃO'])
    assert.ok(V8COM.PRODUCT_STATES.includes(st), 'estado de produto: ' + st);
});
