/**
 * @file contatar-vendedor.test.js
 * @description UC4 — Contatar Vendedor (RF07): o detalhe entrega o link
 * wa.me com DDI 55 + mensagem pré-preenchida com produto e preço.
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, pngFile, snapshotUploads, cleanUploads } = require('../helpers');

describe('UC4 — Contatar Vendedor', async () => {
  let base;
  let close;
  let anuncioId;
  let uploadsAntes;

  before(async () => {
    ({ base, close } = await startServer('contato'));
    uploadsAntes = snapshotUploads();

    // telefone formatado: o link deve normalizar para só dígitos com DDI
    const reg = await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Seu', sobrenome: 'Zé', email: 'ze@test.com', telefone: '(11) 99999-8888', senha: 'Forte@123',
        rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    });
    const token = reg.body.data.token;
    const categoriaId = (await api(base, 'GET', '/api/categories')).body.data.categorias[0].id;
    const enderecoId = (await api(base, 'GET', '/api/addresses', { token })).body.data.enderecos[0].id;

    const fd = new FormData();
    fd.append('nome', 'Queijo Minas');
    fd.append('descricao', 'Peça 1kg');
    fd.append('preco', '60');
    fd.append('categoriaId', String(categoriaId));
    fd.append('enderecoId', String(enderecoId));
    fd.append('imagemPrincipal', pngFile(), 'q.png');
    const res = await fetch(base + '/api/ads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    anuncioId = (await res.json()).data.anuncio.id;
  });

  after(async () => {
    cleanUploads(uploadsAntes);
    await close();
  });

  it('link wa.me com número normalizado (DDI 55, sem formatação)', async () => {
    const { body } = await api(base, 'GET', `/api/ads/${anuncioId}`);
    const url = new URL(body.data.anuncio.vendedor.link_whatsapp);
    assert.equal(url.hostname, 'wa.me');
    assert.equal(url.pathname, '/5511999998888');
  });

  it('mensagem pré-preenchida cita produto e preço', async () => {
    const { body } = await api(base, 'GET', `/api/ads/${anuncioId}`);
    const texto = new URL(body.data.anuncio.vendedor.link_whatsapp).searchParams.get('text');
    assert.ok(texto.includes('Queijo Minas'));
    assert.ok(texto.includes('60'));
  });
});
