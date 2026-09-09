/**
 * @file auth.test.js
 * @description UC1 — Autenticação e conta (integração HTTP + SQLite temporário):
 * registro, login, perfil, senha e CRUD de endereços com propriedade.
 */
process.env.DATABASE_PATH = 'placeholder-substituido-no-startServer';
process.env.JWT_SECRET = 'test-secret';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, api, snapshotUploads, cleanUploads } = require('../helpers');

const CADASTRO = {
  nome: 'Produtora',
  sobrenome: 'Rural',
  email: 'produtora@test.com',
  telefone: '11999998888',
  senha: 'Forte@123',
  rua: 'Estrada do Milho',
  numero: 'km 12',
  bairro: 'Zona Rural',
  cidade: 'Ribeirão Preto',
  uf: 'SP',
  zona: 'RURAL',
};

describe('UC1 — Autenticação', async () => {
  let base;
  let close;
  let token;
  let uploadsAntes;

  before(async () => {
    ({ base, close } = await startServer('auth'));
    uploadsAntes = snapshotUploads();
  });

  after(async () => {
    cleanUploads(uploadsAntes);
    await close();
  });

  it('registra usuário + endereço e devolve token (201)', async () => {
    const { status, body } = await api(base, 'POST', '/api/auth/register', { body: CADASTRO });
    assert.equal(status, 201);
    assert.equal(body.status, 'success');
    assert.ok(body.data.token);
    assert.equal(body.data.usuario.email, CADASTRO.email);
    token = body.data.token;
  });

  it('barra e-mail duplicado com envelope legado (400)', async () => {
    const { status, body } = await api(base, 'POST', '/api/auth/register', { body: CADASTRO });
    assert.equal(status, 400);
    assert.deepEqual(body, { status: 'error', message: 'O e-mail informado já está cadastrado.' });
  });

  it('barra senha fraca (400)', async () => {
    const { status, body } = await api(base, 'POST', '/api/auth/register', {
      body: { ...CADASTRO, email: 'outro@test.com', senha: 'fraca' },
    });
    assert.equal(status, 400);
    assert.match(body.message, /mínimo 8 caracteres/);
  });

  it('loga com credenciais válidas e rejeita inválidas', async () => {
    const ok = await api(base, 'POST', '/api/auth/login', {
      body: { email: CADASTRO.email, senha: CADASTRO.senha },
    });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.token);

    const ruim = await api(base, 'POST', '/api/auth/login', {
      body: { email: CADASTRO.email, senha: 'Errada@123' },
    });
    assert.equal(ruim.status, 401);
    assert.deepEqual(ruim.body, {
      status: 'error',
      message: 'Credenciais inválidas. E-mail ou senha incorretos.',
    });
  });

  it('lê e atualiza o perfil (200)', async () => {
    const perfil = await api(base, 'GET', '/api/users/profile', { token });
    assert.equal(perfil.status, 200);
    assert.equal(perfil.body.data.usuario.email, CADASTRO.email);

    const upd = await api(base, 'PUT', '/api/users/profile', {
      token,
      body: { nome: 'Produtora', sobrenome: 'Rural', email: CADASTRO.email, telefone: '11888887777' },
    });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.usuario.telefone, '11888887777');
  });

  it('troca a senha validando a atual', async () => {
    const errada = await api(base, 'PUT', '/api/users/password', {
      token,
      body: { senhaAtual: 'Errada@123', novaSenha: 'Nova@1234', confirmarNovaSenha: 'Nova@1234' },
    });
    assert.equal(errada.status, 400);
    assert.deepEqual(errada.body, { status: 'error', message: 'Senha atual inválida.' });

    const ok = await api(base, 'PUT', '/api/users/password', {
      token,
      body: { senhaAtual: CADASTRO.senha, novaSenha: 'Nova@1234', confirmarNovaSenha: 'Nova@1234' },
    });
    assert.equal(ok.status, 200);

    const relogin = await api(base, 'POST', '/api/auth/login', {
      body: { email: CADASTRO.email, senha: 'Nova@1234' },
    });
    assert.equal(relogin.status, 200);
  });

  it('gerencia endereços com regra de propriedade', async () => {
    // lista traz o endereço do cadastro
    const lista = await api(base, 'GET', '/api/addresses', { token });
    assert.equal(lista.status, 200);
    assert.equal(lista.body.data.enderecos.length, 1);
    const proprioId = lista.body.data.enderecos[0].id;

    // cria segundo endereço
    const criado = await api(base, 'POST', '/api/addresses', {
      token,
      body: { rua: 'Rua B', numero: '10', bairro: 'Centro', cidade: 'SP', uf: 'SP', zona: 'URBANA' },
    });
    assert.equal(criado.status, 201);
    assert.equal(criado.body.data.endereco.zona, 'URBANA');

    // segundo usuário não pode mexer no endereço alheio (403)
    const outro = await api(base, 'POST', '/api/auth/register', {
      body: { ...CADASTRO, email: 'vizinho@test.com', telefone: '11777776666' },
    });
    const proibido = await api(base, 'PUT', `/api/addresses/${proprioId}`, {
      token: outro.body.data.token,
      body: { rua: 'Rua X', numero: '1', bairro: 'B', cidade: 'C', uf: 'SP', zona: 'URBANA' },
    });
    assert.equal(proibido.status, 403);

    // dono atualiza e remove
    const upd = await api(base, 'PUT', `/api/addresses/${proprioId}`, {
      token,
      body: { rua: 'Estrada Nova', numero: 'km 13', bairro: 'Zona Rural', cidade: 'Ribeirão Preto', uf: 'SP', zona: 'RURAL' },
    });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.endereco.rua, 'Estrada Nova');

    const del = await api(base, 'DELETE', `/api/addresses/${criado.body.data.endereco.id}`, { token });
    assert.equal(del.status, 200);

    const falta = await api(base, 'DELETE', '/api/addresses/99999', { token });
    assert.equal(falta.status, 404);
  });
});
