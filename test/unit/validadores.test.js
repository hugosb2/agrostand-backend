/**
 * @file validadores.test.js
 * @description Unitários das regras de formato de entrada (RS07 e afins).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { validatePassword, validateEmail, validatePhone } = require('../../src/utils/validadores');

describe('validatePassword (RS07)', () => {
  it('aceita senha forte', () => {
    assert.equal(validatePassword('Forte@123'), true);
  });

  it('rejeita senhas fracas', () => {
    assert.equal(validatePassword('curta@1'), false); // < 8 chars
    assert.equal(validatePassword('semmaiuscula@123'), false);
    assert.equal(validatePassword('SEMMINUSCULA@123'), false);
    assert.equal(validatePassword('SemDigito@abc'), false);
    assert.equal(validatePassword('SemEspecial123'), false);
    assert.equal(validatePassword(''), false);
    assert.equal(validatePassword(null), false);
  });
});

describe('validateEmail', () => {
  it('aceita e-mails válidos e rejeita inválidos', () => {
    assert.equal(validateEmail('produtor@agro.com.br'), true);
    assert.equal(validateEmail('sem-arroba.com'), false);
    assert.equal(validateEmail('sem@dominio'), false);
    assert.equal(validateEmail(''), false);
  });
});

describe('validatePhone', () => {
  it('aceita DDD + número (10 a 15 dígitos) e rejeita o resto', () => {
    assert.equal(validatePhone('(11) 99999-8888'), true);
    assert.equal(validatePhone('1133334444'), true);
    assert.equal(validatePhone('123'), false);
    assert.equal(validatePhone(''), false);
  });
});
