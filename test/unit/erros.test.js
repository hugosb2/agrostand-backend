/**
 * @file erros.test.js
 * @description Unitários do @ControllerAdvice: AppError vira envelope legado
 * `{status:'error', message}`; erro inesperado vira 500 detalhado.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { AppError, BadRequestError, NotFoundError } = require('../../src/errors/AppError');
const errorMiddleware = require('../../src/middlewares/errorMiddleware');

function mockReq() {
  return { method: 'GET', originalUrl: '/x', ip: '127.0.0.1', user: null };
}

function mockRes() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

describe('errorMiddleware (@ControllerAdvice)', () => {
  it('mapeia AppError para o envelope legado sem statusCode', () => {
    const res = mockRes();
    errorMiddleware(new BadRequestError('Campo obrigatório.'), mockReq(), res, () => {});
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { status: 'error', message: 'Campo obrigatório.' });
  });

  it('preserva o HTTP code de cada subclasse', () => {
    const res = mockRes();
    errorMiddleware(new NotFoundError('Não achei.'), mockReq(), res, () => {});
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { status: 'error', message: 'Não achei.' });
  });

  it('erro inesperado vira 500 com statusCode', () => {
    const res = mockRes();
    errorMiddleware(new Error('boom'), mockReq(), res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.status, 'error');
    assert.equal(res.body.statusCode, 500);
    assert.equal(res.body.message, 'boom');
  });

  it('AppError carrega status e expose', () => {
    const err = new AppError(422, 'x');
    assert.equal(err.status, 422);
    assert.equal(err.expose, true);
    assert.ok(err instanceof Error);
  });
});
