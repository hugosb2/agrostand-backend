/**
 * @file EnderecoService.js
 * @description Camada de serviço: CRUD de endereços com regra de propriedade
 * (usuário só gerencia os próprios) e invariante `Endereco.validar()`.
 */

const EnderecoDAO = require('../dao/EnderecoDAO');
const { Endereco } = require('../domain/factories');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../errors/AppError');

class EnderecoService {
  static async list({ userId }) {
    const addresses = await EnderecoDAO.findByClienteId(userId);
    return { enderecos: addresses };
  }

  static async create({ userId, rua, numero, bairro, cep, cidade, uf, zona }) {
    // Domínio: presença dos atributos mínimos (CEP segue opcional).
    const enderecoEnt = new Endereco({ rua, numero, bairro, cep, cidade, uf, zona });
    if (!enderecoEnt.validar()) {
      throw new BadRequestError('Todos os campos obrigatórios (rua, número, bairro, cidade, UF, zona) devem ser informados.');
    }

    const upperZona = String(zona).toUpperCase();
    if (upperZona !== 'URBANA' && upperZona !== 'RURAL') {
      throw new BadRequestError('A zona deve ser classificada como URBANA ou RURAL.');
    }
    enderecoEnt.zona = upperZona;

    const addressId = await EnderecoDAO.create({
      clienteId: userId,
      rua: enderecoEnt.rua,
      numero: enderecoEnt.numero,
      bairro: enderecoEnt.bairro,
      cep: enderecoEnt.cep,
      cidade: enderecoEnt.cidade,
      uf: enderecoEnt.uf,
      zona: enderecoEnt.zona,
    });

    return {
      endereco: {
        id: addressId,
        cliente_id: userId,
        rua: enderecoEnt.rua,
        numero: enderecoEnt.numero,
        bairro: enderecoEnt.bairro,
        cep: enderecoEnt.cep,
        cidade: enderecoEnt.cidade,
        uf: enderecoEnt.uf,
        zona: enderecoEnt.zona,
      },
    };
  }

  static async update({ userId, id, rua, numero, bairro, cep, cidade, uf, zona }) {
    const enderecoEnt = new Endereco({ rua, numero, bairro, cep, cidade, uf, zona });
    if (!enderecoEnt.validar()) {
      throw new BadRequestError('Todos os campos obrigatórios (rua, número, bairro, cidade, UF, zona) devem ser informados.');
    }

    const upperZona = String(zona).toUpperCase();
    if (upperZona !== 'URBANA' && upperZona !== 'RURAL') {
      throw new BadRequestError('A zona deve ser classificada como URBANA ou RURAL.');
    }
    enderecoEnt.zona = upperZona;

    const existingAddress = await EnderecoDAO.findById(id);
    if (!existingAddress) {
      throw new NotFoundError('Endereço não encontrado.');
    }
    if (existingAddress.cliente_id !== userId) {
      throw new ForbiddenError('Você não tem permissão para alterar este endereço.');
    }

    await EnderecoDAO.update(id, {
      rua: enderecoEnt.rua,
      numero: enderecoEnt.numero,
      bairro: enderecoEnt.bairro,
      cep: enderecoEnt.cep,
      cidade: enderecoEnt.cidade,
      uf: enderecoEnt.uf,
      zona: enderecoEnt.zona,
    });

    return {
      endereco: {
        id: parseInt(id),
        cliente_id: userId,
        rua: enderecoEnt.rua,
        numero: enderecoEnt.numero,
        bairro: enderecoEnt.bairro,
        cep: enderecoEnt.cep,
        cidade: enderecoEnt.cidade,
        uf: enderecoEnt.uf,
        zona: enderecoEnt.zona,
      },
    };
  }

  static async delete({ userId, id }) {
    const existingAddress = await EnderecoDAO.findById(id);
    if (!existingAddress) {
      throw new NotFoundError('Endereço não encontrado.');
    }
    if (existingAddress.cliente_id !== userId) {
      throw new ForbiddenError('Você não tem permissão para remover este endereço.');
    }

    await EnderecoDAO.delete(id);
  }
}

module.exports = EnderecoService;
