/* =============================================================
   PRODUCTION FOUNDATION (10.D) · security
   Autenticação persistente (scrypt, sessões com expiração e refresh,
   reset/confirmação/convite com validade, bloqueio de conta, rate
   limit persistido) e ENFORCEMENT de permissão/escopo no backend —
   botão desabilitado nunca é a única barreira.
   ============================================================= */
'use strict';
const crypto = require('node:crypto');
const { uid } = require('./core.js');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 48 };
const hashPass = (senha, salt) => crypto.scryptSync(String(senha), salt, SCRYPT.keylen, SCRYPT).toString('hex');
const tokenHash = t => crypto.createHash('sha256').update(t).digest('hex');
const now = () => new Date().toISOString();
const addH = h => new Date(Date.now() + h * 3600000).toISOString();

/* papéis do 10.V com enforcement no servidor */
const ROLE_PERMS = {
  OWNER: ['*'],
  ADMIN: ['scope.write', 'import.create', 'import.review', 'import.apply', 'invite', 'export', 'margem.ver', 'mapping.manage'],
  HEAD_MARKETPLACE: ['scope.read', 'import.create', 'import.review', 'import.apply', 'export', 'margem.ver', 'aprovar'],
  GESTOR_COMERCIAL: ['scope.read', 'import.review', 'export', 'margem.ver'],
  GESTOR_OPERACIONAL: ['scope.read', 'import.create', 'import.review', 'export'],
  CATALOGO: ['scope.read', 'import.create', 'import.review', 'master.editar'],
  FINANCEIRO: ['scope.read', 'export', 'margem.ver'],
  EXPEDICAO: ['scope.read'], DESIGNER: ['scope.read'], CONSULTOR: ['scope.read', 'export', 'margem.ver'],
  LEITURA: ['scope.read'],
};
const can = (papel, perm) => {
  const p = ROLE_PERMS[papel];
  return !!p && (p.includes('*') || p.includes(perm));
};

function createSecurity(db, audit, logger) {
  /* ---------- rate limit persistido (sobrevive restart) ---------- */
  function rateLimit(chave, max, janelaMin) {
    const janela = new Date().toISOString().slice(0, 16 - (janelaMin >= 60 ? 3 : 0));
    db.prepare(`INSERT INTO rate_limits(chave, janela, n) VALUES(?,?,1)
      ON CONFLICT(chave, janela) DO UPDATE SET n = rate_limits.n + 1`).run(chave, janela);
    const n = db.prepare('SELECT n FROM rate_limits WHERE chave=? AND janela=?').get(chave, janela).n;
    if (n > max) {
      audit.record({ action: 'rate_limit_excedido', status: 'blocked', detalhe: chave });
      const e = new Error('muitas tentativas — aguarde antes de tentar de novo');
      e.code = 'RATE_LIMITED'; throw e;
    }
  }

  return {
    can, ROLE_PERMS, rateLimit,

    /* ---------- cadastro / login / sessão ---------- */
    createUser({ email, nome, sobrenome, senha }) {
      if (!email || !senha || String(senha).length < 8) throw new Error('e-mail e senha (mínimo 8) são obrigatórios');
      const salt = crypto.randomBytes(16).toString('hex');
      const u = { id: uid('usr'), email: email.toLowerCase(), nome: nome || '', sobrenome: sobrenome || '' };
      db.prepare(`INSERT INTO users(id,email,nome,sobrenome,pass_hash,pass_salt,criado_em)
        VALUES(?,?,?,?,?,?,?)`).run(u.id, u.email, u.nome, u.sobrenome, hashPass(senha, salt), salt, now());
      audit.record({ userId: u.id, action: 'usuario_criado', detalhe: u.email });
      const conf = this.issueToken(u.id, 'confirmar_email', 48);
      return { user: u, confirmToken: conf }; /* token sai por e-mail, nunca em log */
    },
    login({ email, senha, ip }) {
      rateLimit('login:' + (ip || email), 8, 15);
      const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
      const salt = u ? u.pass_salt : crypto.randomBytes(16).toString('hex');
      const ok = u && crypto.timingSafeEqual(Buffer.from(hashPass(senha, salt)), Buffer.from(u.pass_hash));
      if (!ok || u.bloqueado) {
        audit.record({ userId: u ? u.id : null, action: 'login', status: 'falha', detalhe: email });
        throw new Error(u && u.bloqueado ? 'conta bloqueada — fale com o suporte' : 'credenciais inválidas');
      }
      const token = crypto.randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO sessions(id,user_id,token_hash,expira_em,criado_em) VALUES(?,?,?,?,?)')
        .run(uid('ses'), u.id, tokenHash(token), addH(24), now());
      audit.record({ userId: u.id, action: 'login', detalhe: email });
      logger.log({ action: 'login', user_id: u.id, status: 'ok' });
      return { token, userId: u.id }; /* cookie HttpOnly+Secure+SameSite na API */
    },
    session(token) {
      if (!token) return null;
      const s = db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND revogada = 0').get(tokenHash(token));
      if (!s) return null;
      if (s.expira_em < now()) return { expired: true };
      return { userId: s.user_id, sessionId: s.id };
    },
    refresh(token) {
      const s = this.session(token);
      if (!s || s.expired) throw new Error('sessão expirada — entre novamente');
      db.prepare('UPDATE sessions SET expira_em = ? WHERE id = ?').run(addH(24), s.sessionId);
      return s;
    },
    logout(token) {
      db.prepare('UPDATE sessions SET revogada = 1 WHERE token_hash = ?').run(tokenHash(token));
    },

    /* ---------- tokens (reset, confirmação, convite) — com expiração ---------- */
    issueToken(userId, tipo, horas, payload) {
      const t = crypto.randomBytes(24).toString('base64url');
      db.prepare('INSERT INTO auth_tokens(id,user_id,tipo,token_hash,payload,expira_em) VALUES(?,?,?,?,?,?)')
        .run(uid('tok'), userId, tipo, tokenHash(t), JSON.stringify(payload || null), addH(horas));
      return t;
    },
    consumeToken(t, tipo) {
      const row = db.prepare('SELECT * FROM auth_tokens WHERE token_hash = ? AND tipo = ? AND usado = 0').get(tokenHash(t), tipo);
      if (!row) throw new Error('token inválido');
      if (row.expira_em < now()) throw new Error(tipo === 'convite' ? 'convite expirado' : 'token expirado');
      db.prepare('UPDATE auth_tokens SET usado = 1 WHERE id = ?').run(row.id);
      return { userId: row.user_id, payload: JSON.parse(row.payload) };
    },
    requestPasswordReset(email, ip) {
      rateLimit('reset:' + (ip || email), 5, 60);
      const u = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
      audit.record({ userId: u ? u.id : null, action: 'reset_solicitado', detalhe: email });
      return u ? this.issueToken(u.id, 'reset_senha', 2) : null; /* resposta idêntica p/ e-mail inexistente */
    },
    resetPassword(token, novaSenha) {
      const { userId } = this.consumeToken(token, 'reset_senha');
      if (String(novaSenha).length < 8) throw new Error('senha mínima de 8 caracteres');
      const salt = crypto.randomBytes(16).toString('hex');
      db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').run(hashPass(novaSenha, salt), salt, userId);
      db.prepare('UPDATE sessions SET revogada = 1 WHERE user_id = ?').run(userId); /* invalida sessões antigas */
      audit.record({ userId, action: 'senha_redefinida' });
    },
    confirmEmail(token) {
      const { userId } = this.consumeToken(token, 'confirmar_email');
      db.prepare('UPDATE users SET email_confirmado = 1 WHERE id = ?').run(userId);
    },
    lockAccount(userId, motivo) {
      db.prepare('UPDATE users SET bloqueado = 1 WHERE id = ?').run(userId);
      db.prepare('UPDATE sessions SET revogada = 1 WHERE user_id = ?').run(userId);
      audit.record({ userId, action: 'conta_bloqueada', detalhe: motivo });
    },

    /* ---------- escopo: membership + enforcement por tenant ---------- */
    addMembership({ userId, groupId, companyIds, storeIds, papel }) {
      if (!ROLE_PERMS[papel]) throw new Error('papel inválido: ' + papel);
      db.prepare('INSERT INTO memberships(id,user_id,group_id,company_ids,store_ids,papel,criado_em) VALUES(?,?,?,?,?,?,?)')
        .run(uid('mem'), userId, groupId, JSON.stringify(companyIds || []), JSON.stringify(storeIds || []), papel, now());
      audit.record({ userId, groupId, action: 'papel_atribuido', detalhe: papel });
    },
    membership(userId, groupId) {
      const m = db.prepare('SELECT * FROM memberships WHERE user_id = ? AND group_id = ?').get(userId, groupId);
      return m ? { papel: m.papel, companyIds: JSON.parse(m.company_ids), storeIds: JSON.parse(m.store_ids) } : null;
    },
    /* TODA API valida usuário+grupo+empresa+loja+papel+permissão+ação */
    assertScope({ userId, groupId, companyId, storeId, perm }) {
      const m = this.membership(userId, groupId);
      const deny = motivo => {
        audit.record({ userId, groupId, companyId, storeId, action: 'acesso_negado', status: 'blocked', detalhe: motivo });
        const e = new Error('acesso negado: ' + motivo); e.code = 'FORBIDDEN'; throw e;
      };
      if (!m) deny('sem vínculo com este grupo');
      if (companyId && m.companyIds.length && !m.companyIds.includes(companyId)) deny('empresa fora do escopo');
      if (storeId && m.storeIds.length && !m.storeIds.includes(storeId)) deny('loja fora do escopo');
      if (perm && !can(m.papel, perm)) deny(`papel ${m.papel} não possui ${perm}`);
      return m;
    },

    /* escrita externa: bloqueio absoluto também no servidor */
    assertNoExternalWrite(action) {
      if (/publicar_externo|alterar_preco_externo|alterar_estoque_externo|ads_ativar|oauth_escrita/.test(action)) {
        audit.record({ action, status: 'blocked', detalhe: 'ESCRITA EXTERNA BLOQUEADA — tentativa registrada' });
        const e = new Error('ESCRITA EXTERNA BLOQUEADA'); e.code = 'EXTERNAL_WRITE_BLOCKED'; throw e;
      }
    },
  };
}

module.exports = { createSecurity, ROLE_PERMS, can };
