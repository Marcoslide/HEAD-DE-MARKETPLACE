/* Kernel · Erros tipados — tratamento global (Bloco 04).
   Todo erro da plataforma carrega um código estável e um status HTTP
   sugerido; a camada REST traduz sem if/else espalhado. */
'use strict';

class AppError extends Error {
  constructor(code, message, { status = 500, details = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
  toJSON() { return { error: this.code, message: this.message, details: this.details }; }
}

class ValidationError extends AppError {
  constructor(message, details) { super('validation_error', message, { status: 400, details }); }
}
class NotFoundError extends AppError {
  constructor(entity, id) { super('not_found', `${entity} não encontrado: ${id}`, { status: 404 }); }
}
class ConflictError extends AppError {
  constructor(message, details) { super('conflict', message, { status: 409, details }); }
}
class ForbiddenError extends AppError {
  constructor(message) { super('forbidden', message, { status: 403 }); }
}

module.exports = { AppError, ValidationError, NotFoundError, ConflictError, ForbiddenError };
