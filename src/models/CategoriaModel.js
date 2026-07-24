/**
 * @file CategoriaModel.js
 * @description Modelo de dados para a entidade Categoria (Category).
 * Este arquivo encapsula todas as operações de banco de dados relacionadas à tabela `Categoria`
 * no SQLite. As categorias servem para classificar os anúncios de produtos agrícolas (ex: Sementes,
 * Tratores, Fertilizantes, etc.).
 * 
 * Interações com o Banco de Dados:
 * - Realiza consultas e inserções na tabela `Categoria`.
 * - É referenciada pela tabela `Anuncio` por meio do campo chave estrangeira `categoria_id`.
 */

const { getDatabaseInstance } = require('../config/bancoDeDados');

class CategoriaModel {
  /**
   * Recupera todas as categorias cadastradas no banco de dados, ordenadas alfabeticamente.
   * 
   * @returns {Promise<Array<Object>>} Retorna uma lista de objetos contendo todas as categorias.
   * 
   * Operação DB:
   * - Executa o comando SELECT * FROM Categoria ORDER BY nome ASC.
   * - Usa `db.all()` para retornar todas as linhas encontradas ordenadas de forma ascendente (A-Z).
   */
  static async findAll() {
    const db = await getDatabaseInstance();
    return await db.all('SELECT * FROM Categoria ORDER BY nome ASC');
  }

  /**
   * Busca uma categoria específica por seu identificador (ID).
   * 
   * @param {number} id - O ID da categoria a ser encontrada.
   * @returns {Promise<Object|undefined>} Retorna o objeto da categoria se encontrada, ou `undefined`.
   * 
   * Operação DB:
   * - Executa a consulta SELECT * FROM Categoria WHERE id = ?.
   * - Usa `db.get()` para retornar a primeira linha encontrada.
   */
  static async findById(id) {
    const db = await getDatabaseInstance();
    return await db.get('SELECT * FROM Categoria WHERE id = ?', [id]);
  }

  /**
   * Busca uma categoria por seu nome exato. Geralmente usada para evitar duplicidade.
   * 
   * @param {string} nome - O nome da categoria a ser buscada.
   * @returns {Promise<Object|undefined>} Retorna a categoria encontrada ou `undefined`.
   * 
   * Operação DB:
   * - Executa a consulta SELECT * FROM Categoria WHERE nome = ?.
   * - Usa `db.get()` para retornar o registro.
   */
  static async findByName(nome) {
    const db = await getDatabaseInstance();
    return await db.get('SELECT * FROM Categoria WHERE nome = ?', [nome]);
  }

  /**
   * Cria uma nova categoria no banco de dados.
   * 
   * @param {Object} params - Dados da nova categoria.
   * @param {string} params.nome - Nome da categoria.
   * @param {string} params.descricao - Breve descrição sobre o tipo de produtos que ela engloba.
   * @returns {Promise<number>} Retorna o ID gerado para a nova categoria cadastrada (`lastID`).
   * 
   * Operação DB:
   * - Executa INSERT INTO Categoria (nome, descricao) VALUES (?, ?).
   * - Usa `db.run()` para realizar a inserção física e recuperar o ID gerado automaticamente.
   */
  static async create({ nome, descricao }) {
    const db = await getDatabaseInstance();
    const result = await db.run(
      'INSERT INTO Categoria (nome, descricao) VALUES (?, ?)',
      [nome, descricao]
    );
    return result.lastID;
  }
}

module.exports = CategoriaModel;
