/**
 * @file whatsapp.test.js
 * @description Unitários do gerador de link Click-to-Chat (UC4/RF07).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { generateWhatsAppLink } = require('../../src/utils/whatsapp');

describe('generateWhatsAppLink', () => {
  it('retorna null sem telefone', () => {
    assert.equal(generateWhatsAppLink(''), null);
    assert.equal(generateWhatsAppLink(null), null);
  });

  it('normaliza fixo/celular BR com DDI 55', () => {
    assert.equal(generateWhatsAppLink('(11) 99999-8888'), 'https://wa.me/5511999998888');
    assert.equal(generateWhatsAppLink('1133334444'), 'https://wa.me/551133334444');
  });

  it('não duplica DDI já informado e codifica a mensagem', () => {
    const link = generateWhatsAppLink('5511999998888', 'Olá, tenho interesse!');
    assert.equal(link, 'https://wa.me/5511999998888?text=Ol%C3%A1%2C%20tenho%20interesse!');
  });
});
