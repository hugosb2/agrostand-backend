/**
 * @file EnderecoModel.js
 * @description Modelo de dados para a entidade Endereço (Endereco).
 * Este arquivo define a classe `EnderecoModel`, que encapsula todas as operações de banco de dados
 * relacionadas à tabela `Endereco` no SQLite. As operações seguem o padrão Active Record / Data Mapper,
 * abstraindo as consultas SQL brutas (raw SQL) para uso nos controllers e serviços da aplicação.
 * 
 * Interações com o Banco de Dados:
 * - A tabela `Endereco` armazena informações de logradouro dos clientes e anunciantes.
 * - Relaciona-se com a tabela `Usuario` (representada em chaves estrangeiras como `cliente_id`).
 * - Os métodos aqui definidos utilizam uma instância compartilhada do banco de dados SQLite
 *   gerida pelo módulo `database.js`.
 */

const { getDatabaseInstance } = require('../config/bancoDeDados');

class EnderecoModel {
  /**
   * Cria um novo registro de endereço no banco de dados.
   * 
   * @param {Object} params - Parâmetros para criação do endereço.
   * @param {number} params.clienteId - ID do usuário (cliente/anunciante) associado a este endereço.
   * @param {string} params.rua - Nome da rua/logradouro.
   * @param {string} params.numero - Número do endereço.
   * @param {string} params.bairro - Bairro do endereço.
   * @param {string} params.cep - Código de Endereçamento Postal (CEP).
   * @param {string} params.cidade - Cidade do endereço.
   * @param {string} params.uf - Unidade Federativa (Estado) com 2 letras.
   * @param {string} params.zona - Zona de localização (ex: RURAL, URBANA).
   * @returns {Promise<number>} Retorna o ID gerado pelo banco de dados para o endereço inserido (`lastID`).
   * 
   * Operação DB:
   * - Executa uma query de inserção (INSERT INTO Endereco).
   * - Utiliza `db.run()` que é apropriado para comandos DML (Data Manipulation Language) que não retornam linhas,
   *   mas fornecem metadados como o ID inserido.
   * - É seguro contra SQL Injection usando placeholders (parâmetros `?`).
   * - Converte `zona` para letras maiúsculas para garantir consistência no banco.
   */
  static async create({ clienteId, rua, numero, bairro, cep, cidade, uf, zona }) {
    const db = await getDatabaseInstance();
    const result = await db.run(
      `INSERT INTO Endereco (cliente_id, rua, numero, bairro, cep, cidade, uf, zona)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [clienteId, rua, numero, bairro, cep, cidade, uf, zona.toUpperCase()]
    );
    return result.lastID;
  }

  /**
   * Busca um endereço pelo seu identificador único (ID).
   * 
   * @param {number} id - O ID do endereço a ser localizado.
   * @returns {Promise<Object|undefined>} Retorna o objeto do endereço se encontrado, ou `undefined` caso contrário.
   * 
   * Operação DB:
   * - Executa uma busca por chave primária (SELECT * FROM Endereco WHERE id = ?).
   * - Utiliza `db.get()` que retorna apenas um único registro (o primeiro encontrado).
   */
  static async findById(id) {
    const db = await getDatabaseInstance();
    return await db.get('SELECT * FROM Endereco WHERE id = ?', [id]);
  }

  /**
   * Busca todos os endereços vinculados a um determinado cliente/usuário.
   * 
   * @param {number} clienteId - ID do cliente cujos endereços serão listados.
   * @returns {Promise<Array<Object>>} Retorna uma lista (array) contendo todos os endereços do cliente.
   * 
   * Operação DB:
   * - Executa uma consulta por chave estrangeira (SELECT * FROM Endereco WHERE cliente_id = ?).
   * - Utiliza `db.all()` para retornar todas as linhas encontradas como um array de objetos Javascript.
   */
  static async findByClienteId(clienteId) {
    const db = await getDatabaseInstance();
    return await db.all('SELECT * FROM Endereco WHERE cliente_id = ?', [clienteId]);
  }

  /**
   * Atualiza os dados de um endereço existente.
   * 
   * @param {number} id - ID do endereço a ser atualizado.
   * @param {Object} params - Novos dados do endereço.
   * @param {string} params.rua - Nova rua.
   * @param {string} params.numero - Novo número.
   * @param {string} params.bairro - Novo bairro.
   * @param {string} params.cep - Novo CEP.
   * @param {string} params.cidade - Nova cidade.
   * @param {string} params.uf - Nova UF.
   * @param {string} params.zona - Nova zona (será convertida para maiúsculas).
   * @returns {Promise<boolean>} Retorna `true` após a execução bem-sucedida da query de atualização.
   * 
   * Operação DB:
   * - Executa um comando UPDATE que modifica as colunas do registro com o ID correspondente.
   * - Utiliza `db.run()` para realizar a atualização.
   */
  static async update(id, { rua, numero, bairro, cep, cidade, uf, zona }) {
    const db = await getDatabaseInstance();
    await db.run(
      `UPDATE Endereco
       SET rua = ?, numero = ?, bairro = ?, cep = ?, cidade = ?, uf = ?, zona = ?
       WHERE id = ?`,
      [rua, numero, bairro, cep, cidade, uf, zona.toUpperCase(), id]
    );
    return true;
  }

  /**
   * Remove um endereço do banco de dados pelo seu ID.
   * 
   * @param {number} id - ID do endereço a ser excluído.
   * @returns {Promise<boolean>} Retorna `true` após a remoção.
   * 
   * Operação DB:
   * - Executa um comando DELETE FROM Endereco WHERE id = ?.
   * - Utiliza `db.run()` para realizar a deleção física do registro no SQLite.
   */
  static async delete(id) {
    const db = await getDatabaseInstance();
    await db.run('DELETE FROM Endereco WHERE id = ?', [id]);
    return true;
  }
}

module.exports = EnderecoModel;
