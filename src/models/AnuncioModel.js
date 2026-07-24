/**
 * @file AnuncioModel.js
 * @description Modelo de dados para a entidade Anúncio (Ad).
 * Este arquivo define a classe `AnuncioModel`, responsável por gerenciar a persistência e busca de anúncios
 * no banco de dados SQLite. Contém consultas complexas com junções (JOINs), paginação dinâmica,
 * busca textual, filtros e regras de negócio como soft delete (lixeira) e expiração automática de registros.
 * 
 * Interações com o Banco de Dados:
 * - A tabela `Anuncio` relaciona-se com `Usuario` (Vendedor), `Categoria` e `Endereco`.
 * - Possui relacionamento um-para-muitos com a tabela `Imagem` (imagens do anúncio).
 * - Emprega mecanismos de soft delete para colocar anúncios em uma lixeira temporária antes da exclusão física.
 */

const { getDatabaseInstance } = require('../config/bancoDeDados');

class AnuncioModel {
  /**
   * Cria um novo anúncio no banco de dados. Por padrão, o status inicial é 'ATIVO'.
   * 
   * @param {Object} params - Dados para criação do anúncio.
   * @param {number} params.anuncianteId - ID do anunciante (Usuario).
   * @param {number} params.categoriaId - ID da categoria associada.
   * @param {number} params.enderecoId - ID do endereço físico onde se encontra o produto/serviço.
   * @param {string} params.nome - Título/Nome do anúncio.
   * @param {string} params.descricao - Detalhes/Descrição do anúncio.
   * @param {number} params.preco - Preço do item anunciado.
   * @returns {Promise<number>} Retorna o ID gerado pelo banco para o anúncio (`lastID`).
   * 
   * Operação DB:
   * - Executa o comando INSERT INTO Anuncio.
   * - Define o status padrão do anúncio como 'ATIVO'.
   * - Usa `db.run()` e retorna o identificador único gerado.
   */
  static async create({ anuncianteId, categoriaId, enderecoId, nome, descricao, preco }) {
    const db = await getDatabaseInstance();
    const result = await db.run(
      `INSERT INTO Anuncio (anunciante_id, categoria_id, endereco_id, nome, descricao, preco, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ATIVO')`,
      [anuncianteId, categoriaId, enderecoId, nome, descricao, preco]
    );
    return result.lastID;
  }

  /**
   * Recupera um anúncio completo com base no seu ID, juntando dados do anunciante,
   * categoria, endereço e trazendo a galeria de imagens associada.
   * 
   * @param {number} id - ID do anúncio.
   * @param {boolean} [includeInactive=false] - Se deve trazer o anúncio mesmo se ele não estiver ativo (ex: na lixeira).
   * @returns {Promise<Object|null>} Retorna o objeto do anúncio populado, ou `null` se não encontrado.
   * 
   * Operação DB:
   * - Executa uma query de busca com múltiplos INNER JOINs para associar dados do vendedor (Usuario),
   *   da categoria e do endereço correspondente.
   * - Aplica o filtro de status 'ATIVO' condicionalmente.
   * - Em seguida, realiza uma segunda query (SELECT em Imagem) para carregar as imagens do anúncio
   *   ordenadas pelo tipo (PRINCIPAL primeiro) e depois pelo campo `ordem`.
   * - Une os resultados em um único objeto de retorno formatado.
   */
  static async findById(id, includeInactive = false) {
    const db = await getDatabaseInstance();
    
    // Query base unindo as tabelas relacionadas
    let query = `
      SELECT 
        a.id, a.nome, a.descricao, a.preco, a.data_publicacao, a.status, a.data_remocao,
        a.anunciante_id, a.categoria_id, a.endereco_id,
        u.nome as vendedor_nome, u.sobrenome as vendedor_sobrenome, u.telefone as vendedor_telefone,
        c.nome as categoria_nome,
        e.rua, e.numero, e.bairro, e.cep, e.cidade, e.uf, e.zona
      FROM Anuncio a
      INNER JOIN Usuario u ON a.anunciante_id = u.id
      INNER JOIN Categoria c ON a.categoria_id = c.id
      INNER JOIN Endereco e ON a.endereco_id = e.id
      WHERE a.id = ?
    `;

    // Filtra para garantir que apenas anúncios ativos sejam exibidos no marketplace geral
    if (!includeInactive) {
      query += " AND a.status = 'ATIVO'";
    }

    const ad = await db.get(query, [id]);
    if (!ad) return null;

    // Busca as imagens associadas ao anúncio
    // O ordenamento garante que imagens do tipo 'PRINCIPAL' sejam retornadas primeiro,
    // seguidas pelas secundárias ordenadas pelo campo 'ordem' (ordenação numérica).
    const images = await db.all(
      'SELECT id, url, tipo, ordem FROM Imagem WHERE anuncio_id = ? ORDER BY tipo DESC, ordem ASC',
      [id]
    );

    return {
      ...ad,
      imagens: images
    };
  }

  /**
   * Busca anúncios de forma paginada e dinâmica, permitindo múltiplos filtros.
   * 
   * @param {Object} params - Filtros e paginação.
   * @param {number} [params.page=1] - Página atual da paginação.
   * @param {number} [params.limit=10] - Quantidade máxima de registros retornados por página.
   * @param {number} [params.categoryId] - Filtrar por uma categoria específica.
   * @param {string} [params.search] - Termo de busca textual para nome/descrição do anúncio ou categoria.
   * @param {number} [params.anuncianteId] - Filtrar anúncios de um anunciante específico.
   * @param {string} [params.status='ATIVO'] - Status do anúncio filtrado (ex: ATIVO, EM_LIXEIRA).
   * @returns {Promise<Object>} Retorna um objeto com a lista de anúncios formatados e os dados de paginação.
   * 
   * Operação DB:
   * - Monta dinamicamente duas queries: uma para contagem (`countQuery`) e outra para seleção dos dados (`selectQuery`).
   * - Os filtros são aplicados em ambas as queries em paralelo com o preenchimento de um array de parâmetros (`queryParams`)
   *   para evitar brechas de SQL Injection.
   * - A paginação calcula o `offset` (deslocamento) com base na página solicitada: `offset = (page - 1) * limit`.
   * - Após a seleção dos anúncios correspondentes, recupera a imagem 'PRINCIPAL' de todos os anúncios listados em uma
   *   única consulta utilizando a cláusula `IN (...)` para otimizar o desempenho do banco.
   * - Mapeia as imagens aos seus respectivos anúncios e retorna o resultado estruturado.
   */
  static async findAll({ page = 1, limit = 10, categoryId, search, anuncianteId, status = 'ATIVO' }) {
    const db = await getDatabaseInstance();
    const offset = (page - 1) * limit;

    let queryParams = [];
    let countQuery = `SELECT COUNT(*) as count FROM Anuncio a WHERE a.status = ?`;
    queryParams.push(status);

    let selectQuery = `
      SELECT 
        a.id, a.nome, a.descricao, a.preco, a.data_publicacao, a.status,
        a.anunciante_id, a.categoria_id, a.endereco_id,
        u.nome as vendedor_nome, u.sobrenome as vendedor_sobrenome,
        c.nome as categoria_nome,
        e.cidade, e.uf, e.zona
      FROM Anuncio a
      INNER JOIN Usuario u ON a.anunciante_id = u.id
      INNER JOIN Categoria c ON a.categoria_id = c.id
      INNER JOIN Endereco e ON a.endereco_id = e.id
      WHERE a.status = ?
    `;

    // Filtro Dinâmico: Categoria
    if (categoryId) {
      countQuery += ` AND a.categoria_id = ?`;
      selectQuery += ` AND a.categoria_id = ?`;
      queryParams.push(categoryId);
    }

    // Filtro Dinâmico: Anunciante (útil no painel do próprio usuário)
    if (anuncianteId) {
      countQuery += ` AND a.anunciante_id = ?`;
      selectQuery += ` AND a.anunciante_id = ?`;
      queryParams.push(anuncianteId);
    }

    // Filtro Dinâmico: Busca por texto (LIKE no nome, descrição ou categoria)
    if (search) {
      const searchPattern = `%${search}%`;
      countQuery += ` AND (a.nome LIKE ? OR a.descricao LIKE ? OR c.nome LIKE ?)`;
      selectQuery += ` AND (a.nome LIKE ? OR a.descricao LIKE ? OR c.nome LIKE ?)`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Executa a query de contagem para obter o total de registros sem paginação
    const totalCountResult = await db.get(countQuery, queryParams);
    const total = totalCountResult ? totalCountResult.count : 0;

    // Adiciona ordenação (mais recentes primeiro) e limites da paginação na consulta final
    selectQuery += ` ORDER BY a.data_publicacao DESC LIMIT ? OFFSET ?`;
    
    // Cria um novo array com os parâmetros da query de busca contendo o LIMIT e OFFSET no final
    const selectParams = [...queryParams, limit, offset];
    const ads = await db.all(selectQuery, selectParams);

    // Otimização: Busca as imagens principais de todos os anúncios selecionados em uma única query
    const adIds = ads.map(a => a.id);
    let images = [];
    if (adIds.length > 0) {
      const placeholders = adIds.map(() => '?').join(',');
      images = await db.all(
        `SELECT id, anuncio_id, url, tipo, ordem 
         FROM Imagem 
         WHERE anuncio_id IN (${placeholders}) AND tipo = 'PRINCIPAL'`,
        adIds
      );
    }

    // Associa cada imagem principal encontrada ao respectivo anúncio
    const adsWithImages = ads.map(ad => {
      const primaryImage = images.find(img => img.anuncio_id === ad.id);
      return {
        ...ad,
        imagem_principal: primaryImage ? primaryImage.url : null
      };
    });

    return {
      data: adsWithImages,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Atualiza os dados cadastrais básicos de um anúncio específico.
   * 
   * @param {number} id - ID do anúncio.
   * @param {Object} params - Novos dados do anúncio.
   * @param {number} params.categoriaId - ID da categoria.
   * @param {number} params.enderecoId - ID do endereço físico associado.
   * @param {string} params.nome - Título do anúncio.
   * @param {string} params.descricao - Descrição do anúncio.
   * @param {number} params.preco - Novo preço.
   * @returns {Promise<boolean>} Retorna `true` se a query for executada com sucesso.
   * 
   * Operação DB:
   * - Executa o comando UPDATE Anuncio para os campos informados.
   * - Usa `db.run()`.
   */
  static async update(id, { categoriaId, enderecoId, nome, descricao, preco }) {
    const db = await getDatabaseInstance();
    await db.run(
      `UPDATE Anuncio
       SET categoria_id = ?, endereco_id = ?, nome = ?, descricao = ?, preco = ?
       WHERE id = ?`,
      [categoriaId, enderecoId, nome, descricao, preco, id]
    );
    return true;
  }

  /**
   * RS09: Soft delete (envia para a Lixeira temporária).
   * Altera o status do anúncio de 'ATIVO' para 'EM_LIXEIRA' e registra a data atual da remoção.
   * Desta forma, o anúncio deixa de aparecer nas buscas públicas do marketplace, mas pode ser
   * recuperado pelo anunciante no painel pessoal num período de até 30 dias.
   * 
   * @param {number} id - ID do anúncio a ser movido para a lixeira.
   * @returns {Promise<boolean>} Retorna `true` após atualizar o status do anúncio.
   * 
   * Operação DB:
   * - Executa UPDATE Anuncio SET status = 'EM_LIXEIRA', data_remocao = ? WHERE id = ?.
   * - Salva o carimbo de data/hora atual em formato ISO.
   * - Usa `db.run()`.
   */
  static async moveToLixeira(id) {
    const db = await getDatabaseInstance();
    const dataRemocao = new Date().toISOString();
    await db.run(
      `UPDATE Anuncio
       SET status = 'EM_LIXEIRA', data_remocao = ?
       WHERE id = ?`,
      [dataRemocao, id]
    );
    return true;
  }

  /**
   * Restaura um anúncio previamente movido para a lixeira, reativando-o no marketplace.
   * 
   * @param {number} id - ID do anúncio a ser restaurado.
   * @returns {Promise<boolean>} Retorna `true` após restaurar o anúncio.
   * 
   * Operação DB:
   * - Executa UPDATE Anuncio SET status = 'ATIVO', data_remocao = NULL WHERE id = ?.
   * - Limpa o campo `data_remocao` definindo-o como nulo.
   * - Usa `db.run()`.
   */
  static async restoreFromLixeira(id) {
    const db = await getDatabaseInstance();
    await db.run(
      `UPDATE Anuncio
       SET status = 'ATIVO', data_remocao = NULL
       WHERE id = ?`,
      [id]
    );
    return true;
  }

  /**
   * RS09: Limpeza automática de anúncios na lixeira há mais de 30 dias.
   * Esta função varre a lixeira em busca de anúncios removidos há mais de 30 dias e
   * executa a exclusão definitiva (hard delete) deles no banco de dados.
   * 
   * @returns {Promise<number>} Retorna a quantidade de anúncios excluídos de forma definitiva.
   * 
   * Operação DB:
   * - Calcula a data limite (30 dias atrás) em formato ISO.
   * - Consulta anúncios com status 'EM_LIXEIRA' e com `data_remocao` menor que a data limite.
   * - Se existirem anúncios expirados, realiza o DELETE físico dos mesmos.
   * - Note que as chaves estrangeiras com ON DELETE CASCADE configuradas nas tabelas dependentes
   *   (como a tabela de Imagens) se encarregarão de remover automaticamente os registros associados.
   */
  static async cleanupLixeira() {
    const db = await getDatabaseInstance();
    // Obtém a data de 30 dias atrás
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffStr = cutoffDate.toISOString();

    // Seleciona os anúncios que passaram do prazo de 30 dias na lixeira
    const adsToDelete = await db.all(
      `SELECT id FROM Anuncio 
       WHERE status = 'EM_LIXEIRA' AND data_remocao < ?`,
      [cutoffStr]
    );

    const count = adsToDelete.length;
    if (count > 0) {
      const ids = adsToDelete.map(a => a.id).join(',');
      // Deleta definitivamente do banco os anúncios identificados
      // As restrições de CASCADE DELETE do SQLite apagam as imagens vinculadas do DB automaticamente.
      await db.run(`DELETE FROM Anuncio WHERE id IN (${ids})`);
    }
    return count;
  }
}

module.exports = AnuncioModel;
