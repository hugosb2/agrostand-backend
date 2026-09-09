/**
 * @file excluir-conta.test.js
 * @description UC14 — Excluir Conta (RS03 LGPD): a conta some e os dados
 * agregados caem em cascata (endereços, anúncios e imagens); dados de
 * terceiros ficam intactos. (Sem confirmação por senha nem favoritos nesta
 * implementação; anúncios são excluídos em cascata, não vão p/ lixeira.)
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, pngFile, snapshotUploads, cleanUploads } = require('../helpers');

describe('UC14 — Excluir Conta', async () => {
  let base;
  let close;
  let tokenFora;
  let uploadsAntes;
  const vitima = { email: 'sair@test.com', anuncioId: null, imagemId: null, enderecoId: null };

  before(async () => {
    ({ base, close } = await startServer('excluir'));
    uploadsAntes = snapshotUploads();

    const reg = await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Saindo', sobrenome: 'Fora', email: vitima.email, telefone: '11999998888', senha: 'Forte@123',
        rua: 'R', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    });
    vitima.token = reg.body.data.token;
    vitima.userId = reg.body.data.usuario.id;
    vitima.enderecoId = (await api(base, 'GET', '/api/addresses', { token: vitima.token })).body.data.enderecos[0].id;

    const categoriaId = (await api(base, 'GET', '/api/categories')).body.data.categorias[0].id;
    const fd = new FormData();
    fd.append('nome', 'Última Colheita');
    fd.append('descricao', 'x');
    fd.append('preco', '10');
    fd.append('categoriaId', String(categoriaId));
    fd.append('enderecoId', String(vitima.enderecoId));
    fd.append('imagemPrincipal', pngFile(), 'p.png');
    const res = await fetch(base + '/api/ads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vitima.token}` },
      body: fd,
    });
    const ad = (await res.json()).data.anuncio;
    vitima.anuncioId = ad.id;
    vitima.imagemId = ad.imagens[0].id;

    // RN20: favorito da vítima (removido junto na exclusão)
    await api(base, 'POST', '/api/favorites/toggle', { token: vitima.token, body: { anuncioId: ad.id } });

    // terceiro alheio à exclusão
    const outro = await api(base, 'POST', '/api/auth/register', {
      body: {
        nome: 'Fica', sobrenome: 'Aqui', email: 'fica@test.com', telefone: '11777776666', senha: 'Forte@123',
        rua: 'R', numero: '2', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA',
      },
    });
    tokenFora = outro.body.data.token;
  });

  after(async () => {
    cleanUploads(uploadsAntes);
    await close();
  });

  it('exclui a conta com mensagem LGPD (200)', async () => {
    const { status, body } = await api(base, 'DELETE', '/api/users/account', { token: vitima.token });
    assert.equal(status, 200);
    assert.match(body.message, /LGPD/);
  });

  it('conta some: perfil e login passam a negar acesso', async () => {
    assert.equal((await api(base, 'GET', '/api/users/profile', { token: vitima.token })).status, 401);
    const login = await api(base, 'POST', '/api/auth/login', {
      body: { email: vitima.email, senha: 'Forte@123' },
    });
    assert.equal(login.status, 401);
  });

  it('cascata LGPD: usuário, endereços, anúncios, imagens e favoritos somem', async () => {
    const UsuarioDAO = require('../../src/dao/UsuarioDAO');
    const EnderecoDAO = require('../../src/dao/EnderecoDAO');
    const AnuncioDAO = require('../../src/dao/AnuncioDAO');
    const ImagemDAO = require('../../src/dao/ImagemDAO');
    const FavoritoDAO = require('../../src/dao/FavoritoDAO');

    assert.equal(await UsuarioDAO.findByEmail(vitima.email), undefined);
    assert.deepEqual(await EnderecoDAO.findByClienteId(vitima.userId), []);
    assert.equal(await AnuncioDAO.findById(vitima.anuncioId, true), null);
    assert.equal(await ImagemDAO.findById(vitima.imagemId), undefined);
    assert.deepEqual(await FavoritoDAO.listByCliente(vitima.userId), []); // RN20
  });

  it('terceiros intactos', async () => {
    const perfil = await api(base, 'GET', '/api/users/profile', { token: tokenFora });
    assert.equal(perfil.status, 200);
    assert.equal(perfil.body.data.usuario.email, 'fica@test.com');
  });
});
