/**
 * @file AppError.js
 * @description Hierarquia de erros de negócio (estilo exceções do Spring).
 *
 * Services lançam esses erros; o `errorMiddleware` (nosso @ControllerAdvice)
 * traduz `expose === true` para o envelope legado `{status:'error', message}`
 * com o HTTP code correspondente. Erros sem `expose` seguem como 500.
 */

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.expose = true;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message) {
    super(400, message);
  }
}

class UnauthorizedError extends AppError {
  constructor(message) {
    super(401, message);
  }
}

class ForbiddenError extends AppError {
  constructor(message) {
    super(403, message);
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(404, message);
  }
}

class TooManyRequestsError extends AppError {
  constructor(message) {
    super(429, message);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
};
