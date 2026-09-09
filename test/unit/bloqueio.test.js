/**
 * @file bloqueio.test.js
 * @description Unitários da entidade BloqueioLogin (RN19). Tempos injetados,
 * sem espera real.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { BloqueioLogin } = require('../../src/domain/factories');

const AGORA = new Date('2026-01-01T12:00:00.000Z');

describe('BloqueioLogin (RN19)', () => {
  it('conta falhas e bloqueia ao atingir o limite', () => {
    const b = new BloqueioLogin({ email: 'a@b.com' });
    assert.equal(b.bloqueado(AGORA), false);
    assert.equal(b.registrarFalha({ agora: AGORA }), false);
    assert.equal(b.registrarFalha({ agora: AGORA }), false);
    assert.equal(b.registrarFalha({ agora: AGORA }), true);
    assert.equal(b.tentativas, 3);
    assert.ok(b.bloqueado(AGORA));
  });

  it('desbloqueia após a janela e resetar() zera tudo', () => {
    const b = new BloqueioLogin({ email: 'a@b.com' });
    b.registrarFalha({ agora: AGORA });
    b.registrarFalha({ agora: AGORA });
    b.registrarFalha({ agora: AGORA });
    const depois = new Date(AGORA.getTime() + 16 * 60000);
    assert.equal(b.bloqueado(depois), false);
    b.resetar();
    assert.equal(b.tentativas, 0);
    assert.equal(b.bloqueadoAte, null);
  });

  it('respeita limite/janela customizados', () => {
    const b = new BloqueioLogin({ email: 'a@b.com' });
    assert.equal(b.registrarFalha({ limite: 2, minutos: 5, agora: AGORA }), false);
    assert.equal(b.registrarFalha({ limite: 2, minutos: 5, agora: AGORA }), true);
    assert.equal(b.bloqueadoAte, new Date(AGORA.getTime() + 5 * 60000).toISOString());
  });
});
