/**
 * @file CategoriaController.js
 * @description Controller responsável por gerenciar as operações relacionadas às categorias de produtos.
 * Este controller atua como a camada intermediária entre as requisições HTTP (rotas) e o modelo de dados (CategoriaModel),
 * processando as solicitações do usuário e retornando as respostas adequadas.
 * 
 * Papel em um ambiente Express:
 * - Receber as requisições de listagem de categorias.
 * - Invocar o CategoriaModel para buscar os dados no banco de dados SQLite.
 * - Formatar e retornar a resposta HTTP no formato JSON.
 * - Encaminhar quaisquer erros para o middleware de tratamento global de erros da aplicação.
 */

// Importa o modelo de Categorias para permitir a interação direta com a tabela correspondente no banco de dados SQLite.
const CategoriaModel = require('../models/CategoriaModel');

class CategoriaController {
  /**
   * @route GET /categories (ou rota equivalente)
   * @description Recupera e retorna todas as categorias cadastradas no sistema.
   * 
   * @param {Object} req - Objeto de requisição do Express (Request). Contém dados sobre a solicitação HTTP.
   * @param {Object} res - Objeto de resposta do Express (Response). Utilizado para enviar a resposta de volta ao cliente.
   * @param {Function} next - Função de callback do Express para passar o controle ao próximo middleware na pilha.
   *                          Essencial para a propagação e tratamento correto de exceções/erros assíncronos.
   * 
   * @returns {Promise<Response>} Retorna uma resposta HTTP 200 (OK) com o objeto JSON contendo a lista de categorias.
   */
  static async list(req, res, next) {
    try {
      // Chama o método estático findAll do CategoriaModel para recuperar o array de categorias do banco de dados.
      const categories = await CategoriaModel.findAll();
      
      // Retorna uma resposta de sucesso (HTTP 200) encapsulando a lista de categorias estruturada em 'data.categorias'.
      return res.status(200).json({
        status: 'success',
        data: {
          categorias: categories
        }
      });
    } catch (error) {
      // Se ocorrer qualquer erro durante a consulta ao banco de dados (ex: falha de conexão, erro de sintaxe SQL),
      // o erro é capturado e enviado para o próximo middleware de tratamento de erros usando a função next().
      next(error);
    }
  }
}

// Exporta a classe do controller para que possa ser utilizada na definição das rotas do Express.
module.exports = CategoriaController;
