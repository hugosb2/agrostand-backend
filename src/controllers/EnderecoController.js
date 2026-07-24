/**
 * @file EnderecoController.js
 * @description Controller responsável pelas operações de CRUD (Criar, Ler, Atualizar e Deletar)
 * dos endereços associados aos clientes/usuários cadastrados no sistema.
 * 
 * Aspectos Importantes da Implementação:
 * - Controle de Propriedade: Garante que os usuários possam gerenciar apenas os seus próprios endereços,
 *   impedindo acessos ou edições não autorizados de endereços de terceiros (validação de propriedade).
 * - Classificação de Zona: Classifica obrigatoriamente a zona geográfica em 'URBANA' ou 'RURAL',
 *   o que pode influenciar rotas de logística, regras de entrega ou impostos.
 * - Tratamento de Erros: Todos os erros síncronos e assíncronos são repassados ao Express por meio de `next(error)`.
 */

// Importa o modelo de dados de Endereço para interagir com as operações na tabela de endereços no SQLite.
const EnderecoModel = require('../models/EnderecoModel');

class EnderecoController {
  /**
   * @route GET /addresses (ou equivalente)
   * @description Retorna a lista de todos os endereços cadastrados para o usuário autenticado.
   * 
   * @param {Object} req - Objeto de requisição do Express contendo as informações da sessão em `req.user`.
   * @param {Object} res - Objeto de resposta do Express.
   * @param {Function} next - Callback para encaminhar exceções.
   * 
   * @returns {Promise<Response>} Retorna status 200 com a lista de endereços do usuário.
   */
  static async list(req, res, next) {
    // Obtém o ID do usuário atualmente autenticado a partir do token decodificado.
    const userId = req.user.id;

    try {
      // Consulta todos os endereços do banco de dados que possuem a chave estrangeira igual ao ID do usuário.
      const addresses = await EnderecoModel.findByClienteId(userId);
      
      // Retorna a resposta HTTP contendo a lista no campo `data.enderecos`.
      return res.status(200).json({
        status: 'success',
        data: {
          enderecos: addresses
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route POST /addresses (ou equivalente)
   * @description Cadastra um novo endereço para o usuário autenticado.
   * 
   * @param {Object} req - Objeto de requisição contendo os campos do endereço no corpo (`req.body`).
   * @param {Object} res - Objeto de resposta.
   * @param {Function} next - Callback para encaminhar exceções.
   * 
   * @returns {Promise<Response>} Retorna status 201 (Created) e os dados do endereço criado, ou 400 se houver erros de validação.
   */
  static async create(req, res, next) {
    const userId = req.user.id;
    // Desestrutura todos os campos recebidos no corpo da requisição HTTP POST.
    const { rua, numero, bairro, cep, cidade, uf, zona } = req.body;

    try {
      // 1. Validação de Campos Obrigatórios: Garante a presença dos atributos mínimos exigidos para o endereço.
      // Observação: O CEP não é validado obrigatoriamente neste IF, mantendo o comportamento original do código.
      if (!rua || !numero || !bairro || !cidade || !uf || !zona) {
        return res.status(400).json({
          status: 'error',
          message: 'Todos os campos obrigatórios (rua, número, bairro, cidade, UF, zona) devem ser informados.'
        });
      }

      // 2. Padronização e Validação do campo 'zona':
      // Normaliza o texto para letras maiúsculas a fim de garantir consistência na comparação e armazenamento.
      const upperZona = zona.toUpperCase();
      // O valor da zona deve ser estritamente 'URBANA' ou 'RURAL'.
      if (upperZona !== 'URBANA' && upperZona !== 'RURAL') {
        return res.status(400).json({
          status: 'error',
          message: 'A zona deve ser classificada como URBANA ou RURAL.'
        });
      }

      // 3. Persistência de Dados: Insere o novo endereço associado ao cliente logado no SQLite.
      const addressId = await EnderecoModel.create({
        clienteId: userId,
        rua,
        numero,
        bairro,
        cep,
        cidade,
        uf,
        zona: upperZona
      });

      // 4. Retorno: Retorna status 201 indicando recurso criado com sucesso, juntamente com o ID gerado pelo banco.
      return res.status(201).json({
        status: 'success',
        message: 'Endereço cadastrado com sucesso.',
        data: {
          endereco: {
            id: addressId,
            cliente_id: userId,
            rua,
            numero,
            bairro,
            cep,
            cidade,
            uf,
            zona: upperZona
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route PUT /addresses/:id (ou equivalente)
   * @description Atualiza um endereço existente do usuário autenticado após validar sua propriedade.
   * 
   * @param {Object} req - Objeto de requisição contendo os novos campos no corpo (`req.body`) e o id do endereço nos parâmetros da rota (`req.params.id`).
   * @param {Object} res - Objeto de resposta.
   * @param {Function} next - Callback para encaminhar exceções.
   * 
   * @returns {Promise<Response>} Retorna status 200 e os dados atualizados, ou 400/403/404 em caso de erros ou falta de permissão.
   */
  static async update(req, res, next) {
    const userId = req.user.id;
    // O ID do endereço a ser modificado é extraído dos parâmetros de URL definidos na rota (ex: /enderecos/:id).
    const { id } = req.params;
    const { rua, numero, bairro, cep, cidade, uf, zona } = req.body;

    try {
      // 1. Validação de Campos Obrigatórios:
      if (!rua || !numero || !bairro || !cidade || !uf || !zona) {
        return res.status(400).json({
          status: 'error',
          message: 'Todos os campos obrigatórios (rua, número, bairro, cidade, UF, zona) devem ser informados.'
        });
      }

      // 2. Padronização e Validação do campo 'zona':
      const upperZona = zona.toUpperCase();
      if (upperZona !== 'URBANA' && upperZona !== 'RURAL') {
        return res.status(400).json({
          status: 'error',
          message: 'A zona deve ser classificada como URBANA ou RURAL.'
        });
      }

      // 3. Verificação de Propriedade / Autorização:
      // Recupera o endereço do banco de dados antes de efetuar qualquer alteração.
      const existingAddress = await EnderecoModel.findById(id);
      
      // Se não existir nenhum endereço cadastrado com o ID especificado nos parâmetros da URL, retorna 404 Not Found.
      if (!existingAddress) {
        return res.status(404).json({
          status: 'error',
          message: 'Endereço não encontrado.'
        });
      }

      // Validação Crítica de Segurança: Compara o ID do proprietário do endereço cadastrado com o ID do usuário que fez a requisição.
      // Se forem diferentes, o usuário está tentando invadir/alterar um dado de outra pessoa. Bloqueia com 403 Forbidden.
      if (existingAddress.cliente_id !== userId) {
        return res.status(403).json({
          status: 'error',
          message: 'Você não tem permissão para alterar este endereço.'
        });
      }

      // 4. Executa a Atualização: Persiste as novas informações de endereço no banco de dados.
      await EnderecoModel.update(id, { rua, numero, bairro, cep, cidade, uf, zona: upperZona });

      // 5. Retorna Resposta de Sucesso:
      return res.status(200).json({
        status: 'success',
        message: 'Endereço atualizado com sucesso.',
        data: {
          endereco: {
            id: parseInt(id),
            cliente_id: userId,
            rua,
            numero,
            bairro,
            cep,
            cidade,
            uf,
            zona: upperZona
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route DELETE /addresses/:id (ou equivalente)
   * @description Remove um endereço existente do usuário autenticado após validar sua propriedade.
   * 
   * @param {Object} req - Objeto de requisição com o ID do endereço a ser excluído nos parâmetros da URL (`req.params.id`).
   * @param {Object} res - Objeto de resposta.
   * @param {Function} next - Callback para encaminhar exceções.
   * 
   * @returns {Promise<Response>} Retorna status 200 em caso de sucesso, ou 403/404 em caso de erro de autorização ou se o recurso não for encontrado.
   */
  static async delete(req, res, next) {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      // 1. Busca o endereço para certificar sua existência.
      const existingAddress = await EnderecoModel.findById(id);
      if (!existingAddress) {
        return res.status(404).json({
          status: 'error',
          message: 'Endereço não encontrado.'
        });
      }

      // 2. Validação Crítica de Segurança: Garante que apenas o proprietário do endereço possa excluí-lo.
      if (existingAddress.cliente_id !== userId) {
        return res.status(403).json({
          status: 'error',
          message: 'Você não tem permissão para remover este endereço.'
        });
      }

      // 3. Exclusão Física no Banco: Deleta permanentemente o endereço no SQLite.
      await EnderecoModel.delete(id);

      // 4. Retorno de Confirmação:
      return res.status(200).json({
        status: 'success',
        message: 'Endereço removido com sucesso.'
      });
    } catch (error) {
      next(error);
    }
  }
}

// Exporta a classe do controller para acoplamento com o sistema de roteamento do Express.
module.exports = EnderecoController;
